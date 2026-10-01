// Orquesta un registro: verifica duplicado y encabezados, luego escribe la fila principal y las secundarias.

import { planWrites } from './rowBuilder.js';
import { reportError } from './errors.js';

/** Revisión previa al registro (también se usa al elegir destino para avisar antes de llenar el formulario). */
export async function precheck(sheets, spreadsheetId, config, destinoId, ci) {
  const destino = config.destinos.find((d) => d.id === destinoId);
  const duplicado = await sheets.ciExists(spreadsheetId, destino.hoja, destino.columnaCI, destino.filasEncabezado, ci);
  return { duplicado };
}

/** Columnas cuyo encabezado real difiere del guardado en CONFIG_COLUMNAS (solo las que se escriben). */
export async function headerWarnings(sheets, spreadsheetId, config, destino) {
  const cols = config.columnas[destino.plantilla];
  const real = await sheets.header(spreadsheetId, destino.hoja, destino.filasEncabezado, cols.length);
  return cols
    .map((c, i) => ({ ...c, real: real[i] }))
    .filter((c) => c.valor && c.encabezado && c.real !== c.encabezado)
    .map((c) => `${destino.hoja}!${c.columna}: se esperaba "${c.encabezado}", la hoja dice "${c.real}".`);
}

/**
 * @returns {Promise<{ fila: number, hoja: string, secundarias: {tipo: string, ok: boolean, error?: string}[] }>}
 */
export async function registrar(sheets, spreadsheetId, config, destinoId, student, values) {
  const [principal, ...secundarias] = planWrites(config, destinoId, student, values);

  // Se vuelve a revisar justo antes de escribir: otro asesor pudo registrar al mismo estudiante.
  const { duplicado } = await precheck(sheets, spreadsheetId, config, destinoId, student.ci);
  if (duplicado) throw new Error(`Este estudiante YA HA SIDO REGISTRADO en "${principal.hoja}".`);

  const fila = await sheets.appendRow(spreadsheetId, principal.hoja, principal.fila, {
    filasEncabezado: principal.destino.filasEncabezado
  });

  const resultados = [];
  for (const w of secundarias) {
    try {
      await sheets.appendRow(w.spreadsheetId || spreadsheetId, w.hoja, w.fila, {
        filasEncabezado: w.destino?.filasEncabezado ?? 1
      });
      resultados.push({ tipo: w.tipo, ok: true });
    } catch (e) {
      resultados.push({ tipo: w.tipo, ok: false, error: reportError(`Escritura secundaria (${w.tipo})`, e) });
    }
  }
  return { fila, hoja: principal.hoja, secundarias: resultados };
}
