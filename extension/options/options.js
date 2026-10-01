import { errorText } from '../lib/errors.js';
import { clearConfigCache, getSpreadsheetId, loadConfig } from '../lib/configStore.js';
import { headerWarnings } from '../lib/registrar.js';
import { SheetsClient, chromeAuth } from '../lib/sheets.js';

const $ = (id) => document.getElementById(id);
const sheets = new SheetsClient(chromeAuth);

/** Acepta el ID o el enlace completo de la planilla. */
function parseSpreadsheetId(text) {
  const m = /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/.exec(text);
  return (m ? m[1] : text).trim();
}

async function save() {
  const spreadsheetId = parseSpreadsheetId($('spreadsheetId').value);
  $('spreadsheetId').value = spreadsheetId;
  await chrome.storage.sync.set({ spreadsheetId });
  await clearConfigCache();
}

function report(items) {
  $('result').hidden = false;
  $('checks').replaceChildren(...items.map(([cls, text]) => {
    const li = document.createElement('li');
    li.className = cls;
    li.textContent = text;
    return li;
  }));
}

/** Solo lectura: carga CONFIG y compara los encabezados de cada destino. */
async function testConnection() {
  const button = $('test');
  button.disabled = true;
  report([['warn', 'Probando…']]);
  const items = [];
  try {
    await save();
    const { spreadsheetId, config } = await loadConfig(sheets, { force: true });
    items.push(['ok', `CONFIG v${config.version} leída: ${config.destinos.length} destinos, ${Object.keys(config.listas).length} listas.`]);
    for (const d of config.destinos.filter((x) => x.activo)) {
      try {
        const warnings = await headerWarnings(sheets, spreadsheetId, config, d);
        items.push(warnings.length ? ['warn', `${d.hoja}:\n${warnings.join('\n')}`] : ['ok', `${d.hoja}: encabezados correctos.`]);
      } catch (e) {
        items.push(['err', `${d.hoja}: ${errorText(e)}`]);
      }
    }
    const g = config.general;
    try {
      await sheets.get(g.incentivosSpreadsheetId, `'${g.incentivosHoja}'!A1`);
      items.push(['ok', 'Planilla de incentivos accesible.']);
    } catch (e) {
      items.push(['err', `Planilla de incentivos: ${errorText(e)}`]);
    }
  } catch (e) {
    items.push(['err', errorText(e)]);
  }
  report(items);
  button.disabled = false;
}

$('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await save();
  report([['ok', 'Guardado.']]);
});
$('test').addEventListener('click', testConnection);

getSpreadsheetId().then((spreadsheetId) => {
  $('spreadsheetId').value = spreadsheetId;
});
