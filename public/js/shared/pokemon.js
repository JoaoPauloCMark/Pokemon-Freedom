// Criação e regras de Pokémon individuais (status, experiência, evolução).
import { POKEDEX } from './data/pokedex.js';
import { MOVES } from './data/moves.js';
import { ABILITIES } from './data/abilities.js';

export const NATURES = [
  // [nome, aumenta, diminui]  (índices de status: 1 atk, 2 def, 3 spa, 4 spd, 5 spe)
  ['Resistente', 0, 0], ['Solitária', 1, 2], ['Corajosa', 1, 5], ['Firme', 1, 3], ['Travessa', 1, 4],
  ['Ousada', 2, 1], ['Dócil', 0, 0], ['Relaxada', 2, 5], ['Inocente', 2, 3], ['Descontraída', 2, 4],
  ['Tímida', 5, 1], ['Apressada', 5, 2], ['Séria', 0, 0], ['Alegre', 5, 3], ['Ingênua', 5, 4],
  ['Modesta', 3, 1], ['Gentil', 3, 2], ['Quieta', 3, 5], ['Acanhada', 0, 0], ['Precipitada', 3, 4],
  ['Calma', 4, 1], ['Amável', 4, 2], ['Atrevida', 4, 5], ['Cuidadosa', 4, 3], ['Peculiar', 0, 0],
];

export function species(mon) {
  return POKEDEX[mon.species];
}

export function speciesName(id) {
  return POKEDEX[id] ? POKEDEX[id].name : '???';
}

export function monName(mon) {
  return mon.nick || POKEDEX[mon.species].name;
}

// ------------------------------------------------------------ experiência
export function expForLevel(growth, n) {
  if (n <= 1) return 0;
  const n3 = n * n * n;
  switch (growth) {
    case 'fast': return Math.floor((4 * n3) / 5);
    case 'slow': return Math.floor((5 * n3) / 4);
    case 'mslow': return Math.max(0, Math.floor((6 / 5) * n3 - 15 * n * n + 100 * n - 140));
    case 'erratic':
      if (n <= 50) return Math.floor((n3 * (100 - n)) / 50);
      if (n <= 68) return Math.floor((n3 * (150 - n)) / 100);
      if (n <= 98) return Math.floor((n3 * Math.floor((1911 - 10 * n) / 3)) / 500);
      return Math.floor((n3 * (160 - n)) / 100);
    case 'fluct':
      if (n <= 15) return Math.floor((n3 * (Math.floor((n + 1) / 3) + 24)) / 50);
      if (n <= 36) return Math.floor((n3 * (n + 14)) / 50);
      return Math.floor((n3 * (Math.floor(n / 2) + 32)) / 50);
    default: return n3;
  }
}

export function expProgress(mon) {
  const g = species(mon).growth;
  if (mon.level >= 100) return 1;
  const a = expForLevel(g, mon.level);
  const b = expForLevel(g, mon.level + 1);
  return Math.max(0, Math.min(1, (mon.exp - a) / (b - a)));
}

// ------------------------------------------------------------ status
export function calcStats(mon) {
  const sp = species(mon);
  const nat = NATURES[mon.nature] || NATURES[0];
  const out = [];
  for (let i = 0; i < 6; i++) {
    const b = sp.base[i];
    const iv = mon.ivs[i];
    const ev = mon.evs ? mon.evs[i] : 0;
    if (i === 0) {
      out.push(sp.id === 292 ? 1 : Math.floor(((2 * b + iv + Math.floor(ev / 4)) * mon.level) / 100) + mon.level + 10);
    } else {
      let v = Math.floor(((2 * b + iv + Math.floor(ev / 4)) * mon.level) / 100) + 5;
      if (nat[1] === i && nat[2] !== i) v = Math.floor(v * 1.1);
      if (nat[2] === i && nat[1] !== i) v = Math.floor(v * 0.9);
      out.push(v);
    }
  }
  return out;
}

export function maxHp(mon) {
  return calcStats(mon)[0];
}

// ------------------------------------------------------------ golpes
export function movesLearnedAt(speciesId, level) {
  return POKEDEX[speciesId].moves.filter(([l]) => l === level).map(([, m]) => m);
}

export function defaultMoves(speciesId, level) {
  const list = [];
  for (const [l, m] of POKEDEX[speciesId].moves) {
    if (l <= level && !list.includes(m)) list.push(m);
  }
  const last = list.slice(-4);
  return last.map((id) => ({ id, pp: MOVES[id].pp, ppMax: MOVES[id].pp }));
}

export function makeMove(id) {
  const m = MOVES[id];
  return { id, pp: m.pp, ppMax: m.pp };
}

