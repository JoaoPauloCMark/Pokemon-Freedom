// Motor de batalha (regras estilo 4ª geração, com divisão físico/especial por golpe).
// Lógica pura, sem DOM: roda no navegador e no servidor (PvP).
//
// Uso:
//   const b = new Battle({ kind: 'wild'|'trainer'|'pvp', sides: [ladoJogador, ladoOponente], env });
//   let ev = b.start();
//   b.choose(0, { type: 'move', move: 0 }); b.choose(1, ...);   // AI escolhe sozinha se side.ai
//   ev = b.step();   // processa o turno (ou as trocas pendentes)
//   b.needs[side] -> 'action' | 'switch' | null ;  b.over / b.result
import { POKEDEX } from '../data/pokedex.js';
import { MOVES } from '../data/moves.js';
import { typeEffect, TYPE_PT, BOOST_PT } from '../data/types.js';
import { ITEMS } from '../data/items.js';
import { calcStats, monName, isUsable, maxHp } from '../pokemon.js';

const stageMult = (s) => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s));
const accMult = (s) => (s >= 0 ? (3 + s) / 3 : 3 / (3 - s));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const STATUS_IMMUNE_TYPE = { brn: 'Fire', frz: 'Ice', par: 'Electric' };
const SELF_TARGETS = new Set(['self', 'allySide', 'allyTeam', 'adjacentAllyOrSelf', 'allies', 'adjacentAlly']);
const BOOST_ART = { atk: 'O', def: 'A', spa: 'O', spd: 'A', spe: 'A', accuracy: 'A', evasion: 'A' };
const CRIT_CHANCE = [1 / 16, 1 / 8, 1 / 4, 1 / 3, 1 / 2];

// Golpes de estado que simplesmente não fazem sentido em batalhas individuais.
const ALWAYS_FAIL = new Set([
  'followme', 'helpinghand', 'afteryou', 'snatch', 'magiccoat', 'imprison', 'sketch', 'recycle',
  'naturalgift', 'fling', 'embargo', 'healblock', 'grudge', 'mefirst', 'assist', 'camouflage',
  'trick', 'switcheroo', 'bestow', 'luckychant', 'mudsport', 'watersport', 'gravity', 'bide',
  'healingwish', 'lunardance', 'powertrick', 'captivate', 'conversion2', 'mimic', 'teeterdance',
]);

class Battler {
  constructor(battle, side, mon, slot) {
    this.battle = battle;
    this.side = side;
    this.mon = mon;
    this.slot = slot;
    this.reset();
  }
  reset() {
    this.boosts = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 };
    this.vol = {};
    this.turnsOut = 0;
    this.lastMove = null;
    this.moved = false;
    this.typesOverride = null;
    this.abilityOverride = null;
  }
  get sp() { return POKEDEX[this.mon.species]; }
  get stats() {
    const s = calcStats(this.mon);
    return this.vol.transformStats ? [s[0], ...this.vol.transformStats.slice(1)] : s;
  }
  get maxhp() { return this.stats[0]; }
  get hp() { return this.mon.hp; }
  get level() { return this.mon.level; }
  get ability() { return this.abilityOverride || this.mon.ability; }
  get types() {
    let t = this.typesOverride || this.sp.types;
    if (this.vol.roost) t = t.filter((x) => x !== 'Flying');
    return t.length ? t : ['Normal'];
  }
  hasType(t) { return this.types.includes(t); }
  get fainted() { return this.mon.hp <= 0; }
}

export class Battle {
  constructor({ kind = 'wild', sides, rng, env = {}, hooks = {} }) {
    this.kind = kind;
    this.rng = rng || Math.random;
    this.env = env; // { terrain, time, caughtSpecies: Set, trainerNames }
    this.hooks = hooks;
    this.sides = sides.map((s, i) => ({
      name: s.name || (i === 0 ? 'Você' : 'Oponente'),
      party: s.party,
      ai: s.ai || null, // null = humano, 'wild', 'trainer'
      active: null,
      cond: {},
      index: i,
      lastFainted: false,
      trainerClass: s.trainerClass || '',
    }));
    this.field = { weather: null, weatherTurns: 0, trickroom: 0 };
    this.turn = 0;
    this.over = false;
    this.result = null; // 'win' | 'lose' | 'caught' | 'run' | 'forfeit' | 'draw'
    this.winner = null;
    this.events = [];
    this.actions = [null, null];
    this.needs = [null, null];
    this.runAttempts = 0;
    this.participants = new Map();
    this.caught = null;
    this.moneyBonus = 0; // Dia de Pagamento
    this.futureAttacks = [];
    this.pendingFaints = [];
  }

  // ------------------------------------------------------------ nomes
  N(b) {
    const n = monName(b.mon);
    if (b.side === 0 && this.kind !== 'pvp') return n;
    if (this.kind === 'wild') return `o ${n} selvagem`;
    if (this.kind === 'trainer') return `o ${n} do oponente`;
    return `${n} de ${this.sides[b.side].name}`;
  }
  D(b) {
    const n = this.N(b);
    return n.startsWith('o ') ? 'd' + n : 'de ' + n;
  }
  emit(e) { this.events.push(e); }
  msg(text) { this.events.push({ type: 'msg', text }); }
  foe(b) { return this.sides[1 - b.side].active; }
  snapshot(b) {
    return {
      uid: b.mon.uid, name: monName(b.mon), species: b.mon.species, level: b.mon.level, hp: b.mon.hp,
      maxhp: b.maxhp, gender: b.mon.gender, shiny: !!b.mon.shiny, status: b.mon.status, slot: b.slot,
    };
  }

  // ------------------------------------------------------------ início
  start() {
    this.events = [];
    const s1 = this.sides[1];
    const first1 = s1.party.findIndex(isUsable);
    const first0 = this.sides[0].party.findIndex(isUsable);
    if (this.kind === 'wild') {
      this.sendOut(1, first1, true);
      this.msg(`Um ${monName(s1.party[first1])} selvagem apareceu!`);
      this.sendOut(0, first0);
    } else {
      this.msg(`${s1.trainerClass ? s1.trainerClass + ' ' : ''}${s1.name} quer batalhar!`);
      this.sendOut(1, first1);
      this.sendOut(0, first0);
    }
    for (const b of this.speedOrder()) this.onSwitchIn(b);
    this.needs = ['action', 'action'];
    return this.flush();
  }

  sendOut(sideIdx, partyIdx, silent = false) {
    const side = this.sides[sideIdx];
    const mon = side.party[partyIdx];
    const prev = side.active;
    if (prev) this.restoreTransform(prev);
    const b = new Battler(this, sideIdx, mon, partyIdx);
    if (prev && prev.vol.batonpass) {
      b.boosts = { ...prev.boosts };
      for (const k of ['confusion', 'focusenergy', 'substitute', 'leechseed', 'curse', 'ingrain', 'aquaring', 'magnetrise']) {
        if (prev.vol[k] !== undefined) b.vol[k] = prev.vol[k];
      }
    }
    side.active = b;
    if (!silent) {
      if (sideIdx === 0 && this.kind !== 'pvp') this.msg(`Vai, ${monName(mon)}!`);
      else if (this.kind === 'wild') { /* nada */ }
      else this.msg(`${side.name} enviou ${monName(mon)}!`);
    }
    this.emit({ type: 'switch', side: sideIdx, info: this.snapshot(b) });
    this.markParticipant();
    return b;
  }

  restoreTransform(b) {
    if (b.vol.origMoves) {
      b.mon.moves = b.vol.origMoves;
      delete b.vol.origMoves;
    }
  }

  markParticipant() {
    const a = this.sides[0].active, o = this.sides[1].active;
    if (!a || !o) return;
    if (!this.participants.has(o.mon.uid)) this.participants.set(o.mon.uid, new Set());
    this.participants.get(o.mon.uid).add(a.mon.uid);
  }

  onSwitchIn(b) {
    if (!b || b.fainted) return;
    const side = this.sides[b.side];
    // perigos de entrada
    if (side.cond.spikes) {
      if (!b.hasType('Flying') && b.ability !== 'Levitate') {
        const frac = [0, 1 / 8, 1 / 6, 1 / 4][side.cond.spikes];
        this.damage(b, Math.max(1, Math.floor(b.maxhp * frac)), null, `${cap(this.N(b))} foi ferido pelos espinhos!`);
      }
    }
    if (side.cond.stealthrock && !b.fainted) {
      const eff = typeEffect('Rock', b.types);
      this.damage(b, Math.max(1, Math.floor((b.maxhp * eff) / 8)), null, `Pedras pontiagudas atingiram ${this.N(b)}!`);
    }
    if (side.cond.toxicspikes && !b.fainted && !b.hasType('Flying') && b.ability !== 'Levitate') {
      if (b.hasType('Poison')) { delete side.cond.toxicspikes; this.msg('Os espinhos tóxicos foram absorvidos!'); }
      else if (!b.mon.status && !b.hasType('Steel')) this.setStatus(b, side.cond.toxicspikes >= 2 ? 'tox' : 'psn', null, true);
    }
    if (b.fainted) return;
    const foe = this.foe(b);
    switch (b.ability) {
      case 'Intimidate':
        if (foe && !foe.fainted) {
          this.msg(`A Intimidação ${this.D(b)} assustou ${this.N(foe)}!`);
          this.boost(foe, { atk: -1 }, b, true);
        }
        break;
      case 'Drizzle': this.setWeather('rain', 999, b); break;
      case 'Drought': this.setWeather('sun', 999, b); break;
      case 'Sand Stream': this.setWeather('sand', 999, b); break;
      case 'Snow Warning': this.setWeather('hail', 999, b); break;
      case 'Pressure': this.msg(`${cap(this.N(b))} está exercendo sua Pressão!`); break;
      default: break;
    }
  }

  flush() {
    const e = this.events;
    this.events = [];
    return e;
  }

  // ------------------------------------------------------------ escolhas
  choose(sideIdx, action) {
    this.actions[sideIdx] = action;
  }

  ready() {
    for (let i = 0; i < 2; i++) {
      if (this.needs[i] && !this.actions[i] && !this.sides[i].ai) return false;
    }
    return true;
  }

  usableMoves(b) {
    const list = [];
    b.mon.moves.forEach((m, i) => {
      if (m.pp <= 0) return;
      if (b.vol.disable && b.vol.disable.move === m.id) return;
      if (b.vol.taunt && MOVES[m.id].category === 'Status') return;
      if (b.vol.encore && b.vol.encore.move !== m.id) return;
      list.push(i);
    });
    return list;
  }

  aiChoose(sideIdx) {
    const side = this.sides[sideIdx];
    const b = side.active;
    if (this.needs[sideIdx] === 'switch') {
      const opts = side.party.map((m, i) => i).filter((i) => isUsable(side.party[i]) && i !== (b && b.slot));
      if (!opts.length) return null;
      if (side.ai === 'trainer') {
        // escolhe o melhor tipo contra o ativo do jogador
        const foe = this.sides[1 - sideIdx].active;
        let best = opts[0], bestScore = -1;
        for (const i of opts) {
          const m = side.party[i];
          let s = m.level + this.rng() * 5;
          if (foe) for (const mv of m.moves) {
            const md = MOVES[mv.id];
            if (md.category !== 'Status') s += 10 * typeEffect(md.type, foe.types);
          }
          if (s > bestScore) { bestScore = s; best = i; }
        }
        return { type: 'switch', index: best };
      }
      return { type: 'switch', index: opts[0] };
    }
    const usable = this.usableMoves(b);
    if (!usable.length) return { type: 'move', move: -1 };
    if (side.ai === 'wild') return { type: 'move', move: usable[Math.floor(this.rng() * usable.length)] };
    // treinador: pontua os golpes
    const foe = this.foe(b);
    let best = usable[0], bestScore = -Infinity;
    for (const i of usable) {
      const md = MOVES[b.mon.moves[i].id];
      let score;
      if (md.category === 'Status') {
        score = 25;
        if (md.status && foe.mon.status) score = -10;
        if (md.status && !foe.mon.status) score = 45;
        if (md.boosts && md.target === 'self') score = b.turnsOut < 2 && b.hp > b.maxhp * 0.6 ? 40 : 5;
        if (md.heal) score = b.hp < b.maxhp * 0.45 ? 80 : -5;
        if (md.volatileStatus === 'confusion' && foe.vol.confusion) score = -10;
        if (md.volatileStatus === 'leechseed' && (foe.vol.leechseed || foe.hasType('Grass'))) score = -10;
        if (md.sideCondition && this.sides[md.target === 'foeSide' ? 1 - sideIdx : sideIdx].cond[md.sideCondition.toLowerCase()]) score = -10;
        if (md.weather) score = 15;
      } else {
        const eff = typeEffect(md.type, foe.types);
        const stab = b.hasType(md.type) ? 1.5 : 1;
        const pw = md.basePower || 60;
        const acc = md.accuracy === true ? 100 : md.accuracy;
        score = pw * eff * stab * (acc / 100);
        if (md.recharge) score *= 0.6;
        if (md.selfdestruct) score = b.hp < b.maxhp * 0.25 ? score : -20;
        if (md.ohko) score = 30;
      }
      score += this.rng() * 25;
      if (score > bestScore) { bestScore = score; best = i; }
    }
    return { type: 'move', move: best };
  }

