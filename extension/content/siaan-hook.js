// Corre en el "MAIN world" de academico.ucb.edu.bo (document_start).
// Observa, sin modificarlas, las llamadas XHR de la página para saber:
//   - qué preinscripción está abierta (ObtenerPreInscripcionParaEditarV2?idPreInscripcion=...)
//   - cuándo el asesor la confirmó (POST ConfirmarPreInscripcionReducidaV2 con respuesta 200)
// y lo avisa al content script aislado (siaan.js) con window.postMessage.
(() => {
  const SOURCE = 'admisiones-ucb-hook';
  let currentId = null;

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
        currentId = new URL(url, location.href).searchParams.get('idPreInscripcion');
        window.postMessage({ source: SOURCE, type: 'review-open', idPreInscripcion: currentId }, location.origin);
      } catch { /* URL inesperada: ignorar */ }
    } else if (this.__admMethod === 'POST' && url.includes('/PreInscripcionResumida/ConfirmarPreInscripcionReducidaV2')) {
      const idAtSend = currentId;
      this.addEventListener('loadend', () => {
        if (this.status === 200 && idAtSend) {
          window.postMessage({ source: SOURCE, type: 'confirmed', idPreInscripcion: idAtSend }, location.origin);
        }
      });
    }
    return send.apply(this, args);
  };
})();
