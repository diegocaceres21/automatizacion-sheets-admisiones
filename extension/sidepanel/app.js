// Panel lateral: estudiante (SIAAN o CI) -> destino -> formulario -> registro en Sheets.

import { clearConfigCache, loadConfig } from '../lib/configStore.js';
import { applyRules, asesorForEmail, fieldsFor, initialValues, isActive, promoOptions } from '../lib/form.js';
import { headerWarnings, precheck, registrar } from '../lib/registrar.js';
import { SheetsClient, chromeAuth } from '../lib/sheets.js';
import { studentsByCI } from '../lib/siaan.js';
import { carreraFromSIAAN, destinoForPeriodo, periodoCode } from '../lib/siaanMatch.js';
import { checkForUpdate } from '../lib/updates.js';

const sheets = new SheetsClient(chromeAuth);
const $ = (id) => document.getElementById(id);

const state = {
  config: null,
  spreadsheetId: '',
  loadError: null,
  remembered: {},
  email: '',            // cuenta de Chrome del asesor (identity.email)
  student: null,        // estudiante CONFIRMADO, registrable
  studentSource: null,  // 'confirmacion' | 'ci'
  preview: null,        // vista previa de "Revisar preinscripción" (no registrable)
  confirmError: null,
  searching: false,
  searchError: null,
  candidates: [],       // varias preinscripciones confirmadas para el mismo CI: el asesor elige una
  destinoId: null,
  check: { status: 'idle', duplicado: false, warnings: [], message: '' },
  values: {},
  busy: false,
  result: null,
  update: null          // { version, url, notas } si hay una versión nueva
};

// ---------- utilidades de DOM ----------

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}
const note = (cls, ...children) => h('div', { class: `note ${cls}` }, ...children);
const spinner = () => h('span', { class: 'spinner', 'aria-hidden': 'true' });

const destino = () => state.config?.destinos.find((d) => d.id === state.destinoId) || null;

/** Estudiante cuyo periodo y carrera de SIAAN guían la preselección: el confirmado o, si no hay, la vista previa. */
const siaanSource = () => state.student || state.preview;

/** Carrera de SIAAN reconocida en la lista del campo carrera del destino actual (o null). */
function carreraSIAANMatch() {
  const d = destino();
  const s = siaanSource();
  if (!state.config || !d?.carreraDesdeSIAAN || !s?.carreraSIAAN) return null;
  const field = fieldsFor(state.config, d.plantilla).find((f) => f.campo === 'carrera');
  return field ? carreraFromSIAAN(state.config, field.lista, s.carreraSIAAN) : null;
}

// Preselección automática una sola vez por estudiante: si el asesor cambia el destino a mano, se respeta.
let autoKey = null;
function autoApply() {
  const s = siaanSource();
  if (!state.config || !s) return;
  const key = `${s.idPreInscripcion || s.ci}|${s.periodo}|${s.carreraSIAAN}`;
  if (key === autoKey) return;
  autoKey = key;
  const d = destinoForPeriodo(state.config, s.periodo);
  if (d) state.destinoId = d.id;
  resetForm();
}

// ---------- carga ----------

async function loadAll(force = false) {
  state.loadError = null;
  try {
    const { spreadsheetId, config } = await loadConfig(sheets, { force });
    state.config = config;
    state.spreadsheetId = spreadsheetId;
    if (state.destinoId && !destino()?.activo) state.destinoId = null;
    if (state.destinoId) resetForm();
    autoKey = null;
    autoApply();
    checkForUpdate(config.general.versionUrl, chrome.runtime.getManifest().version).then((info) => {
      state.update = info;
      renderGlobal();
    });
  } catch (e) {
    state.config = null;
    state.loadError = e.message;
  }
  render();
  runCheck();
}

