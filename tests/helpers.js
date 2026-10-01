// Utilidades de prueba: ejecuta seedConfig.gs y legacy/codigo.gs en Node con dobles de Apps Script.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Corre seedConfig() contra una planilla falsa y devuelve las hojas CONFIG_* como filas de texto. */
export function seedTabs() {
  const sheets = {};
  const fakeRange = (name, row) => {
    const r = {
      setValues(values) {
        values.forEach((v, i) => { sheets[name][row - 1 + i] = v.map(String); });
        return r;
      },
      setFontWeight: () => r,
      setBackground: () => r,
      setNumberFormat: () => r,
      getDisplayValues: () => [[]]
    };
    return r;
  };
  const fakeSheet = (name) => ({
    getRange: (row) => fakeRange(name, row),
    setFrozenRows() {},
    autoResizeColumns() {},
    setTabColor() {}
  });
  const ss = {
    getSheetByName: (n) => (n in sheets ? fakeSheet(n) : null),
    insertSheet: (n) => { sheets[n] = []; return fakeSheet(n); }
  };
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, openById: () => ({ getSheetByName: () => null }) },
    Logger: { log() {} }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'apps-script/seedConfig.gs'), 'utf8'), ctx);
  ctx.seedConfig();
  return sheets;
}

/** Ejecuta legacy/codigo.gs con el estudiante dado y devuelve las filas que escribiría appendRow. */
export function legacyRows(student, call) {
  const rows = [];
  const ctx = {
    SpreadsheetApp: {
      getUi: () => ({}),
      getActiveSpreadsheet: () => ({ getSheetByName: (n) => ({ appendRow: (r) => rows.push({ hoja: n, fila: Array.from(r) }) }) }),
      openById: () => ({ getSheetByName: (n) => ({ appendRow: (r) => rows.push({ hoja: 'INCENTIVOS:' + n, fila: Array.from(r) }) }) })
    },
    PropertiesService: { getUserProperties: () => ({ getProperty: () => JSON.stringify(student) }) },
    Logger: { log() {} }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'legacy/codigo.gs'), 'utf8'), ctx);
  call(ctx);
  return rows;
}