// ------------------------------------------------------------ criação
export function createPokemon(speciesId, level, opts = {}) {
  const rng = opts.rng || Math.random;
  const sp = POKEDEX[speciesId];
  if (!sp) throw new Error('Espécie inválida: ' + speciesId);
  const ivs = opts.ivs || Array.from({ length: 6 }, () => Math.floor(rng() * 32));
  let gender = 'N';
  if (sp.gender >= 0) gender = rng() * 8 < sp.gender ? 'F' : 'M';
  const mon = {
    uid: (Date.now().toString(36) + Math.floor(rng() * 1e9).toString(36)),
    species: speciesId,
    nick: null,
    level,
    exp: expForLevel(sp.growth, level),
    nature: opts.nature ?? Math.floor(rng() * 25),
    ivs,
    evs: [0, 0, 0, 0, 0, 0],
    ability: sp.abilities[Math.floor(rng() * sp.abilities.length)] || sp.abilities[0],
    gender,
    shiny: opts.shiny ?? rng() < 1 / 512,
    moves: opts.moves ? opts.moves.map(makeMove) : defaultMoves(speciesId, level),
    hp: 0,
    status: null,
    friendship: 70,
    ot: opts.ot || '',
    otId: opts.otId || '',
    ball: opts.ball || 'pokebola',
    met: opts.met || '',
    metLevel: level,
  };
  mon.hp = maxHp(mon);
  return mon;
}

export function healMon(mon) {
  mon.hp = maxHp(mon);
  mon.status = null;
  delete mon.sleepTurns;
  for (const m of mon.moves) m.pp = m.ppMax;
}

// Ganho de experiência. Retorna a lista de eventos de subida de nível.
export function gainExp(mon, amount) {
  const sp = species(mon);
  const events = [];
  if (mon.level >= 100) return events;
  mon.exp += amount;
  while (mon.level < 100 && mon.exp >= expForLevel(sp.growth, mon.level + 1)) {
    const before = calcStats(mon);
    mon.level++;
    const after = calcStats(mon);
    mon.hp += after[0] - before[0];
    mon.friendship = Math.min(255, (mon.friendship || 70) + 10);
    events.push({ level: mon.level, before, after, moves: movesLearnedAt(mon.species, mon.level) });
  }
  if (mon.level >= 100) mon.exp = expForLevel(sp.growth, 100);
  return events;
}

export function expYield(defeated, isTrainer) {
  const sp = species(defeated);
  let e = Math.floor((sp.baseExp * defeated.level) / 7);
  if (isTrainer) e = Math.floor(e * 1.5);
  return Math.max(1, e);
}

// Tenta aprender um golpe; retorna 'learned', 'known' ou 'full'.
export function tryLearn(mon, moveId) {
  if (mon.moves.some((m) => m.id === moveId)) return 'known';
  if (mon.moves.length < 4) {
    mon.moves.push(makeMove(moveId));
    return 'learned';
  }
  return 'full';
}

// ------------------------------------------------------------ evolução
// ctx: { trigger: 'level'|'item'|'trade', item, time: 'day'|'night', party }
export function evolutionTarget(mon, ctx) {
  const sp = species(mon);
  const stats = calcStats(mon);
  for (const ev of sp.evos) {
    if (ctx.trigger === 'level') {
      if (ev.kind === 'level' && mon.level >= ev.level) {
        if (ev.cond) {
          if (ev.cond.includes('>') && !(stats[1] > stats[2])) continue;
          if (ev.cond.includes('<') && !(stats[1] < stats[2])) continue;
          if (ev.cond.includes('equal') && stats[1] !== stats[2]) continue;
        }
        // Wurmple: escolhe o ramo pelo uid (determinístico por Pokémon)
        if (sp.id === 265) {
          const branch = (mon.uid.charCodeAt(mon.uid.length - 1) % 2) ? 266 : 268;
          if (ev.to !== branch) continue;
        }
        return ev.to;
      }
      if (ev.kind === 'friendship' && (mon.friendship || 0) >= 200) {
        if (ev.time && ctx.time && ev.time !== ctx.time) continue;
        return ev.to;
      }
    } else if (ctx.trigger === 'item') {
      if (ev.kind === 'item' && ev.item === ctx.item) return ev.to;
      if (ev.kind === 'trade' && ev.item && ev.item === ctx.item) return ev.to;
      if (ev.kind === 'trade' && !ev.item && ctx.item === 'cabodeconexao') return ev.to;
    } else if (ctx.trigger === 'trade') {
      if (ev.kind === 'trade' && !ev.item) return ev.to;
    }
  }
  return null;
}

export function evolve(mon, targetId) {
  const before = calcStats(mon);
  const oldSp = species(mon);
  const wasNamed = mon.nick && mon.nick !== oldSp.name;
  mon.species = targetId;
  if (!wasNamed) mon.nick = null;
  const sp = species(mon);
  if (!sp.abilities.includes(mon.ability)) {
    const idx = Math.max(0, oldSp.abilities.indexOf(mon.ability));
    mon.ability = sp.abilities[Math.min(idx, sp.abilities.length - 1)];
  }
  const after = calcStats(mon);
  mon.hp = Math.max(1, mon.hp + (after[0] - before[0]));
  // Shedinja aparece ao evoluir Nincada se houver espaço — tratado pelo cliente
  return { before, after, newMoves: movesLearnedAt(targetId, mon.level) };
}

export function abilityName(a) {
  return (ABILITIES[a] && ABILITIES[a].name) || a;
}

export function abilityDesc(a) {
  return (ABILITIES[a] && ABILITIES[a].desc) || '';
}

export function isUsable(mon) {
  return mon && mon.hp > 0 && !mon.egg;
}

export function cloneMon(mon) {
  return JSON.parse(JSON.stringify(mon));
}