  // ------------------------------------------------------------ processamento
  step() {
    this.events = [];
    if (this.over) return this.flush();
    for (let i = 0; i < 2; i++) {
      if (this.needs[i] && this.sides[i].ai && !this.actions[i]) this.actions[i] = this.aiChoose(i);
    }
    if (this.needs[0] === 'switch' || this.needs[1] === 'switch') {
      this.processSwitches();
    } else {
      this.runTurn();
    }
    this.actions = [null, null];
    this.afterStep();
    return this.flush();
  }

  processSwitches() {
    for (let i = 0; i < 2; i++) {
      if (this.needs[i] === 'switch' && this.actions[i] && this.actions[i].type === 'forfeit') { this.forfeit(i); return; }
    }
    const switched = [];
    for (let i = 0; i < 2; i++) {
      const act = this.actions[i];
      if (this.needs[i] !== 'switch' || !act || act.type !== 'switch') continue;
      const old = this.sides[i].active;
      if (old && !old.fainted) {
        this.msg(i === 0 && this.kind !== 'pvp' ? `${monName(old.mon)}, volte!` : `${this.sides[i].name} recolheu ${monName(old.mon)}!`);
      }
      switched.push(this.sendOut(i, act.index));
    }
    for (const b of switched) this.onSwitchIn(b);
    this.checkFaints();
  }

  forfeit(sideIdx) {
    this.msg(`${this.sides[sideIdx].name} desistiu da batalha!`);
    this.end(1 - sideIdx, 'forfeit');
  }

  // Define o que cada lado precisa escolher a seguir. Se alguém precisa trocar
  // de Pokémon (desmaio, Troca Rápida/U-turn), o outro lado espera.
  afterStep() {
    if (this.over) { this.needs = [null, null]; return; }
    const needs = [null, null];
    for (let i = 0; i < 2; i++) {
      const side = this.sides[i];
      const b = side.active;
      const others = side.party.some((m, idx) => isUsable(m) && (!b || idx !== b.slot));
      if (!b || b.fainted) { needs[i] = others ? 'switch' : null; continue; }
      if (b.vol.pendingSwitch) {
        delete b.vol.pendingSwitch;
        if (others) { needs[i] = 'switch'; continue; }
        delete b.vol.batonpass;
      }
    }
    if (needs[0] !== 'switch' && needs[1] !== 'switch') {
      this.needs = ['action', 'action'];
    } else {
      this.needs = needs;
    }
  }

  speedOf(b) {
    let s = b.stats[5] * stageMult(b.boosts.spe);
    if (b.mon.status === 'par') s *= 0.25;
    if (b.ability === 'Swift Swim' && this.field.weather === 'rain') s *= 2;
    if (b.ability === 'Chlorophyll' && this.field.weather === 'sun') s *= 2;
    if (this.sides[b.side].cond.tailwind) s *= 2;
    return s;
  }

  speedOrder() {
    const list = this.sides.map((s) => s.active).filter((b) => b && !b.fainted);
    list.sort((a, b) => {
      let d = this.speedOf(b) - this.speedOf(a);
      if (this.field.trickroom) d = -d;
      return d || (this.rng() < 0.5 ? -1 : 1);
    });
    return list;
  }

  actionPriority(side, act) {
    if (!act) return -99;
    if (act.type === 'run' || act.type === 'forfeit') return 8;
    if (act.type === 'switch') return 7;
    if (act.type === 'item' || act.type === 'ball') return 6;
    const b = this.sides[side].active;
    const mv = this.resolveMoveId(b, act);
    return MOVES[mv] ? MOVES[mv].priority || 0 : 0;
  }

  resolveMoveId(b, act) {
    if (b.vol.mustRecharge) return 'recharge';
    if (b.vol.charging) return b.vol.charging;
    if (b.vol.lockedMove) return b.vol.lockedMove.id;
    if (b.vol.encore) return b.vol.encore.move;
    if (act.move === -1 || act.move === undefined) return 'struggle';
    const m = b.mon.moves[act.move];
    if (!m) return 'struggle';
    return m.id;
  }

  runTurn() {
    this.turn++;
    const entries = [0, 1].map((i) => ({ side: i, act: this.actions[i] || { type: 'move', move: -1 } }));
    for (const s of this.sides) if (s.active) { s.active.moved = false; s.active.vol.hitThisTurn = 0; }
    // trava de ação (recarga/carregamento/golpe travado) força o golpe
    for (const e of entries) {
      const b = this.sides[e.side].active;
      if (b && (b.vol.mustRecharge || b.vol.charging || b.vol.lockedMove)) e.act = { type: 'move', move: -2 };
    }
    entries.forEach((e) => { e.prio = this.actionPriority(e.side, e.act); e.speed = this.speedOf(this.sides[e.side].active); });
    entries.sort((a, b) => {
      if (b.prio !== a.prio) return b.prio - a.prio;
      let d = b.speed - a.speed;
      if (this.field.trickroom && a.act.type === 'move' && b.act.type === 'move') d = -d;
      return d || (this.rng() < 0.5 ? -1 : 1);
    });
    for (const e of entries) {
      if (this.over) break;
      const b = this.sides[e.side].active;
      if (!b) continue;
      if (e.act.type !== 'switch' && b.fainted) continue;
      this.doAction(e.side, e.act);
      this.flushFaints();
      const nb = this.sides[e.side].active;
      if (nb) nb.moved = true;
      this.checkFaints();
    }
    if (!this.over) this.endOfTurn();
    if (!this.over) this.checkFaints();
  }

  doAction(sideIdx, act) {
    const side = this.sides[sideIdx];
    const b = side.active;
    switch (act.type) {
      case 'run': return this.tryRun(b);
      case 'forfeit': return this.forfeit(sideIdx);
      case 'switch': {
        if (b && !b.fainted) {
          this.msg(sideIdx === 0 && this.kind !== 'pvp' ? `${monName(b.mon)}, volte!` : `${side.name} recolheu ${monName(b.mon)}!`);
          if (b.ability === 'Natural Cure' && b.mon.status) { b.mon.status = null; }
          if (b.mon.status === 'tox') b.mon.toxCount = 0;
        }
        const nb = this.sendOut(sideIdx, act.index);
        this.onSwitchIn(nb);
        return;
      }
      case 'item': return this.useItem(sideIdx, act);
      case 'ball': return this.throwBall(sideIdx, act.item);
      case 'move': default: {
        const moveId = this.resolveMoveId(b, act);
        return this.useMove(b, moveId, act.move);
      }
    }
  }

  // ------------------------------------------------------------ fugir / itens / bolas
  tryRun(b) {
    if (this.kind === 'pvp') return this.forfeit(b.side);
    if (this.kind === 'trainer') { this.msg('Não dá para fugir de uma batalha de treinador!'); return; }
    const foe = this.foe(b);
    if ((b.vol.bound || b.vol.cantEscape) && !b.hasType('Ghost')) { this.msg('Não foi possível fugir!'); return; }
    this.runAttempts++;
    const ps = this.speedOf(b), fs = this.speedOf(foe);
    let ok = ps >= fs || b.ability === 'Run Away';
    if (!ok) {
      const f = Math.floor((ps * 128) / Math.max(1, fs)) + 30 * this.runAttempts;
      ok = Math.floor(this.rng() * 256) < f;
    }
    if (ok) {
      this.msg('Você fugiu em segurança!');
      this.emit({ type: 'run' });
      this.end(null, 'run');
    } else {
      this.msg('Não foi possível fugir!');
    }
  }

  useItem(sideIdx, act) {
    const it = ITEMS[act.item];
    const side = this.sides[sideIdx];
    const mon = side.party[act.target];
    if (!it || !mon) return;
    this.msg(`${sideIdx === 0 && this.kind !== 'pvp' ? 'Você' : side.name} usou ${it.name}!`);
    const active = side.active && side.active.mon === mon ? side.active : null;
    let did = false;
    if (it.revive && mon.hp <= 0) {
      mon.hp = Math.max(1, Math.floor(maxHp(mon) * it.revive));
      mon.status = null;
      this.msg(`${monName(mon)} foi revivido!`);
      did = true;
    } else if (mon.hp > 0) {
      if (it.heal) {
        const mh = maxHp(mon);
        const before = mon.hp;
        mon.hp = Math.min(mh, mon.hp + it.heal);
        if (mon.hp > before) {
          did = true;
          if (active) this.emit({ type: 'heal', side: sideIdx, hp: mon.hp, maxhp: mh });
          this.msg(`Os PS de ${monName(mon)} foram restaurados.`);
        }
      }
      if (it.cure && mon.status && (it.cure === 'all' || it.cure === mon.status || (it.cure === 'psn' && mon.status === 'tox'))) {
        mon.status = null;
        if (active) { this.emit({ type: 'status', side: sideIdx, status: null }); if (it.cure === 'all') delete active.vol.confusion; }
        this.msg(`${monName(mon)} está curado!`);
        did = true;
      }
      if (it.pp) {
        const list = it.allPp ? mon.moves : [mon.moves[act.moveIndex || 0]];
        for (const m of list) if (m) { m.pp = Math.min(m.ppMax, m.pp + it.pp); did = true; }
        if (did) this.msg(`Os PP de ${monName(mon)} foram restaurados.`);
      }
    }
    if (!did) this.msg('Não teve efeito.');
  }

  throwBall(sideIdx, itemId) {
    const it = ITEMS[itemId];
    const target = this.sides[1 - sideIdx].active;
    this.msg(`Você jogou uma ${it.name}!`);
    if (this.kind !== 'wild') {
      this.emit({ type: 'ball', item: itemId, shakes: -1, caught: false });
      this.msg('O treinador bloqueou a bola! Não roube Pokémon dos outros!');
      return;
    }
    const sp = target.sp;
    let bm = it.ball;
    if (typeof bm === 'string') {
      switch (bm) {
        case 'net': bm = target.hasType('Water') || target.hasType('Bug') ? 3 : 1; break;
        case 'dive': bm = this.env.terrain === 'water' ? 3.5 : 1; break;
        case 'nest': bm = Math.max(1, (41 - target.level) / 10); break;
        case 'repeat': bm = this.env.caughtSpecies && this.env.caughtSpecies.has(sp.id) ? 3 : 1; break;
        case 'timer': bm = Math.min(4, 1 + this.turn * 0.3); break;
        case 'dusk': bm = this.env.time === 'night' || this.env.terrain === 'cave' ? 3.5 : 1; break;
        case 'quick': bm = this.turn <= 1 ? 5 : 1; break;
        default: bm = 1;
      }
    }
    let shakes = 0, caught = false;
    if (bm >= 255) { caught = true; shakes = 3; }
    else {
      const M = target.maxhp, H = target.hp;
      const st = target.mon.status;
      const sm = st === 'slp' || st === 'frz' ? 2.5 : st ? 1.5 : 1;
      // pequeno bônus para deixar a captura mais amigável que o original
      const a = Math.floor((((3 * M - 2 * H) * sp.catchRate * bm) / (3 * M)) * sm * 1.25);
      if (a >= 255) { caught = true; shakes = 3; }
      else {
        const b = 1048560 / Math.sqrt(Math.sqrt(16711680 / Math.max(1, a)));
        for (shakes = 0; shakes < 4; shakes++) if (this.rng() * 65536 >= b) break;
        caught = shakes >= 4;
        shakes = Math.min(shakes, 3);
      }
    }
    this.emit({ type: 'ball', item: itemId, shakes, caught });
    if (caught) {
      this.msg(`Peguei! ${monName(target.mon)} foi capturado!`);
      target.mon.ball = itemId;
      this.caught = target.mon;
      this.end(sideIdx, 'caught');
    } else {
      this.msg(['Ah, não! O Pokémon escapou!', 'Ah! Parecia que tinha conseguido!', 'Argh! Quase!', 'Puxa! Foi por pouco!'][shakes]);
    }
  }

