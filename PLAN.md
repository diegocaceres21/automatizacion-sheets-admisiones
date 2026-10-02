# Plan: Admisiones Chrome side panel extension

Replace the Apps Script menu + modal dialogs with a Chrome side panel extension. Advisors register students into the admissions spreadsheet from any tab, without opening Google Sheets. When the advisor is on the SIAAN preinscription review page, student data is scraped from the page instead of typing the CI.

## Decisions (from Q&A)

| Topic | Decision |
|---|---|
| Sheet writes | Google Sheets API directly from the extension, as the advisor (`chrome.identity`). No Apps Script hop. |
| Parameters | `CONFIG_*` tabs inside the admissions spreadsheet, read at runtime. Spreadsheet ID set once in the extension options page. |
| SIAAN auth (CI fallback) | Advisor's own logged-in session on academico.ucb.edu.bo. Hardcoded token and `Uniquecode` removed from code. |
| Scraping source | Open "Revisar preinscripción" view on `/AcademicoNacional/tramites/preInscripcion/gestion`. |
| Carrera | Always chosen manually (not prefilled from SIAAN). |
| Hidden fields (`campo-oculto`) | Hidden by default, editable in a collapsible "Más campos" section. Visibility and defaults set in CONFIG. |
| CATO HOLIDAY promo | Kept as a generic promo, on/off and labels in CONFIG. |
| Distribution | No Web Store (registration fee). Self-generated key fixes the extension ID. Load unpacked during testing; Workspace force-install from a self-hosted `.crx` for release. OAuth consent screen "Internal". |

## Architecture

```
extension/
  manifest.json            MV3; side_panel, identity, storage, scripting
  background.js            service worker: opens panel, routes messages, tracks active tab
  content/siaan.js         runs on academico.ucb.edu.bo: scrapes review view, watches for changes
  sidepanel/
    index.html, app.js, styles.css
  lib/
    config.js              loads + caches CONFIG_* tabs (chrome.storage.session, 10 min TTL)
    sheets.js              Sheets API: values.get, values.append, auth retry on 401
    siaan.js               CI lookup via backend.ucb.edu.bo with the advisor's session token
    rowBuilder.js          builds the row array from a column template (replaces dataToAppend arrays)
    dates.js               dd/mm/yyyy in America/La_Paz
  options/
    options.html, options.js   spreadsheet ID, "test connection" button
legacy/
  codigo.gs, *.html        current Apps Script, kept until cut-over, plus seedConfig()
```

Manifest host permissions: `https://academico.ucb.edu.bo/*`, `https://backend.ucb.edu.bo/*`, `https://sheets.googleapis.com/*`. OAuth scope: `https://www.googleapis.com/auth/spreadsheets`.

### Student data sources

1. **On SIAAN review page.** `content/siaan.js` reads live input values (Angular sets `.value`; the saved HTML shows no values):
   - `#f-ap1`, `#f-ap2`, `#f-nombres` give the name ("APELLIDO1 APELLIDO2 NOMBRES", duplicate spaces collapsed, same format as today).
   - `#f-doc` gives the CI. `#f-cel` gives the phone.
   - The "Colegio de egreso" block gives the school name and the department (first segment of `COCHABAMBA > PROVINCIA: ...`).
   - A `MutationObserver` pushes updates to the panel when the advisor opens another preinscription. The panel shows a "Detectado desde SIAAN" card with a refresh button.
2. **Anywhere else.** The panel shows a CI input. `lib/siaan.js` calls the same two endpoints as today (`ObtenerListaPreinscripcionesReducidas`, then `ObtenerDatosPreInscripcionReducida`) with the advisor's session token. If no SIAAN session exists, the panel shows "Inicia sesión en SIAAN" with a link.

Both sources produce one object: `{ nombre, ci, celular, colegio, departamentoColegio }`.

### CONFIG tabs (in the admissions spreadsheet)

| Tab | Content |
|---|---|
| `CONFIG_GENERAL` | key/value: `incentivosSpreadsheetId`, `incentivosSheet`, `anioPromocionDefault`, `promoEnabled`, `promoPlan`, `promoMetodoPago`, `timezone` |
| `CONFIG_DESTINOS` | one row per target: `id`, `grupo` (menu group label), `label`, `sheetName`, `ciColumn`, `plantilla`, `listaCarreras`, `listaPlanes`, `promoTargets`, `activo` |
| `CONFIG_LISTAS` | one column per list: `asesores`, `carreras_general`, `carreras_salud`, `carreras_nuevos`, `planes_general`, `planes_salud`, `planes_nuevos`, `incentivos`, ... |
| `CONFIG_CAMPOS` | per template + field: `label`, `tipo` (select/text/number/date/textarea), `lista`, `default`, `visibilidad` (visible/avanzado/oculto), `condicion` (e.g. `universidad` only if `tipoEstudiante=TRASPASO`) |
| `CONFIG_COLUMNAS` | per template, ordered tokens, one per sheet column: field key (`asesor`), student key (`ci`), computed (`@departamentoCarrera`), literal (`"ENTREGADO"`), or empty |
| `CONFIG_DEPARTAMENTOS` | carrera to department (DAEF, DCSH, DCEI con QM; default DCEI sin QM) |
| `CONFIG_REGLAS` | test auto-defaults (matemáticas/física/química by carrera), currently hardcoded in NUEVOS_CARRERAS.html |

