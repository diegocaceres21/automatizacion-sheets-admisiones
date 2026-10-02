# Releasing a new version (admin)

Advisors install the extension unpacked (no Web Store, no Workspace admin) with `install/instalar.ps1`. They run one line in Windows+R; the script:

- installs the latest release into `%LOCALAPPDATA%AdmisionesUCBextension`, after checking its SHA-256 against `version.json`;
- creates a per-user scheduled task, "Admisiones UCB - Actualizar". It runs at logon and at 08:30 and 13:30, and installs any newer release.

The extension notices that the files on disk are newer and reloads itself (every 30 minutes, only while the side panel is closed). The panel also offers "Aplicar ahora".

Installs made from the zip by hand still get the panel's "Nueva versión … Descargar" notice instead.

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
5. Advisors who used the installer get the update at their next logon, or at 08:30/13:30. Advisors who installed by hand see "Nueva versión … disponible" within 6 hours.

The scheduled task runs a local copy of the installer (`%LOCALAPPDATA%AdmisionesUCBactualizar.ps1`). If you change `install/instalar.ps1` itself, advisors get the new script only when they run the install line again. Release updates are not affected.

### Testing the installer locally

```bash
node tests/ui/serve.js
```

Then, in another terminal (installs into a test folder, without the scheduled task or Chrome):

```bash
powershell -ExecutionPolicy Bypass -File install/instalar.ps1 -Silencioso -SinTarea -BaseUrl http://127.0.0.1:5178/releases -Carpeta "%TEMP%admisiones-prueba"
```

## Old Apps Script menu (fallback)

`legacy/codigo.gs` and the HTML forms stay installed as a fallback. They now read the SIAAN token from `CONFIG_GENERAL`:

- `siaanTokenLegacy`: the shared SIAAN token. It used to be hardcoded; the last one expired on 29/5/2026. Ask SIAAN/IT for a new one and paste it here.
- `siaanUniqueCodeLegacy`: the `Uniquecode` that goes with that token.

The extension does not use these keys: it uses each advisor's own SIAAN session.

Anyone with edit access to the spreadsheet can read the token in `CONFIG_GENERAL`. Before, anyone with access to the Apps Script project could read it in the code. Protect the `CONFIG_GENERAL` range (Datos > Proteger hojas y rangos) if that matters.

To update the fallback: in the spreadsheet's Apps Script project, replace `codigo.gs` and the 6 HTML files with the ones in `legacy/`. Then run `seedConfig()` once, which adds the new `CONFIG_GENERAL` keys.