  // ------------------------------------------------------------ golpes
  useMove(user, moveId, slotIdx) {
    if (user.fainted) return;
    const foe = this.foe(user);
    if (moveId === 'recharge') {
      delete user.vol.mustRecharge;
      this.msg(`${cap(this.N(user))} precisa recarregar!`);
      return;
    }
    let move = MOVES[moveId] || MOVES.struggle;
    // ---- impedimentos
    if (user.mon.status === 'frz') {
      if (move.flags && move.flags.defrost || this.rng() < 0.2) {
        user.mon.status = null;
        this.emit({ type: 'status', side: user.side, status: null });
        this.msg(`${cap(this.N(user))} descongelou!`);
      } else {
        this.msg(`${cap(this.N(user))} está congelado!`);
        this.emit({ type: 'statusanim', side: user.side, status: 'frz' });
        return;
      }
    }
    if (user.mon.status === 'slp') {
      user.mon.sleepTurns = (user.mon.sleepTurns || 1) - (user.ability === 'Early Bird' ? 2 : 1);
      if (user.mon.sleepTurns <= 0) {
        user.mon.status = null;
        delete user.mon.sleepTurns;
        this.emit({ type: 'status', side: user.side, status: null });
        this.msg(`${cap(this.N(user))} acordou!`);
        delete user.vol.nightmare;
      } else if (!move.sleepUsable) {
        this.msg(`${cap(this.N(user))} está dormindo profundamente.`);
        this.emit({ type: 'statusanim', side: user.side, status: 'slp' });
        delete user.vol.charging; delete user.vol.lockedMove;
        return;
      }
    }
    if (user.ability === 'Truant') {
      user.vol.truant = !user.vol.truant;
      if (!user.vol.truant) { this.msg(`${cap(this.N(user))} está fazendo corpo mole!`); return; }
    }
    if (user.vol.flinch) {
      delete user.vol.flinch;
      this.msg(`${cap(this.N(user))} recuou e não pôde atacar!`);
      return;
    }
    if (user.vol.confusion) {
      user.vol.confusion--;
      if (user.vol.confusion <= 0) {
        delete user.vol.confusion;
        this.msg(`${cap(this.N(user))} não está mais confuso!`);
      } else {
        this.msg(`${cap(this.N(user))} está confuso!`);
        this.emit({ type: 'statusanim', side: user.side, status: 'confusion' });
        if (this.rng() < 0.5) {
          const atk = user.stats[1] * stageMult(user.boosts.atk);
          const def = user.stats[2] * stageMult(user.boosts.def);
          const dmg = Math.max(1, Math.floor(Math.floor(Math.floor((2 * user.level) / 5 + 2) * 40 * atk / def) / 50) + 2);
          this.damage(user, dmg, null, 'Ele se machucou na confusão!');
          delete user.vol.charging; delete user.vol.lockedMove;
          return;
        }
      }
    }
    if (user.mon.status === 'par' && this.rng() < 0.25) {
      this.msg(`${cap(this.N(user))} está paralisado! Não consegue se mover!`);
      this.emit({ type: 'statusanim', side: user.side, status: 'par' });
      delete user.vol.charging; delete user.vol.lockedMove;
      return;
    }
    if (user.vol.attract && foe && this.rng() < 0.5) {
      this.msg(`${cap(this.N(user))} está apaixonado e não atacou!`);
      return;
    }
    if (user.vol.taunt && move.category === 'Status') {
      this.msg(`${cap(this.N(user))} não pode usar ${move.name} por causa da Provocação!`);
      return;
    }
    if (user.vol.disable && user.vol.disable.move === moveId) {
      this.msg(`${move.name} ${this.D(user)} está desabilitado!`);
      return;
    }
    if (moveId === 'focuspunch' && user.vol.hitThisTurn) {
      this.msg(`${cap(this.N(user))} perdeu a concentração e não atacou!`);
      return;
    }
    // ---- PP
    const continuing = user.vol.charging === moveId || (user.vol.lockedMove && user.vol.lockedMove.id === moveId);
    if (!continuing && moveId !== 'struggle') {
      const slot = user.mon.moves.find((m) => m.id === moveId);
      if (slot) {
        if (slot.pp <= 0) { this.msg('Não há mais PP para este golpe!'); return; }
        slot.pp -= foe && foe.ability === 'Pressure' ? Math.min(2, slot.pp) : 1;
      }
    }
    // Metrônomo
    if (moveId === 'metronome') {
      this.msg(`${cap(this.N(user))} usou ${move.name}!`);
      const pool = Object.keys(MOVES).filter((k) => !['metronome', 'struggle', 'mimic', 'sketch', 'counter', 'mirrorcoat', 'protect', 'detect', 'endure', 'transform', 'focuspunch', 'snatch', 'thief', 'covet', 'trick', 'assist', 'mefirst', 'copycat', 'sleeptalk'].includes(k));
      moveId = pool[Math.floor(this.rng() * pool.length)];
      move = MOVES[moveId];
    } else if (moveId === 'sleeptalk') {
      this.msg(`${cap(this.N(user))} usou ${move.name}!`);
      if (user.mon.status !== 'slp') { this.msg('Mas falhou!'); return; }
      const opts = user.mon.moves.filter((m) => !['sleeptalk', 'focuspunch', 'bide', 'uproar', 'skullbash', 'solarbeam', 'razorwind', 'skyattack', 'fly', 'dig', 'dive', 'bounce'].includes(m.id) && !MOVES[m.id].flags?.charge);
      if (!opts.length) { this.msg('Mas falhou!'); return; }
      moveId = opts[Math.floor(this.rng() * opts.length)].id;
      move = MOVES[moveId];
    } else if (moveId === 'copycat' || moveId === 'mirrormove') {
      this.msg(`${cap(this.N(user))} usou ${move.name}!`);
      const last = moveId === 'mirrormove' ? (foe && foe.lastMove) : this.lastMoveUsed;
      if (!last || last === 'copycat' || last === 'mirrormove' || !MOVES[last]) { this.msg('Mas falhou!'); return; }
      moveId = last; move = MOVES[last];
    } else if (moveId === 'naturepower') {
      this.msg(`${cap(this.N(user))} usou ${move.name}!`);
      moveId = { water: 'hydropump', cave: 'rockslide', snow: 'blizzard', sand: 'earthquake' }[this.env.terrain] || 'seedbomb';
      move = MOVES[moveId] || MOVES.triattack;
    }

    // ---- turno de carga
    if (move.flags && move.flags.charge && user.vol.charging !== moveId) {
      if (!(moveId === 'solarbeam' && this.field.weather === 'sun')) {
        this.msg(`${cap(this.N(user))} usou ${move.name}!`);
        user.vol.charging = moveId;
        const semi = { fly: 'fly', bounce: 'fly', dig: 'dig', dive: 'dive', shadowforce: 'shadow' }[moveId];
        if (semi) user.vol.semi = semi;
        const txt = {
          solarbeam: `${cap(this.N(user))} absorveu a luz!`, fly: `${cap(this.N(user))} voou bem alto!`,
          bounce: `${cap(this.N(user))} saltou bem alto!`, dig: `${cap(this.N(user))} cavou um buraco!`,
          dive: `${cap(this.N(user))} mergulhou!`, skullbash: `${cap(this.N(user))} abaixou a cabeça!`,
          skyattack: `${cap(this.N(user))} está envolto em uma luz forte!`, razorwind: `${cap(this.N(user))} criou um redemoinho!`,
          shadowforce: `${cap(this.N(user))} desapareceu!`,
        }[moveId] || `${cap(this.N(user))} está se preparando!`;
        this.msg(txt);
        this.emit({ type: 'charge', side: user.side, semi: !!semi });
        if (moveId === 'skullbash') this.boost(user, { def: 1 }, user, true);
        return;
      }
    }
    if (user.vol.charging === moveId) { delete user.vol.charging; delete user.vol.semi; this.emit({ type: 'charge', side: user.side, semi: false, end: true }); }

    this.msg(`${cap(this.N(user))} usou ${move.name}!`);
    user.lastMove = moveId;
    this.lastMoveUsed = moveId;

    // ---- alvo
    const selfTarget = SELF_TARGETS.has(move.target);
    const fieldTarget = ['all', 'foeSide'].includes(move.target) || move.weather || move.pseudoWeather;
    const target = selfTarget ? user : foe;
    if (!selfTarget && !fieldTarget && (!target || target.fainted)) { this.msg('Mas não havia alvo!'); return; }

    if (ALWAYS_FAIL.has(moveId)) { this.msg('Mas falhou!'); return; }

    // ---- proteção
    if (!selfTarget && !fieldTarget && target.vol.protect && move.flags && move.flags.protect) {
      this.msg(`${cap(this.N(target))} se protegeu!`);
      if (move.hasCrashDamage) this.crash(user);
      delete user.vol.lockedMove;
      return;
    }
    // ---- semi-invulnerável
    if (!selfTarget && !fieldTarget && target.vol.semi && !user.vol.lockon) {
      const hits = {
        fly: ['thunder', 'gust', 'twister', 'skyuppercut', 'smackdown'],
        dig: ['earthquake', 'magnitude', 'fissure'],
        dive: ['surf', 'whirlpool'],
        shadow: [],
      }[target.vol.semi] || [];
      if (!hits.includes(moveId)) {
        this.msg(`O ataque ${this.D(user)} errou!`);
        return;
      }
    }
    // ---- precisão
    if (!selfTarget && !fieldTarget && !this.accuracyCheck(user, target, move, moveId)) {
      this.msg(`O ataque ${this.D(user)} errou!`);
      if (move.hasCrashDamage) this.crash(user);
      delete user.vol.lockedMove;
      return;
    }
    delete user.vol.lockon;

    this.emit({ type: 'anim', side: user.side, move: moveId, moveType: move.type, category: move.category, target: target ? target.side : 1 - user.side });

    if (move.category === 'Status') this.statusMove(user, target, move, moveId);
    else this.attackMove(user, target, move, moveId);

    // golpes travados (Thrash, Outrage, Petal Dance)
    if (move.self && move.self.volatileStatus === 'lockedmove' && !user.fainted) {
      if (!user.vol.lockedMove) user.vol.lockedMove = { id: moveId, turns: 1 + Math.floor(this.rng() * 2) };
      else {
        user.vol.lockedMove.turns--;
        if (user.vol.lockedMove.turns <= 0) {
          delete user.vol.lockedMove;
          if (!user.vol.confusion) { user.vol.confusion = 2 + Math.floor(this.rng() * 4); this.msg(`${cap(this.N(user))} ficou confuso de cansaço!`); }
        }
      }
    }
  }