async function init() {
  const sync = await chrome.storage.sync.get('remembered');
  state.remembered = sync.remembered || {};
  state.destinoId = state.remembered.destinoId || null;
  try {
    state.email = (await chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' })).email || '';
  } catch {
    state.email = '';
  }

  const s = await chrome.storage.session.get(['pendingStudent', 'siaanPreview', 'confirmError']);
  applySession(s);
  chrome.action.setBadgeText({ text: '' });

  chrome.storage.session.onChanged.addListener((changes) => {
    const s2 = Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.newValue]));
    applySession(s2);
    autoApply();
    if ('pendingStudent' in changes && changes.pendingStudent.newValue) {
      chrome.action.setBadgeText({ text: '' });
      runCheck();
    }
    render();
  });

  await loadAll();
}

function applySession(s) {
  if ('pendingStudent' in s && s.pendingStudent) {
    state.student = s.pendingStudent.student;
    state.studentSource = s.pendingStudent.source;
    state.result = null;
    state.searchError = null;
  }
  if ('siaanPreview' in s) state.preview = s.siaanPreview?.data || null;
  if ('confirmError' in s) state.confirmError = s.confirmError?.message || null;
}

// ---------- acciones ----------

async function searchCI(ci) {
  ci = ci.trim();
  if (!ci || !state.config) return;
  state.searching = true;
  state.searchError = null;
  render();
  try {
    const found = await studentsByCI(ci, state.config.general);
    state.result = null;
    if (found.length === 1) pickCandidate(found[0]);
    else state.candidates = found;
  } catch (e) {
    state.searchError = e.message;
  }
  state.searching = false;
  render();
  runCheck();
}

function pickCandidate(s) {
  state.student = s;
  state.studentSource = 'ci';
  state.candidates = [];
  autoApply();
  render();
  runCheck();
}

async function clearStudent() {
  state.student = null;
  state.studentSource = null;
  state.candidates = [];
  autoKey = null;
  state.check = { status: 'idle', duplicado: false, warnings: [], message: '' };
  await chrome.storage.session.set({ pendingStudent: null, confirmError: null });
  render();
}

/** Asesor según el email de la cuenta de Chrome; si no está en CONFIG_ASESORES, el último usado. */
function autoAsesor() {
  return state.config ? asesorForEmail(state.config, state.email) : null;
}

function resetForm() {
  const d = destino();
  const remembered = { ...state.remembered, ...(autoAsesor() ? { asesor: autoAsesor() } : {}) };
  state.values = d ? initialValues(state.config, d.plantilla, { remembered }) : {};
  if (d?.carreraDesdeSIAAN && siaanSource()?.carreraSIAAN) {
    // Carrera reconocida: se usa. No reconocida (o SIN CARRERA): queda vacía para que el asesor la elija.
    state.values = applyRules(state.config, d.plantilla, { ...state.values, carrera: carreraSIAANMatch() || '' });
  }
}

async function selectDestino(id) {
  state.destinoId = id;
  state.result = null;
  resetForm();
  state.remembered = { ...state.remembered, destinoId: id };
  chrome.storage.sync.set({ remembered: state.remembered });
  render();
  runCheck();
}

let checkSeq = 0;
async function runCheck() {
  const d = destino();
  if (!state.config || !d || !state.student) {
    state.check = { status: 'idle', duplicado: false, warnings: [], message: '' };
    renderCheck(); renderFooter();
    return;
  }
  const seq = ++checkSeq;
  state.check = { status: 'checking', duplicado: false, warnings: [], message: '' };
  renderCheck(); renderFooter();
  try {
    const [{ duplicado }, warnings] = await Promise.all([
      precheck(sheets, state.spreadsheetId, state.config, d.id, state.student.ci),
      headerWarnings(sheets, state.spreadsheetId, state.config, d)
    ]);
    if (seq !== checkSeq) return;
    state.check = { status: 'done', duplicado, warnings, message: '' };
  } catch (e) {
    if (seq !== checkSeq) return;
    state.check = { status: 'error', duplicado: false, warnings: [], message: e.message };
  }
  renderCheck(); renderFooter();
}

