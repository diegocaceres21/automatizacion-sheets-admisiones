// Genera extension/icons/icon-{16,32,48,128}.png sin dependencias: cuadrado azul redondeado
// con una silueta de persona y un "+" (registrar estudiante). Uso: node scripts/make-icons.js
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '../extension/icons');
fs.mkdirSync(out, { recursive: true });

const BLUE = [11, 87, 208];
const WHITE = [255, 255, 255];

// Forma en coordenadas 0..1: devuelve el color del punto o null (transparente).
function shade(x, y) {
  const r = 0.2; // radio de las esquinas
  const cx = Math.min(Math.max(x, r), 1 - r);
  const cy = Math.min(Math.max(y, r), 1 - r);
  if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) return null;
  // cabeza
  if ((x - 0.42) ** 2 + (y - 0.36) ** 2 < 0.13 ** 2) return WHITE;
  // hombros: semicírculo
  if (y > 0.56 && y < 0.8 && (x - 0.42) ** 2 + (y - 0.82) ** 2 < 0.26 ** 2) return WHITE;
  // "+"
  if (Math.abs(x - 0.76) < 0.045 && Math.abs(y - 0.3) < 0.13) return WHITE;
  if (Math.abs(y - 0.3) < 0.045 && Math.abs(x - 0.76) < 0.13) return WHITE;
  return BLUE;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size) {
  const ss = 4; // supermuestreo para bordes suaves
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filtro "none"
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const c = shade((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size);
          if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
        }
      }
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw[i] = a ? r / a : 0;
      raw[i + 1] = a ? g / a : 0;
      raw[i + 2] = a ? b / a : 0;
      raw[i + 3] = (a / (ss * ss)) * 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

for (const size of [16, 32, 48, 128]) {
  fs.writeFileSync(path.join(out, `icon-${size}.png`), png(size));
}
console.log('Iconos generados en', out);