  crash(user) {
    this.damage(user, Math.floor(user.maxhp / 2), null, `${cap(this.N(user))} caiu e se machucou!`);
  }

  accuracyCheck(user, target, move, moveId) {
    if (move.accuracy === true) return true;
    if (user.vol.lockon) return true;
    if (move.ohko) {
      if (target.level > user.level || target.ability === 'Sturdy') return false;
      return this.rng() * 100 < 30 + user.level - target.level;
    }
    let acc = move.accuracy;
    if (moveId === 'thunder' && this.field.weather === 'rain') return true;
    if (moveId === 'thunder' && this.field.weather === 'sun') acc = 50;
    if (moveId === 'blizzard' && this.field.weather === 'hail') return true;
    let stage = user.boosts.accuracy - (target.vol.foresight ? Math.min(0, target.boosts.evasion) : target.boosts.evasion);
    stage = Math.max(-6, Math.min(6, stage));
    acc *= accMult(stage);
    if (user.ability === 'Compound Eyes') acc *= 1.3;
    if (user.ability === 'Hustle' && move.category === 'Physical') acc *= 0.8;
    if (target.ability === 'Sand Veil' && this.field.weather === 'sand') acc *= 0.8;
    if (target.ability === 'Snow Cloak' && this.field.weather === 'hail') acc *= 0.8;
    return this.rng() * 100 < acc;
  }

  hiddenPowerType(mon) {
    const order = ['Fighting', 'Flying', 'Poison', 'Ground', 'Rock', 'Bug', 'Ghost', 'Steel', 'Fire', 'Water', 'Grass', 'Electric', 'Psychic', 'Ice', 'Dragon', 'Dark'];
    const iv = mon.ivs;
    const bits = [iv[0], iv[1], iv[2], iv[5], iv[3], iv[4]].reduce((acc, v, i) => acc + ((v & 1) << i), 0);
    return order[Math.floor((bits * 15) / 63)];
  }

  moveType(user, move, moveId) {
    if (moveId === 'hiddenpower') return this.hiddenPowerType(user.mon);
    if (moveId === 'weatherball') return { rain: 'Water', sun: 'Fire', sand: 'Rock', hail: 'Ice' }[this.field.weather] || 'Normal';
    if (moveId === 'struggle') return '???';
    return move.type;
  }

  movePower(user, target, move, moveId) {
    let bp = move.basePower || 0;
    const hpr = user.hp / user.maxhp;
    switch (moveId) {
      case 'flail': case 'reversal': {
        const p = Math.floor((48 * user.hp) / user.maxhp);
        bp = p <= 1 ? 200 : p <= 4 ? 150 : p <= 9 ? 100 : p <= 16 ? 80 : p <= 32 ? 40 : 20;
        break;
      }
      case 'eruption': case 'waterspout': bp = Math.max(1, Math.floor(150 * hpr)); break;
      case 'return': bp = Math.max(1, Math.floor((user.mon.friendship || 70) / 2.5)); break;
      case 'frustration': bp = Math.max(1, Math.floor((255 - (user.mon.friendship || 70)) / 2.5)); break;
      case 'lowkick': case 'grassknot': {
        const w = target.sp.weight;
        bp = w >= 200 ? 120 : w >= 100 ? 100 : w >= 50 ? 80 : w >= 25 ? 60 : w >= 10 ? 40 : 20;
        break;
      }
      case 'magnitude': {
        const r = this.rng() * 100;
        const [mag, pw] = r < 5 ? [4, 10] : r < 15 ? [5, 30] : r < 35 ? [6, 50] : r < 65 ? [7, 70] : r < 85 ? [8, 90] : r < 95 ? [9, 110] : [10, 150];
        this.msg(`Magnitude ${mag}!`);
        bp = pw;
        break;
      }
      case 'present': {
        const r = this.rng();
        bp = r < 0.4 ? 40 : r < 0.7 ? 80 : r < 0.8 ? 120 : 0;
        break;
      }
      case 'gyroball': bp = Math.min(150, Math.floor((25 * this.speedOf(target)) / Math.max(1, this.speedOf(user))) + 1); break;
      case 'punishment': bp = Math.min(200, 60 + 20 * Object.values(target.boosts).filter((v) => v > 0).reduce((a, b) => a + b, 0)); break;
      case 'payback': bp = target.moved ? 100 : 50; break;
      case 'avalanche': case 'revenge': bp = user.vol.hitThisTurn ? 120 : 60; break;
      case 'assurance': bp = target.vol.hitThisTurn ? 100 : 50; break;
      case 'brine': bp = target.hp * 2 <= target.maxhp ? 130 : 65; break;
      case 'wringout': case 'crushgrip': bp = Math.max(1, Math.floor(120 * (target.hp / target.maxhp))); break;
      case 'trumpcard': {
        const slot = user.mon.moves.find((m) => m.id === moveId);
        const pp = slot ? slot.pp : 4;
        bp = pp >= 4 ? 40 : pp === 3 ? 50 : pp === 2 ? 60 : pp === 1 ? 80 : 200;
        break;
      }
      case 'facade': bp = user.mon.status ? 140 : 70; break;
      case 'smellingsalts': bp = target.mon.status === 'par' ? 120 : 60; break;
      case 'wakeupslap': bp = target.mon.status === 'slp' ? 120 : 60; break;
      case 'rollout': case 'iceball': {
        const n = user.vol.rollout || 0;
        bp = 30 * Math.pow(2, n + (user.vol.defensecurl ? 1 : 0));
        user.vol.rollout = (n + 1) % 5;
        break;
      }
      case 'furycutter': {
        const n = user.lastMove === 'furycutter' ? (user.vol.fury || 0) + 1 : 0;
        user.vol.fury = Math.min(4, n);
        bp = 10 * Math.pow(2, user.vol.fury);
        break;
      }
      case 'hiddenpower': bp = 60; break;
      case 'weatherball': bp = this.field.weather ? 100 : 50; break;
      case 'pursuit': bp = 40; break;
      case 'spitup': bp = 100 * (user.vol.stockpile || 0); break;
      case 'solarbeam': if (this.field.weather && this.field.weather !== 'sun') bp = 60; break;
      case 'struggle': bp = 50; break;
      default: break;
    }
    if (!bp) bp = 60;
    return bp;
  }

  critStage(user, move) {
    let s = 0;
    if (move.critRatio) s += move.critRatio - 1;
    if (user.vol.focusenergy) s += 2;
    return Math.min(4, s);
  }

  // Calcula o dano de um único acerto.
  calcDamage(user, target, move, moveId, type, crit) {
    let bp = this.movePower(user, target, move, moveId);
    const physical = move.category === 'Physical';
    // modificadores de poder
    if (user.hp <= user.maxhp / 3) {
      const pinch = { Overgrow: 'Grass', Blaze: 'Fire', Torrent: 'Water', Swarm: 'Bug' }[user.ability];
      if (pinch === type) bp = Math.floor(bp * 1.5);
    }
    if (user.ability === 'Technician' && bp <= 60) bp = Math.floor(bp * 1.5);
    if (user.ability === 'Iron Fist' && move.flags && move.flags.punch) bp = Math.floor(bp * 1.2);
    if (user.vol.flashfire && type === 'Fire') bp = Math.floor(bp * 1.5);
    if (user.vol.charge && type === 'Electric') { bp *= 2; }
    if (target.ability === 'Thick Fat' && (type === 'Fire' || type === 'Ice')) bp = Math.floor(bp / 2);
    if (target.ability === 'Heatproof' && type === 'Fire') bp = Math.floor(bp / 2);

    let atkStat = physical ? 1 : 3, defStat = physical ? 2 : 4;
    let atkStage = user.boosts[physical ? 'atk' : 'spa'];
    let defStage = target.boosts[physical ? 'def' : 'spd'];
    if (crit) { atkStage = Math.max(0, atkStage); defStage = Math.min(0, defStage); }
    let A = user.stats[atkStat] * stageMult(atkStage);
    let D = target.stats[defStat] * stageMult(defStage);
    if (physical) {
      if (user.ability === 'Huge Power' || user.ability === 'Pure Power') A *= 2;
      if (user.ability === 'Hustle') A *= 1.5;
      if (user.ability === 'Guts' && user.mon.status) A *= 1.5;
      if (target.ability === 'Marvel Scale' && target.mon.status) D *= 1.5;
    }
    if (!physical && this.field.weather === 'sand' && target.hasType('Rock')) D *= 1.5;
    if (move.selfdestruct === 'always') D = Math.max(1, D / 2);
    A = Math.max(1, Math.floor(A));
    D = Math.max(1, Math.floor(D));

    let dmg = Math.floor(Math.floor(Math.floor((2 * user.level) / 5 + 2) * bp * A / D) / 50);
    if (physical && user.mon.status === 'brn' && user.ability !== 'Guts') dmg = Math.floor(dmg / 2);
    const tside = this.sides[target.side].cond;
    if (!crit && physical && tside.reflect) dmg = Math.floor(dmg / 2);
    if (!crit && !physical && tside.lightscreen) dmg = Math.floor(dmg / 2);
    if (this.field.weather === 'rain') { if (type === 'Water') dmg = Math.floor(dmg * 1.5); if (type === 'Fire') dmg = Math.floor(dmg / 2); }
    if (this.field.weather === 'sun') { if (type === 'Fire') dmg = Math.floor(dmg * 1.5); if (type === 'Water') dmg = Math.floor(dmg / 2); }
    dmg += 2;
    if (crit) dmg *= 2;
    dmg = Math.floor((dmg * (85 + Math.floor(this.rng() * 16))) / 100);
    if (type !== '???' && user.hasType(type)) dmg = Math.floor(dmg * (user.ability === 'Adaptability' ? 2 : 1.5));
    const eff = type === '???' ? 1 : typeEffect(type, target.types);
    dmg = Math.floor(dmg * eff);
    if (eff > 1 && (target.ability === 'Solid Rock' || target.ability === 'Filter')) dmg = Math.floor(dmg * 0.75);
    return Math.max(1, dmg);
  }

  immunityCheck(user, target, move, type, moveId) {
    // retorna true se o alvo é imune (e já emite a mensagem)
    if (type !== '???') {
      let eff = typeEffect(type, target.types);
      if (eff === 0 && target.vol.foresight && (type === 'Normal' || type === 'Fighting') && target.hasType('Ghost')) eff = 1;
      if (type === 'Ground' && target.vol.magnetrise) eff = 0;
      if (eff === 0) { this.msg(`Não afeta ${this.N(target)}...`); return true; }
    }
    const ab = target.ability;
    if (type === 'Ground' && ab === 'Levitate') { this.msg(`${cap(this.N(target))} está levitando e evitou o ataque!`); return true; }
    if (type === 'Fire' && ab === 'Flash Fire') { target.vol.flashfire = true; this.msg(`O poder de fogo ${this.D(target)} aumentou!`); return true; }
    if (type === 'Electric' && ab === 'Volt Absorb' || type === 'Water' && ab === 'Water Absorb') {
      this.heal(target, Math.floor(target.maxhp / 4), `${cap(this.N(target))} absorveu o ataque!`);
      return true;
    }
    if (type === 'Electric' && ab === 'Motor Drive') { this.boost(target, { spe: 1 }, target); return true; }
    if (ab === 'Soundproof' && move.flags && move.flags.sound) { this.msg(`${cap(this.N(target))} não ouviu nada!`); return true; }
    if (ab === 'Wonder Guard' && move.category !== 'Status' && type !== '???' && typeEffect(type, target.types) <= 1 && !move.damage) {
      this.msg(`Não afeta ${this.N(target)}...`); return true;
    }
    if (moveId === 'dreameater' && target.mon.status !== 'slp') { this.msg('Mas falhou!'); return true; }
    return false;
  }

