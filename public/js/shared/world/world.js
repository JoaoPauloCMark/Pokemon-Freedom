// Gerador determinístico do mundo aberto. Mesmo resultado no cliente e no servidor.
import { W, H, T, sc, BUILDINGS, ZONES, ZONE_INDEX, CITIES, ROUTES, AREAS, LANDMARKS, MAINLAND, LEGENDS, isPassable, isWalkable } from './defs.js';
import { makeNoise, hash2, mulberry32 } from '../rng.js';

const SEED = 20061128;

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  const x = ax + t * dx, y = ay + t * dy;
  return Math.hypot(px - x, py - y);
}

// Catmull-Rom para deixar as rotas curvas e naturais
function spline(pts, step = 0.35) {
  if (pts.length < 2) return pts.slice();
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const n = Math.max(2, Math.ceil(len / step));
    for (let s = 0; s < n; s++) {
      const t = s / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

const GAP = 2, ROAD = 3, MARGIN = 3, WALKW = 2;

// Calcula a planta de uma cidade (posições dos prédios, ruas, âncoras).
function layoutCity(city) {
  const rows = city.rows.map((types) => {
    const half = Math.ceil(types.length / 2);
    const left = types.slice(0, half), right = types.slice(half);
    const wsum = (arr) => arr.reduce((a, t) => a + BUILDINGS[t].w, 0) + GAP * Math.max(0, arr.length - 1);
    return { left, right, lw: wsum(left), rw: wsum(right), h: Math.max(...types.map((t) => BUILDINGS[t].h)) };
  });
  const half = Math.max(...rows.map((r) => Math.max(r.lw, r.rw)));
  const w = 2 * (half + GAP) + ROAD + 2 * MARGIN;
  const h = MARGIN + rows.reduce((a, r) => a + r.h + WALKW + 1, 0) + MARGIN - 1;
  const x0 = city.cx - Math.floor(w / 2), y0 = city.cy - Math.floor(h / 2);
  const roadX = x0 + MARGIN + half + GAP;
  const buildings = [];
  const walkways = [];
  let y = y0 + MARGIN;
  let plotN = 0;
  for (const r of rows) {
    const bottom = y + r.h - 1;
    let x = roadX - GAP;
    for (let i = r.left.length - 1; i >= 0; i--) {
      const t = r.left[i], b = BUILDINGS[t];
      x -= b.w;
      buildings.push({ type: t, x, y: bottom - b.h + 1, w: b.w, h: b.h });
      x -= GAP;
    }
    x = roadX + ROAD + GAP;
    for (const t of r.right) {
      const b = BUILDINGS[t];
      buildings.push({ type: t, x, y: bottom - b.h + 1, w: b.w, h: b.h });
      x += b.w + GAP;
    }
    walkways.push(bottom + 1);
    y = bottom + WALKW + 2;
  }
  for (const b of buildings) {
    b.city = city.id;
    b.doorX = b.x + (BUILDINGS[b.type].door ?? Math.floor(b.w / 2));
    b.doorY = b.y + b.h - 1;
    if (BUILDINGS[b.type].plot) b.plotId = `${city.id}-${++plotN}`;
  }
  const midWalk = walkways[Math.floor((walkways.length - 1) / 2)];
  return {
    x0, y0, w, h, roadX, walkways, buildings,
    anchors: {
      n: [roadX + 1, y0 - 1], s: [roadX + 1, y0 + h],
      w: [x0 - 1, midWalk], e: [x0 + w, midWalk],
    },
  };
}

export function buildWorld() {
  const t0 = Date.now();
  const tiles = new Uint8Array(W * H).fill(T.DEEP);
  const ground = new Uint8Array(W * H).fill(T.GRASS);
  const zone = new Uint8Array(W * H);
  const lake = new Uint8Array(W * H);
  const noise = makeNoise(SEED);
  const noise2 = makeNoise(SEED + 7);
  const noise3 = makeNoise(SEED + 13);
  const idx = (x, y) => y * W + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const get = (x, y) => (inb(x, y) ? tiles[idx(x, y)] : T.DEEP);
  const set = (x, y, t) => { if (inb(x, y)) tiles[idx(x, y)] = t; };
  const ellipse = (a, x, y, nz = 0.25) => {
    const dx = (x - a.cx) / a.rx, dy = (y - a.cy) / a.ry;
    return Math.sqrt(dx * dx + dy * dy) + (noise(x / 5, y / 5, 2) - 0.5) * nz;
  };

  // ---------------------------------------------------------- 1. terra
  const islands = AREAS.filter((a) => a.kind === 'island' || a.kind === 'volcano');
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const px = x + (noise(x / 7, y / 7, 3) - 0.5) * 10;
      const py = y + (noise2(x / 7, y / 7, 3) - 0.5) * 10;
      let land = pointInPoly(px, py, MAINLAND);
      for (const a of islands) if (ellipse(a, x, y, 0.35) < 1) land = true;
      if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) land = false;
      if (land) tiles[idx(x, y)] = T.GRASS;
    }
  }

  // ---------------------------------------------------------- 2. biomas (chão base)
  const biomeGround = (x, y) => {
    const n = (noise3(x / 14, y / 14, 3) - 0.5) * 30;
    if (y + n < sc(58) && x > sc(96) && x < sc(262)) return T.SNOW;
    for (const a of AREAS) {
      if (a.kind === 'desert' && ellipse(a, x, y, 0.4) < 1) return T.DESERT;
      if (a.kind === 'volcano' && ellipse(a, x, y, 0.35) < 1) return T.ASH;
    }
    return T.GRASS;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const g = biomeGround(x, y);
    ground[idx(x, y)] = g;
    if (tiles[idx(x, y)] === T.GRASS) tiles[idx(x, y)] = g;
  }

  // ---------------------------------------------------------- 3. água rasa e praias
  const distSea = new Int16Array(W * H).fill(99);
  {
    const q = [];
    for (let i = 0; i < W * H; i++) if (tiles[i] === T.DEEP) { distSea[i] = 0; }
    for (let i = 0; i < W * H; i++) if (tiles[i] !== T.DEEP) {
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (get(x + dx, y + dy) === T.DEEP) { distSea[i] = 1; q.push(i); break; }
    }
    // distância (em terra) até o mar
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi], x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!inb(nx, ny)) continue;
        const j = idx(nx, ny);
        if (tiles[j] !== T.DEEP && distSea[j] > distSea[i] + 1) { distSea[j] = distSea[i] + 1; if (distSea[j] < 6) q.push(j); }
      }
    }
    // água rasa perto da terra
    const distLand = new Int16Array(W * H).fill(99);
    const q2 = [];
    for (let i = 0; i < W * H; i++) if (tiles[i] !== T.DEEP) { distLand[i] = 0; q2.push(i); }
    for (let qi = 0; qi < q2.length; qi++) {
      const i = q2[qi], x = i % W, y = (i / W) | 0;
      if (distLand[i] >= 3) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!inb(nx, ny)) continue;
        const j = idx(nx, ny);
        if (distLand[j] > distLand[i] + 1) { distLand[j] = distLand[i] + 1; q2.push(j); }
      }
    }
    for (let i = 0; i < W * H; i++) if (tiles[i] === T.DEEP && distLand[i] <= 2) tiles[i] = T.WATER;
    for (let i = 0; i < W * H; i++) {
      const x = i % W, y = (i / W) | 0;
      if (tiles[i] !== T.DEEP && tiles[i] !== T.WATER && distSea[i] <= 2 + Math.floor(noise(x / 4, y / 4) * 2.5)) {
        if (tiles[i] === T.GRASS || tiles[i] === T.DESERT) { tiles[i] = T.SAND; ground[i] = T.SAND; }
      }
    }
  }

  // ---------------------------------------------------------- 4. montanhas e colinas
  const CORONET = [[212, 34], [211, 90], [213, 140], [214, 196], [208, 232]].map(([x, y]) => [sc(x), sc(y)]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y);
    if (tiles[i] === T.DEEP || tiles[i] === T.WATER) continue;
    let d = 99;
    for (let s = 0; s < CORONET.length - 1; s++) d = Math.min(d, distToSeg(x, y, ...CORONET[s], ...CORONET[s + 1]));
    const r = 9 + (noise(x / 6, y / 9, 3) - 0.5) * 9;
    if (d < r) tiles[i] = T.ROCK;
    for (const a of AREAS) {
      if (a.kind === 'hill' && ellipse(a, x, y, 0.3) < 1) tiles[i] = T.ROCK;
      if (a.kind === 'island' && a.zone === 'iron' && ellipse(a, x, y, 0.3) < 0.85) tiles[i] = T.ROCK;
      if (a.kind === 'island' && a.zone === 'victory' && ellipse(a, x, y, 0.3) < 0.95) tiles[i] = T.ROCK;
    }
    // rochedos de Veilstone e montanhas do norte
    if (ground[i] === T.DESERT && noise2(x / 5, y / 5, 2) > 0.66) tiles[i] = T.ROCK;
    if (y < sc(22) && x > sc(150) && x < sc(190) && noise2(x / 6, y / 4, 2) > 0.55) tiles[i] = T.ROCK;
  }
  // cavernas internas: Ilha de Ferro e Caminho da Vitória
  for (const a of AREAS) {
    if (a.kind !== 'island' || a.zone === 'stark') continue;
    for (let y = a.cy - a.ry; y <= a.cy + a.ry; y++) for (let x = a.cx - a.rx; x <= a.cx + a.rx; x++) {
      if (!inb(x, y)) continue;
      const e = ellipse(a, x, y, 0.2);
      if (e < 0.62 && noise3(x / 3, y / 3, 2) > 0.38) set(x, y, T.CAVE);
    }
  }

  // ---------------------------------------------------------- 5. lagos, pântano, vulcão, mina
  for (const a of AREAS) {
    for (let y = Math.floor(a.cy - a.ry - 3); y <= a.cy + a.ry + 3; y++) for (let x = Math.floor(a.cx - a.rx - 3); x <= a.cx + a.rx + 3; x++) {
      if (!inb(x, y)) continue;
      const i = idx(x, y);
      const e = ellipse(a, x, y, 0.3);
      if (a.kind === 'lake' && e < 1) { tiles[i] = e < 0.55 ? T.DEEP : T.WATER; lake[i] = 1; }
      if (a.kind === 'marsh' && e < 1 && tiles[i] !== T.DEEP) {
        const n = noise2(x / 3, y / 3, 2);
        tiles[i] = n > 0.62 ? T.WATER : n < 0.32 ? T.GRASS : T.MARSH;
        if (tiles[i] === T.WATER) lake[i] = 1;
        ground[i] = T.MARSH;
      }
      if (a.kind === 'volcano' && e < 1 && tiles[i] !== T.DEEP && tiles[i] !== T.WATER) {
        if (e < 0.18) tiles[i] = T.LAVA;
        else if (noise3(x / 3, y / 3, 2) > 0.66 && e > 0.3) tiles[i] = T.LAVA;
        else if (noise2(x / 3, y / 3, 2) > 0.58) tiles[i] = T.ASHTALL;
        else tiles[i] = T.ASH;
      }
      if (a.kind === 'cave' && e < 1) tiles[i] = T.ROCK;
      if (a.kind === 'cave' && e < 0.75) tiles[i] = T.CAVE;
    }
  }

  // ---------------------------------------------------------- 6. florestas, grama alta, flores
  const forestBonus = (x, y) => {
    let b = 0;
    for (const a of AREAS) if (a.kind === 'forest') { const e = ellipse(a, x, y, 0.3); if (e < 1.25) b += (1.25 - e) * 0.9; }
    if (Math.abs(x - sc(212)) < sc(34)) b += 0.08;
    if (x < sc(70) && y > sc(60) && y < sc(150)) b += 0.15;
    return b;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y);
    const t = tiles[i];
    if (t !== T.GRASS && t !== T.SNOW && t !== T.DESERT) continue;
    const n = noise(x / 8, y / 8, 3);
    const dens = 0.17 + forestBonus(x, y);
    const h = hash2(x, y, 99);
    if (t === T.DESERT) {
      if (h < 0.025) tiles[i] = T.CACTUS;
      else if (h < 0.035) tiles[i] = T.BOULDER;
      continue;
    }
    if (n > 0.72 - dens * 0.55 || h < 0.012) { tiles[i] = t === T.SNOW ? T.PINE : T.TREE; continue; }
    const g = noise2(x / 5, y / 5, 2);
    if (g > 0.6) tiles[i] = t === T.SNOW ? T.SNOWTALL : T.TALL;
    else if (t === T.GRASS && noise3(x / 6, y / 6, 2) > 0.76) tiles[i] = T.FLOWERS;
    else if (h > 0.996) tiles[i] = T.BOULDER;
  }
  // campos de flores de Floaroma
  for (let y = sc(96); y < sc(146); y++) for (let x = sc(66); x < sc(124); x++) {
    const i = idx(x, y);
    if (tiles[i] === T.GRASS && noise3(x / 4, y / 4, 2) > 0.45) tiles[i] = T.FLOWERS;
  }

  // ---------------------------------------------------------- 7. cidades (planta)
  const cityLayouts = {};
  for (const c of CITIES) cityLayouts[c.id] = layoutCity(c);
  const anchor = (s) => {
    if (Array.isArray(s)) return s;
    const [id, dir] = s.split(':');
    return cityLayouts[id].anchors[dir];
  };

  // ---------------------------------------------------------- 8. zonas das áreas
  const zid = (id) => ZONE_INDEX[id];
  for (const a of AREAS) {
    const zi = zid(a.zone);
    for (let y = Math.floor(a.cy - a.ry - 2); y <= a.cy + a.ry + 2; y++) for (let x = Math.floor(a.cx - a.rx - 2); x <= a.cx + a.rx + 2; x++) {
      if (!inb(x, y)) continue;
      if (ellipse(a, x, y, 0.3) < 1.08) zone[idx(x, y)] = zi;
    }
  }

  // ---------------------------------------------------------- 9. rotas
  const clearTo = (x, y) => {
    const i = idx(x, y);
    const t = tiles[i];
    if (t === T.TREE || t === T.PINE || t === T.BOULDER || t === T.CACTUS) tiles[i] = ground[i] === T.SAND ? T.SAND : ground[i];
  };
  const routeSamples = [];
  for (const r of ROUTES) {
    const pts = spline(r.pts.map(anchor));
    const zi = zid(r.zone);
    routeSamples.push({ r, pts, zi });
    for (const [px, py] of pts) {
      const x0 = Math.floor(px), y0 = Math.floor(py);
      for (let dy = -11; dy <= 11; dy++) for (let dx = -11; dx <= 11; dx++) {
        const x = x0 + dx, y = y0 + dy;
        if (!inb(x, y)) continue;
        const d = Math.hypot(x + 0.5 - px, y + 0.5 - py);
        const i = idx(x, y);
        if (d < 10.5 && !zone[i]) zone[i] = zi;
        if (r.sea) continue;
        const t = tiles[i];
        if (r.cave || t === T.ROCK || t === T.CAVE) {
          if (d < (r.cave ? 2.1 : 1.7) && (t === T.ROCK || t === T.CAVE)) { tiles[i] = T.CAVE; if (r.cave) zone[i] = zi; }
          if (r.cave) continue;
        }
        if (d < 1.15) {
          if (t === T.WATER || t === T.DEEP) { if (r.bridge) tiles[i] = T.BRIDGE; }
          else if (t !== T.CAVE && t !== T.BRIDGE) tiles[i] = ground[i] === T.SNOW ? T.SNOW : ground[i] === T.DESERT ? T.DESERT : ground[i] === T.ASH ? T.ASH : T.PATH;
        } else if (d < 4.2) {
          clearTo(x, y);
          if (tiles[i] === T.TALL && d < 2.2) tiles[i] = T.GRASS;
        } else if (d < 9.5) {
          if (tiles[i] === T.GRASS && noise2(x / 3.2, y / 3.2, 2) > 0.5) tiles[i] = T.TALL;
          if (tiles[i] === T.SNOW && noise2(x / 3.2, y / 3.2, 2) > 0.5) tiles[i] = T.SNOWTALL;
        }
      }
    }
  }
  // câmaras do Monte Coronet
  for (const [cx, cy, r] of [[213, 120, 4], [213, 156, 4.5], [210, 56, 3.5], [212, 100, 3], [213, 176, 3]].map(([a, b, c]) => [sc(a), sc(b), c * 1.2])) {
    for (let y = cy - 6; y <= cy + 6; y++) for (let x = cx - 6; x <= cx + 6; x++) {
      if (Math.hypot(x - cx, y - cy) + (noise(x / 2, y / 2) - 0.5) * 2 < r) { set(x, y, T.CAVE); zone[idx(x, y)] = zid('coronet'); }
    }
  }

  // ---------------------------------------------------------- 10. carimbar cidades
  const buildings = [];
  const objects = [];
  for (const c of CITIES) {
    const L = cityLayouts[c.id];
    const zi = zid(c.id);
    const snow = c.theme === 'snow';
    for (let y = L.y0 - 2; y < L.y0 + L.h + 2; y++) for (let x = L.x0 - 2; x < L.x0 + L.w + 2; x++) {
      if (!inb(x, y)) continue;
      const i = idx(x, y);
      zone[i] = zi;
      const inside = x >= L.x0 && x < L.x0 + L.w && y >= L.y0 && y < L.y0 + L.h;
      if (inside) { tiles[i] = snow ? T.SNOW : T.CITYGRASS; ground[i] = snow ? T.SNOW : T.CITYGRASS; }
      else if (!isPassable(tiles[i]) || tiles[i] === T.TALL || tiles[i] === T.SNOWTALL) tiles[i] = snow ? T.SNOW : T.GRASS;
    }
    // ruas
    for (let y = L.y0; y < L.y0 + L.h; y++) for (let x = L.roadX; x < L.roadX + ROAD; x++) set(x, y, T.PAVE);
    for (const wy of L.walkways) for (let y = wy; y < wy + WALKW; y++) for (let x = L.x0; x < L.x0 + L.w; x++) set(x, y, c.theme === 'luxury' ? T.PLAZA : T.PAVE);
    // praça central nas cidades grandes
    if (c.big) {
      const wy = L.walkways[1] || L.walkways[0];
      for (let y = wy - 1; y < wy + WALKW + 1; y++) for (let x = L.roadX - 2; x < L.roadX + ROAD + 2; x++) set(x, y, T.PLAZA);
    }
    // prédios
    for (const b of L.buildings) {
      for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) set(x, y, T.BUILDING);
      set(b.doorX, b.doorY, BUILDINGS[b.type].deco ? T.BUILDING : T.DOOR);
      b.id = `${c.id}:${b.type}:${b.x}`;
      b.name = BUILDINGS[b.type].name;
      buildings.push(b);
    }
    // postes de luz e placas
    const lampsAt = [];
    for (const wy of L.walkways) {
      for (let x = L.x0 + 2; x < L.x0 + L.w - 2; x += 6) {
        const y = wy - 1;
        if (get(x, y) === T.CITYGRASS || get(x, y) === T.SNOW) lampsAt.push([x, y]);
      }
    }
    for (const [x, y] of lampsAt) { objects.push({ kind: 'lamp', x, y }); }
    objects.push({ kind: 'sign', x: L.roadX - 1, y: L.y0 + L.h - 1, text: `${c.name}\n${c.desc}` });
    c.layout = L;
  }

  // ---------------------------------------------------------- 11. marcos fora das cidades
  for (const lm of LANDMARKS) {
    const b = BUILDINGS[lm.type];
    const bx = lm.x - Math.floor(b.w / 2), by = lm.y - b.h + 1;
    for (let y = by - 2; y < by + b.h + 3; y++) for (let x = bx - 2; x < bx + b.w + 2; x++) {
      if (!inb(x, y)) continue;
      const t = tiles[idx(x, y)];
      if (!isPassable(t) || t === T.TALL || t === T.LAVA) tiles[idx(x, y)] = ground[idx(x, y)] === T.SNOW ? T.SNOW : T.GRASS;
    }
    for (let y = by; y < by + b.h; y++) for (let x = bx; x < bx + b.w; x++) set(x, y, T.BUILDING);
    const doorX = bx + Math.floor(b.w / 2), doorY = by + b.h - 1;
    set(doorX, doorY, T.DOOR);
    for (let y = doorY + 1; y < doorY + 3; y++) set(doorX, y, T.PATH);
    buildings.push({ type: lm.type, x: bx, y: by, w: b.w, h: b.h, doorX, doorY, id: `lm:${lm.interior}`, interior: lm.interior, name: b.name, zone: lm.zone });
  }

  // ---------------------------------------------------------- 12. zonas do mar e preenchimento
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y);
    if (zone[i]) continue;
    const t = tiles[i];
    if ((t === T.DEEP || t === T.WATER) && !lake[i]) {
      let z = 'southsea';
      if (y < sc(70)) z = x > sc(300) ? 'eastsea' : 'northsea';
      else if (x < sc(60) && y < sc(236)) z = 'westsea';
      else if (x > sc(320)) z = 'eastsea';
      zone[i] = zid(z);
    }
  }
  {
    const q = [];
    for (let i = 0; i < W * H; i++) if (zone[i]) q.push(i);
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi], x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!inb(nx, ny)) continue;
        const j = idx(nx, ny);
        if (!zone[j]) { zone[j] = zone[i]; q.push(j); }
      }
    }
  }

  // ---------------------------------------------------------- 13. alcance (BFS a partir de Sandgem)
  const start = cityLayouts.sandgem.anchors.s;
  const reach = new Uint8Array(W * H);
  const flood = () => {
    reach.fill(0);
    const q = [idx(start[0], start[1] - 2)];
    reach[q[0]] = 1;
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi], x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!inb(nx, ny)) continue;
        const j = idx(nx, ny);
        if (!reach[j] && isPassable(tiles[j]) && tiles[j] !== T.DOOR) { reach[j] = 1; q.push(j); }
      }
    }
  };
  flood();
  // abre caminho até um ponto inalcançável
  const connect = (tx, ty) => {
    if (reach[idx(tx, ty)]) return;
    const prev = new Int32Array(W * H).fill(-1);
    const q = [idx(tx, ty)];
    prev[q[0]] = q[0];
    let found = -1;
    for (let qi = 0; qi < q.length && found < 0; qi++) {
      const i = q[qi], x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!inb(nx, ny)) continue;
        const j = idx(nx, ny);
        if (prev[j] !== -1) continue;
        const t = tiles[j];
        if (t === T.BUILDING || t === T.DOOR || t === T.LAVA) continue;
        prev[j] = i;
        if (reach[j]) { found = j; break; }
        q.push(j);
      }
    }
    if (found < 0) return;
    let i = prev[found];
    while (true) {
      const t = tiles[i];
      if (!isPassable(t)) tiles[i] = t === T.ROCK ? T.CAVE : ground[i] === T.SNOW ? T.SNOW : ground[i] === T.ASH ? T.ASH : T.GRASS;
      if (prev[i] === i) break;
      i = prev[i];
    }
    flood();
  };
  for (const b of buildings) connect(b.doorX, b.doorY + 1);
  // a Mina de Oreburgh precisa de uma entrada
  for (const a of AREAS) if (a.kind === 'cave') connect(Math.round(a.cx), Math.round(a.cy));

  // ---------------------------------------------------------- 14. objetos (lendários, itens, treinadores, NPCs)
  const rng = mulberry32(SEED);
  for (const L of LEGENDS) {
    const t = get(L.x, L.y);
    if (!isPassable(t)) set(L.x, L.y, t === T.ROCK ? T.CAVE : ground[idx(L.x, L.y)] === T.SNOW ? T.SNOW : T.GRASS);
    if (get(L.x, L.y) === T.TALL) set(L.x, L.y, T.GRASS);
    connect(L.x, L.y);
    objects.push({ kind: 'legend', x: L.x, y: L.y, species: L.species, level: L.level, text: L.text, shiny: !!L.shiny, id: 'leg' + L.species });
  }
  const occupied = new Set(objects.map((o) => idx(o.x, o.y)));
  for (const b of buildings) occupied.add(idx(b.doorX, b.doorY + 1));
  const freeSpot = (cands, tries = 300) => {
    for (let k = 0; k < tries; k++) {
      const [x, y] = cands[Math.floor(rng() * cands.length)];
      const i = idx(x, y);
      if (occupied.has(i) || !reach[i]) continue;
      const t = tiles[i];
      if (!(t === T.GRASS || t === T.SAND || t === T.SNOW || t === T.CAVE || t === T.DESERT || t === T.ASH || t === T.PATH || t === T.CITYGRASS)) continue;
      occupied.add(i);
      return [x, y];
    }
    return null;
  };
  // itens e treinadores ao longo das rotas
  const ITEM_POOL = {
    1: ['pocao', 'pokebola', 'antidoto', 'aguafresca', 'repelente'],
    2: ['pocao', 'pokebola', 'superpocao', 'despertar', 'antiparalisia'],
    3: ['superpocao', 'grandebola', 'reviver', 'eter', 'pedralua'],
    4: ['superpocao', 'grandebola', 'reviver', 'pedrafogo', 'pedraagua', 'pedratrovao', 'pedrafolha'],
    5: ['hiperpocao', 'ultrabola', 'reviver', 'docerarro', 'elixir', 'pedrasol'],
    6: ['hiperpocao', 'ultrabola', 'docerarro', 'curatotal', 'proteina', 'calcio'],
    7: ['pocaomaxima', 'ultrabola', 'docerarro', 'revivermax', 'zinco', 'carbos'],
    8: ['restauracao', 'ultrabola', 'docerarro', 'revivermax', 'elixirmax', 'hpup', 'ferro'],
  };
  let itemN = 0, trainerN = 0;
  for (const { r, pts, zi } of routeSamples) {
    const z = ZONES[zi];
    if (z.city) continue;
    const near = [];
    for (let k = 0; k < pts.length; k += 3) {
      const [px, py] = pts[k];
      for (let a = 0; a < 6; a++) {
        const ang = rng() * Math.PI * 2, d = 2 + rng() * 6;
        near.push([Math.floor(px + Math.cos(ang) * d), Math.floor(py + Math.sin(ang) * d)]);
      }
    }
    if (!near.length) continue;
    const nItems = r.sea ? 1 : 2 + Math.floor(rng() * 2);
    for (let k = 0; k < nItems; k++) {
      const p = freeSpot(near);
      if (!p) continue;
      const pool = ITEM_POOL[z.tier];
      objects.push({ kind: 'item', x: p[0], y: p[1], item: pool[Math.floor(rng() * pool.length)], id: 'item' + (++itemN) });
    }
    if (r.sea) continue;
    const nTr = 2 + Math.floor(rng() * 3);
    // treinadores ficam perto do caminho
    const nearPath = [];
    for (let k = 0; k < pts.length; k += 2) {
      const [px, py] = pts[k];
      for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2], [3, 1], [-3, -1]]) nearPath.push([Math.floor(px + dx), Math.floor(py + dy)]);
    }
    for (let k = 0; k < nTr; k++) {
      const p = freeSpot(nearPath);
      if (!p) continue;
      objects.push({ kind: 'trainer', x: p[0], y: p[1], zone: z.id, tier: z.tier, id: 'tr' + (++trainerN), seed: Math.floor(rng() * 1e9) });
    }
  }
  // NPCs nas cidades
  let npcN = 0;
  for (const c of CITIES) {
    const L = c.layout;
    const cands = [];
    for (let y = L.y0; y < L.y0 + L.h; y++) for (let x = L.x0; x < L.x0 + L.w; x++) if (get(x, y) === T.PAVE || get(x, y) === T.CITYGRASS) cands.push([x, y]);
    const n = c.big ? 5 : 3;
    for (let k = 0; k < n; k++) {
      const p = freeSpot(cands);
      if (p) objects.push({ kind: 'npc', x: p[0], y: p[1], city: c.id, id: 'npc' + (++npcN), seed: Math.floor(rng() * 1e9) });
    }
  }

  // ---------------------------------------------------------- 15. coisas do Diamond espalhadas pelo mapa
  const FREE_T = new Set([T.GRASS, T.SAND, T.SNOW, T.CAVE, T.DESERT, T.ASH, T.CITYGRASS, T.PATH, T.PAVE, T.PLAZA]);
  const HIDE_T = new Set([...FREE_T, T.TALL, T.SNOWTALL, T.FLOWERS, T.ASHTALL, T.MARSH]);
  const nearFree = (x, y, maxR = 6, allowPath = false, okSet = FREE_T) => {
    for (let r = 0; r <= maxR; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const xx = x + dx, yy = y + dy;
      if (!inb(xx, yy)) continue;
      const i = idx(xx, yy);
      if (occupied.has(i) || !reach[i]) continue;
      const t = tiles[i];
      if (!okSet.has(t) || (!allowPath && (t === T.PATH || t === T.PAVE || t === T.PLAZA))) continue;
      occupied.add(i);
      return [xx, yy];
    }
    return null;
  };
  const routePt = (zoneId, frac, nth = 0) => {
    const rs = routeSamples.filter((q) => q.r.zone === zoneId)[nth];
    if (!rs) return null;
    const p = rs.pts[Math.min(rs.pts.length - 1, Math.floor(frac * (rs.pts.length - 1)))];
    return [Math.floor(p[0]), Math.floor(p[1])];
  };
  // árvores de frutas, árvores de mel e itens escondidos ao longo das rotas
  const BERRY_LOW = ['oran', 'pecha', 'cheri', 'chesto', 'rawst', 'aspear', 'persim', 'razz', 'oran'];
  const BERRY_HIGH = ['sitrus', 'leppa', 'lum', 'oran', 'persim', 'sitrus'];
  const HID_POOL = ['pocao', 'pokebola', 'antidoto', 'mel', 'pepita', 'escamacoracao', 'superpocao', 'perola', 'grandebola',
    'eter', 'poestrela', 'reviver', 'cogumelo', 'hiperpocao', 'ultrabola', 'docerarro', 'perolagrande', 'pedacoestrela'];
  let berryN = 0, honeyN = 0, digN = 0, hidN = 0;
  for (const { r, pts, zi } of routeSamples) {
    const z = ZONES[zi];
    if (z.city || r.sea) continue;
    if (!r.cave) {
      const nB = 1 + Math.floor(rng() * 2);
      for (let k = 0; k < nB; k++) {
        const p0 = pts[Math.floor(rng() * pts.length)];
        const ang = rng() * Math.PI * 2;
        const p = nearFree(Math.floor(p0[0] + Math.cos(ang) * 3.5), Math.floor(p0[1] + Math.sin(ang) * 3.5), 4);
        if (!p) continue;
        const pool = z.tier >= 4 ? BERRY_HIGH : BERRY_LOW;
        objects.push({ kind: 'berry', x: p[0], y: p[1], berry: pool[Math.floor(rng() * pool.length)], id: 'berry' + (++berryN) });
      }
      if (z.biomes.some((b) => b === 'forest' || b === 'meadow' || b === 'marsh') && rng() < 0.7) {
        const p0 = pts[Math.floor(pts.length * (0.3 + rng() * 0.4))];
        const p = nearFree(Math.floor(p0[0]) + 3, Math.floor(p0[1]) + 2, 5);
        if (p) objects.push({ kind: 'honey', x: p[0], y: p[1], id: 'honey' + (++honeyN), tier: z.tier });
      }
    }
    for (let k = 0; k < 2; k++) {
      const p0 = pts[Math.floor(rng() * pts.length)];
      const p = nearFree(Math.floor(p0[0] + (rng() - 0.5) * 12), Math.floor(p0[1] + (rng() - 0.5) * 12), 5, true, HIDE_T);
      if (!p) continue;
      const pool = HID_POOL.slice(0, Math.min(HID_POOL.length, 6 + z.tier * 2));
      objects.push({ kind: 'hidden', x: p[0], y: p[1], item: pool[Math.floor(rng() * pool.length)], id: 'hid' + (++hidN) });
    }
  }
  for (const c of CITIES) {
    const L = c.layout;
    const p = nearFree(L.x0 + 1 + Math.floor(rng() * (L.w - 2)), L.y0 + 1 + Math.floor(rng() * (L.h - 2)), 6, false);
    if (p) objects.push({ kind: 'hidden', x: p[0], y: p[1], item: HID_POOL[Math.floor(rng() * 9)], id: 'hid' + (++hidN) });
  }
  // pontos de escavação nas paredes das cavernas
  {
    const cands = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = idx(x, y);
      if (tiles[i] !== T.CAVE || !reach[i] || occupied.has(i)) continue;
      if (tiles[idx(x, y - 1)] !== T.ROCK || !isPassable(tiles[idx(x, y + 1)])) continue;
      if (!isPassable(tiles[idx(x - 1, y)]) && !isPassable(tiles[idx(x + 1, y)])) continue;
      cands.push([x, y, hash2(x, y, 77)]);
    }
    cands.sort((a, b) => a[2] - b[2]);
    const placed = [];
    for (const [x, y] of cands) {
      if (placed.length >= 42) break;
      if (placed.some(([a, b]) => Math.abs(a - x) + Math.abs(b - y) < 13)) continue;
      occupied.add(idx(x, y));
      placed.push([x, y]);
      const z = ZONES[zone[idx(x, y)]];
      objects.push({ kind: 'dig', x, y, id: 'dig' + (++digN), tier: z ? z.tier : 3 });
    }
  }
  // personagens e easter eggs
  const special = (role, at, extra = {}) => {
    if (!at) return;
    const p = nearFree(at[0], at[1], 7, true);
    if (p) objects.push({ kind: 'special', role, x: p[0], y: p[1], id: 'sp_' + role + (extra.n || ''), ...extra });
  };
  {
    const sg = cityLayouts.sandgem.anchors.s, cv = cityLayouts.canalave.anchors.w;
    special('barry', [sg[0] + 4, sg[1] - 3]);
    const CL = cityLayouts.canalave;
    special('truck', [CL.x0 + 2, CL.y0 + CL.h - 3]);
    void cv;
  }
  special('snorlax', routePt('r210', 0.45));
  special('sudowoodo', routePt('r214', 0.55));
  special('mars', routePt('windworks', 0.95));
  special('grunt', routePt('windworks', 0.55), { n: 1 });
  special('grunt', routePt('r205', 0.15), { n: 2 });
  special('saturn', routePt('valor', 0.55));
  special('grunt', routePt('valor', 0.25), { n: 3 });
  special('grunt', routePt('r213', 0.4), { n: 4 });
  special('grunt', routePt('coronet', 0.35, 3), { n: 5 });
  special('cyrus', routePt('coronet', 0.8, 3));

  const world = {
    W, H, tiles, zone, ground, buildings, objects, cities: CITIES,
    cityLayouts, reach,
    doorAt: new Map(buildings.map((b) => [idx(b.doorX, b.doorY), b])),
    genMs: Date.now() - t0,
  };
  return world;
}

let cached = null;
export function getWorld() {
  if (!cached) cached = buildWorld();
  return cached;
}

export function tileAt(world, x, y) {
  if (x < 0 || y < 0 || x >= W || y >= H) return T.DEEP;
  return world.tiles[y * W + x];
}

export function zoneAt(world, x, y) {
  if (x < 0 || y < 0 || x >= W || y >= H) return ZONES[ZONE_INDEX.southsea];
  return ZONES[world.zone[y * W + x]] || null;
}

export { isWalkable, isPassable };
