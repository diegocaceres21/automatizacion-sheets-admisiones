// Mensajes de error legibles. Algunas APIs rechazan con valores que no son Error (null, strings,
// objetos de chrome.runtime.lastError); mostrarlos tal cual producía avisos como "null".

/** Texto para mostrar al asesor. Nunca devuelve vacío, "null" ni "undefined". */
export function errorText(e, fallback = 'Ocurrió un error inesperado.') {
  let text = '';
  if (typeof e === 'string') text = e;
  else if (e && typeof e.message === 'string') text = e.message;
  else if (e && typeof e === 'object') {
    try { text = JSON.stringify(e); } catch { text = ''; }
  }
  text = text.trim();
  if (!text || text === 'null' || text === 'undefined' || text === '{}') {
    const name = e && typeof e === 'object' && e.name ? ` (${e.name})` : '';
    return `${fallback}${name} Revise la consola de la extensión para más detalles.`;
  }
  return text;
}

/** Registra el error completo en la consola (para diagnóstico) y devuelve el texto para el asesor. */
export function reportError(context, e, fallback) {
  console.error(`[Admisiones UCB] ${context}:`, e);
  return errorText(e, fallback);
}