  attackMove(user, target, move, moveId) {
    const type = this.moveType(user, move, moveId);
    if (this.immunityCheck(user, target, move, type, moveId)) { delete user.vol.lockedMove; return; }
    if ((moveId === 'suckerpunch') && (target.moved || this.actions[target.side]?.type !== 'move')) { this.msg('Mas falhou!'); return; }
    if (moveId === 'fakeout' && user.turnsOut > 0) { this.msg('Mas falhou!'); return; }
    if (moveId === 'snore' && user.mon.status !== 'slp') { this.msg('Mas falhou!'); return; }
    if ((moveId === 'counter' || moveId === 'mirrorcoat') ) {
      const want = moveId === 'counter' ? 'Physical' : 'Special';
      const last = user.vol.lastHit;
      if (!last || last.cat !== want || last.turn !== this.turn) { this.msg('Mas falhou!'); return; }
      this.damage(target, last.amount * 2, user, null, { eff: 1 });
      return;
    }
    if (moveId === 'brickbreak' || moveId === 'defog') {
      const c = this.sides[target.side].cond;
      if (c.reflect || c.lightscreen) { delete c.reflect; delete c.lightscreen; this.msg('A barreira foi quebrada!'); }
    }

    // dano fixo
    let fixed = null;
    if (move.damage === 'level') fixed = user.level;
    else if (typeof move.damage === 'number') fixed = move.damage;
    else if (moveId === 'superfang') fixed = Math.max(1, Math.floor(target.hp / 2));
    else if (moveId === 'psywave') fixed = Math.max(1, Math.floor((user.level * (50 + Math.floor(this.rng() * 101))) / 100));
    else if (moveId === 'endeavor') { if (target.hp <= user.hp) { this.msg('Mas falhou!'); return; } fixed = target.hp - user.hp; }
    else if (move.ohko) fixed = target.hp;

    let hits = 1;
    if (move.multihit) {
      if (Array.isArray(move.multihit)) {
        if (user.ability === 'Skill Link') hits = move.multihit[1];
        else { const r = this.rng(); hits = r < 0.375 ? 2 : r < 0.75 ? 3 : r < 0.875 ? 4 : 5; }
      } else hits = move.multihit;
    }
    let total = 0, didHits = 0, lastEff = 1, anyCrit = false;
    for (let h = 0; h < hits; h++) {
      if (target.fainted || user.fainted) break;
      let dmg, crit = false, eff = 1;
      if (fixed !== null) {
        dmg = fixed;
      } else {
        const noCrit = target.ability === 'Battle Armor' || target.ability === 'Shell Armor' || this.sides[target.side].cond.luckychant;
        crit = !noCrit && (move.willCrit || this.rng() < CRIT_CHANCE[this.critStage(user, move)]);
        dmg = this.calcDamage(user, target, move, moveId, type, crit);
        eff = type === '???' ? 1 : typeEffect(type, target.types);
      }
      if (moveId === 'falseswipe' && dmg >= target.hp) dmg = target.hp - 1;
      if (dmg <= 0) { this.msg('Mas falhou!'); return; }
      // substituto
      if (target.vol.substitute && !(move.flags && move.flags.sound) && target !== user) {
        const absorbed = Math.min(dmg, target.vol.substitute);
        target.vol.substitute -= absorbed;
        this.msg('O substituto recebeu o dano!');
        if (target.vol.substitute <= 0) { delete target.vol.substitute; this.msg(`O substituto ${this.D(target)} sumiu!`); this.emit({ type: 'substitute', side: target.side, on: false }); }
        total += absorbed;
        didHits++;
        lastEff = eff;
        continue;
      }
      // sobreviver (Aguentar / Robustez)
      if (dmg >= target.hp) {
        if (target.vol.endure) { dmg = target.hp - 1; this.pendingEndure = target; }
        else if (target.ability === 'Sturdy' && target.hp === target.maxhp && !move.ohko) { dmg = target.hp - 1; this.pendingSturdy = target; }
      }
      if (crit) anyCrit = true;
      this.damage(target, dmg, user, null, { eff, crit, cat: move.category, defer: true });
      if (crit) this.msg('Um golpe crítico!');
      total += dmg;
      didHits++;
      lastEff = eff;
      // habilidades de contato
      if (move.flags && move.flags.contact && !user.fainted) this.contactAbility(user, target);
    }
    if (hits > 1) this.msg(`Acertou ${didHits} vez${didHits > 1 ? 'es' : ''}!`);
    if (fixed === null && !move.ohko) {
      if (lastEff > 1) this.msg('É super efetivo!');
      else if (lastEff < 1 && lastEff > 0) this.msg('Não é muito efetivo...');
    }
    if (move.ohko && target.fainted) this.msg('Um nocaute de um golpe só!');
    if (this.pendingEndure) { this.msg(`${cap(this.N(this.pendingEndure))} aguentou o golpe!`); this.pendingEndure = null; }
    if (this.pendingSturdy) { this.msg(`${cap(this.N(this.pendingSturdy))} resistiu com Robustez!`); this.pendingSturdy = null; }
    this.flushFaints();
    if (user.vol.charge && type === 'Electric') delete user.vol.charge;

    // dreno e recuo
    if (move.drain && total > 0 && !user.fainted) {
      const amt = Math.max(1, Math.floor((total * move.drain[0]) / move.drain[1]));
      if (target.ability === 'Liquid Ooze') this.damage(user, amt, null, `${cap(this.N(user))} sugou o lodo líquido!`);
      else this.heal(user, amt, `A energia ${this.D(target)} foi drenada!`);
    }
    if (move.recoil && total > 0 && !user.fainted && user.ability !== 'Rock Head' && user.ability !== 'Magic Guard') {
      this.damage(user, Math.max(1, Math.floor((total * move.recoil[0]) / move.recoil[1])), null, `${cap(this.N(user))} foi atingido pelo recuo!`);
    }
    if (moveId === 'struggle' && !user.fainted) this.damage(user, Math.max(1, Math.floor(user.maxhp / 4)), null, `${cap(this.N(user))} foi atingido pelo recuo!`);
    if (moveId === 'payday') { this.moneyBonus += user.level * 5; this.msg('Moedas se espalharam pelo chão!'); }
    if (moveId === 'rapidspin' && !user.fainted) {
      delete user.vol.leechseed; delete user.vol.bound;
      const c = this.sides[user.side].cond; delete c.spikes; delete c.stealthrock; delete c.toxicspikes;
    }
    if (moveId === 'knockoff' && !target.fainted) this.msg(`${cap(this.N(user))} desarmou ${this.N(target)}!`);
    if (moveId === 'spitup' || moveId === 'swallow') { user.vol.stockpile = 0; }

    // efeitos secundários
    if (total > 0 && !target.fainted && !target.vol.substitute) {
      const secs = move.secondaries || (move.secondary ? [move.secondary] : []);
      for (const s of secs) {
        let chance = s.chance || 100;
        if (user.ability === 'Serene Grace') chance *= 2;
        if (target.ability === 'Shield Dust' && !s.self) continue;
        if (this.rng() * 100 >= chance) continue;
        if (s.status) this.setStatus(target, s.status, user, false);
        if (s.volatileStatus === 'flinch' && !target.moved && target.ability !== 'Inner Focus') target.vol.flinch = true;
        else if (s.volatileStatus === 'confusion') this.confuse(target, false);
        else if (s.volatileStatus === 'partiallytrapped') this.bind(target, user, moveId);
        if (s.boosts) this.boost(target, s.boosts, user, false);
        if (s.self && s.self.boosts) this.boost(user, s.self.boosts, user, false);
      }
      if (moveId === 'triattack' && this.rng() < 0.2) this.setStatus(target, ['brn', 'par', 'frz'][Math.floor(this.rng() * 3)], user, false);
      if (move.volatileStatus === 'partiallytrapped') this.bind(target, user, moveId);
      if (move.thawsTarget && target.mon.status === 'frz') { target.mon.status = null; this.emit({ type: 'status', side: target.side, status: null }); }
    }
    if (type === 'Fire' && target.mon.status === 'frz' && !target.fainted) {
      target.mon.status = null;
      this.emit({ type: 'status', side: target.side, status: null });
      this.msg(`${cap(this.N(target))} descongelou!`);
    }
    if (move.self && move.self.boosts && total > 0 && !user.fainted) this.boost(user, move.self.boosts, user, true);
    if (move.recharge && !target.fainted) user.vol.mustRecharge = true;
    if (move.recharge && target.fainted) user.vol.mustRecharge = true;
    if (move.selfdestruct === 'always' && !user.fainted) this.faintNow(user);
    if (move.selfSwitch && !user.fainted && this.sides[user.side].party.some((m, i) => isUsable(m) && i !== user.slot)) {
      user.vol.pendingSwitch = true;
    }
    if (move.forceSwitch && !target.fainted) this.forceOut(target);
    if (moveId === 'uproar') this.msg(`${cap(this.N(user))} está fazendo um alvoroço!`);
  }

  contactAbility(user, target) {
    if (target.fainted && !['Rough Skin'].includes(target.ability)) return;
    const r = this.rng();
    switch (target.ability) {
      case 'Static': if (r < 0.3) this.setStatus(user, 'par', target, false); break;
      case 'Flame Body': if (r < 0.3) this.setStatus(user, 'brn', target, false); break;
      case 'Poison Point': if (r < 0.3) this.setStatus(user, 'psn', target, false); break;
      case 'Effect Spore': if (r < 0.3) this.setStatus(user, ['psn', 'par', 'slp'][Math.floor(this.rng() * 3)], target, false); break;
      case 'Cute Charm': if (r < 0.3 && user.mon.gender !== 'N' && target.mon.gender !== 'N' && user.mon.gender !== target.mon.gender && !user.vol.attract) { user.vol.attract = true; this.msg(`${cap(this.N(user))} se apaixonou!`); } break;
      case 'Rough Skin': if (user.ability !== 'Magic Guard') this.damage(user, Math.max(1, Math.floor(user.maxhp / 8)), null, `${cap(this.N(user))} foi ferido pela Pele Áspera!`); break;
      default: break;
    }
  }

  bind(target, user, moveId) {
    if (target.vol.bound || target.fainted) return;
    target.vol.bound = { turns: 4 + Math.floor(this.rng() * 2), name: MOVES[moveId].name };
    this.msg(`${cap(this.N(target))} ficou preso por ${MOVES[moveId].name}!`);
  }

  forceOut(target) {
    if (this.kind === 'wild') {
      this.msg(`${cap(this.N(target))} fugiu assustado!`);
      this.end(target.side === 0 ? 1 : 0, target.side === 1 ? 'run' : 'run');
      return;
    }
    const side = this.sides[target.side];
    const opts = side.party.map((m, i) => i).filter((i) => isUsable(side.party[i]) && i !== target.slot);
    if (!opts.length) { this.msg('Mas falhou!'); return; }
    const idx = opts[Math.floor(this.rng() * opts.length)];
    const nb = this.sendOut(target.side, idx, true);
    this.msg(`${cap(this.N(nb))} foi arrastado para a batalha!`);
    this.onSwitchIn(nb);
  }

