# Releasing a new version (admin)

Advisors install the extension unpacked (no Web Store, no Workspace admin). Chrome does not update it automatically. Instead, the panel compares its version with `version.json` on GitHub Pages and shows a download notice.

## Setup (done)

- The source repo `diegocaceres21/automatizacion-sheets-admisiones` is public, and GitHub Pages serves it from the root: https://diegocaceres21.github.io/automatizacion-sheets-admisiones/
- Releases live in `releases/`. The panel reads `https://diegocaceres21.github.io/automatizacion-sheets-admisiones/releases/version.json`. Set that URL as `versionUrl` in `CONFIG_GENERAL`.
- The advisor guide is also published: https://diegocaceres21.github.io/automatizacion-sheets-admisiones/docs/guia-asesores.html
- Everything in the repo is public. `.gitignore` keeps the private key, the OAuth client file, saved SIAAN pages and `dist/` out of it. Push with git; do not use the GitHub website's file upload, which ignores `.gitignore`.

## Each release

1. Bump `version` in `extension/manifest.json` (for example `0.1.0` to `0.2.0`).
2. Run the tests:

   ```bash
   npm test
   ```

3. Build into `releases/`:

   ```bash
   node scripts/package.js --out releases --base https://diegocaceres21.github.io/automatizacion-sheets-admisiones/releases --spreadsheet <SPREADSHEET_ID> --notas "Qué cambió"
   ```

   Use the test copy ID during the parallel run, and the production ID for the real rollout.
4. Commit and push `releases/` (the new zip and `version.json`). Keep old zips so old links keep working.
5. Within 6 hours, advisors see "Nueva versión … disponible" in the panel. They follow "Actualizar" in [guia-asesores.md](guia-asesores.md).

## Old Apps Script menu (fallback)

`legacy/codigo.gs` and the HTML forms stay installed as a fallback. They now read the SIAAN token from `CONFIG_GENERAL`:

- `siaanTokenLegacy`: the shared SIAAN token. It used to be hardcoded; the last one expired on 29/5/2026. Ask SIAAN/IT for a new one and paste it here.
- `siaanUniqueCodeLegacy`: the `Uniquecode` that goes with that token.

The extension does not use these keys: it uses each advisor's own SIAAN session.

Anyone with edit access to the spreadsheet can read the token in `CONFIG_GENERAL`. Before, anyone with access to the Apps Script project could read it in the code. Protect the `CONFIG_GENERAL` range (Datos > Proteger hojas y rangos) if that matters.

To update the fallback: in the spreadsheet's Apps Script project, replace `codigo.gs` and the 6 HTML files with the ones in `legacy/`. Then run `seedConfig()` once, which adds the new `CONFIG_GENERAL` keys.
