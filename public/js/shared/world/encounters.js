// Distribuição dos Pokémon (Gerações 1–3) pelo mundo e tabelas de encontro por zona.
import { POKEDEX } from '../data/pokedex.js';
import { ZONES, TIER_LEVELS } from './defs.js';
import { mulberry32, hashStr } from '../rng.js';

// habitat:raridade  (c = comum, u = incomum, r = raro, v = muito raro)
const HAB = {
  1: 'meadow:r', 4: 'volcano:r mountain:v', 7: 'lake:r', 10: 'forest:c', 13: 'forest:c', 16: 'meadow:c forest:u',
  19: 'meadow:c cave:u', 21: 'meadow:u mountain:u', 23: 'meadow:u marsh:u', 25: 'forest:r electric:u',
  27: 'desert:c mountain:u', 29: 'meadow:u', 32: 'meadow:u', 35: 'cave:r mountain:r', 37: 'meadow:r volcano:u',
  39: 'meadow:u', 41: 'cave:c night:u', 43: 'meadow:u night:c forest:u', 46: 'forest:u cave:u', 48: 'forest:u night:u',
  50: 'cave:u desert:u', 52: 'meadow:u night:u', 54: 'lake:c marsh:u', 56: 'mountain:c', 58: 'meadow:r volcano:u',
  60: 'lake:c marsh:u', 63: 'meadow:r ruins:u', 66: 'mountain:c cave:u', 69: 'meadow:u forest:u', 72: 'sea:c',
  74: 'cave:c mountain:c', 77: 'meadow:u volcano:u', 79: 'lake:u beach:u', 81: 'electric:c', 83: 'marsh:r meadow:r',
  84: 'meadow:u desert:u', 86: 'sea:u snow:r', 88: 'marsh:u electric:u', 90: 'sea:u', 92: 'ghost:c night:r cave:r',
  95: 'cave:u mountain:r', 96: 'meadow:u night:u ruins:u', 98: 'beach:c sea:u', 100: 'electric:c', 102: 'forest:r',
  104: 'mountain:u cave:r', 108: 'meadow:r', 109: 'marsh:u electric:u', 111: 'mountain:u desert:u', 113: 'meadow:v forest:v',
  114: 'forest:u marsh:u', 115: 'meadow:r', 116: 'sea:u', 118: 'lake:c', 120: 'sea:u', 122: 'meadow:r ruins:r',
  123: 'forest:r', 124: 'snow:u', 125: 'electric:r', 126: 'volcano:u', 127: 'forest:r', 128: 'meadow:u',
  129: 'lake:c sea:c', 131: 'sea:r', 132: 'ruins:u meadow:v cave:v', 133: 'meadow:r forest:v', 137: 'ruins:r electric:r',
  138: 'fossil:u', 140: 'fossil:u', 142: 'fossil:r mountain:v', 143: 'forest:v meadow:v', 147: 'lake:r dragon:u',
  152: 'meadow:r forest:r', 155: 'volcano:r meadow:v', 158: 'lake:r marsh:r', 161: 'meadow:c', 163: 'night:c',
  165: 'forest:u meadow:u', 167: 'night:c forest:u', 170: 'sea:u', 172: 'forest:u electric:u', 173: 'cave:u mountain:u',
  174: 'meadow:u', 175: 'meadow:r ruins:r', 177: 'ruins:c meadow:u', 179: 'meadow:u electric:u', 183: 'lake:u marsh:u',
  185: 'forest:r mountain:r', 187: 'meadow:u', 190: 'forest:u', 191: 'meadow:u', 193: 'marsh:u forest:r',
  194: 'marsh:c lake:u', 198: 'night:u', 200: 'ghost:u night:r', 201: 'ruins:c', 202: 'ruins:r cave:r',
  203: 'meadow:r desert:r', 204: 'forest:u', 206: 'cave:u', 207: 'mountain:u desert:u', 209: 'meadow:u', 211: 'sea:u',
  213: 'mountain:r cave:r', 214: 'forest:r', 215: 'snow:u night:r', 216: 'forest:u mountain:u', 218: 'volcano:c',
  220: 'snow:c', 222: 'sea:u', 223: 'sea:u', 225: 'snow:u', 226: 'sea:r', 227: 'mountain:r desert:r',
  228: 'volcano:u night:u', 231: 'mountain:u desert:r meadow:r', 234: 'forest:u snow:u', 235: 'ruins:u meadow:r',
  236: 'mountain:u', 238: 'snow:u', 239: 'electric:u', 240: 'volcano:u', 241: 'meadow:u', 246: 'mountain:r cave:r',
  252: 'forest:r', 255: 'volcano:r meadow:v', 258: 'marsh:r lake:r', 261: 'meadow:c night:c', 263: 'meadow:c',
  265: 'forest:c', 270: 'lake:u marsh:u', 273: 'forest:u', 276: 'meadow:u', 278: 'beach:c sea:u', 280: 'meadow:r',
  283: 'lake:u marsh:u', 285: 'forest:u', 287: 'forest:u', 290: 'forest:u', 293: 'cave:u', 296: 'mountain:u cave:u',
  298: 'lake:r meadow:u', 299: 'cave:u', 300: 'meadow:u', 302: 'cave:u ghost:u', 303: 'cave:u', 304: 'cave:c',
  307: 'mountain:u', 309: 'meadow:u electric:u', 311: 'electric:u', 312: 'electric:u', 313: 'night:u', 314: 'night:u',
  315: 'meadow:u forest:r', 316: 'marsh:u', 318: 'sea:u', 320: 'sea:u', 322: 'volcano:c desert:u', 324: 'volcano:u',
  325: 'mountain:u', 327: 'mountain:u desert:r', 328: 'desert:c', 331: 'desert:c', 333: 'mountain:u meadow:r',
  335: 'meadow:r', 336: 'meadow:r desert:r', 337: 'cave:r ruins:r', 338: 'cave:r ruins:r', 339: 'lake:u marsh:u',
  341: 'lake:u marsh:u', 343: 'desert:u ruins:u', 345: 'fossil:u', 347: 'fossil:u', 349: 'lake:v', 351: 'meadow:r',
  352: 'forest:r', 353: 'ghost:c', 355: 'ghost:c night:r', 357: 'forest:r', 358: 'mountain:r snow:r',
  359: 'mountain:r snow:r', 360: 'ruins:u', 361: 'snow:c', 363: 'snow:u sea:u', 366: 'sea:r', 369: 'sea:r',
  370: 'sea:u', 371: 'mountain:v cave:r dragon:r', 374: 'cave:v fossil:r',
};

