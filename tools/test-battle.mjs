// Teste de estresse do motor de batalha: milhares de batalhas aleatórias entre IAs.
// Uso: node tools/test-battle.mjs [quantidade]
import { Battle } from '../public/js/shared/battle/engine.js';
import { createPokemon } from '../public/js/shared/pokemon.js';
import { POKEDEX } from '../public/js/shared/data/pokedex.js';
import { MOVES } from '../public/js/shared/data/moves.js';

const N = +process.argv[2] || 2000;
const ids = Object.keys(POKEDEX).map(Number);
const allMoves = Object.keys(MOVES);
const rnd = (a) => a[Math.floor(Math.random() * a.length)];
let turns = 0, errors = 0;
const results = {};
let sample = null;

for (let i = 0; i < N; i++) {
  const mk = () => {
    const m = createPokemon(rnd(ids), 5 + Math.floor(Math.random() * 70));
    // metade das vezes usa golpes totalmente aleatórios, para cobrir todos os casos
    if (Math.random() < 0.5) m.moves = Array.from({ length: 4 }, () => { const id = rnd(allMoves); return { id, pp: MOVES[id].pp, ppMax: MOVES[id].pp }; });
    return m;
  };
  const kind = rnd(['wild', 'trainer', 'pvp']);
  const p0 = Array.from({ length: kind === 'wild' ? 2 : 3 }, mk);
  const p1 = Array.from({ length: kind === 'wild' ? 1 : 3 }, mk);
  const b = new Battle({
    kind,
    sides: [{ name: 'Ash', party: p0, ai: 'trainer' }, { name: 'Gary', party: p1, ai: kind === 'wild' ? 'wild' : 'trainer' }],
    env: { terrain: 'grass', time: 'day', caughtSpecies: new Set() },
    hooks: { onOpponentFaint: () => [{ type: 'exp', amount: 10 }] },
  });
  try {
    let log = b.start();
    let guard = 0;
    while (!b.over && guard++ < 300) {
      if (kind === 'wild' && Math.random() < 0.05) b.choose(0, { type: 'ball', item: 'pokebola' });
      const ev = b.step();
      log = log.concat(ev);
      turns++;
      for (const e of ev) if (e.type === 'msg' && (typeof e.text !== 'string' || e.text.includes('undefined'))) throw new Error('mensagem inválida: ' + JSON.stringify(e));
    }
    results[b.result || 'timeout'] = (results[b.result || 'timeout'] || 0) + 1;
    if (!sample && kind === 'trainer' && log.length > 30) sample = log;
  } catch (e) {
    errors++;
    if (errors < 6) console.error('ERRO', e.stack.split('\n').slice(0, 4).join('\n'));
  }
}
console.log({ battles: N, turns, errors, results });
if (sample) console.log(sample.filter((e) => e.type === 'msg').slice(0, 40).map((e) => '  ' + e.text).join('\n'));
