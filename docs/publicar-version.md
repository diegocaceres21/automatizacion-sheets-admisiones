# Releasing a new version (admin)

Advisors install the extension unpacked (no Web Store, no Workspace admin). Chrome does not update it automatically. Instead, the panel compares its version with `version.json` on GitHub Pages and shows a download notice.

## One-time setup

1. Create a **public** GitHub repository for releases only, for example `admisiones-ucb-releases`. Do not push this source repo to it.
   - GitHub Pages on a private repo needs a paid plan.
   - The release zip contains no secrets: the OAuth client ID is public by design, and only `@ucb.edu.bo` accounts can sign in. It does contain the spreadsheet ID, which is useless without edit access.
2. In the repo, go to Settings > Pages > Deploy from branch `main`, folder `/`. The site URL is `https://<user>.github.io/admisiones-ucb-releases`.
3. In `CONFIG_GENERAL`, set `versionUrl` to `https://<user>.github.io/admisiones-ucb-releases/version.json`.

## Each release

1. Bump `version` in `extension/manifest.json` (for example `0.1.0` to `0.2.0`).
2. Run the tests:

   ```bash
   npm test
   ```

3. Build:

   ```bash
   node scripts/package.js --base https://<user>.github.io/admisiones-ucb-releases --spreadsheet <PRODUCTION_SPREADSHEET_ID> --notas "Qué cambió"
   ```

4. Upload `dist/admisiones-ucb-<version>.zip` and `dist/version.json` to the releases repo, replacing `version.json`. Keep old zips so old links keep working.
5. Within 6 hours, advisors see "Nueva versión … disponible" in the panel. They follow "Actualizar" in [guia-asesores.md](guia-asesores.md).

## Old Apps Script menu (fallback)

`legacy/codigo.gs` and the HTML forms stay installed as a fallback. They now read the SIAAN token from `CONFIG_GENERAL`:

- `siaanTokenLegacy`: the shared SIAAN token. It used to be hardcoded; the last one expired on 29/5/2026. Ask SIAAN/IT for a new one and paste it here.
- `siaanUniqueCodeLegacy`: the `Uniquecode` that goes with that token.

The extension does not use these keys: it uses each advisor's own SIAAN session.

Anyone with edit access to the spreadsheet can read the token in `CONFIG_GENERAL`. Before, anyone with access to the Apps Script project could read it in the code. Protect the `CONFIG_GENERAL` range (Datos > Proteger hojas y rangos) if that matters.

To update the fallback: in the spreadsheet's Apps Script project, replace `codigo.gs` and the 6 HTML files with the ones in `legacy/`. Then run `seedConfig()` once, which adds the new `CONFIG_GENERAL` keys.
