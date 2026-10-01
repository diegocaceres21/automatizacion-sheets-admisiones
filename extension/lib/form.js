// Lógica del formulario: valores por defecto, reglas por carrera, condiciones y promoción.
// Sin dependencias de Chrome ni del DOM para poder probarla en Node.

import { todayISO } from './dates.js';

export function fieldsFor(config, plantilla) {
  return config.campos[plantilla] || [];
}

/** Resuelve el default de un campo: vacío = primer valor de la lista, HOY, @claveGeneral o literal. */
export function resolveDefault(config, field, now = new Date()) {
  const d = field.default || '';
  if (d === 'HOY') return todayISO(config.general.timezone, now);
  if (d.startsWith('@')) return String(config.general[d.slice(1)] ?? '');
  if (d) return d;
  if (field.tipo === 'select' && field.lista) return config.listas[field.lista]?.[0] ?? '';
  return '';
}

/**
 * Valores iniciales del formulario.
 * @param {object} remembered  valores recordados por asesor (ej. { asesor }); solo se usan si son opciones válidas
 */
export function initialValues(config, plantilla, { now = new Date(), remembered = {} } = {}) {
  const values = {};
  for (const f of fieldsFor(config, plantilla)) {
    values[f.campo] = resolveDefault(config, f, now);
    const r = remembered[f.campo];
    if (r !== undefined && (!f.lista || config.listas[f.lista]?.includes(r))) values[f.campo] = r;
  }
  return applyRules(config, plantilla, values);
}

/** Asesor que corresponde a la cuenta de Chrome, si está en CONFIG_ASESORES y en la lista de asesores. */
export function asesorForEmail(config, email) {
  const nombre = config.asesoresPorEmail?.[String(email || '').trim().toLowerCase()];
  return nombre && config.listas.asesores?.includes(nombre) ? nombre : null;
}

/** Aplica CONFIG_REGLAS (ej. test de matemáticas según la carrera). Devuelve un objeto nuevo. */
export function applyRules(config, plantilla, values) {
  const out = { ...values };
  for (const r of config.reglas[plantilla] || []) {
    const lista = config.listas[r.listaCarreras] || [];
    out[r.campo] = lista.includes(out.carrera) ? r.valorSi : r.valorNo;
  }
  // La promoción depende de la carrera: si la opción elegida ya no aplica, se limpia.
  if ('grupoPreUCB' in out && !promoOptions(config, out.carrera).some((d) => d.id === out.grupoPreUCB)) {
    out.grupoPreUCB = '';
  }
  return out;
}

export function isActive(field, values) {
  return !field.condicion || values[field.condicion.campo] === field.condicion.valor;
}

/** Destinos ofrecidos como Pre UCB gratis para la carrera elegida. Vacío si la promoción está apagada. */
export function promoOptions(config, carrera) {
  if (!config.general.promoActiva) return [];
  const rule = config.promo.find((p) => p.carrera === carrera) || config.promo.find((p) => p.carrera === '*');
  if (!rule) return [];
  return rule.destinos
    .map((id) => config.destinos.find((d) => d.id === id && d.activo))
    .filter(Boolean);
}

/** Valores a enviar: campos inactivos por condición quedan vacíos, igual que un input oculto vacío. */
export function submissionValues(config, plantilla, values) {
  const out = { ...values };
  for (const f of fieldsFor(config, plantilla)) {
    if (!isActive(f, values)) out[f.campo] = '';
  }
  return out;
}
