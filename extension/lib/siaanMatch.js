// Relaciona lo que dice SIAAN (periodo académico, carrera) con la configuración:
//   periodo  -> destino     (CONFIG_DESTINOS.periodoSIAAN)
//   carrera  -> opción de la lista de carreras (nombre igual sin tildes/sigla, o alias en CONFIG_CARRERAS_SIAAN)

/** Mayúsculas, sin tildes, sin "[SIGLA]" y con espacios simples. */
export function normalizeText(text) {
  return String(text ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * Código del periodo: "[2026-CPRU-DIC] PERIODO DE CURSO..." -> "2026-CPRU-DIC"; "1-2027" -> "1-2027".
 */
export function periodoCode(text) {
  const s = String(text ?? '').trim();
  const m = /\[([^\]]+)\]/.exec(s);
  return (m ? m[1] : s.split(/\s+/)[0] || '').trim().toUpperCase();
}

/** Destino activo cuyo periodoSIAAN coincide con el periodo del estudiante, o null. */
export function destinoForPeriodo(config, periodo) {
  const code = periodoCode(periodo);
  if (!code) return null;
  return config.destinos.find((d) => d.activo && d.periodoSIAAN && periodoCode(d.periodoSIAAN) === code) || null;
}

/** Opción de la lista que corresponde a la carrera de SIAAN, o null si no se reconoce. */
export function carreraFromSIAAN(config, lista, carreraSIAAN) {
  const key = normalizeText(carreraSIAAN);
  if (!key || key === 'SIN CARRERA') return null;
  const opciones = config.listas[lista] || [];
  const alias = config.carrerasSIAAN?.[key];
  if (alias && opciones.includes(alias)) return alias;
  return opciones.find((o) => normalizeText(o) === key) || null;
}
