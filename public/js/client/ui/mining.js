// Minijogo de escavação (estilo Subsolo de Diamond): quebre a parede com a
// picareta ou o martelo e desenterre tesouros, pedras e fósseis antes que ela desabe.
import { ui, esc } from './ui.js';
import { audio } from '../audio.js';
import { loadImage, imageNow } from '../assets.js';
import { getBindings, keyLabel } from '../input.js';
import { ITEMS, itemSprite } from '../../shared/data/items.js';
import { mulberry32, hash2 } from '../../shared/rng.js';

export const GW = 13, GH = 10;
const CELL = 44;
export const STABILITY = 100;
export const TOOLS = {
  pick: { name: 'Picareta', icon: '⛏', cost: 2, center: 2, ortho: 1, diag: 0 },
  hammer: { name: 'Martelo', icon: '🔨', cost: 4, center: 2, ortho: 1, diag: 1 },
};

// ------------------------------------------------------------ formas (X = célula ocupada)
const SHAPES = {
  s2: ['XX', 'XX'],
  s3: ['XXX', 'XXX', 'XXX'],
  shardA: ['XX.', 'XXX', 'XX.'],
  shardB: ['XXX', 'XX.', 'X..'],
  shardC: ['.XX', 'XXX', 'XX.'],
  shardD: ['X.X', 'XXX', '.X.'],
  stoneA: ['XXX', 'XXX', 'XXX'],
  stoneB: ['.XX', 'XXX', 'XXX'],
  stoneC: ['XX', 'XX', 'XX'],
  bone: ['X....X', 'XXXXXX', 'X....X'],
  bar: ['XXXX', 'XXXX'],
  dome: ['.XX.', 'XXXX', 'XXXX', 'XXXX'],
  helix: ['.XXX', 'XXXX', 'XXXX', 'XXX.'],
  root: ['XXXX', 'XXXX', 'XXX.', 'XX..'],
  claw: ['XXX.', 'XXXX', 'XXXX', '.XXX'],
  amber: ['XXXX', 'XXXX', 'XXXX', 'XXX.'],
};
const ROCK_SHAPES = [['XX', 'XX'], ['XXXX'], ['X', 'X', 'X', 'X'], ['XXX', 'X..'], ['XX', 'X.']];

const ITEM_SHAPE = {
  pepita: 's2', perola: 's2', poestrela: 's2', pedacoestrela: 's2', escamacoracao: 's2', minerio: 's2',
  pepitagrande: 's3', perolagrande: 's3', cometa: 's3',
  fragvermelho: 'shardA', fragazul: 'shardB', fragverde: 'shardC', fragamarelo: 'shardD',
  pedrafogo: 'stoneA', pedraagua: 'stoneB', pedratrovao: 'stoneA', pedrafolha: 'stoneB', pedralua: 'stoneC', pedrasol: 'stoneA',
  ossoraro: 'bone', pedraeterna: 'bar',
  fossildomo: 'dome', fossilhelice: 'helix', fossilraiz: 'root', fossilgarra: 'claw', fossilambar: 'amber',
};

const TREASURE_WEIGHTS = [
  ['escamacoracao', () => 18], ['minerio', () => 14], ['perola', () => 10], ['poestrela', () => 10],
  ['fragvermelho', () => 6], ['fragazul', () => 6], ['fragverde', () => 6], ['fragamarelo', () => 6],
  ['pedraeterna', () => 6], ['perolagrande', (t) => 5 + t * 0.4], ['pepita', (t) => 4 + t * 0.4],
  ['pedacoestrela', () => 4], ['ossoraro', () => 3], ['pepitagrande', (t) => 1 + t * 0.3], ['cometa', (t) => 0.6 + t * 0.2],
];
const STONES = ['pedrafogo', 'pedraagua', 'pedratrovao', 'pedrafolha', 'pedralua', 'pedrasol'];
const has = (id) => !!ITEMS[id];

