// Carga CONFIG_* desde la planilla y la guarda en chrome.storage.session por unos minutos.

import { CONFIG_TABS, configRanges, parseConfig } from './config.js';
import { resolveSpreadsheet } from './planilla.js';

const CACHE_KEY = 'configCache';
const TTL_MS = 10 * 60 * 1000;

/** ID de la planilla de destino (ver lib/planilla.js para el orden de prioridad). */
export async function getSpreadsheetId(options) {
  return (await resolveSpreadsheet(options)).id;
}

/** @param {import('./sheets.js').SheetsClient} sheets */
export async function loadConfig(sheets, { force = false } = {}) {
  const { id: spreadsheetId, source } = await resolveSpreadsheet({ force });
  if (!spreadsheetId) {
    throw new Error('No hay planilla de destino configurada. El administrador debe definirla (releases/planilla.json).');
  }

  if (!force) {
    const { [CACHE_KEY]: cached } = await chrome.storage.session.get(CACHE_KEY);
    if (cached && cached.spreadsheetId === spreadsheetId && Date.now() - cached.at < TTL_MS) {
      try {
        return { spreadsheetId, source, config: parseConfig(cached.tabs) };
      } catch {
        // caché de una versión anterior de la extensión: volver a leer la planilla
      }
    }
  }

  const ranges = await sheets.batchGet(spreadsheetId, configRanges());
  const tabs = Object.fromEntries(CONFIG_TABS.map((name, i) => [name, ranges[i]]));
  const config = parseConfig(tabs); // valida antes de guardar en caché
  await chrome.storage.session.set({ [CACHE_KEY]: { spreadsheetId, at: Date.now(), tabs } });
  return { spreadsheetId, source, config };
}

export async function clearConfigCache() {
  await chrome.storage.session.remove(CACHE_KEY);
}
