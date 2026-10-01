// Arma las filas a escribir a partir de CONFIG_COLUMNAS.
// Reemplaza los arreglos dataToAppend de codigo.gs (ver tests/legacy-parity).

import { STUDENT_KEYS } from './config.js';
import { isoToDMY } from './dates.js';
import { submissionValues } from './form.js';

export function departamentoCarrera(config, carrera) {
  return config.departamentos[carrera] ?? config.departamentos['*'] ?? '';
}

/** Valor de una celda según su token (vacío, "LITERAL", @departamentoCarrera, dato del estudiante o campo). */
function cellValue(config, token, student, values) {
  if (!token) return '';
  if (token.length >= 2 && token.startsWith('"') && token.endsWith('"')) return token.slice(1, -1);
  if (token === '@departamentoCarrera') return departamentoCarrera(config, values.carrera);
  if (STUDENT_KEYS.includes(token)) return student[token] ?? '';
  if (!(token in values)) throw new Error(`CONFIG_COLUMNAS usa "${token}", que no es un campo del formulario.`);
  return values[token] ?? '';
}

export function buildRow(config, plantilla, student, values) {
  const cols = config.columnas[plantilla];
  if (!cols) throw new Error(`No hay columnas para la plantilla ${plantilla}.`);
  return cols.map((c) => cellValue(config, c.valor, student, values));
}

/** Convierte la fecha del formulario (YYYY-MM-DD) al formato de la planilla. */
function sheetValues(values) {
  return values.fecha ? { ...values, fecha: isoToDMY(values.fecha) } : { ...values };
}

/**
 * Todas las escrituras de un registro, en orden. La primera es la principal; las demás son
 * secundarias (si fallan, el registro principal sigue siendo válido, igual que en codigo.gs).
 * @returns {{tipo: 'principal'|'incentivos'|'promo', destino?: object, spreadsheetId?: string, hoja: string, fila: any[]}[]}
 */
export function planWrites(config, destinoId, student, formValues) {
  const destino = config.destinos.find((d) => d.id === destinoId);
  if (!destino) throw new Error(`Destino desconocido: ${destinoId}`);

  const values = sheetValues(submissionValues(config, destino.plantilla, formValues));
  const writes = [{ tipo: 'principal', destino, hoja: destino.hoja, fila: buildRow(config, destino.plantilla, student, values) }];

  const g = config.general;
  if ('incentivo' in values && values.incentivo && values.incentivo !== g.incentivoSinValor && config.columnas.INCENTIVOS) {
    writes.push({
      tipo: 'incentivos',
      spreadsheetId: g.incentivosSpreadsheetId,
      hoja: g.incentivosHoja,
      fila: buildRow(config, 'INCENTIVOS', student, values)
    });
  }

  if (g.promoActiva && values.grupoPreUCB) {
    const promo = config.destinos.find((d) => d.id === values.grupoPreUCB);
    if (!promo) throw new Error(`Destino de promoción desconocido: ${values.grupoPreUCB}`);
    const promoValues = { ...values, plan: g.promoPlan, metodoPago: g.promoMetodoPago };
    writes.push({ tipo: 'promo', destino: promo, hoja: promo.hoja, fila: buildRow(config, promo.plantilla, student, promoValues) });
  }

  return writes;
}
