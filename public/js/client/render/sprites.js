// Sprites procedurais: árvores, rochas, prédios, objetos e móveis.
import { TS } from './terrain.js';
import { shade, rgba, roundRect, makeCanvas, mix, hexToRgb } from './color.js';
import { BUILDINGS } from '../../shared/world/defs.js';
import { FURNITURE, FLOORS, WALLS } from '../../shared/data/furniture.js';
import { imageNow, loadImage, spriteUrl } from '../assets.js';

let PR = 1;
export function setSpritePR(pr) { PR = pr; cache.clear(); }
const cache = new Map();

function cached(key, w, h, draw) {
  let c = cache.get(key);
  if (c) return c;
  c = makeCanvas(w * PR, h * PR);
  const ctx = c.getContext('2d');
  ctx.scale(PR, PR);
  draw(ctx, w, h);
  c.lw = w; c.lh = h;
  cache.set(key, c);
  return c;
}

// ------------------------------------------------------------ vegetação
const TREE_PAL = [
  ['#3e9a47', '#2c7a37', '#6cc35f'],
  ['#4aa64d', '#337f3a', '#7fd06a'],
  ['#2f8a4a', '#1f6838', '#55b06a'],
  ['#56a83f', '#3c8530', '#8ad15c'],
];

export function treeSprite(variant) {
  return cached('tree' + variant, TS * 1.7, TS * 2.3, (ctx, w, h) => {
    const [base, dark, light] = TREE_PAL[variant % TREE_PAL.length];
    const cx = w / 2, by = h - TS * 0.18;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(cx + 4, by, TS * 0.6, TS * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    // tronco
    const tg = ctx.createLinearGradient(cx - 6, 0, cx + 6, 0);
    tg.addColorStop(0, '#8a5a34'); tg.addColorStop(1, '#5e3a1f');
    ctx.fillStyle = tg;
    roundRect(ctx, cx - TS * 0.11, by - TS * 0.75, TS * 0.22, TS * 0.75, 4); ctx.fill();
    ctx.fillStyle = '#4e2f18';
    ctx.beginPath(); ctx.ellipse(cx, by - 1, TS * 0.13, 3, 0, 0, Math.PI * 2); ctx.fill();
    // copa
    const ccy = by - TS * 1.25;
    const blobs = [
      [-0.38, 0.18, 0.4], [0.38, 0.18, 0.4], [0, 0.28, 0.42], [-0.22, -0.18, 0.42], [0.24, -0.2, 0.4], [0, -0.42, 0.36],
    ];
    const rot = variant * 0.7;
    ctx.fillStyle = dark;
    for (const [dx, dy, r] of blobs) { ctx.beginPath(); ctx.arc(cx + dx * TS + 2, ccy + dy * TS + 4, r * TS, 0, Math.PI * 2); ctx.fill(); }
    for (const [dx, dy, r] of blobs) {
      const g = ctx.createRadialGradient(cx + dx * TS - r * TS * 0.4, ccy + dy * TS - r * TS * 0.5, 2, cx + dx * TS, ccy + dy * TS, r * TS);
      g.addColorStop(0, light); g.addColorStop(0.55, base); g.addColorStop(1, dark);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx + dx * TS, ccy + dy * TS, r * TS * 0.96, 0, Math.PI * 2); ctx.fill();
    }
    // brilhos e sombras de folhas
    ctx.fillStyle = rgba(light, 0.7);
    for (let i = 0; i < 5; i++) {
      const a = rot + i * 1.3, d = TS * (0.15 + (i % 3) * 0.12);
      ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * d - 4, ccy - TS * 0.2 + Math.sin(a) * d * 0.7, 5, 3, a, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = rgba(dark, 0.6); ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = rot + i * 1.6 + 0.4, d = TS * 0.3;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d, ccy + Math.sin(a) * d * 0.8 + 8, 7, 0.2, Math.PI - 0.2); ctx.stroke();
    }
    if (variant === 3) {
      // frutinhas
      ctx.fillStyle = '#e8463c';
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(cx + Math.cos(i * 2.1) * TS * 0.35, ccy + Math.sin(i * 2.1) * TS * 0.3, 3, 0, Math.PI * 2); ctx.fill(); }
    }
  });
}

export function pineSprite(snowy) {
  return cached('pine' + (snowy ? 's' : ''), TS * 1.4, TS * 2.4, (ctx, w, h) => {
    const cx = w / 2, by = h - TS * 0.18;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(cx + 3, by, TS * 0.5, TS * 0.17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6b4426';
    ctx.fillRect(cx - 5, by - TS * 0.5, 10, TS * 0.5);
    const tiers = [[0.62, 0.95], [0.5, 1.45], [0.36, 1.9]];
    tiers.forEach(([hw, top], i) => {
      const yb = by - TS * (0.35 + i * 0.45);
      const g = ctx.createLinearGradient(cx - hw * TS, 0, cx + hw * TS, 0);
      g.addColorStop(0, '#3f8d64'); g.addColorStop(0.5, '#2e7552'); g.addColorStop(1, '#1d5a3d');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx - hw * TS, yb);
      ctx.quadraticCurveTo(cx, yb + 8, cx + hw * TS, yb);
      ctx.lineTo(cx, by - TS * top);
      ctx.closePath();
      ctx.fill();
      if (snowy) {
        ctx.fillStyle = '#f4f8fc';
        ctx.beginPath();
        ctx.moveTo(cx - hw * TS * 0.55, yb - TS * 0.28);
        ctx.quadraticCurveTo(cx, yb - TS * 0.2, cx + hw * TS * 0.5, yb - TS * 0.3);
        ctx.lineTo(cx, by - TS * top);
        ctx.closePath();
        ctx.fill();
      }
    });
  });
}

export function palmSprite() {
  return cached('palm', TS * 1.8, TS * 2.4, (ctx, w, h) => {
    const cx = w / 2, by = h - TS * 0.18;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(cx + 6, by, TS * 0.5, TS * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#a07040'; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, by - 2); ctx.quadraticCurveTo(cx + 14, by - TS, cx + 4, by - TS * 1.7); ctx.stroke();
    ctx.strokeStyle = '#7d5530'; ctx.lineWidth = 2;
    for (let i = 1; i < 7; i++) { const t = i / 7; const y = by - TS * 1.7 * t; const x = cx + 14 * Math.sin(t * Math.PI) * 0.9; ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y + 2); ctx.stroke(); }
    const tx = cx + 4, ty = by - TS * 1.72;
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.55;
      const len = TS * 0.8;
      ctx.strokeStyle = i % 2 ? '#3f9a47' : '#56b052'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(tx + Math.cos(a) * len * 0.6, ty + Math.sin(a) * len * 0.6 - 10, tx + Math.cos(a) * len, ty + Math.sin(a) * len * 0.4 + 18);
      ctx.stroke();
    }
    ctx.fillStyle = '#7a4c27';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(tx - 6 + i * 6, ty + 6, 4, 0, Math.PI * 2); ctx.fill(); }
  });
}

export function boulderSprite(snowy) {
  return cached('boulder' + (snowy ? 's' : ''), TS, TS * 1.1, (ctx, w, h) => {
    const cx = w / 2, by = h - 6;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(cx + 3, by, TS * 0.42, TS * 0.14, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(cx - 8, by - 26, 3, cx, by - 14, TS * 0.5);
    g.addColorStop(0, '#c9c4bd'); g.addColorStop(0.6, '#9a948c'); g.addColorStop(1, '#6d6760');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - 20, by); ctx.quadraticCurveTo(cx - 24, by - 26, cx - 6, by - 34); ctx.quadraticCurveTo(cx + 16, by - 38, cx + 21, by - 16); ctx.quadraticCurveTo(cx + 22, by, cx - 20, by);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,55,50,0.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx - 4, by - 30); ctx.lineTo(cx + 2, by - 18); ctx.lineTo(cx - 2, by - 8); ctx.stroke();
    if (snowy) { ctx.fillStyle = '#f6f9fc'; ctx.beginPath(); ctx.moveTo(cx - 16, by - 26); ctx.quadraticCurveTo(cx, by - 42, cx + 16, by - 24); ctx.quadraticCurveTo(cx, by - 30, cx - 16, by - 26); ctx.fill(); }
  });
}

export function cactusSprite() {
  return cached('cactus', TS, TS * 1.6, (ctx, w, h) => {
    const cx = w / 2, by = h - 6;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(cx + 3, by, TS * 0.3, TS * 0.1, 0, 0, Math.PI * 2); ctx.fill();
    const body = (x, y, ww, hh) => {
      const g = ctx.createLinearGradient(x, 0, x + ww, 0);
      g.addColorStop(0, '#5fb35a'); g.addColorStop(0.6, '#3f8f45'); g.addColorStop(1, '#2d6e35');
      ctx.fillStyle = g; roundRect(ctx, x, y, ww, hh, ww / 2); ctx.fill();
    };
    body(cx - 8, by - TS * 1.3, 16, TS * 1.3);
    body(cx - 22, by - TS * 0.95, 10, TS * 0.4); body(cx - 22, by - TS * 0.66, 18, 9);
    body(cx + 12, by - TS * 1.1, 10, TS * 0.45); body(cx + 4, by - TS * 0.72, 18, 9);
    ctx.fillStyle = '#ff6fa8'; ctx.beginPath(); ctx.arc(cx, by - TS * 1.3, 4, 0, Math.PI * 2); ctx.fill();
  });
}

// ------------------------------------------------------------ prédios
function windowShape(ctx, x, y, w, h, night, tint = '#8fd0ff') {
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, x - 3, y - 3, w + 6, h + 6, 5); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(x - 3, y + h + 1, w + 6, 3);
  if (night) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#fff3b0'); g.addColorStop(1, '#ffc75a');
    ctx.fillStyle = g;
  } else {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, shade(tint, 0.35)); g.addColorStop(1, shade(tint, -0.2));
    ctx.fillStyle = g;
  }
  roundRect(ctx, x, y, w, h, 3); ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.stroke();
  if (!night) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.moveTo(x + 2, y + h - 4); ctx.lineTo(x + w * 0.4, y + 2); ctx.lineTo(x + w * 0.55, y + 2); ctx.lineTo(x + 6, y + h - 4); ctx.fill(); }
}

function pokeballEmblem(ctx, cx, cy, r) {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(cx, cy, r + 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e3403b';
  ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#f4f4f4';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI); ctx.fill();
  ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.32, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}

function signPlate(ctx, cx, y, text, bg, fg = '#fff') {
  ctx.font = '900 13px Nunito, sans-serif';
  const tw = Math.max(30, ctx.measureText(text).width + 16);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, cx - tw / 2 + 2, y + 2, tw, 20, 6); ctx.fill();
  ctx.fillStyle = bg;
  roundRect(ctx, cx - tw / 2, y, tw, 20, 6); ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, y + 11);
}

// opts: { roof, night, owner, forSale }
export function buildingSprite(b, opts = {}) {
  const def = BUILDINGS[b.type];
  const key = `bld:${b.type}:${b.w}x${b.h}:${opts.roof || ''}:${opts.night ? 1 : 0}:${opts.owner || ''}`;
  const extra = b.type === 'lighthouse' ? 2.5 : b.type === 'tower' ? 2 : b.type === 'dept' || b.type === 'battletower' ? 1.4 : 0.45;
  return cached(key, b.w * TS, (b.h + extra) * TS, (ctx, w, h) => {
    drawBuilding(ctx, b, def, w, h, extra, opts);
  });
}

