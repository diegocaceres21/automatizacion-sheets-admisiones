// Cliente del backend de SIAAN con la sesión del asesor (localStorage de academico.ucb.edu.bo).
// Detalles verificados en docs/phase0-findings.md.

const BASE = 'https://backend.ucb.edu.bo/Academico/api/v1/Academico/PreInscripcion';

export class SiaanError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code; // 'sin-sesion' | 'no-encontrado' | 'http'
  }
}

/** Une apellidos y nombres como lo hace SIAAN y colapsa espacios repetidos. */
export function normalizeName(...parts) {
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

/** Departamento desde "COCHABAMBA > PROVINCIA: ... > ZONA: ...". */
export function departamentoFromPath(text) {
  return String(text || '').split('>')[0].trim();
}

/** Busca en las tabs abiertas de SIAAN el token del asesor. */
export async function getSession() {
  const tabs = await chrome.tabs.query({ url: 'https://academico.ucb.edu.bo/*' });
  for (const tab of tabs) {
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => ({ token: localStorage.getItem('tokenDeAcceso'), uniqueCode: localStorage.getItem('UCB_UNIQUE_CODE') })
      });
      if (result?.token && result?.uniqueCode) return result;
    } catch {
      // tab descartada o cargando: probar la siguiente
    }
  }
  throw new SiaanError('Abra SIAAN (academico.ucb.edu.bo) en una pestaña e inicie sesión.', 'sin-sesion');
}

async function call(session, path) {
  const res = await fetch(`${BASE}/${path}`, { headers: { Token: session.token, Uniquecode: session.uniqueCode } });
  if (res.status === 401 || res.status === 403) {
    throw new SiaanError('La sesión de SIAAN expiró. Vuelva a iniciar sesión en academico.ucb.edu.bo.', 'sin-sesion');
  }
  if (res.status === 404) return null; // SIAAN responde 404 cuando no hay resultados
  if (!res.ok) throw new SiaanError(`SIAAN respondió con error ${res.status}.`, 'http');
  return res.json();
}

/**
 * Preinscripciones CONFIRMADAS con ese CI (puede haber más de una: ej. Pre UCB y carrera).
 * @returns {Promise<{ idPreInscripcion: string, periodo: string, carreraSIAAN: string }[]>}
 */
export async function findConfirmed(session, ci, general) {
  const q = new URLSearchParams({
    idRegional: general.siaanIdRegional,
    idEstadoPreinscripcion: general.siaanIdEstadoConfirmado,
    apellidosNombresCi: ci
  });
  const data = await call(session, `ObtenerListaPreinscripcionesReducidas?${q}`);
  const cell = (row, name) => row.find((c) => c.nombreColumna === name)?.contenidoCelda?.[0];
  const text = (row, name) => String(cell(row, name)?.contenido ?? '').trim();
  const out = [];
  for (const row of data?.datos || []) {
    if (text(row, 'Documento de identidad') !== String(ci).trim()) continue;
    const id = cell(row, 'Acciones')?.parametros?.find((p) => p.nombreParametro === 'idPreInscripcion')?.valorParametro;
    if (id) out.push({ idPreInscripcion: id, periodo: text(row, 'Periodo Académico'), carreraSIAAN: text(row, 'Carrera') });
  }
  return out;
}

/** idPreInscripcion de la primera preinscripción CONFIRMADA con ese CI, o null. */
export async function findConfirmedId(session, ci, general) {
  return (await findConfirmed(session, ci, general))[0]?.idPreInscripcion ?? null;
}

/**
 * Datos del estudiante en el formato que usan las planillas.
 * @param {{ periodo?: string, carreraSIAAN?: string }} extra  datos de la lista (periodo y carrera)
 */
export async function getStudent(session, idPreInscripcion, extra = {}) {
  const data = await call(session, `ObtenerDatosPreInscripcionReducida?idPreinscripcion=${encodeURIComponent(idPreInscripcion)}`);
  const p = data?.datos?.preInscripcion;
  if (!p) throw new SiaanError('No se pudieron leer los datos de la preinscripción.', 'no-encontrado');
  return {
    idPreInscripcion,
    nombre: normalizeName(p.datosPersonales.apellidosNombres),
    ci: String(p.datosPersonales.documentoIdentidad ?? '').trim(),
    celular: String(p.datosPersonales.celulares ?? '').trim(),
    colegio: String(p.datosColegio?.colegio ?? '').trim(),
    departamentoColegio: String(p.datosColegio?.departamento ?? '').trim(),
    periodo: extra.periodo || '',
    carreraSIAAN: extra.carreraSIAAN || ''
  };
}

/** Flujo por CI (fuera de la página de SIAAN). Devuelve una entrada por preinscripción confirmada. */
export async function studentsByCI(ci, general) {
  const session = await getSession();
  const rows = await findConfirmed(session, ci, general);
  if (!rows.length) {
    throw new SiaanError(`No hay una preinscripción CONFIRMADA con el CI ${ci}. Confírmela primero en SIAAN.`, 'no-encontrado');
  }
  return Promise.all(rows.map((r) => getStudent(session, r.idPreInscripcion, r)));
}
