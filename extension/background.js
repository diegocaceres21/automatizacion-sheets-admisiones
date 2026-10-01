// Service worker: abre el panel, recibe avisos de SIAAN y prepara al estudiante confirmado.
// Estado compartido con el panel en chrome.storage.session:
//   siaanPreview   { data, tabId, at }               vista previa de "Revisar preinscripción" (no registrable)
//   pendingStudent { student, source, at }           estudiante CONFIRMADO listo para registrar
//   confirmError   { message, at }                   error al leer un estudiante recién confirmado

import { getSession, getStudent, findConfirmed } from './lib/siaan.js';
import { getSpreadsheetId } from './lib/configStore.js';
import { periodoCode } from './lib/siaanMatch.js';
import { reportError } from './lib/errors.js';

const DEFAULTS = { siaanIdRegional: 'PJh5GJydX69ABmU3tKVdpQ==', siaanIdEstadoConfirmado: 'ooo40MW8KdnMovKywZ6qzQ==' };

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  await injectIntoOpenTabs();
  // Sin ID de planilla (instalación de desarrollo sin defaults.json): abrir Opciones para configurarlo.
  if (reason === 'install' && !(await getSpreadsheetId())) chrome.runtime.openOptionsPage();
});

/**
 * Chrome no inyecta los content scripts en pestañas que ya estaban abiertas al instalar o actualizar
 * la extensión. Sin esto, "Confirmar" en una pestaña de SIAAN abierta de antes no llegaba al panel.
 */
async function injectIntoOpenTabs() {
  const tabs = await chrome.tabs.query({ url: 'https://academico.ucb.edu.bo/*' });
  for (const tab of tabs) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/siaan-hook.js'], world: 'MAIN' });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/siaan.js'] });
    } catch (e) {
      console.warn('[Admisiones UCB] No se pudo preparar la pestaña de SIAAN', tab.id, e);
    }
  }
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'siaan:preview') {
    chrome.storage.session.set({ siaanPreview: msg.data ? { data: msg.data, tabId: sender.tab?.id, at: Date.now() } : null });
  } else if (msg.type === 'siaan:confirmed') {
    handleConfirmed(msg.idPreInscripcion, msg.preview, sender.tab?.id);
  }
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Parámetros de búsqueda de SIAAN desde la CONFIG en caché (o los valores conocidos si aún no se cargó). */
async function siaanParams() {
  const { configCache } = await chrome.storage.session.get('configCache');
  const rows = configCache?.tabs?.CONFIG_GENERAL || [];
  const get = (k) => rows.find((r) => r[0] === k)?.[1];
  return {
    siaanIdRegional: get('siaanIdRegional') || DEFAULTS.siaanIdRegional,
    siaanIdEstadoConfirmado: get('siaanIdEstadoConfirmado') || DEFAULTS.siaanIdEstadoConfirmado
  };
}

/**
 * Fila CONFIRMADA de la preinscripción. Con id, la busca por id; sin id (gancho instalado tarde),
 * por el CI de la vista y, si hay varias, por el periodo que mostraba la vista.
 */
function pickRow(rows, idPreInscripcion, preview) {
  if (idPreInscripcion) return rows.find((r) => r.idPreInscripcion === idPreInscripcion) || null;
  if (rows.length === 1) return rows[0];
  const code = periodoCode(preview?.periodo);
  const byPeriodo = rows.filter((r) => code && periodoCode(r.periodo) === code);
  return byPeriodo.length === 1 ? byPeriodo[0] : null;
}

async function handleConfirmed(idPreInscripcion, preview, tabId) {
  // Intentar abrir el panel; Chrome puede rechazarlo sin un clic del usuario. En ese caso queda el badge.
  if (tabId !== undefined) chrome.sidePanel.open({ tabId }).catch(() => {});
  try {
    const ci = preview?.ci;
    if (!idPreInscripcion && !ci) {
      throw new Error('Se confirmó una preinscripción en SIAAN, pero no se pudo identificar al estudiante. Búsquelo por CI.');
    }
    const session = await getSession();

    // SIAAN puede tardar un instante en listarla como CONFIRMADA.
    // La fila de la lista trae además el periodo y la carrera (ya con los cambios hechos con "Editar").
    let student = idPreInscripcion ? await getStudent(session, idPreInscripcion) : null;
    const searchCI = student?.ci || ci;
    let row = null;
    for (let i = 0; i < 4 && !row; i++) {
      if (i) await sleep(1500);
      row = pickRow(await findConfirmed(session, searchCI, await siaanParams()), idPreInscripcion, preview);
    }
    if (!row) {
      throw new Error(`SIAAN todavía no muestra como CONFIRMADA la preinscripción del CI ${searchCI}. Búsquela por CI en unos segundos.`);
    }
    if (!student) student = await getStudent(session, row.idPreInscripcion);
    student = { ...student, periodo: row.periodo, carreraSIAAN: row.carreraSIAAN };

    await chrome.storage.session.set({ pendingStudent: { student, source: 'confirmacion', at: Date.now() }, confirmError: null });
    await chrome.action.setBadgeBackgroundColor({ color: '#137333' });
    await chrome.action.setBadgeText({ text: '1' });
  } catch (e) {
    const message = reportError('Confirmación en SIAAN', e, 'No se pudo cargar al estudiante confirmado.');
    await chrome.storage.session.set({ confirmError: { message, at: Date.now() } });
    await chrome.action.setBadgeBackgroundColor({ color: '#c5221f' });
    await chrome.action.setBadgeText({ text: '!' });
  }
}
