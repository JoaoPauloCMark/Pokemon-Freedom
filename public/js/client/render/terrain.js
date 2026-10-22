// Desenho do terreno em "chunks" pré-renderizados (camadas com bordas arredondadas).
import { T, W, H } from '../../shared/world/defs.js';
import { hash2 } from '../../shared/rng.js';
import { shade, rgba, makeCanvas } from './color.js';

export const TS = 48;
export const CHUNK = 12;

// Camadas de chão
const L = { SAND: 1, GRASS: 2, DESERT: 3, SNOW: 4, ASH: 5, MARSH: 6, CAVE: 7, PATH: 8, PAVE: 9, PLAZA: 10, CITY: 11 };

const PAL = {
  deep: '#2f6fc4', shallow: '#4fa9e8', foam: '#e9f7ff',
  sand: '#efd9a0', grass: '#7cc45a', city: '#86cf62', desert: '#e7c784', snow: '#f1f5fb', ash: '#8b8384',
  marsh: '#7c8250', cave: '#7d6958', path: '#d8b77f', pave: '#cfcdc8', plaza: '#e3d5bb',
  rockTop: '#a8977f', rockFace: '#6b5c4e',
};

function underlay(t, g) {
  switch (t) {
    case T.DEEP: case T.WATER: case T.BRIDGE: return 0;
    case T.SAND: return L.SAND;
    case T.GRASS: case T.TALL: case T.FLOWERS: case T.TREE: return L.GRASS;
    case T.CITYGRASS: return L.CITY;
    case T.DESERT: case T.CACTUS: return L.DESERT;
    case T.SNOW: case T.SNOWTALL: case T.PINE: case T.ICE: return L.SNOW;
    case T.ASH: case T.ASHTALL: case T.LAVA: return L.ASH;
    case T.MARSH: return L.MARSH;
    case T.CAVE: return L.CAVE;
    case T.ROCK: return -1;
    default:
      if (g === T.SNOW) return L.SNOW;
      if (g === T.DESERT) return L.DESERT;
      if (g === T.ASH) return L.ASH;
      if (g === T.SAND) return L.SAND;
      if (g === T.MARSH) return L.MARSH;
      if (g === T.CITYGRASS) return L.CITY;
      return L.GRASS;
  }
}

export class Terrain {
  constructor(world, pr) {
    this.world = world;
    this.pr = pr;
    this.chunks = new Map();
    this.order = [];
    this.maxChunks = 48;
    // camada base por tile (pré-calculada)
    this.under = new Int8Array(W * H);
    for (let i = 0; i < W * H; i++) this.under[i] = underlay(world.tiles[i], world.ground[i]);
  }

  t(x, y) { return x < 0 || y < 0 || x >= W || y >= H ? T.DEEP : this.world.tiles[y * W + x]; }
  u(x, y) { return x < 0 || y < 0 || x >= W || y >= H ? 0 : this.under[y * W + x]; }

  get(cx, cy) {
    const key = cx + ',' + cy;
    let c = this.chunks.get(key);
    if (c) return c;
    c = this.render(cx, cy);
    this.chunks.set(key, c);
    this.order.push(key);
    if (this.order.length > this.maxChunks) this.chunks.delete(this.order.shift());
    return c;
  }

  has(cx, cy) { return this.chunks.has(cx + ',' + cy); }