A one-time `seedConfig()` Apps Script function in `legacy/` writes these tabs from the current hardcoded values. The first release then behaves exactly like today.

Column changes or a new destination spreadsheet need only a CONFIG edit or an options change. No Web Store update.

### Side panel UX

1. **Estudiante.** SIAAN card (auto) or CI search. Shows name, CI, phone, school.
2. **Destino.** Chips grouped as in today's menu: NUEVOS CARRERAS · PRE UCB SALUD G1–G3 · PRE UCB GENERAL G1–G2. On select, the duplicate check runs immediately (`values.get` on the destination's `ciColumn`). If the CI already exists, a red banner blocks submit.
3. **Formulario.** Generated from `CONFIG_CAMPOS`. The last asesor is remembered per advisor (`chrome.storage.sync`). "Más campos" holds the advanced fields. The promo selector appears only when `promoEnabled` is on and the carrera allows it.
4. **Añadir.** Re-check duplicates, then append the row (`USER_ENTERED`). After that, append to the incentivos sheet if needed, and to the promo sheet if needed. Show a success toast with a "Abrir en Sheets" link to the new row. Reset for the next student; asesor and destination stay.

Errors show in the panel (no `alert`). A failure in the incentivos or promo write shows a warning, not a failure, because the main row is saved (same as today).

## Bugs fixed during the port

- `doesValueExist`: `sheetName == "PRE UCB GENERAL" || "PRE UCB GENERAL 2"` is always true, so every PRE sheet checks column 8. That is right for MED (CI in H) only by accident. For PRE UCB GENERAL 1 and 2, the CI is in G, so the check compares against CELULAR and never finds duplicates. Fixed by `ciColumn` per destination in CONFIG.
- `formatDate` uses `getDate() + 1` to undo a UTC shift. On the last day of a month it produces an invalid date (e.g. `32/01/2026`). Replaced by timezone-aware formatting.
- `obtenerIDEstudiante` never resolves or rejects on non-200 responses, so the dialog hangs. The new client reports every non-200 response.
- Shared, expiring SIAAN token in source code. Removed.
- Loader image loads over `http://`. Removed (inline CSS spinner).

## Phases

0. **Spike (read-only, about 1 day).** SIAAN part done: see [docs/phase0-findings.md](docs/phase0-findings.md). Google Cloud part pending.
   - On the live SIAAN page, find where the session token is stored (localStorage, sessionStorage or cookie) and which headers the backend expects.
   - Confirm the scraping selectors and the colegio/department parsing against several students.
   - Create the Google Cloud project, the OAuth client (Chrome extension type) and the Internal consent screen. Fix the extension ID with a `key` in the manifest.
1. **CONFIG.** Write `seedConfig()`, run it on a copy of the spreadsheet, review the tabs with you. Code done: `apps-script/seedConfig.gs`, schema in [docs/config-schema.md](docs/config-schema.md), parity test `tests/legacy-parity.js` (templates produce the same rows as `legacy/codigo.gs`). Pending: run on the test copy.
2. **Extension core.** Config loader, Sheets client, row builder. Unit-test the row builder: for each template, the produced row must equal today's `dataToAppend` output for the same input. Code done in `extension/lib/` plus the options page; `npm test` runs 23 tests (parity with `legacy/codigo.gs`, form defaults/rules, Sheets client with a fake API). Pending: "Probar conexión" against the test copy.
3. **Side panel UI + SIAAN content script + CI fallback.** Code done: `extension/sidepanel/`, `extension/content/` (XHR hook detects "Confirmar"), `extension/background.js`, `extension/lib/siaan.js`. `npm test` = 28 tests. UI checked in `tests/ui/harness.html` (stubbed Chrome + Sheets). Pending: live test on SIAAN + test copy.
4. **Parallel run.** 2–3 advisors use the extension, unpacked, on the sheet copy, then on the real sheet. The Apps Script menu stays as a fallback. Prepared: advisor guide [docs/guia-asesores.md](docs/guia-asesores.md); legacy menu fixed (token from CONFIG_GENERAL, GENERAL duplicate column, 404 handling, date bug).
5. **Release.** No Web Store and no Workspace admin: versioned zip built by `scripts/package.js` (spreadsheet ID embedded), `version.json` on GitHub Pages, update notice in the panel. Steps in [docs/publicar-version.md](docs/publicar-version.md). Since 0.3.0 (2026-10-02): advisors install with `install/instalar.ps1` (one Windows+R line, then one-time "Load unpacked"); a per-user scheduled task installs new releases and the extension reloads itself. Chosen over Edge Add-ons (free store, but advisors would have to switch to Edge) and IT-managed install (needs domain-joined PCs). The old menu stays as a fallback (decision 2026-10-01).

## Open items for you

- Who owns the Google Cloud project and the Web Store developer account (one-time 5 USD fee)? A Workspace admin may need to allow the app.
- The admissions spreadsheet ID and the copy to use for testing.
- Do all advisors have edit access to the admissions sheet **and** the incentivos sheet (`1ACoimXD...`)? Writes run as each advisor.
- `Academico.html` contains your name and possibly student data. Keep it out of git (add it to `.gitignore`).
