// Carga CONFIG_* desde la planilla y la guarda en chrome.storage.session por unos minutos.

import { CONFIG_TABS, configRanges, parseConfig } from './config.js';

const CACHE_KEY = 'configCache';
const TTL_MS = 10 * 60 * 1000;

/** ID guardado en Opciones; si no hay, el de defaults.json (incluido en el ZIP de distribución). */
export async function getSpreadsheetId() {
  const { spreadsheetId } = await chrome.storage.sync.get('spreadsheetId');
  if (spreadsheetId) return spreadsheetId;
  try {
    const res = await fetch(chrome.runtime.getURL('defaults.json'));
    return res.ok ? (await res.json()).spreadsheetId || '' : '';
  } catch {
    return ''; // instalación de desarrollo sin defaults.json
  }
}

/** @param {import('./sheets.js').SheetsClient} sheets */
export async function loadConfig(sheets, { force = false } = {}) {
  const spreadsheetId = await getSpreadsheetId();
  if (!spreadsheetId) throw new Error('Configure el ID de la planilla en las opciones de la extensión.');

  if (!force) {
    const { [CACHE_KEY]: cached } = await chrome.storage.session.get(CACHE_KEY);
    if (cached && cached.spreadsheetId === spreadsheetId && Date.now() - cached.at < TTL_MS) {
      try {
        return { spreadsheetId, config: parseConfig(cached.tabs) };
      } catch {
        // caché de una versión anterior de la extensión: volver a leer la planilla
      }
    }
  }

  const ranges = await sheets.batchGet(spreadsheetId, configRanges());
  const tabs = Object.fromEntries(CONFIG_TABS.map((name, i) => [name, ranges[i]]));
  const config = parseConfig(tabs); // valida antes de guardar en caché
  await chrome.storage.session.set({ [CACHE_KEY]: { spreadsheetId, at: Date.now(), tabs } });
  return { spreadsheetId, config };
}

export async function clearConfigCache() {
  await chrome.storage.session.remove(CACHE_KEY);
}