export function pickLoot(rng, tier = 1) {
  const fossils = Object.keys(ITEMS).filter((id) => ITEMS[id].fossil);
  const r = rng();
  if (fossils.length && r < 0.06 + 0.01 * tier) return fossils[Math.floor(rng() * fossils.length)];
  const stones = STONES.filter(has);
  if (stones.length && r < 0.06 + 0.01 * tier + 0.15) return stones[Math.floor(rng() * stones.length)];
  const pool = TREASURE_WEIGHTS.filter(([id]) => has(id)).map(([id, w]) => [id, w(tier)]);
  let total = pool.reduce((a, [, w]) => a + w, 0);
  let x = rng() * total;
  for (const [id, w] of pool) { x -= w; if (x <= 0) return id; }
  return pool.length ? pool[pool.length - 1][0] : 'escamacoracao';
}

function shapeOf(id) {
  if (ITEMS[id] && ITEMS[id].fossil && !ITEM_SHAPE[id]) return SHAPES.amber;
  return SHAPES[ITEM_SHAPE[id] || 's2'];
}

function cellsOf(shape, ox, oy) {
  const out = [];
  shape.forEach((row, y) => [...row].forEach((c, x) => { if (c === 'X') out.push([ox + x, oy + y]); }));
  return out;
}

// ------------------------------------------------------------ parede (lógica pura)
export function makeWall(seed, tier = 1) {
  const rng = mulberry32(seed >>> 0);
  tier = Math.max(1, Math.min(8, tier | 0));
  const raw = [];
  for (let i = 0; i < GW * GH; i++) {
    const r = rng();
    raw.push(r < 0.15 ? 1 : r < 0.45 ? 2 : r < 0.7 ? 3 : r < 0.85 ? 4 : r < 0.95 ? 5 : 6);
  }
  // suaviza para formar manchas de terra e rocha
  const depth = new Array(GW * GH);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    let s = raw[y * GW + x] * 2, n = 2;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < GW && ny < GH) { s += raw[ny * GW + nx]; n++; }
    }
    depth[y * GW + x] = Math.max(1, Math.min(6, Math.round(s / n)));
  }
  const occ = new Array(GW * GH).fill(-1); // -1 vazio, >=0 objeto, -2 rocha
  const free = (cells) => cells.every(([x, y]) => x >= 0 && y >= 0 && x < GW && y < GH && occ[y * GW + x] === -1);
  const objs = [];
  const want = 2 + Math.floor(rng() * 3);
  for (let k = 0; k < want; k++) {
    const id = pickLoot(rng, tier);
    const shape = shapeOf(id);
    const w = shape[0].length, h = shape.length;
    for (let tries = 0; tries < 80; tries++) {
      const ox = Math.floor(rng() * (GW - w + 1)), oy = Math.floor(rng() * (GH - h + 1));
      const cells = cellsOf(shape, ox, oy);
      if (!free(cells)) continue;
      for (const [x, y] of cells) occ[y * GW + x] = objs.length;
      objs.push({ id, shape, x: ox, y: oy, w, h, cells, found: false });
      break;
    }
  }
  // blocos de rocha dura (não quebram) só para atrapalhar
  const rocks = [];
  const nRocks = Math.floor(rng() * 3);
  for (let k = 0; k < nRocks; k++) {
    const shape = ROCK_SHAPES[Math.floor(rng() * ROCK_SHAPES.length)];
    const w = shape[0].length, h = shape.length;
    for (let tries = 0; tries < 40; tries++) {
      const ox = Math.floor(rng() * (GW - w + 1)), oy = Math.floor(rng() * (GH - h + 1));
      const cells = cellsOf(shape, ox, oy);
      if (!free(cells)) continue;
      for (const [x, y] of cells) occ[y * GW + x] = -2;
      rocks.push({ shape, x: ox, y: oy, w, h, cells });
      break;
    }
  }
  return { depth, occ, objs, rocks, stability: STABILITY, collapsed: false, tier };
}

