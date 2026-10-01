# Phase 0 findings (2026-10-01)

Verified read-only on the live SIAAN page, logged in as an advisor, with one preinscription open in "Revisar preinscripción".

## SIAAN session auth

| localStorage key | Use |
|---|---|
| `tokenDeAcceso` | Value of the `Token` header. 108 chars, same format as the old hardcoded token. |
| `UCB_UNIQUE_CODE` | Value of the `Uniquecode` header. Present even before login. It differs from the old hardcoded `MARKETING-CODE-2025`. |
| `PD_TOKEN` | JSON `{ datos }`, about 18 KB. Not needed. |

Calls from the page origin with these two headers return 200. So the extension reads both keys from an open `academico.ucb.edu.bo` tab (`chrome.scripting.executeScript`) and sends them from the side panel. Host permission on `backend.ucb.edu.bo` avoids CORS.

There is no SIAAN tab, or the keys are missing: the panel shows "Inicia sesión en SIAAN". A 401 from the backend means the token expired, and the panel shows the same message.

## CI lookup endpoints (fallback flow)

- `ObtenerListaPreinscripcionesReducidas?idRegional=PJh5GJydX69ABmU3tKVdpQ==&idEstadoPreinscripcion=ooo40MW8KdnMovKywZ6qzQ==&apellidosNombresCi=<ci>`
  - `ooo40MW8KdnMovKywZ6qzQ==` filters the state **CONFIRMADO**.
  - Rows are arrays of 8 cells: `{ nombreColumna, contenidoCelda: [{ contenido, parametros, ... }] }`. Columns: Periodo, Carrera, Apellidos y Nombres, Tipo de documento, Documento de identidad, Fecha, Estado, Acciones.
  - Cell 7 (Acciones) holds the `idPreInscripcion` parameter **only for CONFIRMADO rows**. PENDIENTE rows have no parameters.
  - No match returns **HTTP 404** with `mensajes: [{ descripcion: "No se encontraron datos." }]`, not an empty list. The old code never resolved in this case, which caused the hanging dialog.
- `ObtenerDatosPreInscripcionReducida?idPreinscripcion=<id>` returns 200 with `datos.preInscripcion`:
  - `datosPersonales`: `apellidosNombres`, `documentoIdentidad`, `celulares` (string), `prefijoCelular`, ...
  - `datosColegio`: `colegio`, `departamento`, `provincia`, `anioEgreso`, ...

Look up cells by `nombreColumna`, not by index 7. This survives column reordering.

## Scraping the review view

The selectors match live values (Angular sets `.value`; the saved HTML has none):

| Field | Source |
|---|---|
| Primer apellido | `#f-ap1` |
| Segundo apellido | `#f-ap2` |
| Nombres | `#f-nombres` |
| CI | `#f-doc` |
| Celular | `#f-cel` |
| Celular tutor | `#f-celt` (not used today) |
| Colegio | the line after "BUSCAR COLEGIO" in the block with the `school` mat-icon |
| Departamento | first segment of the next line, `COCHABAMBA > PROVINCIA: ... > ZONA: ...` |

Detect the review view: `#f-doc` exists. The URL stays `/tramites/preInscripcion/gestion` for both the list and the review view, so the URL alone is not enough.

`nombre` = `${ap1} ${ap2} ${nombres}`, with spaces collapsed. This matches the `apellidosNombres` format of the API.

## Detecting "Confirmar"

Decision: an advisor registers a student only after confirming the preinscription in SIAAN. The panel picks the student up automatically.

The page traffic was observed while you confirmed one student (resource timing, URLs only):

| Moment | Request |
|---|---|
| Open "Revisar preinscripción" | `GET PreInscripcionResumida/ObtenerPreInscripcionParaEditarV2?idPreInscripcion=<id>` (+ `ObtenerDatosFacturaV2`, `BuscarPorDocumentoV2`, `ObtenerColegioPorId`) |
| "Editar" then save | `POST PreInscripcionResumida/ActualizarPreInscripcionReducidaV2` |
| "Confirmar" | `POST PreInscripcionResumida/ConfirmarPreInscripcionReducidaV2`, 200 |
| After confirm | The page returns to the list (the review view closes, so `#f-doc` disappears) and reloads the list |

`ObtenerPreInscripcionParaEditarV2` returns `datos.{ idPreInscripcion, informacionGeneral, datosPersonales: { primerApellido, segundoApellido, nombres, documentoIdentidad, celular, ... }, ... }`.

