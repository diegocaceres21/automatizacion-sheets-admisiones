import test from 'node:test';
import assert from 'node:assert/strict';
import { departamentoFromPath, findConfirmedId, getStudent, normalizeName } from '../extension/lib/siaan.js';

const session = { token: 't', uniqueCode: 'u' };
const general = { siaanIdRegional: 'R', siaanIdEstadoConfirmado: 'C' };

// Fila con la forma real de ObtenerListaPreinscripcionesReducidas (ver docs/phase0-findings.md)
const row = (ci, estado, id) => [
  ['Periodo Académico', '1-2027'], ['Carrera', 'DERECHO'], ['Apellidos y Nombres', 'X'], ['Tipo de documento', 'CI'],
  ['Documento de identidad', ci], ['Fecha de Preinscripción', ' 01/10/2026'], ['Estado de Preinscripción', estado]
].map(([nombreColumna, contenido]) => ({ nombreColumna, contenidoCelda: [{ contenido, parametros: [] }] }))
  .concat([{ nombreColumna: 'Acciones', contenidoCelda: [{ contenido: '', parametros: id ? [{ nombreParametro: 'idPreInscripcion', valorParametro: id }] : [] }] }]);

function withFetch(handler, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return fn().finally(() => { globalThis.fetch = original; });
}
const json = (status, body) => ({ ok: status < 300, status, json: async () => body });

test('normaliza nombre y departamento', () => {
  assert.equal(normalizeName('PEREZ', '', ' LOPEZ  ', 'JUAN  CARLOS'), 'PEREZ LOPEZ JUAN CARLOS');
  assert.equal(departamentoFromPath('COCHABAMBA > PROVINCIA: CERCADO > ZONA: NOR OESTE'), 'COCHABAMBA');
});

test('findConfirmedId envía headers y filtro CONFIRMADO, y elige la fila del CI exacto', () =>
  withFetch(async (url, init) => {
    const u = new URL(url);
    assert.equal(u.searchParams.get('idEstadoPreinscripcion'), 'C');
    assert.equal(u.searchParams.get('apellidosNombresCi'), '123');
    assert.deepEqual(init.headers, { Token: 't', Uniquecode: 'u' });
    return json(200, { datos: [row('1234', 'CONFIRMADO', 'otro'), row('123', 'CONFIRMADO', 'mio')] });
  }, async () => {
    assert.equal(await findConfirmedId(session, '123', general), 'mio');
  }));

test('404 "No se encontraron datos" significa sin resultados', () =>
  withFetch(async () => json(404, { mensajes: [{ descripcion: 'No se encontraron datos.' }] }), async () => {
    assert.equal(await findConfirmedId(session, '123', general), null);
  }));

test('401 pide volver a iniciar sesión en SIAAN', () =>
  withFetch(async () => json(401, {}), async () => {
    await assert.rejects(findConfirmedId(session, '123', general), (e) => e.code === 'sin-sesion');
  }));

test('getStudent arma el estudiante como lo hacía codigo.gs', () =>
  withFetch(async () => json(200, {
    datos: { preInscripcion: {
      datosPersonales: { apellidosNombres: 'PEREZ  LOPEZ JUAN', documentoIdentidad: '123', celulares: '777' },
      datosColegio: { colegio: 'COL X', departamento: 'COCHABAMBA' }
    } }
  }), async () => {
    assert.deepEqual(await getStudent(session, 'id1'), {
      idPreInscripcion: 'id1', nombre: 'PEREZ LOPEZ JUAN', ci: '123', celular: '777', colegio: 'COL X', departamentoColegio: 'COCHABAMBA',
      periodo: '', carreraSIAAN: ''
    });
  }));

test('findConfirmed devuelve todas las preinscripciones confirmadas del CI con periodo y carrera', async () => {
  const { findConfirmed } = await import('../extension/lib/siaan.js');
  const withPeriodo = (ci, id, periodo, carrera) => row(ci, 'CONFIRMADO', id).map((c) =>
    c.nombreColumna === 'Periodo Académico' ? { ...c, contenidoCelda: [{ contenido: periodo }] }
      : c.nombreColumna === 'Carrera' ? { ...c, contenidoCelda: [{ contenido: carrera }] } : c);
  await withFetch(async () => json(200, { datos: [
    withPeriodo('123', 'pre', '2026-CPRU-DIC', 'SIN CARRERA'),
    withPeriodo('123', 'car', '1-2027', 'DERECHO'),
    withPeriodo('999', 'otro', '1-2027', 'DERECHO')
  ] }), async () => {
    assert.deepEqual(await findConfirmed(session, '123', general), [
      { idPreInscripcion: 'pre', periodo: '2026-CPRU-DIC', carreraSIAAN: 'SIN CARRERA' },
      { idPreInscripcion: 'car', periodo: '1-2027', carreraSIAAN: 'DERECHO' }
    ]);
  });
});
