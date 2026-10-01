// Content script aislado en academico.ucb.edu.bo.
// 1. Mientras está abierta "Revisar preinscripción", envía una vista previa del estudiante (leída del formulario).
// 2. Reenvía al background el aviso de confirmación que manda siaan-hook.js.

const HOOK_SOURCE = 'admisiones-ucb-hook';

function text(el) {
  return (el?.innerText || el?.textContent || '').trim();
}

/** Colegio y departamento del bloque "Colegio de egreso" (ícono mat-icon "school"). */
function readColegio() {
  const icon = [...document.querySelectorAll('mat-icon')].find((i) => text(i) === 'school');
  let block = icon;
  for (let i = 0; i < 6 && block && !text(block).includes('>'); i++) block = block.parentElement;
  const lines = text(block).split('\n').map((s) => s.trim()).filter(Boolean);
  const pathIndex = lines.findIndex((l) => l.includes('>'));
  if (pathIndex < 1) return { colegio: '', departamentoColegio: '' };
  return {
    colegio: lines[pathIndex - 1],
    departamentoColegio: lines[pathIndex].split('>')[0].trim()
  };
}

function readPreview() {
  const val = (sel) => (document.querySelector(sel)?.value || '').trim();
  if (!document.querySelector('#f-doc')) return null;
  const nombre = [val('#f-ap1'), val('#f-ap2'), val('#f-nombres')].filter(Boolean).join(' ').replace(/\s+/g, ' ');
  const ci = val('#f-doc');
  if (!nombre && !ci) return null; // el formulario todavía no cargó los valores
  return { nombre, ci, celular: val('#f-cel'), ...readColegio() };
}

let lastSent = undefined;
let reviewId = null;

function sendPreview() {
  const preview = readPreview();
  const data = preview && { ...preview, idPreInscripcion: reviewId };
  const key = JSON.stringify(data);
  if (key === lastSent) return;
  lastSent = key;
  chrome.runtime.sendMessage({ type: 'siaan:preview', data }).catch(() => {});
}

let timer = null;
new MutationObserver(() => {
  clearTimeout(timer);
  timer = setTimeout(sendPreview, 400);
}).observe(document.documentElement, { subtree: true, childList: true, characterData: true });

// Angular asigna los valores por propiedad (no dispara mutaciones): revisar también cada pocos segundos.
setInterval(sendPreview, 3000);

window.addEventListener('message', (event) => {
  if (event.source !== window || event.origin !== location.origin) return;
  const msg = event.data;
  if (!msg || msg.source !== HOOK_SOURCE) return;
  if (msg.type === 'review-open') {
    reviewId = msg.idPreInscripcion;
    lastSent = undefined;
    setTimeout(sendPreview, 800);
  } else if (msg.type === 'confirmed') {
    chrome.runtime.sendMessage({ type: 'siaan:confirmed', idPreInscripcion: msg.idPreInscripcion, preview: readPreview() })
      .catch(() => {});
  }
});