const RW = { c: 30, u: 12, r: 4, v: 1 };
const MAX_PER_TABLE = 13;

export const ENCOUNTER_RATE = { grass: 0.1, cave: 0.07, water: 0.07, sand: 0.06 };

function bst(sp) { return sp.base.reduce((a, b) => a + b, 0); }

function baseTier(sp) {
  const b = bst(sp);
  return b < 300 ? 1 : b < 380 ? 2 : b < 440 ? 3 : b < 500 ? 4 : 5;
}

function habitatOf(biome, sp) {
  if (biome === 'sea' || biome === 'lake') return 'water';
  if (biome === 'cave' || biome === 'fossil') return 'cave';
  if (biome === 'dragon') return sp.types.includes('Water') || sp.id === 147 ? 'water' : 'cave';
  return 'grass';
}

// Pré-evoluções que evoluem por nível aparecem com o nível adequado.
function levelEvolutions(id, maxLevel, out = []) {
  for (const ev of POKEDEX[id].evos) {
    if (ev.kind === 'level' && ev.level && ev.level <= maxLevel + 2 && !ev.cond) {
      out.push({ id: ev.to, min: ev.level });
      levelEvolutions(ev.to, maxLevel, out);
    }
  }
  return out;
}

let TABLES = null;

export function buildEncounterTables() {
  if (TABLES) return TABLES;
  const parsed = Object.entries(HAB).map(([id, s]) => ({
    id: +id,
    entries: s.split(' ').map((e) => { const [b, r] = e.split(':'); return { biome: b, w: RW[r] || 4 }; }),
  }));
  const tables = {};
  const appear = new Set();
  for (const z of ZONES) {
    if (!z) continue;
    const [lo, hi] = TIER_LEVELS[z.tier];
    tables[z.id] = { grass: [], water: [], cave: [] };
    const rng = mulberry32(hashStr(z.id));
    for (const hab of ['grass', 'water', 'cave']) {
      let cands = [];
      for (const p of parsed) {
        const sp = POKEDEX[p.id];
        for (const e of p.entries) {
          if (!z.biomes.includes(e.biome) || habitatOf(e.biome, sp) !== hab) continue;
          const bt = baseTier(sp);
          let w = e.w;
          if (bt > z.tier + 1) continue;
          if (bt > z.tier) w = Math.max(1, Math.floor(w / 3));
          cands.push({ id: p.id, w, min: lo, max: hi, night: e.biome === 'night' });
        }
      }
      // sorteio ponderado sem reposição: comuns entram primeiro, no máximo 3 raros
      const pickSome = (pool, max) => {
        const out = [];
        let rares = 0;
        pool = pool.slice();
        while (out.length < max && pool.length) {
          const total = pool.reduce((a, c) => a + c.w, 0);
          let r = rng() * total;
          let k = 0;
          for (; k < pool.length - 1; k++) { r -= pool[k].w; if (r <= 0) break; }
          const c = pool.splice(k, 1)[0];
          if (c.w <= 4) { if (rares >= 3) continue; rares++; }
          if (!out.some((x) => x.id === c.id)) out.push(c);
        }
        return out;
      };
      const day = pickSome(cands.filter((c) => !c.night), MAX_PER_TABLE);
      const night = pickSome(cands.filter((c) => c.night), 5);
      const list = [];
      for (const c of [...day, ...night]) {
        if (list.some((x) => x.id === c.id && x.night === c.night)) continue;
        // em zonas de nível alto, a forma básica dá lugar à evoluída
        const firstEvo = POKEDEX[c.id].evos.find((e) => e.kind === 'level' && e.level && !e.cond);
        const replaceBase = firstEvo && lo > firstEvo.level + 5;
        if (!replaceBase) list.push(c);
        for (const ev of levelEvolutions(c.id, hi)) {
          if (list.some((x) => x.id === ev.id && x.night === c.night)) continue;
          const direct = firstEvo && ev.id === firstEvo.to;
          const w = replaceBase && direct ? c.w : Math.max(1, Math.floor(c.w / 3));
          list.push({ id: ev.id, w, min: Math.max(lo, ev.min), max: Math.max(hi, ev.min + 2), night: c.night });
        }
      }
      tables[z.id][hab] = list;
      for (const c of list) appear.add(c.id);
    }
  }
  // evoluções por pedra/troca/amizade: aparecem raramente em zonas de nível alto
  // onde a forma anterior vive
  for (const sp of Object.values(POKEDEX)) {
    if (sp.legendary) continue;
    for (const ev of sp.evos) {
      if (appear.has(ev.to)) continue;
      for (const z of ZONES) {
        if (!z || z.city || z.tier < 5) continue;
        for (const hab of ['grass', 'water', 'cave']) {
          const list = tables[z.id][hab];
          const base = list.find((c) => c.id === sp.id);
          if (!base || list.some((c) => c.id === ev.to)) continue;
          const [lo, hi] = TIER_LEVELS[z.tier];
          list.push({ id: ev.to, w: 2, min: Math.max(lo, 30), max: Math.max(hi, 32), night: base.night });
          appear.add(ev.to);
        }
      }
    }
  }
  // garante que toda espécie de HAB apareça em algum lugar
  for (const p of parsed) {
    if (appear.has(p.id)) continue;
    const sp = POKEDEX[p.id];
    let best = null;
    for (const z of ZONES) {
      if (!z || z.city) continue;
      for (const e of p.entries) {
        if (!z.biomes.includes(e.biome)) continue;
        const hab = habitatOf(e.biome, sp);
        const score = Math.abs(z.tier - baseTier(sp)) * 10 + tables[z.id][hab].length;
        if (!best || score < best.score) best = { z, hab, w: e.w, score, night: e.biome === 'night' };
      }
    }
    if (best) {
      const [lo, hi] = TIER_LEVELS[best.z.tier];
      tables[best.z.id][best.hab].push({ id: p.id, w: best.w, min: lo, max: hi, night: best.night });
      appear.add(p.id);
    }
  }
  // evoluções que ainda faltam: entram raramente numa zona compatível com o
  // habitat da linhagem e com nível suficiente
  const habOf = Object.fromEntries(parsed.map((p) => [p.id, p.entries]));
  for (const sp of Object.values(POKEDEX)) {
    if (sp.legendary || appear.has(sp.id) || !sp.prevo) continue;
    let entries = null, needLevel = 30;
    for (let c = sp.id; c; c = POKEDEX[c].prevo) {
      if (!entries && habOf[c]) entries = habOf[c];
      const pre = POKEDEX[c].prevo;
      if (c === sp.id && pre) {
        const ev = POKEDEX[pre].evos.find((e) => e.to === c);
        if (ev && ev.kind === 'level' && ev.level) needLevel = ev.level;
      }
    }
    if (!entries) continue;
    let best = null;
    for (const z of ZONES) {
      if (!z || z.city) continue;
      const [lo, hi] = TIER_LEVELS[z.tier];
      for (const e of entries) {
        if (!z.biomes.includes(e.biome)) continue;
        const hab = habitatOf(e.biome, sp);
        const score = (hi + 2 < needLevel ? 100 : 0) + tables[z.id][hab].length + Math.abs(lo - needLevel) / 4;
        if (!best || score < best.score) best = { z, hab, score, night: e.biome === 'night' };
      }
    }
    if (best) {
      const [lo, hi] = TIER_LEVELS[best.z.tier];
      tables[best.z.id][best.hab].push({ id: sp.id, w: 2, min: Math.max(lo, needLevel), max: Math.max(hi, needLevel + 2), night: best.night });
      appear.add(sp.id);
    }
  }
  TABLES = tables;
  return tables;
}

