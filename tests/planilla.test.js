import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseSpreadsheetId, isSpreadsheetId, parseSpreadsheetId, resolveSpreadsheet } from '../extension/lib/planilla.js';

const A = '1mmliqZtRkV09-hzNFYE4F0UdoWxfkwqiQoIvI0jOr2s';
const B = '1ACoimXDMXxxiJv7opfLTsSA2w4KauaDS7d4YN28KjwM';
const C = '1zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz';
const CENTRAL_URL = 'https://example.github.io/x/releases/planilla.json';

/** chrome.* y fetch simulados: defaults.json del ZIP y el archivo central. */
function setup({ sync = {}, local = {}, central, centralOk = true, bundled = { spreadsheetId: C, planillaUrl: CENTRAL_URL } } = {}) {
  const area = (store) => ({
    get: async (keys) => Object.fromEntries([].concat(keys).filter((k) => k in store).map((k) => [k, store[k]])),
    set: async (o) => { Object.assign(store, o); },
    remove: async (k) => { delete store[k]; }
  });
  const calls = [];
  globalThis.chrome = {
    runtime: { getURL: (p) => `chrome-extension://id/${p}` },
    storage: { sync: area(sync), local: area(local) }
  };
  globalThis.fetch = async (url) => {
    calls.push(url);
    if (url.endsWith('/defaults.json')) return { ok: !!bundled, json: async () => bundled };
    if (url === CENTRAL_URL) {
      if (!centralOk) throw new Error('offline');
      return { ok: true, json: async () => ({ spreadsheetId: central }) };
    }
    return { ok: false };
  };
  return { sync, local, calls };
}

test('reconoce IDs y enlaces de Google Sheets', () => {
  assert.equal(parseSpreadsheetId(`https://docs.google.com/spreadsheets/d/${A}/edit#gid=0`), A);
  assert.equal(parseSpreadsheetId(` ${A} `), A);
  assert.ok(isSpreadsheetId(A));
  assert.ok(!isSpreadsheetId('hola'));
});

test('prioridad: anulación > central > último central > ZIP', () => {
  assert.deepEqual(chooseSpreadsheetId({ override: A, central: B, bundled: C }), { id: A, source: 'override' });
  assert.deepEqual(chooseSpreadsheetId({ central: B, cachedCentral: A, bundled: C }), { id: B, source: 'central' });
  assert.deepEqual(chooseSpreadsheetId({ central: null, cachedCentral: A, bundled: C }), { id: A, source: 'central-cache' });
  assert.deepEqual(chooseSpreadsheetId({ bundled: C }), { id: C, source: 'zip' });
  assert.deepEqual(chooseSpreadsheetId({}), { id: '', source: 'none' });
});

test('usa el archivo central y lo guarda para cuando no haya conexión', async () => {
  const env = setup({ central: B });
  assert.deepEqual(await resolveSpreadsheet(), { id: B, source: 'central', centralUrl: CENTRAL_URL });
  assert.equal(env.local.planillaCentral.id, B);

  // Sin conexión (y caché vencida): último valor leído, no el del ZIP
  env.local.planillaCentral.at = 0;
  setup({ local: env.local, centralOk: false });
  assert.equal((await resolveSpreadsheet()).id, B);
  assert.equal((await resolveSpreadsheet()).source, 'central-cache');
});

test('el administrador cambia la planilla: se toma al vencer la caché o con force', async () => {
  const env = setup({ central: B });
  await resolveSpreadsheet();
  setup({ local: env.local, central: A });
  assert.equal((await resolveSpreadsheet()).id, B);               // dentro de los 10 minutos
  assert.equal((await resolveSpreadsheet({ force: true })).id, A); // antes de registrar se fuerza
});

test('ID guardado por el asesor en versiones anteriores se elimina; la anulación de pruebas se respeta', async () => {
  const env = setup({ sync: { spreadsheetId: C }, central: B });
  assert.equal((await resolveSpreadsheet()).id, B);
  assert.ok(!('spreadsheetId' in env.sync));

  setup({ sync: { spreadsheetOverride: A }, central: B });
  assert.deepEqual(await resolveSpreadsheet(), { id: A, source: 'override', centralUrl: CENTRAL_URL });
});

test('instalación sin archivo central (ZIP antiguo o desarrollo)', async () => {
  setup({ bundled: { spreadsheetId: C } });
  assert.deepEqual(await resolveSpreadsheet(), { id: C, source: 'zip', centralUrl: '' });
  setup({ bundled: null });
  assert.equal((await resolveSpreadsheet()).source, 'none');
});
