# CONFIG tabs schema (version 1)

The extension reads these tabs from the admissions spreadsheet. Row 1 is the header. Empty rows are ignored. All cells are plain text. `apps-script/seedConfig.gs` creates them, and `verificarConfig()` validates them.

## CONFIG_GENERAL

Key/value pairs: `clave | valor | descripcion`.

| clave | Meaning |
|---|---|
| `configVersion` | Schema version. The extension refuses to run on an unknown version. |
| `anioPromocionDefault` | Default for `anioPromocion` (referenced as `@anioPromocionDefault`). |
| `timezone` | Time zone for `HOY` dates. |
| `incentivosSpreadsheetId`, `incentivosHoja` | Where to write the INCENTIVOS row. |
| `incentivoSinValor` | When `incentivo` equals this value (or is empty), no INCENTIVOS row is written. |
| `promoActiva` | `TRUE`/`FALSE`. Shows or hides the `promo` field. |
| `promoEtiqueta`, `promoPlan`, `promoMetodoPago` | Label of the promo field. `plan` and `metodoPago` in the promo row are replaced with these. |
| `siaanIdRegional`, `siaanIdEstadoConfirmado` | Parameters for the SIAAN CI search. |
| `versionUrl` | URL of `version.json` on GitHub Pages. When it lists a newer version, the panel shows a download notice. Empty = no check. |
| `siaanTokenLegacy`, `siaanUniqueCodeLegacy` | Used only by the old Apps Script menu (`legacy/codigo.gs`). See [publicar-version.md](publicar-version.md). |

## CONFIG_DESTINOS

One row per registration target: `id | grupo | etiqueta | hoja | filasEncabezado | columnaCI | plantilla | activo`.

- `grupo` + `etiqueta`: how the target appears in the panel. Targets with the same `grupo` appear together.
- `hoja`: sheet name in this spreadsheet.
- `filasEncabezado`: number of header rows. Data starts after them.
- `columnaCI`: column letter used for the duplicate check.
- `plantilla`: selects fields (CONFIG_CAMPOS) and columns (CONFIG_COLUMNAS).
- `activo`: `FALSE` hides the target.

## CONFIG_LISTAS

One column per list. The header is the list name, and the values are below it. The first value is the default when a field has no `default`.

## CONFIG_CAMPOS

Form fields per template, in display order: `plantilla | campo | etiqueta | tipo | lista | default | visibilidad | condicion`.

- `tipo`: `select`, `text`, `number`, `date`, `textarea`, or `promo` (special: options come from CONFIG_PROMO).
- `default`: empty means the first list value. `HOY` means today's date. `@clave` means a value from CONFIG_GENERAL. Any other text is a literal.
- `visibilidad`: `visible`, `avanzado` (in the collapsible "Más campos" section), or `oculto` (no UI, the default is sent).
- `condicion`: `campo=VALOR`. The field shows and is sent only when the condition is true. Otherwise its value is empty.

## CONFIG_COLUMNAS

The row written to the sheet: `plantilla | columna | valor | encabezado`. There is one entry per column, in order from column A, with no gaps.

`valor` tokens:

| Token | Written value |
|---|---|
| empty | `""` |
| `"TEXTO"` | the literal text |
| `@departamentoCarrera` | CONFIG_DEPARTAMENTOS lookup of `carrera` |
| `nombre`, `ci`, `celular`, `colegio`, `departamentoColegio` | student data from SIAAN |
| any other name | the form field with that `campo` |

`encabezado` is the sheet header seen when the tab was created. The extension compares it with the live header before it writes, and shows a warning if they differ.

The `INCENTIVOS` template is the row for the Bienestar spreadsheet. It uses the NUEVOS fields.

## CONFIG_PROMO

`carrera | destinos`: promo targets (CONFIG_DESTINOS ids, comma-separated) offered for the chosen NUEVOS carrera. `*` matches any other carrera. Empty `destinos` means no promo for that carrera.

## CONFIG_REGLAS

`plantilla | campo | listaCarreras | valorSi | valorNo`: when `carrera` changes, `campo` is set to `valorSi` if the carrera is in the list `listaCarreras`. Otherwise it is set to `valorNo`.

## CONFIG_DEPARTAMENTOS

`carrera | departamento`. `*` is the fallback.

## CONFIG_ASESORES

`nombre | email`: the Google account (`@ucb.edu.bo`) each advisor uses in Chrome. When the Chrome profile email matches a row, the panel preselects that `nombre` in the `asesor` field and shows "Según su cuenta …" under it. The advisor can still change it.

- `nombre` must also appear in the `asesores` list of CONFIG_LISTAS. That list still defines the dropdown options.
- Matching ignores case. Rows without an email are ignored.
- With no match, the panel falls back to the last asesor used on that browser.

To add an advisor: add the name to `CONFIG_LISTAS.asesores` and add a row here. Then click ↻ in the panel, or wait up to 10 minutes.
