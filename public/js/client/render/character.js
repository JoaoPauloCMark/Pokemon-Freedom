// Personagens em pixel art (estilo dos sprites de treinador modernos de Pokémon).
// Cada quadro é desenhado num buffer de pixels de baixa resolução, peça por peça:
//   - cada peça recebe sombreamento em 4 tons (luz vinda de cima/esquerda);
//   - o contorno é seletivo: linhas internas na cor escura do próprio material e
//     contorno externo (silhueta) quase preto;
//   - no fim o buffer é ampliado por um fator inteiro sem suavização.
//   quadro do mapa: 28x44 px nativos (exibido em CW x CH = 56 x 88)
//   retrato grande: 80x144 px nativos (criação, batalha, cartão, boutique)
// Direções: 0 = cima (costas), 1 = direita, 2 = baixo (frente), 3 = esquerda.
// Quadros 0..3 (0 = parado, 1 e 3 = passos, 2 = passagem). Modos: 'walk' | 'run' | 'bike' | 'surf'.
import { SKINS, EYES, CLOTHES } from '../../shared/data/clothes.js';
import { makeCanvas } from './color.js';
import { TS } from './terrain.js';

const OW_W = 28, OW_H = 44;   // quadro do mapa (px nativos)
const PT_W = 80, PT_H = 144;  // retrato (px nativos)
const NPX = TS / 24;          // px lógicos por px nativo no mapa (2)
export const CW = OW_W * NPX;   // 56
export const CH = OW_H * NPX;   // 88

let PR = 1;
const cache = new Map();
const ptCache = new Map();
export function setCharPR(pr) { PR = pr || 1; cache.clear(); }

const SLOTS = ['hat', 'top', 'bottom', 'shoes', 'acc', 'back'];
function lookKey(look) {
  return [look.body, look.skin, look.eyes, look.hair, look.hairColor, ...SLOTS.map((s) => look[s])].join('|');
}
function lru(map, key, val, max) {
  map.set(key, val);
  if (map.size > max) map.delete(map.keys().next().value);
  return val;
}

// Retorna o canvas (já ampliado) de um quadro do mapa.
export function charFrame(look, dir, frame, mode = 'walk') {
  look = look || {};
  const key = lookKey(look) + `#${dir & 3}${frame & 3}${mode}`;
  let c = cache.get(key);
  if (c) { cache.delete(key); cache.set(key, c); return c; }
  c = toCanvas(owPix(look, dir & 3, frame & 3, mode), Math.max(1, Math.round(NPX * PR)));
  return lru(cache, key, c, 2000);
}

// Retrato grande de corpo inteiro, encaixado e centralizado em qualquer canvas.
export function drawPortrait(canvas, look, dir = 2, frame = 0, mode = 'walk') {
  look = look || {};
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  let src;
  if (mode && mode !== 'walk') src = toCanvas(owPix(look, dir & 3, frame & 3, mode), 1);
  else {
    const d = dir & 3;
    const key = lookKey(look) + '#' + d;
    src = ptCache.get(key);
    if (src) { ptCache.delete(key); ptCache.set(key, src); }
    else src = lru(ptCache, key, toCanvas(ptPix(look, d), 1), 120);
  }
  blitFit(ctx, src, canvas.width, canvas.height);
}

// Encaixa mantendo a proporção: escala inteira quando cabe; quando a escala inteira
// deixaria a figura pequena demais, amplia nítido ao inteiro de cima e reduz suave.
function blitFit(ctx, src, W, H) {
  const pad = Math.max(1, Math.round(Math.min(W, H) * 0.02));
  const s = Math.min(W / src.width, (H - pad) / src.height);
  let img = src, sw = src.width, sh = src.height, scale = s;
  if (s >= 1) {
    const fl = Math.floor(s);
    if (fl / s >= 0.84) { scale = fl; ctx.imageSmoothingEnabled = false; }
    else {
      const up = Math.ceil(s);
      img = makeCanvas(src.width * up, src.height * up);
      const g = img.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.drawImage(src, 0, 0, img.width, img.height);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      sw = img.width; sh = img.height; scale = s;
    }
  } else { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; }
  const w = Math.round(src.width * scale), h = Math.round(src.height * scale);
  ctx.drawImage(img, 0, 0, sw, sh, Math.floor((W - w) / 2), Math.max(0, H - pad - h), w, h);
  ctx.imageSmoothingEnabled = true;
}

// ================================================================== buffer de pixels
class Pix {
  constructor(w, h) {
    this.w = w; this.h = h; this.p = new Array(w * h).fill(null); this.f = new Uint8Array(w * h);
    this.x0 = w; this.y0 = h; this.x1 = -1; this.y1 = -1;   // retângulo ocupado (para varrer só o necessário)
  }
  grow(x0, y0, x1 = x0, y1 = y0) {
    if (x0 < this.x0) this.x0 = Math.max(0, x0); if (y0 < this.y0) this.y0 = Math.max(0, y0);
    if (x1 > this.x1) this.x1 = Math.min(this.w - 1, x1); if (y1 > this.y1) this.y1 = Math.min(this.h - 1, y1);
  }
  layer() { return new Pix(this.w, this.h); }
  get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.p[y * this.w + x]; }
  has(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h && this.p[y * this.w + x] != null; }
  set(x, y, c) {
    if (c == null || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const v = typeof c === 'function' ? c(x, y) : c;
    if (v == null) return;
    this.p[y * this.w + x] = v;
    if (x < this.x0) this.x0 = x; if (x > this.x1) this.x1 = x; if (y < this.y0) this.y0 = y; if (y > this.y1) this.y1 = y;
  }
  // só pinta onde já existe pixel (decalques sobre a peça)
  paint(x, y, c) { x = Math.floor(x); y = Math.floor(y); if (this.has(x, y)) this.set(x, y, c); }
  del(x, y) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.p[y * this.w + x] = null; }
  rect(x, y, w, h, c) {
    x = Math.round(x); y = Math.round(y);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  ell(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1.001) this.set(x, y, c);
      }
    }
  }
  poly(pts, c) {
    let y0 = Infinity, y1 = -Infinity;
    const n = pts.length / 2;
    for (let i = 1; i < pts.length; i += 2) { y0 = Math.min(y0, pts[i]); y1 = Math.max(y1, pts[i]); }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const yc = y + 0.5, xs = [];
      for (let i = 0; i < n; i++) {
        const ax = pts[2 * i], ay = pts[2 * i + 1], j = (i + 1) % n, bx = pts[2 * j], by = pts[2 * j + 1];
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + (yc - ay) / (by - ay) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.ceil(xs[k] - 0.5); x + 0.5 <= xs[k + 1] + 0.001; x++) this.set(x, y, c);
      }
    }
  }
  // cápsula de a até b (raio varia de r1 a r2)
  seg(a, b, r1, r2, c) {
    const [ax, ay] = a, [bx, by] = b, R = Math.max(r1, r2);
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-6;
    for (let y = Math.floor(Math.min(ay, by) - R); y <= Math.ceil(Math.max(ay, by) + R); y++) {
      for (let x = Math.floor(Math.min(ax, bx) - R); x <= Math.ceil(Math.max(ax, bx) + R); x++) {
        const px = x + 0.5, py = y + 0.5;
        let t = ((px - ax) * dx + (py - ay) * dy) / L2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = ax + dx * t - px, qy = ay + dy * t - py, r = r1 + (r2 - r1) * t;
        if (qx * qx + qy * qy <= r * r + 0.01) this.set(x, y, c);
      }
    }
  }
  // traço curvo (Bézier quadrática) afinando de w0 até w1
  bez(a, m, b, w0, w1, c) {
    const L = Math.hypot(m[0] - a[0], m[1] - a[1]) + Math.hypot(b[0] - m[0], b[1] - m[1]);
    const n = Math.max(2, Math.ceil(L * 1.5));
    let prev = a;
    for (let i = 1; i <= n; i++) {
      const t = i / n, u = 1 - t;
      const q = [u * u * a[0] + 2 * u * t * m[0] + t * t * b[0], u * u * a[1] + 2 * u * t * m[1] + t * t * b[1]];
      this.seg(prev, q, lerp(w0, w1, (i - 1) / n), lerp(w0, w1, t), c);
      prev = q;
    }
  }
  line(a, b, c) {
    let x0 = Math.floor(a[0]), y0 = Math.floor(a[1]);
    const x1 = Math.floor(b[0]), y1 = Math.floor(b[1]);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let k = 0; k < 400; k++) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  // bitmap em texto ('.' ou ' ' = vazio); flip espelha horizontalmente
  blit(x, y, rows, pal, flip = false) {
    for (let j = 0; j < rows.length; j++) {
      const r = rows[j], n = r.length;
      for (let i = 0; i < n; i++) {
        const k = r[flip ? n - 1 - i : i];
        if (k !== '.' && k !== ' ' && pal[k] !== undefined) this.set(x + i, y + j, pal[k]);
      }
    }
  }
  map(fn) {
    for (let y = this.y0; y <= this.y1; y++) for (let x = this.x0; x <= this.x1; x++) { const i = y * this.w + x; if (this.p[i] != null) this.p[i] = fn(this.p[i], x, y); }
    return this;
  }
  keep(fn) {
    for (let y = this.y0; y <= this.y1; y++) for (let x = this.x0; x <= this.x1; x++) if (this.p[y * this.w + x] != null && !fn(x, y)) this.p[y * this.w + x] = null;
    return this;
  }
  empty() {
    for (let y = this.y0; y <= this.y1; y++) for (let x = this.x0; x <= this.x1; x++) if (this.p[y * this.w + x] != null) return false;
    return true;
  }
  flipX() {
    const o = new Pix(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { o.p[y * this.w + this.w - 1 - x] = this.p[y * this.w + x]; o.f[y * this.w + this.w - 1 - x] = this.f[y * this.w + x]; }
    if (this.x1 >= 0) o.grow(this.w - 1 - this.x1, this.y0, this.w - 1 - this.x0, this.y1);
    return o;
  }
  shift(dx, dy) {
    const o = new Pix(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) o.set(x + dx, y + dy, this.p[y * this.w + x]);
    return o;
  }
}

function toCanvas(P, scale) {
  const c = makeCanvas(P.w, P.h), g = c.getContext('2d');
  const img = g.createImageData(P.w, P.h);
  for (let i = 0; i < P.p.length; i++) {
    const v = P.p[i];
    if (v == null) continue;
    const q = rgbaOf(v);
    img.data[i * 4] = q[0]; img.data[i * 4 + 1] = q[1]; img.data[i * 4 + 2] = q[2]; img.data[i * 4 + 3] = q[3];
  }
  g.putImageData(img, 0, 0);
  if (scale === 1) return c;
  const o = makeCanvas(P.w * scale, P.h * scale), og = o.getContext('2d');
  og.imageSmoothingEnabled = false;
  og.drawImage(c, 0, 0, o.width, o.height);
  return o;
}

// ================================================================== cores
function memo(fn) {
  const m = new Map();
  return (c) => { let r = m.get(c); if (r === undefined) { r = fn(c); m.set(c, r); } return r; };
}
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const rgbaOf = memo((c) => {
  if (typeof c !== 'string' || c[0] !== '#') return [255, 0, 255, 255];
  let h = c.slice(1);
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, h.length > 6 ? parseInt(h.slice(6, 8), 16) : 255];
});
const hex = (r, g, b) => '#' + ((1 << 24) | (Math.round(clamp(r, 0, 255)) << 16) | (Math.round(clamp(g, 0, 255)) << 8) | Math.round(clamp(b, 0, 255))).toString(16).slice(1);
function mix(a, b, t) {
  const A = rgbaOf(a), B = rgbaOf(b);
  return hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
const isA = (c) => c.length > 7;
const lum = memo((c) => { const [r, g, b] = rgbaOf(c); return (0.3 * r + 0.59 * g + 0.11 * b) / 255; });
const toHsl = memo((c) => {
  const [R, G, B] = rgbaOf(c).map((v) => v / 255);
  const mx = Math.max(R, G, B), mn = Math.min(R, G, B), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === R ? (G - B) / d + (G < B ? 6 : 0) : mx === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [h * 60, s, l];
});
function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360; s = clamp(s); l = clamp(l);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => {
    t = ((t % 1) + 1) % 1;
    return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
  };
  return hex(f(h / 360 + 1 / 3) * 255, f(h / 360) * 255, f(h / 360 - 1 / 3) * 255);
}
// gira o matiz h em direção a t (no máximo a graus)
function hueTo(h, t, a) {
  let d = ((t - h + 540) % 360) - 180;
  return h + Math.sign(d) * Math.min(Math.abs(d), a);
}

// Rampa de um material: hi (brilho), li (luz), b (base), s1 (sombra), s2 (sombra funda),
// ol (contorno interno, escuro e saturado) e oo (contorno externo, quase preto).
const RAMP = new Map();
function ramp(c) {
  let r = RAMP.get(c);
  if (r) return r;
  const [h, s, l] = toHsl(c);
  if (l < 0.2) {
    // pretos: base um pouco erguida para o volume aparecer
    const b = Math.max(l, 0.13);
    r = {
      hi: hsl(hueTo(h, 230, 30), s * 0.5 + 0.06, b + 0.24), li: hsl(hueTo(h, 230, 30), s * 0.6 + 0.05, b + 0.11), b: hsl(h, s, b),
      s1: hsl(hueTo(h, 250, 20), s, b - 0.05), s2: hsl(h, s, b - 0.085), ol: hsl(h, s, 0.035), oo: '#08070a',
    };
  } else if (l > 0.86 && s < 0.35) {
    // brancos: sombras azuladas
    r = {
      hi: '#ffffff', li: hsl(h, s, Math.min(0.99, l + 0.05)), b: c,
      s1: hsl(hueTo(h, 225, 360), 0.16, l - 0.13), s2: hsl(hueTo(h, 235, 360), 0.16, l - 0.26),
      ol: hsl(235, 0.14, 0.42), oo: hsl(240, 0.2, 0.09),
    };
  } else {
    r = {
      hi: hsl(hueTo(h, 55, 14), s * 0.85, l + (1 - l) * 0.42),
      li: hsl(hueTo(h, 55, 8), s * 0.95, l + (1 - l) * 0.2),
      b: c,
      s1: hsl(hueTo(h, 250, 10), Math.min(1, s * 1.05 + 0.04), l * 0.8),
      s2: hsl(hueTo(h, 255, 18), Math.min(1, s * 1.1 + 0.06), l * 0.62),
      ol: hsl(hueTo(h, 260, 22), Math.min(1, s + 0.12), l * 0.36),
      oo: hsl(hueTo(h, 260, 30), Math.min(1, s * 0.7 + 0.1), Math.min(0.1, l * 0.17)),
    };
  }
  RAMP.set(c, r);
  family(r);
  return r;
}
// os tons derivados continuam na mesma família (sombrear duas vezes não muda de matiz)
function family(r) {
  const deep = mix(r.s2, r.ol, 0.4);
  const reg = (k, v) => { if (!RAMP.has(k)) RAMP.set(k, v); };
  reg(r.s1, { hi: r.li, li: r.b, b: r.s1, s1: r.s2, s2: deep, ol: r.ol, oo: r.oo });
  reg(r.s2, { hi: r.b, li: r.s1, b: r.s2, s1: deep, s2: mix(deep, r.ol, 0.5), ol: r.ol, oo: r.oo });
  reg(r.li, { hi: r.hi, li: r.hi, b: r.li, s1: r.b, s2: r.s1, ol: r.ol, oo: r.oo });
  reg(r.hi, { hi: r.hi, li: r.hi, b: r.hi, s1: r.li, s2: r.b, ol: r.ol, oo: r.oo });
}
// pele: sombras quentes, levemente rosadas
for (const s of SKINS) {
  const [h, sa, l] = toHsl(s);
  RAMP.set(s, {
    hi: hsl(hueTo(h, 45, 6), sa, l + (1 - l) * 0.32), li: hsl(hueTo(h, 45, 4), sa, l + (1 - l) * 0.15), b: s,
    s1: hsl(hueTo(h, 16, 5), Math.min(1, sa * 0.92 + 0.02), l * 0.89), s2: hsl(hueTo(h, 12, 7), Math.min(1, sa * 0.88), l * 0.79),
    ol: hsl(hueTo(h, 10, 8), Math.min(0.5, sa * 0.6), l * 0.3), oo: hsl(hueTo(h, 5, 10), 0.3, Math.min(0.1, l * 0.14)),
  });
  family(RAMP.get(s));
}
// conjunto de tons de um material (para contorno suave sobre a mesma cor)
const skinSet = memo((c) => { const R = ramp(c), s = new Set([R.hi, R.li, R.b, R.s1, R.s2]); s.base = c; return s; });
const s1 = (c) => ramp(c).s1, s2 = (c) => ramp(c).s2, li = (c) => ramp(c).li, hi = (c) => ramp(c).hi;
const olOf = (c) => ramp(c).ol;
const outerOf = memo((c) => { const [h, s, l] = toHsl(c); return hsl(h, s * 0.75, Math.min(l * 0.42, 0.075)); });
// pretos muito escuros ficam um pouco mais claros
const lift = memo((c) => (lum(c) < 0.13 ? ramp(c).b : c));
const WHITE = '#f4f4f0';
const INK = '#1a1420';
const SHADOW = '#00000038';

// ================================================================== composição
// Copia a camada L para dst com contorno de 1 px (cor de contorno do material).
// opt.ol: true (contorno do material) | string (cor fixa) | false
// opt.inner: false = só contorna sobre outras peças (não cria silhueta)
// opt.cast: [dx, dy] projeta sombra da peça sobre o que está embaixo
function stamp(dst, L, opt = {}) {
  const { w, h, p } = L, d = dst.p, f = dst.f;
  if (L.x1 < 0) return;
  const ol = opt.ol ?? true;
  const m = opt.cast ? (opt.castN || 2) + 1 : 1;
  const X0 = Math.max(0, L.x0 - m), X1 = Math.min(w - 1, L.x1 + m), Y0 = Math.max(0, L.y0 - m), Y1 = Math.min(h - 1, L.y1 + m);
  dst.grow(X0, Y0, X1, Y1);
  if (opt.cast) {
    const [cx, cy] = opt.cast, n = opt.castN || 2;
    for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
      const i = y * w + x;
      if (p[i] != null || d[i] == null || f[i] || isA(d[i])) continue;
      let hit = false;
      for (let k = 1; k <= n && !hit; k++) { const sx = x - Math.round(cx * k), sy = y - Math.round(cy * k); if (sx >= 0 && sy >= 0 && sx < w && sy < h && p[sy * w + sx] != null) hit = true; }
      if (hit) d[i] = s1(d[i]);
    }
  }
  if (ol) {
    for (let y = Y0; y <= Y1; y++) {
      for (let x = X0; x <= X1; x++) {
        const i = y * w + x;
        if (p[i] != null) continue;
        let best = null, bl = 9;
        const t = (c) => {
          if (c == null) return;
          const o = typeof ol === 'string' ? ol : olOf(c), l = lum(o);
          if (l < bl) { bl = l; best = o; }
        };
        if (x > 0) t(p[i - 1]);
        if (x < w - 1) t(p[i + 1]);
        if (y > 0) t(p[i - w]);
        if (y < h - 1) t(p[i + w]);
        if (best == null) continue;
        if (opt.inner === false && (d[i] == null || isA(d[i]))) continue;
        if (opt.soft && d[i] != null && opt.soft.has(d[i])) { d[i] = ramp(opt.soft.base).s2; f[i] = 2; continue; }
        d[i] = best; f[i] = 1;
      }
    }
  }
  const fl = opt.flag || 0;
  for (let y = L.y0; y <= L.y1; y++) for (let x = L.x0; x <= L.x1; x++) { const i = y * w + x; if (p[i] != null) { d[i] = p[i]; f[i] = fl; } }
}

// Contorno externo: pixels de contorno que tocam o vazio viram quase preto.
function finish(P) {
  const { w, h, p, f } = P;
  const out = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (f[i] !== 1 || p[i] == null) continue;
    const e = (xx, yy) => { if (xx < 0 || yy < 0 || xx >= w || yy >= h) return true; const v = p[yy * w + xx]; return v == null || isA(v); };
    if (e(x - 1, y) || e(x + 1, y) || e(x, y - 1) || e(x, y + 1)) out.push(i);
  }
  for (const i of out) p[i] = outerOf(p[i]);
  return P;
}

// Sombreamento por distância à borda na direção da luz.
// o: { s: largura da sombra, d: sombra funda, l: luz, hi: brilho, dir: [dx,dy] (para longe da luz), skip }
const LIGHT = [0.72, 0.7];
function shade(L, o) {
  const { w, h, p } = L, out = p.slice();
  const [dx, dy] = o.dir || LIGHT;
  const S = Math.max(o.s || 0, o.d || 0), Lw = Math.max(o.l || 0, o.hi || 0);
  const inL = (x, y) => x >= 0 && y >= 0 && x < w && y < h && p[y * w + x] != null;
  const mask = o.mask ? (x, y) => o.mask.has(x, y) : inL;
  for (let y = L.y0; y <= L.y1; y++) for (let x = L.x0; x <= L.x1; x++) {
    const i = y * w + x, c = p[i];
    if (c == null || (o.skip && o.skip.has(c))) continue;
    let ds = 99, dl = 99;
    for (let k = 1; k <= S; k++) if (!mask(x + Math.round(dx * k), y + Math.round(dy * k))) { ds = k; break; }
    for (let k = 1; k <= Lw; k++) if (!mask(x - Math.round(dx * k), y - Math.round(dy * k))) { dl = k; break; }
    const R = ramp(c);
    out[i] = ds <= (o.d || 0) ? R.s2 : ds <= (o.s || 0) ? R.s1 : dl <= (o.hi || 0) ? R.hi : dl <= (o.l || 0) ? R.li : c;
  }
  L.p = out;
  return L;
}

// ================================================================== utilidades
const lerp = (a, b, t) => a + (b - a) * t;
const lp = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const tri = (x) => { const f = x - Math.floor(x); return 1 - Math.abs(2 * f - 1); };
const mod = (a, n) => ((a % n) + n) % n;
const inE = (u, v, cu, cv, ru, rv) => ((u - cu) / ru) ** 2 + ((v - cv) / rv) ** 2 <= 1;
function inPoly(u, v, pts) {
  let inside = false;
  for (let i = 0, n = pts.length / 2, j = n - 1; i < n; j = i++) {
    const xi = pts[2 * i], yi = pts[2 * i + 1], xj = pts[2 * j], yj = pts[2 * j + 1];
    if ((yi > v) !== (yj > v) && u < (xj - xi) * (v - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ================================================================== roupa → paleta
const DEF = {
  top: { style: 'tee', color: '#e3403b' },
  bottom: { style: 'pants', color: '#3a3f4a' },
  shoes: { style: 'sneakers', color: '#e3403b' },
};
const HAIRS = new Set(['short', 'spiky', 'sidepart', 'long', 'ponytail', 'twintails', 'bob', 'bun', 'afro', 'curly', 'mohawk', 'buzz',
  'wavy', 'bangs', 'highponytail', 'sideponytail', 'braid', 'braids2', 'doublebun', 'pixie', 'curlylong', 'hime']);
const KNOWN = {
  hat: new Set(['cap', 'beanie', 'bucket', 'sunhat', 'cowboy', 'beret', 'tophat', 'bandana', 'ears', 'flower', 'crown', 'cap2', 'bow', 'headband', 'hairclips', 'sunvisor']),
  top: new Set(['tee', 'striped', 'tank', 'hoodie', 'jacket', 'coat', 'sweater', 'dress', 'labcoat', 'vest', 'kimono', 'suit', 'jersey',
    'croptop', 'blouse', 'offshoulder', 'body', 'sundress', 'longdress', 'partydress', 'bikini', 'swimsuit']),
  bottom: new Set(['pants', 'jeans', 'shorts', 'skirt', 'longskirt', 'leggings', 'cargo', 'trackpants', 'shortshorts', 'denimshorts', 'bikinibottom', 'miniskirt', 'pleated', 'flare']),
  shoes: new Set(['sneakers', 'boots', 'sandals', 'formal', 'runners', 'heels', 'flats', 'platform', 'kneeboots', 'flipflops']),
  acc: new Set(['glasses', 'sunglasses', 'scarf', 'necklace', 'wristbands', 'earrings', 'pearls', 'choker', 'bracelets', 'cateye']),
  back: new Set(['backpack', 'satchel', 'cape', 'wings', 'handbag']),
};
const DRESSES = new Set(['dress', 'sundress', 'longdress', 'partydress']);
const SKIRTS = new Set(['skirt', 'longskirt', 'miniskirt', 'pleated']);
// calças que continuam aparecendo abaixo da barra de um vestido
const LONG_LEGS = new Set(['pants', 'jeans', 'cargo', 'trackpants', 'leggings', 'flare']);
const SHORTS = new Set(['shorts', 'shortshorts', 'denimshorts']);
// partes de cima por dentro da calça/saia (a peça de baixo fica por cima)
const TUCKED = new Set(['body', 'swimsuit']);
const isHex = (c) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);
function item(slot, id) {
  const it = typeof id === 'string' ? CLOTHES[id] : null;
  if (!it || !KNOWN[slot].has(it.style)) return null;
  return { ...it, color: isHex(it.color) ? it.color : '#888888', color2: isHex(it.color2) ? it.color2 : null };
}

function outfit(look) {
  const skin = SKINS[look.skin] || SKINS[1];
  const top = item('top', look.top) || DEF.top;
  const realBottom = item('bottom', look.bottom);
  const bottom = realBottom || DEF.bottom;
  const o = {
    female: look.body === 'f',
    hs: HAIRS.has(look.hair) ? look.hair : 'short',
    skin,
    hair: isHex(look.hairColor) ? look.hairColor : '#5b3a24',
    eye: EYES[look.eyes] || EYES[0],
    hat: item('hat', look.hat), top, bottom,
    shoes: item('shoes', look.shoes) || DEF.shoes,
    acc: item('acc', look.acc), back: item('back', look.back),
  };
  // vestidos: cobrem o quadril; uma calça comprida continua aparecendo abaixo da barra,
  // shorts e saias ficam escondidos por baixo
  o.dk = DRESSES.has(top.style) ? top.style : null;
  o.dress = !!o.dk;
  o.swim = top.style === 'swimsuit';
  let legs = bottom.style;
  if (o.dress) legs = realBottom && LONG_LEGS.has(realBottom.style) ? realBottom.style : 'skin';
  else if (o.swim && !realBottom) legs = 'skin';
  else if (SKIRTS.has(legs) || legs === 'bikinibottom') legs = 'skin';
  o.legs = legs;                       // o que é desenhado nas pernas: 'skin' ou o estilo da calça
  o.bareLegs = legs === 'skin';
  o.skirt = !o.dress && SKIRTS.has(bottom.style) ? bottom.style : null;
  o.brief = !o.dress && bottom.style === 'bikinibottom';
  // maiô sem peça de baixo: a parte de baixo do maiô aparece; com peça de baixo, fica por dentro
  o.swimBrief = o.swim && !realBottom;
  o.tucked = TUCKED.has(top.style) && !o.swimBrief;
  o.wb = o.acc && o.acc.style === 'wristbands' ? lift(o.acc.color) : null;
  o.bangle = o.acc && o.acc.style === 'bracelets' ? lift(o.acc.color) : null;
  o.hairL = lift(o.hair);
  return o;
}

// ================================================================== retrato (80x144)
function ptPix(look, d) {
  const o = outfit(look);
  const V = d === 0 ? 'back' : d === 2 ? 'front' : 'side';
  const P = new Pix(PT_W, PT_H);
  const g = ptGeom(V, o);
  const c = { P, o, g, V };
  P.ell(g.shadow[0], g.shadow[1], g.shadow[2], g.shadow[3], SHADOW);
  if (V === 'front') ptFront(c);
  else if (V === 'back') ptBack(c);
  else ptSide(c);
  finish(P);
  return d === 1 ? P.flipX() : P;
}

const LONG_TOPS = { coat: 94, labcoat: 106, kimono: 90, dress: 0 };
const POCKETLESS = (o) => o.bareLegs || o.dress || LONG_TOPS[o.top.style] !== undefined || o.legs === 'leggings';

function ptGeom(V, o) {
  const f = o.female;
  const g = { V, shadow: [41, 140.5, 26, 2.6], waist: 67, hem: 71 };
  if (V === 'front') {
    g.head = { x: 38, y: 21 };
    g.cx = 38;
    g.tor = f
      ? { nk: [34.5, 41.5, 36.5], sh: [[28, 40], [51.5, 40.5]], ap: [[28.5, 48], [51.5, 48.5]], ch: [[28, 52], [52, 52]], wa: [[30.5, 59], [49.5, 59]], hp: [[28, 68.5], [52, 68.5]] }
      : { nk: [33, 43, 36.5], sh: [[25.5, 40], [55, 40.5]], ap: [[25.8, 49], [54.8, 49.5]], ch: [[26, 53], [55, 53]], wa: [[27.2, 60], [53.6, 60]], hp: [[26.2, 69.5], [54.6, 69.5]] };
    const hipHand = f || POCKETLESS(o);
    g.arms = [
      f ? { sh: [29, 43], el: [19.5, 53], wr: [19, 44.5], hand: 'ball' } : { sh: [26.5, 43.5], el: [15.5, 53.5], wr: [15.5, 45], hand: 'ball' },
      hipHand
        ? (f ? { sh: [51, 43.5], el: [58.5, 53.5], wr: [53.5, 61.5], hand: 'hip' } : { sh: [54.5, 44], el: [61.5, 55], wr: [56.5, 63.5], hand: 'hip' })
        : { sh: [54.5, 44], el: [59.5, 56], wr: [54.5, 66], hand: 'pocket' },
    ];
    g.ball = f ? [23, 34] : [20.5, 33];
    g.legs = f
      ? [{ hip: [34.5, 73], kn: [32.5, 98], an: [31, 122], s: -1 }, { hip: [45.5, 73], kn: [50.5, 97.5], an: [55.5, 121.5], s: 1 }]
      : [{ hip: [33, 73], kn: [30, 99], an: [27, 122], s: -1 }, { hip: [47.5, 73], kn: [53.5, 98.5], an: [59.5, 121.5], s: 1 }];
    g.crotch = [40, f ? 78 : 80];
  } else if (V === 'back') {
    g.head = { x: 40, y: 21 };
    g.cx = 40;
    g.tor = f
      ? { nk: [36.5, 43.5, 36.5], sh: [[28.5, 40], [51.5, 40]], ap: [[29, 48], [51, 48]], ch: [[28.8, 52], [51.2, 52]], wa: [[31, 59], [49, 59]], hp: [[28.5, 68.5], [51.5, 68.5]] }
      : { nk: [35, 45, 36.5], sh: [[25.5, 40], [54.5, 40]], ap: [[25.8, 49], [54.2, 49]], ch: [[26, 53], [54, 53]], wa: [[27.5, 60], [52.5, 60]], hp: [[26.5, 69.5], [53.5, 69.5]] };
    // a mesma pose da frente vista de costas: a bola fica na mão do lado direito da tela
    const hipHand = f || POCKETLESS(o);
    g.arms = f
      ? [hipHand ? { sh: [29.5, 43.5], el: [21.5, 53.5], wr: [26.5, 61.5], hand: 'hip' } : { sh: [29.5, 43.5], el: [23, 55.5], wr: [27.5, 63.5], hand: 'hidden' }, { sh: [51, 43.5], el: [60.5, 53], wr: [61, 44.5], hand: 'ballBack' }]
      : [hipHand ? { sh: [26, 44], el: [18.5, 55], wr: [24, 63.5], hand: 'hip' } : { sh: [26, 44], el: [21, 56], wr: [25.5, 64.5], hand: 'hidden' }, { sh: [54, 44], el: [64.5, 53.5], wr: [64, 45], hand: 'ballBack' }];
    g.ball = f ? [58, 34] : [60.5, 33.5];
    g.legs = f
      ? [{ hip: [35, 73], kn: [33.5, 98], an: [32.5, 122], s: -1 }, { hip: [45, 73], kn: [47, 98], an: [48.5, 122], s: 1 }]
      : [{ hip: [33.5, 73], kn: [31, 98.5], an: [29, 122], s: -1 }, { hip: [46.5, 73], kn: [49.5, 98.5], an: [52, 122], s: 1 }];
    g.crotch = [40, f ? 78 : 80];
  } else {
    // perfil olhando para a esquerda
    g.head = { x: 38, y: 21 };
    g.cx = 40;
    g.side = f
      ? { nk: [35.5, 43.5, 36.5], fr: [[33.5, 40], [31.5, 46], [31, 51], [33, 59], [32.5, 69]], bk: [[46.5, 40], [48, 46], [47.5, 52], [46, 59], [47.5, 69]] }
      : { nk: [35, 44.5, 36.5], fr: [[33, 40], [31, 46], [31, 53], [32.5, 60], [32, 70]], bk: [[47.5, 40], [49.5, 46], [49.5, 53], [48, 60], [48.5, 70]] };
    g.arms = [
      { sh: [43, 43.5], el: [46, 55.5], wr: [46, 66], hand: 'relax', far: true },
      f ? { sh: [40, 43.5], el: [38.5, 55], wr: [31.5, 57], hand: 'ballSide' } : { sh: [40, 44], el: [38.5, 56], wr: [31, 58.5], hand: 'ballSide' },
    ];
    g.ball = f ? [25.5, 55.5] : [24.5, 57];
    g.legs = f
      ? [{ hip: [42.5, 73], kn: [45, 97.5], an: [48, 121.5], s: -1, far: true }, { hip: [38.5, 73], kn: [35.5, 97.5], an: [32, 122], s: -1 }]
      : [{ hip: [43, 73], kn: [46, 98], an: [49.5, 121.5], s: -1, far: true }, { hip: [38.5, 73], kn: [35, 98], an: [30.5, 122], s: -1 }];
  }
  return g;
}

function ptFront(c) {
  ptBackItem(c, 'behind');
  ptHairBack(c);
  ptLegsAndShoes(c, [0, 1]);
  ptLongHem(c);
  ptNeck(c);
  ptTorso(c);
  ptStraps(c);
  ptArm(c, 0); ptArm(c, 1);
  ptHandbag(c);
  ptNeckAcc(c);
  ptScarf(c);
  ptHead(c);
}

function ptBack(c) {
  // braço com a mão no bolso da frente: fica atrás do corpo
  const hid = c.g.arms.findIndex((a) => a.hand === 'hidden');
  if (hid >= 0) ptArm(c, hid);
  ptLegsAndShoes(c, [0, 1]);
  ptLongHem(c);
  ptNeck(c);
  ptTorso(c);
  for (const i of [0, 1]) if (c.g.arms[i].hand !== 'hidden' && c.g.arms[i].hand !== 'ballBack') ptArm(c, i);
  // asas ficam por cima do cabelo; mochila, bolsa e capa ficam por baixo do cabelo comprido
  const wings = c.o.back && c.o.back.style === 'wings';
  if (!wings) ptBackItem(c, 'over');
  ptHandbag(c);
  ptNeckAcc(c);
  ptScarf(c);
  ptHead(c);
  if (wings) ptBackItem(c, 'over');
  // o braço erguido com a bola fica por cima do cabelo comprido
  const bi = c.g.arms.findIndex((a) => a.hand === 'ballBack');
  if (bi >= 0) ptArm(c, bi);
}

function ptSide(c) {
  ptArm(c, 0);
  ptLegsAndShoes(c, [0], true);
  ptBackItem(c, 'behind');
  ptLegsAndShoes(c, [1]);
  ptLongHem(c);
  ptNeck(c);
  ptTorso(c);
  ptBackItem(c, 'over');
  ptStraps(c);
  ptHandbag(c);
  ptNeckAcc(c);
  ptScarf(c);
  ptArm(c, 1);
  ptHead(c);
}

// coloca uma camada: sombreia, escurece (peças de trás) e carimba com contorno
function put(c, L, sh, opt = {}) {
  if (sh) shade(L, sh);
  if (opt.dim) L.map(s1);
  stamp(c.P, L, opt);
}

// ------------------------------------------------------------------ geometria auxiliar
// tubo de a até b com meia-largura wa/wb (polígono)
function tube(a, b, wa, wb) {
  let dx = b[0] - a[0], dy = b[1] - a[1];
  const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
  const nx = -dy, ny = dx;
  return [a[0] + nx * wa, a[1] + ny * wa, b[0] + nx * wb, b[1] + ny * wb, b[0] - nx * wb, b[1] - ny * wb, a[0] - nx * wa, a[1] - ny * wa];
}
// eixo da perna: t de 0 (quadril) a 1 (joelho) a 2 (tornozelo)
function legAt(gl, t) { return t <= 1 ? lp(gl.hip, gl.kn, t) : lp(gl.kn, gl.an, t - 1); }
function legDir(gl, t) {
  const a = t <= 1 ? gl.hip : gl.kn, b = t <= 1 ? gl.kn : gl.an;
  const dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1;
  return [dx / n, dy / n];
}
// contorno de uma perna a partir de um perfil [[t, larguraFora, larguraDentro], ...]
function legPoly(gl, prof) {
  const out = [], inn = [];
  const s = gl.s; // lado de fora: -1 = esquerda da tela
  for (const [t, wo, wi] of prof) {
    const p = legAt(gl, t);
    let d = legDir(gl, t);
    if (Math.abs(t - 1) < 0.01) { const d0 = legDir(gl, 0.99), d1 = legDir(gl, 1.01); d = [(d0[0] + d1[0]) / 2, (d0[1] + d1[1]) / 2]; }
    const nx = d[1], ny = -d[0]; // normal para a direita da tela (eixo descendo)
    // ponto de fora e de dentro
    out.push([p[0] + s * nx * wo, p[1] + s * ny * wo]);
    inn.push([p[0] - s * nx * wi, p[1] - s * ny * wi]);
  }
  const pts = [];
  for (const q of out) pts.push(q[0], q[1]);
  for (let i = inn.length - 1; i >= 0; i--) pts.push(inn[i][0], inn[i][1]);
  return pts;
}
function profAt(prof, t) {
  for (let i = 1; i < prof.length; i++) {
    if (t <= prof[i][0]) { const a = prof[i - 1], b = prof[i], k = (t - a[0]) / (b[0] - a[0] || 1); return [lerp(a[1], b[1], k), lerp(a[2], b[2], k)]; }
  }
  const z = prof[prof.length - 1]; return [z[1], z[2]];
}

// ------------------------------------------------------------------ pernas
const PANTS_PROF = {
  pants: [[0, 8, 7.4], [0.5, 7.6, 6.6], [1, 6.9, 6], [1.5, 6.6, 5.8], [2, 6.6, 6]],
  jeans: [[0, 7.8, 7.2], [0.5, 7.2, 6.2], [1, 6.2, 5.5], [1.5, 5.8, 5.2], [2, 5.8, 5.4]],
  cargo: [[0, 8.6, 7.6], [0.45, 9.0, 7.0], [1, 8.2, 6.6], [1.5, 8.4, 6.6], [1.76, 8.0, 6.3], [1.83, 5.4, 5.0], [2, 5.2, 4.9]],
  trackpants: [[0, 8.2, 7.4], [0.5, 8, 6.8], [1, 7.4, 6.2], [1.6, 7.4, 6.2], [1.78, 7.0, 5.8], [1.84, 5.2, 4.8], [2, 5.1, 4.8]],
  leggings: [[0, 7.4, 6.8], [0.4, 6.6, 5.6], [1, 5, 4.3], [1.4, 5.1, 4.2], [2, 3.8, 3.6]],
  shorts: [[0, 8.4, 7.6], [0.5, 8.4, 7.2], [0.78, 8.2, 7]],
  shortshorts: [[0, 8.2, 7.5], [0.3, 8.1, 7.1]],
  denimshorts: [[0, 8.3, 7.5], [0.44, 8.4, 7.3]],
  flare: [[0, 7.8, 7.2], [0.5, 7.0, 6.0], [1, 5.6, 5.0], [1.35, 6.0, 5.2], [2, 8.4, 7.4], [2.26, 9.6, 8.4]],
  skin: [[0, 7, 6.4], [0.45, 6.2, 5.2], [1, 4.4, 3.9], [1.4, 4.7, 3.9], [1.85, 3.4, 3.1], [2, 3.3, 3.1]],
};
const SHOES_OVER = new Set(['pants', 'jeans', 'cargo', 'trackpants', 'flare']);

function ptLegsAndShoes(c, idx, far = false) {
  const { o } = c;
  const st = o.legs;
  if (SHOES_OVER.has(st)) { for (const i of idx) ptShoe(c, i, far); ptLegs(c, idx, far); }
  else { ptLegs(c, idx, far); for (const i of idx) ptShoe(c, i, far); }
}

function ptLegs(c, idx, far) {
  const { P, o, g, V } = c;
  const st = o.legs;
  const col = lift(o.bottom.color);
  const L = P.layer();
  const fem = o.female ? 0.9 : 1;
  const prof = (PANTS_PROF[st] || PANTS_PROF.pants).map(([t, a, b]) => [t, a * fem, b * fem]);
  const skinProf = PANTS_PROF.skin.map(([t, a, b]) => [t, a * fem, b * fem]);
  const pantsCol = (x, y) => col;
  for (const i of idx) {
    const gl = g.legs[i];
    if (st === 'skin' || SHORTS.has(st) || st === 'leggings') L.poly(legPoly(gl, skinProf), st === 'leggings' ? col : o.skin);
    if (st !== 'skin') L.poly(legPoly(gl, prof), pantsCol);
  }
  // quadril (liga as pernas); com as pernas de fora, a pele preenche a bacia
  const hc = st === 'skin' ? o.skin : col, hw = st === 'skin' ? skinProf : prof;
  if (V !== 'side' && idx.length === 2) {
    const t = g.tor, y0 = g.waist, cr = g.crotch;
    const a = g.legs[0], b = g.legs[1];
    L.poly([t.hp[0][0] + 0.5, y0, t.hp[1][0] - 0.5, y0, b.hip[0] + hw[0][1] * 0.98, a.hip[1] + 1, b.hip[0] + 2, cr[1] - 1, cr[0], cr[1], a.hip[0] - 2, cr[1] - 1, a.hip[0] - hw[0][1] * 0.98, a.hip[1] + 1], hc);
  } else if (V === 'side') {
    const gl = g.legs[idx[0]], sd = g.side;
    if (!gl.far) L.poly([sd.fr[4][0] + 0.5, g.waist, sd.bk[4][0] - 0.5, g.waist, sd.bk[4][0] + 0.5, g.waist + 7, gl.hip[0] + 6, gl.hip[1] + 6, gl.hip[0] - 7, gl.hip[1] + 5, sd.fr[4][0] - 0.5, g.waist + 6], hc);
  }
  shade(L, { s: 3, d: 1, l: 2, skip: null });
  if (st !== 'skin') pantsDetails(L, c, idx, prof, col, st);
  if (st === 'skin' || SHORTS.has(st)) for (const i of idx) kneeCap(L, c, g.legs[i]);
  put(c, L, null, { dim: far });
  // calcinha do biquíni
  if (o.brief && (idx.length === 2 || !g.legs[idx[0]].far)) {
    const B = P.layer();
    B.poly(briefPts(c, 0), col);
    shade(B, { s: 2, d: 0, l: 1, dir: [0.92, 0.38] });
    const R = ramp(col);
    if (V === 'front') { for (const sx of [-1, 1]) { const x = g.cx + sx * 10; B.paint(x, 70, R.hi); B.paint(x + sx, 70, R.li); } }
    put(c, B, null);
  }
}

function kneeCap(L, c, gl) {
  const sk = c.o.skin, [x, y] = gl.kn;
  if (L.get(Math.round(x), Math.round(y)) == null) return;
  L.paint(x - 1, y + 1, s1(sk)); L.paint(x, y + 1.5, s1(sk)); L.paint(x + 1, y + 1, s1(sk));
  L.paint(x - 1, y - 1, li(sk));
}

function pantsDetails(L, c, idx, prof, col, st) {
  const { o, g, V } = c;
  const c2 = o.bottom.color2 ? lift(o.bottom.color2) : null;
  const R = ramp(col);
  const line = (pts, tone, hiT) => {
    for (let k = 0; k + 1 < pts.length; k++) {
      const a = pts[k], b = pts[k + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 1.5));
      for (let i = 0; i <= n; i++) {
        const x = lerp(a[0], b[0], i / n), y = lerp(a[1], b[1], i / n);
        if (hiT) { const up = L.get(Math.floor(x), Math.floor(y) - 1); if (up && up !== tone && up !== c2) L.paint(x, y - 1, hiT); }
        const cur = L.get(Math.floor(x), Math.floor(y));
        if (cur && cur !== c2) L.paint(x, y, tone);
      }
    }
  };
  const fold = (pts) => line(pts, R.s2, R.li);
  for (const i of idx) {
    const gl = g.legs[i], s = gl.s;
    // ponto na perna: t ao longo (0 quadril, 1 joelho, 2 tornozelo), k de -1 (dentro) a 1 (fora)
    const Q = (t, k) => {
      const p = legAt(gl, t), d = legDir(gl, t), [wo, wi] = profAt(prof, t);
      const off = k >= 0 ? k * wo : k * wi;
      return [p[0] + s * d[1] * off, p[1] - s * d[0] * off];
    };
    // no perfil: k > 0 = frente (esquerda)
    const Qs = (t, k) => { const p = legAt(gl, t), [wo, wi] = profAt(prof, t); return [p[0] - (k >= 0 ? k * wo : k * wi), p[1]]; };
    const long = !SHORTS.has(st);
    if (V === 'side') {
      if (long) {
        fold([Qs(0.85, -0.6), Qs(1.0, 0.2), Qs(1.1, 0.6)]);
        fold([Qs(1.25, -0.5), Qs(1.35, 0.4)]);
        if (st === 'cargo' || st === 'trackpants') { fold([Qs(1.62, -0.7), Qs(1.68, 0.6)]); fold([Qs(1.72, -0.4), Qs(1.76, 0.5)]); }
      }
      if ((st === 'cargo' || st === 'trackpants') && c2) for (let t = 0.04; t < 1.78; t += 0.02) { const q = legAt(gl, t); L.paint(q[0], q[1], c2); }
      if (st === 'jeans') for (let t = 0.1; t < 1.95; t += 0.02) { const q = legAt(gl, t); L.paint(q[0] + 0.6, q[1], R.li); }
    } else {
      if (long) {
        // dobras sempre na mesma direção da tela (kx: -1 esquerda, 1 direita)
        const X = (t, kx) => Q(t + (i ? 0.05 : 0), s * kx);
        fold([X(0.14, -0.55), X(0.42, 0.35)]);
        fold([X(0.84, -0.85), X(0.98, 0.05), X(1.06, 0.6)]);
        fold([X(1.26, -0.55), X(1.38, 0.45)]);
        if (st === 'cargo' || st === 'trackpants') {
          fold([X(1.6, -0.95), X(1.65, 0), X(1.61, 0.85)]);
          fold([X(1.71, -0.6), X(1.74, 0.55)]);
        }
      }
      // listra lateral
      if ((st === 'cargo' || st === 'trackpants') && c2) for (let t = 0.03; t < 1.78; t += 0.015) { const q = Q(t, 0.74); L.paint(q[0], q[1], c2); }
      if (st === 'jeans') {
        for (let t = 0.12; t < 1.95; t += 0.015) { const q = Q(t, 0.72); L.paint(q[0], q[1], R.li); }
        for (let t = 0.3; t < 1.95; t += 0.015) { const q = Q(t, -0.75); L.paint(q[0], q[1], R.s1); }
        // desbotado na coxa
        for (let t = 0.2; t < 0.7; t += 0.03) for (let k = -0.2; k < 0.4; k += 0.2) { const q = Q(t, k); if (((q[0] | 0) + (q[1] | 0)) % 2) L.paint(q[0], q[1], R.li); }
      }
    }
    // short jeans: costura clara, barra desfiada com fiapos sobre a coxa
    if (st === 'denimshorts' || st === 'shortshorts') {
      const tEnd = prof[prof.length - 1][0], q0 = V === 'side' ? Qs : Q;
      for (let k = -1; k <= 1.001; k += 0.08) {
        const a = q0(tEnd - 0.03, k);
        L.paint(a[0], a[1], st === 'denimshorts' ? R.li : R.s1);
        if (st === 'denimshorts') {
          const b = q0(tEnd - 0.07, k); L.paint(b[0], b[1], mix(col, '#ffffff', 0.35));
          if (mod(Math.round(k * 12.5), 3) === 0) { const d = q0(tEnd + 0.03, k); L.paint(d[0], d[1], mix(col, '#ffffff', 0.55)); }
        }
      }
      if (st === 'denimshorts' && V !== 'side') for (let t = 0.08; t < tEnd - 0.05; t += 0.015) { const q = Q(t, 0.7); L.paint(q[0], q[1], R.li); }
    }
    // boca de sino da flare: sombra por dentro e barra
    if (st === 'flare') {
      for (let t = 1.55; t <= 2.26; t += 0.012) for (let k = -1; k <= 1; k += 0.07) {
        const q = V === 'side' ? Qs(t, k) : Q(t, k);
        const cur = L.get(Math.floor(q[0]), Math.floor(q[1]));
        if (!cur) continue;
        if (t > 2.2) L.paint(q[0], q[1], R.s2);
        else if (Math.abs(k) < 0.15 && t > 1.7) L.paint(q[0], q[1], R.s1);
      }
    }
    // punho elástico
    if (st === 'cargo' || st === 'trackpants') {
      for (let t = 1.83; t <= 2.0; t += 0.01) {
        for (let k = -1; k <= 1; k += 0.08) {
          const q = V === 'side' ? Qs(t, k) : Q(t, k);
          const cur = L.get(Math.floor(q[0]), Math.floor(q[1]));
          if (!cur || cur === c2) continue;
          const rib = (Math.floor(q[0]) % 2) === 0;
          L.paint(q[0], q[1], t < 1.86 ? R.s2 : rib ? R.s1 : cur);
        }
      }
    }
    // bolso lateral da cargo (com aba e botão)
    if (st === 'cargo' && V !== 'back') {
      const ctr = V === 'side' ? legAt(gl, 0.55) : Q(0.56, 0.62);
      const w = 7, h = 11;
      const x0 = Math.round(ctr[0] - w / 2 + (V === 'side' ? 0 : s * 1.2)), y0 = Math.round(ctr[1] - h / 2);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (y === h - 1 && (x === 0 || x === w - 1)) continue;
        const edge = x === 0 || x === w - 1 || y === h - 1;
        const v = y === 3 ? R.s2 : y < 3 ? (y === 0 ? R.li : R.b) : edge ? (x === 0 ? R.li : R.s2) : x === w - 2 ? R.s1 : R.b;
        L.set(x0 + x, y0 + y, v);
      }
      L.set(x0 + 3, y0 + 2, R.hi);
    }
  }
  if (V === 'front' && idx.length === 2) {
    const t = g.tor, y = g.waist;
    // cós, passantes, braguilha e bolsos da frente
    for (let x = Math.floor(t.hp[0][0]); x <= t.hp[1][0]; x++) { L.paint(x, y + 2, R.s2); if (st === 'jeans' || st === 'pants' || st === 'cargo') L.paint(x, y + 1, R.li); }
    if (st === 'trackpants') { for (const dx of [-2, 1]) for (let k = 3; k < 7; k++) L.paint(g.cx + dx + (k > 4 ? dx * 0.3 : 0), y + k, c2 || WHITE); }
    else if (st !== 'leggings') {
      for (let k = 3; k < 10; k++) L.paint(g.cx + (k > 7 ? -0.5 : 0.5), y + k, R.s2);
      for (const sx of [-1, 1]) for (let k = 0; k < 6; k++) L.paint(g.cx + sx * (12 - k * 0.5) - (sx > 0 ? 1 : 0), y + 3 + k, R.s2);
      for (const sx of [-1, 1]) L.paint(g.cx + sx * 6, y + 1, R.s2);
      if (st === 'jeans' || st === 'denimshorts') { L.paint(g.cx, y + 2, '#d8b04a'); L.paint(g.cx + 1, y + 2, '#a8802a'); }
    }
  }
}

// ------------------------------------------------------------------ calçados
// pé descalço (do tornozelo até a ponta) e pé no salto alto (calcanhar erguido)
const BARE_FOOT = [-3.6, -1, 3.4, -1, 5, 4, 8, 6.5, 12.5, 8.5, 14, 10.5, 14, 13.5, -7.5, 13.5, -6.8, 8, -4.8, 4];
const HEEL_FOOT = [-3.6, -1, 3.4, -1, 5.5, 4.5, 9.5, 9.5, 13.5, 12.2, 15.2, 13.6, 15.2, 14.8, 8, 14.8, 2, 12, -6.2, 8.8, -6.8, 6, -4.8, 2];
// cano da bota de cano alto (perfil ao longo da perna, como as calças)
const KNEE_BOOT = [[1.06, 5.0, 4.5], [1.4, 5.1, 4.4], [1.85, 4.0, 3.7], [2.0, 4.0, 3.7]];
const SHOE = {
  upper: [-3, -4, 2, -3.6, 4.2, -1, 8, 2, 12, 4.4, 14.8, 6.8, 16, 9.5, 15.8, 11.5, -8.6, 11.5, -8.9, 4, -7.6, 0.5, -5.4, -2.2],
  top: [[-3, -4], [2, -3.6], [4.2, -1], [8, 2], [12, 4.4], [14.8, 6.8], [16, 9.5]],
  sole: [-9.6, 10.5, 16.4, 10.5, 16.8, 12.5, 16, 15.6, -9.2, 15.6, -9.8, 13.5],
};
function topEdge(lx) {
  const t = SHOE.top;
  if (lx <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) if (lx <= t[i][0]) return lerp(t[i - 1][1], t[i][1], (lx - t[i - 1][0]) / (t[i][0] - t[i - 1][0]));
  return t[t.length - 1][1];
}
function ptShoe(c, i, far) {
  const { P, o, g, V } = c;
  const gl = g.legs[i];
  const sh = o.shoes, st = sh.style;
  const col = lift(sh.color), c2 = sh.color2 ? lift(sh.color2) : WHITE;
  const R = ramp(col);
  const L = P.layer();
  const [ax, ay] = gl.an;
  const fem = o.female ? 0.9 : 1;
  const sole = st === 'sneakers' ? WHITE : st === 'runners' ? (lum(col) > 0.8 ? '#d8dbe2' : WHITE) : st === 'sandals' ? s1(col) : st === 'boots' || st === 'kneeboots' ? '#3a2a22' : st === 'platform' ? (lum(col) > 0.8 ? '#f4f0e6' : WHITE) : '#26222a';
  const cuffed = o.legs === 'cargo' || o.legs === 'trackpants';
  const keep = new Set([WHITE, c2, sole, '#e8e8ec', '#c8ccd6']);
  if (st === 'kneeboots') {
    // cano até o joelho, por cima da perna (ou por baixo da calça comprida)
    const S = P.layer();
    const prof = KNEE_BOOT.map(([t, a, b]) => [t, a * fem, b * fem]);
    S.poly(legPoly(gl, prof), col);
    shade(S, { s: 2, d: 1, l: 1 });
    const sg = V === 'side' ? -1 : gl.s;
    const Q = (t, k) => { const p = legAt(gl, t), d = legDir(gl, t), [wo, wi] = profAt(prof, t), off = k >= 0 ? k * wo : k * wi; return [p[0] + sg * d[1] * off, p[1] - sg * d[0] * off]; };
    for (let k = -1; k <= 1.001; k += 0.06) { const a = Q(1.09, k), b = Q(1.14, k); S.paint(a[0], a[1], R.li); S.paint(b[0], b[1], R.s2); }
    if (V !== 'back') for (let t = 1.2; t < 1.95; t += 0.02) { const q = Q(t, V === 'side' ? 0.55 : -0.55); S.paint(q[0], q[1], R.s2); }
    else for (let t = 1.2; t < 1.95; t += 0.02) { const q = Q(t, 0); S.paint(q[0], q[1], R.s1); }
    put(c, S, null, { dim: far });
  }
  if (V !== 'back') {
    const s = V === 'side' ? -1 : gl.s;
    const kx = (V === 'side' ? 1.05 : 0.98) * fem;
    // coordenadas locais: lx para a ponta do pé, ly para baixo a partir do tornozelo
    const loc = (x, y) => [(x + 0.5 - ax) * s / kx, (y + 0.5 - ay) / fem];
    const at = (lx, ly) => [ax + s * lx * kx, ay + ly * fem];
    const fill = (test) => {
      for (let y = Math.floor(ay - 12); y <= ay + 18; y++) for (let x = Math.floor(ax - 22); x <= ax + 22; x++) {
        const [lx, ly] = loc(x, y);
        const v = test(lx, ly);
        if (v) L.set(x, y, v);
      }
    };
    if (st === 'sandals') {
      fill((lx, ly) => (inPoly(lx, ly, BARE_FOOT) ? o.skin : null));
      fill((lx, ly) => (inPoly(lx, ly, [-8, 13, 14.6, 13, 14.6, 15.6, -8, 15.6]) ? sole : null));
      shade(L, { s: 2, l: 1, skip: keep });
      for (let k = 0; k < 6; k++) { const q = at(1 + k, 6.5 + k * 0.6); L.paint(q[0], q[1], col); L.paint(q[0], q[1] + 1, R.s1); }
      for (let y = 7; y < 13; y++) { const q = at(-6, y), r = at(-5, y); L.paint(q[0], q[1], col); L.paint(r[0], r[1], R.s1); }
      const nail = at(12.5, 10.5); L.paint(nail[0], nail[1], mix(o.skin, '#ff8a8a', 0.3));
    } else if (st === 'heels' || st === 'flats' || st === 'flipflops') {
      fill((lx, ly) => (inPoly(lx, ly, st === 'heels' ? HEEL_FOOT : BARE_FOOT) ? o.skin : null));
      if (st === 'heels') {
        // escarpim: calcanhar e bico fechados, peito do pé de fora, salto fino
        fill((lx, ly) => (inPoly(lx, ly, HEEL_FOOT) && (lx < -1.6 + (ly - 4) * 0.12 && ly > 2.5 || lx > 7.6 - (ly - 9) * 0.35 && ly > 7.5) ? col : null));
        fill((lx, ly) => (Math.abs(lx + 5.3 - (ly - 9) * 0.06) < 0.9 && ly > 8.6 && ly < 15.7 ? (ly > 14.6 ? '#26222a' : R.s1) : null));
        fill((lx, ly) => (inPoly(lx, ly, [3, 13.4, 15.2, 13.4, 15.2, 15.7, 7.5, 15.7]) && ly > 14.6 ? '#26222a' : null));
      } else if (st === 'flats') {
        fill((lx, ly) => (inPoly(lx, ly, BARE_FOOT) && ly > 10.2 - Math.max(0, lx - 7) * 0.45 ? col : null));
        fill((lx, ly) => (inPoly(lx, ly, [-8, 13.4, 14.8, 13.4, 14.8, 15.6, -8, 15.6]) ? R.s2 : null));
      } else {
        fill((lx, ly) => (inPoly(lx, ly, [-8.4, 13.6, 15, 13.6, 15.2, 15.6, -8.4, 15.6]) ? col : null));
      }
      shade(L, { s: 2, d: st === 'flipflops' ? 0 : 1, l: 1, skip: keep });
      if (st === 'flats') { const b = at(9, 9.6), b2 = at(10, 9.6), b3 = at(9.5, 10.6); L.paint(b[0], b[1], R.li); L.paint(b2[0], b2[1], R.s2); L.paint(b3[0], b3[1], R.li); }
      if (st === 'heels') { const h1 = at(11, 10.6), h2 = at(12, 11.2); L.paint(h1[0], h1[1], R.hi); L.paint(h2[0], h2[1], R.li); }
      if (st === 'flipflops') {
        // tira em V saindo entre os dedos
        for (let k = 0; k <= 6; k++) { const a = at(10.5 - k * 1.1, 9 + k * 0.62), b = at(10.5 - k * 0.6, 9 + k * 0.75); L.paint(a[0], a[1], col); L.paint(b[0], b[1], R.s1); }
        for (let y = 11; y < 13.5; y++) { const q = at(13, y); L.paint(q[0], q[1], ramp(o.skin).s1); }
      }
      const nail = at(st === 'heels' ? 14 : 12.5, st === 'heels' ? 13.4 : 10.5);
      if (st === 'flipflops') L.paint(nail[0], nail[1], mix(o.skin, '#ff8a8a', 0.3));
    } else if (st === 'platform') {
      // tênis de sola alta: cabedal baixo e sola grossa com faixa
      const up = (lx, ly) => inPoly(lx, (ly + 4) * 15.5 / 12.6 - 4, SHOE.upper);
      fill((lx, ly) => (up(lx, ly) ? col : null));
      fill((lx, ly) => (inPoly(lx, ly, [-9.8, 8, 16.4, 8, 17, 10.5, 16.5, 15.6, -9.4, 15.6, -10, 12]) ? sole : null));
      shade(L, { s: 2, d: 1, l: 1, skip: keep });
      const lace = lum(col) > 0.75 ? '#9aa0ae' : WHITE;
      fill((lx, ly) => {
        if (!up(lx, ly)) return null;
        const yy = (ly + 4) * 15.5 / 12.6 - 4;
        if (yy - topEdge(lx) < 1.8 && lx > -1.5 && lx < 10.5) return mod(lx, 3) < 1.2 ? lace : R.li;
        if (lx > 11.5 && yy > 5.5) return yy > 9 ? R.s1 : R.b;
        return null;
      });
      fill((lx, ly) => {
        if (!inPoly(lx, ly, [-9.8, 8, 16.4, 8, 17, 10.5, 16.5, 15.6, -9.4, 15.6, -10, 12])) return null;
        if (ly > 14.6) return s2(sole);
        if (ly > 10.6 && ly < 11.7) return lum(col) > 0.8 ? '#f2a6c8' : col;
        if (ly < 8.9) return s1(sole);
        return null;
      });
    } else if (st === 'kneeboots') {
      // bota justa de salto bloco
      fill((lx, ly) => (inPoly(lx, ly, [-5, -10, 4.5, -10, 5, 1, 8, 4, 12, 6.5, 14.5, 9, 15, 12.6, -7, 12.6, -7.2, 6, -6.4, 1]) ? col : null));
      fill((lx, ly) => (inPoly(lx, ly, [3, 12.4, 15.4, 12.4, 15.4, 14.2, 13, 15.6, 3, 15.6]) || inPoly(lx, ly, [-7.4, 12.4, -2.8, 12.4, -3.2, 15.6, -7, 15.6]) ? sole : null));
      shade(L, { s: 2, d: 1, l: 1, skip: keep });
      const h1 = at(11, 7.2), h2 = at(12, 7.8); L.paint(h1[0], h1[1], R.hi); L.paint(h2[0], h2[1], R.li);
    } else if (st === 'boots') {
      fill((lx, ly) => (inPoly(lx, ly, [-6, -10, 5, -10, 5.4, 1, 8, 3.2, 11.5, 5, 13.8, 7, 14.8, 9.5, 14.6, 11.5, -8, 11.5, -8.2, 6, -7.2, 1]) ? col : null));
      fill((lx, ly) => (inPoly(lx, ly, [-8.8, 11, 15.2, 11, 15.4, 13, 14.8, 15.6, -8.6, 15.6]) ? sole : null));
      shade(L, { s: 2, d: 1, l: 1, skip: keep });
      if (st === 'boots') {
        for (let y = -9; y <= 1; y += 2) { const q = at(2, y), r = at(3, y + 1); L.paint(q[0], q[1], R.li); L.paint(r[0], r[1], R.s2); }
        for (let x = -6; x <= 5; x++) { const q = at(x, -8); L.paint(q[0], q[1], R.s2); }
      } else for (let y = 13.2; y < 15.7; y++) for (let x = -8; x < -3; x++) { const q = at(x, y); L.paint(q[0], q[1], '#26222a'); }
      const h1 = at(11, 7.5), h2 = at(12, 8); L.paint(h1[0], h1[1], R.hi); L.paint(h2[0], h2[1], R.li);
      for (let x = -8; x <= 15; x++) { const q = at(x, 15.2); L.paint(q[0], q[1], s2(sole)); }
    } else if (st === 'formal') {
      fill((lx, ly) => (inPoly(lx, ly, [-4, 0, 1.5, 0, 5, 3.5, 10, 6, 14, 8, 15.5, 10.5, 15, 12.6, -7.6, 12.6, -7.8, 4, -6.4, 1]) ? col : null));
      fill((lx, ly) => (inPoly(lx, ly, [-8, 12.4, 15.6, 12.4, 15.2, 13.8, -2.5, 13.8, -2.5, 15.6, -8, 15.6]) ? sole : null));
      shade(L, { s: 2, d: 1, l: 1, skip: keep });
      for (const [lx, ly, t] of [[10, 6.8, R.hi], [11, 7, R.hi], [12, 7.6, R.li], [-5, 2, R.hi]]) { const q = at(lx, ly); L.paint(q[0], q[1], t); }
      for (let x = 0; x <= 5; x++) { const q = at(x, x * 0.7 + 1); L.paint(q[0], q[1], R.s2); }
    } else {
      // tênis robusto em 3/4: peito do pé com cadarço, biqueira, listras e solado grosso
      if (cuffed && V !== 'side') fill((lx, ly) => (lx > -5.5 && lx < 2.5 && ly > -7 && ly < -2.5 ? '#e8e8ec' : null));
      fill((lx, ly) => (inPoly(lx, ly, SHOE.upper) ? col : null));
      fill((lx, ly) => (inPoly(lx, ly, SHOE.sole) ? sole : null));
      shade(L, { s: 2, d: 1, l: 1, skip: keep });
      const toe = st === 'runners' ? c2 : WHITE;
      const lace = lum(col) > 0.75 ? '#9aa0ae' : WHITE;
      fill((lx, ly) => {
        if (!inPoly(lx, ly, SHOE.upper)) return null;
        const dy = ly - topEdge(lx);
        if (lx > 11.2 && ly > 5.5 && ly < 10.5) return ly > 9 ? s1(toe) : toe;           // biqueira
        if (dy < 1.6 && lx > -1.5 && lx < 10.5) return mod(lx, 3) < 1.2 ? lace : R.li;   // cadarço no peito do pé
        if (st === 'runners' && ly > 3.2 && ly < 10.5 && lx > -5.2 && lx < 3.6) {        // três listras
          const ph = mod(lx + ly * 0.6, 3.2);
          if (ph < 1.15) return ly > 8.5 ? s1(c2) : c2;
        }
        if (st === 'sneakers' && ly > 6.5 && ly < 7.6 && lx > -7.5 && lx < 10) return R.li;
        if (lx < -7 && ly < 3.5) return st === 'runners' ? c2 : R.s1;                    // calcanhar
        return null;
      });
      // sola: entressola clara, friso e borracha escura
      fill((lx, ly) => {
        if (!inPoly(lx, ly, SHOE.sole)) return null;
        if (ly > 14.6) return sole === WHITE ? '#5a5a66' : s2(sole);
        if (ly > 12.4 && ly < 13.4) return sole === WHITE ? '#d4d6de' : s1(sole);
        return null;
      });
    }
  } else if (st === 'heels' || st === 'flats' || st === 'flipflops') {
    // de costas: calcanhar de fora
    const w = 4.6 * fem;
    const hy = st === 'heels' ? ay + 9.5 : ay + 13.5;
    L.poly([ax - w + 1, ay - 2, ax + w - 1, ay - 2, ax + w, ay + 4, ax + w * 0.8, hy, ax - w * 0.8, hy, ax - w, ay + 4], o.skin);
    if (st === 'heels') {
      // a sola da frente do pé aparece no chão, atrás do salto fino
      L.poly([ax - w * 0.9, ay + 13.2, ax + w * 0.9, ay + 13.2, ax + w * 0.7, ay + 15.6, ax - w * 0.7, ay + 15.6], s2(col));
      L.poly([ax - w, ay + 5.5, ax + w, ay + 5.5, ax + w * 0.75, hy + 0.5, ax - w * 0.75, hy + 0.5], col);
      L.rect(Math.round(ax - 1), Math.round(hy), 2, Math.round(ay + 15.6 - hy), col);
      L.rect(Math.round(ax - 1), Math.round(ay + 14.8), 2, 1, '#26222a');
    }
    else if (st === 'flats') { L.poly([ax - w - 0.6, ay + 9.5, ax + w + 0.6, ay + 9.5, ax + w + 0.6, ay + 15.6, ax - w - 0.6, ay + 15.6], col); L.rect(Math.round(ax - w - 1), Math.round(ay + 14), Math.round(2 * w + 2), 2, R.s2); }
    else { L.poly([ax - w - 0.8, ay + 13.6, ax + w + 0.8, ay + 13.6, ax + w + 0.8, ay + 15.6, ax - w - 0.8, ay + 15.6], col); L.set(Math.round(ax - w), Math.round(ay + 11), col); L.set(Math.round(ax + w - 1), Math.round(ay + 11), col); }
    shade(L, { s: 2, d: 1, l: 1, skip: keep });
  } else {
    // de costas: calcanhar
    const w = (st === 'runners' || st === 'sneakers' || st === 'platform' ? 6.4 : 5.8) * fem;
    const top = st === 'boots' || st === 'kneeboots' ? ay - 10 : ay - 2;
    if (cuffed && (st === 'runners' || st === 'sneakers')) L.rect(Math.round(ax - 3.5), Math.round(ay - 6), 7, 5, '#e8e8ec');
    L.poly([ax - w + 1.5, top, ax + w - 1.5, top, ax + w, top + 3, ax + w + 0.3, ay + 11.5, ax - w - 0.3, ay + 11.5, ax - w, top + 3], st === 'sandals' ? o.skin : col);
    L.poly([ax - w - 1, st === 'platform' ? ay + 8 : ay + 11, ax + w + 1, st === 'platform' ? ay + 8 : ay + 11, ax + w + 1, ay + 15.6, ax - w - 1, ay + 15.6], sole);
    if (st === 'sandals') { L.rect(Math.round(ax - w), Math.round(ay + 8), Math.round(2 * w), 2, col); }
    if (st === 'platform') L.rect(Math.round(ax - w - 1), Math.round(ay + 11), Math.round(2 * w + 2), 1, lum(col) > 0.8 ? '#f2a6c8' : col);
    shade(L, { s: 2, d: 1, l: 1, skip: keep });
    if (st === 'sneakers' || st === 'runners' || st === 'platform') { L.rect(Math.round(ax - 1.5), Math.round(ay + 1), 3, st === 'platform' ? 5 : 7, st === 'runners' ? c2 : WHITE); L.rect(Math.round(ax - 1.5), Math.round(ay + 7), 3, 1, s1(st === 'runners' ? c2 : WHITE)); }
    for (let x = Math.floor(ax - w - 1); x <= ax + w + 1; x++) { L.paint(x, ay + 15.2, sole === WHITE ? '#5a5a66' : s2(sole)); L.paint(x, ay + 12.8, sole === WHITE ? '#d4d6de' : s1(sole)); }
  }
  put(c, L, null, { dim: far, soft: skinSet(o.skin) });
}

// ------------------------------------------------------------------ pescoço
function ptNeck(c) {
  const { P, o, g, V } = c;
  const L = P.layer();
  const H = g.head;
  const x0 = V === 'side' ? H.x + 0 : H.x - 4, w = V === 'side' ? 7 : 8;
  L.rect(x0, H.y + 7, w, 36 + 8 - H.y - 7, o.skin);
  // decote: pele que aparece dentro da gola
  const nk = neckOf(o.top, V);
  if (nk && V === 'front') {
    const t = g.tor, cx = g.cx, y = t.nk[2];
    L.poly([cx - nk.half - 1.5, y - 1, cx + nk.half + 1.5, y - 1, cx + 1.2, y + nk.depth + 1, cx - 1.2, y + nk.depth + 1], o.skin);
  }
  shade(L, { s: 2, l: 0 });
  // pescoço na sombra da cabeça
  L.map((v, x, y) => (y < H.y + 15 ? s2(o.skin) : y < H.y + 19 ? s1(o.skin) : v));
  put(c, L, null);
}

// ------------------------------------------------------------------ tronco
const SLEEVE = { tee: 'short', striped: 'short', tank: 'none', hoodie: 'long', jacket: 'long', coat: 'long', sweater: 'long', dress: 'puff', labcoat: 'long', vest: 'short', kimono: 'wide', suit: 'long', jersey: 'short',
  croptop: 'short', blouse: 'ruffle', offshoulder: 'off', body: 'tight', sundress: 'none', longdress: 'none', partydress: 'none', bikini: 'none', swimsuit: 'none' };
const NECK = { croptop: ['u', 3, 4], blouse: ['u', 2, 3.5], body: ['u', 3.5, 5], jersey: ['v', 8, 4.5], kimono: ['v', 11, 5], tee: ['u', 3, 4], striped: ['u', 3, 4], dress: ['u', 4, 5], sweater: ['u', 2, 3.5], tank: ['u', 6, 5], hoodie: ['u', 1.5, 3.5], jacket: ['u', 1.5, 3.5], suit: ['v', 10, 4], labcoat: ['v', 9, 4], vest: ['v', 8, 4], coat: ['u', 1, 3] };
function neckOf(top, V) {
  if (V === 'side') return null;
  if (V === 'back') return { type: 'u', depth: 1, half: 4 };
  const n = NECK[top.style];
  return n ? { type: n[0], depth: n[1], half: n[2] } : null;
}

function hemOf(c) {
  const st = c.o.top.style;
  if (st === 'blouse') return c.o.female ? 70 : 72;
  return st === 'tank' || c.o.female && (st === 'tee' || st === 'striped' || st === 'jersey' || st === 'sweater' || NEW_TOPS.has(st)) ? 68.5 : st === 'suit' ? 74 : 71;
}
function torsoPts(c, nk) {
  const { g, V, o } = c;
  const st = o.top.style;
  if (V === 'side') {
    const s = g.side, f = s.fr, b = s.bk;
    const hemY = st === 'tank' || o.female && st !== 'suit' ? 68.5 : st === 'suit' ? 74 : 71;
    return [s.nk[0], s.nk[2], s.nk[1], s.nk[2], b[0][0], b[0][1], b[1][0], b[1][1], b[2][0], b[2][1], b[3][0], b[3][1], b[4][0] + 0.5, hemY, f[4][0] - 0.5, hemY, f[3][0], f[3][1], f[2][0], f[2][1], f[1][0], f[1][1], f[0][0], f[0][1]];
  }
  const t = g.tor, cx = g.cx, y = t.nk[2];
  const hemY = hemOf(c);
  const pts = [t.nk[0], y, t.sh[0][0], t.sh[0][1], t.sh[0][0] - 1, t.sh[0][1] + 3, t.ap[0][0], t.ap[0][1], t.ch[0][0], t.ch[0][1], t.wa[0][0], t.wa[0][1], t.hp[0][0] - 0.5, hemY,
    cx, hemY + 1, t.hp[1][0] + 0.5, hemY, t.wa[1][0], t.wa[1][1], t.ch[1][0], t.ch[1][1], t.ap[1][0], t.ap[1][1], t.sh[1][0] + 1, t.sh[1][1] + 3, t.sh[1][0], t.sh[1][1], t.nk[1], y];
  if (nk) {
    const { depth: d, half: h } = nk;
    if (nk.type === 'v') pts.push(cx + h, y, cx, y + d, cx - h, y);
    else pts.push(cx + h, y, cx + h * 0.7, y + d * 0.8, cx + h * 0.25, y + d, cx - h * 0.25, y + d, cx - h * 0.7, y + d * 0.8, cx - h, y);
  }
  return pts;
}

function topPaint(c) {
  const { o, g } = c;
  const top = o.top, st = top.style, col = lift(top.color);
  const cx = g.cx, ty = 36;
  if (st === 'jersey') {
    const cs = (top.colors || [top.color]).map(lift), n = cs.length;
    switch (top.pattern) {
      case 'vstripes': return (x) => cs[mod(Math.floor((x - cx) / 4 + 0.5) + (n === 2 ? 1 : 0), n)];
      case 'vstripes3': return (x) => cs[mod(Math.floor((x - cx) / 4 + 0.5), n)];
      case 'hstripes': case 'hstripes3': return (x, y) => cs[mod(Math.floor((y - ty - 1) / 4), n)];
      case 'sash': { const k = c.V === 'back' ? -1 : 1; return (x, y) => (Math.abs(k * (x + 0.5 - cx) - (y + 0.5 - ty) * 0.8 + 6) < 3.4 ? cs[1] : cs[0]); }
      case 'chestbands': return (x, y) => { const r = Math.floor(y - ty) - 9; return r >= 0 && r < 4 ? cs[1] : r >= 4 && r < 7 ? (cs[2] || cs[1]) : cs[0]; };
      default: return () => cs[0];
    }
  }
  if (st === 'striped') return (x, y) => (mod(Math.floor(y - ty), 6) >= 4 ? WHITE : col);
  if (st === 'labcoat') return () => WHITE;
  return () => col;
}

// ------------------------------------------------------------------ partes de cima novas (linha feminina)
// Cada peça é o tronco recortado por uma máscara (onde o tecido cobre); por baixo, a pele.
const BARE_TOPS = new Set(['croptop', 'offshoulder', 'sundress', 'longdress', 'partydress', 'bikini', 'swimsuit']);
const NEW_TOPS = new Set([...BARE_TOPS, 'blouse', 'body']);
const segDist = (x, y, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1));
  return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t);
};
// alturas de referência do tronco (decote, axila, peito, cintura)
function torsoY(c) {
  const { g, V } = c;
  if (V === 'side') { const s = g.side; return { yN: s.nk[2], yAp: 48, yCh: s.fr[2][1] + 1, yWa: s.fr[3][1] }; }
  const t = g.tor; return { yN: t.nk[2], yAp: t.ap[0][1], yCh: t.ch[0][1], yWa: t.wa[0][1] };
}
// alças: segmentos [a, b, largura]
function topStraps(c, st) {
  const { g, V, o } = c;
  const W = { sundress: 1.5, swimsuit: 2.8, longdress: 4.2, partydress: 1.1, bikini: 1.5 }[st];
  if (!W) return [];
  const { yAp, yN } = torsoY(c);
  if (V === 'side') {
    const s = g.side, top = [s.nk[0] + 3.2, s.nk[2]];
    if (st === 'bikini') return [[top, [s.fr[1][0] + 3.5, yAp - 2], W]];
    return [[top, [s.fr[1][0] + 4, yAp - 3], W], [top, [s.bk[1][0] - 3.5, yAp - 1], W]];
  }
  const t = g.tor, cx = g.cx, sw = o.female ? 5 : 6.5;
  const res = [];
  for (const k of [0, 1]) {
    const sx = k ? 1 : -1;
    const top = st === 'bikini' ? [t.nk[k] - sx * 0.5, yN + 0.5] : lp([t.nk[k], yN], t.sh[k], st === 'longdress' ? 0.3 : 0.42);
    const bot = st === 'bikini' ? [cx + sx * (V === 'back' ? 1.5 : 4.5), yAp - 2] : [cx + sx * (st === 'longdress' ? sw - 0.5 : sw + 0.5), yAp - 3];
    if (st === 'bikini' && V === 'back') { res.push([[t.nk[k] + sx * 1.2, yN + 1], [cx + sx * 0.5, yN + 3.5], W]); continue; }
    res.push([top, bot, W]);
  }
  return res;
}
function topMask(c) {
  const { o, g, V } = c, st = o.top.style;
  const { yAp, yCh } = torsoY(c);
  const side = V === 'side', back = V === 'back', cx = g.cx;
  const straps = topStraps(c, st);
  const onStrap = (x, y) => straps.some(([a, b, w]) => segDist(x, y, a, b) < w / 2);
  const dxOf = (x) => (side ? 99 : Math.abs(x - cx));
  let body;
  switch (st) {
    case 'croptop': body = (x, y) => y < yCh + 3.5; break;
    case 'offshoulder': body = (x, y) => y >= yAp - 3.5; break;
    case 'bikini': {
      const y0 = yAp - 2.5, y1 = yCh + 0.5;
      body = back ? (x, y) => y >= y0 + 1 && y < y1 - 1.5
        : (x, y) => y >= y0 && y < y1 && !(dxOf(x) < 1.1 && y < y0 + 1.6);
      break;
    }
    case 'swimsuit': body = (x, y) => y >= (back ? yAp - 1 : yAp - 4.5 + (side ? 0 : 3 * Math.max(0, 1 - (dxOf(x) / 5.5) ** 2))); break;
    case 'sundress': body = (x, y) => y >= (back ? yAp - 2.5 : yAp - 4); break;
    case 'longdress': body = (x, y) => y >= (back ? yAp - 2 : yAp - 6.5 + (side ? 0 : 6 * Math.max(0, 1 - dxOf(x) / 4.5))); break;
    case 'partydress': body = (x, y) => { const d = dxOf(x); return y >= (back ? yAp - 2.5 : yAp - 4 + (d < 4.5 ? 0.12 * (d - 4.5) ** 2 : 0) + (side ? 0.5 : 0)); }; break;
    default: return null;
  }
  return (x, y) => { const X = x + 0.5, Y = y + 0.5; return body(X, Y) || onStrap(X, Y); };
}

// barra da parte de baixo do maiô / calcinha do biquíni (polígono)
function briefPts(c, cover = 1) {
  const { g, V, o } = c;
  if (V === 'side') {
    const s = g.side, fx = s.fr[4][0], bx = s.bk[4][0];
    return [fx - 0.5, 67.5, bx + 0.5, 67.5, bx + 1, 70.5 + cover * 5, bx - 3, 72 + cover * 6, fx + 4, 72 + cover * 2, fx - 0.2, 70];
  }
  const t = g.tor, cx = g.cx, cr = g.crotch[1] - 0.4 + (V === 'back' ? 1.2 : 0), w = V === 'back' ? 5 : 3;
  const x0 = t.hp[0][0] + 1, x1 = t.hp[1][0] - 1, y0 = (o.female ? 68 : 69) + 0.6;
  return [x0, y0, x1, y0, x1, y0 + 1.8 + cover, cx + w, cr, cx - w, cr, x0, y0 + 1.8 + cover];
}

function ptTorso2(c) {
  const { P, o, g, V } = c;
  const top = o.top, st = top.style, col = lift(top.color), R = ramp(col);
  const t = g.tor, cx = g.cx;
  const { yN, yAp, yCh, yWa } = torsoY(c);
  const dressy = o.dress;
  // onde a pele termina embaixo (cós da peça de baixo / saia / calcinha)
  const skinCut = o.dress ? HEM[o.dk][0] + 1 : o.skirt ? 66 : o.legs !== 'skin' ? g.waist : o.brief ? 69 : 71;
  // por dentro da calça/saia
  const tuckY = o.tucked ? (o.skirt ? 66 : o.legs !== 'skin' ? g.waist : 68.6) : 99;
  if (BARE_TOPS.has(st)) {
    const B = P.layer();
    B.poly(torsoPts(c, null), o.skin);
    B.keep((x, y) => y + 0.5 < skinCut);
    shade(B, { s: 3, l: 2, dir: [0.92, 0.38] });
    // umbigo discreto quando a barriga aparece
    if (V === 'front' && (st === 'croptop' || st === 'bikini') && 63 < skinCut - 1) { B.paint(cx, 63, s1(o.skin)); B.paint(cx, 64, li(o.skin)); }
    put(c, B, null);
  }
  const nk = neckOf(top, V);
  const L = P.layer();
  const paint = topPaint(c);
  L.poly(torsoPts(c, nk), paint);
  const m = topMask(c);
  if (m) L.keep(m);
  if (o.swimBrief) L.poly(briefPts(c, 1), paint);
  L.keep((x, y) => y + 0.5 < tuckY || (o.swimBrief && y > 60));
  if (dressy) L.keep((x, y) => y + 0.5 < (st === 'longdress' ? yWa : yWa + 2.5));
  shade(L, { s: V === 'side' ? 3 : 5, d: 2, l: 3, hi: 0, dir: [0.92, 0.38] });
  if (nk) collar(L, c, nk);
  top2Details(L, c);
  put(c, L, null, { soft: dressy ? skinSet(col) : null });
}

// detalhes das partes de cima novas
function top2Details(L, c) {
  const { o, g, V } = c;
  const top = o.top, st = top.style, col = lift(top.color), R = ramp(col);
  const cx = g.cx, side = V === 'side';
  const { yN, yAp, yCh, yWa } = torsoY(c);
  const xs = side ? [24, 56] : [Math.floor(g.tor.hp[0][0]) - 2, Math.ceil(g.tor.hp[1][0]) + 2];
  const rowEdge = (y, fn) => { for (let x = xs[0]; x <= xs[1]; x++) { const v = L.get(x, y); if (v != null) fn(x, y, v); } };
  // barra de baixo de cada coluna (para franzidos e babados)
  const bottomOf = (x) => { for (let y = L.h - 1; y >= 30; y--) if (L.get(x, y) != null) return y; return -1; };
  const topOf = (x) => { for (let y = 30; y < L.h; y++) if (L.get(x, y) != null) return y; return -1; };
  const darker = (x, y) => { const v = L.get(x, y); if (v) L.set(x, y, s1(v)); };
  const lighter = (x, y) => { const v = L.get(x, y); if (v) L.set(x, y, li(v)); };
  // dobras do tronco puxadas pelo braço erguido (como nas outras blusas)
  if (V === 'front' && !['bikini'].includes(st)) {
    const t = g.tor;
    for (let k = 0; k < 4; k++) { darker(Math.floor(t.ap[0][0] + 2 + k), Math.floor(t.ap[0][1] + 6 + k * 0.9)); lighter(Math.floor(t.ap[0][0] + 2 + k), Math.floor(t.ap[0][1] + 5 + k * 0.9)); }
  }
  switch (st) {
    case 'croptop': {
      // barra com acabamento e sombra projetada na barriga
      for (let x = xs[0]; x <= xs[1]; x++) { const b = bottomOf(x); if (b > 0) L.set(x, b, R.s2); }
      break;
    }
    case 'offshoulder': {
      // babado elástico na borda de cima
      for (let x = xs[0]; x <= xs[1]; x++) {
        const t0 = topOf(x); if (t0 < 0) continue;
        L.set(x, t0, mod(x, 3) === 0 ? R.s1 : R.hi);
        if (L.get(x, t0 + 1) != null) L.set(x, t0 + 1, mod(x, 3) === 0 ? R.s1 : R.li);
        if (L.get(x, t0 + 2) != null) L.set(x, t0 + 2, R.s2);
      }
      break;
    }
    case 'bikini': {
      // costura do bojo e laço nas costas
      if (V === 'front') { for (let y = Math.floor(yAp - 1); y < yCh; y++) { L.paint(cx - 1, y, R.s1); } }
      if (V === 'back') { L.set(cx - 1, Math.floor(yAp), R.s2); L.set(cx, Math.floor(yAp), R.s2); L.set(cx - 2, Math.floor(yAp + 1), R.li); L.set(cx + 1, Math.floor(yAp + 1), R.li); L.set(cx - 1, Math.floor(yAp + 2), col); L.set(cx, Math.floor(yAp + 2), R.s1); }
      break;
    }
    case 'swimsuit': {
      // brilho do tecido e cavas da perna
      if (V === 'front') for (let k = 0; k < 6; k++) L.paint(cx - 6 + k * 0.3, yCh + 1 + k, R.li);
      break;
    }
    case 'body': {
      // malha justa: reflexo vertical e costura lateral
      if (V === 'front') { for (let y = Math.floor(yAp); y < yWa + 4; y++) L.paint(cx - 6 + (y - yAp) * 0.08, y, R.li); for (let y = Math.floor(yAp + 2); y < yWa + 2; y++) L.paint(cx - 5 + (y - yAp) * 0.08, y, R.hi); }
      if (V === 'side') for (let y = Math.floor(yAp); y < yWa + 6; y++) L.paint(40, y, R.s1);
      break;
    }
    case 'blouse': {
      // babado no meio da frente, gola franzida e barra em babado
      if (V === 'front') for (let y = Math.floor(yN + 2); y < yCh + 3; y++) { const z = mod(y, 3); L.paint(cx - 1 + (z === 1 ? -1 : 0), y, R.hi); L.paint(cx, y, z === 0 ? R.s1 : R.li); L.paint(cx + 1 + (z === 2 ? 1 : 0), y, R.s1); }
      for (let x = xs[0]; x <= xs[1]; x++) {
        const b = bottomOf(x); if (b < 0) continue;
        L.set(x, b, mod(x, 3) === 1 ? R.s2 : R.s1);
        if (mod(x, 3) !== 1) L.set(x, b + 1, R.s1);
        if (L.get(x, b - 3) != null) L.set(x, b - 3, R.s2);
        if (L.get(x, b - 2) != null && mod(x, 3) === 0) L.set(x, b - 2, R.li);
      }
      break;
    }
    case 'sundress': case 'longdress': case 'partydress': {
      // costura da cintura
      const wy = st === 'longdress' ? yWa - 3 : yWa + 1;
      rowEdge(Math.floor(wy), (x, y) => L.set(x, y, R.s2));
      rowEdge(Math.floor(wy) - 1, (x, y, v) => L.set(x, y, st === 'partydress' ? R.hi : li(v)));
      if (st === 'partydress' && V === 'front') for (let k = 0; k < 5; k++) { L.paint(cx - 5 + k * 0.4, yAp - 1 + k, R.hi); L.paint(cx - 4 + k * 0.4, yAp - 1 + k, R.li); }
      break;
    }
    default: break;
  }
  if (st === 'sundress') flowers(L, col, 0);
}

// estampa de florzinhas (miolo + 4 pétalas) acompanhando o sombreado do tecido
function flowers(L, col, phase) {
  const R = ramp(col), [h] = toHsl(col);
  const P = lum(col) > 0.75 ? hsl(h + 180, 0.45, 0.62) : mix(col, '#ffffff', 0.62);
  const C = h > 30 && h < 70 && lum(col) > 0.55 ? '#e3608f' : '#ffe070';
  const PR = ramp(P);
  for (let y = L.y0; y <= L.y1; y++) for (let x = L.x0; x <= L.x1; x++) {
    const row = Math.floor((y + phase) / 6), cxp = mod(x + (row % 2) * 4 + 1, 8), cyp = mod(y + phase, 6);
    if (cxp > 2 || cyp < 1 || cyp > 3) continue;
    const v = L.get(x, y);
    if (v == null || v === R.s2 || v === R.ol) continue;
    const tone = v === R.s1 ? PR.s1 : v === R.hi || v === R.li ? PR.li : P;
    // linhas alternam flor em "+" e flor em "x"
    const diag = row % 2 === 1;
    if (cxp === 1 && cyp === 2) L.set(x, y, C);
    else if (diag ? cxp !== 1 && cyp !== 2 : (cxp === 1) !== (cyp === 2)) L.set(x, y, tone);
  }
}

function ptTorso(c) {
  const { P, o, g, V } = c;
  const top = o.top, st = top.style, col = lift(top.color);
  if (NEW_TOPS.has(st)) return ptTorso2(c);
  const nk = neckOf(top, V);
  const L = P.layer();
  const paint = topPaint(c);
  if (st === 'tank' && V !== 'side') {
    // regata: ombros de pele por baixo, alças estreitas
    const B = P.layer();
    B.poly(torsoPts(c, null), o.skin);
    shade(B, { s: 3, l: 2, dir: [0.92, 0.38] });
    put(c, B, null);
    const t = g.tor, t2 = { ...t, sh: [[t.sh[0][0] + 5.5, t.sh[0][1] - 1.5], [t.sh[1][0] - 5.5, t.sh[1][1] - 1.5]], ap: [[t.ap[0][0] + 1, t.ap[0][1] + 2], [t.ap[1][0] - 1, t.ap[1][1] + 2]] };
    L.poly(torsoPts({ ...c, g: { ...g, tor: t2 } }, nk), paint);
  } else L.poly(torsoPts(c, nk), paint);
  // casacos compridos: a barra faz parte da mesma peça
  const lt = LONG_TOPS[st];
  if (lt && !c.o.dress) {
    const legsX = g.legs.map((l) => l.kn[0]);
    const xl = Math.min(...legsX) - 8, xr = Math.max(...legsX) + 8;
    if (V === 'side') { const s = g.side; L.poly([s.fr[4][0], 66, s.bk[4][0], 66, s.bk[4][0] + 3, lt, s.fr[4][0] - 4, lt], paint); }
    else {
      const t = g.tor;
      L.poly([t.hp[0][0], 64, t.hp[1][0], 64, xr + (st === 'labcoat' ? 0 : 1), lt, xl - (st === 'labcoat' ? 0 : 1), lt], paint);
      if (V === 'front' && st !== 'kimono') { const open = st === 'labcoat' ? 5 : st === 'coat' ? 0 : 3; if (open) L.keep((x, y) => !(y > 76 && Math.abs(x + 0.5 - g.cx) < (y - 76) * 0.22 + open * 0.5)); }
    }
  }
  shade(L, { s: V === 'side' ? 3 : 5, d: 2, l: 3, hi: 0, dir: [0.92, 0.38] });
  if (lt && !c.o.dress) {
    const RR = ramp(st === 'labcoat' ? WHITE : col);
    for (let x = 8; x < 72; x++) L.paint(x, lt - 1, RR.s1);
    if (V === 'front' && st === 'labcoat') for (const s of [-1, 1]) { const x = g.cx + s * 11; for (let k = 0; k < 7; k++) L.paint(x - 3 + k, 86, RR.s1); L.paint(x - 3, 87, RR.s1); L.paint(x + 3, 87, RR.s1); }
    if (st === 'kimono') for (let x = 8; x < 72; x++) L.paint(x, lt - 2, WHITE);
  }
  if (nk) collar(L, c, nk);
  topDetails(L, c);
  put(c, L, null);
}

// gola acompanhando o recorte do decote
function collar(L, c, nk) {
  const { o, g, V } = c;
  const top = o.top, st = top.style, col = lift(top.color);
  const trim = st === 'jersey' ? lift(top.trim || WHITE) : st === 'kimono' ? WHITE : s1(col);
  const width = st === 'kimono' || st === 'jersey' && V === 'front' ? 2 : 1;
  const cx = g.cx, y0 = 36;
  const inNotch = (x, y) => L.get(x, y) == null && y >= y0 - 1 && y <= y0 + nk.depth + 1 && Math.abs(x + 0.5 - cx) < nk.half + 1.5;
  let ring = [];
  for (let y = y0 - 1; y <= y0 + nk.depth + 3; y++) {
    for (let x = Math.floor(cx - nk.half - 3); x <= cx + nk.half + 3; x++) {
      if (L.get(x, y) == null) continue;
      if (inNotch(x - 1, y) || inNotch(x + 1, y) || inNotch(x, y + 1) || inNotch(x, y - 1)) ring.push([x, y]);
    }
  }
  for (let k = 1; k < width; k++) {
    const next = [];
    for (const [x, y] of ring) for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1]]) {
      const nx = x + dx, ny = y + dy;
      if (L.get(nx, ny) != null && !ring.some(([a, b]) => a === nx && b === ny) && !next.some(([a, b]) => a === nx && b === ny)) next.push([nx, ny]);
    }
    ring = ring.concat(next);
  }
  for (const [x, y] of ring) L.set(x, y, x + 0.5 > cx + 1 ? s1(trim) : trim);
}

function topDetails(L, c) {
  const { o, g, V } = c;
  const top = o.top, st = top.style, col = lift(top.color), R = ramp(col);
  const cx = g.cx, y0 = 36;
  const hemY = hemOf(c);
  const P = (x, y, cl) => L.paint(x, y, cl);
  const darker = (x, y) => { const v = L.get(Math.floor(x), Math.floor(y)); if (v) L.set(Math.floor(x), Math.floor(y), s1(v)); };
  const lighter = (x, y) => { const v = L.get(Math.floor(x), Math.floor(y)); if (v) L.set(Math.floor(x), Math.floor(y), li(v)); };
  if (V === 'front') {
    const t = g.tor;
    // dobras do tecido: puxadas pelo braço erguido e franzido na cintura
    if (st !== 'labcoat' && st !== 'suit' && st !== 'coat') {
      for (let k = 0; k < 6; k++) { darker(t.ap[0][0] + 2 + k, t.ap[0][1] + 1 + k * 0.7); }
      for (let k = 0; k < 4; k++) { darker(t.ap[0][0] + 2 + k, t.ap[0][1] + 6 + k * 0.9); lighter(t.ap[0][0] + 2 + k, t.ap[0][1] + 5 + k * 0.9); }
      for (let k = 0; k < 3; k++) { darker(t.wa[1][0] - 2 - k, hemY - 6 + k * 0.5); darker(t.wa[0][0] + 3 + k, hemY - 4 - k * 0.4); }
      for (let x = Math.floor(t.hp[0][0]); x <= t.hp[1][0]; x++) darker(x, hemY - 1);
    }
    switch (st) {
      case 'jersey': {
        // escudo genérico no peito esquerdo e estrelinha
        const cr = top.crest || [WHITE, col];
        const cb = lift(cr[0]), cd = lift(cr[1]);
        const ol = lum(cb) > 0.5 ? '#2a2830' : s2(cb);
        const x = Math.round(cx + 6), y = y0 + 8;
        const sh = ['KKKKKKK', 'KBBDBBK', 'KBDDDBK', 'KBBDBBK', '.KBDBK.', '..KBK..', '...K...'];
        for (let j = 0; j < sh.length; j++) for (let i = 0; i < sh[j].length; i++) { const k = sh[j][i]; if (k !== '.') L.set(x + i, y + j, k === 'K' ? ol : k === 'B' ? cb : cd); }
        L.set(x + 3, y - 2, '#f2c230'); L.set(x + 3, y - 3, '#f8dc70'); L.set(x + 2, y - 2, '#c8901c'); L.set(x + 4, y - 2, '#c8901c');
        // logo de fabricante genérico do outro lado
        const tr = lift(top.trim || WHITE);
        if (top.pattern === 'vstripes' || top.pattern === 'solid' || !top.pattern) { L.set(cx - 9, y + 1, tr); L.set(cx - 8, y + 1, tr); L.set(cx - 9, y + 2, tr); L.set(cx - 7, y + 2, tr); }
        // barra
        for (let x = Math.floor(t.hp[0][0]); x <= t.hp[1][0]; x++) P(x, hemY, s1(L.get(x, Math.floor(hemY)) || col));
        break;
      }
      case 'tee': case 'striped': case 'sweater': {
        if (st === 'sweater') {
          for (let x = Math.floor(t.hp[0][0]); x <= t.hp[1][0]; x++) for (let y = hemY - 3; y <= hemY; y++) P(x, y, mod(x, 2) ? R.s1 : R.b);
          for (let y = y0 + 6; y < hemY - 4; y += 4) for (let x = Math.floor(cx - 10); x < cx + 10; x += 4) { lighter(x + (y % 8 ? 2 : 0), y); }
        }
        break;
      }
      case 'tank': {
        break;
      }
      case 'hoodie': {
        // capuz caído atrás do pescoço, cordões e bolso canguru
        L.ell(cx - 8, y0 + 1.5, 4, 3, R.s1); L.ell(cx + 8, y0 + 1.5, 4, 3, R.s1);
        L.ell(cx - 8, y0 + 1, 3, 2, R.b); L.ell(cx + 8, y0 + 1, 3, 2, R.b);
        for (let k = 2; k < 10; k++) { P(cx - 3, y0 + k, WHITE); P(cx + 2, y0 + k + (k > 6 ? 1 : 0), k > 5 ? s1(WHITE) : WHITE); }
        const py = hemY - 13;
        for (let y = py; y < hemY - 3; y++) for (let x = Math.floor(cx - 9 + (y - py) * -0.25); x < cx + 9 + (y - py) * 0.25; x++) P(x, y, y === py ? R.s2 : y < py + 2 ? R.li : L.get(x, y));
        for (let y = py + 1; y < hemY - 3; y++) { P(cx - 9 - (y - py) * 0.25, y, R.s2); P(cx + 9 + (y - py) * 0.25, y, R.s2); }
        for (let x = Math.floor(t.hp[0][0]); x <= t.hp[1][0]; x++) for (let y = hemY - 2; y <= hemY; y++) P(x, y, mod(x, 2) ? R.s1 : R.b);
        break;
      }
      case 'jacket': case 'suit': case 'labcoat': case 'vest': {
        const inner = st === 'labcoat' ? '#9cc0e4' : WHITE;
        // camisa por baixo, aberta no meio
        const half = st === 'suit' ? 4 : st === 'vest' ? 4.5 : 3.5;
        const yEnd = st === 'suit' ? y0 + 15 : hemY + 1;
        for (let y = y0; y < yEnd; y++) {
          const hw = st === 'suit' ? Math.max(0, half - (y - y0) * 0.27) : half;
          for (let x = Math.floor(cx - hw); x < cx + hw; x++) P(x, y, x >= cx ? s1(inner) : inner);
        }
        if (st === 'suit') {
          // gravata e lapelas
          for (let k = 1; k < 16; k++) { const w = k < 3 ? 1 : k < 13 ? 1.5 : 1; for (let x = Math.floor(cx - w); x < cx + w; x++) P(x, y0 + k, k === 1 || k === 2 ? '#a8302a' : x >= cx ? '#b8342e' : '#d8433c'); }
          for (let k = 0; k < 14; k++) { P(cx - 5 - k * 0.1 + (k > 9 ? (k - 9) * 0.5 : 0), y0 + k, R.s2); P(cx + 4 + k * 0.1 - (k > 9 ? (k - 9) * 0.5 : 0), y0 + k, R.s2); }
          for (let k = 0; k < 3; k++) P(cx - 1, y0 + 19 + k * 4, R.hi);
          for (let y = y0 + 15; y < hemY; y++) P(cx, y, R.s2);
        } else {
          for (let y = y0 + 1; y < hemY; y++) { P(cx - half - 1, y, R.s2); P(cx + half, y, R.s2); }
          if (st === 'jacket') { for (let y = y0 + 2; y < hemY - 1; y++) P(cx + half + 1, y, '#c8c8cc'); for (let x = Math.floor(g.tor.hp[0][0]); x <= g.tor.hp[1][0]; x++) P(x, hemY - 1, R.s2); }
          if (st === 'labcoat') { for (const s of [-1, 1]) { for (let x = 0; x < 6; x++) P(cx + s * 9 + x - 3, 60, s1(WHITE)); P(cx + s * 11, y0 + 9, s1(WHITE)); } }
          if (st === 'vest') { for (let y = y0 + 12; y < hemY - 2; y += 4) P(cx - half - 2.5, y, R.hi); }
        }
        break;
      }
      case 'coat': {
        for (let x = Math.floor(cx - 13); x < cx + 13; x++) for (let y = y0 - 1; y < y0 + 3; y++) P(x, y, y === y0 + 2 ? '#d8d6d0' : mod(x + y, 3) ? WHITE : '#ecebe6');
        for (let y = y0 + 3; y < 94; y++) P(cx, y, R.s2);
        for (let y = y0 + 8; y < 90; y += 7) { P(cx - 2, y, R.hi); P(cx - 2, y + 1, R.s1); }
        for (let x = Math.floor(cx - 14); x < cx + 14; x++) { P(x, 63, R.s2); P(x, 64, R.s1); }
        break;
      }
      case 'kimono': {
        const oy = 60;
        for (let y = oy; y < oy + 6; y++) for (let x = Math.floor(cx - 16); x <= cx + 16; x++) P(x, y, y === oy || y === oy + 5 ? '#2a2236' : '#3a3050');
        for (let x = Math.floor(cx - 16); x <= cx + 16; x++) P(x, oy + 2, '#d8b04a');
        break;
      }
      case 'dress': {
        const wy = 60;
        for (let x = Math.floor(cx - 14); x <= cx + 14; x++) { P(x, wy, R.hi); P(x, wy + 1, R.li); }
        L.ell(cx + 4, wy + 0.5, 2.5, 2, R.s1); L.ell(cx + 4, wy + 0.5, 1.4, 1.2, R.li);
        break;
      }
      default: break;
    }
  } else if (V === 'back') {
    const t = g.tor;
    for (let x = Math.floor(t.hp[0][0]); x <= t.hp[1][0]; x++) darker(x, hemY - 1);
    for (let k = 0; k < 4; k++) { darker(cx - 4 - k, y0 + 10 + k * 1.5); darker(cx + 4 + k, y0 + 10 + k * 1.5); }
    if (st === 'hoodie') { L.ell(cx, y0 + 4, 8, 6, R.s1); L.ell(cx, y0 + 3, 6.5, 4.5, R.b); for (let x = cx - 6; x < cx + 6; x++) P(x, y0 + 8, R.s2); }
    if (st === 'kimono') { for (let y = 60; y < 66; y++) for (let x = Math.floor(cx - 16); x <= cx + 16; x++) P(x, y, '#3a3050'); L.ell(cx, 62, 5, 4, '#2a2236'); L.ell(cx, 62, 3.6, 2.6, '#4a4064'); }
    if (st === 'jersey') {
      // número nas costas
      const tr = lift(top.trim || WHITE), cs = (top.colors || [top.color]).map(lift);
      const nc = top.pattern === 'solid' || !top.pattern ? tr : lum(cs[0]) > 0.5 ? '#1c1c1c' : WHITE;
      const n10 = ['.KK..KKKK.', 'KKK..K..K.', '.KK..K..K.', '.KK..K..K.', '.KK..K..K.', '.KK..K..K.', 'KKKK.KKKK.'];
      for (let j = 0; j < n10.length; j++) for (let i = 0; i < n10[j].length; i++) if (n10[j][i] === 'K') P(cx - 5 + i, y0 + 10 + j, nc);
    }
    if (st === 'coat') for (let x = Math.floor(cx - 12); x < cx + 12; x++) for (let y = y0 - 1; y < y0 + 3; y++) P(x, y, mod(x + y, 3) ? WHITE : '#ecebe6');
    if (st === 'dress') { L.ell(cx, 60.5, 3.5, 2.5, R.li); L.ell(cx, 60.5, 1.5, 1.2, R.s1); }
    if (st === 'sweater' || st === 'hoodie') for (let x = Math.floor(t.hp[0][0]); x <= t.hp[1][0]; x++) for (let y = hemY - 2; y <= hemY; y++) P(x, y, mod(x, 2) ? R.s1 : R.b);
    if (st === 'suit') for (let y = 62; y < 77; y++) P(cx, y, R.s2);
    if (st === 'labcoat' || st === 'coat') { const RW = ramp(st === 'labcoat' ? WHITE : col); for (let y = 56; y < 104; y++) P(cx, y, y > 84 ? RW.s2 : RW.s1); for (let x = cx - 9; x <= cx + 9; x++) P(x, 58, RW.s1); }
  } else {
    // lado: gola na frente (esquerda)
    const s = g.side, fx = s.fr[0][0];
    if (st === 'jersey') { const trim = lift(top.trim || WHITE); for (let k = 0; k < 6; k++) { P(fx + 1.5 + k * 0.4, y0 + k, trim); P(fx + 2.5 + k * 0.4, y0 + k, trim); } }
    if (st === 'hoodie') { L.ell(s.bk[0][0] - 4, y0 + 3, 4.5, 4.5, R.s1); L.ell(s.bk[0][0] - 4.5, y0 + 2.5, 3.5, 3.5, R.b); }
    if (st === 'jacket' || st === 'suit' || st === 'labcoat' || st === 'vest') for (let y = y0; y < y0 + 12; y++) { P(fx + 1 + (y - y0) * 0.12, y, st === 'labcoat' ? '#9cc0e4' : WHITE); P(fx + 2 + (y - y0) * 0.12, y, R.s2); }
    if (st === 'kimono') { for (let y = 60; y < 66; y++) for (let x = 25; x < 55; x++) P(x, y, '#3a3050'); }
    if (st === 'coat') for (let x = 28; x < 52; x++) for (let y = y0 - 1; y < y0 + 3; y++) P(x, y, mod(x + y, 3) ? WHITE : '#ecebe6');
    if (st === 'dress') for (let x = 25; x < 55; x++) P(x, 60, R.li);
    for (let k = 0; k < 4; k++) darker(fx + 4 + k * 0.5, 50 + k * 2);
  }
}

// saias e vestidos: [topo (frente/costas), barra, abertura extra na barra]
const HEM = {
  dress: [59, 97, 5], sundress: [59, 100, 8], longdress: [57, 125, 4], partydress: [59, 91, 10],
  skirt: [66, 92, 5], longskirt: [66, 121, 2], miniskirt: [66, 84, 3], pleated: [66, 99, 6],
};
function ptLongHem(c) {
  const { P, o, g, V } = c;
  const kind = o.dk || o.skirt;
  if (!kind) return;
  const col = lift(o.dress ? o.top.color : o.bottom.color), RR = ramp(col);
  const [top, y1, fl] = HEM[kind];
  const t = g.tor;
  const legsX = g.legs.map((l) => l.kn[0]);
  const xl = Math.min(...legsX) - 8, xr = Math.max(...legsX) + 8;
  let pts, cx, w0, w1, ty;
  if (V === 'side') {
    const s = g.side;
    ty = o.dress ? top + 2 : 61;
    const fx = kind === 'longdress' ? 6 : 0;
    pts = [s.fr[3][0], ty, s.bk[3][0], ty, s.bk[4][0] + 2 + fl + fx, y1, s.fr[4][0] - 3 - fl - fx * 0.5, y1];
    cx = (s.fr[3][0] + s.bk[3][0]) / 2; w0 = (s.bk[3][0] - s.fr[3][0]) / 2; w1 = (pts[4] - pts[6]) / 2;
  } else {
    ty = top;
    const x0 = o.dress ? t.wa[0][0] : t.hp[0][0] + 1.5, x1 = o.dress ? t.wa[1][0] : t.hp[1][0] - 1.5;
    const xb0 = Math.min(x0 - 4, xl + 2) - fl, xb1 = Math.max(x1 + 4, xr - 2) + fl;
    pts = [x0, top, x1, top, x1 + 3, top + 6, xb1, y1, xb0, y1, x0 - 3, top + 6];
    cx = (x0 + x1) / 2; w0 = (x1 - x0) / 2; w1 = (xb1 - xb0) / 2;
  }
  // coordenada "em leque": a posição horizontal levada de volta para a cintura
  const fan = (x, y) => cx + (x + 0.5 - cx) * w0 / lerp(w0, w1, clamp((y + 0.5 - ty) / (y1 - ty)));
  // anágua do vestido de festa (tule claro aparecendo na barra)
  if (kind === 'partydress') {
    const U = P.layer(), tc = mix(col, '#ffffff', lum(col) < 0.2 ? 0.35 : 0.55);
    U.poly(pts.map((v, i) => (i % 2 ? (v === y1 ? y1 + 2.5 : v) : v + (v < cx ? -1.5 : v > cx ? 1.5 : 0))), tc);
    U.keep((x, y) => y + 0.5 < y1 + 1.5 + (mod(x, 3) === 0 ? 1 : 0));
    shade(U, { s: 2, l: 1 });
    put(c, U, null);
  }
  const L = P.layer();
  L.poly(pts, col);
  if (kind === 'sundress') L.keep((x, y) => y + 0.5 < y1 - 0.4 + Math.sin(x * 0.9) * 0.9);
  shade(L, { s: 4, d: 1, l: 2 });
  const fy = o.dress ? top + 4 : 73;
  if (kind === 'pleated') {
    // pregas marcadas: claro, base, sombra
    L.map((v, x, y) => {
      if (y < ty + 2) return v;
      const ph = mod(fan(x, y) - cx + 0.5, 3.4);
      return ph < 1 ? li(v) : ph > 2.4 ? s1(v) : v;
    });
    for (let x = 10; x < 72; x++) { L.paint(x, ty + 1, RR.s1); if (L.get(x, y1 - 1) != null) L.paint(x, y1 - 1, mod(fan(x, y1 - 1) - cx + 0.5, 3.4) < 1.7 ? RR.s1 : RR.s2); }
  } else {
    const step = kind === 'miniskirt' ? 6 : kind === 'sundress' || kind === 'partydress' ? 7 : kind === 'longdress' ? 6 : 5;
    for (let k = -4; k <= 4; k++) {
      const xw = cx + k * step * w0 / Math.max(w1, 1) * (w1 / w0) * 0.5;
      for (let y = fy + 2; y < y1 - 1; y++) {
        const xx = Math.round(cx + (xw - cx) * lerp(w0, w1, clamp((y + 0.5 - ty) / (y1 - ty))) / w0);
        L.paint(xx, y, RR.s1);
        if (y > fy + 5) L.paint(xx - 1, y, kind === 'partydress' && k % 2 === 0 ? RR.hi : RR.li);
      }
    }
    for (let x = 10; x < 72; x++) L.paint(x, y1 - 1 + (kind === 'sundress' ? Math.round(Math.sin(x * 0.9) * 0.9) : 0), RR.s1);
  }
  // cós das saias
  if (!o.dress) for (let x = 10; x < 72; x++) L.paint(x, ty + (V === 'side' ? 6 : 1), RR.s2);
  if (kind === 'sundress') flowers(L, col, 2);
  put(c, L, null);
}

// ------------------------------------------------------------------ braços
function ptArm(c, i) {
  const { P, o, g, V } = c;
  const a = g.arms[i];
  if (!a) return;
  const far = !!a.far;
  const top = o.top, st = top.style, kind = SLEEVE[st] || 'short';
  const fem = o.female ? 0.86 : 1;
  const rU = 3.7 * fem, rE = 3.3 * fem, rW = 2.6 * fem;
  const skin = o.skin;
  const U = P.layer(), F = P.layer();
  // braço (pele)
  U.seg(a.sh, a.el, rU, rE, skin);
  F.seg(a.el, a.wr, rE, rW, skin);
  // manga
  const sp = sleevePaint(c);
  const col = lift(top.color);
  const S = P.layer(), SF = P.layer();
  if (kind === 'short' || kind === 'puff') {
    const e = lp(a.sh, a.el, kind === 'puff' ? 0.45 : 0.62);
    S.poly(tube(lp(a.sh, a.el, -0.05), e, rU + 1.2, rU + (kind === 'puff' ? 2.2 : 1.3)), sp);
    S.ell(a.sh[0], a.sh[1] + 0.3, rU + 1.1, rU + 1.0, sp);
    if (kind === 'puff') S.ell(lp(a.sh, a.el, 0.25)[0], lp(a.sh, a.el, 0.25)[1], rU + 2.4, rU + 2.2, sp);
  } else if (kind === 'ruffle') {
    // manga bufante com babado na barra
    const e = lp(a.sh, a.el, 0.5);
    S.poly(tube(lp(a.sh, a.el, -0.05), e, rU + 1.3, rU + 2.4), sp);
    S.ell(a.sh[0], a.sh[1] + 0.3, rU + 1.2, rU + 1.1, sp);
    S.ell(lp(a.sh, a.el, 0.25)[0], lp(a.sh, a.el, 0.25)[1], rU + 2.3, rU + 2.1, sp);
  } else if (kind === 'off') {
    // ombro de fora: manga bufante caída no braço
    const a0 = lp(a.sh, a.el, 0.2), a1 = lp(a.sh, a.el, 0.58), m = lp(a.sh, a.el, 0.4);
    S.poly(tube(a0, a1, rU + 1.3, rU + 1.8), sp);
    S.ell(m[0], m[1], rU + 2.0, rU + 1.9, sp);
    S.keep((x, y) => { const t = ((x + 0.5 - a.sh[0]) * (a.el[0] - a.sh[0]) + (y + 0.5 - a.sh[1]) * (a.el[1] - a.sh[1])) / ((a.el[0] - a.sh[0]) ** 2 + (a.el[1] - a.sh[1]) ** 2); return t > 0.16 && t < 0.62; });
  } else if (kind === 'tight') {
    // manga justa até o punho
    S.poly(tube(lp(a.sh, a.el, -0.15), a.el, rU + 0.8, rE + 0.5), sp);
    S.ell(a.sh[0], a.sh[1] + 0.3, rU + 0.9, rU + 0.8, sp);
    S.ell(a.el[0], a.el[1], rE + 0.5, rE + 0.5, sp);
    SF.poly(tube(a.el, lp(a.el, a.wr, 0.97), rE + 0.5, rW + 0.5), sp);
    SF.ell(a.el[0], a.el[1], rE + 0.5, rE + 0.5, sp);
  } else if (kind === 'long' || kind === 'wide') {
    const wide = kind === 'wide';
    S.poly(tube(lp(a.sh, a.el, -0.15), a.el, rU + 1.5, rE + (wide ? 2.6 : 1.2)), sp);
    S.ell(a.sh[0], a.sh[1] + 0.3, rU + 1.1, rU + 1.0, sp);
    S.ell(a.el[0], a.el[1], rE + (wide ? 2.6 : 1.2), rE + (wide ? 2.6 : 1.2), sp);
    const cuffT = wide ? 0.62 : 0.86;
    SF.poly(tube(a.el, lp(a.el, a.wr, cuffT), rE + (wide ? 2.6 : 1.2), (wide ? rW + 4.5 : rW + 1.1)), sp);
    SF.ell(a.el[0], a.el[1], rE + (wide ? 2.6 : 1.2), rE + (wide ? 2.6 : 1.2), sp);
  }
  // munhequeira
  const wb = o.wb;
  // composição: braço de cima, manga, antebraço (por cima quando dobrado para cima)
  const sh = { s: 2, d: 1, l: 1 };
  const bentUp = a.wr[1] < a.el[1] - 3;
  if (wb && kind !== 'long' && kind !== 'wide' && kind !== 'tight') {
    const band = P.layer();
    const fl = Math.hypot(a.wr[0] - a.el[0], a.wr[1] - a.el[1]);
    band.poly(tube(lp(a.el, a.wr, 1 - 4.6 / fl), lp(a.el, a.wr, 1 - 0.4 / fl), rW + 1.2, rW + 1.2), wb);
    shade(band, { s: 2, d: 1, l: 1 });
    const R = ramp(wb);
    // nervuras
    band.map((v, x, y) => ((x + y) % 3 === 0 && v === R.b ? R.s1 : v));
    a._band = band;
  }
  // pulseiras: dois aros finos no pulso
  if (o.bangle && a.hand !== 'hidden') {
    const B = P.layer(), R = ramp(o.bangle);
    const fl = Math.hypot(a.wr[0] - a.el[0], a.wr[1] - a.el[1]);
    const ux = (a.wr[0] - a.el[0]) / fl, uy = (a.wr[1] - a.el[1]) / fl;
    for (const d of [-3.4, -1.2]) {
      const q = [a.wr[0] + ux * d, a.wr[1] + uy * d], r = rW + 0.9;
      for (let k = -r; k <= r + 0.01; k += 0.5) {
        const x = Math.floor(q[0] - uy * k), y = Math.floor(q[1] + ux * k);
        B.set(x, y, Math.abs(k) > r - 0.6 ? R.s2 : k < -r * 0.2 ? R.hi : k < r * 0.4 ? o.bangle : R.s1);
      }
    }
    a._bangle = B;
  }
  const dim = far;
  put(c, U, sh, { dim, soft: skinSet(skin) });
  if (!S.empty()) {
    shade(S, { s: 3, d: 1, l: 2 });
    sleeveDetails(S, c, a, kind);
    put(c, S, null, { dim });
  }
  if (bentUp) {
    put(c, F, sh, { dim, soft: skinSet(skin) });
    if (!SF.empty()) { shade(SF, { s: 2, d: 1, l: 1 }); cuffDetails(SF, c, a, kind); put(c, SF, null, { dim }); }
  } else {
    put(c, F, sh, { dim });
    if (!SF.empty()) { shade(SF, { s: 2, d: 1, l: 1 }); cuffDetails(SF, c, a, kind); put(c, SF, null, { dim }); }
  }
  if (a._band) { stamp(P, a._band); a._band = null; }
  if (a._bangle) { if (far) a._bangle.map(s1); stamp(P, a._bangle, { ol: false }); a._bangle = null; }
  hand(c, a, far);
}

function sleevePaint(c) {
  const { o } = c;
  const top = o.top;
  if (top.style === 'jersey') {
    const cs = (top.colors || [top.color]).map(lift);
    if (top.pattern === 'hstripes' || top.pattern === 'hstripes3') return topPaint(c);
    return () => cs[0];
  }
  if (top.style === 'vest') return () => WHITE;
  if (top.style === 'labcoat') return () => WHITE;
  return topPaint(c);
}

function sleeveDetails(S, c, a, kind) {
  const { o } = c;
  const top = o.top, st = top.style;
  const e = lp(a.sh, a.el, kind === 'puff' ? 0.45 : 0.62);
  const dx = a.el[0] - a.sh[0], dy = a.el[1] - a.sh[1], n = Math.hypot(dx, dy);
  const ux = dx / n, uy = dy / n;
  if (kind === 'ruffle' || kind === 'off') {
    // babado: borda recortada mais clara, com sombra por dentro
    const R = ramp(lift(top.color));
    const t0 = kind === 'off' ? 0.16 : -9, t1 = kind === 'off' ? 0.62 : 0.5;
    S.map((v, x, y) => {
      const t = ((x + 0.5 - a.sh[0]) * ux + (y + 0.5 - a.sh[1]) * uy) / n;
      const sc = mod(x + y, 3) === 0;
      if (t > t1 - 0.07) return sc ? R.s2 : R.li;
      if (t > t1 - 0.14) return R.s1;
      if (t < t0 + 0.07) return sc ? R.s1 : R.hi;
      return v;
    });
    return;
  }
  if (kind === 'short' || kind === 'puff') {
    // barra da manga (punho de cor contrastante na camisa de time)
    let trim = st === 'jersey' ? lift(top.trim || WHITE) : null;
    if (trim) { const sc = (top.colors || [top.color]).map(lift); if (Math.abs(lum(trim) - lum(sc[0])) < 0.25) trim = sc.find((x) => Math.abs(lum(x) - lum(sc[0])) > 0.25) || (lum(sc[0]) > 0.5 ? '#1c1c1c' : WHITE); }
    S.map((v, x, y) => {
      const t = (x + 0.5 - e[0]) * ux + (y + 0.5 - e[1]) * uy;
      if (t > -2.2 && trim) return t > -1.2 ? s1(trim) : trim;
      if (t > -1.2) return s1(v);
      return v;
    });
    // dobra
    const m = lp(a.sh, a.el, 0.3);
    S.paint(m[0] + 1, m[1] + 1, s1(S.get(Math.floor(m[0] + 1), Math.floor(m[1] + 1)) || WHITE));
  }
}
function cuffDetails(S, c, a, kind) {
  const { o } = c;
  const st = o.top.style;
  const e = lp(a.el, a.wr, kind === 'wide' ? 0.62 : 0.86);
  const dx = a.wr[0] - a.el[0], dy = a.wr[1] - a.el[1], n = Math.hypot(dx, dy);
  const ux = dx / n, uy = dy / n;
  const rib = st === 'sweater' || st === 'hoodie' || st === 'jacket' || st === 'coat';
  S.map((v, x, y) => {
    const t = (x + 0.5 - e[0]) * ux + (y + 0.5 - e[1]) * uy;
    if (st === 'coat' && t > -3) return (x + y) % 3 ? WHITE : '#e4e2dc';
    if (st === 'kimono' && t > -2) return WHITE;
    if (rib && t > -3) return t > -1 ? s1(v) : (x + y) % 2 ? s1(v) : v;
    if (st === 'suit' && t > -1.5) return WHITE;
    return v;
  });
  // dobra no cotovelo
  S.paint(a.el[0] + 1, a.el[1] - 1, s2(S.get(Math.floor(a.el[0] + 1), Math.floor(a.el[1] - 1)) || '#888888'));
  S.paint(a.el[0] + 2, a.el[1], s1(S.get(Math.floor(a.el[0] + 2), Math.floor(a.el[1])) || '#888888'));
}

// ------------------------------------------------------------------ mãos
function hand(c, a, far) {
  const { P, o, g } = c;
  const sk = o.skin, Rk = ramp(sk);
  const pal = { S: sk, L: Rk.li, D: Rk.s1, E: Rk.s2, K: Rk.ol, H: Rk.hi };
  const H = P.layer();
  const [wx, wy] = a.wr;
  if (a.hand === 'ball') {
    const [bx, by] = g.ball;
    // dorso da mão atrás da bola, ligado ao pulso
    const s = o.female ? 0.9 : 1;
    H.poly([wx - 3 * s, wy + 1, wx + 3 * s, wy + 1, bx + 0.5, by + 5, bx - 5.5 * s, by + 4, bx - 6.5 * s, by - 1], sk);
    H.ell(bx - 4.6 * s, by + 1.2, 2.6 * s, 4.2 * s, sk);
    shade(H, { s: 1, l: 1 });
    put(c, H, null, { dim: far, soft: skinSet(sk) });
    pokeball(c, g.ball);
    // dedos dobrados sobre a frente da bola (cada dedo com contorno próprio)
    const fingers = o.female
      ? [[[bx - 5, by - 1.6], [bx - 0.5, by - 1.4], 1.05], [[bx - 5, by + 0.6], [bx - 0.2, by + 0.9], 1.05], [[bx - 4.8, by + 2.8], [bx - 0.8, by + 3.1], 1.0]]
      : [[[bx - 5.4, by - 2], [bx - 0.4, by - 1.8], 1.15], [[bx - 5.4, by + 0.4], [bx + 0.2, by + 0.7], 1.15], [[bx - 5.2, by + 2.8], [bx - 0.4, by + 3.1], 1.1], [[bx - 4.6, by + 5], [bx - 1.6, by + 5.2], 1.0]];
    for (const [p0, p1, r] of fingers) {
      const F = P.layer();
      F.seg(p0, p1, r, r * 0.95, sk);
      F.paint(p1[0] - 0.5, p1[1] - 0.6, Rk.li);
      F.paint(p0[0] + 1.5, p0[1] - 0.8, Rk.li);
      put(c, F, null, { dim: far, soft: skinSet(sk) });
    }
    // polegar por cima, apontando para a frente
    const T = P.layer();
    T.seg([bx - 6.4 * s, by - 2.5], [bx - 3.6 * s, by - 4.6], 1.2 * s, 1.05 * s, sk);
    shade(T, { s: 1 });
    put(c, T, null, { dim: far });
    return;
  }
  if (a.hand === 'hidden') return;
  if (a.hand === 'ballSide') {
    // de perfil: a bola segura à frente, na altura da cintura
    const [bx, by] = g.ball;
    pokeball(c, g.ball);
    const s = o.female ? 0.9 : 1;
    H.ell(wx - 1.6, wy + 0.4, 3.2 * s, 3.4 * s, sk);
    H.seg([wx - 2.5, wy - 2.6], [bx + 1.5, by - 3.8], 1.1 * s, 1.0 * s, sk);
    shade(H, { s: 1, l: 1 });
    put(c, H, null, { dim: far, soft: skinSet(sk) });
    const F = P.layer();
    for (let k = 0; k < 3; k++) F.seg([wx - 3, wy - 0.6 + k * 1.7], [bx + 2.6, by - 0.2 + k * 1.7], 0.9 * s, 0.85 * s, sk);
    put(c, F, { s: 1 }, { dim: far, soft: skinSet(sk) });
    return;
  }
  if (a.hand === 'ballBack') {
    // de costas: a bola aparece por cima do punho fechado
    const [bx, by] = g.ball;
    pokeball(c, g.ball);
    const s = o.female ? 0.9 : 1;
    H.poly([wx - 3 * s, wy + 1, wx + 3 * s, wy + 1, bx + 5.5 * s, by + 4, bx + 5 * s, by + 0.5, bx - 3 * s, by + 0.2, bx - 5 * s, by + 3], sk);
    H.ell(bx + 0.5, by + 2.6, 5 * s, 3.4 * s, sk);
    shade(H, { s: 2, l: 1 });
    // nós dos dedos
    for (let k = -3; k <= 3; k += 2) H.paint(bx + k * s, by + 0.2, Rk.li);
    for (let k = -2; k <= 4; k += 2) H.paint(bx + k * s, by + 1.4, Rk.s1);
    put(c, H, null, { dim: far, soft: skinSet(sk) });
    return;
  }
  if (a.hand === 'pocket') {
    // mão enfiada no bolso: aparecem o dorso e o polegar por fora
    const px = wx - 2.5, py = wy + 3.5;
    H.ell(px, py, 3.4, 3.4, sk);
    H.seg([px - 2.5, py - 0.5], [px - 4, py + 2.6], 1.2, 1.1, sk);
    const cut = (x, y) => y + 0.5 < py + 1 + (x + 0.5 - px) * 0.45;
    H.keep((x, y) => cut(x, y) || x + 0.5 < px - 3);
    shade(H, { s: 1, l: 1 });
    put(c, H, null, { dim: far, soft: skinSet(sk) });
    const Lp = P.layer(), pc = ramp(lift(o.bottom.color)).ol;
    for (let k = -3; k <= 4; k++) Lp.set(Math.round(px + k), Math.round(py + 1 + k * 0.45), pc);
    stamp(P, Lp, { ol: false });
    return;
  }
  if (a.hand === 'hip') {
    // punho apoiado no quadril
    const s = a.sh[0] > g.cx ? 1 : -1;
    H.ell(wx - s * 1.8, wy + 1.8, 3.3, 3.1, sk);
    shade(H, { s: 1, l: 1 });
    put(c, H, null, { dim: far });
    const F = P.layer();
    F.set(Math.round(wx - s * 3), Math.round(wy + 1), Rk.ol); F.set(Math.round(wx - s * 3), Math.round(wy + 3), Rk.ol);
    stamp(P, F, { ol: false });
    return;
  }
  // mão relaxada
  const dx = a.wr[0] - a.el[0], dy = a.wr[1] - a.el[1], n = Math.hypot(dx, dy);
  const ux = dx / n, uy = dy / n;
  const hc = [wx + ux * 3.4, wy + uy * 3.4];
  H.ell(hc[0], hc[1], 2.9 * (o.female ? 0.9 : 1), 3.6 * (o.female ? 0.9 : 1), sk);
  // polegar para a frente
  const fwd = c.V === 'side' ? -1 : a.sh[0] < g.cx ? 1 : -1;
  H.seg([hc[0] + fwd * 1.5, hc[1] - 1.5], [hc[0] + fwd * 3, hc[1] + 0.5], 1.2, 1, sk);
  shade(H, { s: 2, l: 1 });
  H.paint(hc[0] - fwd * 0.5, hc[1] + 2, Rk.s1);
  put(c, H, null, { dim: far });
}

function pokeball(c, [bx, by]) {
  const { P } = c;
  const L = P.layer();
  const r = 5.6;
  const RED = '#e8383a', REDD = '#b0242e', REDL = '#ff8a7a', WH = '#f8f8f4', WHD = '#c4c8d4';
  L.ell(bx, by, r, r, (x, y) => (y + 0.5 < by - 0.7 ? RED : y + 0.5 < by + 0.8 ? INK : WH));
  // sombreado
  L.map((v, x, y) => {
    const dx = x + 0.5 - bx, dy = y + 0.5 - by, d = Math.hypot(dx - 1.6, dy - 1.6);
    if (v === RED) return d > r * 0.95 ? REDD : Math.hypot(dx + 2, dy + 2.4) < 1.6 ? REDL : v;
    if (v === WH) return d > r * 0.95 ? WHD : v;
    return v;
  });
  L.ell(bx, by, 2, 2, INK); L.ell(bx, by, 1.15, 1.15, WH);
  L.set(Math.round(bx - 3), Math.round(by - 3), '#ffffff');
  stamp(P, L);
}

// ------------------------------------------------------------------ alças, cachecol, colar
function ptStraps(c) {
  const { P, o, g, V } = c;
  const L = P.layer();
  const b = o.back;
  if (b && b.style === 'backpack') {
    const col = lift(b.color), d = s1(col);
    if (V === 'front') {
      const t = g.tor;
      for (const s of [0, 1]) {
        const sh = t.sh[s], k = s ? 1 : -1;
        const a = [lerp(t.nk[s], sh[0], 0.45), sh[1] - 1.5], m = [sh[0] - k * 3.2, sh[1] + 7], e = [t.ap[s][0] - k * 3.6, t.ap[s][1] + 5];
        L.seg(a, m, 1.9, 1.9, d); L.seg(m, e, 1.9, 1.7, d);
        L.rect(Math.round(m[0] - 2), Math.round(m[1] + 1), 4, 2, '#9aa0aa');
      }
    } else if (V === 'side') {
      const s = g.side;
      L.seg([s.nk[0] + 3, 36], [s.fr[1][0] + 3, 46], 1.8, 1.8, d); L.seg([s.fr[1][0] + 3, 46], [s.fr[2][0] + 5, 54], 1.8, 1.6, d);
      L.rect(Math.round(s.fr[1][0] + 1.5), 46, 3, 2, '#9aa0aa');
    }
  }
  if (b && b.style === 'satchel') {
    const col = lift(b.color), d = s1(col);
    if (V === 'front') {
      const t = g.tor;
      L.seg([t.sh[0][0] + 4, t.sh[0][1] - 1], [t.hp[1][0] - 3, 68], 1.6, 1.6, d);
      const bag = P.layer();
      bag.poly([t.hp[1][0] - 6, 64, t.hp[1][0] + 6, 64, t.hp[1][0] + 7, 76, t.hp[1][0] - 5, 76], col);
      shade(bag, { s: 2, l: 1 });
      bag.rect(t.hp[1][0] - 6, 64, 13, 4, s1(col)); bag.rect(t.hp[1][0], 67, 2, 2, '#d8b04a');
      put(c, L, { s: 1, l: 1 });
      put(c, bag, null);
      return necklace(c);
    } else if (V === 'side') {
      const s = g.side;
      L.seg([s.nk[0] + 2, 36.5], [s.bk[3][0] - 2, 66], 1.6, 1.6, d);
    }
  }
  if (!L.empty()) put(c, L, { s: 1, l: 1 });
  necklace(c);
}

function necklace(c) {
  const { P, o, g, V } = c;
  if (!o.acc || o.acc.style !== 'necklace' || V === 'back') return;
  const col = lift(o.acc.color), R = ramp(col);
  const Ch = P.layer(), Pd = P.layer();
  const cx = V === 'side' ? g.side.fr[0][0] + 4 : g.cx, y = 35;
  const r = V === 'side' ? 3 : 6.5;
  for (let k = 0; k <= 24; k++) { const t = Math.PI * k / 24; Ch.set(Math.floor(cx + Math.cos(t) * r), Math.floor(y + Math.sin(t) * r * 1.2), k % 2 ? col : R.s1); }
  stamp(P, Ch, { ol: false });
  Pd.ell(cx, y + r * 1.2 + 1.5, 1.8, 2.1, col); Pd.set(Math.floor(cx - 1), Math.floor(y + r * 1.2 + 0.5), R.hi);
  stamp(P, Pd);
}

// brincos: argola com pingente logo abaixo do lóbulo
function earrings(c) {
  const { P, o, g, V } = c;
  if (!o.acc || o.acc.style !== 'earrings') return;
  const col = lift(o.acc.color), R = ramp(col);
  const H = g.head, L = P.layer();
  const ears = V === 'side' ? [[H.x + 2, 1]] : [[H.x - 11, -1], [H.x + 10, 1]];
  const y = Math.round(H.y + 6.4);
  for (const [ex] of ears) {
    const x = Math.round(ex);
    L.set(x, y, R.s1); L.set(x, y + 1, col);
    L.set(x, y + 2, R.hi); L.set(x + 1, y + 2, col); L.set(x, y + 3, col); L.set(x + 1, y + 3, R.s1);
  }
  stamp(P, L, { ol: true, inner: false });
}

// colar de pérolas e gargantilha
function ptNeckAcc(c) {
  const { P, o, g, V } = c;
  const st = o.acc && o.acc.style;
  if (st !== 'pearls' && st !== 'choker') return;
  const col = lift(o.acc.color), R = ramp(col);
  const L = P.layer(), H = g.head;
  if (st === 'choker') {
    // faixa no pescoço com um pingentinho
    const x0 = V === 'side' ? H.x - 1 : H.x - 5, x1 = V === 'side' ? H.x + 7 : H.x + 4, y = 34;
    for (let x = x0; x <= x1; x++) { L.set(x, y, R.li); L.set(x, y + 1, R.s1); }
    if (V === 'front') { const ch = lum(col) < 0.3 ? '#c8c8d4' : '#f2c230'; L.set(H.x - 1, y + 2, ch); L.set(H.x, y + 2, s1(ch)); L.set(H.x - 1, y + 3, s1(ch)); }
    if (V === 'side') { L.set(H.x - 1, y + 2, lum(col) < 0.3 ? '#c8c8d4' : '#f2c230'); }
    L.keep((x, yy) => { const v = P.get(x, yy); return v != null && !isA(v); });
    stamp(P, L, { ol: false });
    return;
  }
  // pérolas: contas 2x2 ao longo de um arco
  const bead = (x, y) => { x = Math.round(x); y = Math.round(y); L.set(x, y, R.hi); L.set(x + 1, y, R.li); L.set(x, y + 1, R.li); L.set(x + 1, y + 1, R.s1); };
  if (V === 'front') { const cx = g.cx - 1; for (let k = -6; k <= 6; k += 2) bead(cx + k, 36 + Math.round(4.2 * (1 - (k / 7) ** 2))); }
  else if (V === 'side') { const fx = g.side.fr[0][0] + 2; for (let k = 0; k < 4; k++) bead(fx + k * 2, 39.5 - k * 0.9); }
  else { const cx = g.cx - 1; for (let k = -5; k <= 5; k += 2) bead(cx + k, 34 + Math.round(1.2 * (1 - (k / 6) ** 2))); }
  stamp(P, L, { ol: false });
}

// bolsa de mão pendurada no antebraço (lado da mão na cintura)
function ptHandbag(c) {
  const { P, o, g, V } = c;
  const b = o.back;
  if (!b || b.style !== 'handbag') return;
  const col = lift(b.color), R = ramp(col);
  const gold = '#f2c230';
  const L = P.layer(), Hd = P.layer();
  let hook, bx, by;
  if (V === 'side') {
    const s = g.side;
    hook = [s.nk[0] + 4, 37];
    bx = s.bk[3][0] - 3; by = 61;
    Hd.line(hook, [bx - 3, by], R.s2); Hd.line([hook[0] + 1, hook[1]], [bx + 3, by], R.s1);
  } else {
    const a = g.arms.find((q) => q.hand === 'hip' || q.hand === 'pocket') || g.arms[V === 'back' ? 0 : 1];
    hook = lp(a.el, a.wr, 0.22);
    const out = a.el[0] > g.cx ? 1 : -1;
    bx = hook[0] + out * 2.5; by = hook[1] + 6;
    for (const dx of [-3, 3]) Hd.line([bx + dx, by], [hook[0] + dx * 0.25, hook[1] - 0.5], dx < 0 ? R.s1 : R.s2);
  }
  stamp(P, Hd, { ol: false });
  L.poly([bx - 4.5, by, bx + 4.5, by, bx + 5.6, by + 8.5, bx - 5.6, by + 8.5], col);
  shade(L, { s: 2, d: 1, l: 1 });
  for (let x = Math.floor(bx - 5); x <= bx + 5; x++) { L.paint(x, by + 3, R.s2); L.paint(x, by + 1, R.li); }
  L.set(Math.floor(bx), by + 3, gold); L.set(Math.floor(bx), by + 4, '#c8901c');
  put(c, L, null, { cast: [0, 1], castN: 1 });
}

function ptScarf(c) {
  const { P, o, g, V } = c;
  if (!o.acc || o.acc.style !== 'scarf') return;
  const col = lift(o.acc.color), R = ramp(col);
  const L = P.layer();
  const cx = V === 'side' ? g.head.x + 3 : g.cx, y = 33;
  const w = V === 'side' ? 8 : 11;
  L.poly([cx - w, y, cx + w, y, cx + w + 1, y + 6, cx - w - 1, y + 6], col);
  L.ell(cx, y + 1, w - 1, 3, col);
  if (V === 'front') L.poly([cx + 2, y + 4, cx + 8, y + 4, cx + 9, y + 20, cx + 3, y + 19], col);
  if (V === 'side') L.poly([cx + 3, y + 4, cx + 9, y + 4, cx + 11, y + 18, cx + 5, y + 18], col);
  if (V === 'back') L.poly([cx - 4, y + 4, cx + 3, y + 4, cx + 4, y + 16, cx - 4, y + 15], col);
  shade(L, { s: 2, d: 1, l: 1 });
  for (let yy = y + 1; yy < y + 6; yy += 2) for (let x = cx - w; x < cx + w; x++) L.paint(x, yy, s1(L.get(x, yy) || col));
  const fy = V === 'front' ? y + 19 : V === 'side' ? y + 17 : y + 15;
  for (let x = cx - 6; x < cx + 12; x += 2) L.paint(x, fy, R.s2);
  put(c, L, null, { cast: [0, 1] });
}

// ------------------------------------------------------------------ itens das costas
function ptBackItem(c, layer) {
  const { P, o, g, V } = c;
  const b = o.back;
  if (!b) return;
  const col = lift(b.color), R = ramp(col);
  const L = P.layer();
  const st = b.style;
  const t = g.tor;
  if (st === 'backpack') {
    if (V === 'back' && layer === 'over') {
      const cx = g.cx, w = 12, y0 = 41, y1 = 71;
      L.poly([cx - w + 2, y0, cx + w - 2, y0, cx + w, y0 + 3, cx + w + 0.5, y1 - 2, cx + w - 1, y1, cx - w + 1, y1, cx - w - 0.5, y1 - 2, cx - w, y0 + 3], col);
      shade(L, { s: 3, d: 1, l: 2 });
      // tampa, zíper e bolso da frente
      const fy = y0 + 11;
      for (let y = y0 + 1; y < fy; y++) for (let x = cx - w; x <= cx + w; x++) L.paint(x, y, L.get(x, y) === R.b ? R.li : L.get(x, y));
      for (let x = cx - w + 1; x < cx + w; x++) { L.paint(x, fy, R.s2); L.paint(x, fy + 1, R.s1); }
      L.rect(cx - 1, fy - 1, 2, 4, '#b8bec8'); L.set(cx - 1, fy + 2, '#7a808c');
      const px0 = cx - 8, px1 = cx + 8, py0 = y0 + 17, py1 = y1 - 3;
      for (let x = px0; x <= px1; x++) { L.paint(x, py0, R.s2); L.paint(x, py1, R.s2); }
      for (let y = py0; y <= py1; y++) { L.paint(px0, y, R.s2); L.paint(px1, y, R.s2); }
      for (let x = px0 + 1; x < px1; x++) L.paint(x, py0 + 1, R.li);
      put(c, L, null, { cast: [0, 1] });
      // alças nas laterais
      return;
    }
    if (V === 'side' && layer === 'behind') {
      const x0 = g.side.bk[1][0] - 3, w = 10;
      L.poly([x0, 41, x0 + w - 2, 41, x0 + w, 44, x0 + w + 0.5, 68, x0 + w - 1, 71, x0, 71], col);
      shade(L, { s: 3, d: 1, l: 2 });
      for (let x = x0; x <= x0 + w; x++) L.paint(x, 52, R.s2);
      for (let y = 56; y < 68; y++) L.paint(x0 + w - 4, y, R.s2);
      put(c, L, null);
      return;
    }
    if (V === 'front' && layer === 'behind') {
      // pontinha da mochila atrás dos ombros
      const cx = g.cx;
      L.poly([cx - 13, 40, cx + 13, 40, cx + 15, 46, cx - 15, 46], R.s1);
      shade(L, { s: 1, l: 1 });
      put(c, L, null);
    }
    return;
  }
  if (st === 'satchel') {
    if (V === 'back' && layer === 'over') {
      L.seg([t.sh[1][0] - 4, t.sh[1][1] - 1], [t.hp[0][0] + 3, 68], 1.6, 1.6, R.s1);
      L.poly([t.hp[0][0] - 7, 64, t.hp[0][0] + 5, 64, t.hp[0][0] + 6, 76, t.hp[0][0] - 6, 76], col);
      shade(L, { s: 2, d: 1, l: 1 });
      put(c, L, null);
    } else if (V === 'side' && layer === 'over') {
      const s = g.side;
      L.poly([s.fr[3][0] + 2, 63, s.bk[3][0] - 1, 63, s.bk[3][0], 76, s.fr[3][0] + 3, 76], col);
      shade(L, { s: 2, d: 1, l: 1 });
      for (let x = s.fr[3][0] + 2; x < s.bk[3][0]; x++) L.paint(x, 66, R.s2);
      put(c, L, null);
    }
    return;
  }
  if (st === 'cape') {
    const lowY = 112;
    if (V === 'back' && layer === 'over') {
      const cx = g.cx;
      L.poly([cx - 11, 38, cx + 11, 38, cx + 16, 50, cx + 20, lowY, cx - 20, lowY, cx - 16, 50], col);
      shade(L, { s: 4, d: 1, l: 2 });
      for (let x = cx - 14; x <= cx + 14; x += 6) for (let y = 52; y < lowY - 1; y++) { L.paint(x + (y - 52) * (x - cx) * 0.012, y, R.s1); L.paint(x + 1 + (y - 52) * (x - cx) * 0.012, y, R.li); }
      for (let x = cx - 12; x <= cx + 12; x++) { L.paint(x, 38, '#d8b04a'); L.paint(x, 39, '#a8802a'); }
      put(c, L, null, { cast: [0, 1] });
    } else if (V === 'front' && layer === 'behind') {
      const cx = g.cx;
      L.poly([cx - 14, 38, cx + 14, 38, cx + 21, lowY, cx - 21, lowY], R.s1);
      shade(L, { s: 3, d: 1, l: 1 });
      // forro aparecendo
      L.map((v, x, y) => (Math.abs(x + 0.5 - cx) < 14 + (y - 38) * 0.06 && y > 44 ? s2(col) : v));
      put(c, L, null);
    } else if (V === 'side' && layer === 'behind') {
      const x0 = g.side.bk[0][0];
      L.poly([x0 - 6, 38, x0, 38, x0 + 10, lowY, x0 - 8, lowY], col);
      shade(L, { s: 3, d: 1, l: 2 });
      put(c, L, null);
    }
    return;
  }
  if (st === 'wings') {
    const wing = (s, x, y) => {
      const k = 2.3;
      const f = (u, v) => [x + s * u * k, y + v * k];
      const pts = [[0, 0], [3, -4.5], [6.5, -5], [8, -3], [7, -0.5], [7.8, 1.5], [6, 3.4], [6.4, 5], [4, 6], [1.5, 4.5], [0, 3]].map(([u, v]) => f(u, v)).flat();
      L.poly(pts, col);
      shade(L, { s: 2, d: 1, l: 1 });
      for (const [a, b] of [[[1, 1], [7, -2.5]], [[1, 2.5], [6.5, 2.4]], [[1, 3.5], [5, 5.2]]]) L.line(f(...a), f(...b), R.s1);
    };
    const y = 44;
    if (V === 'back' && layer === 'over') { wing(-1, g.cx - 3, y); wing(1, g.cx + 2, y); put(c, L, null); }
    else if (V === 'front' && layer === 'behind') { wing(-1, t.sh[0][0] + 6, y - 2); wing(1, t.sh[1][0] - 6, y - 2); put(c, L, null, { dim: true }); }
    else if (V === 'side' && layer === 'behind') { wing(1, g.side.bk[1][0] - 2, y); put(c, L, null); }
  }
}

// ================================================================== retrato: cabeça
const HRX = 10.5, HRY = 12;   // raio do crânio (px)
// Preenche usando o "espaço da cabeça": u (horizontal) e v (vertical), raio = 1.
function hsFill(L, H, f, ext = 2.4) {
  const x0 = Math.floor(H.x - ext * HRX), x1 = Math.ceil(H.x + ext * HRX);
  const y0 = Math.floor(H.y - 2.2 * HRY), y1 = Math.ceil(H.y + 3.4 * HRY);
  for (let y = Math.max(0, y0); y <= Math.min(L.h - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(L.w - 1, x1); x++) {
      const col = f((x + 0.5 - H.x) / HRX, (y + 0.5 - H.y) / HRY, x, y);
      if (col) L.set(x, y, col);
    }
  }
}
const toPx = (H, [u, v]) => [H.x + u * HRX, H.y + v * HRY];

function skullIn(u, v, V, f) {
  if (V === 'side') {
    // perfil olhando para a esquerda: testa, nariz, boca e queixo
    if (v <= 0.15) return inE(u, v, 0.08, 0, 1.0, 1.0);
    const pts = f
      ? [-0.92, 0.1, -0.98, 0.3, -1.1, 0.5, -1.0, 0.58, -0.98, 0.7, -0.92, 0.82, -0.72, 1.02, -0.45, 1.06, 0.1, 0.86, 0.6, 0.55, 1.0, 0.2, 1.08, 0.1]
      : [-0.92, 0.1, -0.98, 0.3, -1.12, 0.52, -1.0, 0.6, -0.98, 0.72, -0.92, 0.86, -0.7, 1.08, -0.4, 1.1, 0.15, 0.88, 0.62, 0.55, 1.0, 0.2, 1.08, 0.1];
    return inPoly(u, v, pts);
  }
  if (v <= 0.15) return u * u + v * v <= 1;
  const chinV = f ? 1.05 : 1.08, chinW = f ? 0.22 : 0.27;
  if (v > chinV) return false;
  const t = (v - 0.15) / (chinV - 0.15);
  return Math.abs(u) <= 0.99 - (0.99 - chinW) * Math.pow(t, f ? 1.6 : 1.9);
}

function ptHead(c, part = 'all') {
  const { P, o, g, V } = c;
  const H = g.head;
  const hat = o.hat;
  if (part !== 'hat') {
    const L = P.layer();
    hsFill(L, H, (u, v) => {
      if (skullIn(u, v, V, o.female)) return o.skin;
      if (V !== 'side' && inE(Math.abs(u), v, 0.97, 0.3, 0.16, 0.24)) return o.skin;
      if (V === 'side' && inE(u, v, 0.18, 0.3, 0.17, 0.26)) return o.skin;
      return null;
    });
    shade(L, { s: 2, d: 0, l: 2, dir: [0.8, 0.55] });
    if (V === 'side') hsFill(L, H, (u, v) => (inE(u, v, 0.2, 0.3, 0.08, 0.15) ? s1(o.skin) : null));
    if (V !== 'side') hsFill(L, H, (u, v) => (inE(Math.abs(u), v, 0.98, 0.3, 0.07, 0.13) ? s1(o.skin) : null));
    if (V !== 'back') face(L, c);
    stamp(P, L, { cast: [0, 1], castN: 2, soft: skinSet(o.skin) });
    if (o.acc && (o.acc.style === 'glasses' || o.acc.style === 'sunglasses' || o.acc.style === 'cateye')) glasses(c);
    if (V === 'back') earrings(c);
    ptHair(c, 'front');
    if (V !== 'back') earrings(c);
  }
  if (hat && part !== 'under') ptHat(c);
}

// ------------------------------------------------------------------ rosto
// rostos de frente (20 colunas, simétricos em torno do centro da cabeça), a partir de y = centro - 3
const FACE_M = [
  '.BBBBBB......BBBBBB.',
  '......BB....BB......',
  '....................',
  '.KKKKKKK....KKKKKKK.',
  'K.WHDDW......WHDDW.K',
  '..WDDIW......WDDIW..',
  '..WIILW......WIILW..',
  '...III........III...',
  '....................',
  '..........E.........',
  '.........SE.........',
  '....................',
  '............M.......',
  '.........MMM........',
];
const FACE_F = [
  '...BBBB......BBBB...',
  '..B..............B..',
  '.K................K.',
  '..KKKKKK....KKKKKK..',
  '.KWHHDW......WHHDWK.',
  '..WHDIW......WHDIW..',
  '..WDIIW......WDIIW..',
  '...ILI........ILI...',
  '.CC..............CC.',
  '..........E.........',
  '....................',
  '.........MMM........',
  '..........O.........',
];
function face(L, c) {
  const { o, g, V } = c;
  const H = g.head, f = o.female;
  const Ri = ramp(o.eye), Rs = ramp(o.skin), Rh = ramp(o.hairL);
  const pal = { K: INK, D: Ri.s2, I: o.eye, L: Ri.li, H: '#ffffff', W: '#f6f4f2', B: lum(o.hairL) > 0.55 ? Rh.s2 : Rh.ol, S: Rs.s1, E: Rs.s2, M: mix(Rs.ol, '#8a2a2a', 0.35), C: mix(o.skin, '#ff7a8a', 0.32), N: Rs.s1, O: Rs.li };
  const x0 = Math.round(H.x), y0 = Math.round(H.y);
  if (V === 'front') {
    L.blit(x0 - 10, y0 - 2, f ? FACE_F : FACE_M, pal);
  } else {
    // perfil (olhando para a esquerda)
    const ex = x0 - 9, ey = y0 + (f ? 0 : 1);
    if (f) {
      L.blit(ex, ey, ['.KKK.', 'KKKKK', 'KDDK.', 'HIIK.', 'IIL..', '.I...'], pal);
      L.blit(ex, y0 - 3, ['.BBB'], pal);
      L.blit(ex - 1, ey + 1, ['K'], pal);
      L.blit(ex + 2, y0 + 6, ['CC'], pal);
      L.blit(ex, y0 + 10, ['MM'], pal);
    } else {
      L.blit(ex, ey, ['KKKK', 'KDDK', 'HDI.', 'IIL.'], pal);
      L.blit(ex, y0 - 2, ['BBBB', '...B'], pal);
      L.blit(ex, y0 + 10, ['MMM'], pal);
    }
    L.blit(ex - 1, y0 + 7, ['N'], pal);
  }
}

function glasses(c) {
  const { P, o, g, V } = c;
  const L = P.layer();
  const H = g.head, x0 = Math.round(H.x), y0 = Math.round(H.y);
  const sun = o.acc.style === 'sunglasses', cat = o.acc.style === 'cateye';
  const fr = sun || cat ? lift(o.acc.color) : s1(lift(o.acc.color));
  const lens = '#2a2634', glare = sun ? '#7a7690' : '#e8f6ff';
  if (cat) {
    // óculos gatinho: aro de cima grosso com as pontas de fora puxadas para cima
    const R = ramp(fr), fd = lum(fr) > 0.8 ? R.s2 : R.s1;
    const lensT = '#dff0ff';
    const lensC = (x, y, w, h, out) => {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const edge = i === 0 || i === w - 1 || j === h - 1;
        if (j === 0) L.set(x + i, y + j, fr);
        else if (edge) L.set(x + i, y + j, j === h - 1 && i > 0 && i < w - 1 ? fd : fr);
      }
      L.set(x + 1, y + 1, lensT);
      // ponta de gatinho: aro de cima engrossado para fora e puxado para cima
      const o0 = out < 0 ? x : x + w - 1;
      for (let k = 0; k < Math.min(4, w - 1); k++) L.set(o0 - out * k, y - 1, k === 1 ? R.hi : fr);
      L.set(o0 + out, y - 1, fr); L.set(o0 + out, y, fr); L.set(o0 + out, y - 2, fr); L.set(o0 + out * 2, y - 2, fr);
      L.set(o0 + out, y + 1, fr);
    };
    if (V === 'back') { L.rect(x0 - 11, y0 + 2, 1, 2, fr); L.rect(x0 + 10, y0 + 2, 1, 2, fr); }
    else if (V === 'front') { lensC(x0 - 9, y0, 8, 6, -1); lensC(x0 + 1, y0, 8, 6, 1); L.rect(x0 - 1, y0 + 1, 2, 1, fr); }
    else { lensC(x0 - 10, y0, 5, 6, 1); L.rect(x0 - 5, y0 + 2, 8, 1, fr); }
    stamp(P, L, { ol: false });
    return;
  }
  const box = (x, y, w, h) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const edge = i === 0 || j === 0 || i === w - 1 || j === h - 1;
      if (edge) L.set(x + i, y + j, fr);
      else if (sun) L.set(x + i, y + j, j < 2 ? '#3a3448' : lens);
    }
    L.set(x + 1, y + 1, glare);
    if (sun) L.set(x + 2, y + 1, glare);
  };
  if (V === 'back') { L.rect(x0 - 11, y0 + 2, 1, 2, fr); L.rect(x0 + 10, y0 + 2, 1, 2, fr); }
  else if (V === 'front') {
    box(x0 - 9, y0, 8, 6); box(x0 + 1, y0, 8, 6);
    L.rect(x0 - 1, y0 + 1, 2, 1, fr);
    L.set(x0 - 10, y0 + 1, fr); L.set(x0 + 9, y0 + 1, fr);
  } else {
    box(x0 - 10, y0, 5, 6);
    L.rect(x0 - 5, y0 + 2, 8, 1, fr);
  }
  stamp(P, L, { ol: false });
}

// ------------------------------------------------------------------ cabelo (mechas)
// Cada estilo é uma lista de formas no espaço da cabeça:
//   K(a, m, b, w, w1) mecha (curva Bézier a→m→b afinando de w até w1)
//   E(c, r, clip) massa elíptica; PL(pts) polígono
// .back = desenhada atrás do corpo (cabelo comprido na vista de frente)
const K = (a, m, b, w, w1 = 0.04, x = {}) => ({ k: 'lock', a, m, b, w, w1, ...x });
const E = (c, r, clip, x = {}) => ({ k: 'ell', c, r, clip, ...x });
const PL = (pts, x = {}) => ({ k: 'poly', pts, ...x });
const HBK = { back: true };

// cobertura do chapéu: cabelo acima desta linha (v) some
const HAT_COVER = { cap: -0.56, cap2: -0.56, beanie: -0.36, bucket: -0.34, sunhat: -0.5, cowboy: -0.5, tophat: -0.52, bandana: -0.3, beret: -0.6 };

// mecha em cadeia de curvas: pts = [p0, c1, p1, c2, p2, ...]
const KC = (pts, w, w1 = 0.04, x = {}) => ({ k: 'lock', chain: pts, a: pts[0], b: pts[pts.length - 1], w, w1, ...x });
// ondas: n curvas de a até b, pontos de controle alternando para cada lado
function wave(a, b, amp, n, ph = 1) {
  const pts = [a], dx = (b[0] - a[0]) / n, dy = (b[1] - a[1]) / n, L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  for (let i = 0; i < n; i++) {
    const s = (i % 2 ? -1 : 1) * ph * amp;
    pts.push([a[0] + dx * (i + 0.5) + nx * s, a[1] + dy * (i + 0.5) + ny * s], [a[0] + dx * (i + 1), a[1] + dy * (i + 1)]);
  }
  return pts;
}
// espelha uma forma (u → -u)
function mirS(s) {
  const f = (p) => [-p[0], p[1]];
  if (s.k === 'lock') return { ...s, a: f(s.a), m: s.m && f(s.m), b: f(s.b), chain: s.chain && s.chain.map(f) };
  if (s.k === 'ell') { const cl = s.clip; return { ...s, c: f(s.c), clip: cl && ((u, v) => cl(-u, v)) }; }
  return { ...s, pts: s.pts.map((v, i) => (i % 2 ? v : -v)) };
}
const both = (...ss) => ss.flatMap((s) => [s, mirS(s)]);

// Estilos novos (linha feminina). Retorna null para os estilos antigos.
function newHair(st, V, f, hatted) {
  const mass = (clipV = -0.34, side = 0.84, sideV = 0.22) => E([0, -0.22], [1.13, 0.99], (u, v) => v < clipV || (Math.abs(u) > side && v < sideV));
  const tie = (u, v, r = 0.17) => E([u, v], [r, r * 1.05], null, { tie: true });
  // ponta da trança: elástico e um tufinho
  const braidEnd = (p, dir = 1) => [K(p, [p[0] + 0.04 * dir, p[1] + 0.22], [p[0] + 0.02 * dir, p[1] + 0.42], 0.2, 0.08), tie(p[0], p[1] - 0.02, 0.13)];
  if (hatted && st === 'highponytail') st = 'ponytail';
  if (st === 'ponytail') return null;
  const low = hatted && st === 'doublebun';
  if (V === 'front') {
    const bangsSoft = [
      K([-0.7, -0.9], [-0.78, -0.45], [-0.86, 0.06], 0.3), K([-0.42, -1.0], [-0.5, -0.5], [-0.58, -0.02], 0.32),
      K([-0.12, -1.0], [0.08, -0.55], [0.28, -0.1], 0.32), K([0.2, -1.0], [0.44, -0.55], [0.64, -0.04], 0.3), K([0.5, -0.9], [0.7, -0.45], [0.84, 0.04], 0.28),
    ];
    const fringe = (bot) => PL([-0.92, -0.98, 0.92, -0.98, 0.96, -0.36, 0.9, bot, -0.9, bot, -0.96, -0.36], { fringe: bot });
    switch (st) {
      case 'wavy': return [
        ...both(KC(wave([-0.85, 0.0], [-1.32, 3.0], 0.55, 3), 0.62, 0.26, HBK), KC(wave([-0.45, 0.3], [-0.72, 3.2], 0.5, 3), 0.52, 0.22, HBK)),
        E([0, 1.2], [1.24, 1.85], null, HBK),
        mass(-0.22, 0.8, 0.3),
        ...both(KC(wave([-0.86, -0.6], [-1.16, 2.5], 0.5, 3), 0.37, 0.12), KC(wave([-0.7, -0.45], [-0.95, 2.0], 0.42, 3), 0.27, 0.06)),
        ...bangsSoft,
      ];
      case 'bangs': return [
        ...both(K([-0.9, 0.0], [-1.32, 1.4], [-1.24, 3.05], 0.6, 0.44, HBK), K([-0.5, 0.2], [-0.78, 1.5], [-0.72, 3.15], 0.5, 0.42, HBK)),
        E([0, 1.2], [1.2, 1.9], (u, v) => v < 3.1, HBK),
        mass(-0.22, 0.8, 0.3),
        ...both(K([-0.86, -0.62], [-1.14, 0.5], [-1.1, 2.45], 0.36, 0.3), K([-0.74, -0.5], [-0.98, 0.5], [-0.92, 2.15], 0.26, 0.22)),
        fringe(-0.1),
      ];
      case 'hime': return [
        ...both(K([-0.9, 0.0], [-1.24, 1.5], [-1.3, 3.9], 0.6, 0.56, { ...HBK, cut: 3.5 }), K([-0.5, 0.2], [-0.74, 1.6], [-0.78, 3.9], 0.5, 0.5, { ...HBK, cut: 3.5 })),
        E([0, 1.2], [1.2, 1.9], (u, v) => v < 3.5, HBK),
        mass(-0.22, 0.8, 0.3),
        ...both(PL([-1.12, -0.6, -0.7, -0.6, -0.68, 1.02, -1.14, 1.02], { strands: true })),
        fringe(-0.06),
      ];
      case 'highponytail': return [
        KC([[0.22, -1.05], [0.75, -1.85], [1.3, -1.3], [1.68, -0.65], [1.5, 0.6]], 0.42, 0.1, HBK),
        KC([[0.3, -1.0], [0.95, -1.55], [1.32, -0.95], [1.45, -0.25], [1.2, 0.95]], 0.3, 0.05, HBK),
        mass(-0.26, 0.82, 0.06),
        ...both(K([-0.86, -0.55], [-1.03, -0.15], [-0.93, 0.28], 0.22)),
        K([-0.6, -0.9], [-0.66, -0.45], [-0.74, -0.02], 0.3), K([-0.3, -1.0], [-0.36, -0.5], [-0.42, -0.1], 0.32),
        K([0.02, -1.0], [0.04, -0.55], [0.0, -0.16], 0.3), K([0.32, -1.0], [0.42, -0.55], [0.5, -0.08], 0.3), K([0.6, -0.9], [0.74, -0.5], [0.78, 0.0], 0.28),
        tie(0.24, -1.1),
      ];
      case 'sideponytail': return [
        mass(-0.26, 0.82, 0.1),
        K([-0.86, -0.55], [-1.04, -0.1], [-0.95, 0.35], 0.24),
        K([-0.72, -0.92], [-0.6, -0.5], [-0.74, -0.02], 0.28), K([-0.45, -1.0], [-0.24, -0.6], [-0.16, -0.12], 0.32),
        K([-0.15, -1.02], [0.18, -0.66], [0.34, -0.16], 0.32), K([0.15, -1.0], [0.55, -0.7], [0.78, -0.24], 0.3), K([0.45, -0.92], [0.86, -0.62], [0.98, -0.12], 0.28),
        KC([[0.92, -0.12], [1.5, 0.3], [1.42, 1.1], [1.34, 1.8], [0.98, 2.45]], 0.44, 0.08),
        KC([[0.95, 0.0], [1.26, 0.6], [1.16, 1.3], [1.08, 1.9], [1.24, 2.3]], 0.32, 0.04),
        tie(0.96, -0.12, 0.19),
      ];
      case 'braid': return [
        mass(-0.26, 0.82, 0.1),
        K([-0.86, -0.55], [-1.04, -0.1], [-0.94, 0.38], 0.24), K([0.86, -0.55], [1.0, -0.2], [0.93, 0.18], 0.22),
        K([-0.62, -0.92], [-0.6, -0.45], [-0.76, 0.0], 0.3), K([-0.34, -1.0], [-0.3, -0.55], [-0.46, -0.08], 0.32),
        K([-0.05, -1.02], [0.1, -0.6], [0.06, -0.16], 0.3), K([0.26, -1.0], [0.42, -0.58], [0.5, -0.1], 0.3), K([0.56, -0.92], [0.74, -0.5], [0.8, 0.0], 0.28),
        KC([[0.82, 0.18], [1.16, 0.8], [1.06, 1.6], [0.98, 2.3], [1.02, 2.86]], 0.28, 0.21, { braid: true }),
        ...braidEnd([1.02, 2.86]),
      ];
      case 'braids2': return [
        mass(-0.26, 0.82, 0.1),
        ...both(K([-0.05, -1.0], [-0.52, -0.78], [-0.82, -0.08], 0.3), K([-0.1, -0.92], [-0.38, -0.52], [-0.52, -0.04], 0.26)),
        K([0, -1.14], [0, -1.02], [0, -0.88], 0.05, 0.05, { part: true }),
        ...both(KC([[-0.82, 0.16], [-1.15, 0.8], [-1.05, 1.55], [-0.98, 2.2], [-1.03, 2.72]], 0.27, 0.2, { braid: true })),
        ...braidEnd([-1.03, 2.72], -1), ...braidEnd([1.03, 2.72]),
      ];
      case 'doublebun': return [
        ...(low ? both(E([-1.02, 0.02], [0.38, 0.36], null, { bun: true })) : both(E([-0.62, -1.06], [0.42, 0.38], null, { bun: true }))),
        { ...mass(-0.3, 0.84, 0.1), sepAll: true },
        ...both(K([-0.86, -0.4], [-1.02, 0.2], [-0.88, 0.86], 0.18, 0.05)),
        K([-0.5, -0.95], [-0.82, -0.6], [-0.95, -0.12], 0.3), K([-0.2, -1.0], [-0.5, -0.6], [-0.62, -0.22], 0.28),
        K([0.3, -0.98], [0.6, -0.62], [0.74, -0.2], 0.28), K([0.6, -0.9], [0.92, -0.5], [0.96, -0.06], 0.26),
      ];
      case 'pixie': return [
        E([0, -0.17], [1.07, 0.96], (u, v) => v < -0.38 || (Math.abs(u) > 0.86 && v < 0.0)),
        K([-0.82, -0.7], [-0.97, -0.38], [-0.9, -0.02], 0.22), K([0.84, -0.66], [0.98, -0.34], [0.9, -0.04], 0.2),
        K([-0.62, -0.98], [-0.28, -0.74], [0.16, -0.3], 0.3), K([-0.3, -1.04], [0.14, -0.82], [0.5, -0.38], 0.3),
        K([0.04, -1.02], [0.48, -0.82], [0.78, -0.42], 0.28), K([-0.86, -0.62], [-0.62, -0.5], [-0.46, -0.26], 0.2),
      ];
      case 'curlylong': return [
        E([0, 1.05], [1.5, 1.95], (u, v) => v > -0.4 && v < 2.5, HBK),
        ...[-1.45, -1.05, -0.62, 0.62, 1.05, 1.45].map((x, i) => KC(wave([x * 0.7, 0.2], [x * 1.12, 2.7 + (i % 2) * 0.12], 0.3, 7, i % 2 ? 1 : -1), 0.34, 0.16, { ...HBK, sep: 0.15 })),
        E([0, -0.26], [1.32, 1.14], (u, v) => v < -0.26 + 0.12 * Math.abs(Math.sin(u * 6)) || (Math.abs(u) > 0.82 && v < 0.3), { curl: true, bump: 0.04 }),
        ...both(KC(wave([-0.95, -0.3], [-1.38, 2.25], 0.3, 6), 0.34, 0.14, { sep: 0.1 }), KC(wave([-0.8, 0.0], [-1.02, 1.8], 0.28, 5, -1), 0.28, 0.1, { sep: 0.1 })),
        E([-0.55, -0.32], [0.28, 0.24]), E([-0.05, -0.36], [0.3, 0.24]), E([0.45, -0.32], [0.28, 0.24]),
      ];
      default: return null;
    }
  }
  if (V === 'back') {
    const crown = (lw = 0.5) => E([0, -0.18], [1.14, 1.02], (u, v) => v < lw - 0.1 * tri(u * 2.5));
    const napes = (y = 0.45) => [K([-0.8, -0.2], [-0.9, 0.3], [-0.7, y + 0.15], 0.3), K([-0.3, -0.1], [-0.35, 0.4], [-0.3, y + 0.18], 0.32), K([0.2, -0.1], [0.25, 0.4], [0.24, y + 0.2], 0.32), K([0.7, -0.2], [0.85, 0.3], [0.72, y + 0.16], 0.3)];
    switch (st) {
      case 'wavy': return [crown(0.6), ...[-0.86, -0.43, 0, 0.43, 0.86].map((x) => KC(wave([x * 1.04, -0.1], [x * 1.32, 3.05 + 0.25 * (1 - Math.abs(x))], 0.5, 3), 0.58, 0.22))];
      case 'bangs': return [crown(0.6), ...[-0.86, -0.43, 0, 0.43, 0.86].map((x) => K([x * 1.04, -0.1], [x * 1.22, 1.5], [x * 1.18, 3.3], 0.56, 0.48, { cut: 3.05 }))];
      case 'hime': return [crown(0.6), ...[-0.9, -0.45, 0, 0.45, 0.9].map((x) => K([x * 1.04, -0.1], [x * 1.2, 1.6], [x * 1.3, 3.9], 0.56, 0.52, { cut: 3.5 }))];
      case 'highponytail': return [crown(0.34), K([-0.75, -0.2], [-0.7, 0.15], [-0.55, 0.36], 0.26), K([0.75, -0.2], [0.7, 0.15], [0.55, 0.36], 0.26),
        K([0, -0.95], [0.12, -1.42], [0.34, -1.2], 0.3, 0.1),
        K([0, -0.95], [0.32, 0.1], [0.06, 1.95], 0.46, 0.08), K([0, -0.9], [-0.3, 0.3], [0.1, 1.6], 0.32, 0.04), tie(0, -0.95, 0.2)];
      case 'sideponytail': return [crown(0.45), ...napes(0.3),
        K([0.7, -0.75], [-0.2, -0.6], [-0.92, -0.08], 0.3), K([0.85, -0.3], [0.0, -0.2], [-0.9, 0.0], 0.26),
        KC([[-0.96, -0.08], [-1.55, 0.4], [-1.45, 1.1], [-1.35, 1.5], [-1.22, 1.62]], 0.42, 0.3), tie(-0.98, -0.1, 0.19)];
      case 'braid': return [crown(0.45), ...napes(0.3),
        KC([[-0.3, 0.32], [-0.55, 0.9], [-0.95, 1.2], [-1.15, 1.42], [-1.2, 1.62]], 0.28, 0.26, { braid: true })];
      case 'braids2': return [crown(0.45), K([0, -1.12], [0, -0.4], [0, 0.42], 0.05, 0.05, { part: true }),
        ...both(KC([[-0.4, 0.32], [-0.62, 0.9], [-0.98, 1.2], [-1.16, 1.42], [-1.2, 1.62]], 0.27, 0.25, { braid: true }))];
      case 'doublebun': return [crown(0.42), ...(low ? both({ ...E([-0.66, 0.12], [0.4, 0.36], null, { bun: true }), sepAll: true }) : both({ ...E([-0.62, -1.02], [0.42, 0.38], null, { bun: true }), sepAll: true })), ...napes(0.3)];
      case 'pixie': return [E([0, -0.16], [1.08, 0.98], (u, v) => v < 0.28 - 0.12 * tri(u * 2.5)), ...both(K([-0.62, -0.1], [-0.64, 0.2], [-0.52, 0.42], 0.24), K([-0.2, 0], [-0.22, 0.3], [-0.15, 0.5], 0.26))];
      case 'curlylong': return [E([0, -0.28], [1.3, 1.14], (u, v) => v < 0.5, { curl: true, bump: 0.04 }),
        ...[-1.25, -0.75, -0.25, 0.25, 0.75, 1.25].map((x, i) => KC(wave([x * 0.8, 0.1], [x * 1.2, 2.65 + (i % 2) * 0.12], 0.3, 7, i % 2 ? 1 : -1), 0.36, 0.16, { sep: 0.1 }))];
      default: return null;
    }
  }
  // perfil (olhando para a esquerda; u < 0 = rosto)
  const crownS = (nape = 0.55) => E([0.12, -0.2], [1.12, 1.02], (u, v) => (u < -0.42 ? v < -0.3 : u < 0.0 ? v < -0.12 : u < 0.36 ? v < (u > 0.05 ? 0.02 : -0.05) : v < nape));
  const bangsS = [K([-0.3, -0.98], [-0.72, -0.72], [-1.02, -0.18], 0.32), K([-0.05, -1.0], [-0.55, -0.6], [-0.78, -0.02], 0.3), K([0.2, -0.95], [-0.25, -0.5], [-0.42, 0.02], 0.26)];
  const backS = (y = 0.55) => [K([0.5, -0.6], [0.95, -0.1], [0.9, y + 0.15], 0.34), K([0.2, -0.2], [0.6, 0.2], [0.55, y + 0.2], 0.3)];
  const fringeS = (bot) => PL([0.35, -1.04, -0.5, -0.98, -0.98, -0.62, -1.08, bot, -0.48, bot, -0.12, -0.28], { fringe: bot });
  switch (st) {
    case 'wavy': return [crownS(0.7), KC(wave([0.4, -0.6], [1.0, 2.75], 0.5, 3), 0.6, 0.22), KC(wave([0.15, -0.3], [0.55, 2.95], 0.45, 3), 0.5, 0.2), ...bangsS, KC(wave([-0.1, -0.6], [-0.14, 1.75], 0.36, 2), 0.24, 0.06)];
    case 'bangs': return [crownS(0.7), K([0.4, -0.6], [1.12, 0.6], [1.02, 2.9], 0.6, 0.44), K([0.18, -0.3], [0.62, 1.0], [0.55, 3.05], 0.5, 0.42), fringeS(-0.1), K([-0.04, -0.5], [0.0, 0.8], [-0.06, 2.2], 0.26, 0.22)];
    case 'hime': return [crownS(0.7), K([0.4, -0.6], [1.12, 0.6], [1.12, 3.9], 0.6, 0.56, { cut: 3.5 }), K([0.18, -0.3], [0.6, 1.0], [0.62, 3.9], 0.5, 0.5, { cut: 3.5 }), PL([-0.2, -0.45, 0.42, -0.45, 0.44, 1.02, -0.17, 1.02], { strands: true }), fringeS(-0.06)];
    case 'highponytail': return [crownS(0.42), K([0.5, -0.6], [0.9, -0.3], [0.88, 0.2], 0.3), ...bangsS,
      KC([[0.6, -1.0], [1.25, -1.65], [1.62, -0.85], [1.78, 0.2], [1.42, 1.2]], 0.42, 0.07), KC([[0.65, -0.95], [1.15, -1.3], [1.4, -0.6], [1.52, 0.3], [1.26, 1.5]], 0.3, 0.04), tie(0.62, -0.98, 0.18)];
    case 'sideponytail': return [crownS(0.45), ...backS(0.35), ...bangsS,
      KC([[0.4, 0.05], [0.78, 0.8], [0.45, 1.5], [0.18, 2.0], [0.0, 2.45]], 0.42, 0.08), KC([[0.42, 0.1], [0.55, 0.9], [0.25, 1.6], [0.12, 2.0], [0.16, 2.3]], 0.3, 0.04), tie(0.4, 0.04, 0.19)];
    case 'braid': case 'braids2': return [
      ...(st === 'braids2' ? [KC([[0.85, 0.2], [1.1, 0.75], [1.04, 1.3]], 0.25, 0.23, { braid: true })] : []),
      crownS(0.45), ...backS(0.35), ...bangsS,
      KC([[0.4, 0.3], [0.68, 1.0], [0.36, 1.7], [0.1, 2.3], [0.08, 2.85]], 0.28, 0.21, { braid: true }), ...braidEnd([0.08, 2.85])];
    case 'doublebun': return low
      ? [E([0.88, -0.02], [0.4, 0.36], null, { bun: true }), { ...crownS(0.42), sepAll: true }, ...backS(0.3), ...bangsS.slice(0, 2)]
      : [E([0.62, -1.22], [0.38, 0.34], null, { bun: true }), { ...E([0.02, -1.32], [0.42, 0.37], null, { bun: true }), sepAll: true }, { ...crownS(0.42), sepAll: true }, ...backS(0.3), ...bangsS.slice(0, 2), K([-0.1, -0.4], [-0.02, 0.2], [-0.12, 0.8], 0.16, 0.05)];
    case 'pixie': return [crownS(0.24), K([0.35, -0.7], [0.78, -0.4], [0.74, 0.14], 0.26), K([0.0, -1.0], [-0.6, -0.86], [-1.0, -0.42], 0.3), K([0.2, -0.9], [-0.35, -0.62], [-0.7, -0.22], 0.26), K([-0.1, -0.5], [-0.05, -0.1], [-0.1, 0.16], 0.16)];
    case 'curlylong': return [
      ...[0.15, 0.5, 0.85].map((x, i) => KC(wave([x, -0.2], [x * 1.3 + 0.1, 2.6 + (i % 2) * 0.12], 0.3, 7, i % 2 ? 1 : -1), 0.38, 0.16, { sep: 0.1 })),
      E([0.12, -0.26], [1.3, 1.14], (u, v) => (u < -0.42 ? v < -0.24 : u < 0.05 ? v < -0.02 : v < 0.4), { curl: true, bump: 0.04 }),
      E([-0.85, -0.3], [0.26, 0.24]), E([-0.5, -0.5], [0.3, 0.26]), KC(wave([-0.06, -0.1], [-0.12, 1.5], 0.26, 4), 0.26, 0.1, { sep: 0.1 })];
    default: return null;
  }
}

function hairShapes(st, V, f, hatted) {
  const nh = newHair(st, V, f, hatted);
  if (nh) return nh;
  if (st === 'highponytail') st = 'ponytail';
  // estilos volumosos ficam contidos sob o chapéu
  if (hatted && (st === 'afro' || st === 'mohawk' || st === 'bun')) st = st === 'afro' ? 'curly' : st === 'bun' ? (f ? 'ponytail' : 'short') : 'buzz';
  const mass = (clipV = -0.34, side = 0.84, sideV = 0.22) => E([0, -0.22], [1.13, 0.99], (u, v) => v < clipV || (Math.abs(u) > side && v < sideV));
  if (V === 'front') {
    switch (st) {
      case 'spiky': return [
        mass(-0.34, 0.84, 0.2),
        K([-0.6, -0.7], [-1.0, -1.0], [-1.42, -1.08], 0.36), K([-0.3, -0.85], [-0.5, -1.25], [-0.72, -1.55], 0.36),
        K([0.05, -0.9], [0.05, -1.35], [0.14, -1.7], 0.36), K([0.35, -0.85], [0.62, -1.2], [0.98, -1.44], 0.36), K([0.6, -0.7], [1.0, -0.9], [1.42, -0.92], 0.34),
        K([-0.78, -0.48], [-1.16, -0.38], [-1.55, -0.14], 0.34), K([-0.84, -0.18], [-1.12, -0.02], [-1.38, 0.3], 0.3),
        K([0.78, -0.48], [1.16, -0.34], [1.52, -0.1], 0.34), K([0.86, -0.14], [1.1, 0.04], [1.32, 0.36], 0.28),
        K([-0.64, -0.85], [-0.84, -0.48], [-1.0, -0.06], 0.3), K([-0.36, -0.95], [-0.5, -0.55], [-0.62, -0.12], 0.32),
        K([-0.06, -1.0], [-0.08, -0.55], [-0.16, 0.02], 0.3), K([0.24, -0.95], [0.32, -0.55], [0.28, -0.1], 0.3),
        K([0.54, -0.88], [0.68, -0.5], [0.74, -0.1], 0.3), K([0.78, -0.7], [0.98, -0.38], [1.04, 0.02], 0.26),
      ];
      case 'sidepart': return [
        mass(-0.3),
        K([-0.46, -0.96], [-0.82, -0.7], [-0.98, -0.1], 0.28), K([-0.44, -0.9], [-0.58, -0.55], [-0.64, -0.2], 0.22),
        K([-0.36, -0.98], [0.3, -0.92], [1.0, -0.36], 0.3), K([-0.32, -0.86], [0.25, -0.62], [0.84, -0.1], 0.3),
        K([-0.26, -0.74], [0.1, -0.42], [0.42, -0.06], 0.26),
        K([0.9, -0.5], [1.05, -0.2], [0.98, 0.2], 0.22), K([-0.88, -0.4], [-1.04, -0.1], [-0.96, 0.2], 0.2),
        K([-0.41, -1.08], [-0.42, -0.95], [-0.43, -0.8], 0.05, 0.05, { part: true }),
      ];
      case 'long': return [
        K([-0.9, 0.0], [-1.45, 1.3], [-1.3, 3.0], 0.62, 0.2, HBK), K([0.9, 0.0], [1.45, 1.3], [1.3, 3.0], 0.62, 0.2, HBK),
        K([-0.6, 0.2], [-1.0, 1.4], [-0.75, 3.2], 0.5, 0.2, HBK), K([0.6, 0.2], [1.0, 1.4], [0.75, 3.2], 0.5, 0.2, HBK),
        E([0, 1.2], [1.2, 1.9], null, HBK),
        mass(-0.22, 0.8, 0.3),
        K([-0.86, -0.62], [-1.18, 0.5], [-1.1, 2.3], 0.36, 0.1), K([-0.72, -0.5], [-1.0, 0.5], [-0.86, 1.85], 0.28, 0.06),
        K([0.86, -0.62], [1.18, 0.5], [1.1, 2.3], 0.36, 0.1), K([0.72, -0.5], [1.0, 0.5], [0.88, 1.9], 0.28, 0.06),
        K([-0.62, -0.9], [-0.7, -0.45], [-0.76, 0.04], 0.3), K([-0.32, -1.0], [-0.38, -0.5], [-0.42, -0.04], 0.32),
        K([-0.02, -1.0], [-0.02, -0.5], [-0.06, -0.08], 0.32), K([0.28, -1.0], [0.32, -0.5], [0.34, -0.04], 0.32),
        K([0.58, -0.9], [0.66, -0.45], [0.72, 0.02], 0.3),
      ];
      case 'ponytail': return [
        K([0.5, -0.9], [1.55, -0.6], [1.45, 1.1], 0.46, 0.06, HBK), K([0.55, -0.85], [1.3, -0.2], [1.12, 1.45], 0.34, 0.04, HBK),
        mass(-0.26, 0.82, 0.12),
        K([-0.86, -0.55], [-1.08, -0.1], [-0.98, 0.42], 0.26), K([0.86, -0.55], [1.08, -0.1], [0.98, 0.42], 0.26),
        K([-0.6, -0.9], [-0.66, -0.45], [-0.74, 0.0], 0.3), K([-0.3, -1.0], [-0.36, -0.5], [-0.44, -0.06], 0.32),
        K([0.0, -1.0], [0.02, -0.5], [-0.04, -0.12], 0.3), K([0.3, -1.0], [0.4, -0.55], [0.5, -0.06], 0.32),
        K([0.6, -0.9], [0.74, -0.5], [0.78, 0.02], 0.28),
        E([0.72, -0.86], [0.17, 0.17], null, { tie: true }),
      ];
      case 'twintails': return [
        K([-1.0, -0.5], [-1.7, 0.2], [-1.45, 2.4], 0.42, 0.08, HBK), K([-1.0, -0.4], [-1.45, 0.8], [-1.15, 2.1], 0.32, 0.04, HBK),
        K([1.0, -0.5], [1.7, 0.2], [1.45, 2.4], 0.42, 0.08, HBK), K([1.0, -0.4], [1.45, 0.8], [1.15, 2.1], 0.32, 0.04, HBK),
        mass(-0.24, 0.82, 0.18),
        K([-0.86, -0.55], [-1.06, -0.1], [-0.96, 0.4], 0.24), K([0.86, -0.55], [1.06, -0.1], [0.96, 0.4], 0.24),
        K([-0.6, -0.9], [-0.66, -0.45], [-0.72, 0.0], 0.3), K([-0.3, -1.0], [-0.34, -0.5], [-0.38, -0.08], 0.32),
        K([0.0, -1.0], [0.0, -0.5], [0.0, -0.02], 0.32), K([0.3, -1.0], [0.34, -0.5], [0.38, -0.08], 0.32),
        K([0.6, -0.9], [0.66, -0.45], [0.72, 0.0], 0.3),
        E([-1.04, -0.5], [0.18, 0.18], null, { tie: true }), E([1.04, -0.5], [0.18, 0.18], null, { tie: true }),
      ];
      case 'bob': return [
        E([0, 0.25], [1.18, 0.75], (u, v) => v > 0, HBK),
        mass(-0.22, 0.8, 0.9),
        K([-0.8, -0.7], [-1.22, 0.2], [-0.9, 0.98], 0.4, 0.2), K([0.8, -0.7], [1.22, 0.2], [0.9, 0.98], 0.4, 0.2),
        K([-0.7, -0.5], [-1.0, 0.3], [-0.74, 0.86], 0.3, 0.1), K([0.7, -0.5], [1.0, 0.3], [0.74, 0.86], 0.3, 0.1),
        PL([-0.84, -0.9, 0.84, -0.9, 0.86, -0.12, 0.6, -0.08, 0.5, -0.16, 0.2, -0.1, 0.0, -0.18, -0.24, -0.1, -0.5, -0.16, -0.62, -0.08, -0.86, -0.12]),
      ];
      case 'bun': return [
        E([0, -1.3], [0.46, 0.38], null, { bun: true }),
        { ...mass(-0.3, 0.84, 0.1), sepAll: true },
        K([-0.5, -0.95], [-0.82, -0.6], [-0.95, -0.12], 0.3), K([-0.2, -1.0], [-0.5, -0.6], [-0.62, -0.22], 0.28),
        K([0.3, -0.98], [0.6, -0.62], [0.74, -0.2], 0.28), K([0.6, -0.9], [0.92, -0.5], [0.96, -0.06], 0.26),
        K([-0.88, -0.3], [-1.02, 0.2], [-0.9, 0.62], 0.16), K([0.88, -0.3], [1.02, 0.2], [0.9, 0.62], 0.16),
      ];
      case 'afro': return [
        E([0, -0.38], [1.62, 1.4], (u, v) => !(Math.abs(u) < 0.86 && v > -0.36 + 0.06 * Math.cos(u * 9)) && v < 0.5 + 0.1 * Math.cos(u * 3), { curl: true }),
      ];
      case 'curly': return [
        E([0, -0.28], [1.26, 1.1], (u, v) => (v < -0.28 + 0.12 * Math.abs(Math.sin(u * 6))) || (Math.abs(u) > 0.84 && v < 0.55), { curl: true }),
        E([-0.55, -0.32], [0.28, 0.24]), E([-0.05, -0.36], [0.3, 0.24]), E([0.45, -0.32], [0.28, 0.24]),
        E([-0.98, 0.3], [0.24, 0.3]), E([0.98, 0.3], [0.24, 0.3]),
      ];
      case 'mohawk': return [
        E([0, -0.06], [1.02, 0.98], (u, v) => v < -0.42 || (Math.abs(u) > 0.86 && v < 0.1), { buzz: true }),
        K([0, -0.6], [-0.05, -1.2], [-0.18, -1.78], 0.3), K([0.0, -0.7], [0.12, -1.3], [0.3, -1.8], 0.3),
        K([-0.05, -0.75], [-0.25, -1.2], [-0.5, -1.5], 0.28), K([0.05, -0.75], [0.3, -1.15], [0.56, -1.42], 0.28),
        K([0.0, -0.5], [0.0, -0.9], [0.05, -1.5], 0.32),
      ];
      case 'buzz': return [E([0, -0.06], [1.02, 0.98], (u, v) => v < -0.44 + 0.04 * Math.cos(u * 8) || (Math.abs(u) > 0.88 && v < 0.12), { buzz: true })];
      default: return [ // short
        mass(-0.24),
        K([-0.86, -0.74], [-1.04, -0.34], [-0.96, 0.12], 0.26), K([-0.56, -0.95], [-0.64, -0.5], [-0.7, -0.04], 0.3),
        K([-0.22, -1.0], [-0.3, -0.55], [-0.36, -0.1], 0.32), K([0.14, -1.0], [0.12, -0.55], [0.04, -0.08], 0.3),
        K([0.5, -0.95], [0.52, -0.5], [0.44, -0.12], 0.3), K([0.8, -0.8], [0.94, -0.45], [0.82, -0.06], 0.28),
        K([0.92, -0.6], [1.06, -0.2], [0.98, 0.18], 0.24),
      ];
    }
  }
  if (V === 'back') {
    const crown = (low = 0.5) => E([0, -0.18], [1.14, 1.02], (u, v) => v < low - 0.1 * tri(u * 2.5));
    const napes = (y = 0.45) => [K([-0.8, -0.2], [-0.9, 0.3], [-0.7, y + 0.15], 0.3), K([-0.3, -0.1], [-0.35, 0.4], [-0.3, y + 0.18], 0.32), K([0.2, -0.1], [0.25, 0.4], [0.24, y + 0.2], 0.32), K([0.7, -0.2], [0.85, 0.3], [0.72, y + 0.16], 0.3)];
    switch (st) {
      case 'spiky': return [crown(0.4),
        K([-0.6, -0.7], [-1.0, -1.0], [-1.42, -1.08], 0.36), K([-0.3, -0.85], [-0.5, -1.25], [-0.72, -1.55], 0.36),
        K([0.05, -0.9], [0.05, -1.35], [0.14, -1.7], 0.36), K([0.35, -0.85], [0.62, -1.2], [0.98, -1.44], 0.36), K([0.6, -0.7], [1.0, -0.9], [1.42, -0.92], 0.34),
        K([-0.78, -0.48], [-1.16, -0.38], [-1.55, -0.14], 0.34), K([0.78, -0.48], [1.16, -0.34], [1.52, -0.1], 0.34),
        K([-0.8, -0.1], [-1.1, 0.2], [-1.3, 0.5], 0.32), K([0.8, -0.1], [1.1, 0.2], [1.3, 0.5], 0.32),
        K([-0.4, 0.0], [-0.5, 0.4], [-0.6, 0.72], 0.34), K([0.0, 0.0], [0.05, 0.4], [0.0, 0.78], 0.34), K([0.4, 0.0], [0.5, 0.4], [0.6, 0.72], 0.34)];
      case 'long': return [crown(0.6),
        K([-0.9, -0.2], [-1.25, 1.3], [-1.1, 3.0], 0.6, 0.2), K([0.9, -0.2], [1.25, 1.3], [1.1, 3.0], 0.6, 0.2),
        K([-0.4, 0.0], [-0.6, 1.5], [-0.5, 3.3], 0.6, 0.2), K([0.4, 0.0], [0.6, 1.5], [0.5, 3.3], 0.6, 0.2), K([0, 0.2], [0, 1.6], [0, 3.4], 0.5, 0.2)];
      case 'bob': return [E([0, -0.1], [1.2, 1.08], (u, v) => v < 0.95 - 0.08 * Math.abs(u)), ...[-0.8, -0.4, 0, 0.4, 0.8].map((x) => K([x, 0.2], [x * 1.05, 0.6], [x * 0.95, 1.0], 0.3, 0.12))];
      case 'ponytail': return [crown(0.5), ...napes(0.4),
        K([0, -0.55], [0.15, 0.4], [-0.05, 2.5], 0.42, 0.08), K([0, -0.5], [-0.25, 0.6], [0.12, 2.2], 0.3, 0.04),
        E([0, -0.55], [0.2, 0.17], null, { tie: true })];
      case 'twintails': return [crown(0.5), ...napes(0.35),
        K([-1.0, -0.5], [-1.7, 0.2], [-1.45, 2.4], 0.42, 0.08), K([1.0, -0.5], [1.7, 0.2], [1.45, 2.4], 0.42, 0.08),
        E([-1.04, -0.5], [0.18, 0.18], null, { tie: true }), E([1.04, -0.5], [0.18, 0.18], null, { tie: true })];
      case 'bun': return [crown(0.42), { ...E([0, -1.24], [0.48, 0.4], null, { bun: true }), sepAll: true }, ...napes(0.3)];
      case 'afro': return [E([0, -0.38], [1.62, 1.4], (u, v) => v < 0.62, { curl: true })];
      case 'curly': return [E([0, -0.28], [1.26, 1.12], (u, v) => v < 0.62 + 0.1 * Math.abs(Math.sin(u * 5)), { curl: true })];
      case 'mohawk': return [E([0, -0.06], [1.02, 0.98], (u, v) => v < 0.42, { buzz: true }), K([0, 0.3], [0, -0.6], [0, -1.6], 0.32, 0.2), K([0, -1.0], [0.1, -1.4], [0.1, -1.8], 0.28)];
      case 'buzz': return [E([0, -0.06], [1.02, 0.98], (u, v) => v < 0.4, { buzz: true })];
      case 'sidepart': return [crown(0.42), ...napes(0.3), K([-0.4, -1.0], [0.4, -0.95], [1.05, -0.4], 0.4)];
      default: return [crown(0.42), ...napes(0.32)];
    }
  }
  // ---- perfil (olhando para a esquerda; u < 0 = rosto)
  const crownS = (nape = 0.55) => E([0.12, -0.2], [1.12, 1.02], (u, v) => (u < -0.42 ? v < -0.3 : u < 0.0 ? v < -0.12 : u < 0.36 ? v < (u > 0.05 ? 0.02 : -0.05) : v < nape));
  const bangsS = [K([-0.3, -0.98], [-0.72, -0.72], [-1.02, -0.18], 0.32), K([-0.05, -1.0], [-0.55, -0.6], [-0.78, -0.02], 0.3), K([0.2, -0.95], [-0.25, -0.5], [-0.42, 0.02], 0.26)];
  const backS = (y = 0.55) => [K([0.5, -0.6], [0.95, -0.1], [0.9, y + 0.15], 0.34), K([0.2, -0.2], [0.6, 0.2], [0.55, y + 0.2], 0.3)];
  switch (st) {
    case 'spiky': return [crownS(0.45),
      K([-0.2, -0.8], [-0.4, -1.3], [-0.55, -1.6], 0.34), K([0.15, -0.85], [0.3, -1.35], [0.4, -1.66], 0.36), K([0.5, -0.7], [0.9, -1.1], [1.25, -1.3], 0.36),
      K([0.7, -0.4], [1.2, -0.45], [1.6, -0.35], 0.34), K([0.7, -0.1], [1.15, 0.05], [1.45, 0.25], 0.32), K([0.5, 0.1], [0.85, 0.4], [0.95, 0.72], 0.3),
      K([-0.3, -0.98], [-0.75, -0.7], [-1.12, -0.2], 0.34), K([-0.05, -1.0], [-0.55, -0.55], [-0.82, 0.02], 0.3), K([0.25, -0.9], [-0.15, -0.4], [-0.3, 0.06], 0.26)];
    case 'long': return [crownS(0.7), K([0.4, -0.6], [1.15, 0.6], [0.95, 2.6], 0.62, 0.2), K([0.2, -0.3], [0.7, 1.0], [0.55, 2.9], 0.5, 0.2), ...bangsS, K([-0.1, -0.6], [0.0, 0.6], [-0.1, 1.6], 0.24, 0.06)];
    case 'bob': return [crownS(0.92), K([0.3, -0.5], [1.15, 0.3], [0.9, 1.0], 0.45, 0.2), K([-0.1, -0.5], [0.15, 0.4], [-0.02, 0.98], 0.36, 0.14), ...bangsS];
    case 'ponytail': return [crownS(0.5), ...backS(0.4), ...bangsS, K([0.8, -0.85], [1.6, -0.5], [1.45, 1.2], 0.42, 0.06), K([0.8, -0.8], [1.35, 0.1], [1.15, 1.5], 0.3, 0.04), E([0.86, -0.82], [0.17, 0.18], null, { tie: true })];
    case 'twintails': return [crownS(0.45), ...backS(0.35), ...bangsS, K([0.6, -0.45], [1.0, 0.4], [0.8, 2.3], 0.42, 0.08), E([0.62, -0.42], [0.18, 0.18], null, { tie: true })];
    case 'bun': return [crownS(0.4), { ...E([0.72, -1.05], [0.48, 0.42], null, { bun: true }), sepAll: true }, ...bangsS.slice(0, 2)];
    case 'afro': return [E([0.15, -0.38], [1.55, 1.4], (u, v) => !(u < -0.5 && v > -0.34) && !(u < 0.05 && v > 0.6) && v < 0.75, { curl: true })];
    case 'curly': return [E([0.12, -0.26], [1.24, 1.12], (u, v) => (u < -0.42 ? v < -0.24 : u < 0.05 ? v < -0.02 : v < 0.75), { curl: true }), E([-0.85, -0.3], [0.26, 0.24]), E([-0.5, -0.5], [0.3, 0.26])];
    case 'mohawk': return [E([0.08, -0.04], [1.02, 0.98], (u, v) => (u < -0.15 ? v < -0.42 + (u + 1) * 0.08 : u < 0.36 ? v < 0.02 : v < 0.45) && !inE(u, v, 0.18, 0.3, 0.24, 0.32), { buzz: true }),
      K([-0.5, -0.7], [-0.7, -1.2], [-0.9, -1.5], 0.3), K([-0.1, -0.9], [-0.15, -1.45], [-0.25, -1.8], 0.32), K([0.35, -0.85], [0.5, -1.4], [0.6, -1.75], 0.32), K([0.75, -0.6], [1.1, -1.0], [1.35, -1.25], 0.3)];
    case 'buzz': return [E([0.08, -0.04], [1.02, 0.98], (u, v) => (u < -0.15 ? v < -0.42 + (u + 1) * 0.08 : u < 0.36 ? v < 0.02 : v < 0.45) && !inE(u, v, 0.18, 0.3, 0.24, 0.32), { buzz: true })];
    case 'sidepart': return [crownS(0.5), ...backS(0.35), K([0.3, -0.95], [-0.45, -0.9], [-1.0, -0.3], 0.3), K([0.1, -0.85], [-0.45, -0.65], [-0.8, -0.1], 0.26)];
    default: return [crownS(0.5), ...backS(0.4), ...bangsS];
  }
}

function rasterShape(S, H, sh, col) {
  if (sh.k === 'lock') {
    if (sh.chain) {
      const p = sh.chain, n = (p.length - 1) / 2;
      for (let i = 0; i < n; i++) S.bez(toPx(H, p[2 * i]), toPx(H, p[2 * i + 1]), toPx(H, p[2 * i + 2]), lerp(sh.w, sh.w1, i / n) * HRX, Math.max(0.3, lerp(sh.w, sh.w1, (i + 1) / n) * HRX), col);
    } else S.bez(toPx(H, sh.a), toPx(H, sh.m), toPx(H, sh.b), sh.w * HRX, Math.max(0.3, sh.w1 * HRX), col);
  } else if (sh.k === 'ell') {
    const [cu, cv] = sh.c, [ru, rv] = sh.r, bp = sh.bump || 0;
    hsFill(S, H, (u, v) => {
      if (sh.clip && !sh.clip(u, v)) return null;
      const du = (u - cu) / ru, dv = (v - cv) / rv, d = du * du + dv * dv;
      if (!bp) return d <= 1 ? col : null;
      const r = 1 + bp * Math.sin(Math.atan2(dv, du) * 14);   // borda ondulada (cachos)
      return d <= r * r ? col : null;
    }, 2.6);
  } else S.poly(sh.pts.map((v, i) => (i % 2 ? H.y + v * HRY : H.x + v * HRX)), col);
}

// trança: gomos alternados em diagonal, a partir do centro de cada linha
function braidTex(S, R) {
  const P = 4;
  for (let y = S.y0; y <= S.y1; y++) {
    let a = -1, b = -1;
    for (let x = S.x0; x <= S.x1; x++) if (S.p[y * S.w + x] != null) { if (a < 0) a = x; b = x; }
    if (a < 0 || b - a < 2) continue;
    const cx = (a + b + 1) / 2;
    for (let x = a; x <= b; x++) {
      const i = y * S.w + x, v = S.p[i];
      if (v == null) continue;
      const d = x + 0.5 - cx;
      const ph = mod(d < 0 ? y - d * 0.9 : y + d * 0.9 + P / 2, P);
      S.p[i] = ph < 1 ? R.s2 : ph < 2 && x < cx + 1 ? (v === R.s1 ? R.b : R.li) : ph < 2 ? v : x > cx ? R.s1 : v;
    }
  }
}

function ptHair(c, part) {
  const { P, o, g, V } = c;
  const H = g.head;
  const hat = o.hat, cov = hat ? HAT_COVER[hat.style] : undefined;
  const hatted = cov !== undefined;
  const shapes = hairShapes(o.hs, V, o.female, hatted).filter((s) => !!s.back === (part === 'back'));
  if (!shapes.length) return;
  const base = o.hairL, R = ramp(base);
  const HL = P.layer();
  const massSet = new Set();
  const tie = '#e3405a';
  for (const sh of shapes) {
    const S = P.layer();
    if (sh.tie) { rasterShape(S, H, sh, tie); shade(S, { s: 1, l: 1 }); stamp(HL, S, { ol: ramp(tie).ol }); continue; }
    if (sh.part) { rasterShape(S, H, sh, R.s2); stamp(HL, S, { ol: false }); continue; }
    if (sh.buzz) {
      // cabelo raspado: pele com pontinhos de cabelo
      // raspado: cor do cabelo sobre a pele; no moicano as laterais ficam quase pele
      const mo = o.hs === 'mohawk' && !hatted;
      const bc = mo ? mix(o.skin, R.s2, 0.16) : mix(o.skin, base, 0.72), dot = mo ? mix(o.skin, R.s2, 0.3) : mix(o.skin, base, 0.9);
      rasterShape(S, H, sh, bc);
      S.map((v, x, y) => ((x * 3 + y * 5) % (mo ? 11 : 7) === 0 ? dot : v));
      shade(S, { s: 2, l: 1, skip: new Set([dot]) });
      stamp(HL, S, { ol: false });
      continue;
    }
    rasterShape(S, H, sh, base);
    if (sh.cut !== undefined) S.keep((x, y) => y + 0.5 < H.y + sh.cut * HRY);   // corte reto
    if (sh.curl) {
      // cachos: bolinhas com sombra embaixo
      const k = typeof sh.curl === 'number' ? sh.curl : 4.2;
      S.map((v, x, y) => {
        const u = (x + 0.5 - H.x) / HRX * k, w = (y + 0.5 - H.y) / HRY * k + (Math.floor((x + 0.5 - H.x) / HRX * k) % 2) * 0.5;
        const fu = u - Math.floor(u), fw = w - Math.floor(w);
        return fw > 0.72 && fu > 0.2 && fu < 0.85 ? R.s1 : fw < 0.25 && fu > 0.3 && fu < 0.7 ? R.li : v;
      });
    }
    shade(S, { s: sh.k === 'lock' ? 1 : 3, d: sh.k === 'lock' ? 0 : 1, l: 1 });
    if (sh.bun) S.map((v, x, y) => (Math.abs(((x + 0.5 - H.x) - 0.6 * ((y + 0.5) - (H.y - 1.2 * HRY)))) % 4 < 1 ? s1(v) : v));
    if (sh.braid) braidTex(S, R);
    // franja reta: fios verticais curtos acima do corte
    if (sh.fringe !== undefined) { const by = H.y + sh.fringe * HRY; S.map((v, x, y) => (y + 0.5 > by - 5 && mod(x, 3) === 1 && y + 0.5 < by - 0.5 ? s1(v) : v)); }
    // cabelo liso de corte reto: fios verticais longos
    if (sh.strands) S.map((v, x, y) => (mod(x + (y > H.y + 14 ? 1 : 0), 4) === 0 && y > H.y - 6 && v !== R.s2 ? s1(v) : v));
    // linhas de separação entre mechas (só longe da raiz)
    if (sh.k === 'lock' && !HL.empty()) {
      const [ax, ay] = toPx(H, sh.a), [bx, by] = toPx(H, sh.b);
      const len = Math.hypot(bx - ax, by - ay) || 1;
      const sep = R.s2;
      for (let y = Math.max(0, S.y0 - 1); y <= Math.min(S.h - 1, S.y1 + 1); y++) for (let x = Math.max(0, S.x0 - 1); x <= Math.min(S.w - 1, S.x1 + 1); x++) {
        if (S.p[y * S.w + x] != null || HL.p[y * S.w + x] == null) continue;
        const nb = S.has(x - 1, y) || S.has(x + 1, y) || S.has(x, y - 1) || S.has(x, y + 1);
        if (!nb) continue;
        const t = ((x + 0.5 - ax) * (bx - ax) + (y + 0.5 - ay) * (by - ay)) / (len * len);
        if (t > (sh.sep ?? (hatted ? 0.6 : 0.45)) && !massSet.has(y * S.w + x)) { HL.p[y * S.w + x] = sep; HL.f[y * S.w + x] = 1; }
      }
    }
    // massa que passa por cima de outra forma (ex.: coque): linha escura no encontro
    if (sh.sepAll) for (let y = Math.max(0, S.y0 - 1); y <= Math.min(S.h - 1, S.y1 + 1); y++) for (let x = Math.max(0, S.x0 - 1); x <= Math.min(S.w - 1, S.x1 + 1); x++) {
      if (S.p[y * S.w + x] != null || HL.p[y * S.w + x] == null) continue;
      if (S.has(x - 1, y) || S.has(x + 1, y) || S.has(x, y - 1) || S.has(x, y + 1)) { HL.p[y * S.w + x] = R.s2; HL.f[y * S.w + x] = 1; }
    }
    stamp(HL, S, { ol: false });
    if (sh.k !== 'lock') S.map((v, x, y) => { massSet.add(y * S.w + x); return v; });
  }
  // brilho em arco (luz de cima à esquerda)
  if (V !== 'back' || true) {
    const cu = V === 'side' ? 0.15 : 0, cv = -0.05;
    HL.map((v, x, y) => {
      if (v !== base) return v;
      const u = (x + 0.5 - H.x) / HRX, w = (y + 0.5 - H.y) / HRY, d = Math.hypot(u - cu, (w - cv) * 1.05);
      const ok = V === 'side' ? u > -0.7 && u < 0.6 : V === 'back' ? u > -0.75 && u < 0.2 : u > -0.85 && u < 0.35;
      if (ok && w < -0.2 && d > 0.7 && d < 0.84) return R.hi;
      if (ok && w < -0.2 && d > 0.62 && d < 0.92) return R.li;
      return v;
    });
  }
  if (part === 'back') HL.map((v) => s1(v));
  // chapéu: o cabelo acima da linha de cobertura some
  if (hatted) HL.keep((x, y) => (y + 0.5 - H.y) / HRY >= cov + (V === 'side' && (x + 0.5 - H.x) / HRX > 0.3 ? 0.08 : 0));
  // o contorno das mechas (pixels marcados) não vira silhueta: só o contorno externo da camada
  stamp(P, HL, { cast: part === 'back' ? null : [0.25, 1], castN: 2 });
}
function ptHairBack(c) { ptHair(c, 'back'); }

// ------------------------------------------------------------------ chapéus
function ptHat(c) {
  const { P, o, g, V } = c;
  const H = g.head;
  const L = P.layer();
  const h = o.hat;
  const st = h.style;
  const ctx = HAIR_ACC.has(st) ? hairAccCtx(o, V) : null;
  hsFill(L, H, (u, v, x, y) => hatShape(h, V, u, v, x, y, ctx), 2.4);
  // tiara e presilhas ficam só por cima do cabelo/cabeça
  if (st === 'headband' || st === 'hairclips') L.keep((x, y) => { const v = P.get(x, y); return v != null && !isA(v); });
  if (L.empty()) return;
  const skip = new Set([WHITE, '#f8dc70', '#f2c230', '#e2a920', '#3a8fd0', '#e3403b', '#ffe28a', '#2f2f36', '#ffb3c8']);
  if (ctx) shade(L, { s: 1, d: st === 'bow' ? 1 : 0, l: 1, skip: ctx.keep });
  else shade(L, { s: st === 'cap' || st === 'cap2' || st === 'sunvisor' ? 3 : 2, d: 1, l: 2, skip: st === 'crown' || st === 'ears' || st === 'flower' ? skip : null });
  hatDetails(L, c);
  put(c, L, null, { cast: [0.2, 1], castN: st === 'hairclips' || st === 'headband' ? 1 : 2 });
}

// enfeites de cabelo: o lugar depende do penteado
const HAIR_ACC = new Set(['bow', 'headband', 'hairclips']);
function hairAccCtx(o, V) {
  const hs = o.hs, s = V === 'back' ? -1 : 1;
  // laço: preso no elástico dos rabos; no alto da cabeça (ao lado) nos outros
  let bow = [0.62 * s, -0.95, 25 * s];
  if (V === 'side') bow = [0.3, -1.05, 10];
  if (hs === 'ponytail') bow = V === 'front' ? [0.72, -0.86, 0] : V === 'side' ? [0.86, -0.82, 0] : [0, -0.55, 0];
  else if (hs === 'highponytail') bow = V === 'front' ? [0.24, -1.12, 0] : V === 'side' ? [0.62, -1.0, 0] : [0, -0.98, 0];
  else if (hs === 'sideponytail') bow = V === 'front' ? [0.96, -0.14, 0] : V === 'side' ? [0.4, 0.02, 0] : [-0.98, -0.12, 0];
  else if (hs === 'doublebun') bow = V === 'side' ? [0.4, -0.9, 10] : [0, -1.1, 0];
  else if (hs === 'afro') bow = V === 'side' ? [0.4, -1.62, 10] : [1.0 * s, -1.42, 30 * s];
  else if (hs === 'mohawk' || hs === 'spiky') bow = V === 'side' ? [0.5, -1.0, 10] : [0.78 * s, -0.85, 30 * s];
  const big = hs === 'afro' || hs === 'curlylong' || hs === 'curly' ? 1.28 : 1.14;
  return { bow, big, keep: new Set([WHITE, '#ffffff']) };
}
// distância (px) do ponto (u,v) a uma curva amostrada no espaço da cabeça
function curveDist(u, v, pts) {
  let best = 99;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const dx = (bx - ax) * HRX, dy = (by - ay) * HRY, px = (u - ax) * HRX, py = (v - ay) * HRY;
    const t = clamp((px * dx + py * dy) / (dx * dx + dy * dy || 1)), qx = px - dx * t, qy = py - dy * t;
    best = Math.min(best, Math.hypot(qx, qy));
  }
  return best;
}
const bezPts = (a, m, b, n = 14) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, w = 1 - t; return [w * w * a[0] + 2 * w * t * m[0] + t * t * b[0], w * w * a[1] + 2 * w * t * m[1] + t * t * b[1]]; });
const HEADBAND = {
  front: bezPts([-1.16, -0.2], [0, -1.44], [1.16, -0.2], 20),
  side: bezPts([-0.36, -1.14], [0.4, -1.08], [0.36, 0.1], 16),
  back: bezPts([-1.12, -0.36], [0, -1.62], [1.12, -0.36], 20),
};

function hatShape(h, V, u, v, x, y, ctx) {
  const c = lift(h.color), c2 = h.color2 ? lift(h.color2) : WHITE;
  const au = Math.abs(u), side = V === 'side';
  const R = ramp(c);
  switch (h.style) {
    case 'bow': {
      // laço grande: nó no meio, duas alças em gravata-borboleta e duas pontas caindo
      const [bu, bv, ang] = ctx.bow, k = ctx.big, sq = side ? 0.72 : 1;
      const a = ang * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
      const dx = (u - bu) * HRX, dy = (v - bv) * HRY;
      const px = (dx * ca + dy * sa) / k / sq, py = (-dx * sa + dy * ca) / k;
      const ax = Math.abs(px);
      if (ax < 1.5 && Math.abs(py) < 1.7) return ax < 0.6 && py < -0.4 ? R.li : c;                        // nó
      if (ax >= 1.2 && ax < 6.2 && Math.abs(py) < 1.1 + (ax - 1.2) * 0.62 && inE(ax, py, 3.7, 0, 2.9, 2.9)) {
        if (ax < 3.4 && Math.abs(py) < 0.55) return R.s2;                                                  // dobra
        return py < -0.9 && ax > 2.4 && ax < 4.6 ? R.li : c;
      }
      if (py >= 1.2 && py < 6) {                                                                           // pontas
        const off = 0.7 + (py - 1.2) * 0.5, w = 0.8;
        const end = py > 5.4 - Math.abs(Math.abs(px) - off) * 1.2;
        if (Math.abs(Math.abs(px) - off) < w && !end) return px < 0 ? c : R.s1;
      }
      return null;
    }
    case 'headband': {
      if (v > 0.25 || v < -1.62 || au > 1.3 || (side && Math.abs(u) > 0.6)) return null;
      const pts = HEADBAND[V];
      const d = curveDist(u, v, pts);
      if (d < 1.0) return d < 0.4 && v < -0.6 ? R.li : c;
      return null;
    }
    case 'hairclips': {
      // três presilhas em diagonal acima da orelha
      const s = V === 'back' ? -1 : 1;
      const list = side ? [[-0.08, -0.62], [0.06, -0.42], [0.2, -0.22]] : [[0.62 * s, -0.66], [0.74 * s, -0.46], [0.84 * s, -0.25]];
      for (const [cu, cv] of list) {
        const dx = (u - cu) * HRX, dy = (v - cv) * HRY;
        const a = (side ? -35 : 35 * s) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
        const px = dx * ca + dy * sa, py = -dx * sa + dy * ca;
        if (Math.abs(px) < 2.6 && Math.abs(py) < 0.75) return px < -1.4 ? R.hi : c;
      }
      return null;
    }
    case 'sunvisor': {
      if (side) {
        if (inPoly(u, v, [-0.62, -0.74, -1.38, -0.72, -1.76, -0.62, -1.78, -0.52, -1.42, -0.48, -0.62, -0.52])) return v > -0.57 ? R.s2 : c;
        if (inE(u, v, 0.1, -0.46, 1.16, 0.97) && v < -0.56 && v > -0.8 + Math.max(0, u - 0.6) * 0.1) return c;
        return null;
      }
      if (V === 'front' && inE(u, v, 0, -0.6, 1.32, 0.19) && v > -0.7) return v > -0.52 ? R.s2 : v > -0.58 ? R.s1 : c;
      if (inE(u, v, 0, -0.46, 1.16, 0.97) && v < -0.6 && v > -0.84) {
        if (V === 'back' && au < 0.16 && v > -0.8) return R.s2;       // regulador
        return c;
      }
      return null;
    }
    case 'cap': case 'cap2': {
      if (side) {
        // aba para a frente (esquerda)
        if (inPoly(u, v, [-0.6, -0.78, -1.35, -0.76, -1.72, -0.66, -1.74, -0.56, -1.4, -0.52, -0.6, -0.56])) return v > -0.61 ? R.s2 : c;
        if (inE(u, v, 0.1, -0.5, 1.14, 0.94) && v < -0.58) return h.style === 'cap2' && u < -0.2 && v > -1.3 ? c2 : c;
        return null;
      }
      if (V === 'front' && inE(u, v, 0, -0.62, 1.3, 0.18) && v > -0.72) return v > -0.54 ? R.s2 : v > -0.6 ? R.s1 : c;
      if (inE(u, v, 0, -0.48, 1.13, 0.94) && v < -0.62) {
        if (V === 'back') {
          if (inE(u, v, 0, -0.66, 0.26, 0.14)) return null;
          if (inE(u, v, 0, -0.66, 0.36, 0.24)) return R.s1;
          return c;
        }
        if (h.style === 'cap2' && au < 0.58 + (v + 0.66) * 0.18 && v > -1.3) return c2;
        return c;
      }
      if (inE(u, v, 0, -1.42, 0.14, 0.09)) return R.s1;
      return null;
    }
    case 'beanie': {
      const pu = side ? 0.08 : 0;
      if (inE(u, v, pu, -1.36, 0.3, 0.26)) return mod(x + y, 2) ? R.li : c;
      if (inE(u, v, pu, -0.26, 1.18, 1.06) && v < -0.18) return v > -0.48 ? (mod(x, 2) ? R.s1 : c) : c;
      return null;
    }
    case 'bucket': {
      if (v > -0.46 && v < -0.12 && au < (side ? 1.22 : 1.18) + (v + 0.46) * 1.2) return v > -0.22 ? R.s1 : c;
      if (inE(u, v, side ? 0.06 : 0, -0.46, 1.02, 0.9) && v <= -0.46) return v > -0.6 ? R.s2 : c;
      return null;
    }
    case 'sunhat': {
      if (inE(u, v, 0, -0.66, 0.94, 0.8) && v < -0.46) return v > -0.68 ? '#e3608f' : c;
      if (inE(u, v, side ? -0.1 : 0, -0.46, side ? 1.9 : 2.0, 0.3)) return v > -0.4 ? R.s1 : c;
      return null;
    }
    case 'cowboy': {
      const up = au > 1.15 ? (au - 1.15) * 0.9 : 0;
      if (au < (side ? 1.75 : 1.85) && v > -0.56 - up && v < -0.3 - up * 0.6) return v > -0.4 - up * 0.6 ? R.s1 : c;
      const topV = -1.5 + 0.22 * (1 - Math.min(1, (u / 0.5) ** 2));
      if (au < 0.84 - Math.max(0, -1.1 - v) * 0.4 && v > topV && v <= -0.5) return v > -0.78 ? '#3a2a1a' : c;
      return null;
    }
    case 'beret': {
      const cu = V === 'back' ? -0.22 : 0.22;
      if (inE(u, v, cu * 0.8, -1.25, 0.1, 0.12)) return R.s1;
      if (inE(u, v, cu, -0.78, 1.24, 0.46)) return v > -0.5 ? R.s1 : c;
      return null;
    }
    case 'tophat': {
      if (inE(u, v, 0, -0.52, 1.36, 0.18)) return R.s1;
      if (au < 0.82 && v > -1.98 && v < -0.52) return v > -0.9 && v < -0.66 ? '#d8433c' : c;
      return null;
    }
    case 'bandana': {
      if (side && inPoly(u, v, [0.9, -0.38, 1.5, -0.05, 1.32, 0.4, 1.05, 0.05])) return R.s1;
      if (V === 'back' && (inPoly(u, v, [-0.15, -0.3, 0.15, -0.3, 0.32, 0.55, 0.05, 0.38, -0.12, 0.55]) || inE(u, v, 0, -0.32, 0.22, 0.15))) return R.s1;
      if (inE(u, v, side ? 0.1 : 0, -0.12, 1.15, 1.08) && v < -0.28) {
        if (v > -0.42) return R.s1;
        return mod(x + y * 2, 5) === 0 ? WHITE : c;
      }
      return null;
    }
    case 'ears': {
      const yel = c === lift('#efc23a');
      const ring = inE(u, v, side ? 0.1 : 0, -0.1, 1.16, 1.1) && !inE(u, v, side ? 0.1 : 0, -0.1, 1.0, 0.96) && v < -0.3;
      const ears = side ? [[-0.1, 1], [0.38, 1]] : [[-1, -1], [1, 1]];
      for (const [eu, s] of ears) {
        const bx = side ? eu : eu * 0.6;
        const tall = yel ? 2.1 : 1.9;
        if (inPoly(u, v, [bx - 0.32, -0.82, bx + 0.32, -0.82, bx + (side ? 0.2 : s * 0.34), -tall])) {
          if (yel && v < -tall + 0.45) return '#2f2f36';
          if (V !== 'back' && inPoly(u, v, [bx - 0.14, -0.9, bx + 0.14, -0.9, bx + (side ? 0.16 : s * 0.27), -tall + 0.4])) return yel ? R.li : '#ffb3c8';
          return c;
        }
      }
      return ring ? R.s1 : null;
    }
    case 'flower': {
      const fu = side ? 0.34 : V === 'back' ? -0.8 : 0.8, fv = -0.66;
      const du = u - fu, dv = v - fv, r = Math.hypot(du * 1.1, dv), ang = Math.atan2(dv, du);
      if (r < 0.1) return '#ffe28a';
      if (r < 0.26 + 0.09 * Math.cos(ang * 5)) return r < 0.16 ? R.s1 : c;
      return null;
    }
    case 'crown': {
      const pts = [-0.76, -0.8, -0.76, -1.52, -0.47, -1.12, -0.24, -1.6, 0, -1.14, 0.24, -1.6, 0.47, -1.12, 0.76, -1.52, 0.76, -0.8];
      if (inPoly(u, v, pts)) {
        if (inE(u, v, 0, -0.95, 0.14, 0.11)) return '#e3403b';
        if (V !== 'back' && (inE(u, v, -0.46, -0.95, 0.09, 0.09) || inE(u, v, 0.46, -0.95, 0.09, 0.09))) return '#3a8fd0';
        return v > -1.02 ? '#e2a920' : '#f2c230';
      }
      return null;
    }
    default: return null;
  }
}

function hatDetails(L, c) {
  const { o, g, V } = c;
  const h = o.hat, st = h.style, H = g.head;
  const col = lift(h.color), R = ramp(col);
  const x0 = Math.round(H.x), y0 = Math.round(H.y);
  if ((st === 'cap' || st === 'cap2') && V === 'front') {
    // costuras dos gomos e botão
    const top = y0 - 17;
    for (let k = 0; k < 9; k++) { L.paint(x0 - 6 - k * 0.25, top + 1 + k, s1(L.get(Math.floor(x0 - 6 - k * 0.25), top + 1 + k) || col)); L.paint(x0 + 5 + k * 0.25, top + 1 + k, s1(L.get(Math.floor(x0 + 5 + k * 0.25), top + 1 + k) || col)); }
    // brilho na aba
    for (let x = x0 - 10; x < x0 - 3; x++) L.paint(x, y0 - 9, R.li);
    if (st === 'cap2') {
      // escudinho genérico no painel da frente
      const em = ['KKKKK', 'KWDWK', 'KWDWK', '.KDK.', '..K..'];
      const pal = { K: col, W: '#d4d8e0', D: col };
      L.blit(x0 - 2, y0 - 15, em, pal);
      L.set(x0, y0 - 17, '#f2c230');
    } else {
      L.blit(x0 - 2, y0 - 15, ['.WWW.', 'WW.WW', '.WWW.'], { W: WHITE });
    }
  }
  if ((st === 'cap' || st === 'cap2') && V === 'side') {
    for (let x = x0 - 17; x < x0 - 9; x++) L.paint(x, y0 - 9, R.li);
    if (st === 'cap2') L.blit(x0 - 9, y0 - 15, ['KKK', 'KWK', '.K.'], { K: col, W: '#d4d8e0' });
  }
  if (st === 'tophat') L.paint(x0 - 6, y0 - 18, R.hi);
  if (st === 'sunvisor' && V === 'front') for (let x = x0 - 10; x < x0 - 3; x++) L.paint(x, y0 - 8, R.li);
  if (st === 'sunvisor' && V === 'side') for (let x = x0 - 17; x < x0 - 9; x++) L.paint(x, y0 - 8, R.li);
}

// ================================================================== mapa (28x44)
// Coordenadas inteiras: centro do corpo entre as colunas 13 e 14; sola no y 41.
// A cabeça usa uma "caixa" de 20x20 (crânio nas colunas 3..16, linhas 4..16).

// crânio de frente/costas e de perfil (olhando para a esquerda)
const OW_SKULL = {
  front: ['.......######.......', '.....##########.....', '....############....', '...##############...', '...##############...', '...##############...', '...##############...',
    '..################..', '..################..', '...##############...', '....############....', '.....##########.....', '.......######.......'],
  side: ['.......######.......', '.....##########.....', '....############....', '....#############...', '....#############...', '....#############...', '....#############...',
    '....#############...', '...##############...', '....############....', '....###########.....', '.....#########......', '......######........'],
};

// Cabelos: 'x' = cabelo (sombreado automático), '5' = linha escura entre mechas,
// '1' = brilho, 'b' = cabelo atrás do corpo (só na vista de frente), 't' = elástico.
// [linha inicial na caixa, linhas...]
const OW_HAIR = {
  front: {
    short: [1,
      '......xxxxxxxx......',
      '....xxxxxxxxxxxx....',
      '...xx11xxxxxxxxxx...',
      '..xx1xxxxxxxxxxxxx..',
      '..xxxxxxxxxxxxxxxx..',
      '..xxxxxxxxxxxxxxxx..',
      '..xxxxxxx5xxxxxxxx..',
      '..xxxx5xxxx5xxx5xx..',
      '..xx.xx.xxx.xx..xx..',
      '..x......x.......x..',
      '..x..............x..'],
    spiky: [-1,
      '......x.....x.......',
      '...x..xx...xx...x...',
      '...xxxxxxxxxxxxxx...',
      '..xxxxxxxxxxxxxxxx..',
      '.xxxx11xxxxxxxxxxxx.',
      'xxxx1xxxxxxxxxxxxxxx',
      '.xxxxxxxxxxxxxxxxxx.',
      '..xxxxxxxxxxxxxxxx..',
      '.xxxxxxx5xxxx5xxxxx.',
      'xxxxx5xxxx5xxx5xxxxx',
      '.xx.xx.xxx.xx.xx.xx.',
      '..x..x...x....x..x..',
      '..x..............x..'],
    sidepart: [1,
      '......xxxxxxxx......',
      '....xxxxxxxxxxxx....',
      '...xx1x5xxxxxxxxx...',
      '..xx1xx5xxxxxxxxxx..',
      '..xxxx5xxxxxxxxxxx..',
      '..xxx5xxxxxxxxxxxx..',
      '..xx.xxxxxxxxxxxxx..',
      '..xx..xxxxxxxx5xxx..',
      '..x.....xxxxxxxxxx..',
      '..x..........xxxxx..',
      '..x...........x..x..'],
    long: [1,
      '......xxxxxxxx......',
      '....xxxxxxxxxxxx....',
      '...xx11xxxxxxxxxx...',
      '..xx1xxxxxxxxxxxxx..',
      '..xxxxxxxxxxxxxxxx..',
      '.xxxxxxxxxxxxxxxxxx.',
      '.xxxxxxx5xxxx5xxxxx.',
      '.xxxx5xxxx5xxxx5xxx.',
      '.xxx.xx.xxx.xx.xxxx.',
      '.xxx.....x......xxx.',
      'bxxx............xxxb',
      'bxxx............xxxb',
      'bxxx............xxxb',
      'bbxx............xxbb',
      'bbxx............xxbb',
      'bbx5............5xbb',
      'bbbx............xbbb',
      'bbbbbbbbbbbbbbbbbbbb',
      'bbbbbbbbbbbbbbbbbbbb',
      '.bbbbbbbbbbbbbbbbbb.',
      '.bbbbbbbbbbbbbbbbbb.',
      '.bb.bbbbbbbbbbbb.bb.',
      '..b..bbb.bb.bbb..b..'],
    ponytail: [1,
      '......xxxxxxxx......',
      '....xxxxxxxxxxxxtt..',
      '...xx11xxxxxxxxxttb.',
      '..xx1xxxxxxxxxxxxxbb',
      '..xxxxxxxxxxxxxxxxbb',
      '..xxxxxxxxxxxxxxxxbb',
      '..xxxxxx5xxxx5xxxxbb',
      '..xxxx5xxxx5xxx5xx.b',
      '..xx.xxx.xx.xxx.xx.b',
      '..xx.....x.......x..',
      '..x..............x..'],
    twintails: [1,
      '......xxxxxxxx......',
      '....xxxxxxxxxxxx....',
      '...xx11xxxxxxxxxx...',
      '..xx1xxxxxxxxxxxxx..',
      '..xxxxxxxxxxxxxxxx..',
      '.txxxxxxxxxxxxxxxxt.',
      'btxxxxxx5xxxx5xxxxtb',
      'bxxxx5xxxx5xxxx5xxxb',
      'bxx.xxx.xxx.xxx.xxxb',
      'bbx......x.......xbb',
      'bbx..............xbb',
      'bb................bb',
      'bb................bb',
      'bb................bb',
      'bb................bb',
      '.bb..............bb.',
      '.bb..............bb.',
      '.b................b.'],
    bob: [1,
      '......xxxxxxxx......',
      '....xxxxxxxxxxxx....',
      '...xx11xxxxxxxxxx...',
      '..xx1xxxxxxxxxxxxx..',
      '..xxxxxxxxxxxxxxxx..',
      '.xxxxxxxxxxxxxxxxxx.',
      '.xxxxxxxxxxxxxxxxxx.',
      '.xxxxxxxxxxxxxxxxxx.',
      '.xxx..............xx.',
      '.xxx..............xxx',
      '.xxx.............xxx.',
      '.xxx.............xxx.',
      '.xx5.............5xx.',
      '..xx.............xx..',
      '...x.............x...'],
    bun: [-2,
      '.......xxxxx........',
      '......xx1xxxx.......',
      '......xxxxxx5.......',
      '.......55555........',
      '......xxxxxxxx......',
      '....xxxxxxxxxxxx....',
      '...xx11xxxxxxxxxx...',
      '..xx1xxxxxxxxxxxxx..',
      '..xxxxxxxxxxxxxxxx..',
      '..xxxxxxxxxxxxxxxx..',
      '..xxxxx5xxxxx5xxxx..',
      '..xxx.xxxx..xxxx.x..',
      '..xx...x......x..x..',
      '..x..............x..'],
    afro: [-3,
      '.....xxxxxxxxxx.....',
      '...xxxxxxxxxxxxxx...',
      '..xxx1xxxxxxxxxxxx..',
      '.xxx1xxxxx5xxxxxxxx.',
      '.xx1xxxxxxxxxxx5xxx.',
      'xxxxxx5xxxxxxxxxxxxx',
      'xxxxxxxxxxxx5xxxxxxx',
      'xxx5xxxxxxxxxxxxx5xx',
      'xxxxxxxxx5xxxxxxxxxx',
      'xxxxxxxxxxxxxxxxxxxx',
      'xxxxx5xxxxxxx5xxxxxx',
      'xxxxxxxxxxxxxxxxxxxx',
      'xxxxx.x.xx.xx.x.xxxx',
      'xxxx............xxxx',
      '.xxx............xxx.',
      '..xx............xx..'],
    curly: [0,
      '.....xx.xxxx.xx.....',
      '...xxxxxxxxxxxxxx...',
      '..xxx11xxxx5xxxxxx..',
      '.xxx1xxx5xxxxxxx5xx.',
      '.xxxxxxxxxxxxxxxxxx.',
      '.xx5xxxxxx5xxxxxxxx.',
      '.xxxxxxxxxxxxx5xxxx.',
      '.xxxx5xxxxxxxxxxx5x.',
      '.xxx.xxx.xxxx.xx.xx.',
      '.xxx..x...xx...x.xx.',
      '.xx..............xx.',
      '..x..............x..',
      '..x..............x..'],
    mohawk: [-3,
      '.........xx.........',
      '........xxxx........',
      '........x1xx........',
      '........x1xx........',
      '.......sxxxxs.......',
      '.....sssxxxxsss.....',
      '....ssssxxxxssss....',
      '...sssssxx5xsssss...',
      '...sssssxxxxsssss...',
      '...ssssss55ssssss...',
      '..s..............s..',
      '..s..............s..'],
    buzz: [4,
      '.......ssssss.......',
      '.....ssssssssss.....',
      '....ssssssssssss....',
      '...ssssssssssssss...',
      '...ss..........ss...',
      '..ss............ss..',
      '..s..............s..'],
  },
  side: {
    short: [1,
      '......xxxxxxx.......',
      '....xxxxxxxxxxx.....',
      '...xx11xxxxxxxxx....',
      '..xx1xxxxxxxxxxxx...',
      '..xxxxxxxxxxxxxxxx..',
      '..xxxxxxxxxxxxxxxx..',
      '..xxxxxxxxx5xxxxxx..',
      '..xx5xxx..xxxxxxxx..',
      '..x.x.x...xxx5xxxx..',
      '...........xxxxxxx..',
      '............xxxxx...',
      '.............xxx....'],
    spiky: [-1,
      '.......x....x.......',
      '...x...xx..xx...x...',
      '...xx.xxxxxxxx.xx...',
      '..xxxxxxxxxxxxxxx...',
      '..xx11xxxxxxxxxxxxxx',
      '.xx1xxxxxxxxxxxxxxx.',
      'xxxxxxxxxxxxxxxxxx..',
      '..xxxxxxxxxxxxxxxxxx',
      '..xxxxxxxxx5xxxxxxx.',
      '.xxx5xxx..xxxxxxxxxx',
      '.x.xx.x...xxx5xxxx..',
      '...x.......xxxxxxxx.',
      '............xxxxx...',
      '.............x.x....'],
    sidepart: [1,
      '......xxxxxxx.......',
      '....xxxxxxxxxxx.....',
      '...xxx5xxxxxxxxx....',
      '..xxx5x1xxxxxxxxx...',
      '..xxxxx1xxxxxxxxxx..',
      '..xxxxxxxxxxxxxxxx..',
      '.xxxxxxxxxx5xxxxxx..',
      '.xxxxxxx..xxxxxxxx..',
      '..xxxx....xxx5xxxx..',
      '..xx.......xxxxxxx..',
      '............xxxxx...',
      '.............xxx....'],
    long: [1,
      '......xxxxxxx.......',
      '....xxxxxxxxxxx.....',
      '...xx11xxxxxxxxx....',
      '..xx1xxxxxxxxxxxx...',
      '..xxxxxxxxxxxxxxxx..',
      '..xxxxxxxxxxxxxxxxx.',
      '..xxxxxxxxx5xxxxxxx.',
      '..xx5xxx..xxxxxxxxx.',
      '..x.x.x...xxx5xxxxx.',
      '..........xxxxxxxxx.',
      '..........xxxxxxxxx.',
      '...........xxxxxxxx.',
      '...........xxxxxxxx.',
      '...........xxxxxxxxx',
      '............xxxxxxxx',
      '............xxxxxxxx',
      '............xxxx5xxx',
      '.............xxxxxxx',
      '.............xxxxxx.',
      '.............xxxxxx.',
      '..............x.xx..'],
    ponytail: [1,
      '......xxxxxxx.......',
      '....xxxxxxxxxxx.....',
      '...xx11xxxxxxxxxtt..',
      '..xx1xxxxxxxxxxxttx.',
      '..xxxxxxxxxxxxxxxxxx',
      '..xxxxxxxxxxxxxxxxxx',
      '..xxxxxxxxx5xxxxx.xx',
      '..xx5xxx..xxxxxxx.xx',
      '..x.x.x...xxx5xxx.xx',
      '...........xxxxxx.xx',
      '............xxxx..xx',
      '..................xx',
      '..................x.'],
    twintails: [1,
      '......xxxxxxx.......',
      '....xxxxxxxxxxx.....',
      '...xx11xxxxxxxxx....',
      '..xx1xxxxxxxxxxxx...',
      '..xxxxxxxxxxxxxxxx..',
      '..xxxxxxxxxxxxtxxx..',
      '..xxxxxxxxx5xxtxxx..',
      '..xx5xxx..xxxxxxxx..',
      '..x.x.x...xxx5xxxx..',
      '...........xxxxxxx..',
      '............xxxxxx..',
      '............xxxxxx..',
      '............xxxxx...',
      '............xxxxx...',
      '............xxxx....',
      '.............xx.....'],
    bob: [1,
      '......xxxxxxx.......',
      '....xxxxxxxxxxx.....',
      '...xx11xxxxxxxxx....',
      '..xx1xxxxxxxxxxxx...',
      '..xxxxxxxxxxxxxxxx..',
      '..xxxxxxxxxxxxxxxxx.',
      '..xxxxxxxxx5xxxxxxx.',
      '..xxxxxx..xxxxxxxxx.',
      '..xxx.....xxxxxxxxx.',
      '..xx......xxxxxxxxx.',
      '..........xxx5xxxxx.',
      '..........xxxxxxxx..',
      '...........xxxxxx...',
      '............x.x.....'],
    bun: [-2,
      '.............xxxx...',
      '............xx1xxx..',
      '............xxxxx5..',
      '.............5555...',
      '......xxxxxxx.......',
      '....xxxxxxxxxxx.....',
      '...xx11xxxxxxxxx....',
      '..xx1xxxxxxxxxxxx...',
      '..xxxxxxxxxxxxxxxx..',
      '..xxxxxxxxxxxxxxxx..',
      '..xxxxxxxxx5xxxxxx..',
      '..xx5xxx..xxxxxxxx..',
      '..x.x.....xxx5xxxx..',
      '...........xxxxxx...'],
    afro: [-3,
      '....xxxxxxxxxx......',
      '..xxxxxxxxxxxxxx....',
      '.xxx1xxxxxxxxxxxxx..',
      '.xx1xxxxx5xxxxxxxxx.',
      'xxxxxxxxxxxxxx5xxxx.',
      'xxxx5xxxxxxxxxxxxxxx',
      'xxxxxxxxxx5xxxxxxxxx',
      'xxxxxxxxxxxxxxxx5xxx',
      'xxx5xxxxxxxxxxxxxxxx',
      'xxxxxxxxxxx5xxxxxxxx',
      '.xxxxxxxxxxxxxxxxxxx',
      '..x.x.xx..xxxxxx5xxx',
      '..........xxxxxxxxxx',
      '..........xxxxxxxxx.',
      '...........xxxxxxx..',
      '............xxxx....'],
    curly: [0,
      '......xx.xxxx.......',
      '....xxxxxxxxxxxx....',
      '...xx11xxxx5xxxxx...',
      '..xx1xxx5xxxxxxxxx..',
      '..xxxxxxxxxxxx5xxxx.',
      '.xxx5xxxxxx5xxxxxxx.',
      '.xxxxxxxxxxxxxxxxxx.',
      '.xxxx5xxxx5xxxx5xxx.',
      '.xx.xxx...xxxxxxxxx.',
      '.x..x.....xxx5xxxxx.',
      '..........xxxxxxxx..',
      '...........xxxxxx...',
      '............x..x....'],
    mohawk: [-3,
      '.........xx.........',
      '........xxxxx.......',
      '.......xx1xxxx......',
      '......xx1xxxxxx.....',
      '......xxxxxx5xxx....',
      '....sxxxxxxxxxxxs...',
      '...ssssssssssssss...',
      '...sssssssssssssss..',
      '...sssssssssssssss..',
      '...sss....ssssssss..',
      '...s......ssssssss..',
      '...........ssssss...',
      '............sss.....'],
    buzz: [4,
      '.......ssssss.......',
      '.....sssssssssss....',
      '....sssssssssssss...',
      '....ssssssssssssss..',
      '....sss...ssssssss..',
      '...........sssssss..',
      '...........ssssss...',
      '............ssss....'],
  },
  back: {
    short: [1,
      '......xxxxxxxx......',
      '....xxxxxxxxxxxx....',
      '...xx11xxxxxxxxxx...',
      '..xx1xxxxxxxxxxxxx..',
      '..xxxxxxxxxxxxxxxx..',
      '..xxxxxxxxxxxxxxxx..',
      '..xxxxx5xxxxx5xxxx..',
      '..xxxxxxxxxxxxxxxx..',
      '..xxx5xxxx5xxxx5xx..',
      '..xxxxxxxxxxxxxxxx..',
      '..xxxxxxxxxxxxxxxx..',
      '...xxxxxxxxxxxxxx...',
      '....x.xxxxxxxx.x....',
      '.......x.xx.x.......'],
    spiky: [-1,
      '......x.....x.......',
      '...x..xx...xx...x...',
      '...xxxxxxxxxxxxxx...',
      '..xxxxxxxxxxxxxxxx..',
      '.xxxx11xxxxxxxxxxxx.',
      'xxxx1xxxxxxxxxxxxxxx',
      '.xxxxxxxxxxxxxxxxxx.',
      '..xxxxx5xxxx5xxxxx..',
      '.xxxxxxxxxxxxxxxxxx.',
      'xxxx5xxxx5xxxx5xxxxx',
      '.xxxxxxxxxxxxxxxxxx.',
      '..xxxxxxxxxxxxxxxx..',
      '...xx.xxxxxxxx.xx...',
      '....x..x.xx.x..x....',
      '.......x....x.......'],
    long: [1,
      '......xxxxxxxx......',
      '....xxxxxxxxxxxx....',
      '...xx11xxxxxxxxxx...',
      '..xx1xxxxxxxxxxxxx..',
      '..x1xxxxxxxxxxxxxx..',
      '.xxxxxxxxxxxxxxxxxx.',
      '.xxxxxxxxxxxxxxxxxx.',
      '.xxxxxxxxxxxxxxxxxx.',
      '.xxxxxxxxxxxxxxxxxx.',
      '.xxxxxxxxxxxxxxxxxx.',
      '.xxxxxxxxxxxxxxxxxx.',
      '.xxxxxxxxxxxxxxxxxx.',
      '.xxxxxxx5xxxx5xxxxx.',
      '.xxxxxxx5xxxx5xxxxx.',
      '.xxxx5xx5xxxx5xx5xx.',
      '.xxxx5xx5xxxx5xx5xx.',
      '.xxxx5xxxxxxxxxx5xx.',
      '.xxxx5xxxxxxxxxx5xx.',
      '.xxxxxxxxxxxxxxxxxx.',
      '..xxxxxxxxxxxxxxxx..',
      '..xxxxx5xxxx5xxxxx..',
      '..xx.xx5xxxx5xx.xx..',
      '..x...xxx..xxx...x..'],
    ponytail: [1,
      '......xxxxxxxx......',
      '....xxxxxxxxxxxx....',
      '...xx11xxxxxxxxxx...',
      '..xx1xxxxxxxxxxxxx..',
      '..xxxxxxxtttxxxxxx..',
      '..xxxxxxxtttxxxxxx..',
      '..xxxxx5xxxxx5xxxx..',
      '..xxxxxxxxxxxxxxxx..',
      '..xxx5xxxxxxxx5xxx..',
      '..xxxxxxxxxxxxxxxx..',
      '...xxxxxxxxxxxxxx...',
      '....x.xxxxxxxx.x....',
      '........xxxx........',
      '........xxxx........',
      '........xx5x........',
      '........xxxx........',
      '.........xxx........',
      '.........xx.........',
      '.........x..........'],
    twintails: [1,
      '......xxxxxxxx......',
      '....xxxxxxxxxxxx....',
      '...xx11xxxxxxxxxx...',
      '..xx1xxxxxxxxxxxxx..',
      '..xxxxxxxxxxxxxxxx..',
      '.txxxxxxxxxxxxxxxxt.',
      'xtxxxx5xxxxx5xxxxxtx',
      'xxxxxxxxxxxxxxxxxxxx',
      'xxxxx5xxxxxxxx5xxxxx',
      'xx.xxxxxxxxxxxxxx.xx',
      'xx..xxxxxxxxxxxx..xx',
      'xx...x.xxxxxx.x...xx',
      'xx................xx',
      'xx................xx',
      'xx................xx',
      'xx................xx',
      '.xx..............xx.',
      '.xx..............xx.',
      '.x................x.'],
    bob: [1,
      '......xxxxxxxx......',
      '....xxxxxxxxxxxx....',
      '...xx11xxxxxxxxxx...',
      '..xx1xxxxxxxxxxxxx..',
      '..xxxxxxxxxxxxxxxx..',
      '.xxxxxxxxxxxxxxxxxx.',
      '.xxxxxx5xxxxx5xxxxx.',
      '.xxxxxxxxxxxxxxxxxx.',
      '.xxxx5xxxxxxxx5xxxx.',
      '.xxxxxxxxxxxxxxxxxx.',
      '.xxxxxxxxxxxxxxxxxx.',
      '.xxxxxxxxxxxxxxxxxx.',
      '.xx5xxxx5xxxx5xxxxx.',
      '..xxxxxxxxxxxxxxxx..',
      '...x.x.x.xx.x.x.x...'],
    bun: [-2,
      '.......xxxxx........',
      '......xx1xxxx.......',
      '......xxxxxx5.......',
      '.......55555........',
      '......xxxxxxxx......',
      '....xxxxxxxxxxxx....',
      '...xx11xxxxxxxxxx...',
      '..xx1xxxxxxxxxxxxx..',
      '..xxxxxxxxxxxxxxxx..',
      '..xxxxx5xxxxx5xxxx..',
      '..xxxxxxxxxxxxxxxx..',
      '..xxxxxxxxxxxxxxxx..',
      '..xxxxxxxxxxxxxxxx..',
      '...xxxxxxxxxxxxxx...',
      '....xxxxxxxxxxxx....',
      '.......x.xx.x.......'],
    afro: [-3,
      '.....xxxxxxxxxx.....',
      '...xxxxxxxxxxxxxx...',
      '..xxx1xxxxxxxxxxxx..',
      '.xxx1xxxxx5xxxxxxxx.',
      '.xx1xxxxxxxxxxx5xxx.',
      'xxxxxx5xxxxxxxxxxxxx',
      'xxxxxxxxxxxx5xxxxxxx',
      'xxx5xxxxxxxxxxxxx5xx',
      'xxxxxxxxx5xxxxxxxxxx',
      'xxxxxxxxxxxxxxxxxxxx',
      'xxxxx5xxxxxxx5xxxxxx',
      'xxxxxxxxxxxxxxxxxxxx',
      'xxxxxxxxx5xxxxxxxxxx',
      '.xxxxxxxxxxxxxxxxxx.',
      '..xxxxxxxxxxxxxxxx..',
      '....xxxx.xx.xxxx....'],
    curly: [0,
      '.....xx.xxxx.xx.....',
      '...xxxxxxxxxxxxxx...',
      '..xxx11xxxx5xxxxxx..',
      '.xxx1xxx5xxxxxxx5xx.',
      '.xxxxxxxxxxxxxxxxxx.',
      '.xx5xxxxxx5xxxxxxxx.',
      '.xxxxxxxxxxxxx5xxxx.',
      '.xxxx5xxxxxxxxxxx5x.',
      '.xxxxxxxxxx5xxxxxxx.',
      '.xx5xxxxxxxxxxxxxxx.',
      '.xxxxxxx5xxxxxx5xxx.',
      '..xxxxxxxxxxxxxxxx..',
      '...xx.xxxxxxxx.xx...',
      '.....x..x..x..x.....'],
    mohawk: [-3,
      '.........xx.........',
      '........xxxx........',
      '........x1xx........',
      '........x1xx........',
      '.......sxxxxs.......',
      '.....sssxxxxsss.....',
      '....ssssxxxxssss....',
      '...sssssxx5xsssss...',
      '...sssssxxxxsssss...',
      '...sssssxxxxsssss...',
      '...sssssxx5xsssss...',
      '...sssssxxxxsssss...',
      '...sssssxxxxsssss...',
      '....ssssxxxxssss....',
      '.....ssssxxssss.....',
      '.......ssssss.......'],
    buzz: [4,
      '.......ssssss.......',
      '.....ssssssssss.....',
      '....ssssssssssss....',
      '...ssssssssssssss...',
      '...ssssssssssssss...',
      '...ssssssssssssss...',
      '...ssssssssssssss...',
      '...ssssssssssssss...',
      '...ssssssssssssss...',
      '....ssssssssssss....',
      '.....ssssssssss.....',
      '.......ssssss.......'],
  },
};
OW_HAIR.back.sidepart = OW_HAIR.back.short;
// ---- cabelos novos (linha feminina)
OW_HAIR.front.wavy = [1,
  '......xxxxxxxx......',
  '....xxxxxxxxxxxx....',
  '...xx11xxxxxxxxxx...',
  '..xx1xxxxxxxxxxxxx..',
  '..xxxxxxxxxxxxxxxx..',
  '.xxxxxxxxxxxxxxxxxx.',
  '.xxxxxx5xxxxx5xxxxx.',
  '.xxx5xxxx5xxxx5xxxx.',
  '.xxx.xx.xxx.xx.xxxx.',
  'xxxx.....x......xxxx',
  'bxxx............xxxb',
  'bxx5............5xxb',
  'xxxx............xxxx',
  'bxxx............xxxb',
  'bbx5............5xbb',
  'xxxx............xxxx',
  'xxxb............bxxx',
  'bbbbbbbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbbbbbb',
  'bbb.bbbbbbbbbbbb.bbb',
  'bb..bbb.bbbb.bbb..bb',
  '.b....b......b....b.'];
OW_HAIR.front.bangs = [1,
  '......xxxxxxxx......',
  '....xxxxxxxxxxxx....',
  '...xx11xxxxxxxxxx...',
  '..xx1xxxxxxxxxxxxx..',
  '..xxxxxxxxxxxxxxxx..',
  '.xxxxxxxxxxxxxxxxxx.',
  '.xxxxxxxxxxxxxxxxxx.',
  '.xxx5xx5xx5xx5xx5xx.',
  '.xxxxxxxxxxxxxxxxxx.',
  '.xxx............xxx.',
  'bxxx............xxxb',
  'bxxx............xxxb',
  'bxxx............xxxb',
  'bxxx............xxxb',
  'bxx5............5xxb',
  'bxxx............xxxb',
  'bxxx............xxxb',
  'bbbbbbbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbbbbbb',
  '.bbbbbbbbbbbbbbbbbb.'];
OW_HAIR.front.hime = [1,
  '......xxxxxxxx......',
  '....xxxxxxxxxxxx....',
  '...xx11xxxxxxxxxx...',
  '..xx1xxxxxxxxxxxxx..',
  '..xxxxxxxxxxxxxxxx..',
  '.xxxxxxxxxxxxxxxxxx.',
  '.xxxxxxxxxxxxxxxxxx.',
  '.xxx5xx5xx5xx5xx5xx.',
  '.xxxxxxxxxxxxxxxxxx.',
  'bxxx............xxxb',
  'bxxx............xxxb',
  'bxxx............xxxb',
  'bx5x............x5xb',
  'bxxx............xxxb',
  'bxxx............xxxb',
  'bbbb............bbbb',
  'bbbb............bbbb',
  'bbbbbbbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbbbbbb',
  '.bbbbbbbbbbbbbbbbbb.'];
OW_HAIR.front.highponytail = [-2,
  '...........xxx......',
  '..........xxxxxb....',
  '..........ttxxxbb...',
  '......xxxxttxxxxbb..',
  '....xxxxxxxxxxxx.bb.',
  '...xx11xxxxxxxxxx.bb',
  '..xx1xxxxxxxxxxxxxbb',
  '..xxxxxxxxxxxxxxxxbb',
  '..xxxxxxxxxxxxxxxxbb',
  '..xxxxxx5xxxx5xxxxbb',
  '..xxxx5xxxx5xxx5xx.b',
  '..xx.xxx.xx.xxx.xx.b',
  '..xx.....x.......x.b',
  '..x..............x.b',
  '...................b'];
OW_HAIR.front.sideponytail = [1,
  '......xxxxxxxx......',
  '....xxxxxxxxxxxx....',
  '...xx11xxxxxxxxxx...',
  '..xx1xxxxxxxxxxxxx..',
  '..xxxxxxxxxxxxxxxxx.',
  '..xxxxxxxxxxxxxxxtt.',
  '..xxxx5xxxx5xxxxxttx',
  '..xxx5xxx5xxx5xxxxxx',
  '..xx.xxx.xxx.xxx.xxx',
  '..x.......x......xxx',
  '..x..............xxx',
  '................xxxx',
  '................xxx5',
  '................xxxx',
  '...............xxxx.',
  '...............xxx5.',
  '...............xxxx.',
  '................xxx.',
  '................xx..',
  '.................x..'];
OW_HAIR.front.braid = [1,
  '......xxxxxxxx......',
  '....xxxxxxxxxxxx....',
  '...xx11xxxxxxxxxx...',
  '..xx1xxxxxxxxxxxxx..',
  '..xxxxxxxxxxxxxxxx..',
  '..xxxxxxxxxxxxxxxx..',
  '..xxxxxx5xxxx5xxxx..',
  '..xxxx5xxxx5xxx5xx..',
  '..xx.xxx.xx.xxx.xxx.',
  '..xx.....x......xxx.',
  '..x.............xxx.',
  '................1x5.',
  '................5x1.',
  '................1x5.',
  '................5x1.',
  '................1x5.',
  '................5x1.',
  '................1x5.',
  '................5x1.',
  '................ttt.',
  '................xxx.',
  '.................x..'];
OW_HAIR.front.braids2 = [1,
  '......xxxxxxxx......',
  '....xxxxx5xxxxxx....',
  '...xx11xx5xxxxxxx...',
  '..xx1xxxx5xxxxxxxx..',
  '..xxxxxxx5xxxxxxxx..',
  '..xxxxxx5xx5xxxxxx..',
  '..xxxxx5xxxx5xxxxx..',
  '..xxxx5xxxxxx5xxxx..',
  '.xxx.xxx.xx.xxx.xxx.',
  '.xxx.....x......xxx.',
  '.xxx............xxx.',
  '.1x5............1x5.',
  '.5x1............5x1.',
  '.1x5............1x5.',
  '.5x1............5x1.',
  '.1x5............1x5.',
  '.5x1............5x1.',
  '.1x5............1x5.',
  '.ttt............ttt.',
  '.xxx............xxx.',
  '..x..............x..'];
OW_HAIR.front.doublebun = [-2,
  '...xxxx......xxxx...',
  '..xx1xxx....xx1xxx..',
  '..xxxxx5....xxxxx5..',
  '...55555xxxx55555...',
  '...xxxxxxxxxxxxxx...',
  '...xxxxxxxxxxxxxx...',
  '...xx11xxxxxxxxxx...',
  '..xx1xxxxxxxxxxxxx..',
  '..xxxxxxxxxxxxxxxx..',
  '..xxxxxxxxxxxxxxxx..',
  '..xxxxx5xxxxx5xxxx..',
  '..xxx.xxxx..xxxx.x..',
  '..xx...x......x..x..',
  '..x..............x..',
  '..x..............x..'];
OW_HAIR.front.pixie = [2,
  '......xxxxxxx.......',
  '....xxxxxxxxxxx.....',
  '...xx11xxxxxxxxx....',
  '..xx1xxxxxxxxxxxx...',
  '..xxxxxxxxxxxxxxxx..',
  '..xxxxx5xxxxxxxxxx..',
  '..xx5xxxx5xxxxx5xx..',
  '..x..x5xxxxxxx5xxx..',
  '..x.....xxxxx...x...',
  '..x..............x..'];
OW_HAIR.front.curlylong = [0,
  '.....xx.xxxx.xx.....',
  '...xxxxxxxxxxxxxx...',
  '..xxx11xxxx5xxxxxx..',
  '.xxx1xxx5xxxxxxx5xx.',
  '.xxxxxxxxxxxxxxxxxx.',
  'xxx5xxxxxx5xxxxxx5xx',
  'xxxxxxxxxxxxx5xxxxxx',
  'xxxxx5xxxxxxxxxxx5xx',
  'xx5x.xxx.xxxx.xx.x5x',
  'xxxx..x...xx...x.xxx',
  'x5xx............xx5x',
  'xxxx............xxxx',
  'bxx5............5xxb',
  'xxxx............xxxx',
  'x5xx............xx5x',
  'xxxx............xxxx',
  'xx5xb..........bx5xx',
  'bbbbbbbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbbbbbb',
  'bb.bbbbbbbbbbbbbb.bb',
  '.b..bb.bbbbbb.bb..b.'];
OW_HAIR.front.dbunlow = [1,
  '......xxxxxxxx......',
  '....xxxxxxxxxxxx....',
  '...xx11xxxxxxxxxx...',
  '..xx1xxxxxxxxxxxxx..',
  '..xxxxxxxxxxxxxxxx..',
  '..xxxxxxxxxxxxxxxx..',
  '..xxxxxx5xxxx5xxxx..',
  'bbxxxx5xxxx5xxx5xxbb',
  'bbxx.xxx.xx.xxx.xxbb',
  'bbbx.....x.......xbb',
  'bbbx..............bb',
  '.bb..............bb.'];
OW_HAIR.side.wavy = [1,
  '......xxxxxxx.......',
  '....xxxxxxxxxxx.....',
  '...xx11xxxxxxxxx....',
  '..xx1xxxxxxxxxxxx...',
  '..xxxxxxxxxxxxxxxx..',
  '..xxxxxxxxxxxxxxxxx.',
  '..xxxxxxxxx5xxxxxxx.',
  '..xx5xxx..xxxxxxxxxx',
  '..x.x.x...xxx5xxxxxx',
  '..........xxxxxxxxx.',
  '...........xxxxxxxx.',
  '..........xxxxxxxxxx',
  '...........xxxx5xxxx',
  '............xxxxxxx.',
  '...........xxxxxxxx.',
  '............xxxxxxxx',
  '............xxxx5xxx',
  '.............xxxxxx.',
  '............xxxxxxxx',
  '.............xxxxxxx',
  '.............xx.xx.x'];
OW_HAIR.side.bangs = [1,
  '......xxxxxxx.......',
  '....xxxxxxxxxxx.....',
  '...xx11xxxxxxxxx....',
  '..xx1xxxxxxxxxxxx...',
  '..xxxxxxxxxxxxxxxx..',
  '.xxxxxxxxxxxxxxxxxx.',
  '.xxxxxxxxxx5xxxxxxx.',
  '.xx5xx5xx.xxxxxxxxx.',
  '.xxxxxx...xxx5xxxxx.',
  '..........xxxxxxxxx.',
  '..........xxxxxxxxx.',
  '...........xxxxxxxx.',
  '...........xxxxxxxx.',
  '...........xxxxxxxxx',
  '............xxxxxxxx',
  '............xxxxxxxx',
  '............xxxx5xxx',
  '............xxxxxxxx',
  '............xxxxxxxx',
  '............xxxxxxxx',
  '............x5xx5xx5'];
OW_HAIR.side.hime = [1,
  '......xxxxxxx.......',
  '....xxxxxxxxxxx.....',
  '...xx11xxxxxxxxx....',
  '..xx1xxxxxxxxxxxx...',
  '..xxxxxxxxxxxxxxxx..',
  '.xxxxxxxxxxxxxxxxxx.',
  '.xxxxxxxxxx5xxxxxxx.',
  '.xx5xx5xxxxxxxxxxxx.',
  '.xxxxxx..xxxx5xxxxx.',
  '........xxxxxxxxxxx.',
  '........xxxxxxxxxxx.',
  '........xx5xxxxxxxx.',
  '........xxxxxxxxxxx.',
  '........xxxxxxxxxxxx',
  '........xxx.xxxxxxxx',
  '............xxxxxxxx',
  '............xxxx5xxx',
  '............xxxxxxxx',
  '............xxxxxxxx',
  '............xxxxxxxx',
  '............xxxxxxxx',
  '............xxxxxxxx',
  '............xxxxxxxx',
  '............x5xx5xx5'];
OW_HAIR.side.highponytail = [-2,
  '............xxx.....',
  '...........xxxxx....',
  '...........ttxxxx...',
  '......xxxxxttxxxxx..',
  '....xxxxxxxxxxx.xxx.',
  '...xx11xxxxxxxxx.xx.',
  '..xx1xxxxxxxxxxxx.xx',
  '..xxxxxxxxxxxxxxx.xx',
  '..xxxxxxxxxxxxxxx.xx',
  '..xxxxxxxxx5xxxxx.xx',
  '..xx5xxx..xxxxxxx.xx',
  '..x.x.x...xxx5xxx.xx',
  '...........xxxxxx.xx',
  '............xxxx..xx',
  '..................x5',
  '..................xx',
  '..................x.'];
OW_HAIR.side.sideponytail = [1,
  '......xxxxxxx.......',
  '....xxxxxxxxxxx.....',
  '...xx11xxxxxxxxx....',
  '..xx1xxxxxxxxxxxx...',
  '..xxxxxxxxxxxxxxxx..',
  '..xxxxxxxxxxxxxxxx..',
  '..xxxxxxxxx5xxxxxx..',
  '..xx5xxx..xttxxxxx..',
  '..x.x.x...xttx5xxx..',
  '..........xxxxxxx...',
  '..........xxxxxx....',
  '..........xxxx......',
  '.........xxxx.......',
  '.........xxx5.......',
  '.........xxxx.......',
  '..........xxx.......',
  '..........xx........'];
OW_HAIR.side.braid = [1,
  '......xxxxxxx.......',
  '....xxxxxxxxxxx.....',
  '...xx11xxxxxxxxx....',
  '..xx1xxxxxxxxxxxx...',
  '..xxxxxxxxxxxxxxxx..',
  '..xxxxxxxxxxxxxxxx..',
  '..xxxxxxxxx5xxxxxx..',
  '..xx5xxx..xxxxxxxx..',
  '..x.x.x...xxx5xxxx..',
  '...........xxxxxxx..',
  '...........x1x5xx...',
  '...........1x5......',
  '..........5x1.......',
  '..........1x5.......',
  '..........5x1.......',
  '..........1x5.......',
  '..........5x1.......',
  '..........ttt.......',
  '..........xxx.......',
  '...........x........'];
OW_HAIR.side.braids2 = [1,
  '......xxxxxxx.......',
  '....xxxxxxxxxxx.....',
  '...xx11xxxxxxxxx....',
  '..xx1xxxxxxxxxxxx...',
  '..xxxxxxxxxxxxxxxx..',
  '..xxxxxxxxxxxxxxxx..',
  '..xxxxxxxxx5xxxxxx..',
  '..xx5xxx..xxxxxxxx..',
  '..x.x.x...xxx5xxxxx.',
  '...........xxxxxx1x5',
  '...........x1x5x5x1.',
  '...........1x5..1x5.',
  '..........5x1.......',
  '..........1x5.......',
  '..........5x1.......',
  '..........1x5.......',
  '..........5x1.......',
  '..........ttt.......',
  '..........xxx.......',
  '...........x........'];
OW_HAIR.side.doublebun = [-2,
  '..........xxxx......',
  '.........xx1xxxx....',
  '.........xxxxx1xx...',
  '..........55555555..',
  '......xxxxxxx.......',
  '....xxxxxxxxxxx.....',
  '...xx11xxxxxxxxx....',
  '..xx1xxxxxxxxxxxx...',
  '..xxxxxxxxxxxxxxxx..',
  '..xxxxxxxxxxxxxxxx..',
  '..xxxxxxxxx5xxxxxx..',
  '..xx5xxx..xxxxxxxx..',
  '..x.x.....xxx5xxxx..',
  '...........xxxxxx...'];
OW_HAIR.side.pixie = [2,
  '......xxxxxxx.......',
  '....xxxxxxxxxxx.....',
  '...xx11xxxxxxxxx....',
  '..xx1xxxxxxxxxxxx...',
  '.xxxxxxxxxxxxxxxxx..',
  '.xxx5xxxxxx5xxxxxx..',
  '..xxx5xx..xxxxxxxx..',
  '..x.......xxx5xxx...',
  '...........xxxxx....',
  '............xxx.....'];
OW_HAIR.side.curlylong = [0,
  '......xx.xxxx.......',
  '....xxxxxxxxxxxx....',
  '...xx11xxxx5xxxxx...',
  '..xx1xxx5xxxxxxxxx..',
  '..xxxxxxxxxxxx5xxxx.',
  '.xxx5xxxxxx5xxxxxxx.',
  '.xxxxxxxxxxxxxxxxxxx',
  '.xxxx5xxxx5xxxx5xxxx',
  '.xx.xxx...xxxxxxxxxx',
  '.x..x.....xxx5xxxx5x',
  '.........xxxxxxxxxxx',
  '.........xx5xxxx5xxx',
  '..........xxxxxxxxxx',
  '..........xxx5xxxxx5',
  '...........xxxxxxxxx',
  '..........xxxx5xxxxx',
  '...........xxxxxx5xx',
  '...........xx5xxxxx.',
  '............xxxxxxx.',
  '............x.xx.x..'];
OW_HAIR.side.dbunlow = [1,
  '......xxxxxxx.......',
  '....xxxxxxxxxxx.....',
  '...xx11xxxxxxxxx....',
  '..xx1xxxxxxxxxxxx...',
  '..xxxxxxxxxxxxxxxx..',
  '..xxxxxxxxxxxxxxxxx.',
  '..xxxxxxxxx5xxxxxxxx',
  '..xx5xxx..xxxxx5xxxx',
  '..x.x.x...xxx5xxxxxx',
  '...........xxxxxxxx.',
  '............xxxxx...'];
OW_HAIR.back.wavy = [1,
  '......xxxxxxxx......',
  '....xxxxxxxxxxxx....',
  '...xx11xxxxxxxxxx...',
  '..xx1xxxxxxxxxxxxx..',
  '..x1xxxxxxxxxxxxxx..',
  '.xxxxxxxxxxxxxxxxxx.',
  '.xxxxxxxxxxxxxxxxxx.',
  '.xxxxxxxxxxxxxxxxxx.',
  '.xxxxxxxxxxxxxxxxxx.',
  'xxxxxxxxxxxxxxxxxxxx',
  '.xxxxx5xxxxxx5xxxxx.',
  '.xxx5xxxx5xx5xxxx5x.',
  'xxxxx5xxxx5xxx5xxxxx',
  '.xxxxxx5xxxx5xxxxxx.',
  '.xx5xxxxx5xxxxx5xxx.',
  'xxxx5xxxxx5xxxx5xxxx',
  '.xxxxx5xxxxxx5xxxxx.',
  '.xxx5xxxx5xx5xxxx5x.',
  'xxxxx5xxxx5xxx5xxxxx',
  '.xxxxxxxxxxxxxxxxxx.',
  'xxx.xxxxxxxxxxxx.xxx',
  'xx..xxx.xxxx.xxx..xx',
  '.x....x......x....x.'];
OW_HAIR.back.bangs = [1,
  '......xxxxxxxx......',
  '....xxxxxxxxxxxx....',
  '...xx11xxxxxxxxxx...',
  '..xx1xxxxxxxxxxxxx..',
  '..x1xxxxxxxxxxxxxx..',
  '.xxxxxxxxxxxxxxxxxx.',
  '.xxxxxxxxxxxxxxxxxx.',
  '.xxxxxxxxxxxxxxxxxx.',
  '.xxxxxxxxxxxxxxxxxx.',
  '.xxxxxx5xxxxxxxxxxx.',
  '.xxxxxx5xxxxx5xxxxx.',
  '.xxx5xx5xxxxx5xxxxx.',
  '.xxx5xxxxxxxx5xx5xx.',
  '.xxx5xxxxxxxxxxx5xx.',
  '.xxxxxxxxx5xxxxx5xx.',
  '.xxxxxxxxx5xxxxxxxx.',
  '.xxxxx5xxx5xxxxxxxx.',
  '.xxxxx5xxxxxxxx5xxx.',
  '.xxxxxxxxxxxxxx5xxx.',
  '.xxxxxxxxxxxxxxxxxx.',
  '.xxxxxxxxxxxxxxxxxx.',
  '.x5xx5xx5xxxx5xx5x5.'];
OW_HAIR.back.hime = [1,
  '......xxxxxxxx......',
  '....xxxxxxxxxxxx....',
  '...xx11xxxxxxxxxx...',
  '..xx1xxxxxxxxxxxxx..',
  '..x1xxxxxxxxxxxxxx..',
  '.xxxxxxxxxxxxxxxxxx.',
  '.xxxxxxxxxxxxxxxxxx.',
  '.xxxxxxxxxxxxxxxxxx.',
  '.xxxxxxxxxxxxxxxxxx.',
  '.xxxxxx5xxxxxxxxxxx.',
  '.xxxxxx5xxxxx5xxxxx.',
  '.xxx5xx5xxxxx5xxxxx.',
  '.xxx5xx5xxxxx5xx5xx.',
  '.xxx5xxxxxxxx5xx5xx.',
  '.xxx5xxxxxxxxxxx5xx.',
  '.xxxxxxxxx5xxxxx5xx.',
  '.xxxxxxxxx5xxxxxxxx.',
  '.xxxxx5xxx5xxxxxxxx.',
  '.xxxxx5xxx5xxxx5xxx.',
  '.xxxxx5xxxxxxxx5xxx.',
  '.xxxxxxxxxxxxxx5xxx.',
  '.xxxxxxxxxxxxxxxxxx.',
  '.xxxxxxxxxxxxxxxxxx.',
  '.xxxxxxxxxxxxxxxxxx.',
  '.x5xx5xxx5xx5xxx5x5.'];
OW_HAIR.back.highponytail = [-2,
  '.........xxx........',
  '........xxxxx.......',
  '........xtttx.......',
  '......xxxtttxxx.....',
  '....xxxxxxxxxxxx....',
  '...xx11xxxxxxxxxx...',
  '..xx1xxxx5xxxxxxxx..',
  '..xxxxxxx5xxxxxxxx..',
  '..xxxx5xxxxx5xxxxx..',
  '..xxxxxxxxxxxxxxxx..',
  '..xxx5xxxxxxxx5xxx..',
  '..xxxxxxxxxxxxxxxx..',
  '...xxxxxxxxxxxxxx...',
  '....x.xxxxxxxx.x....',
  '........xxxx........',
  '........xx5x........',
  '........xxxx........',
  '.........xxx........',
  '.........xx.........',
  '.........x..........'];
OW_HAIR.back.sideponytail = [1,
  '......xxxxxxxx......',
  '....xxxxxxxxxxxx....',
  '...xx11xxxxxxxxxx...',
  '..xx1xxxxxxxxxxxxx..',
  '..xxxxx55xxxxxxxxx..',
  '.ttxx55xxxxxxxxxxx..',
  'xttxxxxxxxxxx5xxxx..',
  'xxxxxxx5xxxxxxxxxx..',
  'xxxxxxxxxxxxxx5xxx..',
  'xxxxxxxxxxxxxxxxxx..',
  'xxxxxxxxxxxxxxxxxx..',
  '5xxxxxxxxxxxxxxxx...',
  'xxxx.xxxxxxxx.x.....',
  'xxx....x.xx.x.......',
  'xxx.................',
  '5xx.................',
  '.xx.................'];
OW_HAIR.back.braid = [1,
  '......xxxxxxxx......',
  '....xxxxxxxxxxxx....',
  '...xx11xxxxxxxxxx...',
  '..xx1xxxxxxxxxxxxx..',
  '..xxxxxxxxxxxxxxxx..',
  '..xxxxxxxxxxxxxxxx..',
  '..xxxxx5xxxxx5xxxx..',
  '..xxxxxxxxxxxxxxxx..',
  '..xxx5xxxx5xxxx5xx..',
  '..xxxxxxxxxxxxxxxx..',
  '..xxxxxxxxxxxxxxxx..',
  '...xxxxxxxxxxxxxx...',
  '....x1x5xxxxxx.x....',
  '...5x1x.............',
  '..1x5...............',
  '.5x1................',
  '.1x5................'];
OW_HAIR.back.braids2 = [1,
  '......xxxxxxxx......',
  '....xxxxx5xxxxxx....',
  '...xx11xx5xxxxxxx...',
  '..xx1xxxx5xxxxxxxx..',
  '..xxxxxxx5xxxxxxxx..',
  '..xxxxxxx5xxxxxxxx..',
  '..xxxxxxx5xxxxxxxx..',
  '..xxxxxxx5xxxxxxxx..',
  '..xxx5xxx5xxxx5xxx..',
  '..xxxxxxx5xxxxxxxx..',
  '..xxxxxxx5xxxxxxxx..',
  '...xxxxxx5xxxxxxx...',
  '....x1x5....1x5x....',
  '...5x1x......5x1x...',
  '..1x5..........1x5..',
  '.5x1............5x1.',
  '.1x5............1x5.'];
OW_HAIR.back.doublebun = [-2,
  '...xxxx......xxxx...',
  '..xx1xxx....xx1xxx..',
  '..xxxxx5....xxxxx5..',
  '...55555xxxx55555...',
  '...xxxxxxxxxxxxxx...',
  '...xx11xxxxxxxxxx...',
  '..xx1xxxxxxxxxxxxx..',
  '..xxxxxxxxxxxxxxxx..',
  '..xxxxx5xxxxx5xxxx..',
  '..xxxxxxxxxxxxxxxx..',
  '..xxxxxxxxxxxxxxxx..',
  '..xxxxxxxxxxxxxxxx..',
  '...xxxxxxxxxxxxxx...',
  '....xxxxxxxxxxxx....',
  '.......x.xx.x.......'];
OW_HAIR.back.pixie = [2,
  '......xxxxxxxx......',
  '....xxxxxxxxxxxx....',
  '...xx11xxxxxxxxxx...',
  '..xx1xxxxxxxxxxxxx..',
  '..xxxxxxxxxxxxxxxx..',
  '..xxxx5xxxxx5xxxxx..',
  '..xxxxxxxxxxxxxxxx..',
  '..xxx5xxxxxxx5xxxx..',
  '...xxxxxxxxxxxxxx...',
  '....xxxxxxxxxxxx....',
  '.....x.xxxxxx.x.....'];
OW_HAIR.back.curlylong = [0,
  '.....xx.xxxx.xx.....',
  '...xxxxxxxxxxxxxx...',
  '..xxx11xxxx5xxxxxx..',
  '.xxx1xxx5xxxxxxx5xx.',
  '.xxxxxxxxxxxxxxxxxx.',
  'xxx5xxxxxx5xxxxxx5xx',
  'xxxxxxxxxxxxx5xxxxxx',
  'xxxxx5xxxxxxxxxxx5xx',
  'xx5xxxxxx5xxxx5xxxxx',
  'xxxxxx5xxxxxxxxxx5xx',
  'x5xxxxxxxx5xxx5xxxxx',
  'xxxx5xxxxxxxxxxxxx5x',
  'xxxxxxxx5xxxx5xxxxxx',
  'x5xxx5xxxxxxxxxx5xxx',
  'xxxxxxxxxx5xxxxxxxxx',
  'xx5xxxx5xxxxxx5xxx5x',
  'xxxxxxxxxxxxxxxxxxxx',
  'xxx5xxxxx5xxxxx5xxxx',
  'xxxxxxxxxxxxxxxxxxxx',
  'xx.xxxxxxx5xxxxxx.xx',
  '.x..xx.xxxxxx.xx..x.'];
OW_HAIR.back.dbunlow = [1,
  '......xxxxxxxx......',
  '....xxxxxxxxxxxx....',
  '...xx11xxxxxxxxxx...',
  '..xx1xxxxxxxxxxxxx..',
  '..xxxxxxxxxxxxxxxx..',
  '..xxxxxxxxxxxxxxxx..',
  '..xxxxx5xxxxx5xxxx..',
  '.xxx5xxxxxxxxxx5xxx.',
  'xxxxxxx5xxxx5xxxxxxx',
  'xx5xxxxxxxxxxxxxx5xx',
  '.xxxxxxxxxxxxxxxxxx.',
  '..xxxxxxxxxxxxxxxx..',
  '....x.xxxxxxxx.x....'];
// ---- fim dos cabelos novos


// Chapéus: 'a' cor, 'A' luz, 'd' sombra, 'D' sombra funda, 'c' segunda cor, 'C' segunda cor na sombra,
// 'w' branco, 'y'/'Y' ouro, 'r' vermelho, 'u' azul, 'k' preto, 'p' rosa.
// [linha inicial, linha de corte do cabelo (o cabelo acima some), linhas...]
const OW_HAT = {
  front: {
    cap: [0, 5,
      '.......aaaaaa.......',
      '.....aaaaAAaaaa.....',
      '....aaawwwwwaaaa....',
      '...aaaawwwwwaaaad...',
      '...aaaaaaaaaaaaad...',
      '..dddddddddddddddd..',
      '..DDDDDDDDDDDDDDDD..'],
    cap2: [0, 5,
      '.......aaaaaa.......',
      '.....aaacccAaaa.....',
      '....aaaccccccaaa....',
      '...aaacccakccaaad...',
      '...aaaccccccccaad...',
      '..dddddddddddddddd..',
      '..DDDDDDDDDDDDDDDD..'],
    beanie: [-2, 5,
      '.........ww.........',
      '........wwww........',
      '......aaaaaaaa......',
      '....aaAAaaaaaaaa....',
      '...aaAaaaaaaaaaaa...',
      '...aAaaaaaaaaaaad...',
      '..aaaaaaaaaaaaaaad..',
      '..adadadadadadadad..',
      '..dDdDdDdDdDdDdDdD..'],
    bucket: [0, 5,
      '......aaaaaaaa......',
      '.....aAaaaaaaaa.....',
      '....aAaaaaaaaaad....',
      '....aaaaaaaaaaad....',
      '....dddddddddddd....',
      '..aaaaaaaaaaaaaaaa..',
      '.dddddddddddddddddd.'],
    sunhat: [-1, 5,
      '.......aaaaaa.......',
      '.....aaAaaaaaaa.....',
      '....aaAaaaaaaaad....',
      '....pppppppppppp....',
      '.aaaaaaaaaaaaaaaaaa.',
      'aaaaaaaaaaaaaaaaaaaa',
      '.dddddddddddddddddd.'],
    cowboy: [-2, 5,
      '......a......a......',
      '.....aaaa..aaaa.....',
      '.....aAaaaaaaaa.....',
      '.....aaaaaaaaaad....',
      '.....kkkkkkkkkkk....',
      'a....aaaaaaaaaaa...a',
      'aaaaaaaaaaaaaaaaaaaa',
      '.dddddddddddddddddd.'],
    beret: [0, 4,
      '..........D.........',
      '......aaaaaaaa......',
      '....aaAAaaaaaaaa....',
      '...aaAaaaaaaaaaaad..',
      '...aaaaaaaaaaaaaad..',
      '....dddddddddddddd..'],
    tophat: [-4, 4,
      '.....aaaaaaaaa......',
      '.....aAaaaaaaad.....',
      '.....aAaaaaaaad.....',
      '.....aaaaaaaaad.....',
      '.....rrrrrrrrrr.....',
      '.....aaaaaaaaad.....',
      '...aaaaaaaaaaaaaa...',
      '...ddddddddddddddd..'],
    bandana: [1, 6,
      '......aaaaaaaa......',
      '....aaawaaaaawaa....',
      '...aaaaaaawaaaaaa...',
      '..aawaaaaaaaaaawaa..',
      '..aaaaaawaaaaaaaad..',
      '..dddddddddddddddd..'],
    ears: [-4, 99,
      '..k..............k..',
      '..kk............kk..',
      '..aak..........kaa..',
      '..aAa..........aAa..',
      '..aAaa........aaAa..',
      '..aaad........daaa..',
      '...dddddddddddddd...'],
    flower: [2, 99,
      '................pp..',
      '..............pp.pp.',
      '...............yp...',
      '..............p.pp..',
      '...............p....'],
    crown: [-3, 99,
      '....y...y..y...y....',
      '....yy.yyy.yyy.yy...',
      '....yyyyyyryyyyyy...',
      '....YyuYyyyYyuYyY...',
      '....YYYYYYYYYYYYY...'],
  },
  side: {
    cap: [0, 5,
      '......aaaaaaa.......',
      '....cAAaaaaaaaa.....',
      '...cccaaaaaaaaaa....',
      '...ccaaaaaaaaaaad...',
      '..aaaaaaaaaaaaaad...',
      'DDDDdddddddddddddd..'],
    cap2: [0, 5,
      '......aaaaaaa.......',
      '....cccaaaaaaaa.....',
      '...ccccaaaaaaaaa....',
      '...cccaaaaaaaaaad...',
      '..aaaaaaaaaaaaaad...',
      'DDDDdddddddddddddd..'],
    beanie: [-2, 5,
      '..........ww........',
      '.........wwww.......',
      '.......aaaaaaaa.....',
      '.....aaAAaaaaaaa....',
      '....aaAaaaaaaaaaa...',
      '...aAaaaaaaaaaaaad..',
      '...aaaaaaaaaaaaaad..',
      '...adadadadadadada..',
      '...dDdDdDdDdDdDdDd..'],
    bucket: [0, 5,
      '......aaaaaaa.......',
      '.....aAaaaaaaaa.....',
      '....aAaaaaaaaaad....',
      '....aaaaaaaaaaad....',
      '....dddddddddddd....',
      '.aaaaaaaaaaaaaaaaa..',
      'dddddddddddddddddddd'],
    sunhat: [-1, 5,
      '.......aaaaaa.......',
      '.....aaAaaaaaaa.....',
      '....aaAaaaaaaaad....',
      '....pppppppppppp....',
      '.aaaaaaaaaaaaaaaaaa.',
      'aaaaaaaaaaaaaaaaaaaa',
      '.dddddddddddddddddd.'],
    cowboy: [-2, 5,
      '.........aaa........',
      '.......aaaaaaa......',
      '......aAaaaaaaa.....',
      '......aaaaaaaaad....',
      '......kkkkkkkkkk....',
      '.a...aaaaaaaaaaa..a.',
      'aaaaaaaaaaaaaaaaaaaa',
      '.dddddddddddddddddd.'],
    beret: [0, 4,
      '.............D......',
      '.......aaaaaaaa.....',
      '.....aaAAaaaaaaaa...',
      '....aaAaaaaaaaaaaaa.',
      '....aaaaaaaaaaaaaad.',
      '.....dddddddddddddd.'],
    tophat: [-4, 4,
      '......aaaaaaaaa.....',
      '......aAaaaaaad.....',
      '......aAaaaaaad.....',
      '......aaaaaaaad.....',
      '......rrrrrrrrr.....',
      '......aaaaaaaad.....',
      '...aaaaaaaaaaaaaa...',
      '...ddddddddddddddd..'],
    bandana: [1, 6,
      '......aaaaaaa.......',
      '....aaawaaaaaaa.....',
      '...aaaaaaawaaaaa....',
      '..aawaaaaaaaaaawaa..',
      '..aaaaaawaaaaaaaaddd',
      '..dddddddddddddddddd',
      '..................dd',
      '...................d'],
    ears: [-4, 99,
      '.......k.....k......',
      '.......kk....kk.....',
      '.......aak...aak....',
      '.......aAa...aAa....',
      '.......aAaa..aAaa...',
      '.......aaad..aaad...',
      '.......ddddddddd....'],
    flower: [2, 99,
      '.............pp.....',
      '...........pp.pp....',
      '............yp......',
      '...........p.pp.....',
      '............p.......'],
    crown: [-3, 99,
      '.....y..y..y..y.....',
      '.....yy.yy.yy.yy....',
      '.....yyyyyryyyyy....',
      '.....YyuYyyyYyuY....',
      '.....YYYYYYYYYYY....'],
  },
  back: {
    cap: [0, 5,
      '.......aaaaaa.......',
      '.....aaaaAAaaaa.....',
      '....aaAaaaaaaaaa....',
      '...aaAaaaaaaaaaad...',
      '...aaaaa.....aaad...',
      '...ddddd.....dddd...'],
    beanie: [-2, 5,
      '.........ww.........',
      '........wwww........',
      '......aaaaaaaa......',
      '....aaAAaaaaaaaa....',
      '...aaAaaaaaaaaaaa...',
      '...aAaaaaaaaaaaad...',
      '..aaaaaaaaaaaaaaad..',
      '..adadadadadadadad..',
      '..dDdDdDdDdDdDdDdD..'],
    bandana: [1, 6,
      '......aaaaaaaa......',
      '....aaawaaaaawaa....',
      '...aaaaaaawaaaaaa...',
      '..aawaaaaaaaaaawaa..',
      '..aaaaaawaaaaaaaad..',
      '..ddddddddDDdddddd..',
      '........dddd........',
      '.......dd..dd.......',
      '.......d....d.......'],
    beret: [0, 4,
      '..........D.........',
      '......aaaaaaaa......',
      '....aaAAaaaaaaaa....',
      '..daaAaaaaaaaaaaa...',
      '..daaaaaaaaaaaaaa...',
      '..ddddddddddddddd...'],
  },
};
OW_HAT.back.cap2 = OW_HAT.back.cap;
for (const k of ['bucket', 'sunhat', 'cowboy', 'tophat', 'ears', 'crown']) OW_HAT.back[k] = OW_HAT.front[k];
OW_HAT.back.flower = [2, 99, '..pp..............', '.pp.pp............', '..py..............', '.pp.p.............', '..p...............'];
// enfeites de cabelo e viseira (não escondem o cabelo)
Object.assign(OW_HAT.front, {
  bow: [0, 99, '...........aa...aa..', '...........aAaDaAa..', '...........aadDdaa..', '............a...a...'],
  headband: [2, 99, '......AAAAAAAA......', '....aa........aa....', '...a............a...'],
  hairclips: [5, 99, '...............Aa...', '..............Aa....', '...............Aa...'],
  sunvisor: [4, 99, '...aaaaaaaaaaaaaad..', '..dddddddddddddddd..', '..DDDDDDDDDDDDDDDD..'],
});
Object.assign(OW_HAT.side, {
  bow: [0, 99, '.........a...a......', '.........aADAa......', '.........adDda......', '..........a.a.......'],
  headband: [1, 99, '.........aa.........', '.........Aa.........', '..........a.........', '..........a.........', '..........aa........', '...........a........', '...........a........', '...........a........'],
  hairclips: [5, 99, '.........Aa.........', '........Aa..........', '.........Aa.........'],
  sunvisor: [4, 99, '...aaaaaaaaaaaaad...', 'DDDDdddddddddddd....'],
});
Object.assign(OW_HAT.back, {
  bow: [0, 99, '..aa...aa...........', '..aAaDaAa...........', '..aadDdaa...........', '...a...a............'],
  headband: [2, 99, '......aaaaaaaa......', '....aa........aa....'],
  hairclips: [5, 99, '...aA...............', '....aA..............', '...aA...............'],
  sunvisor: [4, 99, '...aaaaaaDDaaaaaad..'],
});

// ------------------------------------------------------------------ poses do mapa
// Cada pose traz posições inteiras: cabeça (origem da caixa), tronco, braços, pernas e pés.
function owPose(V, f, mode, o) {
  const p = { V, mode, f, shadow: [14, 42, 6.5, 1.6] };
  if (mode === 'bike') return owBikePose(p, V, f);
  if (mode === 'surf') return owSurfPose(p, V, f);
  const run = mode === 'run';
  const step = f === 1 ? 1 : f === 3 ? -1 : 0;     // 1 = perna esquerda da tela à frente
  if (V !== 'side') {
    const b = step ? 1 : 0;                         // balanço do corpo nos passos
    const lean = run ? 1 : 0;
    p.head = [4, 4 + b + lean + (run && step ? 0 : 0)];
    p.ty = 21 + b + lean;                           // topo do tronco
    p.hip = 28 + b + lean;
    // pernas: [coluna esquerda, y do tornozelo] (sola = tornozelo + 4)
    const fwd = run ? 1 : 1, up = run ? 3 : 2;
    const L = { x: 9, an: 37 }, R = { x: 15, an: 37 };
    if (step === 1) { L.an += fwd; R.an -= up; R.lift = true; }
    else if (step === -1) { R.an += fwd; L.an -= up; L.lift = true; }
    else if (f === 2 && !run) { L.an -= 1; L.lift = true; }
    else if (f === 2 && run) { R.an -= 1; R.lift = true; }
    else if (run) { L.an -= 1; L.lift = true; }
    p.legs = [L, R];
    // braços: [coluna, y do ombro, y da mão]; o braço do lado da perna da frente vai para trás
    const hand = p.ty + 6;
    if (!run) {
      const sw = step || (f === 2 ? 0 : 0);
      p.arms = [
        { x: 6, y0: p.ty + 1, hy: hand + (sw === -1 ? 1 : sw === 1 ? -1 : 0), dx: sw === -1 ? 1 : 0 },
        { x: 20, y0: p.ty + 1, hy: hand + (sw === 1 ? 1 : sw === -1 ? -1 : 0), dx: sw === 1 ? -1 : 0 },
      ];
    } else {
      // correndo: o braço oposto à perna da frente vem dobrado até o peito; o outro vai para trás
      const pumped = (x, dx) => ({ x, y0: p.ty + 1, el: [x, p.ty + 4], hand: [x + dx * 2, p.ty + 2], dx, run: true });
      const back = (x, dx) => ({ x, y0: p.ty + 1, el: [x - dx, p.ty + 4], hand: [x - dx, p.ty + 5], dx, run: true });
      const mid = (x, dx) => ({ x, y0: p.ty + 1, el: [x, p.ty + 4], hand: [x + dx, p.ty + 4], dx, run: true });
      p.arms = step === 1 ? [back(6, 1), pumped(20, -1)] : step === -1 ? [pumped(6, 1), back(20, -1)] : [mid(6, 1), mid(20, -1)];
    }
    if (V === 'back') { p.arms.reverse(); }
  } else {
    const b = step ? 1 : 0;
    const lean = run ? 1 : 0;
    p.head = [3 - lean, 4 + b + lean];
    p.ty = 21 + b + lean;
    p.hip = 28 + b + lean;
    p.lean = lean;
    // pernas de perfil: [x do quadril, x do tornozelo, y do tornozelo] ; 0 = longe, 1 = perto
    let near, far;
    if (!run) {
      if (step === 1) { near = { hx: 13, ax: 10, an: 37 }; far = { hx: 14, ax: 17, an: 36, lift: true }; }
      else if (step === -1) { near = { hx: 14, ax: 17, an: 36, lift: true }; far = { hx: 13, ax: 10, an: 37 }; }
      else if (f === 2) { near = { hx: 13, ax: 13, an: 37 }; far = { hx: 14, ax: 15, an: 36, lift: true }; }
      else { near = { hx: 13, ax: 12, an: 37 }; far = { hx: 14, ax: 15, an: 37 }; }
    } else {
      if (step === 1) { near = { hx: 13, ax: 8, an: 36 }; far = { hx: 14, ax: 19, an: 34, lift: true, kick: true }; }
      else if (step === -1) { near = { hx: 14, ax: 19, an: 34, lift: true, kick: true }; far = { hx: 13, ax: 8, an: 36 }; }
      else if (f === 2) { near = { hx: 13, ax: 12, an: 37 }; far = { hx: 14, ax: 16, an: 34, lift: true, kick: true }; }
      else { near = { hx: 14, ax: 16, an: 34, lift: true, kick: true }; far = { hx: 13, ax: 12, an: 37 }; }
    }
    p.legs = [far, near];
    // braço de perto oposto à perna de perto
    const sw = step === 1 ? 1 : step === -1 ? -1 : 0;   // 1 = braço de perto para trás
    if (!run) {
      p.arms = [
        { sx: 14, y0: p.ty + 1, hx: 14 - sw * 2, hy: p.ty + 6, far: true },
        { sx: 13, y0: p.ty + 1, hx: 13 + sw * 2 + (f === 2 ? 0 : 0), hy: p.ty + 6 },
      ];
    } else {
      const a = step === 0 ? (f === 0 ? 1 : -1) : sw;
      p.arms = [
        { sx: 14, y0: p.ty + 1, hx: 14 - a * 3, hy: p.ty + (a === 1 ? 3 : 5), far: true, bent: true },
        { sx: 13, y0: p.ty + 1, hx: 13 + a * 3, hy: p.ty + (a === 1 ? 5 : 3), bent: true },
      ];
    }
  }
  return p;
}

function owBikePose(p, V, f) {
  p.veh = 'bike';
  p.shadow = [14, 42, V === 'side' ? 11 : 6, 1.5];
  const ped = f === 1 ? 1 : f === 3 ? -1 : 0;
  if (V !== 'side') {
    p.head = [4, 2];
    p.ty = 19; p.hip = 26;
    p.legs = [{ x: 9, an: 33 - ped, bike: true }, { x: 15, an: 33 + ped, bike: true }];
    p.arms = [{ x: 6, y0: 20, hy: 25, dx: 1, bar: true }, { x: 20, y0: 20, hy: 25, dx: -1, bar: true }];
    if (V === 'back') p.arms.reverse();
  } else {
    p.head = [1, 3];
    p.ty = 20; p.hip = 27; p.lean = 2;
    const C = [14, 37], a = f * Math.PI / 2;
    const pn = [C[0] - 2.5 * Math.cos(a), C[1] + 2.5 * Math.sin(a)], pf = [C[0] + 2.5 * Math.cos(a), C[1] - 2.5 * Math.sin(a)];
    p.crank = { C, pn, pf };
    p.legs = [{ hx: 16, ax: Math.round(pf[0]), an: Math.round(pf[1]) - 2, bike: true }, { hx: 16, ax: Math.round(pn[0]), an: Math.round(pn[1]) - 2, bike: true }];
    p.arms = [{ sx: 13, y0: 21, hx: 8, hy: 24, far: true, bar: true }, { sx: 12, y0: 21, hx: 7, hy: 24, bar: true }];
  }
  return p;
}

function owSurfPose(p, V, f) {
  p.veh = 'surf';
  p.shadow = null;
  p.noLegs = true;
  const bob = f & 1;
  if (V !== 'side') {
    p.head = [4, 6 + bob];
    p.ty = 23 + bob; p.hip = 30 + bob;
    p.arms = [{ x: 6, y0: 24 + bob, hy: 29 + bob, dx: 0 }, { x: 20, y0: 24 + bob, hy: 29 + bob, dx: 0 }];
    if (V === 'back') p.arms.reverse();
  } else {
    p.head = [3, 6 + bob];
    p.ty = 23 + bob; p.hip = 30 + bob;
    p.arms = [{ sx: 14, y0: 24 + bob, hx: 11, hy: 28 + bob, far: true }, { sx: 13, y0: 24 + bob, hx: 10, hy: 29 + bob }];
  }
  p.legs = [];
  return p;
}

// ------------------------------------------------------------------ figura do mapa
function owPix(look, d, f, mode) {
  const o = outfit(look);
  const V = d === 0 ? 'back' : d === 2 ? 'front' : 'side';
  const pose = owPose(V, f, mode, o);
  const P = new Pix(OW_W, OW_H);
  const c = { P, o, V, pose, f, mode, ow: true };
  if (pose.shadow) P.ell(pose.shadow[0], pose.shadow[1], pose.shadow[2], pose.shadow[3], SHADOW);
  owVehicle(c, 'start');
  if (V === 'front') {
    owBackItem(c, 'behind');
    owHair(c, 'back');
    if (!pose.noLegs) { owLegs(c, [0, 1]); owVehicle(c, 'legs'); }
    owTorso(c);
    owVehicle(c, 'torso');
    owArm(c, 0); owArm(c, 1);
    owBackItem(c, 'hand');
    owHead(c);
  } else if (V === 'back') {
    if (!pose.noLegs) { owLegs(c, [0, 1]); owVehicle(c, 'legs'); }
    owTorso(c);
    owArm(c, 0); owArm(c, 1);
    owBackItem(c, 'over');
    owBackItem(c, 'hand');
    owHead(c);
    owBackItem(c, 'wings');
  } else {
    owArm(c, 0);
    if (!pose.noLegs) owLegs(c, [0], true);
    owVehicle(c, 'far');
    owBackItem(c, 'behind');
    if (!pose.noLegs) owLegs(c, [1]);
    owTorso(c);
    owBackItem(c, 'over');
    owArm(c, 1);
    owBackItem(c, 'hand');
    owHead(c);
  }
  owVehicle(c, 'end');
  finish(P);
  return d === 1 ? P.flipX() : P;
}

// faixa vertical inclinada (perna/braço): de (x0,y0) a (x1,y1), largura w
function strip(L, x0, y0, x1, y1, w, col) {
  const n = Math.max(1, Math.abs(y1 - y0));
  for (let k = 0; k <= n; k++) {
    const y = Math.round(lerp(y0, y1, k / n)), x = Math.round(lerp(x0, x1, k / n));
    for (let i = 0; i < w; i++) L.set(x + i, y, col);
  }
}

// ------------------------------------------------------------------ pernas e sapatos (mapa)
function owLegs(c, idx, far = false) {
  const { P, o, V, pose } = c;
  const b = o.bottom, st = o.legs;
  const col = lift(b.color), c2 = b.color2 ? lift(b.color2) : null;
  const L = P.layer();
  const R = ramp(col);
  const shortsTo = st === 'shortshorts' ? pose.hip + 1 : st === 'denimshorts' ? pose.hip + 2 : 32 + (pose.hip - 28);
  const isShort = SHORTS.has(st);
  for (const i of idx) {
    const g = pose.legs[i];
    if (!g) continue;
    if (V !== 'side') {
      const y0 = pose.hip, y1 = g.an;
      const bent = g.lift;
      for (let y = y0; y <= y1; y++) {
        const w = st === 'cargo' && y < y0 + 4 ? 5 : 4;
        const x = g.x - (st === 'cargo' && y < y0 + 4 && i === 0 ? 1 : 0);
        for (let k = 0; k < w; k++) {
          const skin = st === 'skin' || (isShort && y > shortsTo);
          L.set(x + k, y, skin ? o.skin : col);
        }
      }
      if (bent) { L.set(g.x + (i === 0 ? 3 : 0), y1, null); }
      if (st === 'flare') { L.set(i === 0 ? g.x - 1 : g.x + 4, y1, col); if (!bent) L.set(i === 0 ? g.x - 1 : g.x + 4, y1 - 1, col); }
    } else {
      const hx = g.hx, ax = g.ax;
      const kx = g.kick ? Math.round((hx + ax) / 2) + 2 : Math.round((hx + ax) / 2);
      const ky = Math.round((pose.hip + g.an) / 2) + (g.kick ? 0 : 0);
      const paintLeg = (x, y, w) => { const skin = st === 'skin' || (isShort && y > shortsTo); for (let k = 0; k < w; k++) L.set(x + k, y, skin ? o.skin : col); };
      for (let y = pose.hip; y <= ky; y++) paintLeg(Math.round(lerp(hx - 1, kx - 1, (y - pose.hip) / Math.max(1, ky - pose.hip))), y, st === 'cargo' ? 5 : 4);
      for (let y = ky; y <= g.an; y++) paintLeg(Math.round(lerp(kx - 1, ax - 1, (y - ky) / Math.max(1, g.an - ky))) - (st === 'flare' && y >= g.an - 1 ? 1 : 0), y, st === 'flare' && y >= g.an - 1 ? 5 + (y === g.an ? 1 : 0) : 4);
    }
  }
  // quadril
  if (st !== 'skin' && V !== 'side' && idx.length === 2) for (let y = pose.hip - 1; y < pose.hip + 2; y++) for (let x = 9; x < 19; x++) L.set(x, y, col);
  if (st !== 'skin' && V === 'side' && idx.includes(1)) for (let y = pose.hip - 1; y < pose.hip + 2; y++) for (let x = 11 - (pose.lean || 0); x < 18 - (pose.lean || 0); x++) L.set(x, y, col);
  shade(L, { s: 1, l: 1, dir: [1, 0.3] });
  // listras laterais, costura e bolsos
  if (V !== 'side') {
    for (const i of idx) {
      const g = pose.legs[i];
      const ox = i === 0 ? g.x : g.x + 3;
      if ((st === 'cargo' || st === 'trackpants') && c2) for (let y = pose.hip; y < g.an - 1; y++) L.paint(ox + (i === 0 ? 0 : 0), y, c2);
      if (st === 'jeans') for (let y = pose.hip + 1; y < g.an; y++) L.paint(i === 0 ? g.x + 1 : g.x + 2, y, R.li);
      if (st === 'cargo') { L.paint(i === 0 ? g.x - 1 : g.x + 4, pose.hip + 3, R.s2); L.paint(i === 0 ? g.x - 1 : g.x + 4, pose.hip + 4, R.s2); }
      if ((st === 'cargo' || st === 'trackpants') && !g.lift) for (let k = 0; k < 4; k++) L.paint(g.x + k, g.an, R.s2);
    }
  } else {
    for (const i of idx) {
      const g = pose.legs[i];
      if ((st === 'cargo' || st === 'trackpants') && c2) for (let y = pose.hip + 1; y < g.an - 1; y++) { const x = Math.round(lerp(g.hx, g.ax, (y - pose.hip) / Math.max(1, g.an - pose.hip))); L.paint(x + 1, y, c2); }
    }
  }
  // barra do short jeans desfiada
  if (st === 'denimshorts') for (let x = 4; x < 24; x++) if (L.get(x, shortsTo) === R.b || L.get(x, shortsTo) === R.s1 || L.get(x, shortsTo) === R.li) L.set(x, shortsTo, mix(col, '#ffffff', 0.4));
  put(c, L, null, { dim: far });
  if (o.brief && !pose.noLegs && (idx.length === 2 || idx.includes(1))) { const B = P.layer(); owBrief(B, c, col); shade(B, { s: 1, l: 1, dir: [1, 0.35] }); put(c, B, null); }
  for (const i of idx) owShoe(c, i, far);
}

// calçados novos no mapa: linhas da frente (pé direito; o esquerdo é espelhado) e do perfil (bico à esquerda).
// c cor, C sombra, h brilho, s pele, k sola escura, w sola clara, W sola clara na sombra
const OW_SHOE = {
  heels: { front: ['.css.', '.ccc.', '.ccc.', '..k..'], side: ['.ssscc', 'cccc.k', 'k....k'] },
  flats: { front: ['sssss', 'chccc', '.cccc', 'kkkkk'], side: ['.ssss.', 'chcccc', 'kkkkkk'] },
  platform: { front: ['ccccc', 'wwwww', '.wwww', 'WWWWW'], side: ['.chccc', 'wwwwww', 'WWWWWW'] },
  kneeboots: { front: ['ccccc', 'chccc', '.cccc', 'kkkkk'], side: ['.chccc', 'cccccc', 'kk..kk'] },
  flipflops: { front: ['sssss', 'sscss', '.ssss', 'ccccc'], side: ['.ssss.', 'sscsss', 'cccccc'] },
};
function owShoe2(c, i, far) {
  const { P, o, V, pose } = c;
  const g = pose.legs[i];
  const st = o.shoes.style, col = lift(o.shoes.color), R = ramp(col), Rs = ramp(o.skin);
  const wsole = lum(col) > 0.8 ? '#f4f0e6' : WHITE;
  const pal = { c: col, C: R.s1, h: R.hi, s: o.skin, S: Rs.s1, k: '#26222a', w: wsole, W: '#c8ccd6' };
  const def = OW_SHOE[st];
  const L = P.layer();
  const top = g.an + 1;
  const row = (str, x, y, flip) => { for (let k = 0; k < str.length; k++) { const ch = str[flip ? str.length - 1 - k : k]; if (ch !== '.') L.set(x + k, y, pal[ch]); } };
  // cano da bota (escondido pela calça comprida)
  const longPants = o.legs !== 'skin' && !SHORTS.has(o.legs);
  if (V !== 'side') {
    const x0 = g.x - (i === 0 ? 1 : 0), flip = i === 0;
    if (st === 'kneeboots' && !longPants) L.rect(g.x, top - 5, 4, 5, col);
    const rows = def.front;
    const use = V === 'front' && !g.lift ? rows : [rows[0], rows[1], rows[3]];
    use.forEach((r, k) => row(r, x0, top + k, flip));
  } else {
    const ax = g.ax, x0 = ax - 3;
    if (g.kick) {
      const foot = st === 'flipflops' || st === 'heels' || st === 'flats' ? o.skin : col;
      L.rect(ax - 1, top - 1, 4, 2, foot); L.rect(ax + 3, top - 2, 1, 3, st === 'flipflops' ? col : st === 'platform' ? wsole : '#26222a');
      if (st === 'heels' || st === 'flats') L.rect(ax - 1, top, 4, 1, col);
    } else {
      if (st === 'kneeboots' && !longPants) L.rect(ax - 1, top - 5, 4, 5, col);
      def.side.forEach((r, k) => row(r, x0, top + k, false));
      if (g.lift) L.del(x0, top + 2);
    }
  }
  shade(L, { s: 1, l: 0, skip: new Set([pal.k, pal.w, pal.W, pal.h, o.skin]) });
  put(c, L, null, { dim: far, soft: skinSet(o.skin) });
}

function owShoe(c, i, far) {
  const { P, o, V, pose } = c;
  const g = pose.legs[i];
  if (!g) return;
  if (OW_SHOE[o.shoes.style]) return owShoe2(c, i, far);
  const s = o.shoes, st = s.style;
  const col = lift(s.color), c2 = s.color2 ? lift(s.color2) : WHITE;
  const R = ramp(col);
  const sole = st === 'sneakers' ? WHITE : st === 'runners' ? (lum(col) > 0.8 ? '#c8ccd6' : c2) : st === 'boots' ? '#3a2a22' : st === 'sandals' ? R.s1 : '#26222a';
  const L = P.layer();
  const top = g.an + 1;
  if (V !== 'side') {
    const x0 = g.x - (i === 0 ? 1 : 0), w = 5;
    if (st === 'boots') L.rect(g.x, top - 3, 4, 3, col);
    if (st === 'sandals') { L.rect(x0, top, w, 2, o.skin); L.rect(x0, top + 1, w, 1, col); }
    else L.rect(x0, top, w, 2, col);
    if (V === 'front' && !g.lift) L.rect(x0 + (i === 0 ? 0 : 1), top + 2, 4, 1, st === 'sandals' ? o.skin : col);
    L.rect(x0, top + 2 + (V === 'front' && !g.lift ? 1 : 0) - (g.lift ? 0 : 0), w, 1, sole);
    shade(L, { s: 1, l: 1, skip: new Set([sole, WHITE, c2]) });
    if (V === 'front') {
      if (st === 'sneakers') { L.paint(x0 + (i === 0 ? 0 : 4), top + 2, WHITE); L.paint(x0 + 2, top, WHITE); }
      if (st === 'runners') { L.paint(x0 + (i === 0 ? 1 : 3), top + 1, c2); L.paint(x0 + 2, top, c2); }
      if (st === 'formal') L.paint(x0 + (i === 0 ? 1 : 3), top, R.hi);
    } else if (st === 'sneakers' || st === 'runners') L.paint(x0 + 2, top, c2);
  } else {
    // perfil: bico para a esquerda
    const ax = g.ax, kick = g.kick;
    const x0 = ax - 3, w = 6;
    if (kick) {
      // pé de trás levantado: sola virada para trás
      L.rect(ax - 1, top - 1, 4, 2, col); L.rect(ax + 3, top - 2, 1, 3, sole);
    } else {
      if (st === 'boots') L.rect(ax - 1, top - 3, 4, 3, col);
      if (st === 'sandals') { L.rect(x0, top + 1, w, 1, o.skin); L.rect(x0 + 1, top, 4, 1, o.skin); L.set(x0 + 2, top + 1, col); L.set(x0 + 4, top, col); }
      else { L.rect(x0 + 1, top, w - 1, 1, col); L.rect(x0, top + 1, w, 1, col); }
      L.rect(x0, top + 2, w, 1, sole);
      if (g.lift) { L.del(x0, top + 2); }
    }
    shade(L, { s: 1, l: 1, skip: new Set([sole, WHITE, c2]) });
    if (!kick && (st === 'runners' || st === 'sneakers')) { L.paint(x0 + 3, top + 1, c2 === col ? WHITE : c2); L.paint(x0, top + 1, st === 'sneakers' ? WHITE : c2); }
    if (!kick && st === 'formal') L.paint(x0 + 1, top, R.hi);
  }
  put(c, L, null, { dim: far });
}

// ------------------------------------------------------------------ tronco (mapa)
const OW_TORSO = { m: [4, 5, 5, 5, 5, 4, 4, 4], f: [3, 4, 5, 4, 4, 4, 5, 5] };
function owTorso(c) {
  const { P, o, V, pose } = c;
  const top = o.top, st = top.style, col = lift(top.color), R = ramp(col);
  if (NEW_TOPS.has(st)) return owTorso2(c);
  const L = P.layer();
  const ty = pose.ty;
  const fem = o.female ? 'f' : 'm';
  const pt = owTopPaint(c);
  const longTo = st === 'coat' ? 33 : st === 'labcoat' ? 34 : st === 'kimono' ? 32 : st === 'dress' ? 33 : 0;
  if (V !== 'side') {
    const rows = OW_TORSO[fem];
    for (let j = 0; j < rows.length; j++) for (let x = 14 - rows[j]; x < 14 + rows[j]; x++) L.set(x, ty + j, pt);
    if (longTo) {
      const y1 = longTo + (pose.hip - 28);
      for (let y = ty + rows.length; y <= y1; y++) {
        const hw = 5 + Math.floor((y - ty - rows.length) / (st === 'dress' ? 2 : 3));
        for (let x = 14 - hw; x < 14 + hw; x++) L.set(x, y, pt);
      }
    }
  } else {
    const ln = pose.lean || 0;
    for (let j = 0; j < 8; j++) {
      const sh = ln && j < 3 ? -1 : 0;
      const x0 = 11 + sh - (o.female && j >= 1 && j <= 3 ? 1 : 0), x1 = 17 + sh;
      for (let x = x0; x <= x1; x++) L.set(x, ty + j, pt);
    }
    if (longTo) {
      const y1 = longTo + (pose.hip - 28);
      for (let y = ty + 8; y <= y1; y++) { const e = Math.floor((y - ty - 8) / 3); for (let x = 11 - e; x <= 18 + e; x++) L.set(x, y, pt); }
    }
  }
  shade(L, { s: V === 'side' ? 1 : 2, d: 0, l: 1, dir: [1, 0.35], skip: new Set([WHITE]) });
  owTopDetails(L, c);
  put(c, L, null);
  owSkirt(c);
}

// saias (a partir do quadril): comprimento e abertura
const OW_SKIRT = { skirt: [4, 2], longskirt: [9, 2], miniskirt: [2, 2], pleated: [5, 2] };
function owSkirt(c) {
  const { P, o, V, pose } = c;
  const b = o.skirt;
  if (!b || pose.noLegs) return;
  const S = P.layer(), sc = lift(o.bottom.color), R = ramp(sc);
  const [len, k] = OW_SKIRT[b];
  const y0 = pose.hip - 1, y1 = y0 + len;
  for (let y = y0; y <= y1; y++) {
    const e = Math.floor((y - y0) / k) + (b === 'pleated' && y > y0 + 1 ? 1 : 0);
    if (V !== 'side') for (let x = 9 - e; x < 19 + e; x++) S.set(x, y, sc);
    else for (let x = 10 - e - (pose.lean || 0); x < 18 + e - (pose.lean || 0); x++) S.set(x, y, sc);
  }
  shade(S, { s: 1, l: 1 });
  if (b === 'pleated') { for (let y = y0 + 1; y <= y1; y++) for (let x = 4; x < 24; x++) if (mod(x, 2) === 0) S.paint(x, y, y === y1 ? R.s2 : s1(S.get(x, y) || sc)); }
  else for (let x = 6; x < 22; x += 2) S.paint(x, y1, s1(sc));
  if (b === 'miniskirt' || b === 'pleated') for (let x = 4; x < 24; x++) S.paint(x, y0, R.s2);
  put(c, S, null);
}

// ------------------------------------------------------------------ partes de cima novas (mapa)
// vestidos: [barra (com o quadril em 28), linhas por alargamento]
const OW_HEM = { sundress: [33, 2], partydress: [32, 1], longdress: [37, 3] };
function owTorso2(c) {
  const { P, o, V, pose } = c;
  const top = o.top, st = top.style, col = lift(top.color), R = ramp(col);
  const ty = pose.ty, hip = pose.hip, ln = pose.lean || 0;
  const fem = o.female ? 'f' : 'm', side = V === 'side';
  const rowX = (j) => {
    if (!side) { const hw = OW_TORSO[fem][j]; return [14 - hw, 14 + hw - 1]; }
    const sh = ln && j < 3 ? -1 : 0;
    return [11 + sh - (o.female && j >= 1 && j <= 3 ? 1 : 0), 17 + sh];
  };
  // com calça, a pele da barriga para no cós
  const skinTo = o.legs !== 'skin' && !pose.noLegs ? hip - 2 : hip;
  if (BARE_TOPS.has(st)) {
    const B = P.layer();
    for (let j = 0; j < 8; j++) { const y = ty + j; if (y > skinTo) break; const [a, b] = rowX(j); for (let x = a; x <= b; x++) B.set(x, y, o.skin); }
    shade(B, { s: 1, l: 1, dir: [1, 0.35] });
    put(c, B, null);
  }
  const L = P.layer();
  const thin = side ? [12 - ln] : [12, 15];
  const wide = side ? [12 - ln, 13 - ln] : [11, 12, 15, 16];
  const cov = (j, x) => {
    switch (st) {
      case 'croptop': return j <= 3;
      case 'offshoulder': return j >= 1;
      case 'bikini': return j === 2 || j === 3 || (j <= 1 && (side ? x === 12 - ln : V === 'back' ? (x === 13 || x === 14) && j === 0 : x === (j ? 12 : 13) || x === (j ? 15 : 14)));
      case 'swimsuit': return j === 0 ? thin.includes(x) : !(V === 'front' && j === 1 && (x === 13 || x === 14));
      case 'sundress': case 'partydress': return j >= 1 || thin.includes(x);
      case 'longdress': return j >= 1 || wide.includes(x);
      default: return true;
    }
  };
  const tuck = o.tucked && o.legs !== 'skin' ? hip - 2 : 99;
  for (let j = 0; j < 8; j++) { const y = ty + j; if (y > tuck) break; const [a, b] = rowX(j); for (let x = a; x <= b; x++) if (cov(j, x)) L.set(x, y, col); }
  // saia do vestido
  const hm = OW_HEM[st];
  if (hm) {
    const y1 = Math.min(hm[0] + (hip - 28), pose.noLegs ? hip + 3 : 99);
    for (let y = ty + 8; y <= y1; y++) {
      const e = Math.floor((y - ty - 8) / hm[1]) + (st === 'partydress' ? 1 : 0);
      if (side) for (let x = 11 - e - ln; x <= 18 + e - ln; x++) L.set(x, y, col);
      else for (let x = 9 - e; x < 19 + e; x++) L.set(x, y, col);
    }
  }
  if (o.swimBrief && !pose.noLegs) owBrief(L, c, col);
  shade(L, { s: side ? 1 : 2, d: 0, l: 1, dir: [1, 0.35] });
  // detalhes
  const Pt = (x, y, cl) => L.paint(x, y, cl);
  const [a1, b1] = rowX(1);
  switch (st) {
    case 'croptop': for (let x = 6; x < 22; x++) Pt(x, ty + 3, R.s1); if (V === 'front') { Pt(13, ty, R.s1); Pt(14, ty, R.s1); } break;
    case 'offshoulder': for (let x = a1; x <= b1; x++) Pt(x, ty + 1, mod(x, 2) ? R.hi : R.li); break;
    case 'bikini': if (V === 'back') { Pt(13, ty + 2, R.hi); Pt(14, ty + 2, R.li); } break;
    case 'blouse': for (let x = 6; x < 22; x++) Pt(x, ty + 7, mod(x, 2) ? R.li : R.s1); if (V === 'front') { Pt(13, ty + 1, R.hi); Pt(14, ty + 2, R.li); Pt(13, ty + 3, R.hi); } break;
    case 'body': if (V === 'front') { Pt(11, ty + 2, R.li); Pt(11, ty + 3, R.hi); Pt(11, ty + 4, R.li); } break;
    case 'partydress': for (let x = 6; x < 22; x++) Pt(x, ty + 5, R.s2); Pt(11, ty + 2, R.hi); Pt(10, ty + 9, R.hi); Pt(11, ty + 10, R.li); Pt(17, ty + 9, R.li); break;
    case 'longdress': for (let x = 6; x < 22; x++) Pt(x, ty + 4, R.li); break;
    case 'sundress': {
      const fl = mix(col, '#ffffff', 0.6);
      L.map((v, x, y) => (y > ty && mod(x + (y >> 1) * 2, 4) === 0 && mod(y, 2) === 0 && v !== R.s1 ? fl : v));
      break;
    }
    default: break;
  }
  put(c, L, null);
  owSkirt(c);
}

// calcinha do biquíni / parte de baixo do maiô (3 linhas no quadril)
function owBrief(L, c, col) {
  const { V, pose } = c;
  const h = pose.hip, ln = pose.lean || 0;
  const rows = V === 'side' ? [[11, 17], [11, 16], [13, 16]].map(([a, b]) => [a - ln, b - ln]) : V === 'back' ? [[10, 17], [10, 17], [11, 16]] : [[10, 17], [11, 16], [12, 15]];
  rows.forEach(([a, b], k) => { for (let x = a; x <= b; x++) L.set(x, h - 1 + k, col); });
}

function owTopPaint(c) {
  const { o, V } = c;
  const top = o.top, st = top.style, col = lift(top.color);
  const ty = c.pose.ty;
  if (st === 'jersey') {
    const cs = (top.colors || [top.color]).map(lift), n = cs.length;
    switch (top.pattern) {
      case 'vstripes': return (x) => cs[mod(Math.floor((x - 14) / 2) + (n === 2 ? 1 : 0), n)];
      case 'vstripes3': return (x) => cs[mod(Math.floor((x - 14) / 2), n)];
      case 'hstripes': case 'hstripes3': return (x, y) => cs[mod(Math.floor((y - ty) / 2), n)];
      case 'sash': { const k = V === 'back' ? -1 : 1; return (x, y) => (Math.abs(k * (x + 0.5 - 14) - (y + 0.5 - ty) + 2) < 1.3 ? cs[1] : cs[0]); }
      case 'chestbands': return (x, y) => { const r = y - ty - 2; return r === 0 || r === 1 ? cs[1] : r === 2 ? (cs[2] || cs[1]) : cs[0]; };
      default: return () => cs[0];
    }
  }
  if (st === 'striped') return (x, y) => (mod(y - ty, 3) === 2 ? WHITE : col);
  if (st === 'labcoat') return () => WHITE;
  return () => col;
}

function owTopDetails(L, c) {
  const { o, V, pose } = c;
  const top = o.top, st = top.style, col = lift(top.color), R = ramp(col);
  const ty = pose.ty;
  const P = (x, y, cl) => L.paint(x, y, cl);
  if (V === 'front') {
    switch (st) {
      case 'jersey': {
        const tr = lift(top.trim || WHITE);
        P(13, ty, o.skin); P(14, ty, o.skin); P(12, ty, tr); P(15, ty, tr); P(13, ty + 1, tr); P(14, ty + 1, tr);
        const cr = top.crest || [WHITE, col];
        P(16, ty + 2, lift(cr[0])); P(16, ty + 3, lift(cr[1]));
        break;
      }
      case 'tee': case 'striped': P(13, ty, R.s1); P(14, ty, R.s1); break;
      case 'sweater': P(13, ty, R.s1); P(14, ty, R.s1); for (let x = 9; x < 19; x++) P(x, ty + 7, R.s1); break;
      case 'tank': P(13, ty, o.skin); P(14, ty, o.skin); P(13, ty + 1, R.s1); P(14, ty + 1, R.s1); P(10, ty, o.skin); P(17, ty, o.skin); break;
      case 'hoodie': for (let x = 10; x < 18; x++) P(x, ty, R.s1); P(12, ty + 1, WHITE); P(15, ty + 1, WHITE); P(12, ty + 2, WHITE); P(15, ty + 2, WHITE); for (let x = 11; x < 17; x++) P(x, ty + 5, R.s2); break;
      case 'jacket': for (let y = ty; y < ty + 8; y++) { P(13, y, WHITE); P(14, y, '#d8d8de'); } P(15, ty + 2, '#c8c8cc'); break;
      case 'suit': P(13, ty, WHITE); P(14, ty, WHITE); P(13, ty + 1, '#d8433c'); P(14, ty + 1, '#b8342e'); P(13, ty + 2, '#d8433c'); P(12, ty, R.s2); P(15, ty, R.s2); P(13, ty + 4, R.hi); break;
      case 'labcoat': for (let y = ty; y < ty + 14; y++) { P(13, y, y < ty + 8 ? '#9cc0e4' : lift(o.bottom.color)); P(14, y, y < ty + 8 ? '#7aa0c8' : s1(lift(o.bottom.color))); } break;
      case 'vest': for (let y = ty; y < ty + 8; y++) { P(12, y, WHITE); P(13, y, WHITE); P(14, y, '#d8d8de'); P(15, y, '#d8d8de'); } break;
      case 'coat': for (let x = 9; x < 19; x++) P(x, ty, WHITE); for (let y = ty + 2; y < ty + 12; y += 2) P(13, y, R.hi); for (let x = 9; x < 19; x++) P(x, ty + 5, R.s2); break;
      case 'kimono': P(12, ty, WHITE); P(15, ty, WHITE); P(13, ty + 1, WHITE); P(14, ty + 1, WHITE); P(13, ty, o.skin); P(14, ty, o.skin); for (let x = 8; x < 20; x++) { P(x, ty + 5, '#3a3050'); P(x, ty + 6, '#2a2236'); } break;
      case 'dress': P(13, ty, o.skin); P(14, ty, o.skin); for (let x = 8; x < 20; x++) P(x, ty + 5, R.li); break;
      default: break;
    }
  } else if (V === 'back') {
    if (st === 'hoodie') { for (let x = 11; x < 17; x++) { P(x, ty, R.s1); P(x, ty + 1, R.s1); } for (let x = 12; x < 16; x++) P(x, ty + 2, R.s2); }
    if (st === 'kimono') for (let x = 8; x < 20; x++) { P(x, ty + 5, '#3a3050'); P(x, ty + 6, '#2a2236'); }
    if (st === 'coat') for (let x = 9; x < 19; x++) P(x, ty, WHITE);
    if (st === 'jersey') { const tr = lift(top.trim || WHITE); for (let x = 12; x < 16; x++) P(x, ty, tr); const cs = (top.colors || [top.color]).map(lift); const nc = top.pattern === 'solid' || !top.pattern ? tr : lum(cs[0]) > 0.5 ? '#1c1c1c' : WHITE; P(12, ty + 3, nc); P(12, ty + 4, nc); P(14, ty + 3, nc); P(15, ty + 3, nc); P(14, ty + 4, nc); P(15, ty + 4, nc); }
    if (st === 'dress') { P(13, ty + 5, R.li); P(14, ty + 5, R.li); }
  } else {
    if (st === 'jersey') P(11 - (pose.lean || 0), ty, lift(top.trim || WHITE));
    if (st === 'jacket' || st === 'suit' || st === 'labcoat' || st === 'vest') for (let y = ty; y < ty + 4; y++) P(11 - (pose.lean && y < ty + 3 ? 1 : 0), y, st === 'labcoat' ? '#9cc0e4' : WHITE);
    if (st === 'coat') for (let x = 10; x < 18; x++) P(x, ty, WHITE);
    if (st === 'kimono') for (let x = 9; x < 19; x++) { P(x, ty + 5, '#3a3050'); P(x, ty + 6, '#2a2236'); }
    if (st === 'hoodie') { P(16, ty, R.s2); P(17, ty, R.s2); P(17, ty + 1, R.s2); }
  }
}

// ------------------------------------------------------------------ braços (mapa)
function owArm(c, i) {
  const { P, o, V, pose } = c;
  const a = pose.arms[i];
  if (!a) return;
  const top = o.top, kind = SLEEVE[top.style] || 'short';
  const sp = owSleevePaint(c);
  const L = P.layer();
  const far = !!a.far;
  const sk = o.skin;
  let hand;
  if (V !== 'side') {
    if (a.run) {
      // braço dobrado (corrida): ombro → cotovelo → mão
      const sl = kind === 'long' || kind === 'wide' || kind === 'tight' ? 99 : kind === 'none' ? 0 : 2;
      const U = P.layer();
      strip(U, a.x, a.y0, a.el[0], a.el[1], 2, sp);
      for (let y = a.y0 + sl; y <= a.el[1]; y++) for (let k = -1; k < 3; k++) if (U.get(a.el[0] + k, y)) U.set(a.el[0] + k, y, sk);
      strip(L, a.el[0], a.el[1], a.hand[0], a.hand[1], 2, sl > 3 ? sp : sk);
      U.map((v, x, y) => { if (!L.get(x, y)) L.set(x, y, v); return v; });
      hand = [a.hand[0], a.hand[1]];
    } else {
    // braço vertical de 2 px; dobrado: antebraço vai para o centro
    const x = a.x, y0 = a.y0;
    const ylen = a.bent ? 3 : a.hy - y0;
    const sl = kind === 'long' || kind === 'wide' || kind === 'tight' ? 99 : kind === 'none' ? 0 : 2;
    for (let y = y0; y < y0 + ylen; y++) for (let k = 0; k < 2; k++) L.set(x + k, y, y - y0 < sl ? sp : sk);
    if (kind === 'wide') { L.set(a.x + (a.x < 14 ? -1 : 2), y0 + 2, sp); L.set(a.x + (a.x < 14 ? -1 : 2), y0 + 3, sp); }
    if (a.bent) {
      const hx = x + a.dx * 2;
      for (let y = y0 + ylen; y <= a.hy; y++) for (let k = 0; k < 2; k++) L.set(hx + k, y, sl > 3 ? sp : sk);
      hand = [hx, a.hy + 1];
    } else hand = [x + (a.dx || 0), a.hy];
    }
  } else {
    const steps = Math.max(1, a.hy - a.y0);
    const sl = kind === 'long' || kind === 'wide' || kind === 'tight' ? 99 : kind === 'none' ? 0 : 2;
    if (a.bent) {
      const ex = Math.round((a.sx + (a.hx > a.sx ? a.sx + 1 : a.sx - 1)) / 2), ey = a.y0 + 3;
      strip(L, a.sx, a.y0, ex, ey, 2, sp);
      for (let y = a.y0 + sl; y <= ey; y++) for (let k = 0; k < 2; k++) if (L.get(ex + k, y)) L.set(ex + k, y, sk);
      const fl = P.layer();
      strip(fl, ex, ey, a.hx, a.hy, 2, sl > 3 ? sp : sk);
      for (let y = Math.min(ey, a.hy); y <= Math.max(ey, a.hy); y++) for (let x = Math.min(ex, a.hx); x <= Math.max(ex, a.hx) + 1; x++) if (fl.get(x, y)) L.set(x, y, fl.get(x, y));
      hand = [a.hx, a.hy];
    } else {
      for (let k = 0; k <= steps; k++) {
        const y = a.y0 + k, x = Math.round(lerp(a.sx, a.hx, k / steps));
        for (let j = 0; j < 2; j++) L.set(x + j, y, k < sl ? sp : sk);
      }
      hand = [a.hx, a.hy];
    }
  }
  // ombro de fora: a primeira linha do braço é pele
  if (kind === 'off') { for (let x = 0; x < OW_W; x++) if (L.get(x, a.y0) != null) L.set(x, a.y0, sk); }
  // munhequeira / pulseiras
  if (o.wb && kind !== 'long' && kind !== 'tight') { L.paint(hand[0], hand[1] - 1, o.wb); L.paint(hand[0] + 1, hand[1] - 1, o.wb); }
  if (o.bangle) { L.paint(hand[0], hand[1] - 1, o.bangle); L.paint(hand[0] + 1, hand[1] - 1, hi(o.bangle)); }
  // mão
  L.rect(hand[0], hand[1], 2, 2, sk);
  if (a.bar) L.rect(hand[0], hand[1], 2, 2, sk);
  shade(L, { s: 1, l: 0, dir: [1, 0.2], skip: o.wb || o.bangle ? new Set([o.wb, o.bangle, o.bangle && hi(o.bangle)]) : null });
  if ((kind === 'long' || kind === 'tight') && top.style !== 'labcoat' && !o.bangle) L.paint(hand[0], hand[1] - 1, s1(lift(top.color)));
  put(c, L, null, { dim: far });
}

function owSleevePaint(c) {
  const { o } = c;
  const top = o.top;
  if (top.style === 'jersey') {
    const cs = (top.colors || [top.color]).map(lift);
    if (top.pattern === 'hstripes' || top.pattern === 'hstripes3') return owTopPaint(c);
    return () => cs[0];
  }
  if (top.style === 'vest' || top.style === 'labcoat') return () => WHITE;
  return owTopPaint(c);
}

// ------------------------------------------------------------------ cabeça (mapa)
function owHead(c, part = 'all') {
  const { P, o, V, pose } = c;
  const [hx, hy] = pose.head;
  const hat = o.hat;
  if (part !== 'hat') {
    const L = P.layer();
    const sk = V === 'side' ? OW_SKULL.side : OW_SKULL.front;
    for (let j = 0; j < sk.length; j++) for (let i = 0; i < 20; i++) if (sk[j][i] === '#') L.set(hx + i, hy + 4 + j, o.skin);
    if (V !== 'side') { L.set(hx + 2, hy + 11, o.skin); L.set(hx + 2, hy + 12, o.skin); L.set(hx + 17, hy + 11, o.skin); L.set(hx + 17, hy + 12, o.skin); }
    shade(L, { s: 1, l: 1, dir: [1, 0.4] });
    if (V === 'side') { L.set(hx + 11, hy + 11, o.skin); L.set(hx + 11, hy + 12, s1(o.skin)); L.set(hx + 12, hy + 11, s1(o.skin)); }
    if (V !== 'back') owFace(L, c, hx, hy);
    stamp(P, L, { soft: skinSet(o.skin) });
    if (o.acc && (o.acc.style === 'glasses' || o.acc.style === 'sunglasses' || o.acc.style === 'cateye')) owGlasses(c, hx, hy);
    owHair(c, 'front');
  }
  if (hat && part !== 'under') owHat(c);
  if (part !== 'hat' && o.acc && o.acc.style === 'scarf') owScarf(c);
  if (part !== 'hat' && o.acc) owAcc2(c);
  if (part !== 'hat' && o.acc && o.acc.style === 'necklace' && V !== 'back') {
    const col = lift(o.acc.color);
    const N = P.layer();
    if (V === 'front') { N.set(12, pose.ty + 1, col); N.set(15, pose.ty + 1, col); N.set(13, pose.ty + 2, col); N.set(14, pose.ty + 2, hi(col)); }
    else { N.set(11 - (pose.lean || 0), pose.ty + 1, col); N.set(12 - (pose.lean || 0), pose.ty + 2, col); }
    stamp(P, N, { ol: false });
  }
}

function owFace(L, c, hx, hy) {
  const { o, V } = c;
  const K = INK, I = o.eye, W = '#ffffff', M = mix(ramp(o.skin).ol, '#b0404a', 0.45);
  if (V === 'front') {
    // olhos 3x3: pálpebra escura, brilho branco e íris
    for (const [x, m] of [[5, 1], [12, -1]]) {
      const X = hx + x;
      L.set(X, hy + 10, K); L.set(X + 1, hy + 10, K); L.set(X + 2, hy + 10, K);
      L.set(X + (m > 0 ? 0 : 2), hy + 11, K); L.set(X + 1, hy + 11, W); L.set(X + (m > 0 ? 2 : 0), hy + 11, I);
      L.set(X + (m > 0 ? 0 : 2), hy + 12, K); L.set(X + 1, hy + 12, I); L.set(X + (m > 0 ? 2 : 0), hy + 12, I);
      if (o.female) L.set(X + (m > 0 ? -1 : 3), hy + 9, K);
    }
    if (o.female) { L.set(hx + 4, hy + 13, mix(o.skin, '#ff7a8a', 0.35)); L.set(hx + 15, hy + 13, mix(o.skin, '#ff7a8a', 0.35)); }
    L.set(hx + 9, hy + 14, M); L.set(hx + 10, hy + 14, M);
  } else {
    // perfil: olho perto da frente
    const X = hx + 5;
    L.set(X, hy + 10, K); L.set(X + 1, hy + 10, K);
    L.set(X, hy + 11, W); L.set(X + 1, hy + 11, K);
    L.set(X, hy + 12, I); L.set(X + 1, hy + 12, K);
    if (o.female) L.set(X - 1, hy + 9, K);
    L.set(hx + 4, hy + 14, M);
    if (o.female) L.set(hx + 6, hy + 13, mix(o.skin, '#ff7a8a', 0.35));
  }
}

function owGlasses(c, hx, hy) {
  const { P, o, V } = c;
  const L = P.layer();
  const sun = o.acc.style === 'sunglasses', cat = o.acc.style === 'cateye';
  const fr = sun || cat ? lift(o.acc.color) : s1(lift(o.acc.color));
  const lens = '#2a2634';
  // óculos gatinho: pontinhas viradas para cima nos cantos de fora
  if (cat && V === 'front') { L.set(hx + 3, hy + 9, fr); L.set(hx + 16, hy + 9, fr); L.set(hx + 4, hy + 9, fr); L.set(hx + 15, hy + 9, fr); }
  if (cat && V === 'side') { L.set(hx + 8, hy + 9, fr); }
  if (V === 'front') {
    for (const x of [4, 11]) { for (let k = 0; k < 5; k++) L.set(hx + x + k, hy + 10, fr); L.set(hx + x, hy + 11, fr); L.set(hx + x + 4, hy + 11, fr); if (sun) { L.set(hx + x + 1, hy + 11, lens); L.set(hx + x + 2, hy + 11, '#6a6680'); L.set(hx + x + 3, hy + 11, lens); } }
    L.set(hx + 9, hy + 10, fr); L.set(hx + 10, hy + 10, fr);
  } else if (V === 'side') {
    for (let k = 0; k < 4; k++) L.set(hx + 4 + k, hy + 10, fr);
    L.set(hx + 4, hy + 11, fr); L.set(hx + 7, hy + 11, fr);
    for (let k = 8; k < 12; k++) L.set(hx + k, hy + 10, fr);
    if (sun) { L.set(hx + 5, hy + 11, lens); L.set(hx + 6, hy + 11, lens); }
  } else { L.set(hx + 2, hy + 10, fr); L.set(hx + 17, hy + 10, fr); }
  stamp(P, L, { ol: false });
}

// balanço das pontas compridas: [linha a partir da qual balança, balança também o que fica na frente do corpo]
const OW_SWAY = { long: [16, false], wavy: [16, false], bangs: [16, false], hime: [16, false], curlylong: [16, false], twintails: [13, true],
  highponytail: [11, false], sideponytail: [13, true], braid: [14, true], braids2: [14, true] };
function owHair(c, part) {
  const { P, o, V, pose } = c;
  const [hx, hy0] = pose.head;
  let st = o.hs;
  const hat = o.hat;
  const hatDef = hat ? (OW_HAT[V] || OW_HAT.front)[hat.style] : null;
  const cut = hatDef ? hatDef[1] : -99;
  if (hatDef && cut < 50 && (st === 'afro' || st === 'mohawk' || st === 'bun')) st = st === 'afro' ? 'curly' : st === 'bun' ? (o.female ? 'ponytail' : 'short') : 'buzz';
  if (hatDef && cut < 50 && (st === 'highponytail' || st === 'doublebun')) st = st === 'doublebun' ? 'dbunlow' : 'ponytail';
  const def = (OW_HAIR[V] || OW_HAIR.front)[st] || OW_HAIR[V].short;
  if (!def) return;
  if (part === 'back' && V !== 'front') return;
  const base = o.hairL, R = ramp(base);
  const L = P.layer();
  const start = def[0];
  // pontas compridas balançam para trás quando corre (vista de lado)
  const swing = V === 'side' && pose.mode === 'run' && (pose.f & 1) ? 1 : 0;
  // de frente/costas, as pontas compridas (rabo, maria-chiquinha, cabelo longo) balançam com o passo
  const sway = V !== 'side' && (pose.mode === 'walk' || pose.mode === 'run') ? (pose.f === 1 ? 1 : pose.f === 3 ? -1 : 0) : 0;
  const sw = OW_SWAY[st] || [13, false];
  const swayRow = sw[0];
  const tie = '#e3405a';
  for (let j = 1; j < def.length; j++) {
    const row = def[j], r = start + j - 1;
    const hy = hy0;
    const sx = swing && r >= 9 ? 1 : 0;
    if (hatDef && cut < 50 && r < cut) continue;
    for (let i = 0; i < row.length; i++) {
      const k = row[i];
      const back = k === 'b';
      if (k === '.' || back !== (part === 'back')) continue;
      const tail = sway && r >= swayRow && (V === 'back' || k === 'b' || sw[1]);
      const x = hx + i + (sx && i >= 12 ? sx : 0) + (tail ? sway : 0), y = hy + r;
      if (k === 'x' || k === 'b') L.set(x, y, base);
      else if (k === '1') L.set(x, y, '1');
      else if (k === '5') L.set(x, y, '5');
      else if (k === 't') L.set(x, y, tie);
      else if (k === 's') L.set(x, y, st === 'mohawk' ? mix(o.skin, R.s2, 0.14) : mix(o.skin, base, 0.72));
    }
  }
  if (L.empty()) return;
  // linhas escuras soltas no meio do cabelo viram cabelo comum (evita "pintinhas")
  const iso = [];
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) if (L.get(x, y) === '5') {
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => { const v = L.get(x + dx, y + dy); return v == null || v === '5'; }).length;
    if (!n) iso.push([x, y]);
  }
  for (const [x, y] of iso) L.set(x, y, base);
  shade(L, { s: 1, l: 1, dir: [0.9, 0.6], skip: new Set(['1', '5', tie]) });
  L.map((v) => (v === '1' ? R.hi : v === '5' ? R.s2 : v));
  if (part === 'back') L.map((v) => s1(v));
  stamp(P, L, { cast: part === 'back' ? null : [0, 1], castN: 1 });
}

function owHat(c) {
  const { P, o, V, pose } = c;
  const [hx, hy] = pose.head;
  const h = o.hat;
  const def = (OW_HAT[V] || OW_HAT.front)[h.style];
  if (!def) return;
  const col = lift(h.color), c2 = h.color2 ? lift(h.color2) : WHITE, R = ramp(col), R2 = ramp(c2);
  const pal = { a: col, A: R.li, d: R.s1, D: R.s2, c: c2, C: R2.s1, w: WHITE, y: '#f2c230', Y: '#c8901c', r: '#d8433c', u: '#3a8fd0', k: h.style === 'ears' && col !== lift('#efc23a') ? R.s2 : '#2a2830', p: h.style === 'flower' ? col : '#e3608f' };
  if (h.style === 'flower') pal.y = '#ffe28a';
  const L = P.layer();
  for (let j = 2; j < def.length; j++) {
    const row = def[j], r = def[0] + j - 2;
    for (let i = 0; i < row.length; i++) { const k = row[i]; if (k !== '.' && pal[k]) L.set(hx + i, hy + r, pal[k]); }
  }
  put(c, L, null, { cast: [0, 1], castN: 1 });
}

// brincos, pérolas e gargantilha no mapa
function owAcc2(c) {
  const { P, o, V, pose } = c;
  const st = o.acc.style;
  if (st !== 'earrings' && st !== 'pearls' && st !== 'choker') return;
  if (V === 'back') return;   // de costas o cabelo/nuca cobre
  const col = lift(o.acc.color), R = ramp(col);
  const [hx, hy] = pose.head, ty = pose.ty, ln = pose.lean || 0;
  const N = P.layer();
  if (st === 'earrings') {
    if (V === 'front') { N.set(hx + 2, hy + 13, col); N.set(hx + 17, hy + 13, col); }
    else if (V === 'side') N.set(hx + 11, hy + 13, col);
  } else if (st === 'pearls') {
    if (V === 'front') { N.set(11, ty, R.li); N.set(12, ty + 1, R.hi); N.set(13, ty + 1, R.li); N.set(14, ty + 1, R.hi); N.set(15, ty + 1, R.li); N.set(16, ty, R.hi); }
    else if (V === 'side') { N.set(11 - ln, ty, R.hi); N.set(12 - ln, ty + 1, R.li); }
    else for (let x = 12; x < 16; x++) N.set(x, ty, mod(x, 2) ? R.li : R.hi);
  } else {
    if (V === 'front') { for (let x = 12; x < 16; x++) N.set(x, ty, col); N.set(13, ty + 1, lum(col) < 0.3 ? '#c8c8d4' : '#f2c230'); }
    else if (V === 'side') { N.set(11 - ln, ty, col); N.set(12 - ln, ty, col); }
    else for (let x = 12; x < 16; x++) N.set(x, ty, col);
  }
  stamp(P, N, { ol: false });
}

function owScarf(c) {
  const { P, o, V, pose } = c;
  const col = lift(o.acc.color), R = ramp(col);
  const L = P.layer();
  const y = pose.ty;
  if (V !== 'side') {
    for (let x = 9; x < 19; x++) { L.set(x, y - 1, col); L.set(x, y, x % 2 ? col : R.s1); }
    if (V === 'front') { L.set(15, y + 1, col); L.set(16, y + 1, col); L.set(15, y + 2, R.s1); L.set(16, y + 2, R.s1); }
    else { L.set(12, y + 1, col); L.set(13, y + 1, col); L.set(12, y + 2, R.s1); }
  } else {
    const ln = pose.lean || 0;
    for (let x = 10 - ln; x < 18 - ln; x++) { L.set(x, y - 1, col); L.set(x, y, R.s1); }
    L.set(18 - ln, y, col); L.set(19 - ln, y + 1, col); L.set(19 - ln, y + 2, R.s1);
  }
  put(c, L, { s: 1, l: 1 }, { cast: [0, 1], castN: 1 });
}

// ------------------------------------------------------------------ itens das costas (mapa)
function owBackItem(c, layer) {
  const { P, o, V, pose } = c;
  const b = o.back;
  if (!b) return;
  const col = lift(b.color), R = ramp(col);
  const L = P.layer();
  const ty = pose.ty;
  const ln = pose.lean || 0;
  switch (b.style) {
    case 'backpack':
      if (V === 'back' && layer === 'over') {
        for (let y = ty + 1; y < ty + 9; y++) for (let x = 9; x < 19; x++) L.set(x, y, y < ty + 4 ? R.li : col);
        for (let x = 9; x < 19; x++) L.set(x, ty + 4, R.s2);
        for (let y = ty + 6; y < ty + 9; y++) for (let x = 11; x < 17; x++) L.set(x, y, R.s1);
        L.set(13, ty + 4, '#b8bec8'); L.set(14, ty + 4, '#b8bec8');
        L.del(9, ty + 1); L.del(18, ty + 1);
        put(c, L, { s: 1, l: 0 });
      } else if (V === 'side' && layer === 'behind') {
        for (let y = ty + 1; y < ty + 9; y++) for (let x = 16 - ln; x < 21 - ln; x++) L.set(x, y, col);
        for (let x = 16 - ln; x < 21 - ln; x++) L.set(x, ty + 3, R.s2);
        L.del(20 - ln, ty + 1);
        put(c, L, { s: 1, l: 1 });
      } else if (V === 'side' && layer === 'over') {
        L.set(12 - ln, ty, R.s1); L.set(12 - ln, ty + 1, R.s1); L.set(12 - ln, ty + 2, R.s1); L.set(13 - ln, ty + 3, R.s1); L.set(14 - ln, ty + 4, R.s1);
        stamp(P, L, { ol: false });
      } else if (V === 'front' && layer === 'behind') {
        for (let x = 9; x < 19; x++) L.set(x, ty, R.s1);
        put(c, L, null);
      }
      break;
    case 'satchel':
      if (layer === 'over' || (V === 'front' && layer === 'behind')) {
        if (V === 'front' && layer === 'behind') break;
      }
      if (V === 'back' && layer === 'over') { for (let k = 0; k < 7; k++) L.set(17 - k, ty + k, R.s1); L.rect(8, ty + 6, 3, 3, col); put(c, L, { s: 1 }); }
      else if (V === 'side' && layer === 'over') { for (let k = 0; k < 6; k++) L.set(12 + k - ln, ty + k, R.s1); L.rect(14 - ln, ty + 6, 3, 3, col); put(c, L, { s: 1 }); }
      break;
    case 'cape':
      if (V === 'back' && layer === 'over') { for (let y = ty; y < ty + 13; y++) { const e = Math.floor((y - ty) / 4); for (let x = 9 - e; x < 19 + e; x++) L.set(x, y, col); } for (let x = 10; x < 18; x++) L.set(x, ty, '#d8b04a'); put(c, L, { s: 1, l: 1 }); }
      else if (V === 'front' && layer === 'behind') { for (let y = ty; y < ty + 13; y++) { const e = 1 + Math.floor((y - ty) / 4); for (let x = 9 - e; x < 19 + e; x++) L.set(x, y, R.s1); } put(c, L, null); }
      else if (V === 'side' && layer === 'behind') { for (let y = ty; y < ty + 13; y++) { const e = Math.floor((y - ty) / 3); for (let x = 15 - ln; x < 18 + e - ln; x++) L.set(x, y, col); } put(c, L, { s: 1, l: 1 }); }
      break;
    case 'handbag': {
      // bolsa de mão segura pela alça, logo abaixo da mão
      if (layer !== 'hand') break;
      const a = V === 'side' ? pose.arms[1] : pose.arms.find((q) => (V === 'back' ? q.x < 14 : q.x >= 14)) || pose.arms[1];
      const hp = V === 'side' ? [a.hx, a.hy] : a.run ? a.hand : [a.x + (a.dx || 0), a.hy];
      const bx = hp[0] + (V === 'side' ? 1 : 0), by = hp[1] + 2;
      L.set(bx, by - 1, R.s2); L.set(bx + 1, by - 1, R.s2);
      for (let y = by; y < by + 3; y++) for (let x = bx - 1; x < bx + 3; x++) L.set(x, y, y === by ? R.li : col);
      L.set(bx + (V === 'side' ? 0 : 1), by + 1, '#f2c230');
      put(c, L, null);
      break;
    }
    case 'wings': {
      // asa de penas saindo das costas para cima e para fora
      const rows = ['.......xx', '......xxx', '.....xxxx', '....xxxx.', '...xxxxx.', '..xxxxxx.', '.xxxxxx..', 'xxxxxx...', 'xxxxx....', 'xxx......', '.x.......'];
      const wing = (x, s) => { for (let j = 0; j < rows.length; j++) for (let i = 0; i < 9; i++) if (rows[j][i] === 'x') L.set(s > 0 ? x + i : x - i, ty - 7 + j, col); };
      const feathers = () => L.map((v, x, y) => ((x + y) % 3 === 0 && y > ty - 4 ? s1(v) : v));
      if (V === 'back' && layer === 'wings') { wing(14, 1); wing(13, -1); shade(L, { s: 1, l: 1 }); feathers(); put(c, L, null); }
      else if (V === 'front' && layer === 'behind') { wing(14, 1); wing(13, -1); shade(L, { s: 1 }); put(c, L, null, { dim: true }); }
      else if (V === 'side' && layer === 'behind') { wing(15 - ln, 1); shade(L, { s: 1, l: 1 }); feathers(); put(c, L, null); }
      break;
    }
    default: break;
  }
  // alças da mochila por cima dos ombros (vista de frente)
  if (b.style === 'backpack' && V === 'front' && layer === 'behind') c.straps = true;
}

// ------------------------------------------------------------------ veículos
function owVehicle(c, stage) {
  const veh = c.pose.veh;
  if (!veh) {
    if (stage === 'torso' && c.straps) owStraps(c);
    return;
  }
  if (stage === 'torso' && c.straps) owStraps(c);
  if (veh === 'bike') owBike(c, stage);
  else owSurf(c, stage);
}

function owStraps(c) {
  const { P, o, pose } = c;
  const col = s1(lift(o.back.color));
  const L = P.layer();
  for (let y = pose.ty; y < pose.ty + 4; y++) { L.set(10, y, col); L.set(17, y, col); }
  stamp(P, L, { ol: false });
}

const BK = { frame: '#d8433c', tire: '#2b2e36', rim: '#b8bec8', bar: '#4a4f5c', seat: '#2b2e36', lamp: '#ffe28a' };
function owBike(c, stage) {
  const { P, V, pose } = c;
  const L = P.layer();
  if (V === 'front') {
    if (stage === 'legs') {
      L.rect(13, 32, 2, 9, BK.tire); L.rect(13, 29, 2, 3, BK.frame); L.set(13, 30, BK.lamp); L.set(14, 30, BK.lamp);
      put(c, L, null);
    } else if (stage === 'torso') {
      L.rect(6, 26, 16, 1, BK.bar); L.rect(5, 26, 2, 2, BK.tire); L.rect(21, 26, 2, 2, BK.tire); L.rect(13, 26, 2, 3, BK.frame);
      put(c, L, null);
    }
  } else if (V === 'back') {
    if (stage === 'start') { L.rect(5, 25, 2, 2, BK.tire); L.rect(21, 25, 2, 2, BK.tire); put(c, L, null); }
    else if (stage === 'legs') { L.rect(13, 32, 2, 9, BK.tire); L.rect(13, 29, 2, 2, BK.frame); L.set(13, 31, '#ff5a4a'); L.set(14, 31, '#ff5a4a'); L.rect(12, 27, 4, 2, BK.seat); put(c, L, null); }
  } else {
    const { C, pn, pf } = pose.crank;
    if (stage === 'far') {
      L.line(C, pf, '#6b7080');
      L.rect(Math.round(pf[0] - 1), Math.round(pf[1]), 2, 1, BK.bar);
      for (const wx of [5.5, 22.5]) {
        for (let y = 30; y <= 43; y++) for (let x = Math.floor(wx - 6); x <= wx + 6; x++) {
          const d = Math.hypot(x + 0.5 - wx, y + 0.5 - 37);
          if (d <= 4.8 && d > 3.5) L.set(x, y, BK.tire);
          else if (d <= 3.5 && (Math.abs(x + 0.5 - wx) < 0.6 || Math.abs(y + 0.5 - 37) < 0.6)) L.set(x, y, BK.rim);
        }
      }
      const F = BK.frame;
      L.line([22, 37], [18, 29], F); L.line([22, 37], C, F); L.line(C, [18, 29], F);
      L.line(C, [9, 29], F); L.line([18, 29], [9, 29], F); L.line([9, 28], [6, 37], F);
      L.line([9, 28], [8, 25], BK.bar); L.rect(6, 25, 3, 1, BK.bar);
      L.rect(16, 27, 4, 1, BK.seat);
      put(c, L, null);
    } else if (stage === 'end') {
      L.line(C, pn, '#9aa0aa');
      L.rect(Math.round(pn[0] - 1), Math.round(pn[1]), 3, 1, BK.bar);
      put(c, L, null, { ol: false });
    }
  }
}

const SF = { body: '#4a90d9', belly: '#d2ecf8', fin: '#3270b8', eye: '#1d1d24', foam: '#ffffff' };
function owSurf(c, stage) {
  const { P, V } = c;
  const L = P.layer();
  if (V === 'front') {
    if (stage === 'start') {
      L.ell(14, 35, 12, 5.5, SF.body); L.ell(2.5, 34, 2.5, 1.8, SF.fin); L.ell(25.5, 34, 2.5, 1.8, SF.fin);
      put(c, L, { s: 2, l: 1 });
    } else if (stage === 'end') {
      L.ell(14, 38, 7, 4.5, SF.body); L.ell(14, 39.5, 4, 2.4, SF.belly);
      L.set(10, 36, SF.eye); L.set(10, 37, SF.eye); L.set(17, 36, SF.eye); L.set(17, 37, SF.eye); L.set(11, 36, '#ffffff'); L.set(18, 36, '#ffffff');
      put(c, L, { s: 1, l: 1 });
      owFoam(P, [[1, 40], [4, 41], [9, 42], [17, 42], [22, 41], [25, 40]]);
    }
  } else if (V === 'back') {
    if (stage === 'start') { L.ell(14, 28.5, 3.5, 2.5, SF.body); put(c, L, null); }
    else if (stage === 'end') {
      L.ell(14, 36, 12, 5.5, SF.body); L.ell(14, 34.5, 7, 2.2, li(SF.body));
      L.poly([14, 36, 8, 42, 10.5, 42.5, 14, 39.5, 17.5, 42.5, 20, 42], SF.fin);
      put(c, L, { s: 2, l: 1 });
      owFoam(P, [[1, 39], [3, 41], [23, 41], [25, 39]]);
    }
  } else if (stage === 'end') {
    L.ell(15, 37, 12, 5, SF.body); L.ell(14, 39.5, 9, 2, SF.belly);
    L.seg([8, 35], [5, 31], 2.4, 2.4, SF.body); L.ell(4, 30, 3.4, 2.9, SF.body);
    L.set(2, 29, SF.eye); L.set(2, 30, SF.eye); L.set(3, 29, '#ffffff');
    L.poly([23, 35, 27.5, 30, 27.5, 33, 25.5, 36.5], SF.fin);
    L.ell(17, 34, 3, 1.3, li(SF.body));
    put(c, L, { s: 1, l: 1 });
    owFoam(P, [[1, 41], [6, 42], [12, 43], [19, 43], [24, 42], [26, 40]]);
  }
}
function owFoam(P, pts) { for (const [x, y] of pts) { P.set(x, y, SF.foam); P.set(x + 1, y, SF.foam); } }
