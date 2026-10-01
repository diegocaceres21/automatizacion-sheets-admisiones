// Lectura y validación de las hojas CONFIG_* (esquema: docs/config-schema.md).

export const CONFIG_VERSION = 1;

export const CONFIG_TABS = [
  'CONFIG_GENERAL', 'CONFIG_DESTINOS', 'CONFIG_LISTAS', 'CONFIG_CAMPOS',
  'CONFIG_COLUMNAS', 'CONFIG_PROMO', 'CONFIG_REGLAS', 'CONFIG_DEPARTAMENTOS', 'CONFIG_ASESORES'
];

export const STUDENT_KEYS = ['nombre', 'ci', 'celular', 'colegio', 'departamentoColegio'];

export class ConfigError extends Error {}

const str = (v) => (v === undefined || v === null ? '' : String(v));
const bool = (v) => str(v).trim().toUpperCase() === 'TRUE';

/** Filas (con encabezado en la primera) -> objetos { encabezado: valor }. Omite filas vacías. */
function toObjects(rows = []) {
  const [header = [], ...body] = rows;
  return body
    .filter((r) => r.some((c) => str(c).trim() !== ''))
    .map((r) => Object.fromEntries(header.map((h, i) => [str(h).trim(), str(r[i]).trim()])));
}

function groupBy(items, key) {
  const out = {};
  for (const it of items) (out[it[key]] ||= []).push(it);
  return out;
}

/**
 * Convierte el contenido crudo de las hojas en el objeto de configuración.
 * @param {Record<string, string[][]>} tabs  nombre de hoja -> filas (incluye encabezado)
 */
export function parseConfig(tabs) {
  for (const name of CONFIG_TABS) {
    if (!tabs[name]) throw new ConfigError(`Falta la hoja ${name} en la planilla. Ejecute seedConfig() en Apps Script para agregarla.`);
  }

  const general = Object.fromEntries(toObjects(tabs.CONFIG_GENERAL).map((r) => [r.clave, r.valor]));
  if (str(general.configVersion) !== String(CONFIG_VERSION)) {
    throw new ConfigError(
      `La versión de CONFIG (${general.configVersion || 'vacía'}) no es compatible con esta extensión (${CONFIG_VERSION}).`
    );
  }
  general.promoActiva = bool(general.promoActiva);

  const destinos = toObjects(tabs.CONFIG_DESTINOS).map((d) => ({
    id: d.id,
    grupo: d.grupo,
    etiqueta: d.etiqueta,
    hoja: d.hoja,
    filasEncabezado: Number(d.filasEncabezado) || 1,
    columnaCI: d.columnaCI.toUpperCase(),
    plantilla: d.plantilla,
    activo: bool(d.activo)
  }));

  const [listHeader = [], ...listRows] = tabs.CONFIG_LISTAS;
  const listas = {};
  listHeader.forEach((name, c) => {
    const n = str(name).trim();
    if (n) listas[n] = listRows.map((r) => str(r[c]).trim()).filter(Boolean);
  });

  const campos = groupBy(toObjects(tabs.CONFIG_CAMPOS).map((c) => ({
    plantilla: c.plantilla,
    campo: c.campo,
    etiqueta: c.etiqueta,
    tipo: c.tipo,
    lista: c.lista,
    default: c.default,
    visibilidad: c.visibilidad || 'visible',
    condicion: parseCondicion(c.condicion)
  })), 'plantilla');

  const columnas = groupBy(toObjects(tabs.CONFIG_COLUMNAS), 'plantilla');

  const promo = toObjects(tabs.CONFIG_PROMO).map((p) => ({
    carrera: p.carrera,
    destinos: p.destinos.split(',').map((s) => s.trim()).filter(Boolean)
  }));

  const reglas = groupBy(toObjects(tabs.CONFIG_REGLAS), 'plantilla');

  const departamentos = Object.fromEntries(toObjects(tabs.CONFIG_DEPARTAMENTOS).map((r) => [r.carrera, r.departamento]));

  // email de la cuenta de Chrome (minúsculas) -> nombre del asesor
  const asesoresPorEmail = Object.fromEntries(toObjects(tabs.CONFIG_ASESORES)
    .filter((a) => a.email && a.nombre)
    .map((a) => [a.email.toLowerCase(), a.nombre]));

  const config = { version: CONFIG_VERSION, general, destinos, listas, campos, columnas, promo, reglas, departamentos, asesoresPorEmail };
  validate(config);
  return config;
}

function parseCondicion(text) {
  if (!text) return null;
  const i = text.indexOf('=');
  if (i < 1) throw new ConfigError(`Condición inválida "${text}" (formato: campo=VALOR).`);
  return { campo: text.slice(0, i).trim(), valor: text.slice(i + 1).trim() };
}

/** Errores que impedirían escribir filas correctas. verificarConfig() en Apps Script hace la revisión completa. */
function validate(config) {
  const errors = [];
  for (const d of config.destinos.filter((x) => x.activo)) {
    if (!config.campos[d.plantilla]) errors.push(`Destino ${d.id}: la plantilla ${d.plantilla} no tiene campos.`);
    if (!config.columnas[d.plantilla]) errors.push(`Destino ${d.id}: la plantilla ${d.plantilla} no tiene columnas.`);
    if (!/^[A-Z]{1,3}$/.test(d.columnaCI)) errors.push(`Destino ${d.id}: columnaCI "${d.columnaCI}" no es una letra de columna.`);
  }
  for (const [plantilla, fields] of Object.entries(config.campos)) {
    for (const f of fields) {
      if (f.lista && !config.listas[f.lista]) errors.push(`Campo ${plantilla}.${f.campo}: la lista "${f.lista}" no existe.`);
    }
  }
  if (errors.length) throw new ConfigError(errors.join('\n'));
}

/** Rangos A1 para leer todas las hojas CONFIG en un solo batchGet. */
export function configRanges() {
  return CONFIG_TABS.map((t) => `'${t}'`);
}