// Golpeia a célula (x,y). Retorna as células afetadas e os objetos revelados agora.
export function hit(wall, x, y, toolId = 'pick') {
  const tool = TOOLS[toolId] || TOOLS.pick;
  const res = { cells: [], found: [], collapsed: false, cost: 0 };
  if (wall.collapsed || wall.objs.every((o) => o.found)) return res;
  if (x < 0 || y < 0 || x >= GW || y >= GH) return res;
  const dig = (cx, cy, n) => {
    if (n <= 0 || cx < 0 || cy < 0 || cx >= GW || cy >= GH) return;
    const i = cy * GW + cx;
    const before = wall.depth[i];
    wall.depth[i] = Math.max(0, before - n);
    if (before !== wall.depth[i]) res.cells.push([cx, cy, before - wall.depth[i]]);
  };
  dig(x, y, tool.center);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) dig(x + dx, y + dy, tool.ortho);
  for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) dig(x + dx, y + dy, tool.diag);
  res.cost = tool.cost;
  wall.stability = Math.max(0, wall.stability - tool.cost);
  for (const o of wall.objs) {
    if (o.found) continue;
    if (o.cells.every(([cx, cy]) => wall.depth[cy * GW + cx] === 0)) { o.found = true; res.found.push(o); }
  }
  if (wall.stability <= 0 && !wall.objs.every((o) => o.found)) { wall.collapsed = true; res.collapsed = true; }
  return res;
}

export const wallDone = (wall) => wall.collapsed || wall.objs.every((o) => o.found);
export const collected = (wall) => wall.objs.filter((o) => o.found).map((o) => o.id);

