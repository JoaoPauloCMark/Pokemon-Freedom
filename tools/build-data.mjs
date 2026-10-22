// Gera os arquivos de dados do jogo (public/js/shared/data/*.js) a partir dos
// dados brutos do Pokémon Showdown e da PokeAPI salvos em tools/raw/,
// mesclando as traduções em tools/translations/.
//
// Uso: npm run build-data
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const raw = (f) => JSON.parse(fs.readFileSync(path.join(here, 'raw', f), 'utf8'));
const tr = (f, fallback) => {
  const p = path.join(here, 'translations', f);
  if (!fs.existsSync(p)) { console.warn('[aviso] tradução ausente:', f); return fallback; }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
};
const outDir = path.join(here, '..', 'public', 'js', 'shared', 'data');
fs.mkdirSync(outDir, { recursive: true });

const dex = raw('pokedex.json');
const moves = raw('moves.json');
const learnsets = raw('learnsets.json');
const species = raw('species.json').data.pokemon_v2_pokemonspecies;

const movesPt = tr('moves.pt.json', {});
const abilitiesPt = tr('abilities.pt.json', {});
const abilitiesDesc = tr('abilities.desc.pt.json', {});
const dexPt = tr('dex.pt.json', {});
const dexEn = tr('dex.en.json', {});

const MAX_DEX = 386;
const MAX_MOVE = 467;
const toId = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

// ---------------------------------------------------------------- golpes
const MOVE_FIELDS = [
  'accuracy', 'basePower', 'category', 'pp', 'priority', 'target', 'type', 'flags',
  'secondary', 'secondaries', 'boosts', 'self', 'drain', 'recoil', 'heal', 'multihit',
  'critRatio', 'ohko', 'damage', 'status', 'volatileStatus', 'weather', 'sideCondition',
  'forceSwitch', 'selfSwitch', 'selfdestruct', 'pseudoWeather', 'hasCrashDamage',
  'willCrit', 'thawsTarget', 'ignoreImmunity', 'breaksProtect', 'stallingMove', 'sleepUsable',
];
const MOVES = {};
for (const [id, m] of Object.entries(moves)) {
  if (!(m.num > 0 && m.num <= MAX_MOVE) || m.isZ || m.isMax) continue;
  if (id.startsWith('hiddenpower') && id !== 'hiddenpower') continue;
  const o = { num: m.num, name: movesPt[id] || m.name, en: m.name };
  for (const f of MOVE_FIELDS) if (m[f] !== undefined) o[f] = m[f];
  // flags enxutos
  if (o.flags) {
    const keep = {};
    for (const k of ['contact', 'sound', 'punch', 'bite', 'charge', 'recharge', 'protect', 'heal', 'defrost', 'powder', 'bullet', 'pulse']) if (o.flags[k]) keep[k] = 1;
    o.flags = keep;
  }
  if (o.self && o.self.volatileStatus === 'mustrecharge') { o.recharge = true; }
  MOVES[id] = o;
}

// ---------------------------------------------------------------- pokémon
const GROWTH = {
  'slow': 'slow', 'medium': 'medium', 'fast': 'fast', 'medium-slow': 'mslow',
  'slow-then-very-fast': 'erratic', 'fast-then-very-slow': 'fluct',
};
const ITEM_IDS = {
  'Thunder Stone': 'pedratrovao', 'Moon Stone': 'pedralua', 'Fire Stone': 'pedrafogo',
  'Leaf Stone': 'pedrafolha', 'Water Stone': 'pedraagua', 'Sun Stone': 'pedrasol',
  "King's Rock": 'pedradorei', 'Metal Coat': 'revestimentometal', 'Dragon Scale': 'escamadragao',
  'Up-Grade': 'upgrade', 'Prism Scale': 'escamaprisma', 'Deep Sea Tooth': 'dentemarinho',
  'Deep Sea Scale': 'escamamarinha',
};
const LEGENDARY = new Set([144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 251, 377, 378, 379, 380, 381, 382, 383, 384, 385, 386]);

const specById = Object.fromEntries(species.map((s) => [s.id, s]));
const byName = {};
for (const s of Object.values(dex)) if (s.num >= 1 && s.num <= MAX_DEX && !s.forme) byName[s.name] = s;

function learnsetFor(id, s) {
  let entry = learnsets[id];
  // formas base sem learnset próprio herdam do pré-evolução
  const out = [];
  const seen = new Set();
  const collect = (prefix) => {
    if (!entry || !entry.learnset) return;
    for (const [mv, srcs] of Object.entries(entry.learnset)) {
      if (!MOVES[mv]) continue;
      for (const src of srcs) {
        if (src.startsWith(prefix)) {
          const lvl = parseInt(src.slice(prefix.length), 10);
          const key = mv + ':' + lvl;
          if (!seen.has(key)) { seen.add(key); out.push([lvl, mv]); }
        }
      }
    }
  };
  collect('4L');
  if (out.length < 4) collect('3L');
  if (out.length < 2) collect('9L');
  out.sort((a, b) => a[0] - b[0]);
  const tms = [];
  if (entry && entry.learnset) {
    for (const [mv, srcs] of Object.entries(entry.learnset)) {
      if (MOVES[mv] && srcs.some((x) => x === '4M' || x === '3M')) tms.push(mv);
    }
  }
  return { levels: out, tms };
}

