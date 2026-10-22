// Estado do jogador (save) e operações comuns.
import { DEFAULT_LOOK, STARTER_CLOTHES } from '../shared/data/clothes.js';
import { ITEMS } from '../shared/data/items.js';
import { POKEDEX } from '../shared/data/pokedex.js';
import { isUsable, healMon } from '../shared/pokemon.js';
import { net } from './net.js';

export const state = {
  save: null,
  name: '', // nome do treinador neste mundo
  account: '', // nome da conta (login)
  accountKey: '',
  worldId: null,
  world: null, // resumo do mundo atual (nome, dono, convite...)
  myId: 0,
  houses: {},
  dirty: false,
  lastSaveAt: 0,
};

export function newSave(name, look) {
  return {
    version: 1,
    name,
    look: look || { ...DEFAULT_LOOK },
    pos: null,
    money: 3000,
    party: [],
    pc: [],
    bag: {},
    keyItems: [],
    expShareOn: true,
    // o que foi escolhido na criação também fica no guarda-roupa
    wardrobe: [...new Set([...STARTER_CLOTHES, ...['hat', 'top', 'bottom', 'shoes', 'acc', 'back'].map((k) => (look || DEFAULT_LOOK)[k]).filter(Boolean)])],
    furnitureInv: { cama_azul: 1, mesa: 1, cadeira_marrom: 2, vaso: 1, tapete_vermelho: 1 },
    floorsOwned: ['madeira'],
    wallsOwned: ['creme'],
    dex: { seen: [], caught: [] },
    badges: [],
    league: { champion: false, beatenAt: 0 },
    flags: { starter: false, items: {}, legends: {} },
    trainers: {},
    lastCenter: null,
    daycare: null,
    stats: { steps: 0, battles: 0, caught: 0, trades: 0, pvpWins: 0, playMs: 0, created: Date.now() },
    options: { textSpeed: 2, music: 0.35, sfx: 0.6, zoom: 1, autoRun: false },
    houses: [],
  };
}

// Campos adicionados depois da primeira versão (saves novos e antigos passam por aqui).
export function ensureSaveFields(s) {
  s.tid ||= String(10000 + Math.floor(Math.random() * 90000));
  s.berries ||= {}; // árvore -> quando foi colhida
  s.honey ||= {}; // árvore -> quando o mel foi passado
  s.dig ||= {}; // ponto de escavação -> dia da última escavação
  s.eggs ||= []; // ovos sendo chocados
  s.jobs ||= { active: [], done: [], earned: 0, count: 0 };
  s.jobs.active ||= [];
  s.jobs.done ||= [];
  s.bp ||= 0;
  s.tower ||= { streak: 0, best: 0 };
  s.keyItems ||= [];
  if (!s.keyItems.includes('poketch')) s.keyItems.push('poketch');
  s.flags ||= { starter: false, items: {}, legends: {} };
  s.flags.npc ||= {}; // eventos únicos de NPCs (presentes, trocas...)
  // creche antiga (1 Pokémon) -> nova (até 2, com ovos)
  if (s.daycare && s.daycare.mon) s.daycare = { mons: [{ mon: s.daycare.mon, steps0: 0 }], steps: s.daycare.steps || 0, at: s.daycare.at || Date.now() };
  return s;
}

export function S() { return state.save; }

export function markDirty() { state.dirty = true; }

export function saveNow() {
  if (!state.save) return;
  state.lastSaveAt = Date.now();
  state.dirty = false;
  net.send({ t: 'save', save: state.save });
}

// ------------------------------------------------------------ dinheiro e itens
export function addMoney(n) {
  const s = S();
  s.money = Math.max(0, Math.min(9999999, (s.money | 0) + Math.round(n)));
  markDirty();
}

export function addItem(id, n = 1) {
  const s = S();
  if (ITEMS[id] && ITEMS[id].pocket === 'key') {
    if (!s.keyItems.includes(id)) s.keyItems.push(id);
  } else {
    s.bag[id] = (s.bag[id] || 0) + n;
    if (s.bag[id] <= 0) delete s.bag[id];
  }
  markDirty();
}

export function hasItem(id, n = 1) {
  const s = S();
  if (ITEMS[id] && ITEMS[id].pocket === 'key') return s.keyItems.includes(id);
  return (s.bag[id] || 0) >= n;
}

export function useItem(id, n = 1) {
  const s = S();
  if (!s.bag[id] || s.bag[id] < n) return false;
  s.bag[id] -= n;
  if (s.bag[id] <= 0) delete s.bag[id];
  markDirty();
  return true;
}

// ------------------------------------------------------------ pokédex
export function markSeen(id) {
  const d = S().dex;
  if (!d.seen.includes(id)) { d.seen.push(id); markDirty(); }
}

export function markCaught(id) {
  markSeen(id);
  const d = S().dex;
  if (!d.caught.includes(id)) { d.caught.push(id); markDirty(); return true; }
  return false;
}

export function caughtSet() {
  return new Set(S().dex.caught);
}

// ------------------------------------------------------------ equipe
export function addPokemon(mon) {
  const s = S();
  mon.ot = mon.ot || state.name;
  mon.otId = mon.otId || state.name;
  markCaught(mon.species);
  if (s.party.length < 6) { s.party.push(mon); markDirty(); return 'party'; }
  s.pc.push(mon);
  markDirty();
  return 'pc';
}

export function leadMon() {
  return S().party.find(isUsable) || null;
}

export function healParty() {
  for (const m of S().party) healMon(m);
  markDirty();
}

export function partyAlive() {
  return S().party.some(isUsable);
}

export function speciesName(id) {
  return POKEDEX[id] ? POKEDEX[id].name : '???';
}
