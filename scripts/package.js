// Empaqueta extension/ en dist/admisiones-ucb-<versión>.zip y genera dist/version.json para GitHub Pages.
// Uso: node scripts/package.js --base https://<usuario>.github.io/<repo> --spreadsheet <ID> [--notas "Qué cambió"]
// --spreadsheet agrega defaults.json al ZIP: el asesor no necesita pegar el ID de la planilla.
// Sin dependencias: escribe el ZIP a mano (deflate de node:zlib).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'extension');
const dist = path.join(root, 'dist');

const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : ''; };
const base = arg('--base').replace(/\/+$/, '');
const notas = arg('--notas');
const spreadsheetId = arg('--spreadsheet');

const manifest = JSON.parse(fs.readFileSync(path.join(src, 'manifest.json'), 'utf8'));
const version = manifest.version;
const zipName = `admisiones-ucb-${version}.zip`;

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? listFiles(full) : [full];
  });
}

const files = listFiles(src).filter((f) => !/\.(pem|crx|zip)$/i.test(f));
if (files.some((f) => /client_secret|\.pem$/i.test(f))) throw new Error('Archivo de credenciales dentro de extension/');

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

// Todo dentro de una carpeta "admisiones-ucb/" para que al descomprimir quede una sola carpeta.
const entries = [];
const chunks = [];
let offset = 0;
const contents = files.map((file) => [path.relative(src, file).split(path.sep).join('/'), fs.readFileSync(file)]);
if (spreadsheetId) contents.push(['defaults.json', Buffer.from(JSON.stringify({ spreadsheetId }) + '\n')]);
for (const [rel, data] of contents) {
  const name = Buffer.from('admisiones-ucb/' + rel);
  const comp = zlib.deflateRawSync(data, { level: 9 });
  const crc = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);       // versión necesaria
  local.writeUInt16LE(0x0800, 6);   // nombres en UTF-8
  local.writeUInt16LE(8, 8);        // deflate
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(comp.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  chunks.push(local, name, comp);
  entries.push({ name, crc, comp: comp.length, size: data.length, offset });
  offset += local.length + name.length + comp.length;
}
const central = entries.map((e) => {
  const h = Buffer.alloc(46);
  h.writeUInt32LE(0x02014b50, 0);
  h.writeUInt16LE(20, 4);
  h.writeUInt16LE(20, 6);
  h.writeUInt16LE(0x0800, 8);
  h.writeUInt16LE(8, 10);
  h.writeUInt32LE(e.crc, 16);
  h.writeUInt32LE(e.comp, 20);
  h.writeUInt32LE(e.size, 24);
  h.writeUInt16LE(e.name.length, 28);
  h.writeUInt32LE(e.offset, 42);
  return Buffer.concat([h, e.name]);
});
const centralBuf = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(entries.length, 8);
end.writeUInt16LE(entries.length, 10);
end.writeUInt32LE(centralBuf.length, 12);
end.writeUInt32LE(offset, 16);

fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, zipName), Buffer.concat([...chunks, centralBuf, end]));

const info = { version, url: base ? `${base}/${zipName}` : zipName, notas, fecha: new Date().toISOString().slice(0, 10) };
fs.writeFileSync(path.join(dist, 'version.json'), JSON.stringify(info, null, 2) + '\n');

console.log(`dist/${zipName} (${contents.length} archivos)${spreadsheetId ? ', con defaults.json' : ''}`);
if (!spreadsheetId) console.log('Aviso: sin --spreadsheet, cada asesor debe pegar el ID de la planilla en Opciones.');
console.log('dist/version.json', info);
if (!base) console.log('Aviso: sin --base, la URL de version.json es relativa. Use --base https://<usuario>.github.io/<repo>');
