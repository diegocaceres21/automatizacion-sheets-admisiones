// Fechas en la zona horaria configurada (CONFIG_GENERAL.timezone).
// Reemplaza formatDate() de los formularios antiguos, que sumaba 1 al día para compensar UTC
// y producía fechas inválidas a fin de mes (ej. 32/01/2026).

/** Fecha de hoy como 'YYYY-MM-DD' en la zona horaria dada. */
export function todayISO(timezone, now = new Date()) {
  // en-CA formatea como YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);
}

/** 'YYYY-MM-DD' -> 'DD/MM/YYYY' (formato que escriben las planillas). */
export function isoToDMY(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) throw new Error(`Fecha inválida: "${iso}"`);
  return `${m[3]}/${m[2]}/${m[1]}`;
}