// ------------------------------------------------------------ desenho
const LAYER = [null, '#c49a68', '#a87a4c', '#8a6040', '#8f8b84', '#74706b', '#5a5652'];
const GROUND = '#e3d2a8';

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function drawWall(ctx, wall, st) {
  const W = GW * CELL, H = GH * CELL;
  ctx.clearRect(0, 0, W, H);
  // fundo (terra já escavada)
  ctx.fillStyle = GROUND;
  ctx.fillRect(0, 0, W, H);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    ctx.fillStyle = 'rgba(120,90,50,0.10)';
    for (let k = 0; k < 3; k++) {
      const h = hash2(x, y, 40 + k);
      ctx.fillRect(x * CELL + 4 + Math.floor(h * 34), y * CELL + 4 + Math.floor(hash2(y, x, 50 + k) * 34), 3, 3);
    }
  }
  // objetos enterrados
  for (const o of wall.objs) {
    const it = ITEMS[o.id];
    const fossil = it && it.fossil;
    ctx.save();
    ctx.beginPath();
    for (const [cx, cy] of o.cells) ctx.rect(cx * CELL, cy * CELL, CELL, CELL);
    ctx.clip();
    ctx.fillStyle = fossil ? '#cbb68e' : o.found ? '#fff3c9' : '#f2e5bf';
    ctx.fillRect(o.x * CELL, o.y * CELL, o.w * CELL, o.h * CELL);
    if (fossil) {
      ctx.strokeStyle = 'rgba(90,70,40,0.35)'; ctx.lineWidth = 3;
      for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.arc((o.x + o.w / 2) * CELL, (o.y + o.h / 2) * CELL, i * CELL * 0.45, 0, Math.PI * 2); ctx.stroke(); }
    }
    const img = imageNow(itemSprite(o.id));
    const side = Math.min(o.w, o.h) * CELL;
    const big = Math.max(side, Math.max(o.w, o.h) * CELL * 0.8);
    if (img) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, (o.x + o.w / 2) * CELL - big / 2, (o.y + o.h / 2) * CELL - big / 2, big, big);
    } else {
      ctx.fillStyle = fossil ? '#9c8560' : '#e8b93a';
      ctx.beginPath(); ctx.arc((o.x + o.w / 2) * CELL, (o.y + o.h / 2) * CELL, side * 0.32, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // contorno da forma
    ctx.strokeStyle = o.found ? '#f2c230' : 'rgba(90,64,30,0.55)';
    ctx.lineWidth = o.found ? 3 : 2;
    const inShape = (cx, cy) => o.cells.some(([a, b]) => a === cx && b === cy);
    ctx.beginPath();
    for (const [cx, cy] of o.cells) {
      const X = cx * CELL, Y = cy * CELL;
      if (!inShape(cx, cy - 1)) { ctx.moveTo(X, Y); ctx.lineTo(X + CELL, Y); }
      if (!inShape(cx, cy + 1)) { ctx.moveTo(X, Y + CELL); ctx.lineTo(X + CELL, Y + CELL); }
      if (!inShape(cx - 1, cy)) { ctx.moveTo(X, Y); ctx.lineTo(X, Y + CELL); }
      if (!inShape(cx + 1, cy)) { ctx.moveTo(X + CELL, Y); ctx.lineTo(X + CELL, Y + CELL); }
    }
    ctx.stroke();
  }
  // rocha dura
  for (const r of wall.rocks) for (const [cx, cy] of r.cells) {
    const X = cx * CELL, Y = cy * CELL;
    ctx.fillStyle = '#5b626e'; ctx.fillRect(X, Y, CELL, CELL);
    ctx.fillStyle = '#7a8290'; ctx.fillRect(X, Y, CELL, 4); ctx.fillRect(X, Y, 4, CELL);
    ctx.fillStyle = '#3e434c'; ctx.fillRect(X, Y + CELL - 4, CELL, 4); ctx.fillRect(X + CELL - 4, Y, 4, CELL);
    ctx.fillStyle = '#9aa2ae';
    for (const [px, py] of [[10, 10], [CELL - 14, 10], [10, CELL - 14], [CELL - 14, CELL - 14]]) ctx.fillRect(X + px, Y + py, 4, 4);
  }
  // camadas de terra/rocha por cima
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const d = wall.depth[y * GW + x];
    if (!d) continue;
    const X = x * CELL, Y = y * CELL, c = LAYER[d];
    ctx.fillStyle = c; ctx.fillRect(X, Y, CELL, CELL);
    ctx.fillStyle = shade(c, 0.22); ctx.fillRect(X, Y, CELL, 4); ctx.fillRect(X, Y, 4, CELL);
    ctx.fillStyle = shade(c, -0.25); ctx.fillRect(X, Y + CELL - 4, CELL, 4); ctx.fillRect(X + CELL - 4, Y, 4, CELL);
    // pedrinhas
    for (let k = 0; k < 4; k++) {
      const h = hash2(x * 7 + d, y * 13, k);
      ctx.fillStyle = h > 0.5 ? shade(c, -0.18) : shade(c, 0.14);
      ctx.fillRect(X + 6 + Math.floor(h * 28), Y + 6 + Math.floor(hash2(y, x + d, k + 9) * 28), d > 3 ? 5 : 4, d > 3 ? 4 : 3);
    }
    // marcas de camadas extras (rocha mais funda = mais riscos)
    if (d >= 4) {
      ctx.strokeStyle = shade(c, -0.3); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(X + 8, Y + 22); ctx.lineTo(X + 20, Y + 16); ctx.lineTo(X + 34, Y + 24); ctx.stroke();
    }
  }
  // brilhos dos objetos encontrados
  const now = performance.now();
  for (const sp of st.sparkles) {
    const k = (now - sp.at) / 900;
    if (k >= 1) continue;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + k * 2;
      const r = 8 + k * 46;
      const px = sp.x + Math.cos(a) * r, py = sp.y + Math.sin(a) * r;
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = i % 2 ? '#fff6a0' : '#ffffff';
      ctx.fillRect(px - 3, py - 1, 6, 2); ctx.fillRect(px - 1, py - 3, 2, 6);
    }
    ctx.globalAlpha = 1;
  }
  // poeira dos golpes
  for (const p of st.dust) {
    const k = (now - p.at) / 380;
    if (k >= 1) continue;
    ctx.globalAlpha = 0.8 * (1 - k);
    ctx.fillStyle = p.c;
    ctx.fillRect(p.x + p.vx * k * 30, p.y + p.vy * k * 30 + k * k * 16, 5, 5);
    ctx.globalAlpha = 1;
  }
  // alvo da ferramenta
  if (st.hover && !wallDone(wall)) {
    const tool = TOOLS[st.tool];
    const [hx, hy] = st.hover;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3;
    ctx.strokeRect(hx * CELL + 2, hy * CELL + 2, CELL - 4, CELL - 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2;
    const ring = tool.diag ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of ring) {
      const nx = hx + dx, ny = hy + dy;
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      ctx.strokeRect(nx * CELL + 5, ny * CELL + 5, CELL - 10, CELL - 10);
    }
  }
}

