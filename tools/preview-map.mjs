// Gera uma imagem PNG do mapa do mundo para conferência visual.
// Uso: node tools/preview-map.mjs saida.png [escala]
import fs from 'node:fs';
import zlib from 'node:zlib';
import { buildWorld } from '../public/js/shared/world/world.js';
import { T, W, H, ZONES } from '../public/js/shared/world/defs.js';

const out = process.argv[2] || 'map.png';
const S = +process.argv[3] || 3;
const world = buildWorld();
console.log('gerado em', world.genMs, 'ms');

const COLORS = {
  [T.DEEP]: [40, 90, 170], [T.WATER]: [70, 140, 220], [T.SAND]: [236, 214, 150], [T.GRASS]: [120, 196, 92],
  [T.TALL]: [60, 150, 60], [T.PATH]: [205, 170, 110], [T.PAVE]: [190, 190, 196], [T.TREE]: [30, 100, 45],
  [T.ROCK]: [130, 110, 95], [T.CAVE]: [90, 70, 60], [T.SNOW]: [240, 245, 252], [T.SNOWTALL]: [190, 215, 230],
  [T.FLOWERS]: [230, 150, 200], [T.MARSH]: [110, 120, 70], [T.ASH]: [120, 110, 110], [T.LAVA]: [240, 90, 30],
  [T.BRIDGE]: [160, 110, 60], [T.BUILDING]: [200, 60, 60], [T.DOOR]: [255, 255, 0], [T.FENCE]: [150, 120, 80],
  [T.DESERT]: [230, 200, 130], [T.PINE]: [40, 90, 80], [T.BOULDER]: [100, 100, 100], [T.CACTUS]: [60, 140, 70],
  [T.ICE]: [180, 230, 250], [T.CITYGRASS]: [150, 210, 120], [T.ASHTALL]: [90, 80, 80], [T.PLAZA]: [220, 210, 190],
};
const img = Buffer.alloc(W * S * H * S * 3);
const put = (x, y, c) => {
  for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) {
    const o = ((y * S + dy) * W * S + x * S + dx) * 3;
    img[o] = c[0]; img[o + 1] = c[1]; img[o + 2] = c[2];
  }
};
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const c = COLORS[world.tiles[y * W + x]] || [255, 0, 255];
  let col = c;
  if (process.argv.includes('--zones')) {
    const z = world.zone[y * W + x];
    const h = (z * 2654435761) >>> 0;
    col = [(c[0] + (h & 255)) >> 1, (c[1] + ((h >> 8) & 255)) >> 1, (c[2] + ((h >> 16) & 255)) >> 1];
  }
  put(x, y, col);
}
for (const o of world.objects) {
  const col = { legend: [255, 0, 255], item: [255, 255, 255], trainer: [255, 120, 0], npc: [0, 255, 255], lamp: [255, 240, 150], sign: [120, 60, 20] }[o.kind];
  if (col) put(o.x, o.y, col);
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const w = W * S, h = H * S;
const raw = Buffer.alloc((w * 3 + 1) * h);
for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; img.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
fs.writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
const counts = {};
for (const o of world.objects) counts[o.kind] = (counts[o.kind] || 0) + 1;
let unreach = 0;
for (const b of world.buildings) if (!world.reach[(b.doorY + 1) * W + b.doorX]) unreach++;
console.log('objetos', counts, 'prédios', world.buildings.length, 'portas inalcançáveis', unreach);