  statusMove(user, target, move, moveId) {
    const foe = this.foe(user);
    // golpes com comportamento próprio
    const custom = this.customStatus(user, foe, move, moveId);
    if (custom !== undefined) return;

    let did = false;
    if (move.target !== 'self' && target && target !== user) {
      if (target.vol.substitute && !(move.flags && move.flags.sound) && (move.status || move.boosts || move.volatileStatus === 'confusion')) {
        this.msg('Mas falhou!');
        return;
      }
      if (moveId === 'thunderwave' && target.hasType('Ground')) { this.msg(`Não afeta ${this.N(target)}...`); return; }
      if (target.ability === 'Soundproof' && move.flags && move.flags.sound) { this.msg(`${cap(this.N(target))} não ouviu nada!`); return; }
    }
    if (move.status) {
      const t = move.target === 'self' ? user : target;
      did = this.setStatus(t, move.status, user, true) || did;
      if (!did) return;
    }
    if (move.boosts) {
      const t = SELF_TARGETS.has(move.target) ? user : target;
      did = this.boost(t, move.boosts, user, true) || did;
    }
    if (move.volatileStatus) did = this.applyVolatile(SELF_TARGETS.has(move.target) ? user : target, move.volatileStatus, user, moveId) || did;
    if (move.self && move.self.volatileStatus && move.self.volatileStatus !== 'lockedmove' && move.self.volatileStatus !== 'mustrecharge') {
      did = this.applyVolatile(user, move.self.volatileStatus, user, moveId) || did;
    }
    if (move.heal || ['moonlight', 'synthesis', 'morningsun'].includes(moveId)) {
      let frac = move.heal ? move.heal[0] / move.heal[1] : 0.5;
      if (['moonlight', 'synthesis', 'morningsun'].includes(moveId)) {
        frac = this.field.weather === 'sun' ? 2 / 3 : this.field.weather ? 1 / 4 : 1 / 2;
      }
      if (user.hp >= user.maxhp) { this.msg(`Os PS ${this.D(user)} já estão cheios!`); return; }
      this.heal(user, Math.max(1, Math.floor(user.maxhp * frac)), `${cap(this.N(user))} recuperou PS!`);
      did = true;
    }
    if (move.weather) {
      const w = { RainDance: 'rain', raindance: 'rain', sunnyday: 'sun', SunnyDay: 'sun', Sandstorm: 'sand', sandstorm: 'sand', hail: 'hail', Hail: 'hail' }[move.weather];
      if (w && this.field.weather !== w) { this.setWeather(w, 5, user); did = true; }
    }
    if (move.sideCondition) {
      did = this.applySideCondition(user, move.sideCondition, move.target) || did;
    }
    if (move.pseudoWeather === 'trickroom') {
      this.field.trickroom = this.field.trickroom ? 0 : 5;
      this.msg(this.field.trickroom ? `${cap(this.N(user))} distorceu as dimensões!` : 'As dimensões voltaram ao normal!');
      did = true;
    }
    if (move.forceSwitch) { this.forceOut(target); did = true; }
    if (!did) this.msg('Mas falhou!');
  }

  applySideCondition(user, cond, targetKind) {
    const id = cond.toLowerCase();
    const sideIdx = targetKind === 'foeSide' ? 1 - user.side : user.side;
    const c = this.sides[sideIdx].cond;
    const side = sideIdx === 0 && this.kind !== 'pvp' ? 'sua equipe' : `a equipe ${this.kind === 'wild' ? 'adversária' : 'de ' + this.sides[sideIdx].name}`;
    switch (id) {
      case 'reflect': if (c.reflect) return false; c.reflect = 5; this.msg(`O Refletir aumentou a defesa de ${side}!`); return true;
      case 'lightscreen': if (c.lightscreen) return false; c.lightscreen = 5; this.msg(`A Tela de Luz aumentou a defesa especial de ${side}!`); return true;
      case 'safeguard': if (c.safeguard) return false; c.safeguard = 5; this.msg(`${cap(side)} está coberta por um véu místico!`); return true;
      case 'mist': if (c.mist) return false; c.mist = 5; this.msg(`${cap(side)} está coberta pela névoa!`); return true;
      case 'tailwind': if (c.tailwind) return false; c.tailwind = 4; this.msg(`Um vento a favor sopra para ${side}!`); return true;
      case 'spikes': if ((c.spikes || 0) >= 3) return false; c.spikes = (c.spikes || 0) + 1; this.msg(`Espinhos se espalharam ao redor de ${side}!`); return true;
      case 'toxicspikes': if ((c.toxicspikes || 0) >= 2) return false; c.toxicspikes = (c.toxicspikes || 0) + 1; this.msg(`Espinhos venenosos se espalharam ao redor de ${side}!`); return true;
      case 'stealthrock': if (c.stealthrock) return false; c.stealthrock = 1; this.msg(`Pedras pontiagudas flutuam ao redor de ${side}!`); return true;
      default: return false;
    }
  }

