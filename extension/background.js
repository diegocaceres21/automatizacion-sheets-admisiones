// Service worker: abre el panel, recibe avisos de SIAAN y prepara al estudiante confirmado.
// Estado compartido con el panel en chrome.storage.session:
//   siaanPreview   { data, tabId, at }               vista previa de "Revisar preinscripción" (no registrable)
//   pendingStudent { student, source, at }           estudiante CONFIRMADO listo para registrar
//   confirmError   { message, at }                   error al leer un estudiante recién confirmado

import { getSession, getStudent, findConfirmed } from './lib/siaan.js';
import { getSpreadsheetId } from './lib/configStore.js';

const DEFAULTS = { siaanIdRegional: 'PJh5GJydX69ABmU3tKVdpQ==', siaanIdEstadoConfirmado: 'ooo40MW8KdnMovKywZ6qzQ==' };

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  // Sin ID de planilla (instalación de desarrollo sin defaults.json): abrir Opciones para configurarlo.
  if (reason === 'install' && !(await getSpreadsheetId())) chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'siaan:preview') {
    chrome.storage.session.set({ siaanPreview: msg.data ? { data: msg.data, tabId: sender.tab?.id, at: Date.now() } : null });
  } else if (msg.type === 'siaan:confirmed') {
    handleConfirmed(msg.idPreInscripcion, sender.tab?.id);
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

async function handleConfirmed(idPreInscripcion, tabId) {
  // Intentar abrir el panel; Chrome puede rechazarlo sin un clic del usuario. En ese caso queda el badge.
  if (tabId !== undefined) chrome.sidePanel.open({ tabId }).catch(() => {});
  try {
    const session = await getSession();
    let student = await getStudent(session, idPreInscripcion);

    // Comprobar que SIAAN ya la lista como CONFIRMADA (puede tardar un instante).
    // La fila de la lista trae además el periodo y la carrera (ya con los cambios hechos con "Editar").
    let row = null;
    for (let i = 0; i < 4 && !row; i++) {
      if (i) await sleep(1500);
      row = (await findConfirmed(session, student.ci, await siaanParams())).find((r) => r.idPreInscripcion === idPreInscripcion) || null;
    }
    if (!row) throw new Error(`SIAAN todavía no muestra como CONFIRMADA la preinscripción de ${student.nombre}. Búsquela por CI en unos segundos.`);
    student = { ...student, periodo: row.periodo, carreraSIAAN: row.carreraSIAAN };

    await chrome.storage.session.set({ pendingStudent: { student, source: 'confirmacion', at: Date.now() }, confirmError: null });
    await chrome.action.setBadgeBackgroundColor({ color: '#137333' });
    await chrome.action.setBadgeText({ text: '1' });
  } catch (e) {
    await chrome.storage.session.set({ confirmError: { message: e.message, at: Date.now() } });
    await chrome.action.setBadgeBackgroundColor({ color: '#c5221f' });
    await chrome.action.setBadgeText({ text: '!' });
  }
}