const CSS = `
.mining { gap: 10px; }
.mining .mn-top { gap: 8px; }
.mining .mn-bar { flex: 1; height: 14px; border-radius: 8px; background: #e7e1d5; overflow: hidden; box-shadow: inset 0 2px 0 rgba(0,0,0,.08); }
.mining .mn-bar i { display: block; height: 100%; width: 100%; background: linear-gradient(90deg, #45b864, #8fdc6a); transition: width .2s, background .2s; }
.mining .mn-bar i.mid { background: linear-gradient(90deg, #e8a33d, #f2c230); }
.mining .mn-bar i.low { background: linear-gradient(90deg, #b92d2a, #e3403b); }
.mining .mn-wrap { position: relative; width: 100%; max-width: ${GW * CELL}px; margin: 0 auto; border-radius: 10px; overflow: hidden; border: 4px solid #5a3f27; box-shadow: 0 4px 0 #3c2918, inset 0 0 0 2px #7a5636; background: #3c2918; }
.mining canvas { display: block; width: 100%; height: auto; touch-action: none; cursor: crosshair; image-rendering: pixelated; }
.mining .mn-wrap.shake { animation: mnShake .5s; }
.mining .mn-wrap .mn-end { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(20,14,8,.55); color: #fff; font-weight: 900; font-size: clamp(18px, 4vw, 28px); text-align: center; padding: 12px; text-shadow: 0 2px 0 #000; }
.mining .mn-tools { flex-wrap: wrap; }
.mining .mn-hint { font-size: 12px; }
@media (max-width: 520px) { .mining .mn-tools .btn { padding: 8px 10px; font-size: 14px; } }
.mining .mn-tool.sel { background: #5a3f27; color: #fff; box-shadow: 0 3px 0 #3c2918; }
.mining .mn-found { flex-wrap: wrap; gap: 6px; min-height: 36px; }
.mining .mn-found .it { display: flex; align-items: center; gap: 4px; background: #fff; border-radius: 10px; padding: 2px 10px 2px 2px; font-weight: 800; font-size: 13px; }
.mining .mn-found .it img { width: 30px; height: 30px; image-rendering: pixelated; }
@keyframes mnShake { 0%,100% { transform: translate(0,0); } 15% { transform: translate(-8px,3px); } 30% { transform: translate(7px,-4px); } 45% { transform: translate(-6px,-2px); } 60% { transform: translate(5px,4px); } 75% { transform: translate(-3px,1px); } }
`;