// ------------------------------------------------------------ eventos diários
const DAY_MS = 86400000;
// Surto do dia (anunciado na TV de Jubilife): uma espécie aparece muito numa rota.
export function outbreakOf(now = Date.now()) {
  const day = Math.floor(now / DAY_MS);
  const rng = mulberry32(day * 7919 + 13);
  const tables = buildEncounterTables();
  const zones = ZONES.filter((z) => z && !z.city && z.id !== 'trophy' && z.id !== 'safarizone' && tables[z.id].grass.length);
  const z = zones[Math.floor(rng() * zones.length)];
  const pool = Object.keys(HAB).map(Number).filter((id) => !POKEDEX[id].legendary && baseTier(POKEDEX[id]) <= z.tier + 1 && !tables[z.id].grass.some((c) => c.id === id));
  const species = pool[Math.floor(rng() * pool.length)];
  const [min, max] = TIER_LEVELS[z.tier];
  return { zone: z.id, zoneName: z.name, species, min, max };
}

// Pokémon do dia no Jardim de Troféus (contado pelo Sr. Backlot).
const TROPHY_POOL = [25, 35, 39, 52, 133, 137, 173, 174, 183, 298, 300, 311, 312, 351, 352, 113, 132, 175, 236, 280];
export function trophyOf(now = Date.now()) {
  const day = Math.floor(now / DAY_MS);
  return TROPHY_POOL[Math.floor(mulberry32(day * 31 + 5)() * TROPHY_POOL.length)];
}