// Os textos da Pokédex citam alguns golpes pelo nome em inglês: troca pelo nome em português.
const MOVE_EN_PT = Object.values(MOVES).filter((m) => m.name !== m.en && m.en.length >= 4).sort((a, b) => b.en.length - a.en.length);
function ptMoveNames(text) {
  for (const m of MOVE_EN_PT) {
    const re = new RegExp(`\\b${m.en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    text = text.replace(re, m.name);
  }
  return text;
}

const POKEDEX = {};
const DEXTEXT = {};
for (const s of Object.values(byName)) {
  const id = toId(s.name);
  const sp = specById[s.num] || {};
  const pk = (sp.pokemon_v2_pokemons || [])[0] || {};
  const evos = [];
  for (const evoName of s.evos || []) {
    const e = byName[evoName];
    if (!e) continue; // evolução de geração posterior
    const ev = { to: e.num };
    switch (e.evoType) {
      case undefined: ev.kind = 'level'; ev.level = e.evoLevel; if (e.evoCondition) ev.cond = e.evoCondition; break;
      case 'useItem': ev.kind = 'item'; ev.item = ITEM_IDS[e.evoItem] || toId(e.evoItem); break;
      case 'trade':
        ev.kind = 'trade';
        if (e.evoItem) ev.item = ITEM_IDS[e.evoItem] || toId(e.evoItem);
        if (e.evoItem === 'Prism Scale') { ev.kind = 'item'; }
        break;
      case 'levelFriendship':
        ev.kind = 'friendship';
        if (e.evoCondition === 'during the day') ev.time = 'day';
        if (e.evoCondition === 'at night') ev.time = 'night';
        break;
      default: ev.kind = 'level'; ev.level = e.evoLevel || 30;
    }
    // Tyrogue e Wurmple: condição especial — simplificada
    if (ev.kind === 'level' && !ev.level) ev.level = 20;
    evos.push(ev);
  }
  const prevo = s.prevo && byName[s.prevo] ? byName[s.prevo].num : 0;
  const abil = [s.abilities['0'], s.abilities['1']].filter(Boolean);
  const ls = learnsetFor(id, s);
  POKEDEX[s.num] = {
    id: s.num,
    key: id,
    name: s.name,
    types: s.types,
    base: [s.baseStats.hp, s.baseStats.atk, s.baseStats.def, s.baseStats.spa, s.baseStats.spd, s.baseStats.spe],
    abilities: abil,
    gender: sp.gender_rate ?? 4, // -1 = sem gênero, 0..8 = oitavos fêmea
    catchRate: sp.capture_rate ?? 45,
    growth: GROWTH[sp.pokemon_v2_growthrate?.name] || 'medium',
    baseExp: pk.base_experience || 60,
    height: s.heightm,
    weight: s.weightkg,
    color: s.color,
    prevo,
    evos,
    legendary: LEGENDARY.has(s.num),
    moves: ls.levels,
    tms: ls.tms,
  };
  const pt = dexPt[s.num] || {};
  const en = dexEn[s.num] || {};
  DEXTEXT[s.num] = { genus: pt.genus || en.genus || '', text: ptMoveNames(pt.text || en.text || '') };
}

// ---------------------------------------------------------------- habilidades
const ABILITIES = {};
for (const p of Object.values(POKEDEX)) for (const a of p.abilities) {
  ABILITIES[a] = { name: abilitiesPt[a] || a, desc: abilitiesDesc[a] || '' };
}

const header = '// ARQUIVO GERADO por tools/build-data.mjs — não edite à mão.\n';
const write = (file, name, obj) => {
  fs.writeFileSync(path.join(outDir, file), `${header}export const ${name} = ${JSON.stringify(obj)};\n`);
  console.log('gerado', file, (fs.statSync(path.join(outDir, file)).size / 1024).toFixed(0) + 'KB');
};
write('pokedex.js', 'POKEDEX', POKEDEX);
write('moves.js', 'MOVES', MOVES);
write('abilities.js', 'ABILITIES', ABILITIES);
write('dextext.js', 'DEXTEXT', DEXTEXT);

const untranslated = Object.values(MOVES).filter((m) => m.name === m.en).length;
console.log(`golpes: ${Object.keys(MOVES).length} (${untranslated} sem tradução), pokémon: ${Object.keys(POKEDEX).length}`);
