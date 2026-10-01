import test from 'node:test';
import assert from 'node:assert/strict';
import { SheetsClient, columnLetter } from '../extension/lib/sheets.js';

/** Planilla en memoria que responde como la API de Sheets (solo lo que usa el cliente). */
function fakeSheets(initial = {}, { onWrite } = {}) {
  const data = structuredClone(initial); // hoja -> filas
  const calls = [];
  const parse = (range) => {
    const m = /^'(.+)'!([A-Z]+)(\d*)(?::([A-Z]+)(\d*))?$/.exec(range);
    return { hoja: m[1].replace(/''/g, "'"), c1: m[2], r1: Number(m[3] || 1), c2: m[4] || m[2], r2: m[5] ? Number(m[5]) : Infinity };
  };
  const col = (l) => [...l].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
  const read = (range) => {
    const { hoja, c1, r1, c2, r2 } = parse(range);
    const rows = (data[hoja] || []).slice(r1 - 1, r2 === Infinity ? undefined : r2)
      .map((r) => (r || []).slice(col(c1) - 1, col(c2)));
    while (rows.length && !rows.at(-1).some((x) => x !== '' && x !== undefined)) rows.pop();
    return rows;
  };
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET', auth: init.headers.Authorization });
    const u = new URL(url);
    if (init.method === 'PUT') {
      const body = JSON.parse(init.body);
      const { hoja, r1 } = parse(body.range);
      (data[hoja] ||= [])[r1 - 1] = body.values[0];
      onWrite?.(data, hoja, r1);
      return { ok: true, status: 200, json: async () => ({}) };
    }
    const ranges = u.searchParams.getAll('ranges');
    return { ok: true, status: 200, json: async () => ({ valueRanges: ranges.map((r) => ({ values: read(r) })) }) };
  };
  return { data, calls, fetchImpl };
}

const auth = { getToken: async () => 'tok', dropToken: async () => {} };

test('columnLetter', () => {
  assert.deepEqual([1, 26, 27, 51, 52].map(columnLetter), ['A', 'Z', 'AA', 'AY', 'AZ']);
});

test('appendRow escribe después de la última fila con nombre en la columna A', async () => {
  const f = fakeSheets({ H: [['ENC1'], ['ENC2'], ['ANA'], ['LUIS', '', 'x']] });
  const row = await new SheetsClient(auth, f.fetchImpl).appendRow('id', 'H', ['NUEVO', 'b', 'c'], { filasEncabezado: 2 });
  assert.equal(row, 5);
  assert.deepEqual(f.data.H[4], ['NUEVO', 'b', 'c']);
});

test('appendRow en hoja vacía escribe debajo del encabezado', async () => {
  const f = fakeSheets({ H: [['GRUPO'], ['NOMBRE']] });
  assert.equal(await new SheetsClient(auth, f.fetchImpl).appendRow('id', 'H', ['X'], { filasEncabezado: 2 }), 3);
});

test('appendRow reintenta si otro asesor escribió la misma fila al mismo tiempo', async () => {
  let pisado = false;
  const f = fakeSheets({ H: [['NOMBRE'], ['ANA']] }, {
    onWrite(data, hoja, r) {
      if (!pisado) { pisado = true; data[hoja][r - 1] = ['OTRO ASESOR']; } // la otra escritura gana la fila 3
    }
  });
  const row = await new SheetsClient(auth, f.fetchImpl).appendRow('id', 'H', ['MIO']);
  assert.equal(row, 4);
  assert.deepEqual(f.data.H.map((r) => r[0]), ['NOMBRE', 'ANA', 'OTRO ASESOR', 'MIO']);
});

test('ciExists ignora el encabezado, espacios y números sin formato', async () => {
  const f = fakeSheets({ H: [['', 'CÉDULA DE IDENTIDAD'], ['', '1234567'], ['', 7654321], ['', ' 99 88 ']] });
  const s = new SheetsClient(auth, f.fetchImpl);
  assert.equal(await s.ciExists('id', 'H', 'B', 1, '7654321'), true);
  assert.equal(await s.ciExists('id', 'H', 'B', 1, '9988'), true);
  assert.equal(await s.ciExists('id', 'H', 'B', 1, 'CÉDULA DE IDENTIDAD'), false);
  assert.equal(await s.ciExists('id', 'H', 'B', 1, '111'), false);
});

test('401 renueva el token una vez', async () => {
  const dropped = [];
  let n = 0;
  const auth2 = { getToken: async () => `tok${++n}`, dropToken: async (t) => { dropped.push(t); } };
  const fetchImpl = async (url, init) => (init.headers.Authorization === 'Bearer tok1'
    ? { ok: false, status: 401, json: async () => ({}) }
    : { ok: true, status: 200, json: async () => ({ valueRanges: [{ values: [['ok']] }] }) });
  assert.deepEqual(await new SheetsClient(auth2, fetchImpl).get('id', "'H'!A1"), [['ok']]);
  assert.deepEqual(dropped, ['tok1']);
});

test('403 da un mensaje claro de permisos', async () => {
  const fetchImpl = async () => ({ ok: false, status: 403, json: async () => ({ error: { message: 'denied' } }) });
  await assert.rejects(new SheetsClient(auth, fetchImpl).get('id', "'H'!A1"), /permiso de edición/);
});