// Zona Safári: espécies raras que só aparecem no pântano.
const SAFARI_POOL = [[128, 10], [115, 8], [113, 4], [123, 6], [127, 6], [147, 3], [102, 10], [111, 10], [84, 12], [48, 12], [46, 12], [203, 8], [214, 6], [357, 6], [352, 6], [193, 10], [194, 14], [29, 10], [32, 10], [30, 6], [33, 6]];

// Sorteia um encontro. time: 'day' | 'night'
export function rollEncounter(zoneId, habitat, time, rng = Math.random, now = Date.now()) {
  const t = buildEncounterTables()[zoneId];
  if (!t) return null;
  if (habitat === 'grass') {
    const ob = outbreakOf(now);
    if (ob.zone === zoneId && rng() < 0.4) return { species: ob.species, level: ob.min + Math.floor(rng() * (ob.max - ob.min + 1)), outbreak: true };
    if (zoneId === 'trophy' && rng() < 0.35) return { species: trophyOf(now), level: 20 + Math.floor(rng() * 8) };
    if (zoneId === 'safarizone' && rng() < 0.55) {
      const total = SAFARI_POOL.reduce((a, [, w]) => a + w, 0);
      let r = rng() * total;
      for (const [id, w] of SAFARI_POOL) { r -= w; if (r <= 0) return { species: id, level: 24 + Math.floor(rng() * 10) }; }
    }
  }
  const list = (t[habitat] || []).filter((c) => !c.night || time === 'night');
  if (!list.length) return null;
  const total = list.reduce((a, c) => a + c.w, 0);
  let r = rng() * total;
  for (const c of list) {
    r -= c.w;
    if (r <= 0) {
      const level = c.min + Math.floor(rng() * (c.max - c.min + 1));
      return { species: c.id, level };
    }
  }
  return null;
}

// Onde cada espécie pode ser encontrada (para a Pokédex).
export function speciesLocations(id) {
  const out = [];
  const tables = buildEncounterTables();
  for (const z of ZONES) {
    if (!z) continue;
    for (const hab of ['grass', 'water', 'cave']) {
      const c = tables[z.id][hab].find((x) => x.id === id);
      if (c) out.push({ zone: z.name, habitat: hab, night: c.night, rarity: c.w >= 20 ? 'comum' : c.w >= 8 ? 'incomum' : 'raro' });
    }
  }
  return out;
}

// Espécie apropriada para um nível (evolui automaticamente para times de treinadores).
export function evolveForLevel(id, level, rng = Math.random) {
  let cur = id;
  for (let guard = 0; guard < 3; guard++) {
    const evos = POKEDEX[cur].evos;
    if (!evos.length) break;
    const options = evos.filter((e) =>
      (e.kind === 'level' && level >= e.level) ||
      ((e.kind === 'item' || e.kind === 'trade') && level >= 34) ||
      (e.kind === 'friendship' && level >= 26));
    if (!options.length) break;
    cur = options[Math.floor(rng() * options.length)].to;
  }
  return cur;
}