async function submit() {
  const d = destino();
  if (!canSubmit().ok) return;
  state.busy = true;
  renderFooter();
  try {
    const res = await registrar(sheets, state.spreadsheetId, state.config, d.id, state.student, state.values);
    let gid = null;
    try { gid = await sheets.sheetGid(state.spreadsheetId, res.hoja); } catch { /* el enlace es opcional */ }
    state.result = { ok: true, ...res, nombre: state.student.nombre, gid };
    state.remembered = { ...state.remembered, asesor: state.values.asesor };
    await chrome.storage.sync.set({ remembered: state.remembered });
    await clearStudent();
    resetForm();
  } catch (e) {
    state.result = { ok: false, error: e.message };
    runCheck();
  }
  state.busy = false;
  render();
}

function canSubmit() {
  if (!state.config) return { ok: false, reason: 'Falta la configuración.' };
  if (!state.student) {
    return { ok: false, reason: state.preview ? 'Confirme la preinscripción en SIAAN para registrarla.' : 'Busque un estudiante o confírmelo en SIAAN.' };
  }
  if (!destino()) return { ok: false, reason: 'Elija un destino.' };
  const vacio = fieldsFor(state.config, destino().plantilla)
    .find((f) => f.tipo === 'select' && isActive(f, state.values) && state.values[f.campo] === '');
  if (vacio) return { ok: false, reason: `Elija: ${vacio.etiqueta}.` };
  if (state.check.status === 'checking') return { ok: false, reason: 'Revisando la planilla…' };
  if (state.check.status === 'error') return { ok: false, reason: 'No se pudo revisar la planilla.' };
  if (state.check.duplicado) return { ok: false, reason: 'El estudiante ya está registrado en este destino.' };
  if (state.busy) return { ok: false, reason: 'Registrando…' };
  return { ok: true, reason: '' };
}

// ---------- render ----------

function render() {
  renderGlobal();
  renderStudent();
  renderDestinos();
  renderForm();
  renderCheck();
  renderFooter();
}

function renderGlobal() {
  const out = [];
  if (state.loadError) {
    out.push(note('err', state.loadError, ' ',
      h('button', { class: 'link', type: 'button', onclick: () => chrome.runtime.openOptionsPage() }, 'Abrir opciones')));
  }
  if (state.confirmError) out.push(note('err', state.confirmError));
  if (state.update) {
    out.push(note('info', `Nueva versión ${state.update.version} disponible${state.update.notas ? `: ${state.update.notas}` : '.'} `,
      h('a', { href: state.update.url, target: '_blank' }, 'Descargar')));
  }
  $('global').replaceChildren(...out);
}

function studentCard(s, badge, badgeClass, onClose) {
  return h('div', { class: 'card' },
    h('span', { class: `badge ${badgeClass}` }, badge),
    h('div', { class: 'name' }, s.nombre || '(sin nombre)'),
    h('div', { class: 'meta' }, `CI ${s.ci || '—'} · Cel. ${s.celular || '—'}`),
    h('div', { class: 'meta' }, [s.colegio, s.departamentoColegio].filter(Boolean).join(' · ') || 'Sin colegio'),
    (s.periodo || s.carreraSIAAN) && h('div', { class: 'meta' },
      [s.periodo && `Periodo ${periodoCode(s.periodo)}`, s.carreraSIAAN].filter(Boolean).join(' · ')),
    onClose && h('button', { class: 'icon close', type: 'button', title: 'Quitar estudiante', 'aria-label': 'Quitar estudiante', onclick: onClose }, '×'));
}

