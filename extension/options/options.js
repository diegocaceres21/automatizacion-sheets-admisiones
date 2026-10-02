import { errorText } from '../lib/errors.js';
import { clearConfigCache, loadConfig } from '../lib/configStore.js';
import { SOURCES, isSpreadsheetId, parseSpreadsheetId, resolveSpreadsheet, setOverride } from '../lib/planilla.js';
import { headerWarnings } from '../lib/registrar.js';
import { SheetsClient, chromeAuth } from '../lib/sheets.js';

const $ = (id) => document.getElementById(id);
const sheets = new SheetsClient(chromeAuth);

async function showCurrent() {
  const { id, source } = await resolveSpreadsheet({ force: true });
  const p = $('current');
  if (!id) {
    p.textContent = 'Sin planilla configurada. Avise al administrador.';
    p.className = 'current err';
    return;
  }
  const link = document.createElement('a');
  link.href = `https://docs.google.com/spreadsheets/d/${id}/edit`;
  link.target = '_blank';
  link.textContent = id;
  p.replaceChildren(link, ` · ${SOURCES[source]}`);
  p.className = source === 'override' ? 'current warn' : 'current';
  $('overrideBox').open = source === 'override';
  const { spreadsheetOverride } = await chrome.storage.sync.get('spreadsheetOverride');
  $('override').value = spreadsheetOverride || '';
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
    await clearConfigCache();
    const { spreadsheetId, source, config } = await loadConfig(sheets, { force: true });
    items.push(['ok', `Planilla ${spreadsheetId} (${SOURCES[source]}).`]);
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
  const id = parseSpreadsheetId($('override').value);
  if (!isSpreadsheetId(id)) {
    report([['err', 'Eso no parece un ID o enlace de Google Sheets.']]);
    return;
  }
  await setOverride(id);
  await clearConfigCache();
  await showCurrent();
  report([['warn', 'Este equipo usa ahora la planilla de prueba. Recuerde volver a la del administrador.']]);
});

$('clearOverride').addEventListener('click', async () => {
  await setOverride('');
  await clearConfigCache();
  await showCurrent();
  report([['ok', 'Este equipo usa la planilla definida por el administrador.']]);
});

$('test').addEventListener('click', testConnection);

showCurrent();
