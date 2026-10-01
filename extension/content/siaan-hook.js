// Corre en el "MAIN world" de academico.ucb.edu.bo (document_start, o inyectado por background.js en
// pestañas que ya estaban abiertas al instalar/actualizar la extensión).
// Observa, sin modificarlas, las llamadas XHR de la página para saber:
//   - qué preinscripción está abierta (ObtenerPreInscripcionParaEditarV2?idPreInscripcion=...)
//   - cuándo el asesor la confirmó (POST ConfirmarPreInscripcionReducidaV2 con respuesta 200)
// y lo avisa al content script aislado (siaan.js) con window.postMessage.
(() => {
  // La pestaña puede recibir este script dos veces (manifest + inyección): instalar el gancho una sola vez.
  if (window.__admisionesUcbHook) return;
  window.__admisionesUcbHook = true;

  const SOURCE = 'admisiones-ucb-hook';
  let currentId = null;

  /** Busca un idPreInscripcion en el cuerpo JSON del POST de confirmación (por si el gancho llegó tarde). */
  function idFromBody(body) {
    try {
      const find = (o) => {
        if (!o || typeof o !== 'object') return null;
        for (const [k, v] of Object.entries(o)) {
          if (/^idPreInscripcion$/i.test(k) && typeof v === 'string' && v) return v;
          const inner = find(v);
          if (inner) return inner;
        }
        return null;
      };
      return find(typeof body === 'string' ? JSON.parse(body) : null);
    } catch {
      return null;
    }
  }

  const open = XMLHttpRequest.prototype.open;
  const send = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__admUrl = String(url);
    this.__admMethod = String(method).toUpperCase();
    return open.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    const url = this.__admUrl || '';
    if (url.includes('/PreInscripcionResumida/ObtenerPreInscripcionParaEditarV2')) {
      try {
        const params = new URL(url, location.href).searchParams;
        currentId = params.get('idPreInscripcion') || params.get('idPreinscripcion');
        window.postMessage({ source: SOURCE, type: 'review-open', idPreInscripcion: currentId }, location.origin);
      } catch { /* URL inesperada: ignorar */ }
    } else if (this.__admMethod === 'POST' && url.includes('/PreInscripcionResumida/ConfirmarPreInscripcionReducidaV2')) {
      const id = idFromBody(args[0]) || currentId;
      this.addEventListener('loadend', () => {
        // Sin id también se avisa: el background lo busca por el CI de la vista abierta.
        if (this.status === 200) window.postMessage({ source: SOURCE, type: 'confirmed', idPreInscripcion: id || null }, location.origin);
      });
    }
    return send.apply(this, args);
  };
})();