function drawBuilding(ctx, b, def, w, h, extra, opts) {
  const night = !!opts.night;
  const roof = opts.roof || def.roof;
  const wallC = def.wall;
  const footTop = extra * TS; // y onde começa o footprint
  const modern = b.type === 'mansion_house';
  const tall = b.type === 'dept' || b.type === 'battletower';
  const homey = b.type === 'house' || b.type === 'house2' || !!def.plot || HOMEY.has(b.type);
  const wallH = Math.min(b.h * TS * 0.55, TS * (modern ? 3.1 : 2.2));
  const wallTop = h - wallH;
  const doorCol = Math.floor(b.w / 2);
  // sombra
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  roundRect(ctx, 8, h - 10, w - 4, 12, 6); ctx.fill();

  if (def.pool) return drawMansion(ctx, b, def, w, h, extra, opts);
  if (b.type === 'lighthouse') return drawLighthouse(ctx, w, h, night);
  if (b.type === 'tower') return drawTower(ctx, w, h, night);
  if (b.type === 'ruins') return drawRuins(ctx, w, h);

  // ---- parede
  const wg = ctx.createLinearGradient(0, wallTop, 0, h);
  wg.addColorStop(0, shade(wallC, 0.05)); wg.addColorStop(1, shade(wallC, -0.08));
  ctx.fillStyle = wg;
  ctx.fillRect(4, wallTop, w - 8, wallH - 4);
  ctx.strokeStyle = rgba(shade(wallC, -0.3), 0.25); ctx.lineWidth = 1;
  for (let y = wallTop + 10; y < h - 10; y += 10) { ctx.beginPath(); ctx.moveTo(6, y); ctx.lineTo(w - 6, y); ctx.stroke(); }
  ctx.fillStyle = shade(wallC, -0.35);
  ctx.fillRect(4, h - 10, w - 8, 6);
  if (tall) {
    // andares extras
    const floors = 2;
    for (let f = 0; f < floors; f++) {
      const fy = wallTop - (f + 1) * TS * 0.9;
      ctx.fillStyle = shade(wallC, -0.03 * f);
      ctx.fillRect(4, fy, w - 8, TS * 0.9);
      for (let i = 0; i < b.w; i++) windowShape(ctx, i * TS + 12, fy + 12, TS - 24, TS * 0.9 - 26, night);
    }
  }
  if (modern) {
    // andar de cima com janelões e faixa de madeira
    ctx.fillStyle = '#a0714a'; ctx.fillRect(4, wallTop + wallH * 0.43, w - 8, 7);
    for (let i = 0; i < b.w; i++) windowShape(ctx, i * TS + 7, wallTop + 10, TS - 14, wallH * 0.3, night, '#9fd8ff');
  }
  // ---- janelas e porta
  for (let i = 0; i < b.w; i++) {
    const x = i * TS;
    if (i === doorCol) continue;
    if (b.type === 'gym' && Math.abs(i - doorCol) === 1) {
      // colunas
      ctx.fillStyle = '#f2efe6'; ctx.fillRect(x + TS * 0.35, wallTop + 4, TS * 0.3, wallH - 12);
      ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(x + TS * 0.55, wallTop + 4, TS * 0.1, wallH - 12);
      continue;
    }
    if (modern) { windowShape(ctx, x + 6, wallTop + wallH * 0.52, TS - 12, wallH * 0.36, night, '#9fd8ff'); continue; }
    windowShape(ctx, x + 11, wallTop + wallH * 0.22, TS - 22, wallH * 0.38, night, b.type === 'lab' ? '#a9e6ff' : '#8fd0ff');
    // floreira
    if (homey && i % 2 === 0) {
      ctx.fillStyle = '#8a5a34'; ctx.fillRect(x + 9, wallTop + wallH * 0.62 + 2, TS - 18, 6);
      for (let k = 0; k < 4; k++) { ctx.fillStyle = ['#ff6b8b', '#ffd34d', '#ff9ad5', '#ffffff'][k]; ctx.beginPath(); ctx.arc(x + 13 + k * 7, wallTop + wallH * 0.62, 3, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  // porta
  const dx = doorCol * TS;
  const glassDoor = ['center', 'mart', 'dept', 'boutique', 'league', 'contest', 'realty', 'furniture', 'mansion_house', 'luxfurniture', 'tvstation', 'battletower', 'museum'].includes(b.type);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(dx + 6, h - wallH * 0.62 - 4, TS - 12, wallH * 0.62);
  if (glassDoor) {
    const g = ctx.createLinearGradient(0, h - wallH * 0.62, 0, h);
    g.addColorStop(0, night ? '#ffe7a0' : '#bfe6ff'); g.addColorStop(1, night ? '#ffc35a' : '#6fb4e8');
    ctx.fillStyle = g;
    ctx.fillRect(dx + 8, h - wallH * 0.62, TS - 16, wallH * 0.62 - 8);
    ctx.fillStyle = '#d9d9d9';
    ctx.fillRect(dx + TS / 2 - 1, h - wallH * 0.62, 2, wallH * 0.62 - 8);
  } else {
    const g = ctx.createLinearGradient(dx, 0, dx + TS, 0);
    g.addColorStop(0, '#9a6236'); g.addColorStop(1, '#6e4222');
    ctx.fillStyle = g;
    roundRect(ctx, dx + 9, h - wallH * 0.62, TS - 18, wallH * 0.62 - 8, 4); ctx.fill();
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath(); ctx.arc(dx + TS - 15, h - wallH * 0.3, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = shade(wallC, -0.45);
  ctx.fillRect(dx + 4, h - 9, TS - 8, 5);

  // ---- telhado
  const roofBottom = wallTop + 6;
  const roofTop = tall ? wallTop - 2 * TS * 0.9 - TS * 0.5 : 6;
  const flat = ['lab', 'dept', 'powerplant', 'mansion_house', 'galactic', 'tvstation', 'luxfurniture'].includes(b.type);
  if (flat) {
    const rt = tall ? roofTop : footTop - TS * 0.2;
    ctx.fillStyle = shade(roof, -0.25);
    ctx.fillRect(0, tall ? roofBottom - 2 * TS * 0.9 - 10 : roofBottom - 10, w, 12);
    const top = tall ? rt : rt;
    const bottom = tall ? roofBottom - 2 * TS * 0.9 - 8 : roofBottom - 8;
    const g = ctx.createLinearGradient(0, top, 0, bottom);
    g.addColorStop(0, shade(roof, 0.25)); g.addColorStop(1, roof);
    ctx.fillStyle = g;
    ctx.fillRect(2, top, w - 4, bottom - top);
    ctx.strokeStyle = rgba('#000000', 0.12); ctx.lineWidth = 2; ctx.strokeRect(3, top + 1, w - 6, bottom - top - 2);
    if (b.type === 'lab') {
      for (let i = 0; i < 3; i++) { ctx.fillStyle = '#2d4f7c'; roundRect(ctx, 14 + i * 50, top + 12, 40, 26, 3); ctx.fill(); ctx.strokeStyle = '#8fb3e6'; ctx.lineWidth = 1; ctx.strokeRect(14 + i * 50, top + 12, 40, 26); }
      ctx.strokeStyle = '#777'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(w - 30, top + 30); ctx.lineTo(w - 30, top - 10); ctx.stroke();
      ctx.fillStyle = '#e3403b'; ctx.beginPath(); ctx.arc(w - 30, top - 12, 5, 0, Math.PI * 2); ctx.fill();
    }
    if (modern) {
      // terraço com claraboias e vasos
      for (let i = 0; i < 2; i++) { ctx.fillStyle = '#bfe3f7'; roundRect(ctx, 16 + i * 60, top + 14, 40, 22, 3); ctx.fill(); ctx.strokeStyle = '#7fa3b8'; ctx.lineWidth = 2; ctx.strokeRect(16 + i * 60, top + 14, 40, 22); }
      for (let x = w - 30; x > w * 0.55; x -= 26) { ctx.fillStyle = '#7a5234'; ctx.fillRect(x, bottom - 26, 16, 12); ctx.fillStyle = '#3f9a54'; ctx.beginPath(); ctx.arc(x + 8, bottom - 30, 10, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = 'rgba(180,225,255,0.55)'; ctx.fillRect(2, bottom - 14, w - 4, 6);
    }
    if (b.type === 'galactic') {
      ctx.fillStyle = '#c9d6e3'; ctx.beginPath(); ctx.arc(w / 2, top + 26, 20, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3fb4b4'; ctx.font = '900 26px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('G', w / 2, top + 27);
      ctx.fillStyle = '#8a96a8'; ctx.fillRect(w - 26, top - 34, 6, 46); ctx.fillStyle = '#d9443c'; ctx.beginPath(); ctx.arc(w - 23, top - 36, 4, 0, Math.PI * 2); ctx.fill();
    }
    if (b.type === 'tvstation') {
      ctx.strokeStyle = '#8a8f99'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(w / 2, top + 10); ctx.lineTo(w / 2, top - 40); ctx.moveTo(w / 2 - 14, top - 24); ctx.lineTo(w / 2 + 14, top - 24); ctx.moveTo(w / 2 - 9, top - 33); ctx.lineTo(w / 2 + 9, top - 33); ctx.stroke();
      ctx.fillStyle = '#e3403b'; ctx.beginPath(); ctx.arc(w / 2, top - 42, 4, 0, Math.PI * 2); ctx.fill();
    }
    if (b.type === 'powerplant') {
      ctx.fillStyle = '#9a9a9a'; ctx.fillRect(w - 40, top - 30, 18, 50);
      ctx.fillStyle = '#e8c33a'; for (let i = 0; i < 3; i++) ctx.fillRect(w - 40, top - 26 + i * 14, 18, 5);
    }
  } else {
    // telhado inclinado visto de frente
    const g = ctx.createLinearGradient(0, roofTop, 0, roofBottom);
    g.addColorStop(0, shade(roof, -0.1)); g.addColorStop(0.35, shade(roof, 0.12)); g.addColorStop(1, shade(roof, -0.05));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(10, roofTop + 4);
    ctx.lineTo(w - 10, roofTop + 4);
    ctx.lineTo(w, roofBottom);
    ctx.lineTo(0, roofBottom);
    ctx.closePath();
    ctx.fill();
    // telhas
    ctx.strokeStyle = rgba(shade(roof, -0.4), 0.35); ctx.lineWidth = 1.5;
    for (let y = roofTop + 14; y < roofBottom - 4; y += 11) {
      ctx.beginPath(); ctx.moveTo(4, y); ctx.lineTo(w - 4, y); ctx.stroke();
      const off = ((y / 11) | 0) % 2 ? 8 : 0;
      for (let x = 8 + off; x < w - 6; x += 16) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 11); ctx.stroke(); }
    }
    // cumeeira e beiral
    ctx.fillStyle = shade(roof, -0.3);
    roundRect(ctx, 8, roofTop, w - 16, 8, 4); ctx.fill();
    ctx.fillStyle = shade(roof, -0.35);
    ctx.fillRect(0, roofBottom - 5, w, 7);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(4, roofBottom + 2, w - 8, 6);
    // chaminé nas casas
    if (homey) {
      ctx.fillStyle = '#9b5b45'; ctx.fillRect(w - 34, roofTop - 8, 14, 22);
      ctx.fillStyle = '#7a4434'; ctx.fillRect(w - 36, roofTop - 10, 18, 5);
    }
    if (b.type === 'gym') {
      ctx.fillStyle = opts.gymColor || '#e8c33a';
      ctx.fillRect(0, roofBottom - 26, w, 10);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(w / 2, roofTop + (roofBottom - roofTop) * 0.42, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = opts.gymColor || '#e8c33a';
      ctx.beginPath(); ctx.moveTo(w / 2, roofTop + (roofBottom - roofTop) * 0.42 - 13); ctx.lineTo(w / 2 + 12, roofTop + (roofBottom - roofTop) * 0.42 + 9); ctx.lineTo(w / 2 - 12, roofTop + (roofBottom - roofTop) * 0.42 + 9); ctx.closePath(); ctx.fill();
    }
    if (b.type === 'league') {
      ctx.fillStyle = '#f2c230'; ctx.fillRect(0, roofBottom - 18, w, 6);
      ctx.fillStyle = '#f2c230';
      ctx.beginPath(); ctx.moveTo(w / 2 - 30, roofTop + 30); ctx.lineTo(w / 2, roofTop - 6); ctx.lineTo(w / 2 + 30, roofTop + 30); ctx.closePath(); ctx.fill();
    }
    if (b.type === 'chateau') {
      for (const tx of [10, w - 40]) {
        ctx.fillStyle = '#7f7890'; ctx.fillRect(tx, roofTop - 10, 30, roofBottom - roofTop + 10);
        ctx.fillStyle = '#3d3a4f'; ctx.beginPath(); ctx.moveTo(tx - 4, roofTop - 8); ctx.lineTo(tx + 15, roofTop - 40); ctx.lineTo(tx + 34, roofTop - 8); ctx.closePath(); ctx.fill();
        windowShape(ctx, tx + 9, roofTop + 14, 12, 18, night, '#6b5e8a');
      }
    }
  }
  // ---- emblemas e placas
  if (b.type === 'center') pokeballEmblem(ctx, w / 2, roofTop + (roofBottom - roofTop) * 0.5, 16);
  const sign = opts.owner ? opts.owner : def.sign;
  if (b.type === 'center') signPlate(ctx, w / 2, wallTop + 4, 'POKÉMON CENTER', '#e3403b');
  else if (b.type === 'mart') signPlate(ctx, w / 2, wallTop + 4, 'POKÉ MART', '#3b78d8');
  else if (sign) signPlate(ctx, w / 2, wallTop + 3, sign, opts.owner ? '#5a4b3c' : shade(roof, -0.15));
  if (opts.forSale) {
    ctx.save(); ctx.translate(w / 2, roofTop + (roofBottom - roofTop) * 0.45); ctx.rotate(-0.08);
    signPlate(ctx, 0, -10, 'À VENDA', '#2f8a49');
    ctx.restore();
  }
}

const HOMEY = new Set(['momhouse', 'tradehouse', 'tutorhouse', 'deleterhouse']);

// Mansão do condomínio: deque com piscina à esquerda e casa moderna à direita.
function drawMansion(ctx, b, def, w, h, extra, opts) {
  const night = !!opts.night;
  const pw = def.pool * TS;
  const top = extra * TS + TS * 0.3, bottom = h - 6;
  ctx.fillStyle = '#e8dfcf'; roundRect(ctx, 2, top, pw + 8, bottom - top, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(120,100,70,0.16)'; ctx.lineWidth = 1;
  for (let y = top + 12; y < bottom; y += 12) { ctx.beginPath(); ctx.moveTo(4, y); ctx.lineTo(pw + 8, y); ctx.stroke(); }
  // piscina
  const px = 12, py = top + 14, pwid = pw - 20, ph = bottom - top - TS * 1.3;
  ctx.fillStyle = '#ffffff'; roundRect(ctx, px - 5, py - 5, pwid + 10, ph + 10, 10); ctx.fill();
  const g = ctx.createLinearGradient(0, py, 0, py + ph);
  g.addColorStop(0, night ? '#2f7fb0' : '#6fdaf6'); g.addColorStop(1, night ? '#1d5a8a' : '#2a9fd6');
  ctx.fillStyle = g; roundRect(ctx, px, py, pwid, ph, 8); ctx.fill();
  if (night) { ctx.fillStyle = 'rgba(150,230,255,0.35)'; ctx.beginPath(); ctx.ellipse(px + pwid / 2, py + ph / 2, pwid * 0.35, ph * 0.3, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
  for (let k = 0; k < 5; k++) {
    const yy = py + 14 + (k * (ph - 24)) / 5, xx = px + 8 + (k % 2) * 16;
    ctx.beginPath(); ctx.moveTo(xx, yy); ctx.quadraticCurveTo(xx + 9, yy - 4, xx + 18, yy); ctx.quadraticCurveTo(xx + 27, yy + 4, xx + 36, yy); ctx.stroke();
  }
  ctx.strokeStyle = '#c9ced6'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(px + pwid - 22, py - 8); ctx.lineTo(px + pwid - 22, py + 14); ctx.moveTo(px + pwid - 10, py - 8); ctx.lineTo(px + pwid - 10, py + 14); ctx.stroke();
  ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(px + 28, py + ph * 0.62, 10, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6; ctx.setLineDash([6, 9]); ctx.beginPath(); ctx.arc(px + 28, py + ph * 0.62, 10, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  // espreguiçadeiras e guarda-sol
  for (let k = 0; k < 2; k++) {
    const lx = 10 + k * 44, ly = bottom - TS * 0.88;
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(lx + 2, ly + 6, 36, 14);
    ctx.fillStyle = '#ffffff'; roundRect(ctx, lx, ly, 36, 14, 4); ctx.fill();
    ctx.fillStyle = '#3a68c9'; roundRect(ctx, lx + 2, ly + 2, 32, 10, 3); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(lx + 2, ly + 5, 32, 2);
  }
  {
    const ux = pw - 14, uy = bottom - TS * 0.95;
    ctx.fillStyle = '#6e6e6e'; ctx.fillRect(ux - 1, uy, 3, 22);
    for (let k = 0; k < 8; k++) {
      ctx.fillStyle = k % 2 ? '#ffffff' : '#e3403b';
      ctx.beginPath(); ctx.moveTo(ux, uy); ctx.arc(ux, uy, 18, (k * Math.PI) / 4, ((k + 1) * Math.PI) / 4); ctx.closePath(); ctx.fill();
    }
  }
  // cerca de vidro e vasos
  ctx.fillStyle = 'rgba(190,230,255,0.5)'; ctx.fillRect(2, bottom - 14, pw + 6, 10);
  ctx.fillStyle = '#b9c2cc'; for (let x = 2; x < pw + 8; x += 24) ctx.fillRect(x, bottom - 16, 3, 13);
  for (const vx of [6, pw - 4]) { ctx.fillStyle = '#f2f2ee'; ctx.fillRect(vx, top + 2, 14, 12); ctx.fillStyle = '#3f9a54'; ctx.beginPath(); ctx.arc(vx + 7, top, 9, 0, Math.PI * 2); ctx.fill(); }
  // casa moderna
  ctx.save();
  ctx.translate(pw, 0);
  drawBuilding(ctx, { type: 'mansion_house', w: b.w - def.pool, h: b.h }, { roof: def.roof, wall: def.wall }, w - pw, h, extra, opts);
  ctx.restore();
}

function drawLighthouse(ctx, w, h, night) {
  const cx = w / 2;
  const top = TS * 0.6, bottom = h - 8;
  const g = ctx.createLinearGradient(cx - 30, 0, cx + 30, 0);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d8d8d8');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(cx - 34, bottom); ctx.lineTo(cx - 22, top + 40); ctx.lineTo(cx + 22, top + 40); ctx.lineTo(cx + 34, bottom); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d9443c';
  for (let i = 0; i < 4; i++) {
    const y1 = top + 60 + i * 60, y2 = y1 + 28;
    const k1 = (y1 - top - 40) / (bottom - top - 40), k2 = (y2 - top - 40) / (bottom - top - 40);
    ctx.beginPath(); ctx.moveTo(cx - 22 - 12 * k1, y1); ctx.lineTo(cx + 22 + 12 * k1, y1); ctx.lineTo(cx + 22 + 12 * k2, y2); ctx.lineTo(cx - 22 - 12 * k2, y2); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#333'; ctx.fillRect(cx - 26, top + 34, 52, 8);
  ctx.fillStyle = night ? '#fff3a0' : '#bfe6ff'; ctx.fillRect(cx - 18, top + 6, 36, 28);
  ctx.fillStyle = '#d9443c'; ctx.beginPath(); ctx.moveTo(cx - 24, top + 8); ctx.lineTo(cx, top - 20); ctx.lineTo(cx + 24, top + 8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#6e4222'; roundRect(ctx, cx - 10, bottom - 34, 20, 30, 4); ctx.fill();
}

function drawTower(ctx, w, h, night) {
  const cx = w / 2;
  for (let i = 0; i < 4; i++) {
    const ww = w - 16 - i * 22, y = h - 8 - (i + 1) * TS * 1.6;
    ctx.fillStyle = shade('#bdb6c9', -i * 0.06);
    ctx.fillRect(cx - ww / 2, y, ww, TS * 1.6);
    ctx.fillStyle = '#5b4f73';
    ctx.beginPath(); ctx.moveTo(cx - ww / 2 - 8, y + 6); ctx.lineTo(cx + ww / 2 + 8, y + 6); ctx.lineTo(cx + ww / 2, y - 10); ctx.lineTo(cx - ww / 2, y - 10); ctx.closePath(); ctx.fill();
    for (let k = -1; k <= 1; k += 2) windowShape(ctx, cx + k * ww * 0.25 - 7, y + 22, 14, 22, night, '#7a6aa0');
  }
  ctx.fillStyle = '#5b4f73'; ctx.beginPath(); ctx.moveTo(cx - 20, h - 8 - 4 * TS * 1.6 - 6); ctx.lineTo(cx, h - 8 - 4 * TS * 1.6 - 50); ctx.lineTo(cx + 20, h - 8 - 4 * TS * 1.6 - 6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3a2f4a'; roundRect(ctx, cx - 12, h - 44, 24, 36, 10); ctx.fill();
}

function drawRuins(ctx, w, h) {
  ctx.fillStyle = '#b8a67f';
  ctx.fillRect(6, h - TS * 1.6, w - 12, TS * 1.6 - 6);
  ctx.strokeStyle = 'rgba(80,60,30,0.35)'; ctx.lineWidth = 1.5;
  for (let y = h - TS * 1.6 + 14; y < h - 8; y += 14) { ctx.beginPath(); ctx.moveTo(6, y); ctx.lineTo(w - 6, y); ctx.stroke(); }
  for (let i = 0; i < 4; i++) {
    const x = 12 + i * ((w - 40) / 3);
    const ph = TS * (1.8 + (i % 2) * 0.6);
    ctx.fillStyle = '#d4c49c'; ctx.fillRect(x, h - ph - TS * 0.8, 16, ph);
    ctx.fillStyle = '#9c8a6a'; ctx.fillRect(x - 4, h - ph - TS * 0.8, 24, 8);
  }
  ctx.fillStyle = '#3a2f22'; roundRect(ctx, w / 2 - 14, h - 50, 28, 44, 12); ctx.fill();
  ctx.fillStyle = '#9c8a6a';
  ctx.beginPath(); ctx.moveTo(10, h - TS * 1.6); ctx.lineTo(w / 2, h - TS * 2.6); ctx.lineTo(w - 10, h - TS * 1.6); ctx.closePath(); ctx.fill();
}

// ------------------------------------------------------------ objetos do mapa
export function lampSprite(on) {
  return cached('lamp' + (on ? 1 : 0), TS, TS * 2, (ctx, w, h) => {
    const cx = w / 2, by = h - 6;
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(cx + 2, by, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3d4250'; ctx.fillRect(cx - 3, by - TS * 1.5, 6, TS * 1.5);
    ctx.fillRect(cx - 7, by - 6, 14, 6);
    ctx.fillStyle = '#2e323d'; roundRect(ctx, cx - 10, by - TS * 1.75, 20, 22, 5); ctx.fill();
    ctx.fillStyle = on ? '#ffe58a' : '#dde6ee'; roundRect(ctx, cx - 7, by - TS * 1.72, 14, 15, 3); ctx.fill();
    ctx.fillStyle = '#2e323d'; ctx.beginPath(); ctx.moveTo(cx - 13, by - TS * 1.75); ctx.lineTo(cx, by - TS * 1.92); ctx.lineTo(cx + 13, by - TS * 1.75); ctx.closePath(); ctx.fill();
  });
}

export function signSprite() {
  return cached('sign', TS, TS * 1.1, (ctx, w, h) => {
    const cx = w / 2, by = h - 6;
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(cx + 2, by, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a4c27'; ctx.fillRect(cx - 3, by - 22, 6, 22);
    const g = ctx.createLinearGradient(0, by - 44, 0, by - 18);
    g.addColorStop(0, '#c98d55'); g.addColorStop(1, '#a56b38');
    ctx.fillStyle = g; roundRect(ctx, cx - 18, by - 44, 36, 26, 5); ctx.fill();
    ctx.strokeStyle = '#6e4222'; ctx.lineWidth = 2; roundRect(ctx, cx - 18, by - 44, 36, 26, 5); ctx.stroke();
    ctx.fillStyle = 'rgba(80,40,10,0.6)';
    ctx.fillRect(cx - 11, by - 37, 22, 2.5); ctx.fillRect(cx - 11, by - 31, 18, 2.5); ctx.fillRect(cx - 11, by - 25, 20, 2.5);
  });
}

export function itemBallSprite() {
  return cached('itemball', TS, TS, (ctx, w, h) => {
    const cx = w / 2, cy = h / 2 + 6;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(cx + 2, cy + 11, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
    pokeballSmall(ctx, cx, cy, 11);
  });
}

export function pokeballSmall(ctx, cx, cy, r, top = '#e3403b') {
  ctx.fillStyle = top;
  ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#f6f6f6';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI); ctx.fill();
  ctx.strokeStyle = '#262626'; ctx.lineWidth = Math.max(1.5, r * 0.16);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.32, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath(); ctx.ellipse(cx - r * 0.4, cy - r * 0.5, r * 0.25, r * 0.15, -0.6, 0, Math.PI * 2); ctx.fill();
}

// ------------------------------------------------------------ interiores: pisos e paredes
const BUILTIN_FLOORS = {
  centro: { a: '#f4f1ea', b: '#e8e2d5', style: 'tiles' },
  mart: { a: '#eef2f5', b: '#dfe6ec', style: 'tiles' },
  gym: { a: '#c9c3b6', b: '#b9b2a4', style: 'stone' },
  lab: { a: '#f4f6f8', b: '#e1e7ec', style: 'tiles' },
  pedra: { a: '#6c6372', b: '#5d5562', style: 'stone' },
};
const BUILTIN_WALLS = {
  centro: { a: '#fbe3df', b: '#f2cbc5', style: 'stripes' },
  mart: { a: '#dfeefd', b: '#c8def4', style: 'plain' },
  gym: { a: '#d9d2c3', b: '#c7bfae', style: 'brick' },
  lab: { a: '#eef3f6', b: '#dbe4ea', style: 'plain' },
  pedra: { a: '#4d4554', b: '#3e3745', style: 'brick' },
};

export function floorTile(style, x, y) {
  const f = FLOORS[style] || BUILTIN_FLOORS[style] || FLOORS.madeira;
  const variant = (x + y * 3) % 4;
  return cached(`floor:${style}:${f.style === 'checker' ? (x + y) % 2 : variant}`, TS, TS, (ctx) => {
    ctx.fillStyle = f.a; ctx.fillRect(0, 0, TS, TS);
    switch (f.style) {
      case 'planks':
        ctx.strokeStyle = f.b; ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(0, i * 16 + 15); ctx.lineTo(TS, i * 16 + 15); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo((variant * 13) % TS, 0); ctx.lineTo((variant * 13) % TS, 15); ctx.moveTo((variant * 29 + 20) % TS, 16); ctx.lineTo((variant * 29 + 20) % TS, 31); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(0, 2, TS, 4);
        break;
      case 'tiles':
        ctx.fillStyle = f.b; ctx.fillRect(TS / 2, 0, TS / 2, TS / 2); ctx.fillRect(0, TS / 2, TS / 2, TS / 2);
        ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, TS - 1, TS - 1);
        break;
      case 'checker':
        ctx.fillStyle = (x + y) % 2 ? f.b : f.a; ctx.fillRect(0, 0, TS, TS);
        break;
      case 'carpet':
        ctx.fillStyle = f.b;
        for (let i = 0; i < 12; i++) ctx.fillRect(((i * 17 + variant * 7) % TS), ((i * 23 + variant * 11) % TS), 2, 2);
        break;
      case 'grass':
        ctx.strokeStyle = f.b; ctx.lineWidth = 1.5;
        for (let i = 0; i < 6; i++) { const gx = (i * 19 + variant * 5) % TS, gy = (i * 13 + variant * 17) % TS; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + 2, gy - 5); ctx.stroke(); }
        break;
      case 'marble':
        ctx.strokeStyle = f.b; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(0, (variant * 9) % TS); ctx.quadraticCurveTo(TS / 2, TS / 2, TS, (variant * 21 + 10) % TS); ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,0.05)'; ctx.strokeRect(0.5, 0.5, TS - 1, TS - 1);
        break;
      case 'tatami':
        ctx.strokeStyle = f.b; ctx.lineWidth = 1;
        for (let i = 2; i < TS; i += 4) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(TS, i); ctx.stroke(); }
        ctx.fillStyle = '#4d6b3a'; if (variant % 2) ctx.fillRect(0, 0, 3, TS); else ctx.fillRect(0, 0, TS, 3);
        break;
      case 'stone':
        ctx.strokeStyle = f.b; ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, TS / 2 - 1, TS / 2 - 1); ctx.strokeRect(TS / 2, TS / 2, TS / 2 - 1, TS / 2 - 1);
        ctx.strokeRect(TS / 2, 1, TS / 2 - 1, TS / 2 - 1); ctx.strokeRect(1, TS / 2, TS / 2 - 1, TS / 2 - 1);
        break;
      default: break;
    }
  });
}

export function wallTile(style, x, row) {
  const f = WALLS[style] || BUILTIN_WALLS[style] || WALLS.creme;
  return cached(`wall:${style}:${row}:${x % 4}`, TS, TS, (ctx) => {
    ctx.fillStyle = f.a; ctx.fillRect(0, 0, TS, TS);
    switch (f.style) {
      case 'stripes': ctx.fillStyle = f.b; for (let i = 0; i < TS; i += 12) ctx.fillRect(i, 0, 6, TS); break;
      case 'dots': ctx.fillStyle = f.b; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(8 + (i % 2) * 24 + (row % 2) * 12, 10 + Math.floor(i / 2) * 24, 3, 0, Math.PI * 2); ctx.fill(); } break;
      case 'floral': ctx.fillStyle = f.b; for (let i = 0; i < 2; i++) { const fx = 12 + i * 24, fy = 14 + i * 18; for (let p = 0; p < 5; p++) { ctx.beginPath(); ctx.arc(fx + Math.cos(p * 1.26) * 4, fy + Math.sin(p * 1.26) * 4, 3, 0, Math.PI * 2); ctx.fill(); } } break;
      case 'brick': ctx.strokeStyle = f.b; ctx.lineWidth = 2; for (let r = 0; r < 4; r++) { ctx.beginPath(); ctx.moveTo(0, r * 12 + 12); ctx.lineTo(TS, r * 12 + 12); ctx.stroke(); const off = (r % 2) * 12; for (let c = off; c < TS; c += 24) { ctx.beginPath(); ctx.moveTo(c, r * 12); ctx.lineTo(c, r * 12 + 12); ctx.stroke(); } } break;
      case 'planks': ctx.strokeStyle = f.b; ctx.lineWidth = 2; for (let i = 0; i < TS; i += 12) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, TS); ctx.stroke(); } break;
      case 'stars': ctx.fillStyle = '#ffffff'; for (let i = 0; i < 5; i++) { ctx.globalAlpha = 0.5 + (i % 2) * 0.5; ctx.fillRect(((i * 17 + x * 7) % 44) + 2, ((i * 11 + row * 13) % 44) + 2, 2, 2); } ctx.globalAlpha = 1; break;
      case 'pokeball': if ((x + row) % 2 === 0) pokeballSmall(ctx, TS / 2, TS / 2, 10, f.b); break;
      default: break;
    }
    if (row === 0) { ctx.fillStyle = shade(f.a, -0.25); ctx.fillRect(0, 0, TS, 6); }
    if (row === 1) {
      ctx.fillStyle = shade(f.a, -0.3); ctx.fillRect(0, TS - 9, TS, 9);
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(0, TS - 9, TS, 2);
    }
  });
}

// ------------------------------------------------------------ objetos de interiores e móveis
// Retorna { canvas, ox, oy } onde ox/oy é o deslocamento do desenho em relação ao canto do footprint.
export function objectSprite(o, extra = {}) {
  const w = (o.w || 1), h = (o.h || 1);
  const def = o.kind === 'furniture' ? FURNITURE[o.item] : null;
  const art = def ? def.art : o.kind;
  const color = (def && def.color) || o.color || '#8a5a36';
  const tall = TALL_ART[art] || 0;
  const dollReady = def && def.species ? (imageNow(spriteUrl.frontStatic(def.species)) ? 1 : 0) : 1;
  // def.club entra na chave: vários times compartilham cores e padrão
  const key = `obj:${art}:${w}x${h}:${color}:${def && def.species ? def.species : ''}:${def && def.club ? def.club : ''}:${extra.night ? 1 : 0}:${dollReady}`;
  const canvas = cached(key, w * TS, (h + tall) * TS, (ctx, cw, ch) => {
    ctx.translate(0, tall * TS);
    drawObject(ctx, art, w * TS, h * TS, color, def, extra);
  });
  return { canvas, oy: -tall * TS };
}

const TALL_ART = {
  bookshelf: 1, cabinet: 0.6, wardrobe: 1, fridge: 0.8, lamp: 1, bigplant: 0.7, shelf: 0.6, healer: 0.5, pc: 0.4,
  machine: 0.8, gymStatue: 1, pillar: 1.2, generator: 0.5, mirror: 0.6, rack: 0.5, piano: 0.4, fireplace: 0.7,
  board: 0.4, statue: 0.6, trophy: 0.3, fountain: 0.5, arcade: 0.7, icecream: 0.5, aquarium: 0.4, grave: 0.3, oldfurniture: 0.6, doll: 0.3, wardrobeTalk: 1,
  // móveis novos
  crt: 0.4, tvwide: 0.8, console2: 0.3, pcgamer: 0.8, gamerchair: 0.6, laptop: 0.15, speaker: 0.7, radio: 0.35,
  microwave: 0.45, coffeemaker: 0.4, dishwasher: 0.1, toilet: 0.3, shower: 1, bathsink: 1, washer: 0.3,
  bunkbed: 1, vanity: 1, dresser: 0.6, coatrack: 1, hammock: 0.4, trophycase: 1, foosball: 0.25, goal: 1,
  treadmill: 0.6, punchbag: 1.2, bonsai: 0.4, cactuspot: 0.35, fan: 0.8, lavalamp: 0.4, globe: 0.4, fishbowl: 0.3,
  pokehouse: 0.5, pokelamp: 0.5,
};

// ------------------------------------------------------------ ajudantes dos móveis
function lumOf(hex) { const [r, g, b] = hexToRgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }

function glowAt(ctx, x, y, r, col, a = 0.5) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

function starPath(ctx, cx, cy, r, inner = 0.45) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * inner : r;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
}

// Pinta o padrão das cores do clube no retângulo (quem chama faz o clip da forma).
function clubPattern(ctx, def, x, y, w, h, sw = 8) {
  const cs = def.colors && def.colors.length ? def.colors : [def.color || '#888888'];
  const [a, b = a, c = b] = cs;
  ctx.fillStyle = a; ctx.fillRect(x, y, w, h);
  switch (def.pattern) {
    case 'vstripes': {
      const c0 = x + w / 2 - sw / 2;
      ctx.fillStyle = b;
      for (let i = c0 - Math.ceil((c0 - x) / (2 * sw)) * 2 * sw; i < x + w; i += 2 * sw) ctx.fillRect(i, y, sw, h);
      break;
    }
    case 'vstripes3': {
      const k0 = Math.ceil((w / 2) / sw) + 1;
      for (let k = 0; k <= k0 * 2; k++) { ctx.fillStyle = cs[(((k - k0) % 3) + 3) % 3]; ctx.fillRect(x + w / 2 - sw / 2 + (k - k0) * sw, y, sw, h); }
      break;
    }
    case 'hstripes': ctx.fillStyle = b; for (let j = y + sw; j < y + h; j += 2 * sw) ctx.fillRect(x, j, w, sw); break;
    case 'hstripes3': for (let j = y, k = 0; j < y + h; j += sw, k++) { ctx.fillStyle = cs[k % 3]; ctx.fillRect(x, j, w, sw); } break;
    case 'sash': {
      ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(Math.atan2(h, w));
      const L = Math.hypot(w, h), bw = Math.min(w, h) * 0.28;
      ctx.fillStyle = b; ctx.fillRect(-L / 2 - 2, -bw / 2, L + 4, bw);
      ctx.restore();
      break;
    }
    case 'chestbands': ctx.fillStyle = b; ctx.fillRect(x, y + h * 0.36, w, h * 0.13); ctx.fillStyle = c; ctx.fillRect(x, y + h * 0.49, w, h * 0.13); break;
    default: break;
  }
}

function clubHash(id) { let v = 19; for (const ch of String(id || '')) v = (v * 31 + ch.charCodeAt(0)) % 9973; return v; }

// Escudo GENÉRICO do clube: forma simples de escudo com estrela/faixa nas cores dele
// (nunca um logotipo real). A variação de forma/detalhe vem do id, para clubes de
// mesmas cores não ficarem iguais.
function clubCrest(ctx, def, cx, cy, s, starAbove = true) {
  const [bg, dt] = def.crest || ['#f4f4f4', (def.colors || ['#888888'])[0]];
  const v = clubHash(def.club), shape = v % 3, det = Math.floor(v / 3) % 4;
  const hw = s / 2, top = cy - s * 0.58, bot = cy + s * 0.62;
  const path = () => {
    ctx.beginPath();
    if (shape === 1) {
      ctx.moveTo(cx - hw, top + s * 0.1); ctx.lineTo(cx - hw * 0.45, top); ctx.lineTo(cx, top + s * 0.1); ctx.lineTo(cx + hw * 0.45, top); ctx.lineTo(cx + hw, top + s * 0.1);
    } else { ctx.moveTo(cx - hw, top); ctx.lineTo(cx + hw, top); }
    if (shape === 2) { ctx.lineTo(cx + hw, cy + s * 0.12); ctx.arc(cx, cy + s * 0.12, hw, 0, Math.PI); }
    else { ctx.lineTo(cx + hw, cy + s * 0.05); ctx.quadraticCurveTo(cx + hw, bot - s * 0.22, cx, bot); ctx.quadraticCurveTo(cx - hw, bot - s * 0.22, cx - hw, cy + s * 0.05); }
    ctx.closePath();
  };
  const ol = lumOf(bg) > 0.55 ? '#26252c' : '#f4f4f4';
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.translate(s * 0.05, s * 0.08); path(); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill(); ctx.translate(-s * 0.05, -s * 0.08);
  path(); ctx.strokeStyle = ol; ctx.lineWidth = Math.max(1.4, s * 0.13); ctx.stroke();
  ctx.fillStyle = bg; ctx.fill();
  ctx.clip();
  ctx.fillStyle = dt;
  if (det === 0) { starPath(ctx, cx, cy + s * 0.04, s * 0.32); ctx.fill(); }
  else if (det === 1) ctx.fillRect(cx - s * 0.13, top - 1, s * 0.26, s * 1.4);
  else if (det === 2) { ctx.save(); ctx.translate(cx, cy); ctx.rotate(0.75); ctx.fillRect(-s, -s * 0.14, s * 2, s * 0.28); ctx.restore(); }
  else { ctx.fillRect(cx - hw, top - 1, s, s * 0.4); starPath(ctx, cx, cy + s * 0.22, s * 0.22); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(cx - hw, top - 1, hw, s * 1.4);
  ctx.restore();
  if (starAbove) {
    starPath(ctx, cx, top - s * 0.2, s * 0.17);
    ctx.fillStyle = '#f2c230'; ctx.fill(); ctx.strokeStyle = '#b8861c'; ctx.lineWidth = 0.8; ctx.stroke();
  }
}

// Pelúcia: sprite recortado com uma borda clara (costura) e volume suave.
const imgBounds = new WeakMap();
function trimBounds(img) {
  let b = imgBounds.get(img);
  if (b) return b;
  b = [0, 0, img.width, img.height];
  try {
    const c = makeCanvas(img.width, img.height), x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++) for (let xx = 0; xx < c.width; xx++) {
      if (d[(y * c.width + xx) * 4 + 3] > 20) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 >= 0) b = [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
  } catch (e) { /* imagem sem CORS: usa o quadro todo */ }
  imgBounds.set(img, b);
  return b;
}

function drawPlush(ctx, img, cx, by, maxW, maxH, maxS) {
  const [sx, sy, sw, sh] = trimBounds(img);
  const s = Math.min(maxW / sw, maxH / sh, maxS);
  const dw = sw * s, dh = sh * s, o = Math.max(1.3, s * 1.2), pad = o + 1;
  const W = dw + pad * 2, H = dh + pad * 2;
  const off = makeCanvas(W * PR, H * PR), oc = off.getContext('2d');
  oc.scale(PR, PR);
  oc.imageSmoothingEnabled = s < 1.5;
  for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; oc.drawImage(img, sx, sy, sw, sh, pad + Math.cos(a) * o, pad + Math.sin(a) * o, dw, dh); }
  oc.globalCompositeOperation = 'source-in'; oc.fillStyle = '#fff8ee'; oc.fillRect(0, 0, W, H);
  oc.globalCompositeOperation = 'source-over';
  oc.drawImage(img, sx, sy, sw, sh, pad, pad, dw, dh);
  oc.globalCompositeOperation = 'source-atop';
  const g = oc.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(255,255,255,0.16)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(70,40,50,0.16)');
  oc.fillStyle = g; oc.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(cx + 1, by - 1, Math.max(8, dw * 0.42), Math.max(3, dw * 0.1), 0, 0, Math.PI * 2); ctx.fill();
  ctx.drawImage(off, cx - W / 2, by - H + pad * 0.6, W, H);
}

function drawObject(ctx, art, w, h, color, def, extra) {
  const shadow = (x = 4, y = h - 8, ww = w - 8, hh = 8) => { ctx.fillStyle = 'rgba(0,0,0,0.18)'; roundRect(ctx, x, y, ww, hh, 4); ctx.fill(); };
  const wood = '#a8713f', woodD = '#7c4f28', woodL = '#c99460';
  switch (art) {
    case 'bed': case 'bed2': {
      shadow();
      ctx.fillStyle = woodD; roundRect(ctx, 3, 2, w - 6, h - 6, 6); ctx.fill();
      ctx.fillStyle = '#ffffff'; roundRect(ctx, 7, 6, w - 14, h - 16, 5); ctx.fill();
      ctx.fillStyle = color; roundRect(ctx, 7, h * 0.38, w - 14, h * 0.62 - 10, 5); ctx.fill();
      ctx.fillStyle = shade(color, -0.15); ctx.fillRect(7, h * 0.38, w - 14, 5);
      ctx.fillStyle = '#f4f4f8';
      const pills = art === 'bed2' ? 2 : 1;
      for (let i = 0; i < pills; i++) { roundRect(ctx, 10 + i * (w - 20) / pills, 10, (w - 20) / pills - 4, h * 0.2, 6); ctx.fill(); }
      break;
    }
    case 'pokebed': {
      shadow();
      ctx.fillStyle = woodD; roundRect(ctx, 3, 2, w - 6, h - 6, 10); ctx.fill();
      pokeballSmall(ctx, w / 2, h / 2 + 4, Math.min(w, h) / 2 - 10);
      break;
    }
    case 'table': case 'desk': case 'coffeetable': case 'nightstand': {
      shadow();
      const top = art === 'coffeetable' ? h * 0.35 : h * 0.15;
      ctx.fillStyle = woodD; ctx.fillRect(8, top + 14, 5, h - top - 18); ctx.fillRect(w - 13, top + 14, 5, h - top - 18);
      const g = ctx.createLinearGradient(0, top, 0, top + 20);
      g.addColorStop(0, woodL); g.addColorStop(1, wood);
      ctx.fillStyle = g; roundRect(ctx, 3, top, w - 6, 20, 4); ctx.fill();
      ctx.fillStyle = woodD; ctx.fillRect(3, top + 16, w - 6, 5);
      if (art === 'desk') { ctx.fillStyle = '#f4f4f4'; ctx.fillRect(w - 30, top + 3, 16, 10); ctx.fillStyle = '#3a68c9'; ctx.fillRect(10, top + 4, 12, 3); }
      if (art === 'nightstand') { ctx.fillStyle = woodL; ctx.fillRect(10, top + 24, w - 20, 8); ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(w / 2, top + 28, 2, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case 'roundtable': {
      shadow(6, h - 12, w - 12, 10);
      ctx.fillStyle = woodD; ctx.fillRect(w / 2 - 4, h / 2, 8, h / 2 - 10);
      const g = ctx.createRadialGradient(w / 2 - 10, h / 2 - 12, 4, w / 2, h / 2, w / 2);
      g.addColorStop(0, woodL); g.addColorStop(1, wood);
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(w / 2, h / 2 - 4, w / 2 - 6, h / 2 - 14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(w / 2, h / 2 - 8, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'chair': case 'stool': {
      shadow(10, h - 8, w - 20, 6);
      ctx.fillStyle = woodD; ctx.fillRect(13, 22, 4, h - 26); ctx.fillRect(w - 17, 22, 4, h - 26);
      if (art === 'chair') { ctx.fillStyle = shade(color, -0.1); roundRect(ctx, 11, 2, w - 22, 22, 4); ctx.fill(); }
      ctx.fillStyle = color; roundRect(ctx, 9, 20, w - 18, 12, 4); ctx.fill();
      break;
    }
    case 'armchair': case 'sofa': {
      shadow();
      ctx.fillStyle = shade(color, -0.2); roundRect(ctx, 3, 4, w - 6, h - 10, 10); ctx.fill();
      ctx.fillStyle = color; roundRect(ctx, 7, 16, w - 14, h - 24, 8); ctx.fill();
      ctx.fillStyle = shade(color, 0.12); roundRect(ctx, 8, 8, w - 16, 12, 6); ctx.fill();
      ctx.fillStyle = shade(color, -0.12); roundRect(ctx, 3, 14, 9, h - 20, 5); ctx.fill(); roundRect(ctx, w - 12, 14, 9, h - 20, 5); ctx.fill();
      if (art === 'sofa') { ctx.strokeStyle = shade(color, -0.25); ctx.lineWidth = 1.5; for (let i = 1; i < w / TS; i++) { ctx.beginPath(); ctx.moveTo(i * TS, 20); ctx.lineTo(i * TS, h - 12); ctx.stroke(); } }
      break;
    }
    case 'bookshelf': case 'shelf': {
      shadow();
      ctx.fillStyle = art === 'shelf' ? '#c9ccd2' : woodD; ctx.fillRect(3, -TS * (art === 'shelf' ? 0.6 : 1) + 4, w - 6, h + TS * (art === 'shelf' ? 0.6 : 1) - 10);
      const rows = art === 'shelf' ? 2 : 3;
      const top = -TS * (art === 'shelf' ? 0.6 : 1) + 8;
      const rh = (h + TS * (art === 'shelf' ? 0.6 : 1) - 18) / rows;
      const cols = ['#e3403b', '#3a68c9', '#45b864', '#f2c230', '#7b52c2', '#ee8a33', '#f4f4f4'];
      for (let r = 0; r < rows; r++) {
        ctx.fillStyle = art === 'shelf' ? '#e8eaee' : wood; ctx.fillRect(7, top + r * rh, w - 14, rh - 4);
        for (let x = 9, k = 0; x < w - 12; k++) {
          const bw = art === 'shelf' ? 9 : 4 + ((k * 7 + r * 3) % 4);
          ctx.fillStyle = cols[(k * 3 + r * 5) % cols.length];
          if (art === 'shelf') { roundRect(ctx, x, top + r * rh + rh - 16, bw, 11, 2); ctx.fill(); }
          else ctx.fillRect(x, top + r * rh + 3 + (k % 3), bw, rh - 8 - (k % 3));
          x += bw + 1;
        }
      }
      break;
    }
    case 'cabinet': case 'wardrobe': case 'wardrobeTalk': {
      shadow();
      const up = art === 'cabinet' ? TS * 0.6 : TS;
      const g = ctx.createLinearGradient(0, -up, 0, h);
      g.addColorStop(0, woodL); g.addColorStop(1, wood);
      ctx.fillStyle = g; roundRect(ctx, 3, -up + 4, w - 6, h + up - 10, 4); ctx.fill();
      ctx.strokeStyle = woodD; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(w / 2, -up + 8); ctx.lineTo(w / 2, h - 10); ctx.stroke();
      ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(w / 2 - 6, h / 2 - up / 2, 2.5, 0, Math.PI * 2); ctx.arc(w / 2 + 6, h / 2 - up / 2, 2.5, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'fridge': {
      shadow();
      ctx.fillStyle = '#e9edf1'; roundRect(ctx, 5, -TS * 0.8 + 4, w - 10, h + TS * 0.8 - 10, 6); ctx.fill();
      ctx.strokeStyle = '#b9c2cb'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(5, 4); ctx.lineTo(w - 5, 4); ctx.stroke();
      ctx.fillStyle = '#9aa5b1'; ctx.fillRect(w - 14, -TS * 0.6, 3, 16); ctx.fillRect(w - 14, 12, 3, 14);
      break;
    }
    case 'stove': case 'sink': case 'counter': {
      shadow();
      ctx.fillStyle = art === 'stove' ? '#dfe3e8' : '#ece4d6'; roundRect(ctx, 3, 4, w - 6, h - 10, 4); ctx.fill();
      ctx.fillStyle = art === 'stove' ? '#3a3f4a' : '#b7c4cf';
      if (art === 'stove') { for (const [a, b] of [[14, 14], [34, 14]]) { ctx.beginPath(); ctx.arc(a, b, 6, 0, Math.PI * 2); ctx.fill(); } }
      if (art === 'sink') { roundRect(ctx, 10, 8, w - 20, 16, 5); ctx.fill(); ctx.fillStyle = '#9aa5b1'; ctx.fillRect(w / 2 - 2, 2, 4, 8); }
      ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(3, h - 18, w - 6, 3);
      break;
    }
    case 'tv': {
      shadow();
      ctx.fillStyle = woodD; ctx.fillRect(4, h - 16, w - 8, 10);
      ctx.fillStyle = '#20232b'; roundRect(ctx, 6, 2, w - 12, h - 18, 4); ctx.fill();
      const g = ctx.createLinearGradient(0, 6, 0, h - 20);
      g.addColorStop(0, '#5aa7e8'); g.addColorStop(1, '#2d5f9e');
      ctx.fillStyle = g; ctx.fillRect(10, 6, w - 20, h - 26);
      pokeballSmall(ctx, w / 2, h / 2 - 6, 6);
      break;
    }
    case 'pc': case 'console': case 'stereo': {
      shadow();
      if (art === 'pc') {
        ctx.fillStyle = '#d9dde3'; roundRect(ctx, 6, -TS * 0.4 + 4, w - 12, h * 0.75 + TS * 0.4 - 4, 4); ctx.fill();
        ctx.fillStyle = '#2d5f9e'; ctx.fillRect(10, -TS * 0.4 + 8, w - 20, h * 0.5);
        ctx.fillStyle = '#7fd0ff'; ctx.fillRect(12, -TS * 0.4 + 10, w - 24, 4);
        ctx.fillStyle = '#b9c2cb'; ctx.fillRect(8, h - 14, w - 16, 6);
      } else if (art === 'console') {
        ctx.fillStyle = '#3a3f4a'; roundRect(ctx, 8, h / 2 - 6, w - 16, 18, 4); ctx.fill();
        ctx.fillStyle = '#e3403b'; ctx.beginPath(); ctx.arc(w / 2 - 6, h / 2 + 3, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3a68c9'; ctx.beginPath(); ctx.arc(w / 2 + 6, h / 2 + 3, 3, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = '#2b2e36'; roundRect(ctx, 6, 6, w - 12, h - 14, 4); ctx.fill();
        ctx.fillStyle = '#5a5f6b'; ctx.beginPath(); ctx.arc(w / 2, h / 2 - 2, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2b2e36'; ctx.beginPath(); ctx.arc(w / 2, h / 2 - 2, 4, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'plant': case 'bigplant': case 'flowers': {
      const big = art === 'bigplant';
      shadow(12, h - 8, w - 24, 6);
      ctx.fillStyle = '#b8643a'; ctx.beginPath(); ctx.moveTo(14, h - 22); ctx.lineTo(w - 14, h - 22); ctx.lineTo(w - 17, h - 6); ctx.lineTo(17, h - 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#9a4f2c'; ctx.fillRect(12, h - 24, w - 24, 5);
      if (art === 'flowers') {
        ctx.fillStyle = '#4f9f45'; ctx.beginPath(); ctx.arc(w / 2, h - 28, 12, 0, Math.PI * 2); ctx.fill();
        for (let i = 0; i < 5; i++) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(w / 2 + Math.cos(i * 1.26) * 9, h - 30 + Math.sin(i * 1.26) * 7, 4.5, 0, Math.PI * 2); ctx.fill(); }
      } else {
        const leaves = big ? 9 : 6;
        for (let i = 0; i < leaves; i++) {
          const a = -Math.PI / 2 + (i - (leaves - 1) / 2) * 0.38;
          const len = big ? 40 + (i % 2) * 10 : 18 + (i % 2) * 6;
          ctx.fillStyle = i % 2 ? '#3f9a47' : '#5cb85a';
          ctx.beginPath(); ctx.ellipse(w / 2 + Math.cos(a) * len * 0.5, h - 24 + Math.sin(a) * len * 0.6, len * 0.22, len * 0.5, a + Math.PI / 2, 0, Math.PI * 2); ctx.fill();
        }
      }
      break;
    }
    case 'aquarium': {
      shadow();
      ctx.fillStyle = woodD; ctx.fillRect(4, h - 16, w - 8, 10);
      const g = ctx.createLinearGradient(0, -TS * 0.4, 0, h - 16);
      g.addColorStop(0, '#9fe0ff'); g.addColorStop(1, '#3a8fd0');
      ctx.fillStyle = g; roundRect(ctx, 6, -TS * 0.4 + 4, w - 12, h + TS * 0.4 - 22, 4); ctx.fill();
      ctx.fillStyle = '#f08a2c'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(18 + i * 26, 10 + (i % 2) * 10, 6, 3.5, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#3f9a47'; ctx.fillRect(12, h - 30, 4, 12); ctx.fillRect(w - 20, h - 34, 4, 16);
      break;
    }
    case 'piano': {
      shadow();
      ctx.fillStyle = '#1f2026'; roundRect(ctx, 3, -TS * 0.4 + 4, w - 6, h + TS * 0.4 - 12, 5); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(8, h - 24, w - 16, 10);
      ctx.fillStyle = '#1f2026'; for (let x = 12; x < w - 10; x += 7) ctx.fillRect(x, h - 24, 3, 6);
      break;
    }
    case 'fireplace': {
      shadow();
      ctx.fillStyle = '#b06a4b'; roundRect(ctx, 3, -TS * 0.7 + 4, w - 6, h + TS * 0.7 - 10, 4); ctx.fill();
      ctx.fillStyle = '#2b1a14'; roundRect(ctx, 14, h - 34, w - 28, 26, 10); ctx.fill();
      const g = ctx.createRadialGradient(w / 2, h - 14, 2, w / 2, h - 18, 18);
      g.addColorStop(0, '#fff3a0'); g.addColorStop(0.5, '#ff9a2b'); g.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(w / 2, h - 16, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8a4a32'; ctx.fillRect(0, -TS * 0.7 + 2, w, 8);
      break;
    }
    case 'lamp': case 'smalllamp': {
      const tall2 = art === 'lamp';
      shadow(14, h - 8, w - 28, 6);
      ctx.fillStyle = '#5a5f6b'; ctx.fillRect(w / 2 - 2, tall2 ? -TS * 0.7 : h - 26, 4, tall2 ? h + TS * 0.7 - 10 : 18);
      ctx.fillStyle = '#5a5f6b'; ctx.fillRect(w / 2 - 8, h - 10, 16, 4);
      const ty = tall2 ? -TS * 0.95 : h - 40;
      ctx.fillStyle = extra.night ? '#fff0a8' : '#f3e2c0';
      ctx.beginPath(); ctx.moveTo(w / 2 - 14, ty + 18); ctx.lineTo(w / 2 + 14, ty + 18); ctx.lineTo(w / 2 + 8, ty); ctx.lineTo(w / 2 - 8, ty); ctx.closePath(); ctx.fill();
      break;
    }
    case 'statue': case 'trophy': {
      shadow(10, h - 8, w - 20, 6);
      ctx.fillStyle = '#9aa1ab'; ctx.fillRect(10, h - 18, w - 20, 12);
      if (art === 'statue') pokeballSmall(ctx, w / 2, h - 34, 13, def && def.color ? def.color : '#c9d0d8');
      else {
        ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.moveTo(w / 2 - 12, h - 44); ctx.lineTo(w / 2 + 12, h - 44); ctx.quadraticCurveTo(w / 2 + 10, h - 24, w / 2, h - 22); ctx.quadraticCurveTo(w / 2 - 10, h - 24, w / 2 - 12, h - 44); ctx.fill();
        ctx.fillRect(w / 2 - 3, h - 24, 6, 6);
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(w / 2 - 7, h - 42, 3, 12);
      }
      break;
    }
    case 'clock': case 'painting': case 'poster': case 'window': {
      const y0 = 8;
      if (art === 'clock') {
        ctx.fillStyle = woodD; ctx.beginPath(); ctx.arc(w / 2, y0 + 14, 14, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(w / 2, y0 + 14, 11, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w / 2, y0 + 14); ctx.lineTo(w / 2, y0 + 6); ctx.moveTo(w / 2, y0 + 14); ctx.lineTo(w / 2 + 6, y0 + 16); ctx.stroke();
      } else if (art === 'window') {
        windowShape(ctx, 8, y0, w - 16, 30, extra.night, '#9fd8ff');
      } else {
        ctx.fillStyle = art === 'painting' ? '#b8862f' : '#ffffff'; ctx.fillRect(6, y0, w - 12, 32);
        if (art === 'painting') {
          ctx.fillStyle = '#9fd8ff'; ctx.fillRect(9, y0 + 3, w - 18, 26);
          ctx.fillStyle = '#5cb85a'; ctx.beginPath(); ctx.moveTo(9, y0 + 29); ctx.lineTo(20, y0 + 14); ctx.lineTo(30, y0 + 22); ctx.lineTo(w - 9, y0 + 10); ctx.lineTo(w - 9, y0 + 29); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(w - 16, y0 + 9, 3, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.fillStyle = color; ctx.fillRect(9, y0 + 3, w - 18, 26);
          ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.moveTo(w / 2 - 4, y0 + 6); ctx.lineTo(w / 2 + 6, y0 + 6); ctx.lineTo(w / 2, y0 + 16); ctx.lineTo(w / 2 + 6, y0 + 16); ctx.lineTo(w / 2 - 6, y0 + 27); ctx.lineTo(w / 2 - 1, y0 + 17); ctx.lineTo(w / 2 - 6, y0 + 17); ctx.closePath(); ctx.fill();
        }
      }
      break;
    }
    case 'rug': case 'roundrug': case 'pokerug': {
      if (art === 'pokerug') { pokeballSmall(ctx, w / 2, h / 2, Math.min(w, h) / 2 - 6); ctx.globalAlpha = 1; break; }
      ctx.fillStyle = color;
      if (art === 'roundrug') { ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w / 2 - 4, h / 2 - 4, 0, 0, Math.PI * 2); ctx.fill(); }
      else { roundRect(ctx, 4, 4, w - 8, h - 8, 6); ctx.fill(); }
      ctx.strokeStyle = shade(color, 0.35); ctx.lineWidth = 3;
      if (art === 'roundrug') { ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w / 2 - 12, h / 2 - 12, 0, 0, Math.PI * 2); ctx.stroke(); }
      else { roundRect(ctx, 12, 12, w - 24, h - 24, 4); ctx.stroke(); }
      break;
    }
    case 'doll': {
      const big = w > TS;
      const img = def ? imageNow(spriteUrl.frontStatic(def.species)) : null;
      if (img) {
        drawPlush(ctx, img, w / 2, h - 6, w - 6, h + TS * 0.3 - 10, big ? 2.4 : 1.2);
      } else {
        // enquanto o sprite não chega: uma pelúcia de Poké Bola
        const r = Math.min(w, h) * 0.27;
        ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(w / 2 + 1, h - 7, r * 1.1, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff8ee'; ctx.beginPath(); ctx.arc(w / 2, h - 8 - r, r + 2, 0, Math.PI * 2); ctx.fill();
        pokeballSmall(ctx, w / 2, h - 8 - r, r);
      }
      break;
    }
    // ================================================================ eletrônicos e games
    case 'crt': {
      shadow(5, h - 9, w - 10, 7);
      ctx.fillStyle = woodD; ctx.fillRect(8, h - 14, 4, 7); ctx.fillRect(w - 12, h - 14, 4, 7);
      ctx.fillStyle = wood; roundRect(ctx, 4, h - 19, w - 8, 7, 2); ctx.fill();
      ctx.fillStyle = woodL; ctx.fillRect(6, h - 19, w - 12, 2);
      // antena
      ctx.strokeStyle = '#8b8f99'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(w / 2, -1); ctx.lineTo(w / 2 - 12, -16); ctx.moveTo(w / 2, -1); ctx.lineTo(w / 2 + 10, -18); ctx.stroke();
      ctx.fillStyle = '#5a5f6b';
      ctx.beginPath(); ctx.arc(w / 2 - 12, -16, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(w / 2 + 10, -18, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w / 2, 1, 6, 4, 0, Math.PI, 0); ctx.fill();
      // gabinete
      const g = ctx.createLinearGradient(0, 0, 0, h - 19);
      g.addColorStop(0, '#9a8a78'); g.addColorStop(1, '#6e6155');
      ctx.fillStyle = g; roundRect(ctx, 5, 0, w - 10, h - 19, 5); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(9, 1.5, w - 18, 2);
      // tela abaulada
      ctx.fillStyle = '#2a2a2e'; roundRect(ctx, 8, 4, 26, h - 26, 6); ctx.fill();
      const sg = ctx.createRadialGradient(19, 11, 2, 21, 14, 16);
      sg.addColorStop(0, '#a6e1f2'); sg.addColorStop(1, '#3b6f95');
      ctx.fillStyle = sg; roundRect(ctx, 10, 6, 22, h - 30, 5); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = 7; y < h - 24; y += 3) ctx.fillRect(10, y, 22, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.ellipse(16, 10, 4.5, 2.2, -0.5, 0, Math.PI * 2); ctx.fill();
      // painel
      for (const ky of [9, 17]) {
        ctx.fillStyle = '#e2d8c6'; ctx.beginPath(); ctx.arc(w - 10.5, ky, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#4a4038'; ctx.fillRect(w - 11, ky - 3, 1, 3);
      }
      ctx.fillStyle = '#4a4038'; for (let y = 22; y < h - 21; y += 2) ctx.fillRect(w - 14, y, 7, 1);
      break;
    }
    case 'tvwide': {
      shadow();
      const g = ctx.createLinearGradient(0, h - 22, 0, h - 6);
      g.addColorStop(0, woodL); g.addColorStop(1, wood);
      ctx.fillStyle = g; roundRect(ctx, 4, h - 22, w - 8, 16, 3); ctx.fill();
      ctx.fillStyle = woodD; ctx.fillRect(4, h - 9, w - 8, 3);
      ctx.strokeStyle = woodD; ctx.lineWidth = 1.5;
      for (let i = 1; i < 3; i++) { const x = 4 + (w - 8) * i / 3; ctx.beginPath(); ctx.moveTo(x, h - 18); ctx.lineTo(x, h - 9); ctx.stroke(); }
      ctx.fillStyle = '#e8d4a8'; for (let i = 0; i < 3; i++) ctx.fillRect(4 + (w - 8) * (i + 0.5) / 3 - 5, h - 14, 10, 2);
      // pé
      ctx.fillStyle = '#2a2b31'; ctx.fillRect(w / 2 - 3, h - 31, 6, 9); roundRect(ctx, w / 2 - 16, h - 25, 32, 3, 1.5); ctx.fill();
      // tela de borda fina
      const top = -TS * 0.8 + 2, bot = h - 30;
      ctx.fillStyle = '#16171c'; roundRect(ctx, 6, top, w - 12, bot - top, 3); ctx.fill();
      const sx = 8, sy = top + 2, sw2 = w - 16, sh2 = bot - top - 5;
      const sky = ctx.createLinearGradient(0, sy, 0, sy + sh2);
      sky.addColorStop(0, '#3fa0f0'); sky.addColorStop(0.6, '#a9d8ff'); sky.addColorStop(1, '#ffe2a8');
      ctx.fillStyle = sky; ctx.fillRect(sx, sy, sw2, sh2);
      ctx.save(); ctx.beginPath(); ctx.rect(sx, sy, sw2, sh2); ctx.clip();
      glowAt(ctx, sx + sw2 * 0.78, sy + sh2 * 0.34, 16, '#fff6c8', 0.8);
      ctx.fillStyle = '#fff6c8'; ctx.beginPath(); ctx.arc(sx + sw2 * 0.78, sy + sh2 * 0.34, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      for (const [cx2, cy2] of [[0.2, 0.22], [0.48, 0.14]]) { ctx.beginPath(); ctx.ellipse(sx + sw2 * cx2, sy + sh2 * cy2, 9, 3, 0, 0, Math.PI * 2); ctx.ellipse(sx + sw2 * cx2 + 5, sy + sh2 * cy2 - 2, 5, 3, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#6fbf6a'; ctx.beginPath(); ctx.moveTo(sx, sy + sh2); ctx.lineTo(sx, sy + sh2 * 0.62); ctx.quadraticCurveTo(sx + sw2 * 0.25, sy + sh2 * 0.4, sx + sw2 * 0.5, sy + sh2 * 0.72); ctx.quadraticCurveTo(sx + sw2 * 0.75, sy + sh2 * 0.48, sx + sw2, sy + sh2 * 0.7); ctx.lineTo(sx + sw2, sy + sh2); ctx.fill();
      ctx.fillStyle = '#3f8f4f'; ctx.beginPath(); ctx.moveTo(sx, sy + sh2); ctx.quadraticCurveTo(sx + sw2 * 0.45, sy + sh2 * 0.66, sx + sw2, sy + sh2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.beginPath(); ctx.moveTo(sx + sw2 * 0.08, sy); ctx.lineTo(sx + sw2 * 0.24, sy); ctx.lineTo(sx + sw2 * 0.1, sy + sh2); ctx.lineTo(sx - sw2 * 0.06, sy + sh2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ff5a4d'; ctx.fillRect(w - 14, bot - 2, 2, 1);
      // soundbar
      ctx.fillStyle = '#2a2b31'; roundRect(ctx, w / 2 - 30, h - 27, 60, 5, 2.5); ctx.fill();
      ctx.fillStyle = '#4a4e58'; ctx.fillRect(w / 2 - 27, h - 26, 54, 1);
      break;
    }
    case 'console2': {
      shadow(5, h - 9, w - 10, 7);
      // console em pé (laterais brancas, miolo preto)
      ctx.fillStyle = '#1d1e24'; roundRect(ctx, 10, -10, 9, 49, 3); ctx.fill();
      const g = ctx.createLinearGradient(4, 0, 26, 0);
      g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#cfd5dd');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(11, -13); ctx.quadraticCurveTo(4, 10, 6, 39); ctx.lineTo(11, 39); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(18, -13); ctx.quadraticCurveTo(25, 10, 23, 39); ctx.lineTo(18, 39); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4fb6ff'; ctx.fillRect(13.5, -7, 2, 10);
      if (extra.night) glowAt(ctx, 14.5, -2, 8, '#4fb6ff', 0.5);
      ctx.fillStyle = '#2a2b31'; roundRect(ctx, 5, 38, 19, 3, 1.5); ctx.fill();
      // controle
      const cx = 35, cy = 33;
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(cx + 1, cy + 7, 11, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f0f2f5';
      ctx.beginPath(); ctx.ellipse(cx - 6.5, cy + 2, 4.5, 5.5, -0.35, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + 6.5, cy + 2, 4.5, 5.5, 0.35, 0, Math.PI * 2); ctx.fill();
      roundRect(ctx, cx - 9, cy - 4, 18, 8, 4); ctx.fill();
      ctx.fillStyle = '#1d1e24'; roundRect(ctx, cx - 3.5, cy - 3, 7, 3.5, 1.2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx - 3, cy + 3, 1.8, 0, Math.PI * 2); ctx.arc(cx + 3, cy + 3, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(cx - 8, cy - 0.5, 3, 1); ctx.fillRect(cx - 7, cy - 1.5, 1, 3);
      for (const [dx, dy, c] of [[6.5, -1.5, '#45b864'], [8, 0, '#e3403b'], [5, 0, '#ef7fb3'], [6.5, 1.5, '#3a68c9']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx + dx, cy + dy, 0.9, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case 'retroconsole': {
      shadow(5, h - 9, w - 10, 7);
      // cabos
      ctx.strokeStyle = '#3a3f4a'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(14, 30); ctx.quadraticCurveTo(8, 34, 12, 38); ctx.moveTo(34, 30); ctx.quadraticCurveTo(42, 33, 36, 38); ctx.stroke();
      // cartucho
      ctx.fillStyle = '#5a5f6b'; roundRect(ctx, 15, 2, 18, 16, 2); ctx.fill();
      ctx.fillStyle = '#e3403b'; ctx.fillRect(17, 4, 14, 9);
      ctx.fillStyle = '#ffd34d'; ctx.fillRect(18, 5, 12, 2);
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(24, 10, 2, 0, Math.PI * 2); ctx.fill();
      // console
      ctx.fillStyle = '#d6d3dc'; roundRect(ctx, 6, 14, 36, 17, 4); ctx.fill();
      ctx.fillStyle = '#b4b0bd'; roundRect(ctx, 6, 22, 36, 9, 3); ctx.fill();
      ctx.fillStyle = '#4a4656'; ctx.fillRect(13, 15, 22, 3);
      ctx.fillStyle = '#7b52c2'; roundRect(ctx, 9, 24, 7, 3, 1.5); ctx.fill(); roundRect(ctx, 32, 24, 7, 3, 1.5); ctx.fill();
      ctx.fillStyle = '#e3403b'; ctx.beginPath(); ctx.arc(24, 25.5, 1.2, 0, Math.PI * 2); ctx.fill();
      // controles
      for (const x of [5, 27]) {
        ctx.fillStyle = '#d6d3dc'; roundRect(ctx, x, 36, 16, 7, 3.5); ctx.fill();
        ctx.fillStyle = '#3a3f4a'; ctx.fillRect(x + 3, 39, 4, 1.2); ctx.fillRect(x + 4.4, 37.6, 1.2, 4);
        ctx.fillStyle = '#7b52c2'; ctx.beginPath(); ctx.arc(x + 11, 40.5, 1.3, 0, Math.PI * 2); ctx.arc(x + 13.5, 38.8, 1.3, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'pcgamer': {
      shadow();
      const night = extra.night, rgb = (y0, y1) => { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#ff4fd8'); g.addColorStop(0.5, '#7b6bff'); g.addColorStop(1, '#2fe0ff'); return g; };
      const dw = w - 30, top = 10;
      // mesa
      ctx.fillStyle = '#1d1e24'; ctx.fillRect(7, top + 18, 4, h - top - 24); ctx.fillRect(dw - 6, top + 18, 4, h - top - 24);
      const dg = ctx.createLinearGradient(0, top, 0, top + 18);
      dg.addColorStop(0, '#4a4e5a'); dg.addColorStop(1, '#2e3038');
      ctx.fillStyle = dg; roundRect(ctx, 3, top, dw, 18, 3); ctx.fill();
      ctx.fillStyle = '#1d1e24'; ctx.fillRect(3, top + 14, dw, 5);
      const lg = ctx.createLinearGradient(3, 0, dw, 0);
      lg.addColorStop(0, '#ff4fd8'); lg.addColorStop(0.5, '#7b6bff'); lg.addColorStop(1, '#2fe0ff');
      ctx.fillStyle = lg; ctx.fillRect(4, top + 15.5, dw - 2, 1.5);
      // monitor
      const mx = 8, mw = dw - 10, my = -TS * 0.8 + 3, mh = 30;
      ctx.fillStyle = '#26272e'; ctx.fillRect(3 + dw / 2 - 2.5, my + mh - 2, 5, top - my - mh + 6); roundRect(ctx, 3 + dw / 2 - 9, top + 2, 18, 3, 1.5); ctx.fill();
      ctx.fillStyle = '#16171c'; roundRect(ctx, mx, my, mw, mh, 3); ctx.fill();
      const sg = ctx.createLinearGradient(0, my, 0, my + mh);
      sg.addColorStop(0, '#2a2f7a'); sg.addColorStop(1, '#8a3fb0');
      ctx.fillStyle = sg; ctx.fillRect(mx + 2, my + 2, mw - 4, mh - 5);
      ctx.save(); ctx.beginPath(); ctx.rect(mx + 2, my + 2, mw - 4, mh - 5); ctx.clip();
      ctx.fillStyle = '#ffd0f4'; for (let k = 0; k < 7; k++) ctx.fillRect(mx + 6 + ((k * 23) % (mw - 10)), my + 4 + ((k * 7) % 10), 1, 1);
      ctx.fillStyle = '#1c1240'; ctx.beginPath(); ctx.moveTo(mx, my + mh); ctx.lineTo(mx + mw * 0.3, my + mh * 0.5); ctx.lineTo(mx + mw * 0.5, my + mh * 0.75); ctx.lineTo(mx + mw * 0.72, my + mh * 0.42); ctx.lineTo(mx + mw, my + mh); ctx.fill();
      ctx.fillStyle = '#45e06a'; ctx.fillRect(mx + 4, my + 4, 14, 2); ctx.fillStyle = '#ffd34d'; ctx.fillRect(mx + 4, my + 7, 9, 1.5);
      ctx.restore();
      if (night) glowAt(ctx, mx + mw / 2, my + mh / 2, 34, '#9b7bff', 0.25);
      // teclado e mouse
      ctx.fillStyle = '#16171c'; roundRect(ctx, 12, top + 4, 34, 7, 2); ctx.fill();
      ctx.fillStyle = rgb(top + 4, top + 11); for (let r = 0; r < 2; r++) for (let k = 0; k < 9; k++) ctx.fillRect(14 + k * 3.5, top + 5.5 + r * 2.5, 2.5, 1.5);
      ctx.fillStyle = '#16171c'; ctx.beginPath(); ctx.ellipse(52, top + 8, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2fe0ff'; ctx.fillRect(51.5, top + 6, 1, 2);
      // gabinete com vidro e fans RGB
      const tx = w - 26, ty = -TS * 0.35, th = h - 6 - ty;
      ctx.fillStyle = '#1d1e24'; roundRect(ctx, tx, ty, 22, th, 3); ctx.fill();
      ctx.fillStyle = '#2a2c36'; roundRect(ctx, tx + 2, ty + 3, 14, th - 8, 2); ctx.fill();
      const fc = ['#ff4fd8', '#7b6bff', '#2fe0ff'];
      for (let k = 0; k < 3; k++) {
        const fy = ty + 10 + k * ((th - 18) / 2.4);
        if (night) glowAt(ctx, tx + 9, fy, 10, fc[k], 0.45);
        ctx.strokeStyle = fc[k]; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(tx + 9, fy, 5, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#3a3d48'; ctx.beginPath(); ctx.arc(tx + 9, fy, 1.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = rgb(ty, ty + th); ctx.fillRect(tx + 18, ty + 3, 1.5, th - 8);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.moveTo(tx + 3, ty + 3); ctx.lineTo(tx + 9, ty + 3); ctx.lineTo(tx + 3, ty + 16); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(tx + 18, ty + 1, 2, 1);
      break;
    }
    case 'gamerchair': {
      shadow(8, h - 9, w - 16, 7);
      const dk = '#2a2b31', dk2 = '#1d1e24', cx = w / 2;
      // base estrela com rodinhas
      ctx.strokeStyle = dk2; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (const [dx, dy] of [[-15, 4], [15, 4], [-9, 8], [9, 8], [0, -1]]) { ctx.beginPath(); ctx.moveTo(cx, h - 13); ctx.lineTo(cx + dx, h - 13 + dy); ctx.stroke(); }
      ctx.lineCap = 'butt';
      ctx.fillStyle = '#111216'; for (const [dx, dy] of [[-15, 4], [15, 4], [-9, 8], [9, 8]]) { ctx.beginPath(); ctx.arc(cx + dx, h - 11 + dy, 2.2, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#8b8f99'; ctx.fillRect(cx - 2, h - 24, 4, 11);
      // braços
      ctx.fillStyle = dk2; ctx.fillRect(9, h - 32, 3, 8); ctx.fillRect(w - 12, h - 32, 3, 8);
      roundRect(ctx, 6, h - 34, 9, 3, 1.5); ctx.fill(); roundRect(ctx, w - 15, h - 34, 9, 3, 1.5); ctx.fill();
      // assento
      ctx.fillStyle = dk; roundRect(ctx, 10, h - 30, w - 20, 8, 3); ctx.fill();
      ctx.fillStyle = color; ctx.fillRect(12, h - 25, w - 24, 2);
      // encosto de corrida
      const top = -TS * 0.6 + 2;
      ctx.fillStyle = dk;
      ctx.beginPath();
      ctx.moveTo(14, top + 3); ctx.quadraticCurveTo(14, top, 18, top); ctx.lineTo(w - 18, top); ctx.quadraticCurveTo(w - 14, top, w - 14, top + 3);
      ctx.lineTo(w - 14, top + 14); ctx.lineTo(w - 9, top + 20); ctx.lineTo(w - 10, h - 28); ctx.lineTo(10, h - 28); ctx.lineTo(9, top + 20); ctx.lineTo(14, top + 14); ctx.closePath(); ctx.fill();
      // laterais e faixa na cor
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(9, top + 20); ctx.lineTo(14, top + 15); ctx.lineTo(15, h - 28); ctx.lineTo(10, h - 28); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(w - 9, top + 20); ctx.lineTo(w - 14, top + 15); ctx.lineTo(w - 15, h - 28); ctx.lineTo(w - 10, h - 28); ctx.closePath(); ctx.fill();
      ctx.fillRect(cx - 2, top + 16, 4, h - 28 - top - 18);
      // furos do cinto e almofada
      ctx.fillStyle = dk2; roundRect(ctx, 17, top + 4, 4, 7, 2); ctx.fill(); roundRect(ctx, w - 21, top + 4, 4, 7, 2); ctx.fill();
      ctx.fillStyle = '#3a3c45'; roundRect(ctx, cx - 7, top + 13, 14, 6, 3); ctx.fill();
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx, top + 16, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(15, top + 2, 2, 12);
      break;
    }
    case 'laptop': {
      shadow(5, h - 9, w - 10, 7);
      // mesinha
      ctx.fillStyle = woodD; ctx.fillRect(9, 30, 4, h - 36); ctx.fillRect(w - 13, 30, 4, h - 36);
      const g = ctx.createLinearGradient(0, 18, 0, 30);
      g.addColorStop(0, woodL); g.addColorStop(1, wood);
      ctx.fillStyle = g; roundRect(ctx, 4, 18, w - 8, 13, 3); ctx.fill();
      ctx.fillStyle = woodD; ctx.fillRect(4, 28, w - 8, 4);
      // notebook
      ctx.fillStyle = '#b9c2cb'; roundRect(ctx, 11, -5, w - 22, 24, 2.5); ctx.fill();
      ctx.fillStyle = '#20232b'; roundRect(ctx, 12.5, -3.5, w - 25, 21, 1.5); ctx.fill();
      const sg = ctx.createLinearGradient(0, -2, 0, 16);
      sg.addColorStop(0, '#5aa7e8'); sg.addColorStop(1, '#2d5f9e');
      ctx.fillStyle = sg; ctx.fillRect(14, -2, w - 28, 17);
      ctx.fillStyle = '#f4f4f4'; ctx.fillRect(16, 0, 9, 7); ctx.fillStyle = '#ffd34d'; ctx.fillRect(27, 0, 5, 3); ctx.fillStyle = '#7fe08f'; ctx.fillRect(27, 4, 5, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(16, 9, 16, 1.5); ctx.fillRect(16, 12, 11, 1.5);
      ctx.fillStyle = '#d9dde3'; ctx.beginPath(); ctx.moveTo(11, 19); ctx.lineTo(w - 11, 19); ctx.lineTo(w - 8, 26); ctx.lineTo(8, 26); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8b939e'; for (let r = 0; r < 2; r++) ctx.fillRect(13 - r, 20.5 + r * 2, w - 26 + r * 2, 1.2);
      ctx.fillStyle = '#c3cad2'; ctx.fillRect(w / 2 - 4, 24.5, 8, 1);
      break;
    }
    case 'speaker': {
      shadow(9, h - 9, w - 18, 7);
      const top = -TS * 0.7 + 2;
      const g = ctx.createLinearGradient(11, 0, w - 11, 0);
      g.addColorStop(0, '#3a3d48'); g.addColorStop(1, '#22242b');
      ctx.fillStyle = g; roundRect(ctx, 11, top, w - 22, h - 7 - top, 4); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(13, top + 2, 2, h - 12 - top);
      const drv = (cy, r) => {
        ctx.fillStyle = '#5a5f6b'; ctx.beginPath(); ctx.arc(w / 2, cy, r, 0, Math.PI * 2); ctx.fill();
        const cg = ctx.createRadialGradient(w / 2 - r * 0.3, cy - r * 0.3, 1, w / 2, cy, r);
        cg.addColorStop(0, '#3a3d48'); cg.addColorStop(1, '#111216');
        ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(w / 2, cy, r - 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#4a4e58'; ctx.beginPath(); ctx.arc(w / 2, cy, r * 0.3, 0, Math.PI * 2); ctx.fill();
      };
      drv(top + 8, 4); drv(top + 22, 7); drv(h - 20, 9);
      ctx.strokeStyle = extra.night ? '#5ff0ff' : '#2fb8d0'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(w / 2, h - 20, 10.5, 0, Math.PI * 2); ctx.stroke();
      if (extra.night) glowAt(ctx, w / 2, h - 20, 16, '#2fe0ff', 0.3);
      ctx.fillStyle = '#2fe0ff'; ctx.fillRect(w / 2 - 1, h - 10, 2, 1.5);
      ctx.fillStyle = '#111216'; ctx.fillRect(13, h - 7, 4, 2); ctx.fillRect(w - 17, h - 7, 4, 2);
      break;
    }
    case 'radio': {
      shadow(5, h - 9, w - 10, 7);
      ctx.fillStyle = woodD; ctx.fillRect(8, 30, 4, h - 36); ctx.fillRect(w - 12, 30, 4, h - 36);
      ctx.fillStyle = woodL; roundRect(ctx, 4, 22, w - 8, 10, 3); ctx.fill();
      ctx.fillStyle = woodD; ctx.fillRect(4, 29, w - 8, 4);
      // rádio "capelinha"
      const body = (inset) => { ctx.beginPath(); ctx.moveTo(9 + inset, 27 - inset * 0.3); ctx.lineTo(9 + inset, 3); ctx.arc(w / 2, 3, w / 2 - 9 - inset, Math.PI, 0); ctx.lineTo(w - 9 - inset, 27 - inset * 0.3); ctx.closePath(); };
      const g = ctx.createLinearGradient(0, -14, 0, 27);
      g.addColorStop(0, '#9a5f30'); g.addColorStop(1, '#6e3f1e');
      body(0); ctx.fillStyle = g; ctx.fill();
      body(3); ctx.fillStyle = '#b7834c'; ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.moveTo(15, 14); ctx.lineTo(15, 4); ctx.arc(w / 2, 4, w / 2 - 15, Math.PI, 0); ctx.lineTo(w - 15, 14); ctx.closePath();
      ctx.fillStyle = '#ead7ae'; ctx.fill(); ctx.clip();
      ctx.fillStyle = 'rgba(120,80,40,0.25)'; for (let y = -6; y < 14; y += 2) ctx.fillRect(15, y, w - 30, 1);
      ctx.fillStyle = '#7c4f28'; for (const x of [w / 2 - 5, w / 2, w / 2 + 5]) ctx.fillRect(x - 1, -8, 2, 22);
      ctx.restore();
      // dial e botões
      ctx.fillStyle = '#f6e7b8'; roundRect(ctx, w / 2 - 6, 16, 12, 6, 2); ctx.fill();
      ctx.strokeStyle = '#7c4f28'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(w / 2, 21); ctx.lineTo(w / 2 + 3, 17); ctx.stroke();
      ctx.fillStyle = '#4a2a14'; for (const x of [14.5, w - 14.5]) { ctx.beginPath(); ctx.arc(x, 20, 2.6, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#e2b13c'; for (const x of [14.5, w - 14.5]) { ctx.beginPath(); ctx.arc(x, 20, 1, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    // ================================================================ cozinha
    case 'microwave': case 'coffeemaker': {
      shadow();
      // balcão
      ctx.fillStyle = '#c99460'; roundRect(ctx, 3, 14, w - 6, h - 20, 3); ctx.fill();
      ctx.fillStyle = '#b07a45'; ctx.fillRect(6, 22, w - 12, h - 31);
      ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(w / 2, 28, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ece4d6'; roundRect(ctx, 2, 8, w - 4, 10, 3); ctx.fill();
      ctx.fillStyle = '#d6cbb6'; ctx.fillRect(2, 15, w - 4, 3);
      if (art === 'microwave') {
        const t = -TS * 0.45 + 2;
        ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(6, 13, w - 12, 3);
        ctx.fillStyle = '#eef1f4'; roundRect(ctx, 5, t, w - 10, 14 - t, 4); ctx.fill();
        ctx.fillStyle = '#d3d9e0'; ctx.fillRect(5, 9, w - 10, 5);
        ctx.fillStyle = '#2a2f38'; roundRect(ctx, 8, t + 3, 25, 14 - t - 8, 3); ctx.fill();
        const wg = ctx.createLinearGradient(0, t + 3, 0, 8);
        wg.addColorStop(0, '#4a5868'); wg.addColorStop(1, '#2a3340');
        ctx.fillStyle = wg; roundRect(ctx, 10, t + 5, 21, 14 - t - 12, 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.moveTo(12, t + 5); ctx.lineTo(18, t + 5); ctx.lineTo(13, 6); ctx.lineTo(10, 6); ctx.fill();
        ctx.fillStyle = '#9aa5b1'; ctx.fillRect(33.5, t + 4, 1.5, 14 - t - 10);
        ctx.fillStyle = '#16231a'; roundRect(ctx, 36, t + 3, 7, 4, 1); ctx.fill();
        ctx.fillStyle = '#7fe08f'; ctx.fillRect(37, t + 4.5, 5, 1);
        ctx.fillStyle = '#b9c2cb'; for (let r = 0; r < 3; r++) for (let k = 0; k < 2; k++) ctx.fillRect(36.5 + k * 3.5, t + 9 + r * 3.5, 2.5, 2.5);
      } else {
        const t = -TS * 0.4 + 2;
        ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(10, 13, 28, 3);
        // máquina
        ctx.fillStyle = '#2b2e36'; roundRect(ctx, 12, t + 4, 9, 14 - t - 4, 2); ctx.fill();
        ctx.fillStyle = '#3a3f4a'; roundRect(ctx, 10, t, 27, 9, 3); ctx.fill();
        ctx.fillStyle = '#d8433c'; ctx.fillRect(10, t + 7, 27, 2);
        ctx.fillStyle = '#1d1e24'; roundRect(ctx, 11, 10, 26, 4, 1.5); ctx.fill();
        // jarra
        ctx.fillStyle = 'rgba(200,230,245,0.55)'; ctx.beginPath(); ctx.moveTo(21, t + 10); ctx.lineTo(33, t + 10); ctx.lineTo(34, 11); ctx.lineTo(20, 11); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#5a3418'; ctx.beginPath(); ctx.moveTo(20.6, 2); ctx.lineTo(33.4, 2); ctx.lineTo(34, 11); ctx.lineTo(20, 11); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(22, t + 11, 1.5, 14);
        ctx.strokeStyle = '#1d1e24'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(34, t + 12); ctx.quadraticCurveTo(38, t + 13, 34, 7); ctx.stroke();
        ctx.fillStyle = '#45e06a'; ctx.fillRect(14, t + 11, 2, 2);
        // xícara com vapor
        ctx.fillStyle = '#ffffff'; roundRect(ctx, 38, 5, 6, 7, 1.5); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(44, 8, 2, -Math.PI / 2, Math.PI / 2); ctx.stroke();
        ctx.fillStyle = '#d8433c'; ctx.fillRect(38, 7, 6, 1.5);
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(40, 3); ctx.quadraticCurveTo(38.5, 0, 40.5, -3); ctx.moveTo(42.5, 3); ctx.quadraticCurveTo(41, 0, 43, -3); ctx.stroke();
      }
      break;
    }
    case 'dining': {
      shadow(6, h - 10, w - 12, 9);
      const cxs = [w * 0.3, w * 0.7];
      const chairBack = (cx, y, hh) => {
        ctx.fillStyle = woodD; roundRect(ctx, cx - 12, y, 24, hh, 4); ctx.fill();
        ctx.fillStyle = woodL; roundRect(ctx, cx - 9, y + 3, 18, 4, 2); ctx.fill();
        ctx.fillStyle = wood; for (let k = -1; k <= 1; k++) ctx.fillRect(cx + k * 6 - 1.5, y + 8, 3, hh - 11);
      };
      // cadeiras do fundo (só o encosto aparece)
      for (const cx of cxs) chairBack(cx, 0, 24);
      // pernas e tampo
      ctx.fillStyle = woodD; ctx.fillRect(12, 64, 6, h - 72); ctx.fillRect(w - 18, 64, 6, h - 72);
      const g = ctx.createLinearGradient(0, 18, 0, 64);
      g.addColorStop(0, woodL); g.addColorStop(1, wood);
      ctx.fillStyle = g; roundRect(ctx, 6, 18, w - 12, 46, 6); ctx.fill();
      ctx.fillStyle = woodD; roundRect(ctx, 6, 60, w - 12, 8, 3); ctx.fill();
      // caminho de mesa
      ctx.fillStyle = '#f4efe6'; ctx.fillRect(14, 35, w - 28, 12);
      ctx.fillStyle = '#c94f4a'; ctx.fillRect(14, 37, w - 28, 2); ctx.fillRect(14, 43, w - 28, 2);
      // pratos
      for (const cx of cxs) for (const py of [28, 51]) {
        ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.beginPath(); ctx.ellipse(cx + 1, py + 1, 9, 5.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(cx, py, 9, 5.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#d9dde3'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cx, py, 6, 3.6, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#5cb85a'; ctx.beginPath(); ctx.arc(cx - 1.5, py - 0.5, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ee8a33'; ctx.beginPath(); ctx.arc(cx + 2, py + 0.5, 1.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#b9c2cb'; ctx.fillRect(cx - 13, py - 3, 1.5, 7); ctx.fillRect(cx + 11.5, py - 3, 1.5, 7);
        ctx.fillStyle = 'rgba(190,230,255,0.85)'; ctx.beginPath(); ctx.ellipse(cx + 14, py - 6, 2.2, 1.6, 0, 0, Math.PI * 2); ctx.fill();
      }
      // arranjo central
      ctx.fillStyle = '#3a68c9'; roundRect(ctx, w / 2 - 4, 36, 8, 9, 2); ctx.fill();
      ctx.fillStyle = '#4f9f45'; ctx.beginPath(); ctx.arc(w / 2, 34, 6, 0, Math.PI * 2); ctx.fill();
      for (const [dx, dy, c] of [[-3, -3, '#ef7fb3'], [3, -4, '#ffd34d'], [0, 0, '#e3403b'], [4, 1, '#ef7fb3'], [-4, 1, '#ffffff']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(w / 2 + dx, 34 + dy, 2, 0, Math.PI * 2); ctx.fill(); }
      // cadeiras da frente (vistas de costas)
      for (const cx of cxs) {
        ctx.fillStyle = woodD; ctx.fillRect(cx - 11, h - 18, 3, 11); ctx.fillRect(cx + 8, h - 18, 3, 11);
        ctx.fillStyle = '#c94f4a'; roundRect(ctx, cx - 13, h - 21, 26, 6, 3); ctx.fill();
        chairBack(cx, 60, 20);
      }
      break;
    }
    case 'dishwasher': {
      shadow();
      const g = ctx.createLinearGradient(4, 0, w - 4, 0);
      g.addColorStop(0, '#e6eaef'); g.addColorStop(1, '#b9c2cb');
      ctx.fillStyle = g; roundRect(ctx, 4, 2, w - 8, h - 8, 3); ctx.fill();
      ctx.fillStyle = '#ece4d6'; roundRect(ctx, 2, -5, w - 4, 9, 3); ctx.fill();
      ctx.fillStyle = '#d6cbb6'; ctx.fillRect(2, 1, w - 4, 3);
      ctx.fillStyle = '#3a3f4a'; ctx.fillRect(4, 4, w - 8, 7);
      ctx.fillStyle = '#7fd0ff'; ctx.fillRect(9, 6, 9, 3);
      ctx.fillStyle = '#45e06a'; ctx.beginPath(); ctx.arc(w - 10, 7.5, 1.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#b9c2cb'; ctx.beginPath(); ctx.arc(w - 16, 7.5, 1.3, 0, Math.PI * 2); ctx.arc(w - 21, 7.5, 1.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8b939e'; roundRect(ctx, 10, 14, w - 20, 3, 1.5); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1; ctx.strokeRect(7.5, 19.5, w - 15, h - 31);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(8, 19, 3, h - 30);
      ctx.fillStyle = '#2b2e36'; ctx.fillRect(4, h - 10, w - 8, 4);
      break;
    }
    // ================================================================ banheiro
    case 'bathtub': {
      shadow();
      ctx.fillStyle = '#c9a227';
      for (const x of [10, w - 16]) { roundRect(ctx, x, h - 13, 6, 7, 2); ctx.fill(); }
      ctx.fillStyle = '#f7f8fa'; roundRect(ctx, 3, 2, w - 6, h - 12, 14); ctx.fill();
      ctx.fillStyle = '#dfe4ea'; roundRect(ctx, 3, h - 24, w - 6, 14, 8); ctx.fill();
      ctx.fillStyle = '#f7f8fa'; ctx.fillRect(10, h - 24, w - 20, 3);
      const g = ctx.createLinearGradient(0, 6, 0, h - 24);
      g.addColorStop(0, '#a8ecff'); g.addColorStop(1, '#3fb3e3');
      ctx.fillStyle = g; roundRect(ctx, 9, 6, w - 18, h - 31, 9); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(18, 18); ctx.quadraticCurveTo(24, 15, 30, 18); ctx.stroke();
      // espuma
      const bub = [[0.5, 9, 5], [0.58, 6, 6], [0.66, 9, 5.5], [0.74, 6, 6], [0.82, 9, 5], [0.62, 12, 4], [0.72, 12, 4], [0.88, 6, 4], [0.54, 4, 3.5], [0.8, 3, 3.5]];
      for (const [fx, y, r] of bub) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(w * fx, y + 2, r, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = 'rgba(200,230,245,0.9)'; for (const [fx, y, r] of bub.slice(0, 5)) { ctx.beginPath(); ctx.arc(w * fx + r * 0.3, y + 2 + r * 0.35, r * 0.5, 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1;
      for (const [x, y, r] of [[w * 0.45, -2, 2], [w * 0.62, -5, 1.6], [w * 0.9, -1, 1.8]]) { ctx.beginPath(); ctx.arc(x, y + 3, r, 0, Math.PI * 2); ctx.stroke(); }
      // patinho
      const dx = w * 0.3, dy = 14;
      ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.ellipse(dx, dy, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(dx + 4, dy - 4, 3.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ee8a33'; ctx.beginPath(); ctx.moveTo(dx + 7, dy - 4.5); ctx.lineTo(dx + 10, dy - 3.5); ctx.lineTo(dx + 7, dy - 2.5); ctx.fill();
      ctx.fillStyle = '#222'; ctx.fillRect(dx + 4.5, dy - 5.5, 1.2, 1.2);
      // torneira
      ctx.fillStyle = '#b9c2cb'; roundRect(ctx, 5, 3, 6, 4, 2); ctx.fill();
      ctx.fillStyle = '#e6eaef'; ctx.beginPath(); ctx.arc(8, 2, 2, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'toilet': {
      shadow(9, h - 9, w - 18, 7);
      const t = -TS * 0.3 + 2;
      // caixa acoplada
      ctx.fillStyle = '#e3e7ec'; roundRect(ctx, 11, t, w - 22, 22, 4); ctx.fill();
      ctx.fillStyle = '#fafbfc'; roundRect(ctx, 11, t + 3, w - 22, 19, 4); ctx.fill();
      ctx.fillStyle = '#b9c2cb'; ctx.beginPath(); ctx.arc(w / 2, t + 2, 2, 0, Math.PI * 2); ctx.fill();
      // pé
      ctx.fillStyle = '#e3e7ec'; ctx.beginPath(); ctx.moveTo(w / 2 - 7, 26); ctx.lineTo(w / 2 + 7, 26); ctx.lineTo(w / 2 + 9, h - 8); ctx.lineTo(w / 2 - 9, h - 8); ctx.closePath(); ctx.fill();
      // vaso e assento
      ctx.fillStyle = '#dfe4ea'; ctx.beginPath(); ctx.ellipse(w / 2, 22, 13, 11, 0, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(w / 2, 19, 13, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#9fd6ea'; ctx.beginPath(); ctx.ellipse(w / 2, 19.5, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(w / 2 - 2, 18, 3, 1.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#e3e7ec'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(w / 2, 19, 13, 9, 0, 0, Math.PI * 2); ctx.stroke();
      // tampa levantada
      ctx.fillStyle = '#f4f6f8'; roundRect(ctx, 14, t + 12, w - 28, 10, 5); ctx.fill();
      ctx.strokeStyle = '#e3e7ec'; ctx.beginPath(); ctx.moveTo(16, t + 20); ctx.lineTo(w - 16, t + 20); ctx.stroke();
      break;
    }
    case 'shower': {
      shadow(3, h - 8, w - 6, 7);
      const t = -TS + 2;
      // azulejos do fundo
      ctx.fillStyle = '#dff1f7'; ctx.fillRect(5, t, w - 10, h - 14 - t);
      ctx.strokeStyle = '#bfdde8'; ctx.lineWidth = 1;
      for (let y = t + 8; y < h - 14; y += 8) { ctx.beginPath(); ctx.moveTo(5, y); ctx.lineTo(w - 5, y); ctx.stroke(); }
      for (let x = 13; x < w - 5; x += 8) { ctx.beginPath(); ctx.moveTo(x, t); ctx.lineTo(x, h - 14); ctx.stroke(); }
      // base
      ctx.fillStyle = '#e9edf1'; roundRect(ctx, 3, h - 18, w - 6, 12, 3); ctx.fill();
      ctx.fillStyle = '#c9d0d8'; ctx.fillRect(3, h - 11, w - 6, 5);
      ctx.fillStyle = '#9aa5b1'; ctx.beginPath(); ctx.ellipse(w / 2, h - 15, 3, 1.4, 0, 0, Math.PI * 2); ctx.fill();
      // chuveiro e água
      ctx.fillStyle = '#b9c2cb'; ctx.fillRect(w - 13, t + 4, 3, 22); ctx.fillRect(w / 2, t + 4, w / 2 - 10, 3);
      ctx.fillStyle = '#d9dde3'; ctx.beginPath(); ctx.ellipse(w / 2, t + 9, 8, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#9aa5b1'; ctx.beginPath(); ctx.ellipse(w / 2, t + 10.5, 6, 1.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(90,175,230,0.75)'; ctx.lineWidth = 1.2;
      for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(w / 2 + k * 2.5, t + 13); ctx.lineTo(w / 2 + k * 5, h - 18); ctx.stroke(); }
      ctx.fillStyle = '#b9c2cb'; ctx.beginPath(); ctx.arc(w - 11.5, 4, 2.5, 0, Math.PI * 2); ctx.fill();
      // vidro
      ctx.fillStyle = 'rgba(190,230,248,0.3)'; ctx.fillRect(4, t, w - 8, h - 18 - t);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.moveTo(8, t + 30); ctx.lineTo(18, t + 14); ctx.lineTo(21, t + 14); ctx.lineTo(11, t + 30); ctx.fill();
      ctx.beginPath(); ctx.moveTo(8, t + 40); ctx.lineTo(26, t + 12); ctx.lineTo(28, t + 12); ctx.lineTo(10, t + 40); ctx.fill();
      ctx.strokeStyle = '#c9d0d8'; ctx.lineWidth = 2; ctx.strokeRect(4, t, w - 8, h - 18 - t);
      ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(w / 2 + 6, t); ctx.lineTo(w / 2 + 6, h - 18); ctx.stroke();
      ctx.fillStyle = '#9aa5b1'; ctx.fillRect(w / 2 + 2, t + 40, 2, 10);
      break;
    }
    case 'bathsink': {
      shadow(12, h - 9, w - 24, 7);
      // espelho acima da pia
      const my = -TS * 0.55;
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(w / 2 + 1.5, my + 2, 14, 18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d8b46a'; ctx.beginPath(); ctx.ellipse(w / 2, my, 14, 18, 0, 0, Math.PI * 2); ctx.fill();
      const mg = ctx.createLinearGradient(w / 2 - 12, my - 16, w / 2 + 12, my + 16);
      mg.addColorStop(0, '#f4fbff'); mg.addColorStop(1, '#9fc6e6');
      ctx.fillStyle = mg; ctx.beginPath(); ctx.ellipse(w / 2, my, 11, 15, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(w / 2 - 6, my - 2); ctx.lineTo(w / 2 + 1, my - 10); ctx.moveTo(w / 2 - 6, my + 4); ctx.lineTo(w / 2 + 4, my - 7); ctx.stroke();
      // prateleira com copo
      ctx.fillStyle = 'rgba(200,230,245,0.9)'; ctx.fillRect(w / 2 - 12, -2, 24, 2);
      ctx.fillStyle = '#7fd0ff'; roundRect(ctx, w / 2 + 5, -8, 5, 6, 1); ctx.fill();
      ctx.fillStyle = '#ef7fb3'; ctx.fillRect(w / 2 + 6, -12, 1.2, 5); ctx.fillStyle = '#45b864'; ctx.fillRect(w / 2 + 8, -11, 1.2, 4);
      // coluna
      ctx.fillStyle = '#e3e7ec'; ctx.beginPath(); ctx.moveTo(w / 2 - 5, 18); ctx.lineTo(w / 2 + 5, 18); ctx.lineTo(w / 2 + 8, h - 8); ctx.lineTo(w / 2 - 8, h - 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(w / 2 - 3, 18, 2, h - 26);
      // cuba
      ctx.fillStyle = '#e9edf1'; ctx.beginPath(); ctx.ellipse(w / 2, 11, 17, 10, 0, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(w / 2, 10, 18, 6.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#cfe3ee'; ctx.beginPath(); ctx.ellipse(w / 2, 10.5, 13, 4, 0, 0, Math.PI * 2); ctx.fill();
      // torneira
      ctx.fillStyle = '#b9c2cb'; ctx.fillRect(w / 2 - 1.5, 2, 3, 5); ctx.fillRect(w / 2 - 1.5, 2, 5, 2);
      ctx.fillStyle = '#d8433c'; ctx.beginPath(); ctx.arc(w / 2 - 6, 5, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a68c9'; ctx.beginPath(); ctx.arc(w / 2 + 7, 5, 1.6, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'washer': {
      shadow();
      const t = -TS * 0.3 + 2;
      const g = ctx.createLinearGradient(0, t, 0, h - 6);
      g.addColorStop(0, '#fafbfc'); g.addColorStop(1, '#dfe4ea');
      ctx.fillStyle = g; roundRect(ctx, 5, t, w - 10, h - 6 - t, 4); ctx.fill();
      ctx.fillStyle = '#e3e7ec'; ctx.fillRect(5, t + 10, w - 10, 1.5);
      ctx.fillStyle = '#cfd5dc'; roundRect(ctx, 8, t + 3, 11, 5, 1); ctx.fill();
      ctx.fillStyle = '#20232b'; roundRect(ctx, 22, t + 3, 9, 5, 1); ctx.fill();
      ctx.fillStyle = '#7fe08f'; ctx.fillRect(23.5, t + 4.5, 6, 1.5);
      ctx.fillStyle = '#b9c2cb'; ctx.beginPath(); ctx.arc(w - 11, t + 5.5, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8b939e'; ctx.fillRect(w - 11.5, t + 2.5, 1, 3);
      // porta redonda
      const cy = (t + 12 + h - 7) / 2 + 1;
      ctx.fillStyle = '#b9c2cb'; ctx.beginPath(); ctx.arc(w / 2, cy, 15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e9edf1'; ctx.beginPath(); ctx.arc(w / 2, cy, 13, 0, Math.PI * 2); ctx.fill();
      const dg = ctx.createRadialGradient(w / 2 - 3, cy - 3, 2, w / 2, cy, 11);
      dg.addColorStop(0, '#6fb8e6'); dg.addColorStop(1, '#2a5f8f');
      ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(w / 2, cy, 10.5, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(w / 2, cy, 10.5, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = '#d8433c'; ctx.beginPath(); ctx.ellipse(w / 2 - 3, cy + 5, 7, 4, 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.ellipse(w / 2 + 5, cy + 6, 6, 3.5, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; for (const [dx, dy, r] of [[-5, -2, 1.5], [3, -5, 1.2], [6, 0, 1]]) { ctx.beginPath(); ctx.arc(w / 2 + dx, cy + dy, r, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(w / 2, cy, 8, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
      ctx.fillStyle = '#9aa5b1'; ctx.fillRect(7, h - 7, 4, 2); ctx.fillRect(w - 11, h - 7, 4, 2);
      break;
    }
    case 'wallmirror': {
      const y0 = 5;
      ctx.fillStyle = 'rgba(0,0,0,0.14)'; roundRect(ctx, 11, y0 + 2, w - 20, 34, 13); ctx.fill();
      ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(14, y0 + 4); ctx.lineTo(w / 2, y0 - 3); ctx.lineTo(w - 14, y0 + 4); ctx.stroke();
      const fg = ctx.createLinearGradient(0, y0, 0, y0 + 34);
      fg.addColorStop(0, '#f0cf7e'); fg.addColorStop(1, '#c49a4c');
      ctx.fillStyle = fg; roundRect(ctx, 9, y0, w - 18, 34, 13); ctx.fill();
      const mg = ctx.createLinearGradient(12, y0, w - 12, y0 + 30);
      mg.addColorStop(0, '#f4fbff'); mg.addColorStop(1, '#9fc6e6');
      ctx.fillStyle = mg; roundRect(ctx, 12, y0 + 3, w - 24, 28, 10); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath(); ctx.moveTo(15, y0 + 18); ctx.lineTo(24, y0 + 6); ctx.lineTo(27, y0 + 6); ctx.lineTo(16, y0 + 22); ctx.fill();
      ctx.beginPath(); ctx.moveTo(18, y0 + 26); ctx.lineTo(31, y0 + 9); ctx.lineTo(32.5, y0 + 9); ctx.lineTo(19.5, y0 + 27); ctx.fill();
      ctx.fillStyle = '#e2b13c'; ctx.beginPath(); ctx.arc(w / 2, y0 - 3, 1.6, 0, Math.PI * 2); ctx.fill();
      break;
    }
    // ================================================================ quarto
    case 'bunkbed': {
      shadow();
      const U = TS * 0.92, low = shade(color, -0.12);
      // postes de trás
      ctx.fillStyle = woodD; ctx.fillRect(3, -U - 2, 5, U + 14); ctx.fillRect(w - 8, -U - 2, 5, U + 14);
      // cama de baixo
      ctx.fillStyle = woodD; roundRect(ctx, 3, 2, w - 6, h - 6, 6); ctx.fill();
      ctx.fillStyle = '#ffffff'; roundRect(ctx, 7, 6, w - 14, h - 16, 5); ctx.fill();
      ctx.fillStyle = low; roundRect(ctx, 7, h * 0.38, w - 14, h * 0.62 - 10, 5); ctx.fill();
      // travesseiro da cama de baixo aparecendo sob o estrado
      ctx.fillStyle = '#e9e9f0'; roundRect(ctx, 10, h - U + 4, w - 20, 9, 4); ctx.fill();
      ctx.fillStyle = shade(low, -0.15); ctx.fillRect(7, h - U + 15, w - 14, 4);
      // cama de cima
      ctx.save(); ctx.translate(0, -U);
      ctx.fillStyle = woodD; roundRect(ctx, 3, 2, w - 6, h - 6, 6); ctx.fill();
      ctx.fillStyle = '#ffffff'; roundRect(ctx, 7, 6, w - 14, h - 16, 5); ctx.fill();
      ctx.fillStyle = color; roundRect(ctx, 7, h * 0.38, w - 14, h * 0.62 - 10, 5); ctx.fill();
      ctx.fillStyle = shade(color, -0.15); ctx.fillRect(7, h * 0.38, w - 14, 4);
      ctx.fillStyle = '#f4f4f8'; roundRect(ctx, 10, 10, w - 20, h * 0.2, 6); ctx.fill();
      // grade de proteção
      ctx.fillStyle = woodL; roundRect(ctx, 3, 6, 5, h * 0.62, 2); ctx.fill();
      ctx.restore();
      // lateral da cama de cima + sombra na de baixo
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(7, h - U - 4, w - 14, 9);
      ctx.fillStyle = woodD; roundRect(ctx, 3, h - U - 10, w - 6, 8, 3); ctx.fill();
      ctx.fillStyle = woodL; ctx.fillRect(5, h - U - 10, w - 10, 2);
      // postes da frente
      ctx.fillStyle = woodD; ctx.fillRect(3, h - U - 14, 5, U + 8); ctx.fillRect(w - 8, h - U - 14, 5, U + 8);
      ctx.fillStyle = woodL; ctx.fillRect(4, h - U - 14, 1.5, U + 8); ctx.fillRect(w - 7, h - U - 14, 1.5, U + 8);
      // escada
      ctx.fillStyle = wood; ctx.fillRect(w - 20, h - U - 4, 3, U - 2); ctx.fillRect(w - 11, h - U - 4, 3, U - 2);
      ctx.fillStyle = woodL; for (let y = h - U + 4; y < h - 8; y += 9) ctx.fillRect(w - 20, y, 12, 2.5);
      break;
    }
    case 'vanity': {
      shadow();
      const night = extra.night, top = 8;
      // espelho com lâmpadas
      const mx = w / 2, mw = 40, mh = 44, my = top - 2 - mh / 2;
      ctx.fillStyle = '#f3ece4'; roundRect(ctx, mx - mw / 2 - 4, my - mh / 2 - 4, mw + 8, mh + 8, 12); ctx.fill();
      ctx.strokeStyle = '#d8b46a'; ctx.lineWidth = 1.5; roundRect(ctx, mx - mw / 2 - 4, my - mh / 2 - 4, mw + 8, mh + 8, 12); ctx.stroke();
      const mg = ctx.createLinearGradient(mx - mw / 2, my - mh / 2, mx + mw / 2, my + mh / 2);
      mg.addColorStop(0, '#f4fbff'); mg.addColorStop(1, '#a8cbe6');
      ctx.fillStyle = mg; roundRect(ctx, mx - mw / 2 + 2, my - mh / 2 + 2, mw - 4, mh - 4, 9); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.moveTo(mx - 14, my + 6); ctx.lineTo(mx - 2, my - 14); ctx.lineTo(mx + 2, my - 14); ctx.lineTo(mx - 10, my + 6); ctx.fill();
      const bulbs = [];
      for (let k = 0; k < 4; k++) { bulbs.push([mx - mw / 2 - 2, my - mh / 2 + 6 + k * 12]); bulbs.push([mx + mw / 2 + 2, my - mh / 2 + 6 + k * 12]); }
      for (let k = 0; k < 3; k++) bulbs.push([mx - 12 + k * 12, my - mh / 2 - 2]);
      for (const [bx, by] of bulbs) {
        if (night) glowAt(ctx, bx, by, 6, '#fff3a0', 0.6);
        ctx.fillStyle = night ? '#fff6c0' : '#fffdf2'; ctx.beginPath(); ctx.arc(bx, by, 2.3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#d8b46a'; ctx.lineWidth = 0.8; ctx.stroke();
      }
      // tampo
      const g = ctx.createLinearGradient(0, top, 0, top + 14);
      g.addColorStop(0, '#fbf6f0'); g.addColorStop(1, '#e9dfd2');
      ctx.fillStyle = g; roundRect(ctx, 3, top, w - 6, 14, 4); ctx.fill();
      ctx.fillStyle = '#d8c9b8'; ctx.fillRect(3, top + 11, w - 6, 4);
      // gavetas laterais
      for (const x of [5, w - 31]) {
        ctx.fillStyle = '#f3ece4'; roundRect(ctx, x, top + 14, 26, h - top - 20, 3); ctx.fill();
        ctx.strokeStyle = '#d8c9b8'; ctx.lineWidth = 1;
        for (let k = 0; k < 2; k++) { ctx.strokeRect(x + 2.5, top + 16.5 + k * 10, 21, 8); }
        ctx.fillStyle = '#d8b46a'; for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.arc(x + 13, top + 20.5 + k * 10, 1.5, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.fillStyle = 'rgba(80,50,40,0.25)'; ctx.fillRect(31, top + 15, w - 62, h - top - 21);
      // banquinho
      ctx.fillStyle = '#d8b46a'; ctx.fillRect(w / 2 - 8, h - 14, 2, 8); ctx.fillRect(w / 2 + 6, h - 14, 2, 8);
      ctx.fillStyle = '#ef7fb3'; roundRect(ctx, w / 2 - 10, h - 19, 20, 7, 3.5); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(w / 2 - 7, h - 18, 12, 1.5);
      // perfumes e maquiagem
      ctx.fillStyle = 'rgba(239,127,179,0.85)'; roundRect(ctx, 10, top - 6, 6, 9, 2); ctx.fill();
      ctx.fillStyle = '#d8b46a'; ctx.fillRect(12, top - 9, 2, 3);
      ctx.fillStyle = 'rgba(123,82,194,0.85)'; ctx.beginPath(); ctx.arc(21, top, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d8b46a'; ctx.fillRect(20, top - 6, 2, 3);
      ctx.fillStyle = '#e3403b'; roundRect(ctx, w - 18, top - 3, 8, 5, 1.5); ctx.fill();
      ctx.fillStyle = '#ffd34d'; ctx.fillRect(w - 18, top - 1.5, 8, 1);
      ctx.fillStyle = '#c9d0d8'; ctx.fillRect(w - 25, top - 7, 3, 9); ctx.fillStyle = '#7a4c27'; ctx.fillRect(w - 25, top - 10, 3, 3);
      break;
    }
    case 'dresser': {
      shadow();
      const t = -TS * 0.35;
      // decoração em cima
      ctx.fillStyle = '#b8862f'; roundRect(ctx, 12, t - 13, 12, 12, 1.5); ctx.fill();
      ctx.fillStyle = '#9fd8ff'; ctx.fillRect(14, t - 11, 8, 8); ctx.fillStyle = '#5cb85a'; ctx.fillRect(14, t - 6, 8, 3);
      ctx.fillStyle = '#e3403b'; ctx.beginPath(); ctx.arc(18, t - 7, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7fc6ec'; roundRect(ctx, w - 24, t - 9, 9, 9, 3); ctx.fill();
      ctx.fillStyle = '#4f9f45'; ctx.fillRect(w - 20.5, t - 16, 1.5, 8);
      ctx.fillStyle = '#ef7fb3'; ctx.beginPath(); ctx.arc(w - 20, t - 16, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(w - 20, t - 16, 1.2, 0, Math.PI * 2); ctx.fill();
      // corpo
      ctx.fillStyle = woodD; ctx.fillRect(7, h - 10, 5, 5); ctx.fillRect(w - 12, h - 10, 5, 5);
      const g = ctx.createLinearGradient(0, t, 0, h - 8);
      g.addColorStop(0, woodL); g.addColorStop(1, wood);
      ctx.fillStyle = g; roundRect(ctx, 4, t, w - 8, h - 8 - t, 3); ctx.fill();
      ctx.fillStyle = woodL; roundRect(ctx, 2, t - 2, w - 4, 6, 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(4, t - 2, w - 8, 1.5);
      const rows = 3, rh = (h - 12 - t - 4) / rows;
      for (let r = 0; r < rows; r++) for (let c = 0; c < 2; c++) {
        const x = 8 + c * ((w - 16) / 2), y = t + 6 + r * rh, dw = (w - 16) / 2 - 3;
        ctx.fillStyle = shade(wood, 0.08); roundRect(ctx, x, y, dw, rh - 3, 2); ctx.fill();
        ctx.strokeStyle = woodD; ctx.lineWidth = 1; roundRect(ctx, x + 0.5, y + 0.5, dw - 1, rh - 4, 2); ctx.stroke();
        ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(x + dw / 2, y + (rh - 3) / 2, 1.8, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'coatrack': {
      shadow(12, h - 9, w - 24, 7);
      const cx = w / 2, t = -TS + 4;
      ctx.strokeStyle = woodD; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx, h - 16); ctx.lineTo(cx - 12, h - 8); ctx.moveTo(cx, h - 16); ctx.lineTo(cx + 12, h - 8); ctx.moveTo(cx, h - 16); ctx.lineTo(cx, h - 6); ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, t + 8); ctx.quadraticCurveTo(cx - 10, t + 6, cx - 11, t); ctx.moveTo(cx, t + 8); ctx.quadraticCurveTo(cx + 10, t + 6, cx + 11, t); ctx.moveTo(cx, t + 16); ctx.quadraticCurveTo(cx + 8, t + 15, cx + 10, t + 10); ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.fillStyle = woodD; ctx.fillRect(cx - 2, t, 4, h - 16 - t);
      ctx.fillStyle = woodL; ctx.fillRect(cx - 1, t + 2, 1, h - 20 - t);
      ctx.fillStyle = woodD; ctx.beginPath(); ctx.arc(cx, t - 1, 3.2, 0, Math.PI * 2); ctx.fill();
      // casaco
      ctx.fillStyle = '#c94f4a';
      ctx.beginPath(); ctx.moveTo(cx - 11, t + 1); ctx.lineTo(cx - 5, t + 4); ctx.lineTo(cx - 2, t + 34); ctx.lineTo(cx - 18, t + 34); ctx.lineTo(cx - 16, t + 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#a83c38'; ctx.fillRect(cx - 11, t + 4, 1.5, 30);
      ctx.fillStyle = '#ffd34d'; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(cx - 8, t + 10 + k * 7, 1, 0, Math.PI * 2); ctx.fill(); }
      // chapéu
      ctx.fillStyle = '#6b4a2e'; ctx.beginPath(); ctx.ellipse(cx + 11, t + 1, 7, 2.2, 0, 0, Math.PI * 2); ctx.fill();
      roundRect(ctx, cx + 7, t - 6, 8, 7, 3); ctx.fill();
      ctx.fillStyle = '#2a2b31'; ctx.fillRect(cx + 7, t - 1.5, 8, 1.5);
      // cachecol
      ctx.fillStyle = '#efc23a'; ctx.fillRect(cx + 7, t + 10, 4, 22); ctx.fillRect(cx + 11, t + 10, 3, 14);
      ctx.fillStyle = '#3f9a54'; for (let y = t + 13; y < t + 32; y += 5) ctx.fillRect(cx + 7, y, 4, 2);
      break;
    }
    // ================================================================ sala e lazer
    case 'pouf': case 'pokepouf': {
      shadow(7, h - 10, w - 14, 8);
      if (art === 'pouf') {
        ctx.fillStyle = shade(color, -0.3); ctx.beginPath(); ctx.ellipse(w / 2, h - 13, 17, 6, 0, 0, Math.PI * 2); ctx.fill();
        const g = ctx.createLinearGradient(7, 0, w - 7, 0);
        g.addColorStop(0, shade(color, -0.05)); g.addColorStop(1, shade(color, -0.25));
        ctx.fillStyle = g; ctx.fillRect(7, 18, w - 14, h - 31);
        ctx.fillStyle = shade(color, 0.12); ctx.beginPath(); ctx.ellipse(w / 2, 18, 17, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = shade(color, 0.3); ctx.beginPath(); ctx.ellipse(w / 2 - 4, 16, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = shade(color, -0.12); ctx.lineWidth = 1;
        for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; ctx.beginPath(); ctx.moveTo(w / 2, 18); ctx.lineTo(w / 2 + Math.cos(a) * 15, 18 + Math.sin(a) * 7); ctx.stroke(); }
        ctx.fillStyle = shade(color, -0.25); ctx.beginPath(); ctx.arc(w / 2, 18, 2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = shade(color, 0.25); ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.ellipse(w / 2, h - 18, 17, 6, 0, 0.15, Math.PI - 0.15); ctx.stroke(); ctx.setLineDash([]);
      } else {
        // pufe Poké Bola (pufe fofo)
        const cx = w / 2, cy = 26, rx = 19, ry = 16;
        ctx.save(); ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = '#f4f4f4'; ctx.fillRect(0, cy, w, ry + 2);
        ctx.fillStyle = '#e3403b'; ctx.fillRect(0, cy - ry - 2, w, ry + 2);
        const sg = ctx.createRadialGradient(cx - 7, cy - 8, 2, cx, cy, rx + 4);
        sg.addColorStop(0, 'rgba(255,255,255,0.35)'); sg.addColorStop(0.6, 'rgba(255,255,255,0)'); sg.addColorStop(1, 'rgba(0,0,0,0.22)');
        ctx.fillStyle = sg; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#2a2a2a'; ctx.fillRect(0, cy - 2, w, 4);
        ctx.restore();
        ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.arc(cx, cy + 1, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx, cy + 1, 4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#d9dde3'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy + 1, 2.3, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(160,30,30,0.35)'; ctx.beginPath(); ctx.moveTo(cx - 10, cy - 12); ctx.quadraticCurveTo(cx - 4, cy - 8, cx - 6, cy - 3); ctx.moveTo(cx + 9, cy - 13); ctx.quadraticCurveTo(cx + 5, cy - 8, cx + 7, cy - 3); ctx.stroke();
      }
      break;
    }
    case 'hammock': {
      shadow(4, h - 9, w - 8, 7);
      const t = -TS * 0.4 + 2;
      // estrutura
      ctx.fillStyle = woodD; ctx.fillRect(6, h - 13, w - 12, 4);
      ctx.strokeStyle = woodD; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(5, h - 10); ctx.lineTo(11, t + 2); ctx.lineTo(18, h - 10); ctx.moveTo(w - 5, h - 10); ctx.lineTo(w - 11, t + 2); ctx.lineTo(w - 18, h - 10); ctx.stroke();
      ctx.lineCap = 'butt';
      // cordas
      ctx.strokeStyle = '#d9c9a0'; ctx.lineWidth = 1;
      for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(11, t + 3); ctx.lineTo(24, 4 + k * 2); ctx.moveTo(w - 11, t + 3); ctx.lineTo(w - 24, 4 + k * 2); ctx.stroke(); }
      // tecido listrado
      ctx.save();
      ctx.beginPath(); ctx.moveTo(23, 1); ctx.quadraticCurveTo(w / 2, 22, w - 23, 1); ctx.lineTo(w - 23, 8); ctx.quadraticCurveTo(w / 2, 46, 23, 8); ctx.closePath();
      ctx.clip();
      const cols = ['#e3403b', '#f2c230', '#45b864', '#3a68c9', '#ee8a33'];
      for (let x = 20, k = 0; x < w - 20; x += 6, k++) { ctx.fillStyle = cols[k % cols.length]; ctx.fillRect(x, 0, 6, h); }
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.moveTo(23, 8); ctx.quadraticCurveTo(w / 2, 46, w - 23, 8); ctx.lineTo(w - 23, 14); ctx.quadraticCurveTo(w / 2, 30, 23, 14); ctx.fill();
      ctx.restore();
      // travesseiro
      ctx.fillStyle = '#f4f4f8'; ctx.save(); ctx.translate(31, 13); ctx.rotate(0.45); roundRect(ctx, -7, -4, 14, 8, 4); ctx.fill(); ctx.restore();
      // franjas
      ctx.strokeStyle = '#f4efe0'; ctx.lineWidth = 1;
      for (let k = 0; k <= 10; k++) { const x = 26 + k * (w - 52) / 10, s = (x - w / 2) / (w / 2 - 23); const y = 8 + (1 - s * s) * 19; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 4); ctx.stroke(); }
      break;
    }
    case 'trophycase': {
      shadow();
      const t = -TS + 4;
      ctx.fillStyle = woodD; roundRect(ctx, 4, t, w - 8, h - 6 - t, 4); ctx.fill();
      ctx.fillStyle = woodL; roundRect(ctx, 2, t - 2, w - 4, 6, 2); ctx.fill();
      const ix = 9, iy = t + 6, iw = w - 18, ih = h - 14 - iy;
      const bg = ctx.createLinearGradient(0, iy, 0, iy + ih);
      bg.addColorStop(0, '#e6eef6'); bg.addColorStop(1, '#c4d2e0');
      ctx.fillStyle = bg; ctx.fillRect(ix, iy, iw, ih);
      const sh = [iy + ih * 0.33, iy + ih * 0.66, iy + ih];
      ctx.fillStyle = woodL; for (const y of sh.slice(0, 2)) ctx.fillRect(ix, y - 2, iw, 3);
      const cup = (cx, by, s, c) => {
        ctx.fillStyle = shade(c, -0.25); ctx.fillRect(cx - s * 0.5, by - s * 0.22, s, s * 0.22);
        ctx.fillStyle = c; ctx.fillRect(cx - s * 0.12, by - s * 0.5, s * 0.24, s * 0.3);
        ctx.beginPath(); ctx.moveTo(cx - s * 0.5, by - s * 1.15); ctx.lineTo(cx + s * 0.5, by - s * 1.15); ctx.quadraticCurveTo(cx + s * 0.45, by - s * 0.5, cx, by - s * 0.48); ctx.quadraticCurveTo(cx - s * 0.45, by - s * 0.5, cx - s * 0.5, by - s * 1.15); ctx.fill();
        ctx.strokeStyle = c; ctx.lineWidth = Math.max(1, s * 0.12);
        ctx.beginPath(); ctx.arc(cx - s * 0.5, by - s * 0.9, s * 0.18, Math.PI * 0.5, Math.PI * 1.5); ctx.arc(cx + s * 0.5, by - s * 0.9, s * 0.18, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(cx - s * 0.3, by - s * 1.08, s * 0.12, s * 0.4);
      };
      const medal = (cx, by, c) => {
        ctx.fillStyle = '#3a68c9'; ctx.beginPath(); ctx.moveTo(cx - 4, by - 18); ctx.lineTo(cx, by - 9); ctx.lineTo(cx + 4, by - 18); ctx.fill();
        ctx.fillStyle = '#e3403b'; ctx.fillRect(cx - 1, by - 18, 2, 8);
        ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx, by - 6, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; starPath(ctx, cx, by - 6, 2.2); ctx.fill();
        ctx.fillStyle = woodD; ctx.fillRect(cx - 6, by - 1.5, 12, 1.5);
      };
      cup(ix + iw * 0.2, sh[0] - 2, 12, '#f2c230'); medal(ix + iw * 0.5, sh[0] - 2, '#c9d0d8'); cup(ix + iw * 0.8, sh[0] - 2, 10, '#c9d0d8');
      ctx.fillStyle = '#7c4f28'; ctx.fillRect(ix + iw * 0.2 - 6, sh[1] - 6, 12, 4);
      pokeballSmall(ctx, ix + iw * 0.2, sh[1] - 11, 5);
      ctx.fillStyle = '#9aa1ab'; ctx.fillRect(ix + iw * 0.5 - 1, sh[1] - 12, 2, 10); ctx.fillRect(ix + iw * 0.5 - 5, sh[1] - 4, 10, 2);
      starPath(ctx, ix + iw * 0.5, sh[1] - 15, 6); ctx.fillStyle = '#f2c230'; ctx.fill();
      cup(ix + iw * 0.8, sh[1] - 2, 11, '#d08a4a');
      cup(ix + iw * 0.3, sh[2] - 2, 14, '#f2c230');
      ctx.fillStyle = '#5b3a22'; roundRect(ctx, ix + iw * 0.58, sh[2] - 14, 18, 12, 2); ctx.fill();
      ctx.fillStyle = '#e2b13c'; ctx.fillRect(ix + iw * 0.58 + 3, sh[2] - 11, 12, 6);
      // vidro
      ctx.fillStyle = 'rgba(255,255,255,0.32)';
      ctx.beginPath(); ctx.moveTo(ix + 4, iy + ih * 0.5); ctx.lineTo(ix + 18, iy); ctx.lineTo(ix + 24, iy); ctx.lineTo(ix + 6, iy + ih * 0.65); ctx.fill();
      ctx.beginPath(); ctx.moveTo(ix + iw * 0.55, iy + ih); ctx.lineTo(ix + iw * 0.85, iy + ih * 0.55); ctx.lineTo(ix + iw * 0.9, iy + ih * 0.55); ctx.lineTo(ix + iw * 0.6, iy + ih); ctx.fill();
      ctx.fillStyle = woodD; ctx.fillRect(w / 2 - 1, iy, 2, ih);
      ctx.fillStyle = '#ffd34d'; ctx.fillRect(w / 2 - 4, iy + ih * 0.5, 1.5, 5); ctx.fillRect(w / 2 + 2.5, iy + ih * 0.5, 1.5, 5);
      ctx.fillStyle = woodD; ctx.fillRect(4, h - 14, w - 8, 8);
      break;
    }
    case 'pingpong': {
      shadow(6, h - 10, w - 12, 9);
      ctx.fillStyle = '#2b2e36'; for (const x of [16, w - 22, w / 2 - 3]) ctx.fillRect(x, 64, 6, h - 72);
      ctx.fillStyle = '#22528a'; roundRect(ctx, 4, 58, w - 8, 8, 2); ctx.fill();
      const g = ctx.createLinearGradient(0, 8, 0, 60);
      g.addColorStop(0, '#3a80c9'); g.addColorStop(1, '#2d68a8');
      ctx.fillStyle = g; roundRect(ctx, 4, 8, w - 8, 52, 3); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.strokeRect(6, 10, w - 12, 48);
      ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(6, 34); ctx.lineTo(w - 6, 34); ctx.stroke();
      // raquetes e bolinha
      const pad = (x, y, c, a) => {
        ctx.save(); ctx.translate(x, y); ctx.rotate(a);
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(1.5, 2, 7, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#c99460'; roundRect(ctx, -1.8, 4, 3.6, 9, 1.5); ctx.fill();
        ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, 0, 7, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.ellipse(-2, -2, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      };
      pad(w * 0.25, 30, '#d8433c', -0.6); pad(w * 0.76, 40, '#2b2e36', 0.7);
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(w * 0.62 + 1, 23, 2.6, 1.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(w * 0.62, 19, 2.4, 0, Math.PI * 2); ctx.fill();
      // rede
      ctx.fillStyle = 'rgba(30,30,40,0.35)'; ctx.fillRect(w / 2 - 3, 2, 6, 58);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.6;
      for (let y = 4; y < 60; y += 3) { ctx.beginPath(); ctx.moveTo(w / 2 - 3, y); ctx.lineTo(w / 2 + 3, y); ctx.stroke(); }
      ctx.fillStyle = '#ffffff'; ctx.fillRect(w / 2 - 3, 1, 6, 2);
      ctx.fillStyle = '#5a5f6b'; ctx.fillRect(w / 2 - 1.5, 0, 3, 6); ctx.fillRect(w / 2 - 1.5, 56, 3, 7);
      break;
    }
    case 'foosball': {
      shadow();
      const t = -TS * 0.25 + 2;
      ctx.fillStyle = woodD; ctx.fillRect(9, 30, 5, h - 36); ctx.fillRect(w - 14, 30, 5, h - 36);
      ctx.fillStyle = '#6e4222'; roundRect(ctx, 3, t, w - 6, 36 - t, 4); ctx.fill();
      ctx.fillStyle = '#5a3418'; ctx.fillRect(3, 29, w - 6, 7);
      const fx = 9, fy = t + 5, fw = w - 18, fh = 29 - fy - 2;
      ctx.fillStyle = '#3f9a54'; ctx.fillRect(fx, fy, fw, fh);
      ctx.fillStyle = '#4aa860'; for (let k = 0; k < 6; k += 2) ctx.fillRect(fx + k * fw / 6, fy, fw / 6, fh);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1;
      ctx.strokeRect(fx + 1.5, fy + 1.5, fw - 3, fh - 3);
      ctx.beginPath(); ctx.moveTo(w / 2, fy + 1.5); ctx.lineTo(w / 2, fy + fh - 1.5); ctx.stroke();
      ctx.beginPath(); ctx.arc(w / 2, fy + fh / 2, 5, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#1d1e24'; ctx.fillRect(fx - 2, fy + fh / 2 - 5, 3, 10); ctx.fillRect(fx + fw - 1, fy + fh / 2 - 5, 3, 10);
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(w / 2 + 6, fy + fh / 2 + 3, 1.8, 0, Math.PI * 2); ctx.fill();
      // varetas e bonequinhos
      const team = ['#d8433c', '#d8433c', '#3a68c9', '#d8433c', '#3a68c9', '#3a68c9'], cnt = [1, 2, 3, 3, 2, 1];
      for (let k = 0; k < 6; k++) {
        const x = fx + fw * (k + 0.5) / 6;
        ctx.fillStyle = '#d9dde3'; ctx.fillRect(x - 0.6, t - 2, 1.2, 40 - t);
        ctx.fillStyle = '#1d1e24'; roundRect(ctx, x - 1.8, 35, 3.6, 7, 1.5); ctx.fill();
        for (let p = 0; p < cnt[k]; p++) {
          const py = fy + fh * (p + 1) / (cnt[k] + 1);
          ctx.fillStyle = team[k]; roundRect(ctx, x - 2, py - 3, 4, 6, 1.5); ctx.fill();
          ctx.fillStyle = '#f2d2b0'; ctx.beginPath(); ctx.arc(x, py - 3.5, 1.4, 0, Math.PI * 2); ctx.fill();
        }
      }
      break;
    }
    case 'goal': {
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; roundRect(ctx, 6, h - 12, w - 12, 8, 4); ctx.fill();
      const top = -TS * 0.85, bx0 = 16, by = h - 20;
      // rede ao fundo
      ctx.save();
      ctx.beginPath(); ctx.moveTo(8, top + 3); ctx.lineTo(w - 8, top + 3); ctx.lineTo(w - bx0, by); ctx.lineTo(bx0, by); ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill(); ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 0.8;
      for (let x = -60; x < w + 60; x += 6) { ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + 60, by); ctx.moveTo(x + 60, top); ctx.lineTo(x, by); ctx.stroke(); }
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1;
      for (let y = top + 10; y < h - 8; y += 6) { ctx.beginPath(); ctx.moveTo(8, y); ctx.lineTo(8 + (bx0 - 8) * (y - top) / (by - top), Math.min(y, by)); ctx.stroke(); ctx.beginPath(); ctx.moveTo(w - 8, y); ctx.lineTo(w - 8 - (bx0 - 8) * (y - top) / (by - top), Math.min(y, by)); ctx.stroke(); }
      ctx.fillStyle = '#e9edf1'; ctx.fillRect(bx0, by - 1, w - bx0 * 2, 3);
      ctx.strokeStyle = '#e9edf1'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(8, top + 3); ctx.lineTo(bx0, by); ctx.moveTo(w - 8, top + 3); ctx.lineTo(w - bx0, by); ctx.stroke();
      // traves
      ctx.fillStyle = '#ffffff'; ctx.fillRect(4, top, 6, h - 8 - top); ctx.fillRect(w - 10, top, 6, h - 8 - top); ctx.fillRect(4, top, w - 8, 6);
      ctx.fillStyle = '#d9dde3'; ctx.fillRect(8, top + 6, 2, h - 14 - top); ctx.fillRect(w - 6, top + 6, 2, h - 14 - top); ctx.fillRect(10, top + 4, w - 20, 2);
      ctx.fillStyle = '#d8433c'; for (let y = top + 10; y < h - 10; y += 12) { ctx.fillRect(4, y, 6, 5); ctx.fillRect(w - 10, y, 6, 5); }
      break;
    }
    case 'soccerball': {
      const cx = w / 2, cy = h - 20, r = 11;
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(cx + 2, h - 9, 11, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      const pent = (x, y, rr, rot) => { ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = rot + i * Math.PI * 2 / 5; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); };
      ctx.fillStyle = '#26272e'; pent(cx, cy - 1, 4.2, -Math.PI / 2);
      ctx.strokeStyle = '#8b8f99'; ctx.lineWidth = 0.8;
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 4.2, cy - 1 + Math.sin(a) * 4.2); ctx.lineTo(cx + Math.cos(a) * 7.5, cy - 1 + Math.sin(a) * 7.5); ctx.stroke();
        pent(cx + Math.cos(a + Math.PI / 5) * 11, cy - 1 + Math.sin(a + Math.PI / 5) * 11, 4, a + Math.PI / 5);
      }
      const sg = ctx.createRadialGradient(cx - 4, cy - 5, 1, cx, cy, r + 2);
      sg.addColorStop(0, 'rgba(255,255,255,0.3)'); sg.addColorStop(0.7, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,0.28)');
      ctx.fillStyle = sg; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      ctx.restore();
      break;
    }
    case 'ballpit': {
      shadow(4, h - 10, w - 8, 9);
      ctx.fillStyle = '#2d78c0'; roundRect(ctx, 4, 8, w - 8, h - 16, 16); ctx.fill();
      ctx.fillStyle = '#3a8fd8'; roundRect(ctx, 4, 6, w - 8, h - 22, 16); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; roundRect(ctx, 7, 8, w - 14, h - 27, 13); ctx.stroke();
      ctx.strokeStyle = '#2d78c0'; ctx.lineWidth = 1.5;
      for (const x of [w * 0.33, w * 0.66]) { ctx.beginPath(); ctx.moveTo(x, h - 16); ctx.lineTo(x, h - 9); ctx.stroke(); }
      const ix = 13, iy = 15, iw = w - 26, ih = h - 42;
      ctx.save(); roundRect(ctx, ix, iy, iw, ih, 9); ctx.fillStyle = '#1f5c96'; ctx.fill(); ctx.clip();
      const cols = ['#e3403b', '#f2c230', '#45b864', '#ef7fb3', '#ee8a33', '#7b52c2', '#f4f4f4'];
      let k = 0;
      for (let y = iy + 2; y < iy + ih + 4; y += 6) for (let x = ix + ((y / 6) % 2 ? 0 : 3); x < ix + iw + 4; x += 7) {
        const c = cols[(k * 5 + Math.floor(y)) % cols.length]; k++;
        const jx = ((k * 13) % 5) - 2, jy = ((k * 7) % 3) - 1;
        ctx.fillStyle = shade(c, -0.25); ctx.beginPath(); ctx.arc(x + jx, y + jy + 0.8, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + jx, y + jy, 3.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(x + jx - 1.2, y + jy - 1.2, 1, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      for (const [x, y, c] of [[w - 12, h - 8, '#f2c230'], [10, h - 7, '#e3403b'], [w * 0.55, 8, '#45b864']]) {
        ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, 3.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(x - 1.2, y - 1.2, 1, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'treadmill': {
      shadow();
      const t = -TS * 0.6 + 2;
      // esteira
      ctx.fillStyle = '#4a4e58'; roundRect(ctx, 6, 16, w - 12, h - 22, 5); ctx.fill();
      ctx.fillStyle = '#24262c'; roundRect(ctx, 10, 20, w - 20, h - 34, 3); ctx.fill();
      ctx.fillStyle = '#30333b'; for (let y = 24; y < h - 14; y += 6) ctx.fillRect(10, y, w - 20, 1.5);
      ctx.fillStyle = '#6c717d'; roundRect(ctx, 6, h - 14, w - 12, 7, 3); ctx.fill();
      ctx.fillStyle = '#e3403b'; ctx.fillRect(7, 30, 3, h - 48); ctx.fillRect(w - 10, 30, 3, h - 48);
      // colunas, console e barra
      ctx.fillStyle = '#9aa1ab'; ctx.fillRect(8, t + 10, 4, 22 - t - 10); ctx.fillRect(w - 12, t + 10, 4, 22 - t - 10);
      ctx.fillStyle = '#5a5f6b'; roundRect(ctx, 3, 0, w - 6, 4, 2); ctx.fill();
      ctx.fillStyle = '#2b2e36'; roundRect(ctx, 5, t, w - 10, 16, 4); ctx.fill();
      ctx.fillStyle = extra.night ? '#9ff8e6' : '#7fe0d0'; roundRect(ctx, w / 2 - 10, t + 3, 20, 7, 1.5); ctx.fill();
      ctx.fillStyle = '#1d6b5e'; ctx.fillRect(w / 2 - 8, t + 5, 6, 1.5); ctx.fillRect(w / 2 + 1, t + 5, 7, 1.5); ctx.fillRect(w / 2 - 8, t + 7.5, 10, 1);
      for (const [x, c] of [[9, '#45b864'], [w - 9, '#e3403b']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, t + 7, 1.8, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#b9c2cb'; for (let k = 0; k < 4; k++) ctx.fillRect(w / 2 - 8 + k * 4.5, t + 12, 3, 2);
      break;
    }
    case 'dumbbells': {
      shadow(5, h - 9, w - 10, 7);
      // suporte
      ctx.strokeStyle = '#2b2e36'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(9, h - 8); ctx.lineTo(13, 8); ctx.moveTo(w - 9, h - 8); ctx.lineTo(w - 13, 8); ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.fillStyle = '#3a3f4a'; ctx.fillRect(11, 15, w - 22, 3); ctx.fillRect(10, 31, w - 20, 3);
      const bell = (y, half, r, c) => {
        ctx.fillStyle = '#c9ced6'; ctx.fillRect(w / 2 - half, y - 1.2, half * 2, 2.4);
        for (const s of [-1, 1]) {
          const x = w / 2 + s * half;
          ctx.fillStyle = shade(c, -0.25); roundRect(ctx, x - 3, y - r, 6, r * 2, 2); ctx.fill();
          ctx.fillStyle = c; roundRect(ctx, x - 3, y - r, 4, r * 2, 2); ctx.fill();
        }
      };
      bell(10, 12, 4.5, '#3a68c9'); bell(25, 13, 6, '#e3403b');
      // kettlebell no chão
      ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.arc(w / 2, h - 13, 5.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#f2c230'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(w / 2, h - 18, 3.5, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc(w / 2 - 2, h - 15, 1.5, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'punchbag': {
      shadow(5, h - 9, w - 10, 7);
      const t = -TS * 1.2 + 3;
      // base e suporte
      ctx.fillStyle = '#3a3f4a'; roundRect(ctx, 4, h - 15, w - 8, 7, 3); ctx.fill();
      ctx.fillStyle = '#1d1e24'; for (const x of [6, w - 14]) { roundRect(ctx, x, h - 20, 8, 7, 2); ctx.fill(); }
      ctx.fillStyle = '#6c717d'; ctx.fillRect(6, t, 4, h - 15 - t); ctx.fillRect(6, t, w / 2 - 4, 4);
      ctx.fillStyle = '#9aa1ab'; ctx.fillRect(7, t, 1.2, h - 15 - t);
      // corrente
      ctx.strokeStyle = '#b9c2cb'; ctx.lineWidth = 1.2;
      for (let y = t + 4; y < t + 13; y += 3) { ctx.beginPath(); ctx.ellipse(w / 2, y + 1.5, 1.2, 1.8, 0, 0, Math.PI * 2); ctx.stroke(); }
      // saco
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(w / 2 + 2, h - 18, 10, 3, 0, 0, Math.PI * 2); ctx.fill();
      const bt = t + 13, bh = 58;
      const g = ctx.createLinearGradient(w / 2 - 11, 0, w / 2 + 11, 0);
      g.addColorStop(0, '#e05a52'); g.addColorStop(0.6, '#c94f4a'); g.addColorStop(1, '#9a3430');
      ctx.fillStyle = g; roundRect(ctx, w / 2 - 11, bt, 22, bh, 9); ctx.fill();
      ctx.fillStyle = '#2a2b31'; ctx.fillRect(w / 2 - 11, bt + 5, 22, 5); ctx.fillRect(w / 2 - 11, bt + bh - 12, 22, 5);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(w / 2 - 7, bt + 12, 2.5, bh - 26);
      ctx.fillStyle = '#ffd34d'; starPath(ctx, w / 2 + 1, bt + bh / 2 - 2, 4); ctx.fill();
      break;
    }
    // ================================================================ decoração
    case 'bonsai': {
      shadow(8, h - 9, w - 16, 7);
      ctx.fillStyle = '#7c4f28'; roundRect(ctx, 4, h - 12, w - 8, 5, 2); ctx.fill();
      ctx.fillStyle = '#3f5a7a'; ctx.beginPath(); ctx.moveTo(8, h - 22); ctx.lineTo(w - 8, h - 22); ctx.lineTo(w - 11, h - 12); ctx.lineTo(11, h - 12); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5f7fa3'; roundRect(ctx, 6, h - 24, w - 12, 4, 2); ctx.fill();
      ctx.fillStyle = '#6aa84f'; ctx.beginPath(); ctx.ellipse(w / 2, h - 23, 15, 2.5, 0, 0, Math.PI * 2); ctx.fill();
      // tronco retorcido
      ctx.strokeStyle = '#6b4a2e'; ctx.lineCap = 'round';
      ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(w / 2 + 3, h - 23); ctx.quadraticCurveTo(w / 2 - 10, h - 30, w / 2 - 2, h - 38); ctx.quadraticCurveTo(w / 2 + 6, h - 44, w / 2 + 1, h - 52); ctx.stroke();
      ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(w / 2 - 4, h - 33); ctx.quadraticCurveTo(w / 2 - 10, h - 36, w / 2 - 13, h - 38); ctx.moveTo(w / 2 + 2, h - 42); ctx.quadraticCurveTo(w / 2 + 8, h - 44, w / 2 + 12, h - 46); ctx.stroke();
      ctx.lineCap = 'butt';
      const pad = (x, y, s) => {
        ctx.fillStyle = '#3f8a3f'; for (const [dx, dy, r] of [[-s, 1, s * 0.8], [s, 1, s * 0.8], [0, 0, s]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#6cc35f'; for (const [dx, dy, r] of [[-s * 0.6, -1.5, s * 0.55], [s * 0.4, -2, s * 0.6]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2); ctx.fill(); }
      };
      pad(w / 2 - 13, h - 40, 6); pad(w / 2 + 12, h - 48, 6); pad(w / 2, h - 56, 7);
      break;
    }
    case 'cactuspot': {
      shadow(12, h - 9, w - 24, 6);
      ctx.fillStyle = '#b8643a'; ctx.beginPath(); ctx.moveTo(14, h - 22); ctx.lineTo(w - 14, h - 22); ctx.lineTo(w - 17, h - 7); ctx.lineTo(17, h - 7); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#9a4f2c'; ctx.fillRect(12, h - 24, w - 24, 5);
      ctx.fillStyle = '#efe0c0'; ctx.fillRect(16, h - 17, w - 32, 2);
      const cg = ctx.createLinearGradient(w / 2 - 7, 0, w / 2 + 7, 0);
      cg.addColorStop(0, '#6cc35f'); cg.addColorStop(1, '#3f8a3a');
      ctx.fillStyle = cg;
      roundRect(ctx, w / 2 - 7, -8, 14, h - 22 + 8 - 1, 7); ctx.fill();
      roundRect(ctx, w / 2 - 17, 4, 7, 16, 3.5); ctx.fill(); ctx.fillRect(w / 2 - 14, 15, 8, 5);
      roundRect(ctx, w / 2 + 10, -2, 7, 14, 3.5); ctx.fill(); ctx.fillRect(w / 2 + 6, 7, 8, 5);
      ctx.strokeStyle = 'rgba(30,90,30,0.5)'; ctx.lineWidth = 1;
      for (const x of [w / 2 - 3, w / 2 + 2]) { ctx.beginPath(); ctx.moveTo(x, -5); ctx.lineTo(x, h - 24); ctx.stroke(); }
      ctx.fillStyle = '#fff6d8';
      for (const [x, y] of [[-5, 0], [4, 4], [-4, 12], [5, 16], [-5, 22], [3, 26], [-14, 8], [13, 3], [0, -4]]) ctx.fillRect(w / 2 + x, y, 1.2, 1.2);
      ctx.fillStyle = '#ef7fb3'; for (let k = 0; k < 5; k++) { const a = k * 1.26; ctx.beginPath(); ctx.arc(w / 2 + Math.cos(a) * 3, -9 + Math.sin(a) * 2.5, 2.2, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(w / 2, -9, 1.4, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'fan': {
      shadow(12, h - 9, w - 24, 6);
      const cx = w / 2, cy = -TS * 0.4;
      ctx.fillStyle = '#c9ced6'; ctx.beginPath(); ctx.ellipse(cx, h - 10, 12, 4.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e9edf1'; ctx.beginPath(); ctx.ellipse(cx, h - 11.5, 11, 3.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a68c9'; ctx.fillRect(cx + 4, h - 13, 2, 1.5); ctx.fillRect(cx + 7, h - 12.5, 2, 1.5);
      ctx.fillStyle = '#d9dde3'; ctx.fillRect(cx - 2, cy + 8, 4, h - 12 - cy - 8);
      ctx.fillStyle = '#b9c2cb'; ctx.fillRect(cx + 0.5, cy + 8, 1.5, h - 12 - cy - 8);
      // grade e hélices
      ctx.fillStyle = 'rgba(225,238,248,0.45)'; ctx.beginPath(); ctx.arc(cx, cy, 17, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(127,198,236,0.9)';
      for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3 + 0.4; ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8, 8, 4.5, a, 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeStyle = '#b9c2cb'; ctx.lineWidth = 0.7;
      for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 5, cy + Math.sin(a) * 5); ctx.lineTo(cx + Math.cos(a) * 17, cy + Math.sin(a) * 17); ctx.stroke(); }
      ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = '#c9ced6'; ctx.beginPath(); ctx.arc(cx, cy, 17, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#f4f6f8'; ctx.beginPath(); ctx.arc(cx, cy, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a68c9'; ctx.beginPath(); ctx.arc(cx, cy, 1.8, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'aircon': {
      const y0 = 8;
      ctx.fillStyle = 'rgba(0,0,0,0.14)'; roundRect(ctx, 4, y0 + 2, w - 6, 21, 6); ctx.fill();
      const g = ctx.createLinearGradient(0, y0, 0, y0 + 20);
      g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#dfe4ea');
      ctx.fillStyle = g; roundRect(ctx, 3, y0, w - 6, 20, 6); ctx.fill();
      ctx.strokeStyle = '#cfd5dc'; ctx.lineWidth = 1;
      for (let x = 8; x < w - 8; x += 3) { ctx.beginPath(); ctx.moveTo(x, y0 + 2.5); ctx.lineTo(x, y0 + 5.5); ctx.stroke(); }
      ctx.fillStyle = '#c3cad2'; roundRect(ctx, 5, y0 + 14, w - 10, 4, 2); ctx.fill();
      ctx.fillStyle = '#9aa5b1'; ctx.fillRect(7, y0 + 15.5, w - 14, 1);
      ctx.fillStyle = '#20232b'; roundRect(ctx, w - 16, y0 + 8, 9, 4, 1); ctx.fill();
      ctx.fillStyle = '#7fd0ff'; ctx.fillRect(w - 15, y0 + 9.5, 4, 1.2);
      ctx.fillStyle = '#45e06a'; ctx.beginPath(); ctx.arc(w - 19, y0 + 10, 1, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(150,215,250,0.7)'; ctx.lineWidth = 1.2;
      for (let k = 0; k < 3; k++) { const x = 12 + k * 12; ctx.beginPath(); ctx.moveTo(x, y0 + 21); ctx.quadraticCurveTo(x + 3, y0 + 25, x, y0 + 28); ctx.quadraticCurveTo(x - 3, y0 + 31, x, y0 + 33); ctx.stroke(); }
      break;
    }
    case 'mapposter': {
      const y0 = 6;
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(6, y0 + 2, w - 10, 33);
      ctx.fillStyle = '#8a5a36'; ctx.fillRect(4, y0, w - 8, 33);
      ctx.fillStyle = '#7fc8ec'; ctx.fillRect(6, y0 + 2, w - 12, 29);
      ctx.save(); ctx.beginPath(); ctx.rect(6, y0 + 2, w - 12, 29); ctx.clip();
      ctx.fillStyle = '#8fd77a';
      ctx.beginPath(); ctx.moveTo(10, y0 + 6); ctx.lineTo(30, y0 + 3); ctx.lineTo(40, y0 + 9); ctx.lineTo(38, y0 + 22); ctx.lineTo(30, y0 + 28); ctx.lineTo(16, y0 + 27); ctx.lineTo(9, y0 + 18); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.ellipse(40, y0 + 27, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(19, y0 + 15); ctx.lineTo(24, y0 + 6); ctx.lineTo(29, y0 + 15); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#a07850'; ctx.beginPath(); ctx.moveTo(19, y0 + 15); ctx.lineTo(22, y0 + 10); ctx.lineTo(26, y0 + 10); ctx.lineTo(29, y0 + 15); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4fa8e0'; ctx.beginPath(); ctx.ellipse(33, y0 + 16, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4f9f45'; for (const [x, y] of [[13, y0 + 20], [16, y0 + 22], [14, y0 + 24]]) { ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeStyle = '#f4f4f4'; ctx.lineWidth = 1; ctx.setLineDash([2, 1.5]);
      ctx.beginPath(); ctx.moveTo(13, y0 + 9); ctx.lineTo(17, y0 + 18); ctx.lineTo(27, y0 + 24); ctx.lineTo(36, y0 + 19); ctx.lineTo(35, y0 + 10); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#e3403b'; for (const [x, y] of [[13, y0 + 9], [17, y0 + 18], [27, y0 + 24], [36, y0 + 19], [35, y0 + 10]]) { ctx.fillRect(x - 1.5, y - 1.5, 3, 3); }
      ctx.restore();
      ctx.strokeStyle = '#f4f4f4'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(w - 11, y0 + 6); ctx.lineTo(w - 11, y0 + 12); ctx.moveTo(w - 14, y0 + 9); ctx.lineTo(w - 8, y0 + 9); ctx.stroke();
      ctx.fillStyle = '#e3403b'; ctx.beginPath(); ctx.arc(8, y0 + 2, 1.6, 0, Math.PI * 2); ctx.arc(w - 8, y0 + 2, 1.6, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'pikaframe': {
      const y0 = 5;
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(8, y0 + 2, w - 12, 35);
      ctx.fillStyle = '#c99460'; ctx.fillRect(6, y0, w - 12, 35);
      ctx.fillStyle = '#a8713f'; ctx.fillRect(8, y0 + 2, w - 16, 31);
      const bx = 9, by = y0 + 3, bw = w - 18, bh = 29;
      const bg = ctx.createLinearGradient(0, by, 0, by + bh);
      bg.addColorStop(0, '#bfe6ff'); bg.addColorStop(1, '#e8f6ff');
      ctx.fillStyle = bg; ctx.fillRect(bx, by, bw, bh);
      ctx.save(); ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip();
      ctx.fillStyle = '#8fd77a'; ctx.beginPath(); ctx.ellipse(w / 2, by + bh + 4, bw * 0.75, 9, 0, 0, Math.PI * 2); ctx.fill();
      const cx = w / 2 - 1, cy = by + 18, Y = '#f6d32d', K = '#2a2420';
      // cauda em raio
      ctx.fillStyle = '#b07a2c'; ctx.beginPath(); ctx.moveTo(cx + 8, cy + 6); ctx.lineTo(cx + 12, cy + 3); ctx.lineTo(cx + 13, cy + 7); ctx.closePath(); ctx.fill();
      ctx.fillStyle = Y; ctx.beginPath(); ctx.moveTo(cx + 11, cy + 4); ctx.lineTo(cx + 13, cy - 2); ctx.lineTo(cx + 11, cy - 3); ctx.lineTo(cx + 15, cy - 11); ctx.lineTo(cx + 19, cy - 9); ctx.lineTo(cx + 16, cy - 4); ctx.lineTo(cx + 18, cy - 3); ctx.lineTo(cx + 14, cy + 6); ctx.closePath(); ctx.fill();
      // orelhas
      for (const s of [-1, 1]) {
        ctx.fillStyle = Y; ctx.beginPath(); ctx.moveTo(cx + s * 3, cy - 6); ctx.quadraticCurveTo(cx + s * 9, cy - 20, cx + s * 12, cy - 17); ctx.quadraticCurveTo(cx + s * 11, cy - 9, cx + s * 8, cy - 4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = K; ctx.beginPath(); ctx.moveTo(cx + s * 9.2, cy - 15.5); ctx.quadraticCurveTo(cx + s * 10, cy - 19, cx + s * 12, cy - 17); ctx.quadraticCurveTo(cx + s * 11.8, cy - 14.5, cx + s * 11.3, cy - 13); ctx.closePath(); ctx.fill();
      }
      // cabeça
      ctx.fillStyle = Y; ctx.beginPath(); ctx.ellipse(cx, cy, 10, 8.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(200,140,20,0.25)'; ctx.beginPath(); ctx.ellipse(cx, cy + 5, 8, 3, 0, 0, Math.PI); ctx.fill();
      for (const s of [-1, 1]) {
        ctx.fillStyle = K; ctx.beginPath(); ctx.arc(cx + s * 4, cy - 1.5, 1.9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx + s * 4 - 0.6, cy - 2.2, 0.7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e3403b'; ctx.beginPath(); ctx.arc(cx + s * 7.2, cy + 2.6, 2.3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = K; ctx.beginPath(); ctx.arc(cx, cy + 0.6, 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7a2a22'; ctx.beginPath(); ctx.arc(cx, cy + 2.4, 1.9, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#ef7f8a'; ctx.beginPath(); ctx.arc(cx, cy + 3.4, 1, 0, Math.PI); ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.moveTo(bx, by + 10); ctx.lineTo(bx + 10, by); ctx.lineTo(bx + 14, by); ctx.lineTo(bx, by + 14); ctx.fill();
      break;
    }
    case 'lavalamp': {
      const night = extra.night, cx = w / 2;
      if (night) glowAt(ctx, cx, 8, 24, '#ff6ad5', 0.5);
      shadow(14, h - 9, w - 28, 6);
      const vb = h - 22, vt = -TS * 0.4 + 10;
      // base
      const bg = ctx.createLinearGradient(cx - 9, 0, cx + 9, 0);
      bg.addColorStop(0, '#9a7ad8'); bg.addColorStop(1, '#4f3a8a');
      ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(cx - 9, h - 8); ctx.lineTo(cx + 9, h - 8); ctx.lineTo(cx + 5, vb); ctx.lineTo(cx - 5, vb); ctx.closePath(); ctx.fill();
      // vidro com lava
      const vessel = () => { ctx.beginPath(); ctx.moveTo(cx - 5, vb); ctx.quadraticCurveTo(cx - 10, (vb + vt) / 2 + 6, cx - 3.5, vt); ctx.lineTo(cx + 3.5, vt); ctx.quadraticCurveTo(cx + 10, (vb + vt) / 2 + 6, cx + 5, vb); ctx.closePath(); };
      const lg = ctx.createLinearGradient(0, vt, 0, vb);
      lg.addColorStop(0, night ? '#ffb8ec' : '#f57ec0'); lg.addColorStop(1, night ? '#ff4fae' : '#c9479a');
      vessel(); ctx.fillStyle = lg; ctx.fill();
      ctx.save(); vessel(); ctx.clip();
      ctx.fillStyle = night ? '#ffe27a' : '#ffb03a';
      for (const [dx, y, rx, ry] of [[-1, vb - 3, 6, 3.5], [1.5, (vb + vt) / 2 + 3, 3.5, 4.5], [-1.5, vt + 8, 2.5, 3], [2, (vb + vt) / 2 - 6, 2, 2]]) { ctx.beginPath(); ctx.ellipse(cx + dx, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(cx - 5, vt, 1.5, vb - vt);
      ctx.restore();
      // tampa
      ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(cx - 3.5, vt); ctx.lineTo(cx + 3.5, vt); ctx.lineTo(cx + 2, vt - 6); ctx.lineTo(cx - 2, vt - 6); ctx.closePath(); ctx.fill();
      break;
    }
    case 'globe': {
      shadow(10, h - 9, w - 20, 7);
      const cx = w / 2, cy = 0, r = 14;
      ctx.strokeStyle = woodD; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx, h - 22); ctx.lineTo(cx - 12, h - 8); ctx.moveTo(cx, h - 22); ctx.lineTo(cx + 12, h - 8); ctx.moveTo(cx, h - 22); ctx.lineTo(cx, h - 6); ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.fillStyle = wood; ctx.fillRect(cx - 2.5, cy + r + 2, 5, h - 22 - cy - r - 2);
      ctx.fillStyle = woodL; roundRect(ctx, cx - 6, h - 25, 12, 4, 2); ctx.fill();
      // esfera
      const og = ctx.createRadialGradient(cx - 5, cy - 5, 2, cx, cy, r);
      og.addColorStop(0, '#9fdcff'); og.addColorStop(1, '#2d7fc9');
      ctx.fillStyle = og; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = '#5cb85a';
      ctx.beginPath(); ctx.moveTo(cx - 10, cy - 8); ctx.quadraticCurveTo(cx - 2, cy - 12, cx, cy - 4); ctx.quadraticCurveTo(cx - 2, cy + 2, cx - 6, cy + 1); ctx.quadraticCurveTo(cx - 12, cy - 2, cx - 10, cy - 8); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx - 3, cy + 3); ctx.quadraticCurveTo(cx + 2, cy + 3, cx + 1, cy + 9); ctx.quadraticCurveTo(cx - 1, cy + 13, cx - 4, cy + 8); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + 4, cy - 9); ctx.quadraticCurveTo(cx + 13, cy - 9, cx + 12, cy - 2); ctx.quadraticCurveTo(cx + 9, cy + 1, cx + 5, cy - 3); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + 8, cy + 7, 3, 2, 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f4f4f4'; ctx.beginPath(); ctx.ellipse(cx, cy - r, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.arc(cx + 5, cy + 5, r, 0, Math.PI * 2); ctx.arc(cx, cy, r, 0, Math.PI * 2, true); ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.ellipse(cx - 6, cy - 7, 3.5, 2, -0.6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(cx, cy, r + 3, -Math.PI * 0.85, Math.PI * 0.55); ctx.stroke();
      ctx.fillStyle = '#c9a227'; ctx.beginPath(); ctx.arc(cx, cy + r + 3, 2, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'fishbowl': {
      shadow(9, h - 9, w - 18, 7);
      ctx.fillStyle = woodD; ctx.fillRect(w / 2 - 3, 26, 6, h - 33); ctx.beginPath(); ctx.ellipse(w / 2, h - 8, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = wood; ctx.beginPath(); ctx.ellipse(w / 2, 27, 17, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = woodL; ctx.beginPath(); ctx.ellipse(w / 2, 25.5, 17, 4.5, 0, 0, Math.PI * 2); ctx.fill();
      const cx = w / 2, cy = 8, r = 15;
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = 'rgba(210,238,252,0.45)'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      const wg = ctx.createLinearGradient(0, cy - 8, 0, cy + r);
      wg.addColorStop(0, 'rgba(120,210,250,0.85)'); wg.addColorStop(1, 'rgba(40,140,210,0.95)');
      ctx.fillStyle = wg; ctx.fillRect(cx - r, cy - 7, r * 2, r + 8);
      const gc = ['#ef7fb3', '#f4f4f4', '#7b52c2', '#ffd34d'];
      for (let k = 0; k < 14; k++) { ctx.fillStyle = gc[k % 4]; ctx.beginPath(); ctx.arc(cx - 11 + k * 1.7, cy + 12 - (k % 2), 1.6, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#45b864'; ctx.beginPath(); ctx.ellipse(cx - 7, cy + 5, 1.6, 6, -0.2, 0, Math.PI * 2); ctx.ellipse(cx - 4, cy + 6, 1.4, 5, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff8a2c';
      ctx.beginPath(); ctx.ellipse(cx + 3, cy + 1, 5, 3.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + 7, cy + 1); ctx.lineTo(cx + 11, cy - 2.5); ctx.lineTo(cx + 11, cy + 4.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd0a0'; ctx.beginPath(); ctx.moveTo(cx + 2, cy - 2); ctx.lineTo(cx + 5, cy - 4.5); ctx.lineTo(cx + 5, cy - 1.5); ctx.fill();
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(cx, cy + 0.5, 0.8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.8;
      for (const [x, y, rr] of [[cx - 3, cy - 3, 1], [cx - 4, cy - 6, 1.3]]) { ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
      ctx.strokeStyle = 'rgba(200,230,245,0.9)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.ellipse(cx, cy - r + 2, 8, 2.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(150,200,230,0.6)'; ctx.beginPath(); ctx.ellipse(cx, cy - r + 2, 6, 1.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r - 3, Math.PI * 1.05, Math.PI * 1.4); ctx.stroke();
      break;
    }
    // ================================================================ tema Pokémon
    case 'pokehouse': {
      shadow(4, h - 9, w - 8, 7);
      const t = -TS * 0.5 + 2;
      const g = ctx.createLinearGradient(0, 2, 0, h - 8);
      g.addColorStop(0, '#f6e6c4'); g.addColorStop(1, '#e2c99a');
      ctx.fillStyle = g; ctx.fillRect(7, 0, w - 14, h - 8);
      ctx.strokeStyle = 'rgba(160,110,60,0.3)'; ctx.lineWidth = 1;
      for (let y = 6; y < h - 8; y += 6) { ctx.beginPath(); ctx.moveTo(7, y); ctx.lineTo(w - 7, y); ctx.stroke(); }
      // telhado
      ctx.fillStyle = '#f6e6c4'; ctx.beginPath(); ctx.moveTo(7, 2); ctx.lineTo(w / 2, t + 6); ctx.lineTo(w - 7, 2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#d8433c'; ctx.lineWidth = 6; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(2, 4); ctx.lineTo(w / 2, t + 3); ctx.lineTo(w - 2, 4); ctx.stroke();
      ctx.strokeStyle = '#a8302b'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(1, 7.5); ctx.lineTo(w / 2, t + 7); ctx.lineTo(w - 1, 7.5); ctx.stroke();
      ctx.lineJoin = 'miter';
      pokeballSmall(ctx, w / 2, -6, 5.5);
      // porta em arco
      ctx.fillStyle = '#4a3226'; ctx.beginPath(); ctx.moveTo(w / 2 - 9, h - 8); ctx.lineTo(w / 2 - 9, 22); ctx.arc(w / 2, 22, 9, Math.PI, 0); ctx.lineTo(w / 2 + 9, h - 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2e1e16'; ctx.beginPath(); ctx.moveTo(w / 2 - 6, h - 8); ctx.lineTo(w / 2 - 6, 23); ctx.arc(w / 2, 23, 6, Math.PI, 0); ctx.lineTo(w / 2 + 6, h - 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3a68c9'; ctx.beginPath(); ctx.ellipse(w - 9, h - 9, 5, 2.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#a8713f'; ctx.beginPath(); ctx.ellipse(w - 9, h - 10, 3.5, 1.4, 0, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'petbed': {
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(w / 2 + 1, h / 2 + 8, 21, 14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = shade(color, -0.3); ctx.beginPath(); ctx.ellipse(w / 2, h / 2 + 6, 20, 14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(w / 2, h / 2 + 3, 20, 14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = shade(color, 0.25); ctx.beginPath(); ctx.ellipse(w / 2 - 4, h / 2 - 5, 10, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = shade(color, 0.55); ctx.beginPath(); ctx.ellipse(w / 2, h / 2 + 5, 13, 8.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = shade(color, 0.35); ctx.beginPath(); ctx.ellipse(w / 2, h / 2 + 3, 13, 6, 0, Math.PI, 0); ctx.fill();
      // patinha
      ctx.fillStyle = shade(color, 0.15);
      ctx.beginPath(); ctx.ellipse(w / 2, h / 2 + 8, 3.4, 2.6, 0, 0, Math.PI * 2); ctx.fill();
      for (const [dx, dy] of [[-4, 4.5], [-1.5, 3], [1.5, 3], [4, 4.5]]) { ctx.beginPath(); ctx.arc(w / 2 + dx, h / 2 + dy, 1.3, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case 'pokelamp': {
      const night = extra.night, cx = w / 2, cy = -TS * 0.5 + 16;
      if (night) glowAt(ctx, cx, cy, 24, '#fff3a0', 0.6);
      shadow(12, h - 9, w - 24, 6);
      ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.ellipse(cx, h - 10, 10, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a3a42'; ctx.fillRect(cx - 2, cy + 12, 4, h - 10 - cy - 12);
      ctx.fillStyle = '#5a5f6b'; ctx.fillRect(cx - 0.5, cy + 12, 1, h - 10 - cy - 12);
      const r = 13;
      ctx.fillStyle = night ? '#ff7a6b' : '#e3403b'; ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 0); ctx.fill();
      ctx.fillStyle = night ? '#fff6c8' : '#f4f4f4'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI); ctx.fill();
      ctx.strokeStyle = '#262626'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.stroke();
      ctx.fillStyle = night ? '#fffbe0' : '#ffffff'; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (night) glowAt(ctx, cx, cy, 6, '#ffffff', 0.7);
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(cx - 5, cy - 7, 3.5, 2, -0.6, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'pokeclock': {
      const cx = w / 2, cy = 21, r = 15;
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.arc(cx + 1.5, cy + 2, r + 1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e3403b'; ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#f6f6f6'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI); ctx.fill();
      ctx.strokeStyle = '#262626'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.stroke();
      for (let k = 0; k < 12; k++) {
        if (k % 3 === 0) continue;
        const a = k * Math.PI / 6;
        ctx.fillStyle = Math.sin(a) < 0 ? '#ffffff' : '#262626';
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4), 0.9, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - 1, cy - r + 2, 2, 3);
      ctx.fillStyle = '#262626'; ctx.fillRect(cx - 1, cy + r - 5, 2, 3);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - 6, cy - 5); ctx.moveTo(cx, cy); ctx.lineTo(cx + 5, cy - 9); ctx.stroke();
      ctx.strokeStyle = '#262626'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - 6, cy - 5); ctx.moveTo(cx, cy); ctx.lineTo(cx + 5, cy - 9); ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx, cy, 3.6, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(cx - 7, cy - 8, 3, 1.6, -0.6, 0, Math.PI * 2); ctx.fill();
      break;
    }
    // ================================================================ times (cores do clube + escudo genérico)
    case 'clubbed': {
      shadow();
      const trim = def && def.trim ? def.trim : woodD;
      ctx.fillStyle = woodD; roundRect(ctx, 3, 2, w - 6, h - 6, 6); ctx.fill();
      ctx.fillStyle = trim; roundRect(ctx, 3, 0, w - 6, 8, 4); ctx.fill();
      ctx.fillStyle = '#ffffff'; roundRect(ctx, 7, 6, w - 14, h - 16, 5); ctx.fill();
      // travesseiro
      ctx.fillStyle = '#f4f4f8'; roundRect(ctx, 10, 10, w - 20, h * 0.2, 6); ctx.fill();
      ctx.strokeStyle = def && def.colors ? (lumOf(def.colors[0]) > 0.8 ? trim : def.colors[0]) : color; ctx.lineWidth = 2;
      roundRect(ctx, 11.5, 11.5, w - 23, h * 0.2 - 3, 5); ctx.stroke();
      // cobertor com o padrão
      const by = h * 0.36, bh = h * 0.64 - 10;
      ctx.save(); roundRect(ctx, 7, by, w - 14, bh, 5); ctx.clip();
      if (def && def.colors) clubPattern(ctx, def, 7, by, w - 14, bh, 6); else { ctx.fillStyle = color; ctx.fillRect(7, by, w - 14, bh); }
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(7, by + bh - 6, w - 14, 6);
      ctx.restore();
      ctx.fillStyle = trim; ctx.fillRect(7, by, w - 14, 5);
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(7, by, w - 14, 1.5);
      if (def && def.club) clubCrest(ctx, def, w / 2, by + bh * 0.52, 15);
      break;
    }
    case 'clubrug': {
      const trim = def && def.trim ? def.trim : shade(color, -0.3);
      ctx.strokeStyle = '#f4efe0'; ctx.lineWidth = 1.2;
      for (let x = 10; x < w - 8; x += 4) { ctx.beginPath(); ctx.moveTo(x, 1); ctx.lineTo(x, 6); ctx.moveTo(x, h - 6); ctx.lineTo(x, h - 1); ctx.stroke(); }
      ctx.fillStyle = trim; roundRect(ctx, 4, 4, w - 8, h - 8, 6); ctx.fill();
      ctx.save(); roundRect(ctx, 9, 9, w - 18, h - 18, 4); ctx.clip();
      if (def && def.colors) clubPattern(ctx, def, 9, 9, w - 18, h - 18, 10); else { ctx.fillStyle = color; ctx.fillRect(9, 9, w - 18, h - 18); }
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.5; roundRect(ctx, 12, 12, w - 24, h - 24, 3); ctx.stroke();
      if (def && def.club) {
        ctx.fillStyle = rgba(trim, 0.35); ctx.beginPath(); ctx.arc(w / 2, h / 2 + 2, 22, 0, Math.PI * 2); ctx.fill();
        clubCrest(ctx, def, w / 2, h / 2 + 3, 26);
      }
      break;
    }
    case 'clubflag': {
      const y0 = 6, trim = def && def.trim ? def.trim : '#ffffff';
      ctx.strokeStyle = '#5a4436'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(8, y0 + 1); ctx.lineTo(w / 2, y0 - 4); ctx.lineTo(w - 8, y0 + 1); ctx.stroke();
      const flag = () => { ctx.beginPath(); ctx.moveTo(9, y0 + 3); ctx.lineTo(w - 9, y0 + 3); ctx.lineTo(w - 9, y0 + 24); ctx.lineTo(w / 2, y0 + 34); ctx.lineTo(9, y0 + 24); ctx.closePath(); };
      ctx.save(); ctx.translate(1.5, 2); flag(); ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fill(); ctx.restore();
      ctx.save(); flag(); ctx.clip();
      if (def && def.colors) clubPattern(ctx, def, 9, y0 + 3, w - 18, 31, 5); else { ctx.fillStyle = color; ctx.fillRect(9, y0 + 3, w - 18, 31); }
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(w / 2, y0 + 3, w / 2, 31);
      ctx.restore();
      flag(); ctx.strokeStyle = trim; ctx.lineWidth = 1.5; ctx.stroke();
      if (def && def.club) clubCrest(ctx, def, w / 2, y0 + 17, 11, false);
      ctx.fillStyle = woodD; roundRect(ctx, 5, y0, w - 10, 3.5, 1.5); ctx.fill();
      ctx.fillStyle = '#e2b13c';
      for (const [x, y, r] of [[5, y0 + 1.7, 2.2], [w - 5, y0 + 1.7, 2.2], [w / 2, y0 - 4, 1.4]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = trim; ctx.beginPath(); ctx.arc(w / 2, y0 + 35, 1.8, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(w / 2 - 0.6, y0 + 35, 1.2, 4);
      break;
    }
    case 'clubpouf': {
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(w / 2 + 1, h - 9, 21, 5, 0, 0, Math.PI * 2); ctx.fill();
      const bag = () => { ctx.beginPath(); ctx.moveTo(4, h - 14); ctx.bezierCurveTo(1, 20, 12, 3, w / 2 + 2, 3); ctx.bezierCurveTo(w - 9, 3, w - 1, 20, w - 4, h - 14); ctx.quadraticCurveTo(w / 2, h - 2, 4, h - 14); ctx.closePath(); };
      ctx.save(); bag(); ctx.clip();
      if (def && def.colors) clubPattern(ctx, def, 0, 2, w, h - 4, 6); else { ctx.fillStyle = color; ctx.fillRect(0, 0, w, h); }
      const sg = ctx.createRadialGradient(w / 2 - 8, 12, 2, w / 2, h / 2, w * 0.6);
      sg.addColorStop(0, 'rgba(255,255,255,0.3)'); sg.addColorStop(0.5, 'rgba(255,255,255,0)'); sg.addColorStop(1, 'rgba(0,0,0,0.3)');
      ctx.fillStyle = sg; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.14)'; ctx.beginPath(); ctx.ellipse(w / 2, h - 12, 20, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      bag(); ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.stroke();
      // costura da base no detalhe do clube
      ctx.strokeStyle = def && def.trim ? def.trim : shade(color, -0.3); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(6, h - 17); ctx.quadraticCurveTo(w / 2, h - 5, w - 6, h - 17); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(10, 17); ctx.quadraticCurveTo(w / 2, 24, w - 10, 17); ctx.stroke();
      if (def && def.club) clubCrest(ctx, def, w / 2 + 1, 25, 12, false);
      break;
    }
    case 'clubcrest': {
      const y0 = 5, main = def && def.colors ? def.colors[0] : color;
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(8, y0 + 2, w - 12, 35);
      ctx.fillStyle = '#5b3a22'; ctx.fillRect(6, y0, w - 12, 35);
      ctx.fillStyle = '#e2b13c'; ctx.fillRect(8, y0 + 2, w - 16, 31);
      ctx.fillStyle = main; ctx.fillRect(9.5, y0 + 3.5, w - 19, 28);
      ctx.save(); ctx.beginPath(); ctx.rect(9.5, y0 + 3.5, w - 19, 28); ctx.clip();
      ctx.fillStyle = lumOf(main) > 0.6 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.09)';
      for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(w / 2, y0 + 20); ctx.arc(w / 2, y0 + 20, 30, k * Math.PI / 3, k * Math.PI / 3 + Math.PI / 6); ctx.fill(); }
      ctx.restore();
      if (def && def.club) clubCrest(ctx, def, w / 2, y0 + 20, 15);
      ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.moveTo(10, y0 + 12); ctx.lineTo(19, y0 + 4); ctx.lineTo(23, y0 + 4); ctx.lineTo(10, y0 + 16); ctx.fill();
      break;
    }
    // ---- objetos fixos de prédios
    case 'healer': {
      shadow();
      ctx.fillStyle = '#e8e8ee'; roundRect(ctx, 3, -TS * 0.5 + 4, w - 6, h + TS * 0.5 - 12, 6); ctx.fill();
      ctx.fillStyle = '#e3403b'; ctx.fillRect(3, -TS * 0.5 + 4, w - 6, 8);
      for (let i = 0; i < 6; i++) pokeballSmall(ctx, 12 + (i % 3) * 12, -6 + Math.floor(i / 3) * 12, 4.5);
      break;
    }
    case 'board': {
      ctx.fillStyle = '#5b4632'; roundRect(ctx, 4, -TS * 0.4 + 8, w - 8, TS * 0.7, 4); ctx.fill();
      ctx.fillStyle = '#e9e0cc'; ctx.fillRect(8, -TS * 0.4 + 12, w - 16, TS * 0.7 - 8);
      ctx.fillStyle = '#e3403b'; ctx.fillRect(12, -TS * 0.4 + 16, 10, 8); ctx.fillStyle = '#3a68c9'; ctx.fillRect(26, -TS * 0.4 + 18, 12, 10);
      break;
    }
    case 'mirror': {
      ctx.fillStyle = '#d8b46a'; roundRect(ctx, 8, -TS * 0.6 + 4, w - 16, h + TS * 0.6 - 10, 12); ctx.fill();
      const g = ctx.createLinearGradient(0, -TS * 0.6, w, h);
      g.addColorStop(0, '#eef8ff'); g.addColorStop(1, '#9fc6e6');
      ctx.fillStyle = g; roundRect(ctx, 12, -TS * 0.6 + 8, w - 24, h + TS * 0.6 - 18, 10); ctx.fill();
      break;
    }
    case 'rack': {
      shadow();
      ctx.strokeStyle = '#8c8f99'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(6, h - 6); ctx.lineTo(6, -TS * 0.4); ctx.lineTo(w - 6, -TS * 0.4); ctx.lineTo(w - 6, h - 6); ctx.stroke();
      const cols = ['#e3403b', '#3a68c9', '#f2c230', '#45b864', '#ef7fb3', '#7b52c2', '#2f2f36'];
      for (let i = 0; i < 6; i++) { ctx.fillStyle = cols[i % cols.length]; roundRect(ctx, 10 + i * ((w - 26) / 6), -TS * 0.4 + 4, (w - 26) / 6 + 2, TS * 0.8, 3); ctx.fill(); }
      break;
    }
    case 'gymStatue': {
      shadow(8, h - 8, w - 16, 7);
      ctx.fillStyle = '#c3c7cf'; ctx.fillRect(8, h - 20, w - 16, 14);
      ctx.fillStyle = '#d8dce3'; ctx.beginPath(); ctx.moveTo(14, h - 20); ctx.lineTo(w / 2, -TS * 0.9); ctx.lineTo(w - 14, h - 20); ctx.closePath(); ctx.fill();
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(w / 2, h / 2 - 16, 8, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'gymPlatform': {
      ctx.fillStyle = rgba(color, 0.35); ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w / 2 - 4, h / 2 - 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = rgba(color, 0.8); ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w / 2 - 8, h / 2 - 8, 0, 0, Math.PI * 2); ctx.stroke();
      break;
    }
    case 'starterTable': {
      shadow();
      ctx.fillStyle = woodD; ctx.fillRect(8, 22, 5, h - 26); ctx.fillRect(w - 13, 22, 5, h - 26);
      ctx.fillStyle = woodL; roundRect(ctx, 3, 8, w - 6, 20, 4); ctx.fill();
      for (let i = 0; i < 3; i++) pokeballSmall(ctx, w / 2 + (i - 1) * TS * 0.8, 12, 8);
      break;
    }
    case 'machine': case 'generator': {
      shadow();
      ctx.fillStyle = art === 'generator' ? '#8e9198' : '#cfd6de'; roundRect(ctx, 4, -TS * 0.8 + 6, w - 8, h + TS * 0.8 - 14, 5); ctx.fill();
      ctx.fillStyle = '#2d5f9e'; ctx.fillRect(10, -TS * 0.8 + 12, w - 20, 16);
      ctx.fillStyle = '#7fe08f'; ctx.fillRect(12, -TS * 0.8 + 16, 8, 3);
      ctx.fillStyle = art === 'generator' ? '#f2c230' : '#e3403b';
      ctx.beginPath(); ctx.arc(w / 2, h - 18, 5, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'stage': {
      ctx.fillStyle = '#c94f7c'; roundRect(ctx, 2, 4, w - 4, h - 8, 8); ctx.fill();
      ctx.fillStyle = '#f2c230'; ctx.fillRect(2, h - 14, w - 4, 6);
      break;
    }
    case 'grave': {
      shadow(10, h - 8, w - 20, 6);
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, '#a7a3ad'); g.addColorStop(1, '#7c7883');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(12, h - 8); ctx.lineTo(12, h - 34); ctx.quadraticCurveTo(w / 2, -14, w - 12, h - 34); ctx.lineTo(w - 12, h - 8); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#5c5864'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w / 2, h - 36); ctx.lineTo(w / 2, h - 18); ctx.moveTo(w / 2 - 6, h - 30); ctx.lineTo(w / 2 + 6, h - 30); ctx.stroke();
      break;
    }
    case 'oldfurniture': {
      shadow();
      ctx.fillStyle = '#5a4436'; roundRect(ctx, 4, -TS * 0.6 + 4, w - 8, h + TS * 0.6 - 12, 4); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(w - 10, 18); ctx.stroke();
      ctx.fillStyle = 'rgba(200,200,220,0.2)'; ctx.beginPath(); ctx.arc(w - 10, -TS * 0.6 + 8, 8, 0, Math.PI / 2); ctx.fill();
      break;
    }
    case 'pillar': {
      shadow(8, h - 8, w - 16, 7);
      const g = ctx.createLinearGradient(10, 0, w - 10, 0);
      g.addColorStop(0, '#d6c8a6'); g.addColorStop(1, '#a8987a');
      ctx.fillStyle = g; ctx.fillRect(12, -TS * 1.2, w - 24, h + TS * 1.2 - 10);
      ctx.fillStyle = '#9c8a6a'; ctx.fillRect(8, -TS * 1.2 - 4, w - 16, 8); ctx.fillRect(8, h - 14, w - 16, 8);
      break;
    }
    case 'jacuzzi': {
      shadow();
      ctx.fillStyle = '#eef1f4'; roundRect(ctx, 3, 3, w - 6, h - 8, 16); ctx.fill();
      ctx.fillStyle = '#c9d0d8'; roundRect(ctx, 3, h - 16, w - 6, 11, 6); ctx.fill();
      const g = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
      g.addColorStop(0, '#8fe6ff'); g.addColorStop(1, '#2a9fd6');
      ctx.fillStyle = g; roundRect(ctx, 11, 11, w - 22, h - 28, 12); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (let k = 0; k < 9; k++) { ctx.beginPath(); ctx.arc(18 + ((k * 23) % (w - 36)), 18 + ((k * 17) % (h - 40)), 2 + (k % 3), 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case 'pooltable': {
      shadow();
      ctx.fillStyle = woodD; ctx.fillRect(10, h - 16, 8, 12); ctx.fillRect(w - 18, h - 16, 8, 12);
      ctx.fillStyle = '#6e4222'; roundRect(ctx, 3, 4, w - 6, h - 18, 8); ctx.fill();
      ctx.fillStyle = '#2f8a49'; roundRect(ctx, 11, 12, w - 22, h - 34, 4); ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      for (const [x, y] of [[12, 13], [w / 2, 11], [w - 12, 13], [12, h - 23], [w / 2, h - 21], [w - 12, h - 23]]) { ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); }
      const balls = ['#efc23a', '#3a68c9', '#d8433c', '#7b52c2', '#ee8a33', '#2f2f36'];
      balls.forEach((c, k) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(w * 0.62 + (k % 3) * 9, h * 0.32 + Math.floor(k / 3) * 9, 4, 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(w * 0.28, h * 0.38, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#d9b27a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(w * 0.05, h * 0.62); ctx.lineTo(w * 0.26, h * 0.4); ctx.stroke();
      break;
    }
    case 'lounger': {
      shadow();
      ctx.fillStyle = '#c9ced6'; ctx.fillRect(10, h - 14, 4, 10); ctx.fillRect(w - 14, h - 14, 4, 10);
      ctx.fillStyle = '#ffffff'; roundRect(ctx, 6, 6, w - 12, h - 18, 6); ctx.fill();
      ctx.fillStyle = color; roundRect(ctx, 9, 9, w - 18, h - 24, 5); ctx.fill();
      ctx.fillStyle = shade(color, 0.25); roundRect(ctx, 9, 9, w - 18, TS * 0.5, 5); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; for (let y = 22 + TS * 0.4; y < h - 18; y += 12) ctx.fillRect(9, y, w - 18, 2);
      break;
    }
    case 'fountain': {
      shadow(4, h - 10, w - 8, 9);
      ctx.fillStyle = '#d6d9de'; ctx.beginPath(); ctx.ellipse(w / 2, h - 22, w / 2 - 4, h * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4fb8e6'; ctx.beginPath(); ctx.ellipse(w / 2, h - 24, w / 2 - 12, h * 0.22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c9ced6'; ctx.fillRect(w / 2 - 6, -TS * 0.3, 12, h - 10);
      ctx.fillStyle = '#d6d9de'; ctx.beginPath(); ctx.ellipse(w / 2, -TS * 0.3 + 6, 22, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(160,225,255,0.9)'; ctx.lineWidth = 3;
      for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(w / 2, -TS * 0.3); ctx.quadraticCurveTo(w / 2 + k * 30, -TS * 0.45, w / 2 + k * 34, h - 30); ctx.stroke(); }
      break;
    }
    case 'chandelier': {
      ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, 12); ctx.stroke();
      ctx.fillStyle = '#e2b13c'; ctx.beginPath(); ctx.ellipse(w / 2, 18, 18, 6, 0, 0, Math.PI * 2); ctx.fill();
      for (let k = 0; k < 5; k++) {
        const x = w / 2 - 16 + k * 8;
        ctx.fillStyle = 'rgba(220,245,255,0.95)'; ctx.beginPath(); ctx.moveTo(x, 22); ctx.lineTo(x + 3, 32); ctx.lineTo(x, 38); ctx.lineTo(x - 3, 32); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = extra.night ? '#fff3a0' : '#fffbe6'; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(w / 2 - 12 + k * 12, 12, 3, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case 'icecream': {
      shadow();
      ctx.fillStyle = '#f2f2ee'; roundRect(ctx, 6, -TS * 0.5 + 4, w - 12, h + TS * 0.5 - 12, 6); ctx.fill();
      ctx.fillStyle = '#ef7fb3'; ctx.fillRect(6, -TS * 0.5 + 4, w - 12, 10);
      ctx.fillStyle = '#bfe6ff'; ctx.fillRect(10, -TS * 0.5 + 18, w - 20, 16);
      ['#ef7fb3', '#f6e2b3', '#7a5234'].forEach((c, k) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(16 + k * 8, -TS * 0.5 + 28, 4, 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = '#c9ced6'; ctx.fillRect(w / 2 - 4, h / 2 - 2, 8, 10);
      break;
    }
    case 'arcade': {
      shadow();
      ctx.fillStyle = '#3a2f6a'; roundRect(ctx, 6, -TS * 0.7 + 4, w - 12, h + TS * 0.7 - 10, 5); ctx.fill();
      ctx.fillStyle = '#111'; ctx.fillRect(10, -TS * 0.7 + 12, w - 20, 22);
      ctx.fillStyle = '#45e06a'; ctx.fillRect(14, -TS * 0.7 + 18, 6, 6); ctx.fillStyle = '#ffd34d'; ctx.fillRect(26, -TS * 0.7 + 22, 4, 4);
      ctx.fillStyle = '#e3403b'; ctx.beginPath(); ctx.arc(w / 2 - 6, h / 2 - 4, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a68c9'; ctx.beginPath(); ctx.arc(w / 2 + 6, h / 2 - 4, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ef7fb3'; ctx.fillRect(6, -TS * 0.7 + 4, w - 12, 5);
      break;
    }
    case 'healer2': break;
    default: {
      ctx.fillStyle = color; roundRect(ctx, 6, 6, w - 12, h - 12, 6); ctx.fill();
    }
  }
}

// Retângulo com conteúdo visível de um sprite (para enquadrar os ícones).
function spriteBounds(canvas) {
  if (canvas.bb) return canvas.bb;
  let bb = [0, 0, canvas.width, canvas.height];
  try {
    const W = canvas.width, H = canvas.height;
    const d = canvas.getContext('2d').getImageData(0, 0, W, H).data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (d[(y * W + x) * 4 + 3] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 >= 0) bb = [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
  } catch (e) { /* canvas contaminado: usa o quadro todo */ }
  canvas.bb = bb;
  return bb;
}

function paintIcon(c, id) {
  const def = FURNITURE[id];
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  if (!def) return;
  const { canvas } = objectSprite({ kind: 'furniture', item: id, w: def.w, h: def.h });
  const [bx, by, bw, bh] = spriteBounds(canvas);
  const pad = Math.round(c.width * 0.05);
  // encaixa o conteúdo visível, sem ampliar demais itens pequenos (bola, relógio...)
  const tileFit = (c.width - pad * 2) / (TS * PR);
  const s = Math.min((c.width - pad * 2) / bw, (c.height - pad * 2) / bh, tileFit * 1.3);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, bx, by, bw, bh, (c.width - bw * s) / 2, (c.height - bh * s) / 2, bw * s, bh * s);
}

// ícone de móvel para listas (canvas pequeno). Bonecos dependem do sprite do
// Pokémon: o canvas volta na hora e é redesenhado quando a imagem carregar.
export function furnitureIcon(id, size = 60) {
  const def = FURNITURE[id];
  const c = makeCanvas(size * 2, size * 2);
  paintIcon(c, id);
  if (def && def.species) {
    const url = spriteUrl.frontStatic(def.species);
    if (!imageNow(url)) loadImage(url).then((img) => { if (img) paintIcon(c, id); });
  }
  void mix;
  return c;
}

// ------------------------------------------------------------ objetos das mecânicas do Diamond
const BERRY_COLOR = {
  oran: '#3a68c9', pecha: '#ef7fb3', cheri: '#d8433c', chesto: '#7b52c2', rawst: '#3f9a54', aspear: '#efc23a',
  persim: '#ee8a33', razz: '#d8435c', sitrus: '#f2d24a', leppa: '#c4402c', lum: '#4fbf5a',
};

export function berryTreeSprite(berry, ripe) {
  const color = BERRY_COLOR[berry] || '#d8433c';
  return cached(`berrytree:${berry}:${ripe ? 1 : 0}`, TS, TS * 1.5, (ctx, w, h) => {
    const cx = w / 2, by = h - 6;
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(cx + 2, by, 15, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a4c27'; ctx.fillRect(cx - 4, by - 18, 8, 18);
    ctx.fillStyle = '#8a5a34'; ctx.fillRect(cx - 10, by - 4, 20, 4);
    const leaf = (x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
    leaf(cx, by - 30, 16, '#3f8f3a'); leaf(cx - 10, by - 24, 11, '#357a32'); leaf(cx + 10, by - 24, 11, '#357a32');
    leaf(cx - 4, by - 36, 9, '#58b04e'); leaf(cx + 6, by - 33, 6, '#6cc45d');
    if (ripe) {
      for (const [x, y] of [[-9, -26], [7, -34], [10, -21], [-3, -18], [-12, -35], [2, -27]]) {
        leaf(cx + x, by + y, 4.5, color);
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(cx + x - 1.5, by + y - 1.5, 1.4, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      for (const [x, y] of [[-8, -28], [8, -24], [0, -38]]) leaf(cx + x, by + y, 2.5, '#fff6c8');
    }
  });
}

// state: none | wait | ready | dry
export function honeyTreeSprite(state) {
  return cached(`honeytree:${state}`, TS, TS * 2, (ctx, w, h) => {
    const cx = w / 2, by = h - 6;
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(cx + 2, by, 18, 6, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createLinearGradient(cx - 9, 0, cx + 9, 0);
    g.addColorStop(0, '#b8862e'); g.addColorStop(1, '#8a5f1e');
    ctx.fillStyle = g; ctx.fillRect(cx - 8, by - 40, 16, 40);
    ctx.fillStyle = '#d9a63a'; ctx.fillRect(cx - 3, by - 34, 3, 26);
    const leaf = (x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
    leaf(cx, by - 62, 22, '#c9a227'); leaf(cx - 15, by - 50, 14, '#b08a1f'); leaf(cx + 15, by - 50, 14, '#b08a1f'); leaf(cx - 4, by - 72, 12, '#e2bf3d');
    if (state === 'wait' || state === 'ready') {
      ctx.fillStyle = '#f5b82e';
      ctx.beginPath(); ctx.ellipse(cx, by - 26, 7, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(cx - 2, by - 18, 4, 9);
      ctx.beginPath(); ctx.arc(cx, by - 8, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(cx - 3, by - 32, 2, 8);
    }
  });
}

export function digSpotSprite(ready) {
  return cached(`dig:${ready ? 1 : 0}`, TS, TS * 1.3, (ctx, w, h) => {
    const by = h - 4;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(w / 2, by, 20, 5, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createLinearGradient(0, by - 50, 0, by);
    g.addColorStop(0, '#a08a72'); g.addColorStop(1, '#6d5a48');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(4, by); ctx.lineTo(8, by - 34); ctx.lineTo(20, by - 52); ctx.lineTo(36, by - 48); ctx.lineTo(w - 4, by - 30); ctx.lineTo(w - 2, by); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = ready ? '#ffe27a' : 'rgba(40,30,20,0.6)'; ctx.lineWidth = ready ? 2.5 : 2;
    ctx.beginPath(); ctx.moveTo(14, by - 40); ctx.lineTo(22, by - 28); ctx.lineTo(18, by - 18); ctx.moveTo(22, by - 28); ctx.lineTo(32, by - 24); ctx.lineTo(36, by - 12); ctx.stroke();
    if (ready) {
      ctx.fillStyle = '#fff6b0';
      for (const [x, y, r] of [[12, -44, 3], [34, -36, 2.5], [26, -16, 2], [40, -22, 3]]) {
        ctx.beginPath(); ctx.moveTo(x, by + y - r * 2); ctx.lineTo(x + r * 0.6, by + y - r * 0.6); ctx.lineTo(x + r * 2, by + y); ctx.lineTo(x + r * 0.6, by + y + r * 0.6);
        ctx.lineTo(x, by + y + r * 2); ctx.lineTo(x - r * 0.6, by + y + r * 0.6); ctx.lineTo(x - r * 2, by + y); ctx.lineTo(x - r * 0.6, by + y - r * 0.6); ctx.closePath(); ctx.fill();
      }
    }
  });
}

export function trashSprite() {
  return cached('trash', TS, TS, (ctx, w, h) => {
    const by = h - 8;
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(w / 2, by + 2, 16, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a3f4a'; ctx.beginPath(); ctx.ellipse(w / 2 - 4, by - 9, 11, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b2e36'; ctx.fillRect(w / 2 - 7, by - 24, 6, 6);
    ctx.fillStyle = '#f2f2ee'; ctx.save(); ctx.translate(w / 2 + 10, by - 4); ctx.rotate(0.4); ctx.fillRect(-6, -4, 12, 8); ctx.restore();
    ctx.fillStyle = '#e3403b'; ctx.fillRect(w / 2 + 2, by - 6, 6, 9);
    ctx.fillStyle = '#efc23a'; ctx.fillRect(w / 2 + 3, by - 8, 4, 3);
  });
}

export function truckSprite() {
  return cached('truck', TS * 2, TS * 1.6, (ctx, w, h) => {
    const by = h - 6;
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; roundRect(ctx, 6, by - 6, w - 8, 10, 5); ctx.fill();
    ctx.fillStyle = '#e9ecef'; roundRect(ctx, 4, by - 50, w * 0.62, 42, 4); ctx.fill();
    ctx.strokeStyle = '#b9c0c8'; ctx.lineWidth = 2; ctx.strokeRect(5, by - 49, w * 0.62 - 2, 40);
    ctx.fillStyle = '#c94f4a'; roundRect(ctx, w * 0.64, by - 38, w * 0.33, 30, 5); ctx.fill();
    ctx.fillStyle = '#9fd0f0'; ctx.fillRect(w * 0.7, by - 34, w * 0.2, 11);
    ctx.fillStyle = 'rgba(140,90,40,0.35)'; ctx.fillRect(10, by - 30, 30, 6); ctx.fillRect(28, by - 44, 18, 4);
    for (const x of [w * 0.18, w * 0.5, w * 0.82]) {
      ctx.fillStyle = '#26292f'; ctx.beginPath(); ctx.arc(x, by - 6, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8b8f99'; ctx.beginPath(); ctx.arc(x, by - 6, 3, 0, Math.PI * 2); ctx.fill();
    }
  });
}
