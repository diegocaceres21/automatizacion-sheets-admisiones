// Aviso de versión nueva. La extensión se instala "sin empaquetar", así que Chrome no la actualiza solo:
// el panel compara su versión con version.json (CONFIG_GENERAL.versionUrl, publicado en GitHub Pages).
// version.json: { "version": "0.2.0", "url": "https://.../admisiones-ucb-0.2.0.zip", "notas": "..." }

const CACHE_KEY = 'updateCheck';
const TTL_MS = 6 * 60 * 60 * 1000;

/** -1, 0 o 1 comparando versiones "a.b.c". */
export function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

/** Datos de la versión nueva, o null si está al día, no hay URL o no se pudo consultar. */
export async function checkForUpdate(versionUrl, currentVersion, fetchImpl = fetch.bind(globalThis)) {
  if (!versionUrl) return null;
  let info;
  const { [CACHE_KEY]: cached } = await chrome.storage.session.get(CACHE_KEY);
  if (cached && cached.versionUrl === versionUrl && Date.now() - cached.at < TTL_MS) {
    info = cached.info;
  } else {
    try {
      const res = await fetchImpl(versionUrl, { cache: 'no-store' });
      if (!res.ok) return null;
      info = await res.json();
      await chrome.storage.session.set({ [CACHE_KEY]: { versionUrl, at: Date.now(), info } });
    } catch {
      return null; // sin conexión o URL mal escrita: no molestar al asesor
    }
  }
  return info?.version && compareVersions(info.version, currentVersion) > 0 ? info : null;
}