  render(cx, cy) {
    const S = TS * this.pr;
    const can = makeCanvas(CHUNK * S, CHUNK * S);
    const ctx = can.getContext('2d');
    ctx.scale(this.pr, this.pr);
    const x0 = cx * CHUNK, y0 = cy * CHUNK;
    const tiles = [];
    for (let y = y0; y < y0 + CHUNK; y++) for (let x = x0; x < x0 + CHUNK; x++) tiles.push([x, y]);
    const px = (x) => (x - x0) * TS, py = (y) => (y - y0) * TS;

    // ---- água profunda com variação
    for (const [x, y] of tiles) {
      const n = hash2(x >> 1, y >> 1, 5) * 0.06 + hash2(x, y, 6) * 0.03;
      ctx.fillStyle = shade(PAL.deep, n - 0.04);
      ctx.fillRect(px(x), py(y), TS + 0.5, TS + 0.5);
    }
    // ---- água rasa (tudo que não é profundo)
    this.blob(ctx, tiles, (x, y) => this.t(x, y) !== T.DEEP, PAL.shallow, null, 18, px, py);
    // ---- espuma ao redor da terra
    const land = (x, y) => this.u(x, y) !== 0;
    this.outline(ctx, tiles, land, rgba(PAL.foam, 0.75), 6, 16, px, py);
    // ---- camadas de terra
    const layer = (id, color, rim, r = 16) => this.blob(ctx, tiles, (x, y) => this.u(x, y) === id || (id === L.SAND && this.u(x, y) !== 0), color, rim, r, px, py);
    layer(L.SAND, PAL.sand, shade(PAL.sand, -0.12));
    layer(L.GRASS, PAL.grass, shade(PAL.grass, -0.2));
    layer(L.CITY, PAL.city, shade(PAL.city, -0.18), 10);
    layer(L.DESERT, PAL.desert, shade(PAL.desert, -0.12));
    layer(L.MARSH, PAL.marsh, shade(PAL.marsh, -0.2));
    layer(L.ASH, PAL.ash, shade(PAL.ash, -0.2));
    // lava em poças contínuas
    this.blob(ctx, tiles, (x, y) => this.t(x, y) === T.LAVA, '#ff8a2b', '#5a2a1e', 18, px, py);
    layer(L.SNOW, PAL.snow, '#c9d6e6');
    layer(L.CAVE, PAL.cave, shade(PAL.cave, -0.25), 10);
    // caminhos e calçadas
    this.blob(ctx, tiles, (x, y) => this.t(x, y) === T.PATH, PAL.path, shade(PAL.path, -0.18), 14, px, py);
    this.blob(ctx, tiles, (x, y) => { const t = this.t(x, y); return t === T.PAVE || t === T.DOOR || t === T.PLAZA; }, PAL.pave, shade(PAL.pave, -0.2), 6, px, py);

    // ---- detalhes por tile
    for (const [x, y] of tiles) this.detail(ctx, x, y, px(x), py(y));
    // ---- montanhas por cima
    for (const [x, y] of tiles) if (this.t(x, y) === T.ROCK) this.rock(ctx, x, y, px(x), py(y));
    // sombra de penhasco sobre o tile de baixo
    for (const [x, y] of tiles) {
      if (this.t(x, y) !== T.ROCK && this.t(x, y - 1) === T.ROCK) {
        const g = ctx.createLinearGradient(0, py(y), 0, py(y) + TS * 0.5);
        g.addColorStop(0, 'rgba(20,10,0,0.32)');
        g.addColorStop(1, 'rgba(20,10,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(px(x), py(y), TS, TS * 0.5);
      }
    }
    return can;
  }

  // Preenche os tiles do conjunto com cantos externos arredondados e cantos internos suavizados.
  blob(ctx, tiles, inSet, color, rim, r, px, py) {
    ctx.fillStyle = color;
    const path = new Path2D();
    const fil = new Path2D();
    let any = false;
    for (const [x, y] of tiles) {
      const X = px(x), Y = py(y);
      if (inSet(x, y)) {
        any = true;
        const up = inSet(x, y - 1), dn = inSet(x, y + 1), lf = inSet(x - 1, y), rt = inSet(x + 1, y);
        const tl = !up && !lf ? r : 0, tr = !up && !rt ? r : 0, br = !dn && !rt ? r : 0, bl = !dn && !lf ? r : 0;
        path.moveTo(X + tl, Y);
        path.lineTo(X + TS - tr, Y);
        if (tr) path.arcTo(X + TS, Y, X + TS, Y + tr, tr); else path.lineTo(X + TS, Y);
        path.lineTo(X + TS, Y + TS - br);
        if (br) path.arcTo(X + TS, Y + TS, X + TS - br, Y + TS, br); else path.lineTo(X + TS, Y + TS);
        path.lineTo(X + bl, Y + TS);
        if (bl) path.arcTo(X, Y + TS, X, Y + TS - bl, bl); else path.lineTo(X, Y + TS);
        path.lineTo(X, Y + tl);
        if (tl) path.arcTo(X, Y, X + tl, Y, tl); else path.lineTo(X, Y);
        path.closePath();
      } else {
        // filetes côncavos nos cantos internos
        const up = inSet(x, y - 1), dn = inSet(x, y + 1), lf = inSet(x - 1, y), rt = inSet(x + 1, y);
        if (up && lf) { fil.moveTo(X, Y); fil.lineTo(X + r, Y); fil.arc(X + r, Y + r, r, -Math.PI / 2, Math.PI, true); fil.closePath(); }
        if (up && rt) { fil.moveTo(X + TS, Y); fil.lineTo(X + TS, Y + r); fil.arc(X + TS - r, Y + r, r, 0, -Math.PI / 2, true); fil.closePath(); }
        if (dn && rt) { fil.moveTo(X + TS, Y + TS); fil.lineTo(X + TS - r, Y + TS); fil.arc(X + TS - r, Y + TS - r, r, Math.PI / 2, 0, true); fil.closePath(); }
        if (dn && lf) { fil.moveTo(X, Y + TS); fil.lineTo(X, Y + TS - r); fil.arc(X + r, Y + TS - r, r, Math.PI, Math.PI / 2, true); fil.closePath(); }
      }
    }
    if (!any) return;
    ctx.fill(path);
    ctx.fill(fil);
    if (rim) this.outline(ctx, tiles, inSet, rim, 2.5, r, px, py);
  }

  // Contorno da borda do conjunto (somente nas bordas externas).
  outline(ctx, tiles, inSet, color, width, r, px, py) {
    const p = new Path2D();
    for (const [x, y] of tiles) {
      const X = px(x), Y = py(y);
      const s = inSet(x, y);
      const up = inSet(x, y - 1), dn = inSet(x, y + 1), lf = inSet(x - 1, y), rt = inSet(x + 1, y);
      if (s) {
        const tl = !up && !lf ? r : 0, tr = !up && !rt ? r : 0, br = !dn && !rt ? r : 0, bl = !dn && !lf ? r : 0;
        const ul = inSet(x - 1, y - 1), ur = inSet(x + 1, y - 1), dl = inSet(x - 1, y + 1), dr = inSet(x + 1, y + 1);
        // cada lado é encurtado onde o vizinho tem um filete côncavo
        if (!up) { p.moveTo(X + Math.max(tl, ul ? r : 0), Y); p.lineTo(X + TS - Math.max(tr, ur ? r : 0), Y); }
        if (!rt) { p.moveTo(X + TS, Y + Math.max(tr, ur ? r : 0)); p.lineTo(X + TS, Y + TS - Math.max(br, dr ? r : 0)); }
        if (!dn) { p.moveTo(X + TS - Math.max(br, dr ? r : 0), Y + TS); p.lineTo(X + Math.max(bl, dl ? r : 0), Y + TS); }
        if (!lf) { p.moveTo(X, Y + TS - Math.max(bl, dl ? r : 0)); p.lineTo(X, Y + Math.max(tl, ul ? r : 0)); }
        if (tl) { p.moveTo(X, Y + tl); p.arcTo(X, Y, X + tl, Y, tl); }
        if (tr) { p.moveTo(X + TS - tr, Y); p.arcTo(X + TS, Y, X + TS, Y + tr, tr); }
        if (br) { p.moveTo(X + TS, Y + TS - br); p.arcTo(X + TS, Y + TS, X + TS - br, Y + TS, br); }
        if (bl) { p.moveTo(X + bl, Y + TS); p.arcTo(X, Y + TS, X, Y + TS - bl, bl); }
      } else {
        if (up && lf) { p.moveTo(X + r, Y); p.arc(X + r, Y + r, r, -Math.PI / 2, Math.PI, true); }
        if (up && rt) { p.moveTo(X + TS, Y + r); p.arc(X + TS - r, Y + r, r, 0, -Math.PI / 2, true); }
        if (dn && rt) { p.moveTo(X + TS - r, Y + TS); p.arc(X + TS - r, Y + TS - r, r, Math.PI / 2, 0, true); }
        if (dn && lf) { p.moveTo(X, Y + TS - r); p.arc(X + r, Y + TS - r, r, Math.PI, Math.PI / 2, true); }
      }
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.stroke(p);
  }

  detail(ctx, x, y, X, Y) {
    const t = this.t(x, y);
    const h = (k) => hash2(x, y, k);
    switch (t) {
      case T.GRASS: case T.TREE: {
        ctx.strokeStyle = shade(PAL.grass, -0.22);
        ctx.lineWidth = 1.6;
        const n = 2 + Math.floor(h(1) * 3);
        for (let i = 0; i < n; i++) tuft(ctx, X + 6 + h(10 + i) * (TS - 12), Y + 8 + h(20 + i) * (TS - 14), 3 + h(30 + i) * 2);
        if (h(2) < 0.07 && t === T.GRASS) flowers(ctx, X, Y, x, y, 2);
        if (h(3) < 0.05) { ctx.fillStyle = shade(PAL.grass, 0.18); ctx.beginPath(); ctx.ellipse(X + h(4) * TS, Y + h(5) * TS, 6, 3, 0, 0, Math.PI * 2); ctx.fill(); }
        break;
      }
      case T.CITYGRASS: {
        ctx.fillStyle = rgba('#ffffff', (x + y) % 2 ? 0.035 : 0);
        ctx.fillRect(X, Y, TS, TS);
        ctx.strokeStyle = shade(PAL.city, -0.18);
        ctx.lineWidth = 1.4;
        tuft(ctx, X + 8 + h(1) * 30, Y + 10 + h(2) * 28, 3);
        if (h(3) < 0.12) flowers(ctx, X, Y, x, y, 3);
        break;
      }
      case T.TALL: tallGrass(ctx, X, Y, x, y, ['#3b8a39', '#4f9f45', '#69bb55', '#8fd56d']); break;
      case T.SNOWTALL: tallGrass(ctx, X, Y, x, y, ['#8fb4cc', '#a8c8dc', '#c4dcea', '#e6f2fa']); break;
      case T.ASHTALL: tallGrass(ctx, X, Y, x, y, ['#4c4446', '#5e5557', '#776d6f', '#958b8c']); break;
      case T.FLOWERS: {
        ctx.strokeStyle = shade(PAL.grass, -0.22); ctx.lineWidth = 1.5;
        tuft(ctx, X + 10, Y + 30, 3); tuft(ctx, X + 34, Y + 12, 3);
        flowers(ctx, X, Y, x, y, 5 + Math.floor(h(9) * 3));
        break;
      }
      case T.SAND: {
        ctx.fillStyle = shade(PAL.sand, -0.1);
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(X + h(i) * TS, Y + h(i + 9) * TS, 1.3, 0, Math.PI * 2); ctx.fill(); }
        if (h(30) < 0.25) { ctx.strokeStyle = shade(PAL.sand, -0.07); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X + 24, Y + 40, 14, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
        if (h(31) < 0.03) shell(ctx, X + 10 + h(32) * 26, Y + 10 + h(33) * 26, h(34));
        break;
      }
      case T.DESERT: {
        ctx.strokeStyle = shade(PAL.desert, -0.1); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(X + 4, Y + 18 + h(1) * 8); ctx.quadraticCurveTo(X + 24, Y + 10 + h(2) * 8, X + 44, Y + 20 + h(3) * 8); ctx.stroke();
        ctx.fillStyle = shade(PAL.desert, -0.2);
        if (h(4) < 0.3) { ctx.beginPath(); ctx.ellipse(X + h(5) * 40 + 4, Y + h(6) * 40 + 4, 3, 2, 0, 0, Math.PI * 2); ctx.fill(); }
        break;
      }
      case T.SNOW: case T.PINE: {
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(X + h(i) * TS, Y + h(i + 5) * TS, 1.2, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = 'rgba(160,185,215,0.25)';
        if (h(10) < 0.3) { ctx.beginPath(); ctx.ellipse(X + 24, Y + 30, 16, 6, 0, 0, Math.PI * 2); ctx.fill(); }
        break;
      }
      case T.ASH: {
        ctx.fillStyle = shade(PAL.ash, -0.25);
        for (let i = 0; i < 5; i++) ctx.fillRect(X + h(i) * TS, Y + h(i + 7) * TS, 2, 2);
        break;
      }
      case T.MARSH: {
        ctx.fillStyle = '#5b6a52';
        if (h(1) < 0.5) { ctx.beginPath(); ctx.ellipse(X + 14 + h(2) * 20, Y + 14 + h(3) * 20, 10, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(160,200,230,0.35)'; ctx.beginPath(); ctx.ellipse(X + 12 + h(2) * 20, Y + 12 + h(3) * 20, 5, 2, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.strokeStyle = '#4a5a2c'; ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) { const rx = X + 8 + h(10 + i) * 32, ry = Y + 40; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + (h(20 + i) - 0.5) * 6, ry - 14 - h(30 + i) * 10); ctx.stroke(); }
        break;
      }
      case T.PATH: {
        ctx.fillStyle = shade(PAL.path, -0.16);
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(X + 6 + h(i) * 36, Y + 6 + h(i + 4) * 36, 2.5, 1.8, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = shade(PAL.path, 0.12);
        ctx.beginPath(); ctx.ellipse(X + h(9) * 40 + 4, Y + h(8) * 40 + 4, 2, 1.4, 0, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case T.PAVE: case T.DOOR: {
        ctx.strokeStyle = 'rgba(120,115,108,0.35)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(X, Y + TS / 2); ctx.lineTo(X + TS, Y + TS / 2);
        const off = (y % 2) * TS / 2;
        ctx.moveTo(X + ((off + TS / 4) % TS), Y); ctx.lineTo(X + ((off + TS / 4) % TS), Y + TS / 2);
        ctx.moveTo(X + ((off + TS * 3 / 4) % TS), Y + TS / 2); ctx.lineTo(X + ((off + TS * 3 / 4) % TS), Y + TS);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(X + 2, Y + 2, TS / 2 - 4, 3);
        break;
      }
      case T.PLAZA: {
        ctx.fillStyle = PAL.plaza;
        ctx.fillRect(X, Y, TS, TS);
        ctx.strokeStyle = 'rgba(160,130,90,0.4)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(X + TS / 2, Y); ctx.lineTo(X + TS, Y + TS / 2); ctx.lineTo(X + TS / 2, Y + TS); ctx.lineTo(X, Y + TS / 2); ctx.closePath(); ctx.stroke();
        ctx.fillStyle = 'rgba(200,150,90,0.25)';
        ctx.beginPath(); ctx.arc(X + TS / 2, Y + TS / 2, 5, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case T.CAVE: {
        ctx.fillStyle = shade(PAL.cave, -0.18);
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(X + h(i) * 40 + 4, Y + h(i + 3) * 40 + 4, 3 + h(i + 6) * 3, 2, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.strokeStyle = shade(PAL.cave, -0.3); ctx.lineWidth = 1;
        if (h(20) < 0.2) { ctx.beginPath(); ctx.moveTo(X + 8, Y + 30); ctx.lineTo(X + 20, Y + 26); ctx.lineTo(X + 26, Y + 34); ctx.stroke(); }
        break;
      }
      case T.LAVA: {
        // brilhos amarelos e crostas escuras dentro da poça
        const g = ctx.createRadialGradient(X + TS * h(1), Y + TS * h(2), 2, X + TS / 2, Y + TS / 2, TS * 0.7);
        g.addColorStop(0, 'rgba(255,236,140,0.9)'); g.addColorStop(1, 'rgba(255,140,40,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(X + TS / 2, Y + TS / 2, TS * 0.45, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(120,40,20,0.55)';
        if (h(3) < 0.5) { ctx.beginPath(); ctx.ellipse(X + 8 + h(4) * 30, Y + 8 + h(5) * 30, 6, 3, h(6) * 3, 0, Math.PI * 2); ctx.fill(); }
        break;
      }
      case T.BRIDGE: {
        const horiz = this.t(x - 1, y) === T.BRIDGE || this.t(x + 1, y) === T.BRIDGE || (this.u(x - 1, y) && this.u(x + 1, y));
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(X + 3, Y + 6, TS, TS);
        ctx.fillStyle = '#b8814b';
        ctx.fillRect(X, Y, TS, TS);
        ctx.strokeStyle = '#8a5a30'; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= 4; i++) {
          if (horiz) { ctx.moveTo(X + i * TS / 4, Y); ctx.lineTo(X + i * TS / 4, Y + TS); }
          else { ctx.moveTo(X, Y + i * TS / 4); ctx.lineTo(X + TS, Y + i * TS / 4); }
        }
        ctx.stroke();
        ctx.fillStyle = '#7a4c27';
        if (horiz) { ctx.fillRect(X, Y, TS, 5); ctx.fillRect(X, Y + TS - 5, TS, 5); }
        else { ctx.fillRect(X, Y, 5, TS); ctx.fillRect(X + TS - 5, Y, 5, TS); }
        break;
      }
      default: break;
    }
  }

  rock(ctx, x, y, X, Y) {
    const isR = (a, b) => this.t(a, b) === T.ROCK;
    const up = isR(x, y - 1), dn = isR(x, y + 1), lf = isR(x - 1, y), rt = isR(x + 1, y);
    const h = (k) => hash2(x, y, k);
    // topo
    const top = shade(PAL.rockTop, (h(1) - 0.5) * 0.08);
    ctx.fillStyle = top;
    const r = 12;
    ctx.beginPath();
    const tl = !up && !lf ? r : 0, tr = !up && !rt ? r : 0, br = !dn && !rt ? r : 0, bl = !dn && !lf ? r : 0;
    ctx.moveTo(X + tl, Y); ctx.lineTo(X + TS - tr, Y); ctx.quadraticCurveTo(X + TS, Y, X + TS, Y + tr);
    ctx.lineTo(X + TS, Y + TS - br); ctx.quadraticCurveTo(X + TS, Y + TS, X + TS - br, Y + TS);
    ctx.lineTo(X + bl, Y + TS); ctx.quadraticCurveTo(X, Y + TS, X, Y + TS - bl);
    ctx.lineTo(X, Y + tl); ctx.quadraticCurveTo(X, Y, X + tl, Y);
    ctx.fill();
    // textura
    ctx.fillStyle = shade(PAL.rockTop, -0.12);
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(X + 6 + h(i + 2) * 36, Y + 6 + h(i + 6) * 26, 4 + h(i + 9) * 4, 2.5, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = shade(PAL.rockTop, 0.15);
    ctx.beginPath(); ctx.ellipse(X + 10 + h(12) * 28, Y + 8 + h(13) * 18, 5, 2, 0, 0, Math.PI * 2); ctx.fill();
    if (!up) { ctx.fillStyle = shade(PAL.rockTop, 0.22); ctx.fillRect(X + tl, Y, TS - tl - tr, 3); }
    if (!lf) { ctx.fillStyle = shade(PAL.rockTop, -0.15); ctx.fillRect(X, Y + tl, 3, TS - tl - bl); }
    if (!rt) { ctx.fillStyle = shade(PAL.rockTop, -0.2); ctx.fillRect(X + TS - 3, Y + tr, 3, TS - tr - br); }
    // face do penhasco
    if (!dn) {
      const fy = Y + TS * 0.42;
      const g = ctx.createLinearGradient(0, fy, 0, Y + TS);
      g.addColorStop(0, shade(PAL.rockFace, 0.08));
      g.addColorStop(1, shade(PAL.rockFace, -0.25));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(X + (lf ? 0 : 4), fy);
      ctx.lineTo(X + TS - (rt ? 0 : 4), fy);
      ctx.lineTo(X + TS - (rt ? 0 : 6), Y + TS - 2);
      ctx.quadraticCurveTo(X + TS / 2, Y + TS + 2, X + (lf ? 0 : 6), Y + TS - 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = shade(PAL.rockFace, -0.35); ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) { const cx = X + 8 + h(20 + i) * 32; ctx.moveTo(cx, fy + 4); ctx.lineTo(cx + (h(30 + i) - 0.5) * 6, Y + TS - 4); }
      ctx.stroke();
      ctx.fillStyle = shade(PAL.rockTop, 0.25);
      ctx.fillRect(X + (lf ? 0 : 4), fy - 1, TS - (lf ? 0 : 4) - (rt ? 0 : 4), 2);
    }
  }
}

// ------------------------------------------------------------ pequenos desenhos
function tuft(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x - s, y - s * 0.6); ctx.lineTo(x - s * 0.3, y + s * 0.6);
  ctx.moveTo(x, y - s * 1.1); ctx.lineTo(x, y + s * 0.6);
  ctx.moveTo(x + s, y - s * 0.6); ctx.lineTo(x + s * 0.3, y + s * 0.6);
  ctx.stroke();
}

const FLOWER_COLORS = ['#ff5f7e', '#ffd34d', '#ffffff', '#ff9ad5', '#b58cff', '#ff8a3d'];
function flowers(ctx, X, Y, x, y, n) {
  for (let i = 0; i < n; i++) {
    const fx = X + 6 + hash2(x, y, 40 + i) * (TS - 12), fy = Y + 6 + hash2(x, y, 50 + i) * (TS - 12);
    const c = FLOWER_COLORS[Math.floor(hash2(x, y, 60 + i) * FLOWER_COLORS.length)];
    ctx.fillStyle = c;
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      ctx.beginPath(); ctx.arc(fx + Math.cos(a) * 2.6, fy + Math.sin(a) * 2.6, 2.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#ffe9a0';
    ctx.beginPath(); ctx.arc(fx, fy, 1.6, 0, Math.PI * 2); ctx.fill();
  }
}

function shell(ctx, x, y, r) {
  ctx.fillStyle = r < 0.5 ? '#ffd0c4' : '#f6f0e4';
  ctx.beginPath(); ctx.arc(x, y, 4, Math.PI, 0); ctx.lineTo(x, y + 3); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(160,100,80,0.5)'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(x, y + 3); ctx.lineTo(x - 2, y - 3); ctx.moveTo(x, y + 3); ctx.lineTo(x + 2, y - 3); ctx.stroke();
}

export function tallGrass(ctx, X, Y, x, y, cols, front = false) {
  const rows = front ? [0.62, 0.86] : [0.3, 0.55, 0.8, 1.02];
  rows.forEach((ry, ri) => {
    const n = 4;
    for (let i = 0; i < n; i++) {
      const bx = X + (i + 0.5 + ((ri % 2) ? 0.5 : 0)) * (TS / n) - TS / (2 * n) + (hash2(x, y, ri * 10 + i) - 0.5) * 4;
      const by = Y + ry * TS;
      const hgt = TS * (0.32 + hash2(x, y, ri * 10 + i + 5) * 0.12);
      const w = TS / n * 0.62;
      const c = cols[Math.min(cols.length - 1, ri % cols.length)];
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(bx - w, by);
      ctx.quadraticCurveTo(bx - w * 0.6, by - hgt * 0.6, bx - w * 0.15, by - hgt);
      ctx.quadraticCurveTo(bx, by - hgt * 0.5, bx + w * 0.1, by - hgt * 0.95);
      ctx.quadraticCurveTo(bx + w * 0.5, by - hgt * 0.55, bx + w * 0.55, by - hgt * 0.85);
      ctx.quadraticCurveTo(bx + w * 0.8, by - hgt * 0.4, bx + w, by);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = cols[3];
      ctx.beginPath(); ctx.moveTo(bx - w * 0.2, by - hgt * 0.75); ctx.lineTo(bx - w * 0.05, by - hgt * 0.92); ctx.lineTo(bx + w * 0.05, by - hgt * 0.7); ctx.fill();
    }
  });
}

export const TALL_COLORS = {
  [T.TALL]: ['#3b8a39', '#4f9f45', '#69bb55', '#8fd56d'],
  [T.SNOWTALL]: ['#8fb4cc', '#a8c8dc', '#c4dcea', '#e6f2fa'],
  [T.ASHTALL]: ['#4c4446', '#5e5557', '#776d6f', '#958b8c'],
  [T.FLOWERS]: null,
};

// Frames animados de brilho da água (desenhados por cima do chunk).
const waterFrames = [];
export function waterFrame(i, pr) {
  const k = i % 16;
  if (!waterFrames[k]) {
    const c = makeCanvas(TS * pr, TS * pr);
    const ctx = c.getContext('2d');
    ctx.scale(pr, pr);
    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    const ph = (k / 16) * Math.PI * 2;
    for (let j = 0; j < 2; j++) {
      const cx = 12 + j * 22 + Math.sin(ph + j * 2) * 4;
      const cy = 14 + j * 20 + Math.cos(ph + j) * 3;
      const len = 6 + Math.sin(ph * 2 + j) * 3;
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(ph + j * 1.7);
      ctx.beginPath(); ctx.moveTo(cx - len, cy); ctx.quadraticCurveTo(cx, cy - 3, cx + len, cy); ctx.stroke();
    }
    waterFrames[k] = c;
  }
  return waterFrames[k];
}