Implementation:

1. A content script in the page's `MAIN` world wraps `XMLHttpRequest` (Angular HttpClient uses XHR). It does not change any request.
2. On `ObtenerPreInscripcionParaEditarV2`, it remembers the `idPreInscripcion` and the response.
3. On `ConfirmarPreInscripcionReducidaV2` with status 200, it posts `{ idPreInscripcion }` to the isolated content script, which forwards it to the background.
4. The background calls `ObtenerDatosPreInscripcionReducida?idPreinscripcion=<id>` (works once the state is CONFIRMADO; verified) to get the same data object as the CI flow.
5. The panel shows the student ready to register. If the panel is closed, the icon gets a badge and the next click opens it with the student loaded.

DOM scraping (`#f-*`) stays as a preview while the review view is open. "Añadir" stays disabled until the confirm event arrives.

## Admissions spreadsheet layout (test copy `1mmliqZt...`)

| Sheet | Header rows | CI column | Old `doesValueExist` column | Result |
|---|---|---|---|---|
| NUEVOS CARRERAS | 1 | S (19) | 19 | correct |
| PRE UCB MED 1/2/3 | 2 | H (8) | 8 (by the `||` bug) | correct by accident |
| PRE UCB GENERAL / GENERAL 2 | 2 | G (7) | 8 | **wrong: checks CELULAR (H), duplicate CIs are never detected** |

The current `dataToAppend` arrays match the headers of every sheet:

- NUEVOS CARRERAS: A–AY (51 values).
- PRE UCB MED: A–W (23 values).
- PRE UCB GENERAL: A–Z (26 values). Column O "PRE U SELECCIONADO" receives `obtenerDepartamento(carrera)`.

Columns after the written range hold other data, possibly formulas: AZ–BD in NUEVOS, X–AA in MED, AA–AB in GENERAL.

- In `PRE UCB GENERAL 2`, T and V are both labeled "METODO DE PAGO". In GENERAL 1, T is "INCENTIVOS - APOYOS" and U is "ESTADO DE INCENTIVOS". The code writes the payment method to V. T is probably a mislabeled header. Please check.
- `MED 2` and `MED 3` have extra columns Z "ESTADO" and AA "PARALELO(S)" that `MED 1` lacks. The code does not write them.

Do not use `values.append` to write rows: if the extra columns have formulas or values further down, Sheets may detect the wrong table. Compute the next row from the last non-empty cell in column A, then use `values.update`. (`appendRow` uses the last row with content in any column, so this choice is equal or safer.)

## Extension ID (no Web Store)

We generated our own key pair instead of using a Web Store draft item, so there is no registration fee.

- Extension ID: `bdojilkooodhohaafnoenjalodmngdnc` (also in `keys/extension-id.txt`).
- The public key is in `extension/manifest.json` (`key`). Every unpacked install gets this ID.
- The private key is `keys/extension-key.pem` (git-ignored). Back it up somewhere safe. It is needed only to pack a `.crx` for self-hosted distribution. If you lose it, the ID can still be kept by reusing the `key` in the manifest, but you can no longer sign `.crx` packages with that ID.

## Google Cloud (pending, owner action)

1. Create a Cloud project in the `ucb.edu.bo` org. Enable the Google Sheets API. Set the OAuth consent screen to Internal.
2. Create an OAuth client of type "Chrome extension" with item ID `bdojilkooodhohaafnoenjalodmngdnc`. Skip "verify app ownership" (it only applies to Web Store items). Put the client ID in `manifest.json` `oauth2.client_id`.

## Distribution without the Web Store

| Option | How | Notes |
|---|---|---|
| Load unpacked (phases 2–4) | `chrome://extensions`, then Developer mode, then "Load unpacked", then select `extension/` | No cost. Chrome shows a "developer mode" warning on start. Updates mean replacing the folder and clicking reload. |
| Workspace force-install (release) | Admin console, then Chrome browser, then Apps & extensions, then "Add from custom URL". Host the `.crx` and `update.xml` on an HTTPS URL. | No cost. Silent install and automatic updates for all advisors. Needs Workspace admin rights and managed Chrome browsers (Chrome Browser Cloud Management, free). |
| Web Store (later) | Pay the one-time 5 USD developer fee | Same ID only if the item is published with this key. |