  customStatus(user, foe, move, moveId) {
    switch (moveId) {
      case 'splash': this.msg('Mas nada aconteceu!'); return true;
      case 'teleport':
        if (this.kind === 'wild') { this.msg(`${cap(this.N(user))} se teletransportou para longe!`); this.end(null, 'run'); }
        else this.msg('Mas falhou!');
        return true;
      case 'rest':
        if (user.hp >= user.maxhp || user.ability === 'Insomnia' || user.ability === 'Vital Spirit') { this.msg('Mas falhou!'); return true; }
        user.mon.status = 'slp'; user.mon.sleepTurns = 3;
        this.emit({ type: 'status', side: user.side, status: 'slp' });
        this.heal(user, user.maxhp, `${cap(this.N(user))} dormiu e recuperou a saúde!`);
        return true;
      case 'haze':
        for (const s of this.sides) if (s.active) s.active.boosts = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 };
        this.msg('Todas as mudanças de atributos foram eliminadas!');
        return true;
      case 'bellydrum':
        if (user.hp <= user.maxhp / 2 || user.boosts.atk >= 6) { this.msg('Mas falhou!'); return true; }
        this.damage(user, Math.floor(user.maxhp / 2), null, null);
        user.boosts.atk = 6;
        this.msg(`${cap(this.N(user))} cortou os próprios PS e maximizou o Ataque!`);
        this.emit({ type: 'boost', side: user.side, stat: 'atk', amount: 6 });
        return true;
      case 'painsplit': {
        const avg = Math.floor((user.hp + foe.hp) / 2);
        this.setHp(user, Math.min(user.maxhp, avg));
        this.setHp(foe, Math.min(foe.maxhp, avg));
        this.msg('Os combatentes dividiram a dor!');
        return true;
      }
      case 'transform': {
        if (foe.vol.substitute || user.vol.transformed) { this.msg('Mas falhou!'); return true; }
        user.vol.transformed = true;
        user.typesOverride = foe.types.slice();
        user.boosts = { ...foe.boosts };
        user.abilityOverride = foe.ability;
        user.vol.transformStats = foe.stats.slice();
        user.vol.origMoves = user.mon.moves;
        user.mon.moves = foe.mon.moves.map((m) => ({ id: m.id, pp: 5, ppMax: 5 }));
        this.msg(`${cap(this.N(user))} se transformou em ${monName(foe.mon)}!`);
        this.emit({ type: 'transform', side: user.side, species: foe.mon.species });
        return true;
      }
      case 'conversion': {
        const t = MOVES[user.mon.moves[0].id].type;
        user.typesOverride = [t];
        this.msg(`${cap(this.N(user))} mudou para o tipo ${TYPE_PT[t]}!`);
        return true;
      }
      case 'spite': {
        const lm = foe.lastMove && foe.mon.moves.find((m) => m.id === foe.lastMove);
        if (!lm || lm.pp <= 0) { this.msg('Mas falhou!'); return true; }
        lm.pp = Math.max(0, lm.pp - 4);
        this.msg(`Os PP de ${MOVES[lm.id].name} ${this.D(foe)} foram reduzidos!`);
        return true;
      }
      case 'perishsong':
        for (const s of this.sides) if (s.active && !s.active.vol.perish && s.active.ability !== 'Soundproof') s.active.vol.perish = 4;
        this.msg('Todos os Pokémon que ouviram a canção vão desmaiar em três turnos!');
        return true;
      case 'psychup':
        user.boosts = { ...foe.boosts };
        this.msg(`${cap(this.N(user))} copiou as mudanças de atributos ${this.D(foe)}!`);
        return true;
      case 'heartswap': case 'powerswap': case 'guardswap': {
        const keys = moveId === 'heartswap' ? Object.keys(user.boosts) : moveId === 'powerswap' ? ['atk', 'spa'] : ['def', 'spd'];
        for (const k of keys) { const t = user.boosts[k]; user.boosts[k] = foe.boosts[k]; foe.boosts[k] = t; }
        this.msg(`${cap(this.N(user))} trocou mudanças de atributos com o alvo!`);
        return true;
      }
      case 'acupressure': {
        const keys = Object.keys(user.boosts).filter((k) => user.boosts[k] < 6);
        if (!keys.length) { this.msg('Mas falhou!'); return true; }
        this.boost(user, { [keys[Math.floor(this.rng() * keys.length)]]: 2 }, user, true);
        return true;
      }
      case 'curse':
        if (user.hasType('Ghost')) {
          if (foe.vol.curse) { this.msg('Mas falhou!'); return true; }
          this.damage(user, Math.floor(user.maxhp / 2), null, null);
          foe.vol.curse = true;
          this.msg(`${cap(this.N(user))} cortou os próprios PS e amaldiçoou ${this.N(foe)}!`);
        } else this.boost(user, { spe: -1, atk: 1, def: 1 }, user, true);
        return true;
      case 'stockpile':
        if ((user.vol.stockpile || 0) >= 3) { this.msg('Mas falhou!'); return true; }
        user.vol.stockpile = (user.vol.stockpile || 0) + 1;
        this.msg(`${cap(this.N(user))} acumulou ${user.vol.stockpile}!`);
        this.boost(user, { def: 1, spd: 1 }, user, true);
        return true;
      case 'swallow': {
        const n = user.vol.stockpile || 0;
        if (!n) { this.msg('Mas falhou!'); return true; }
        this.heal(user, Math.floor(user.maxhp * [0, 0.25, 0.5, 1][n]), `${cap(this.N(user))} recuperou PS!`);
        user.vol.stockpile = 0;
        return true;
      }
      case 'refresh':
        if (!user.mon.status || !['brn', 'par', 'psn', 'tox'].includes(user.mon.status)) { this.msg('Mas falhou!'); return true; }
        user.mon.status = null;
        this.emit({ type: 'status', side: user.side, status: null });
        this.msg(`${cap(this.N(user))} voltou ao normal!`);
        return true;
      case 'healbell': case 'aromatherapy':
        for (const m of this.sides[user.side].party) { m.status = null; delete m.sleepTurns; }
        this.emit({ type: 'status', side: user.side, status: null });
        this.msg('Os problemas de estado da equipe foram curados!');
        return true;
      case 'wish':
        user.vol.wish = { turns: 2, amount: Math.floor(user.maxhp / 2) };
        this.msg(`${cap(this.N(user))} fez um pedido!`);
        return true;
      case 'memento':
        this.boost(foe, { atk: -2, spa: -2 }, user, true);
        this.faintNow(user);
        return true;
      case 'lockon': case 'mindreader':
        user.vol.lockon = true;
        this.msg(`${cap(this.N(user))} mirou em ${this.N(foe)}!`);
        return true;
      case 'foresight': case 'odorsleuth': case 'miracleeye':
        foe.vol.foresight = true;
        this.msg(`${cap(this.N(user))} identificou ${this.N(foe)}!`);
        return true;
      case 'meanlook': case 'block': case 'spiderweb':
        foe.vol.cantEscape = true;
        this.msg(`${cap(this.N(foe))} não pode mais fugir!`);
        return true;
      case 'roleplay':
        user.abilityOverride = foe.ability;
        this.msg(`${cap(this.N(user))} copiou a habilidade ${this.D(foe)}!`);
        return true;
      case 'skillswap': {
        const a = user.ability; user.abilityOverride = foe.ability; foe.abilityOverride = a;
        this.msg(`${cap(this.N(user))} trocou de habilidade com o alvo!`);
        return true;
      }
      case 'worryseed':
        foe.abilityOverride = 'Insomnia';
        this.msg(`${cap(this.N(foe))} ficou com Insônia!`);
        return true;
      case 'gastroacid':
        foe.abilityOverride = 'None';
        this.msg(`A habilidade ${this.D(foe)} foi suprimida!`);
        return true;
      case 'futuresight': case 'doomdesire':
        this.futureAttacks.push({ side: 1 - user.side, turns: 2, user, move: moveId });
        this.msg(`${cap(this.N(user))} previu um ataque!`);
        return true;
      case 'defog':
        this.boost(foe, { evasion: -1 }, user, true);
        { const c = this.sides[foe.side].cond; delete c.reflect; delete c.lightscreen; delete c.spikes; delete c.safeguard; delete c.mist; delete c.stealthrock; delete c.toxicspikes; }
        return true;
      case 'swagger': case 'flatter':
        this.boost(foe, moveId === 'swagger' ? { atk: 2 } : { spa: 1 }, user, true);
        this.confuse(foe, true);
        return true;
      case 'charge':
        user.vol.charge = true;
        this.msg(`${cap(this.N(user))} começou a carregar energia!`);
        this.boost(user, { spd: 1 }, user, true);
        return true;
      case 'batonpass':
        if (!this.sides[user.side].party.some((m, i) => isUsable(m) && i !== user.slot)) { this.msg('Mas falhou!'); return true; }
        user.vol.batonpass = true;
        user.vol.pendingSwitch = true;
        return true;
      case 'disable': {
        if (!foe.lastMove || foe.vol.disable) { this.msg('Mas falhou!'); return true; }
        foe.vol.disable = { move: foe.lastMove, turns: 4 };
        this.msg(`${MOVES[foe.lastMove].name} ${this.D(foe)} foi desabilitado!`);
        return true;
      }
      case 'encore': {
        if (!foe.lastMove || foe.vol.encore || ['encore', 'struggle', 'mirrormove', 'transform'].includes(foe.lastMove)) { this.msg('Mas falhou!'); return true; }
        foe.vol.encore = { move: foe.lastMove, turns: 3 };
        this.msg(`${cap(this.N(foe))} ganhou um bis!`);
        return true;
      }
      case 'torment':
        foe.vol.torment = true;
        this.msg(`${cap(this.N(foe))} está sendo atormentado!`);
        return true;
      case 'nightmare':
        if (foe.mon.status !== 'slp' || foe.vol.nightmare) { this.msg('Mas falhou!'); return true; }
        foe.vol.nightmare = true;
        this.msg(`${cap(this.N(foe))} começou a ter um pesadelo!`);
        return true;
      case 'yawn':
        if (foe.mon.status || foe.vol.yawn) { this.msg('Mas falhou!'); return true; }
        foe.vol.yawn = 2;
        this.msg(`${cap(this.N(user))} deixou ${this.N(foe)} sonolento!`);
        return true;
      case 'attract':
        if (foe.mon.gender === 'N' || user.mon.gender === 'N' || foe.mon.gender === user.mon.gender || foe.vol.attract || foe.ability === 'Oblivious') { this.msg('Mas falhou!'); return true; }
        foe.vol.attract = true;
        this.msg(`${cap(this.N(foe))} se apaixonou!`);
        return true;
      case 'substitute': {
        if (user.vol.substitute) { this.msg(`${cap(this.N(user))} já tem um substituto!`); return true; }
        const cost = Math.floor(user.maxhp / 4);
        if (user.hp <= cost) { this.msg('Não tem PS suficientes para criar um substituto!'); return true; }
        this.damage(user, cost, null, null);
        user.vol.substitute = cost + 1;
        this.msg(`${cap(this.N(user))} criou um substituto!`);
        this.emit({ type: 'substitute', side: user.side, on: true });
        return true;
      }
      case 'destinybond':
        user.vol.destinybond = true;
        this.msg(`${cap(this.N(user))} está tentando levar o oponente junto!`);
        return true;
      case 'bide': case 'mimic':
        this.msg('Mas falhou!');
        return true;
      case 'roost':
        if (user.hp >= user.maxhp) { this.msg(`Os PS ${this.D(user)} já estão cheios!`); return true; }
        this.heal(user, Math.floor(user.maxhp / 2), `${cap(this.N(user))} recuperou PS!`);
        user.vol.roost = true;
        return true;
      default:
        return undefined;
    }
  }

  applyVolatile(target, vs, user, moveId) {
    switch (vs) {
      case 'confusion': return this.confuse(target, true);
      case 'leechseed':
        if (target.hasType('Grass') || target.vol.leechseed) { this.msg(`Não afeta ${this.N(target)}...`); return true; }
        target.vol.leechseed = true;
        this.msg(`${cap(this.N(target))} foi semeado!`);
        return true;
      case 'focusenergy':
        if (target.vol.focusenergy) return false;
        target.vol.focusenergy = true;
        this.msg(`${cap(this.N(target))} está se concentrando!`);
        return true;
      case 'protect': case 'endure': {
        const n = user.vol.protectCount || 0;
        const okChance = 1 / Math.pow(2, n);
        if (this.rng() >= okChance) { user.vol.protectCount = 0; this.msg('Mas falhou!'); return true; }
        user.vol.protectCount = n + 1;
        user.vol.protectUsed = true;
        if (vs === 'protect') { user.vol.protect = true; this.msg(`${cap(this.N(user))} se protegeu!`); }
        else { user.vol.endure = true; this.msg(`${cap(this.N(user))} se preparou para aguentar!`); }
        return true;
      }
      case 'ingrain':
        if (target.vol.ingrain) return false;
        target.vol.ingrain = true; target.vol.cantEscape = true;
        this.msg(`${cap(this.N(target))} criou raízes!`);
        return true;
      case 'aquaring':
        if (target.vol.aquaring) return false;
        target.vol.aquaring = true;
        this.msg(`${cap(this.N(target))} se cercou de um véu de água!`);
        return true;
      case 'magnetrise':
        if (target.vol.magnetrise) return false;
        target.vol.magnetrise = 5;
        this.msg(`${cap(this.N(target))} levitou com eletromagnetismo!`);
        return true;
      case 'taunt':
        if (target.vol.taunt) return false;
        target.vol.taunt = 3;
        this.msg(`${cap(this.N(target))} caiu na Provocação!`);
        return true;
      case 'minimize': case 'defensecurl':
        target.vol[vs] = true;
        return false; // os boosts do golpe já contam como efeito
      case 'rage': case 'stockpile': case 'roost':
        return false;
      default:
        return false;
    }
  }

  confuse(target, fromStatusMove) {
    if (target.fainted) return false;
    if (target.vol.confusion) { if (fromStatusMove) this.msg(`${cap(this.N(target))} já está confuso!`); return fromStatusMove; }
    if (target.ability === 'Own Tempo') { if (fromStatusMove) this.msg(`${cap(this.N(target))} não fica confuso!`); return fromStatusMove; }
    if (this.sides[target.side].cond.safeguard) { if (fromStatusMove) this.msg(`${cap(this.N(target))} está protegido pelo véu místico!`); return fromStatusMove; }
    target.vol.confusion = 2 + Math.floor(this.rng() * 4);
    this.msg(`${cap(this.N(target))} ficou confuso!`);
    this.emit({ type: 'statusanim', side: target.side, status: 'confusion' });
    return true;
  }

  // ------------------------------------------------------------ status / boosts / dano
  setStatus(target, status, source, fromStatusMove) {
    if (!target || target.fainted) return false;
    const fail = (txt) => { if (fromStatusMove) this.msg(txt || 'Mas falhou!'); return fromStatusMove ? false : false; };
    if (target.mon.status) {
      if (fromStatusMove) this.msg(target.mon.status === status ? `${cap(this.N(target))} já está ${STATUS_WORD[status]}!` : 'Mas falhou!');
      return false;
    }
    if (source && source !== target && this.sides[target.side].cond.safeguard) return fail(`${cap(this.N(target))} está protegido pelo véu místico!`);
    if (STATUS_IMMUNE_TYPE[status] && target.hasType(STATUS_IMMUNE_TYPE[status])) return fail(`Não afeta ${this.N(target)}...`);
    if ((status === 'psn' || status === 'tox') && (target.hasType('Poison') || target.hasType('Steel'))) return fail(`Não afeta ${this.N(target)}...`);
    const ab = target.ability;
    if (status === 'slp' && (ab === 'Insomnia' || ab === 'Vital Spirit')) return fail(`${cap(this.N(target))} não consegue dormir!`);
    if (status === 'par' && ab === 'Limber') return fail(`${cap(this.N(target))} não pode ser paralisado!`);
    if ((status === 'psn' || status === 'tox') && ab === 'Immunity') return fail(`${cap(this.N(target))} é imune a veneno!`);
    if (status === 'brn' && ab === 'Water Veil') return fail(`${cap(this.N(target))} não pode ser queimado!`);
    if (status === 'frz' && (ab === 'Magma Armor' || this.field.weather === 'sun')) return fail();
    if (target.vol.substitute && source && source !== target && fromStatusMove) return fail();
    target.mon.status = status;
    if (status === 'slp') target.mon.sleepTurns = 1 + Math.floor(this.rng() * 3);
    if (status === 'tox') target.mon.toxCount = 0;
    this.emit({ type: 'status', side: target.side, status });
    this.emit({ type: 'statusanim', side: target.side, status });
    this.msg({
      brn: `${cap(this.N(target))} foi queimado!`, par: `${cap(this.N(target))} foi paralisado! Pode não conseguir se mover!`,
      psn: `${cap(this.N(target))} foi envenenado!`, tox: `${cap(this.N(target))} foi gravemente envenenado!`,
      slp: `${cap(this.N(target))} adormeceu!`, frz: `${cap(this.N(target))} foi congelado!`,
    }[status]);
    if (ab === 'Synchronize' && source && source !== target && ['brn', 'par', 'psn', 'tox'].includes(status)) {
      this.setStatus(source, status === 'tox' ? 'psn' : status, null, false);
    }
    return true;
  }

  boost(target, boosts, source, fromStatusMove) {
    if (!target || target.fainted) return false;
    let any = false;
    for (const [stat, amtRaw] of Object.entries(boosts)) {
      let amt = amtRaw;
      if (amt < 0 && source !== target) {
        if (this.sides[target.side].cond.mist) { this.msg(`${cap(this.N(target))} está protegido pela névoa!`); continue; }
        if (target.ability === 'Clear Body' || target.ability === 'White Smoke') { if (fromStatusMove) this.msg(`A habilidade ${this.D(target)} impede a redução de atributos!`); continue; }
        if (target.ability === 'Hyper Cutter' && stat === 'atk') { if (fromStatusMove) this.msg(`O Ataque ${this.D(target)} não foi reduzido!`); continue; }
        if (target.ability === 'Keen Eye' && stat === 'accuracy') { if (fromStatusMove) this.msg(`A Precisão ${this.D(target)} não foi reduzida!`); continue; }
        if (target.vol.substitute) continue;
      }
      if (target.ability === 'Simple') amt *= 2;
      const cur = target.boosts[stat];
      const next = Math.max(-6, Math.min(6, cur + amt));
      const nome = BOOST_PT[stat];
      const art = BOOST_ART[stat] || 'O';
      if (next === cur) {
        if (fromStatusMove || source === target) this.msg(`${art} ${nome} ${this.D(target)} não pode ${amt > 0 ? 'aumentar' : 'diminuir'} mais!`);
        continue;
      }
      target.boosts[stat] = next;
      const d = next - cur;
      const verb = d > 0
        ? (d >= 3 ? 'aumentou drasticamente' : d === 2 ? 'aumentou muito' : 'aumentou')
        : (d <= -3 ? 'diminuiu drasticamente' : d === -2 ? 'diminuiu muito' : 'diminuiu');
      this.msg(`${art} ${nome} ${this.D(target)} ${verb}!`);
      this.emit({ type: 'boost', side: target.side, stat, amount: d });
      any = true;
    }
    return any;
  }

  setHp(b, hp) {
    const before = b.mon.hp;
    b.mon.hp = Math.max(0, Math.min(b.maxhp, hp));
    if (b.mon.hp < before) this.emit({ type: 'damage', side: b.side, hp: b.mon.hp, maxhp: b.maxhp, amount: before - b.mon.hp });
    else this.emit({ type: 'heal', side: b.side, hp: b.mon.hp, maxhp: b.maxhp });
    if (b.mon.hp <= 0) this.faintNow(b);
  }

  damage(b, amount, source, text, info = {}) {
    if (!b || b.fainted) return 0;
    const amt = Math.min(b.mon.hp, Math.max(1, Math.floor(amount)));
    b.mon.hp -= amt;
    b.vol.hitThisTurn = (b.vol.hitThisTurn || 0) + 1;
    if (source && source !== b && info.cat) b.vol.lastHit = { amount: amt, cat: info.cat, turn: this.turn };
    this.emit({ type: 'damage', side: b.side, hp: b.mon.hp, maxhp: b.maxhp, amount: amt, eff: info.eff, crit: info.crit, direct: !!source });
    if (text) this.msg(text);
    if (b.mon.hp <= 0) {
      // o desmaio pode ser adiado para depois das mensagens de crítico/efetividade
      if (info.defer) this.pendingFaints.push({ b, source });
      else this.faintWithBond(b, source);
    }
    return amt;
  }

  faintWithBond(b, source) {
    this.faintNow(b);
    if (source && source !== b && b.vol.destinybond && !source.fainted) {
      this.msg(`${cap(this.N(b))} levou ${this.N(source)} junto!`);
      this.faintNow(source);
    }
  }

  flushFaints() {
    const list = this.pendingFaints;
    this.pendingFaints = [];
    for (const { b, source } of list) this.faintWithBond(b, source);
  }

  heal(b, amount, text) {
    if (!b || b.fainted) return 0;
    const before = b.mon.hp;
    b.mon.hp = Math.min(b.maxhp, b.mon.hp + Math.max(1, Math.floor(amount)));
    if (b.mon.hp !== before) this.emit({ type: 'heal', side: b.side, hp: b.mon.hp, maxhp: b.maxhp });
    if (text && b.mon.hp !== before) this.msg(text);
    return b.mon.hp - before;
  }

  faintNow(b) {
    if (b.faintHandled) return;
    b.mon.hp = 0;
    b.faintHandled = true;
    b.mon.status = null;
    this.restoreTransform(b);
    this.emit({ type: 'faint', side: b.side, uid: b.mon.uid });
    this.msg(`${cap(this.N(b))} desmaiou!`);
    delete b.vol.charging; delete b.vol.semi; delete b.vol.lockedMove; delete b.vol.mustRecharge;
    if (b.side === 1 && this.hooks.onOpponentFaint) {
      const extra = this.hooks.onOpponentFaint(this, b.mon, this.participants.get(b.mon.uid) || new Set());
      if (extra) for (const e of extra) this.emit(e);
    }
  }

  setWeather(w, turns, src) {
    this.field.weather = w;
    this.field.weatherTurns = turns;
    this.emit({ type: 'weather', weather: w });
    this.msg({ rain: 'Começou a chover!', sun: 'A luz do sol ficou forte!', sand: 'Uma tempestade de areia começou!', hail: 'Começou a cair granizo!' }[w]);
  }

  // ------------------------------------------------------------ fim do turno
  endOfTurn() {
    const f = this.field;
    if (f.weather) {
      f.weatherTurns--;
      if (f.weatherTurns <= 0) {
        this.msg({ rain: 'A chuva parou.', sun: 'A luz do sol enfraqueceu.', sand: 'A tempestade de areia passou.', hail: 'O granizo parou.' }[f.weather]);
        f.weather = null;
        this.emit({ type: 'weather', weather: null });
      } else {
        this.msg({ rain: 'A chuva continua a cair.', sun: 'A luz do sol está forte.', sand: 'A tempestade de areia continua.', hail: 'O granizo continua a cair.' }[f.weather]);
        for (const b of this.speedOrder()) {
          if (b.ability === 'Magic Guard') continue;
          if (f.weather === 'sand' && !b.hasType('Rock') && !b.hasType('Ground') && !b.hasType('Steel') && b.ability !== 'Sand Veil' && !b.vol.semi) {
            this.damage(b, Math.max(1, Math.floor(b.maxhp / 16)), null, `${cap(this.N(b))} foi atingido pela tempestade de areia!`);
          }
          if (f.weather === 'hail' && !b.hasType('Ice') && b.ability !== 'Ice Body' && b.ability !== 'Snow Cloak' && !b.vol.semi) {
            this.damage(b, Math.max(1, Math.floor(b.maxhp / 16)), null, `${cap(this.N(b))} foi atingido pelo granizo!`);
          }
          if (f.weather === 'rain' && b.ability === 'Rain Dish') this.heal(b, b.maxhp / 16, `${cap(this.N(b))} recuperou PS com a chuva!`);
          if (f.weather === 'hail' && b.ability === 'Ice Body') this.heal(b, b.maxhp / 16, `${cap(this.N(b))} recuperou PS com o granizo!`);
        }
      }
    }
    // ataques futuros
    for (const fa of this.futureAttacks.slice()) {
      fa.turns--;
      if (fa.turns <= 0) {
        this.futureAttacks.splice(this.futureAttacks.indexOf(fa), 1);
        const t = this.sides[fa.side].active;
        if (t && !t.fainted) {
          this.msg(`${cap(this.N(t))} recebeu o ataque previsto!`);
          const mv = MOVES[fa.move];
          const dmg = fa.user && !fa.user.fainted ? this.calcDamage(fa.user, t, mv, fa.move, mv.type, false) : Math.floor(t.maxhp / 4);
          this.damage(t, dmg, null, null);
        }
      }
    }
    for (const b of this.speedOrder()) {
      if (b.fainted) continue;
      const mg = b.ability === 'Magic Guard';
      if (b.vol.wish) {
        b.vol.wish.turns--;
        if (b.vol.wish.turns <= 0) { this.heal(b, b.vol.wish.amount, 'O desejo se realizou!'); delete b.vol.wish; }
      }
      if (b.vol.ingrain) this.heal(b, b.maxhp / 16, `${cap(this.N(b))} absorveu nutrientes pelas raízes!`);
      if (b.vol.aquaring) this.heal(b, b.maxhp / 16, `O véu de água restaurou os PS ${this.D(b)}!`);
      if (b.vol.leechseed && !mg) {
        const other = this.foe(b);
        const amt = this.damage(b, Math.max(1, Math.floor(b.maxhp / 8)), null, `A Semente Sanguessuga drenou ${this.N(b)}!`);
        if (other && !other.fainted) this.heal(other, amt, null);
        if (b.fainted) continue;
      }
      if (!mg) {
        if (b.mon.status === 'brn') this.damage(b, Math.max(1, Math.floor(b.maxhp / 8)), null, `${cap(this.N(b))} foi ferido pela queimadura!`);
        else if (b.mon.status === 'psn') {
          if (b.ability === 'Poison Heal') this.heal(b, b.maxhp / 8, null);
          else this.damage(b, Math.max(1, Math.floor(b.maxhp / 8)), null, `${cap(this.N(b))} foi ferido pelo veneno!`);
        } else if (b.mon.status === 'tox') {
          b.mon.toxCount = (b.mon.toxCount || 0) + 1;
          this.damage(b, Math.max(1, Math.floor((b.maxhp * b.mon.toxCount) / 16)), null, `${cap(this.N(b))} foi ferido pelo veneno!`);
        }
        if (b.fainted) continue;
        if (b.vol.nightmare && b.mon.status === 'slp') this.damage(b, Math.max(1, Math.floor(b.maxhp / 4)), null, `${cap(this.N(b))} está preso num pesadelo!`);
        if (b.vol.curse) this.damage(b, Math.max(1, Math.floor(b.maxhp / 4)), null, `${cap(this.N(b))} foi ferido pela maldição!`);
        if (b.fainted) continue;
        if (b.vol.bound) {
          b.vol.bound.turns--;
          if (b.vol.bound.turns <= 0) { this.msg(`${cap(this.N(b))} se libertou de ${b.vol.bound.name}!`); delete b.vol.bound; }
          else this.damage(b, Math.max(1, Math.floor(b.maxhp / 16)), null, `${cap(this.N(b))} foi ferido por ${b.vol.bound.name}!`);
        }
      }
      if (b.fainted) continue;
      if (b.vol.yawn) {
        b.vol.yawn--;
        if (b.vol.yawn <= 0) { delete b.vol.yawn; this.setStatus(b, 'slp', null, false); }
      }
      if (b.vol.perish) {
        b.vol.perish--;
        this.msg(`A contagem de ${this.N(b)} caiu para ${b.vol.perish}!`);
        if (b.vol.perish <= 0) this.faintNow(b);
      }
      if (b.fainted) continue;
      if (b.ability === 'Speed Boost' && b.turnsOut > 0) this.boost(b, { spe: 1 }, b, false);
      if (b.ability === 'Shed Skin' && b.mon.status && this.rng() < 0.3) {
        b.mon.status = null; this.emit({ type: 'status', side: b.side, status: null });
        this.msg(`${cap(this.N(b))} trocou de pele e se curou!`);
      }
      for (const k of ['taunt', 'magnetrise']) if (b.vol[k]) { b.vol[k]--; if (b.vol[k] <= 0) delete b.vol[k]; }
      for (const k of ['encore', 'disable']) if (b.vol[k]) { b.vol[k].turns--; if (b.vol[k].turns <= 0) delete b.vol[k]; }
      b.turnsOut++;
      delete b.vol.protect; delete b.vol.endure; delete b.vol.flinch; delete b.vol.roost;
      if (!b.vol.protectUsed) b.vol.protectCount = 0;
      delete b.vol.protectUsed;
      if (b.lastMove !== 'rollout' && b.lastMove !== 'iceball') b.vol.rollout = 0;
      delete b.vol.destinybond;
    }
    for (const s of this.sides) {
      for (const k of ['reflect', 'lightscreen', 'safeguard', 'mist', 'tailwind']) {
        if (s.cond[k]) {
          s.cond[k]--;
          if (s.cond[k] <= 0) {
            delete s.cond[k];
            const nm = { reflect: 'O Refletir', lightscreen: 'A Tela de Luz', safeguard: 'O véu místico', mist: 'A névoa', tailwind: 'O vento a favor' }[k];
            this.msg(`${nm} ${s.index === 0 && this.kind !== 'pvp' ? 'da sua equipe' : 'da equipe adversária'} acabou.`);
          }
        }
      }
    }
    if (this.field.trickroom) { this.field.trickroom--; if (!this.field.trickroom) this.msg('As dimensões voltaram ao normal!'); }
  }

  // Verifica desmaios e fim da batalha. Retorna true se algo desmaiou.
  checkFaints() {
    let any = false;
    // os dois lados sem Pokémon: empate no PvP, derrota do jogador nas outras batalhas
    if (!this.over && !this.sides[0].party.some(isUsable) && !this.sides[1].party.some(isUsable)) {
      if (this.kind === 'pvp') { this.msg('A batalha terminou empatada!'); this.end(null, 'draw'); }
      else { this.msg('Você não tem mais Pokémon em condições de lutar!'); this.end(1, 'lose'); }
      return true;
    }
    for (let i = 0; i < 2; i++) {
      const side = this.sides[i];
      const b = side.active;
      if (b && b.fainted) any = true;
      if (!side.party.some(isUsable)) {
        if (this.over) continue;
        if (i === 1) {
          if (this.kind === 'trainer') this.msg(`Você derrotou ${side.trainerClass ? side.trainerClass + ' ' : ''}${side.name}!`);
          if (this.kind === 'pvp') this.msg(`${this.sides[0].name} venceu a batalha!`);
          this.end(0, 'win');
        } else {
          if (this.kind === 'pvp') this.msg(`${this.sides[1].name} venceu a batalha!`);
          else this.msg('Você não tem mais Pokémon em condições de lutar!');
          this.end(1, 'lose');
        }
      }
    }
    return any;
  }

  end(winnerSide, result) {
    if (this.over) return;
    for (const s of this.sides) if (s.active) this.restoreTransform(s.active);
    this.over = true;
    this.winner = winnerSide;
    this.result = result;
    this.emit({ type: 'end', winner: winnerSide, result });
  }
}

const STATUS_WORD = { brn: 'queimado', par: 'paralisado', psn: 'envenenado', tox: 'envenenado', slp: 'dormindo', frz: 'congelado' };
