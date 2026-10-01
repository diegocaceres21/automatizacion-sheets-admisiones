import test from 'node:test';
import assert from 'node:assert/strict';
import { ConfigError, parseConfig } from '../extension/lib/config.js';
import { isoToDMY, todayISO } from '../extension/lib/dates.js';
import { applyRules, asesorForEmail, initialValues, promoOptions } from '../extension/lib/form.js';
import { seedTabs } from './helpers.js';

const tabs = seedTabs();
const config = parseConfig(tabs);

test('fecha de hoy en La Paz, también cerca de medianoche y a fin de mes', () => {
  // 02:00 UTC del 1 de febrero = 22:00 del 31 de enero en La Paz (UTC-4)
  assert.equal(todayISO('America/La_Paz', new Date('2026-02-01T02:00:00Z')), '2026-01-31');
  assert.equal(isoToDMY('2026-01-31'), '31/01/2026');
  assert.throws(() => isoToDMY('31/01/2026'));
});

test('valores iniciales iguales a los formularios antiguos', () => {
  const v = initialValues(config, 'NUEVOS', { now: new Date('2026-03-15T15:00:00Z') });
  assert.equal(v.fecha, '2026-03-15');
  assert.equal(v.asesor, 'ERIKA CASTRO');
  assert.equal(v.anioPromocion, '2026');
  assert.equal(v.carrera, 'MEDICINA');
  assert.equal(v.plan, 'ESTANDAR');
  assert.equal(v.carnet, 'ENTREGADO');
  assert.equal(v.estadoIncentivo, 'NO CORRESPONDE');
  assert.equal(v.grupoPreUCB, '');
  // MEDICINA no lleva tests de matemáticas/física/química
  assert.deepEqual([v.matematicas, v.fisica, v.quimica], ['NO CORRESPONDE', 'NO CORRESPONDE', 'NO CORRESPONDE']);
});

test('asesor recordado solo si sigue en la lista', () => {
  assert.equal(initialValues(config, 'PRE_MED', { remembered: { asesor: 'DIEGO CACERES' } }).asesor, 'DIEGO CACERES');
  assert.equal(initialValues(config, 'PRE_MED', { remembered: { asesor: 'YA NO TRABAJA' } }).asesor, 'ERIKA CASTRO');
});

test('reglas de tests según carrera', () => {
  const v = applyRules(config, 'NUEVOS', { carrera: 'INGENIERIA QUIMICA' });
  assert.deepEqual([v.matematicas, v.fisica, v.quimica], ['PENDIENTE', 'PENDIENTE', 'PENDIENTE']);
  const w = applyRules(config, 'NUEVOS', { carrera: 'INGENIERIA CIVIL' });
  assert.deepEqual([w.matematicas, w.fisica, w.quimica], ['PENDIENTE', 'PENDIENTE', 'NO CORRESPONDE']);
});

test('opciones de promoción por carrera', () => {
  assert.deepEqual(promoOptions(config, 'MEDICINA'), []);
  assert.deepEqual(promoOptions(config, 'ODONTOLOGIA').map((d) => d.id), ['MED1', 'MED2', 'MED3']);
  assert.deepEqual(promoOptions(config, 'DERECHO').map((d) => d.id), ['GEN1', 'GEN2']);
});

test('cambiar a una carrera sin esa promoción limpia la opción elegida', () => {
  const v = applyRules(config, 'NUEVOS', { carrera: 'MEDICINA', grupoPreUCB: 'GEN1' });
  assert.equal(v.grupoPreUCB, '');
});

test('versión de CONFIG incompatible se rechaza', () => {
  const bad = { ...tabs, CONFIG_GENERAL: tabs.CONFIG_GENERAL.map((r) => (r[0] === 'configVersion' ? ['configVersion', '99', ''] : r)) };
  assert.throws(() => parseConfig(bad), ConfigError);
});

test('lista inexistente en CONFIG_CAMPOS se rechaza', () => {
  const bad = { ...tabs, CONFIG_CAMPOS: tabs.CONFIG_CAMPOS.map((r) => (r[1] === 'asesor' ? [...r.slice(0, 4), 'no_existe', ...r.slice(5)] : r)) };
  assert.throws(() => parseConfig(bad), /no_existe/);
});

test('asesor según el email de la cuenta de Chrome', () => {
  const rows = tabs.CONFIG_ASESORES.map((r) => (r[0] === 'DIEGO CACERES' ? ['DIEGO CACERES', 'Diego.Caceres@ucb.edu.bo'] : r));
  rows.push(['NO ESTA EN LA LISTA', 'otro@ucb.edu.bo']);
  const c = parseConfig({ ...tabs, CONFIG_ASESORES: rows });
  assert.equal(asesorForEmail(c, 'diego.caceres@UCB.edu.bo'), 'DIEGO CACERES');
  assert.equal(asesorForEmail(c, 'otro@ucb.edu.bo'), null); // nombre fuera de CONFIG_LISTAS.asesores
  assert.equal(asesorForEmail(c, ''), null);
  assert.equal(asesorForEmail(config, 'diego.caceres@ucb.edu.bo'), null); // seed sin emails
});

test('falta CONFIG_ASESORES pide ejecutar seedConfig()', () => {
  const { CONFIG_ASESORES, ...old } = tabs;
  assert.throws(() => parseConfig(old), /CONFIG_ASESORES.*seedConfig/);
});

test('comparación de versiones para el aviso de actualización', async () => {
  const { compareVersions } = await import('../extension/lib/updates.js');
  assert.equal(compareVersions('0.2.0', '0.1.9'), 1);
  assert.equal(compareVersions('0.10.0', '0.9.0'), 1);
  assert.equal(compareVersions('1.0', '1.0.0'), 0);
  assert.equal(compareVersions('0.1.0', '0.1.1'), -1);
});
