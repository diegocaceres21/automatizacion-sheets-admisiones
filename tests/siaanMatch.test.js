import test from 'node:test';
import assert from 'node:assert/strict';
import { parseConfig } from '../extension/lib/config.js';
import { carreraFromSIAAN, destinoForPeriodo, normalizeText, periodoCode } from '../extension/lib/siaanMatch.js';
import { seedTabs } from './helpers.js';

const tabs = seedTabs();
const config = parseConfig(tabs);

test('código de periodo desde la vista de revisión y desde la lista de SIAAN', () => {
  assert.equal(periodoCode('[2026-CPRU-DIC] PERIODO DE CURSO PREUNIVERSITARIO UCB DICIEMBRE'), '2026-CPRU-DIC');
  assert.equal(periodoCode('[1-2027] SEMESTRE PRIMERO DEL 2027'), '1-2027');
  assert.equal(periodoCode('1-2027'), '1-2027');
  assert.equal(periodoCode(''), '');
});

test('cada periodo indicado preselecciona su destino', () => {
  const casos = {
    '[2026-CPRU-DIC] PERIODO DE CURSO PREUNIVERSITARIO UCB DICIEMBRE': 'GEN1',
    '[2027-CPRU-ENE] PERIODO DE CURSO PREUNIVERSITARIO UCB ENERO': 'GEN2',
    '[2026-CPS-NOV] PERIODO DE CURSO PREUNIVERSITARIO CIENCIAS DE LA SALUD NOVIEMBRE': 'MED1',
    '[2026-CPS-DIC] PERIODO DE CURSO PREUNIVERSITARIO CIENCIAS DE LA SALUD DICIEMBRE': 'MED2',
    '[2027-CPS-ENE] PERIODO DE CURSO PREUNIVERSITARIO CIENCIAS DE LA SALUD ENERO': 'MED3',
    '[1-2027] SEMESTRE PRIMERO DEL 2027': 'NUEVOS',
    '2026-cps-dic': 'MED2'
  };
  for (const [periodo, id] of Object.entries(casos)) assert.equal(destinoForPeriodo(config, periodo)?.id, id, periodo);
  assert.equal(destinoForPeriodo(config, '[2-2027] SEMESTRE SEGUNDO DEL 2027'), null);
});

test('solo NUEVOS CARRERAS toma la carrera de SIAAN', () => {
  assert.deepEqual(config.destinos.filter((d) => d.carreraDesdeSIAAN).map((d) => d.id), ['NUEVOS']);
});

test('carrera de SIAAN: sin tildes, sin sigla, alias y "SIN CARRERA"', () => {
  assert.equal(normalizeText('Ingeniería de Sistemas [SIS]'), 'INGENIERIA DE SISTEMAS');
  assert.equal(carreraFromSIAAN(config, 'carreras_nuevos', 'INGENIERÍA DE SISTEMAS [SIS]'), 'INGENIERIA DE SISTEMAS');
  assert.equal(carreraFromSIAAN(config, 'carreras_nuevos', 'DERECHO'), 'DERECHO');
  assert.equal(carreraFromSIAAN(config, 'carreras_nuevos', 'DISEÑO DIGITAL MULTIMEDIA [DDM]'), 'DISEÑO DIGITAL MULTIMEDIA');
  assert.equal(carreraFromSIAAN(config, 'carreras_nuevos', 'SIN CARRERA [SIN]'), null);
  assert.equal(carreraFromSIAAN(config, 'carreras_nuevos', 'LICENCIATURA EN DERECHO'), null);

  const conAlias = parseConfig({ ...tabs, CONFIG_CARRERAS_SIAAN: [['siaan', 'carrera'], ['Licenciatura en Derecho', 'DERECHO']] });
  assert.equal(carreraFromSIAAN(conAlias, 'carreras_nuevos', 'LICENCIATURA EN DERECHO [DER]'), 'DERECHO');
});

test('CONFIG_DESTINOS anterior sin columnas nuevas sigue funcionando', () => {
  const viejo = tabs.CONFIG_DESTINOS.map((r) => r.slice(0, 8));
  const c = parseConfig({ ...tabs, CONFIG_DESTINOS: viejo });
  assert.equal(destinoForPeriodo(c, '1-2027'), null);
  assert.equal(c.destinos[0].carreraDesdeSIAAN, false);
});
