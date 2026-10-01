// La extensión debe escribir exactamente las mismas filas que legacy/codigo.gs,
// usando la configuración que genera seedConfig.gs.

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseConfig } from '../extension/lib/config.js';
import { initialValues } from '../extension/lib/form.js';
import { planWrites } from '../extension/lib/rowBuilder.js';
import { legacyRows, seedTabs } from './helpers.js';

const config = parseConfig(seedTabs());

const legacyStudent = {
  datosPersonales: { apellidosNombres: 'PEREZ  LOPEZ   JUAN', documentoIdentidad: '1234567', celulares: '77712345' },
  datosColegio: { colegio: 'COLEGIO X', departamento: 'COCHABAMBA' }
};
const student = { nombre: 'PEREZ LOPEZ JUAN', ci: '1234567', celular: '77712345', colegio: 'COLEGIO X', departamentoColegio: 'COCHABAMBA' };

// Valores distintos por campo para detectar columnas cruzadas.
// universidad: en el formulario antiguo queda vacía salvo en TRASPASO (input oculto), por eso se fija en ''. fecha va en ISO (input date) y legacy en DD/MM/YYYY.
function formValues(plantilla, overrides = {}) {
  const v = initialValues(config, plantilla, { now: new Date('2026-03-15T15:00:00Z') });
  for (const k of Object.keys(v)) {
    if (!['carrera', 'grupoPreUCB', 'fecha', 'incentivo', 'tipoEstudiante'].includes(k)) v[k] = `v_${k}`;
  }
  return { ...v, ...overrides };
}
const legacyData = (v) => ({ ...v, fecha: v.fecha.split('-').reverse().join('/') });

const carreras = ['ODONTOLOGIA', 'DERECHO', 'INGENIERIA CIVIL', 'INGENIERIA QUIMICA', 'ADMINISTRACION DE EMPRESAS'];

for (const [destino, hoja, fn, plantilla] of [
  ['MED1', 'PRE UCB MED 1', 'getDataFromUIMedicinaPre', 'PRE_MED'],
  ['MED3', 'PRE UCB MED 3', 'getDataFromUIMedicinaPre', 'PRE_MED'],
  ['GEN1', 'PRE UCB GENERAL', 'getDataFromUIPreGeneral', 'PRE_GENERAL'],
  ['GEN2', 'PRE UCB GENERAL 2', 'getDataFromUIPreGeneral', 'PRE_GENERAL']
]) {
  test(`${destino}: misma fila que codigo.gs`, () => {
    for (const carrera of carreras) {
      const v = formValues(plantilla, { carrera });
      const expected = legacyRows(legacyStudent, (ctx) => ctx[fn](legacyData(v), hoja));
      const writes = planWrites(config, destino, student, v);
      assert.equal(writes.length, 1);
      assert.equal(writes[0].hoja, hoja);
      assert.deepEqual(writes[0].fila, expected[0].fila, carrera);
    }
  });
}

test('NUEVOS: fila principal, incentivos y promoción iguales a codigo.gs', () => {
  const promoSheets = { MED1: 'PRE UCB MED 1', MED2: 'PRE UCB MED 2', GEN1: 'PRE UCB GENERAL', GEN2: 'PRE UCB GENERAL 2' };
  for (const carrera of carreras) {
    for (const [promoId, promoHoja] of Object.entries(promoSheets)) {
      const v = formValues('NUEVOS', { carrera, incentivo: 'APOYO FAMILIAR', tipoEstudiante: 'NUEVO', universidad: '', grupoPreUCB: promoId });
      const expected = legacyRows(legacyStudent, (ctx) => ctx.getDataFromUINuevosCarreras({ ...legacyData(v), grupoPreUCB: promoHoja }));
      const writes = planWrites(config, 'NUEVOS', student, v);

      assert.deepEqual(writes.map((w) => w.tipo), ['principal', 'incentivos', 'promo']);
      assert.deepEqual(writes[0].fila, expected[0].fila, `${carrera} principal`);
      assert.equal(writes[1].hoja, 'Hoja 1');
      assert.equal(writes[1].spreadsheetId, '1ACoimXDMXxxiJv7opfLTsSA2w4KauaDS7d4YN28KjwM');
      assert.deepEqual(writes[1].fila, expected[1].fila, `${carrera} incentivos`);
      assert.equal(writes[2].hoja, promoHoja);
      assert.deepEqual(writes[2].fila, expected[2].fila, `${carrera} promo ${promoId}`);
    }
  }
});

test('NUEVOS sin incentivo ni promoción escribe solo la fila principal', () => {
  const v = formValues('NUEVOS', { carrera: 'DERECHO', incentivo: 'NO APLICA', grupoPreUCB: '' });
  assert.deepEqual(planWrites(config, 'NUEVOS', student, v).map((w) => w.tipo), ['principal']);
});

test('promoción apagada en CONFIG no escribe fila de promoción', () => {
  const off = { ...config, general: { ...config.general, promoActiva: false } };
  const v = formValues('NUEVOS', { carrera: 'DERECHO', incentivo: 'NO APLICA', grupoPreUCB: 'GEN1' });
  assert.deepEqual(planWrites(off, 'NUEVOS', student, v).map((w) => w.tipo), ['principal']);
});

test('universidad se envía vacía salvo en TRASPASO', () => {
  const col = config.columnas.NUEVOS.findIndex((c) => c.valor === 'universidad');
  const base = { carrera: 'DERECHO', incentivo: 'NO APLICA', universidad: 'UMSS' };
  const nuevo = planWrites(config, 'NUEVOS', student, formValues('NUEVOS', { ...base, tipoEstudiante: 'NUEVO' }));
  const traspaso = planWrites(config, 'NUEVOS', student, formValues('NUEVOS', { ...base, tipoEstudiante: 'TRASPASO' }));
  assert.equal(nuevo[0].fila[col], '');
  assert.equal(traspaso[0].fila[col], 'UMSS');
});
