// ¿A qué planilla escribe la extensión? La define el administrador para todos en un archivo central
// (releases/planilla.json en GitHub Pages: { "spreadsheetId": "..." }). Orden:
//   1. Anulación de este equipo (Opciones > "Usar otra planilla", solo para pruebas)
//   2. Archivo central (se relee cada 10 minutos; si no responde, se usa el último valor leído)
//   3. El ID incluido en el ZIP (defaults.json)

const TTL_MS = 10 * 60 * 1000;

export const SOURCES = {
  override: 'anulación de este equipo (pruebas)',
  central: 'definida por el administrador',
  'central-cache': 'definida por el administrador (último valor leído)',
  zip: 'incluida en la instalación',
  none: 'sin configurar'
};

export function isSpreadsheetId(text) {
  return /^[a-zA-Z0-9_-]{25,}$/.test(String(text ?? ''));
}

/** Acepta el ID o el enlace completo de la planilla. */
export function parseSpreadsheetId(text) {
  const m = /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/.exec(String(text ?? ''));
  return (m ? m[1] : String(text ?? '')).trim();
}

/** Decide qué ID usar (sin efectos, para pruebas). */
export function chooseSpreadsheetId({ override, central, cachedCentral, bundled }) {
  if (isSpreadsheetId(override)) return { id: override, source: 'override' };
  if (isSpreadsheetId(central)) return { id: central, source: 'central' };
  if (isSpreadsheetId(cachedCentral)) return { id: cachedCentral, source: 'central-cache' };
  if (isSpreadsheetId(bundled)) return { id: bundled, source: 'zip' };
  return { id: '', source: 'none' };
}

/** defaults.json del ZIP: { spreadsheetId, planillaUrl }. No existe en instalaciones de desarrollo. */
async function readDefaults() {
  try {
    const res = await fetch(chrome.runtime.getURL('defaults.json'), { cache: 'no-store' });
    return res.ok ? await res.json() : {};
  } catch {
    return {};
  }
}

/** Lee el archivo central (con caché en chrome.storage.local). Devuelve { central, cachedCentral, url }. */
async function readCentral(url, force) {
  if (!url) return { central: null, cachedCentral: null, url: '' };
  const { planillaCentral: cached } = await chrome.storage.local.get('planillaCentral');
  const sameUrl = cached?.url === url;
  if (!force && sameUrl && Date.now() - cached.at < TTL_MS) {
    return { central: cached.id, cachedCentral: cached.id, url };
  }
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const id = parseSpreadsheetId((await res.json()).spreadsheetId);
      if (isSpreadsheetId(id)) {
        await chrome.storage.local.set({ planillaCentral: { id, url, at: Date.now() } });
        return { central: id, cachedCentral: id, url };
      }
    }
  } catch {
    // sin conexión: usar el último valor leído
  }
  return { central: null, cachedCentral: sameUrl ? cached.id : null, url };
}

/** @returns {Promise<{ id: string, source: keyof SOURCES, centralUrl: string }>} */
export async function resolveSpreadsheet({ force = false } = {}) {
  const sync = await chrome.storage.sync.get(['spreadsheetOverride', 'spreadsheetId']);
  // Migración: hasta la 0.3 cada asesor guardaba el ID en Opciones; ahora lo define el administrador.
  if (sync.spreadsheetId !== undefined) await chrome.storage.sync.remove('spreadsheetId');

  const defaults = await readDefaults();
  const { central, cachedCentral, url } = await readCentral(defaults.planillaUrl, force);
  const choice = chooseSpreadsheetId({ override: sync.spreadsheetOverride, central, cachedCentral, bundled: defaults.spreadsheetId });
  return { ...choice, centralUrl: url };
}

export async function setOverride(id) {
  if (id) await chrome.storage.sync.set({ spreadsheetOverride: id });
  else await chrome.storage.sync.remove('spreadsheetOverride');
}
