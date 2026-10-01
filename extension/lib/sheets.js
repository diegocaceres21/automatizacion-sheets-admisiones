// Cliente mínimo de Google Sheets API v4. Escribe como el asesor (token de chrome.identity).

const API = 'https://sheets.googleapis.com/v4/spreadsheets';

export class SheetsError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const quote = (sheet) => `'${sheet.replace(/'/g, "''")}'`;

/** Índice 1-based -> letra de columna (1 -> A, 27 -> AA). */
export function columnLetter(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const normalizeCI = (v) => String(v ?? '').replace(/\s+/g, '').toUpperCase();

export class SheetsClient {
  /**
   * @param {{ getToken: (interactive: boolean) => Promise<string>, dropToken: (token: string) => Promise<void> }} auth
   * @param {typeof fetch} fetchImpl
   */
  constructor(auth, fetchImpl = fetch.bind(globalThis)) {
    this.auth = auth;
    this.fetch = fetchImpl;
  }

  async request(path, init = {}, retried = false) {
    const token = await this.auth.getToken(true);
    const res = await this.fetch(`${API}/${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) }
    });
    if (res.status === 401 && !retried) {
      await this.auth.dropToken(token);
      return this.request(path, init, true);
    }
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).error?.message || ''; } catch { /* sin cuerpo JSON */ }
      const msg = res.status === 403
        ? 'No tiene permiso de edición en la planilla. Pida acceso al administrador.'
        : res.status === 404
          ? 'No se encontró la planilla. Revise el ID en las opciones de la extensión.'
          : `Error de Google Sheets (${res.status}). ${detail}`;
      throw new SheetsError(msg, res.status);
    }
    return res.json();
  }

  async batchGet(spreadsheetId, ranges, render = 'FORMATTED_VALUE') {
    const q = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&');
    const data = await this.request(`${spreadsheetId}/values:batchGet?${q}&valueRenderOption=${render}`);
    return data.valueRanges.map((vr) => vr.values || []);
  }

  async get(spreadsheetId, range, render = 'FORMATTED_VALUE') {
    return (await this.batchGet(spreadsheetId, [range], render))[0];
  }

  async update(spreadsheetId, range, rows) {
    return this.request(`${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      body: JSON.stringify({ range, majorDimension: 'ROWS', values: rows })
    });
  }

  /** ID numérico (gid) de una hoja, para armar enlaces directos a la fila registrada. */
  async sheetGid(spreadsheetId, hoja) {
    const data = await this.request(`${spreadsheetId}?fields=sheets.properties(sheetId,title)`);
    return data.sheets.find((s) => s.properties.title === hoja)?.properties.sheetId ?? null;
  }

  /** true si el CI ya está en la columna indicada (debajo del encabezado). */
  async ciExists(spreadsheetId, hoja, columna, filasEncabezado, ci) {
    const col = await this.get(spreadsheetId, `${quote(hoja)}!${columna}${filasEncabezado + 1}:${columna}`, 'UNFORMATTED_VALUE');
    const target = normalizeCI(ci);
    return col.some((r) => normalizeCI(r[0]) === target);
  }

  /** Encabezado de la hoja (última fila de encabezado), para compararlo con CONFIG_COLUMNAS. */
  async header(spreadsheetId, hoja, filasEncabezado, columnas) {
    const row = (await this.get(spreadsheetId, `${quote(hoja)}!A${filasEncabezado}:${columnLetter(columnas)}${filasEncabezado}`))[0] || [];
    return Array.from({ length: columnas }, (_, i) => String(row[i] ?? '').replace(/\s+/g, ' ').trim());
  }

  /**
   * Escribe la fila después de la última fila con datos en la columna A.
   * No usa values.append: su detección de "tabla" falla con columnas extra a la derecha.
   * Tras escribir, relee la fila; si otro asesor escribió en la misma fila al mismo tiempo, reintenta más abajo.
   * @returns {Promise<number>} número de fila escrita
   */
  async appendRow(spreadsheetId, hoja, fila, { filasEncabezado = 1, intentos = 3 } = {}) {
    const lastCol = columnLetter(fila.length);
    for (let i = 0; i < intentos; i++) {
      const colA = await this.get(spreadsheetId, `${quote(hoja)}!A:A`);
      const row = Math.max(colA.length, filasEncabezado) + 1;
      const range = `${quote(hoja)}!A${row}:${lastCol}${row}`;
      await this.update(spreadsheetId, range, [fila]);
      const back = (await this.get(spreadsheetId, `${quote(hoja)}!A${row}`))[0]?.[0] ?? '';
      if (String(back).trim() === String(fila[0]).trim()) return row;
    }
    throw new SheetsError(`No se pudo escribir en "${hoja}" (la hoja cambió durante el registro). Intente de nuevo.`, 409);
  }
}

/** Autenticación con la cuenta de Chrome del asesor (manifest.oauth2). */
export const chromeAuth = {
  async getToken(interactive) {
    let result;
    try {
      result = await chrome.identity.getAuthToken({ interactive });
    } catch (e) {
      // Rechaza con valores variados (a veces sin mensaje) cuando el perfil de Chrome no tiene sesión iniciada.
      console.error('[Admisiones UCB] getAuthToken:', e);
      throw new SheetsError(
        `No se pudo iniciar sesión con Google${e?.message ? ` (${e.message})` : ''}. ` +
        'Verifique que el perfil de Chrome tenga iniciada la sesión con su cuenta @ucb.edu.bo.', 401);
    }
    const token = typeof result === 'string' ? result : result?.token; // Chrome antiguo devuelve el token directo
    if (!token) throw new SheetsError('No se pudo iniciar sesión con Google. Verifique la cuenta del perfil de Chrome.', 401);
    return token;
  },
  async dropToken(token) {
    await chrome.identity.removeCachedAuthToken({ token });
  }
};