function injectCss() {
  if (document.getElementById('mining-css')) return;
  const s = document.createElement('style');
  s.id = 'mining-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}

// ------------------------------------------------------------ painel
export function openMining({ seed = Date.now(), tier = 1 } = {}) {
  injectCss();
  const wall = makeWall(seed, tier);
  const st = { tool: 'pick', hover: null, cursor: [Math.floor(GW / 2), Math.floor(GH / 2)], sparkles: [], dust: [], lastHit: 0, raf: 0 };
  for (const o of wall.objs) loadImage(itemSprite(o.id));
  return new Promise((resolve) => {
    let canvas = null, ctx = null, body = null, finished = false;
    const paint = () => { if (ctx) drawWall(ctx, wall, st); };
    const animate = () => {
      cancelAnimationFrame(st.raf);
      const loop = () => {
        paint();
        const now = performance.now();
        st.sparkles = st.sparkles.filter((s) => now - s.at < 900);
        st.dust = st.dust.filter((p) => now - p.at < 380);
        if (st.sparkles.length || st.dust.length) st.raf = requestAnimationFrame(loop);
      };
      st.raf = requestAnimationFrame(loop);
    };
    const updateBar = () => {
      const bar = body.querySelector('.mn-bar i');
      const k = wall.stability / STABILITY;
      bar.style.width = `${k * 100}%`;
      bar.classList.toggle('mid', k <= 0.5 && k > 0.2);
      bar.classList.toggle('low', k <= 0.2);
    };
    const updateFound = () => {
      const box = body.querySelector('.mn-found');
      const got = wall.objs.filter((o) => o.found);
      box.innerHTML = got.length
        ? got.map((o) => `<span class="it"><img src="${itemSprite(o.id)}" alt="">${esc(ITEMS[o.id].name)}</span>`).join('')
        : `<span class="muted">Ainda nada desenterrado. ${wall.objs.length} objeto(s) escondido(s) nesta parede.</span>`;
    };
    const finish = (text) => {
      finished = true;
      st.hover = null;
      body.querySelectorAll('.mn-tool').forEach((b) => { b.disabled = true; });
      const end = document.createElement('div');
      end.className = 'mn-end';
      end.textContent = text;
      body.querySelector('.mn-wrap').appendChild(end);
      body.querySelector('[data-a=exit]').textContent = 'Concluir';
      paint();
    };
    const doHit = (x, y) => {
      if (finished || wallDone(wall)) return;
      const now = performance.now();
      if (now - st.lastHit < 90) return;
      st.lastHit = now;
      const r = hit(wall, x, y, st.tool);
      if (!r.cost) return;
      audio.sfx(st.tool === 'hammer' ? 'hit' : 'weakhit');
      for (const [cx, cy] of r.cells) {
        const c = LAYER[Math.max(1, wall.depth[cy * GW + cx] + 1)] || LAYER[1];
        for (let k = 0; k < 3; k++) st.dust.push({ at: now, x: cx * CELL + CELL / 2, y: cy * CELL + CELL / 2, vx: Math.random() * 2 - 1, vy: Math.random() * 2 - 1.4, c });
      }
      if (st.tool === 'hammer') {
        const wrap = body.querySelector('.mn-wrap');
        wrap.style.transform = `translate(${Math.random() * 4 - 2}px, ${Math.random() * 4 - 2}px)`;
        setTimeout(() => { wrap.style.transform = ''; }, 70);
      }
      for (const o of r.found) {
        st.sparkles.push({ at: now, x: (o.x + o.w / 2) * CELL, y: (o.y + o.h / 2) * CELL });
        audio.sfx('item');
        ui.toast(`Você desenterrou: ${ITEMS[o.id].name}!`, 'good');
      }
      updateBar();
      if (r.found.length) updateFound();
      animate();
      if (r.collapsed) {
        audio.sfx('superhit');
        const wrap = body.querySelector('.mn-wrap');
        wrap.classList.remove('shake'); void wrap.offsetWidth; wrap.classList.add('shake');
        const n = wall.objs.filter((o) => o.found).length;
        setTimeout(() => finish(n ? `A parede desabou! Você ficou com ${n} objeto(s).` : 'A parede desabou! Não deu tempo de pegar nada...'), 350);
      } else if (wallDone(wall)) {
        setTimeout(() => { audio.sfx('caught'); finish('Você desenterrou tudo!'); }, 450);
      }
    };
    const setTool = (t) => {
      if (finished || !TOOLS[t]) return;
      st.tool = t;
      body.querySelectorAll('.mn-tool').forEach((b) => b.classList.toggle('sel', b.dataset.tool === t));
      audio.sfx('select');
      paint();
    };
    const cellFromEvent = (e) => {
      const r = canvas.getBoundingClientRect();
      const x = Math.floor(((e.clientX - r.left) / r.width) * GW);
      const y = Math.floor(((e.clientY - r.top) / r.height) * GH);
      return x >= 0 && y >= 0 && x < GW && y < GH ? [x, y] : null;
    };
    const layer = ui.panel({
      title: 'Escavação',
      sub: `Algo brilha na parede! ${wall.objs.length} objeto(s)`,
      width: 'min(760px,96vw)',
      backdrop: false,
      onClose: () => { cancelAnimationFrame(st.raf); resolve(collected(wall)); },
      onKey: (k) => {
        if (finished) return false;
        const c = st.cursor;
        if (k === 'up') c[1] = Math.max(0, c[1] - 1);
        else if (k === 'down') c[1] = Math.min(GH - 1, c[1] + 1);
        else if (k === 'left') c[0] = Math.max(0, c[0] - 1);
        else if (k === 'right') c[0] = Math.min(GW - 1, c[0] + 1);
        else if (k === 'a') { doHit(c[0], c[1]); return true; }
        else if (k === 'runToggle') { setTool(st.tool === 'pick' ? 'hammer' : 'pick'); return true; }
        else return false;
        st.hover = [c[0], c[1]];
        paint();
        return true;
      },
      build: (b) => {
        body = b;
        const binds = getBindings();
        const kA = keyLabel((binds.a || [])[0]), kR = keyLabel((binds.runToggle || [])[0]);
        body.innerHTML = `<div class="mining col">
            <div class="row mn-top"><span class="muted">Estabilidade da parede</span><div class="mn-bar"><i></i></div></div>
            <div class="mn-wrap"><canvas></canvas></div>
            <div class="row mn-tools">
              ${Object.entries(TOOLS).map(([id, t]) => `<button class="btn mn-tool ${id === st.tool ? 'sel' : ''}" data-tool="${id}">${t.icon} ${t.name}</button>`).join('')}
              <div class="grow"></div>
              <button class="btn red" data-a="exit">Sair</button>
            </div>
            <div class="muted mn-hint">Picareta: precisa e gasta pouco. Martelo: quebra mais, mas abala a parede. (Setas + ${esc(kA)} escavam, ${esc(kR)} troca a ferramenta)</div>
            <div class="row mn-found"></div>
          </div>`;
        canvas = body.querySelector('canvas');
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = GW * CELL * dpr;
        canvas.height = GH * CELL * dpr;
        ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        canvas.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          const c = cellFromEvent(e);
          if (!c) return;
          st.cursor = [c[0], c[1]];
          if (e.pointerType !== 'mouse') st.hover = null;
          doHit(c[0], c[1]);
        });
        canvas.addEventListener('pointermove', (e) => {
          if (e.pointerType !== 'mouse' || finished) return;
          const c = cellFromEvent(e);
          if (String(c) === String(st.hover)) return;
          st.hover = c;
          paint();
        });
        canvas.addEventListener('pointerleave', () => { st.hover = null; paint(); });
        body.querySelectorAll('.mn-tool').forEach((btn) => btn.onclick = () => setTool(btn.dataset.tool));
        body.querySelector('[data-a=exit]').onclick = async () => {
          if (!finished && !wallDone(wall) && !(await ui.ask('Sair agora? Os objetos ainda enterrados ficam para trás.'))) return;
          audio.sfx('cancel');
          layer.close();
        };
        updateBar();
        updateFound();
        paint();
        Promise.all(wall.objs.map((o) => loadImage(itemSprite(o.id)))).then(paint);
      },
    });
  });
}