function renderStudent() {
  const out = [];
  if (state.student) {
    const badge = state.studentSource === 'confirmacion' ? 'Confirmado en SIAAN' : 'Encontrado por CI · CONFIRMADO';
    out.push(studentCard(state.student, badge, 'ok', clearStudent));
  } else {
    if (state.preview) {
      out.push(studentCard(state.preview, 'Vista previa · pendiente de confirmar', 'warn'));
      out.push(note('info', 'Al presionar "Confirmar" en SIAAN, el estudiante quedará listo aquí para registrarlo.'));
    }
    if (state.candidates.length) {
      out.push(note('info', `Este carnet tiene ${state.candidates.length} preinscripciones confirmadas. Elija cuál registrar:`));
      out.push(h('div', { class: 'candidates' }, state.candidates.map((c) => {
        const d = destinoForPeriodo(state.config, c.periodo);
        return h('button', { class: 'candidate', type: 'button', onclick: () => pickCandidate(c) },
          h('strong', {}, `Periodo ${periodoCode(c.periodo) || '—'}`),
          h('span', {}, [c.carreraSIAAN, d && `→ ${d.grupo === d.etiqueta ? d.etiqueta : `${d.grupo} ${d.etiqueta}`}`].filter(Boolean).join(' ')));
      })));
    }
    const input = h('input', { type: 'search', inputmode: 'numeric', placeholder: 'Número de carnet', 'aria-label': 'Número de carnet' });
    const go = () => searchCI(input.value);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    out.push(h('div', { class: 'search' }, input,
      h('button', { class: 'secondary', type: 'button', disabled: state.searching || !state.config, onclick: go },
        state.searching ? [spinner(), 'Buscando'] : 'Buscar')));
    if (state.searchError) out.push(note('err', state.searchError));
  }
  $('student').replaceChildren(...out);
}

function renderDestinos() {
  if (!state.config) { $('destinos').replaceChildren(h('p', { class: 'empty' }, '—')); return; }
  const groups = new Map();
  for (const d of state.config.destinos.filter((x) => x.activo)) {
    if (!groups.has(d.grupo)) groups.set(d.grupo, []);
    groups.get(d.grupo).push(d);
  }
  $('destinos').replaceChildren(...[...groups].map(([grupo, ds]) => h('div', { class: 'group' },
    ds.length > 1 || ds[0].etiqueta !== grupo ? h('div', { class: 'group-label' }, grupo) : null,
    h('div', { class: 'chips' }, ds.map((d) => h('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(d.id === state.destinoId), onclick: () => selectDestino(d.id)
    }, d.etiqueta))))), periodoHint());
}

/** Explica la preselección por periodo, o avisa si el destino elegido no coincide con SIAAN. */
function periodoHint() {
  const s = siaanSource();
  if (!s?.periodo) return null;
  const code = periodoCode(s.periodo);
  const sugerido = destinoForPeriodo(state.config, s.periodo);
  if (!sugerido) return note('warn', `El periodo ${code} de SIAAN no está asignado a ningún destino (CONFIG_DESTINOS.periodoSIAAN). Elija el destino manualmente.`);
  if (sugerido.id === state.destinoId) return h('p', { class: 'hint' }, `Preseleccionado según el periodo ${code} de SIAAN.`);
  return note('warn', `SIAAN indica el periodo ${code}, que corresponde a "${sugerido.hoja}". Verifique el destino elegido.`);
}

function renderCheck() {
  const c = state.check;
  const out = [];
  if (c.status === 'checking') out.push(note('info', spinner(), 'Revisando duplicados en la planilla…'));
  if (c.status === 'error') out.push(note('err', c.message));
  if (c.status === 'done' && c.duplicado) out.push(note('err', `Este estudiante YA HA SIDO REGISTRADO en "${destino()?.hoja}".`));
  if (c.status === 'done' && c.warnings.length) {
    out.push(note('warn', 'Los encabezados de la hoja no coinciden con CONFIG_COLUMNAS. Revise antes de registrar:\n' + c.warnings.join('\n')));
  }
  $('check').replaceChildren(...out);
}

function fieldControl(f) {
  const id = `f-${f.campo}`;
  const value = state.values[f.campo] ?? '';
  const onChange = (e) => {
    state.values[f.campo] = e.target.value;
    const d = destino();
    renderFooter();
    const dependents = fieldsFor(state.config, d.plantilla).some((x) => x.condicion?.campo === f.campo);
    if (f.campo === 'carrera' || dependents) {
      state.values = applyRules(state.config, d.plantilla, state.values);
      renderForm();
    }
  };

  let control;
  if (f.tipo === 'select') {
    const opts = state.config.listas[f.lista] || [];
    control = h('select', { id, onchange: onChange },
      value === '' ? h('option', { value: '', selected: true, disabled: true }, '— Elija una opción —') : null,
      opts.map((o) => h('option', { value: o, selected: o === value }, o)),
      value && !opts.includes(value) ? h('option', { value, selected: true }, value) : null);
  } else if (f.tipo === 'promo') {
    const opts = promoOptions(state.config, state.values.carrera);
    if (!opts.length) return null;
    control = h('select', { id, onchange: onChange },
      h('option', { value: '', selected: !value }, 'NO INCLUIR'),
      opts.map((d) => h('option', { value: d.id, selected: d.id === value }, `${d.grupo} - ${d.etiqueta}`)));
  } else if (f.tipo === 'textarea') {
    control = h('textarea', { id, rows: 2, oninput: onChange }, value);
  } else {
    const type = { number: 'number', date: 'date' }[f.tipo] || 'text';
    control = h('input', { id, type, value, oninput: onChange });
  }
  const label = f.tipo === 'promo' ? (state.config.general.promoEtiqueta || f.etiqueta) : f.etiqueta;
  let hint = null;
  if (f.campo === 'asesor' && autoAsesor() && value === autoAsesor()) {
    hint = h('p', { class: 'hint' }, `Según su cuenta ${state.email}`);
  } else if (f.campo === 'carrera' && destino()?.carreraDesdeSIAAN && siaanSource()?.carreraSIAAN) {
    const siaan = siaanSource().carreraSIAAN;
    const match = carreraSIAANMatch();
    if (!match) hint = h('p', { class: 'hint warn' }, `SIAAN: "${siaan}" no se reconoce en la lista. Elija la carrera (o agréguela en CONFIG_CARRERAS_SIAAN).`);
    else if (match === value) hint = h('p', { class: 'hint' }, 'Según la preinscripción en SIAAN.');
    else hint = h('p', { class: 'hint warn' }, `SIAAN indica ${match}.`);
  }
  return h('div', { class: 'field' }, h('label', { for: id }, label), control, hint);
}

function renderForm() {
  const d = destino();
  if (!state.config || !d) {
    $('form').replaceChildren(h('p', { class: 'empty' }, 'Elija un destino para ver el formulario.'));
    return;
  }
  const fields = fieldsFor(state.config, d.plantilla).filter((f) => f.visibilidad !== 'oculto' && isActive(f, state.values));
  const visible = fields.filter((f) => f.visibilidad === 'visible').map(fieldControl).filter(Boolean);
  const advanced = fields.filter((f) => f.visibilidad === 'avanzado').map(fieldControl).filter(Boolean);
  const wasOpen = $('form').querySelector('details')?.open || false;
  $('form').replaceChildren(...visible,
    advanced.length ? h('details', { open: wasOpen }, h('summary', {}, `Más campos (${advanced.length})`), advanced) : null);
}

function renderFooter() {
  const { ok, reason } = canSubmit();
  const d = destino();
  $('submit').disabled = !ok;
  $('submit').replaceChildren(...(state.busy ? [spinner(), 'Registrando…'] : [d ? `Añadir a ${d.hoja}` : 'Añadir']));
  $('reason').textContent = ok ? '' : reason;

  const r = state.result;
  const out = [];
  if (r?.ok) {
    const url = `https://docs.google.com/spreadsheets/d/${state.spreadsheetId}/edit` + (r.gid !== null ? `#gid=${r.gid}&range=A${r.fila}` : '');
    out.push(note('ok', `${r.nombre} registrado en ${r.hoja}, fila ${r.fila}. `, h('a', { href: url, target: '_blank' }, 'Abrir en Sheets')));
    for (const s of r.secundarias.filter((x) => !x.ok)) {
      out.push(note('warn', `El registro principal se guardó, pero falló ${s.tipo === 'promo' ? 'la fila de promoción' : 'el registro en incentivos'}: ${s.error}`));
    }
  } else if (r && !r.ok) {
    out.push(note('err', r.error));
  }
  $('result').replaceChildren(...out);
}

// ---------- eventos ----------

$('submit').addEventListener('click', submit);
$('settings').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('reload').addEventListener('click', async () => {
  await clearConfigCache();
  loadAll(true);
});
$('form').addEventListener('submit', (e) => e.preventDefault());

init();
