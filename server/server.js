// Servidor do Pokémon Freedom: arquivos estáticos + WebSocket (multiplayer).
//
// Uma conta pode ter vários mundos (saves). Cada mundo tem seu próprio treinador
// por conta, suas casas e seus convidados. Presença, chat, trocas e batalhas
// acontecem só entre jogadores que estão no mesmo mundo.
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer } from 'ws';
import { Storage } from './storage.js';
import { getWorld } from '../public/js/shared/world/world.js';
import { BUILDINGS } from '../public/js/shared/world/defs.js';
import { housePrice } from '../public/js/shared/data/furniture.js';
import { makeInterior, canPlaceFurniture } from '../public/js/shared/world/interiors.js';
import { FURNITURE, FLOORS, WALLS } from '../public/js/shared/data/furniture.js';
import { POKEDEX } from '../public/js/shared/data/pokedex.js';
import { MOVES } from '../public/js/shared/data/moves.js';
import { Battle } from '../public/js/shared/battle/engine.js';
import { healMon, cloneMon } from '../public/js/shared/pokemon.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = +process.env.PORT || 3000;
// log com horário (ajuda a entender o que aconteceu com os dados)
function log(...a) { console.log(`[${new Date().toLocaleString('pt-BR')}]`, ...a); }

const storage = new Storage(process.env.DATA_DIR || path.join(here, 'data'));

console.log('[mapa] gerando...');
const map = getWorld();
const PLOTS = {};
for (const b of map.buildings) if (b.plotId) PLOTS[b.plotId] = b;
console.log(`[mapa] pronto em ${map.genMs}ms — ${Object.keys(PLOTS).length} casas à venda por mundo`);

// endereços na rede local (para montar links de convite)
function lanUrls() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254')) out.push(`http://${a.address}:${PORT}`);
  }
  return out;
}

const app = express();
app.use(express.static(path.join(here, '..', 'public'), { maxAge: '1h' }));
app.get('/status', (req, res) => res.json({ online: [...clients.values()].filter((c) => c.user).length }));
const server = http.createServer(app);
const wss = new WebSocketServer({ server, maxPayload: 2 * 1024 * 1024 });

const clients = new Map(); // id -> conexão
let nextId = 1;
const trades = new Map(); // id do jogador -> sessão de troca
const pvps = new Map(); // id do jogador -> sessão de batalha

const send = (c, msg) => { if (c.ws.readyState === 1) c.ws.send(JSON.stringify(msg)); };
const key = (c) => Storage.key(c.user.name);
const inWorld = (wid) => [...clients.values()].filter((o) => o.user && o.worldId === wid);
const sendWorld = (wid, msg, except = null) => {
  const s = JSON.stringify(msg);
  for (const o of inWorld(wid)) if (o !== except && o.ws.readyState === 1) o.ws.send(s);
};
const worldOf = (c) => (c.worldId ? storage.db.worlds[c.worldId] : null);
const trainerName = (c) => (c.save && c.save.name) || (c.user ? c.user.name : '?');
const publicPlayer = (c) => ({ id: c.id, name: trainerName(c), look: c.look, map: c.pos.map, x: c.pos.x, y: c.pos.y, dir: c.pos.dir, mode: c.pos.mode, follower: c.follower });
const NAME_RE = /^[A-Za-z0-9_À-ÿ]{3,14}$/;

// ------------------------------------------------------------ contas e mundos
function worldSummary(w, userKey) {
  const save = w.players[userKey];
  const owner = storage.db.users[w.owner];
  return {
    id: w.id, name: w.name, ownerName: owner ? owner.name : '?', isOwner: w.owner === userKey,
    members: w.members.map((k) => storage.db.users[k]?.name || k), online: inWorld(w.id).filter((o) => o.joined).length,
    invite: w.owner === userKey ? w.invite : null, created: w.created, cheats: !!w.cheats,
    trainer: save ? {
      name: save.name, look: save.look, badges: (save.badges || []).length, caught: (save.dex?.caught || []).length,
      playMs: save.stats?.playMs || 0, money: save.money || 0,
    } : null,
  };
}

function worldList(user) {
  const k = Storage.key(user.name);
  user.worlds = user.worlds.filter((id) => storage.db.worlds[id]);
  return user.worlds.map((id) => worldSummary(storage.db.worlds[id], k));
}

function sendWorlds(c, extra = {}) {
  send(c, { t: 'worlds', list: worldList(c.user), lan: lanUrls(), ...extra });
}

function loginAccount(c, user) {
  // derruba sessão antiga da mesma conta
  for (const other of clients.values()) {
    if (other !== c && other.user && Storage.key(other.user.name) === Storage.key(user.name)) {
      send(other, { t: 'kicked', text: 'Sua conta entrou em outro lugar.' });
      other.ws.close();
    }
  }
  c.user = user;
  send(c, { t: 'auth', ok: true, id: c.id, account: user.name, token: user.token, list: worldList(user), lan: lanUrls(), now: Date.now() });
  log(`[conta] ${user.name} conectou (${clients.size} conexões)`);
}

function leaveRoom(c, reason) {
  const wid = c.worldId;
  if (!wid) return;
  const t = trades.get(c.id);
  if (t) endTrade(t, 'O outro jogador saiu.');
  if (pvps.has(c.id)) pvpForfeit(c);
  c.worldId = null;
  if (c.joined) {
    sendWorld(wid, { t: 'pleave', id: c.id });
    sendWorld(wid, { t: 'chat', sys: true, text: `${trainerName(c)} saiu do mundo.` });
  }
  c.joined = false;
  c.save = null;
  if (reason) send(c, { t: 'worldClosed', text: reason });
}

function onJoinedWorld(c) {
  if (c.joined) return;
  c.joined = true;
  sendWorld(c.worldId, { t: 'pjoin', p: publicPlayer(c) }, c);
  sendWorld(c.worldId, { t: 'chat', sys: true, text: `${trainerName(c)} entrou no mundo.` }, c);
}

function persistSave(c, save) {
  const w = worldOf(c);
  if (!w || !save || typeof save !== 'object') return;
  const k = key(c);
  const old = w.players[k];
  // dinheiro é controlado pelo servidor logo após compras de casas
  if (old && typeof old.money === 'number' && c.moneyLock && Date.now() < c.moneyLock) save.money = old.money;
  save.houses = Object.entries(w.houses).filter(([, h]) => h.owner === k).map(([id]) => id);
  w.players[k] = save;
  c.save = save;
  storage.markDirty();
}

// ------------------------------------------------------------ trocas
function endTrade(t, reason) {
  for (const id of [t.a, t.b]) {
    trades.delete(id);
    const c = clients.get(id);
    if (c && reason) send(c, { t: 'tradeCancel', reason });
  }
}

function validMon(m) {
  return m && typeof m === 'object' && !m.egg && POKEDEX[m.species] && m.level >= 1 && m.level <= 100 && Array.isArray(m.moves) &&
    m.moves.length >= 1 && m.moves.length <= 4 && m.moves.every((x) => MOVES[x.id]) && Array.isArray(m.ivs);
}

const sameWorld = (a, b) => a.worldId && a.worldId === b.worldId;

// ------------------------------------------------------------ PvP
function startPvp(ca, cb, teamA, teamB) {
  const prep = (team) => team.filter(validMon).slice(0, 6).map((m) => { const x = cloneMon(m); healMon(x); return x; });
  const pa = prep(teamA), pb = prep(teamB);
  if (!pa.length || !pb.length) { send(ca, { t: 'error', text: 'Equipe inválida para batalha.' }); send(cb, { t: 'error', text: 'Equipe inválida para batalha.' }); return; }
  const battle = new Battle({ kind: 'pvp', sides: [{ name: trainerName(ca), party: pa }, { name: trainerName(cb), party: pb }], env: { terrain: 'grass' } });
  const session = { battle, players: [ca.id, cb.id], last: Date.now() };
  pvps.set(ca.id, session);
  pvps.set(cb.id, session);
  const events = battle.start();
  [ca, cb].forEach((c, side) => send(c, {
    t: 'pvpStart', side, opponent: trainerName(side === 0 ? cb : ca), opponentLook: (side === 0 ? cb : ca).look, myParty: side === 0 ? pa : pb,
    foeParty: (side === 0 ? pb : pa).map((m) => ({ species: m.species, level: m.level, shiny: m.shiny, gender: m.gender, nick: m.nick, uid: m.uid })),
    events, needs: battle.needs[side],
  }));
}

function pvpBroadcast(session, events) {
  session.players.forEach((id, side) => {
    const c = clients.get(id);
    if (c) send(c, { t: 'pvpEvents', events, needs: session.battle.needs[side], over: session.battle.over, result: session.battle.result, winner: session.battle.winner, side });
  });
  if (session.battle.over) for (const id of session.players) pvps.delete(id);
}

function pvpAction(c, action) {
  const s = pvps.get(c.id);
  if (!s) return;
  const side = s.players.indexOf(c.id);
  if (!s.battle.needs[side]) return;
  // só aceita ações válidas (uma ação inválida não pode derrubar a batalha)
  const sideObj = s.battle.sides[side];
  let act = null;
  if (action.type === 'move' && s.battle.needs[side] === 'action') {
    const i = Number.isInteger(action.move) ? action.move : -1;
    act = { type: 'move', move: i >= -1 && i < 4 ? i : -1 };
  } else if (action.type === 'switch') {
    const i = action.index;
    const mon = Number.isInteger(i) ? sideObj.party[i] : null;
    if (mon && mon.hp > 0 && (!sideObj.active || i !== sideObj.active.slot || sideObj.active.fainted)) act = { type: 'switch', index: i };
  } else if (action.type === 'forfeit' || action.type === 'run') {
    return pvpForfeit(c);
  }
  if (!act) return;
  s.battle.choose(side, act);
  s.last = Date.now();
  if (s.battle.ready()) pvpBroadcast(s, s.battle.step());
  else {
    const other = clients.get(s.players[1 - side]);
    if (other) send(other, { t: 'pvpWaiting', text: `${trainerName(c)} já escolheu.` });
  }
}

function pvpForfeit(c) {
  const s = pvps.get(c.id);
  if (!s || s.battle.over) return;
  const side = s.players.indexOf(c.id);
  s.battle.events = [];
  s.battle.forfeit(side);
  pvpBroadcast(s, s.battle.flush());
}

setInterval(() => {
  const seen = new Set();
  for (const s of pvps.values()) {
    if (seen.has(s)) continue;
    seen.add(s);
    if (Date.now() - s.last > 180000 && !s.battle.over) {
      // quem não escolheu perde por tempo
      const side = s.battle.needs.findIndex((n, i) => n && !s.battle.actions[i]);
      s.battle.events = [];
      s.battle.msg('Tempo esgotado!');
      s.battle.forfeit(side >= 0 ? side : 0);
      pvpBroadcast(s, s.battle.flush());
    }
  }
}, 10000);

// ------------------------------------------------------------ mensagens
const PRE_AUTH = new Set(['register', 'login', 'resume', 'ping']);
// mensagens que exigem estar dentro de um mundo com treinador criado
const IN_WORLD = new Set(['pos', 'look', 'follower', 'emote', 'chat', 'buyHouse', 'sellHouse', 'houseSave', 'tradeReq', 'tradeResp', 'tradeOffer', 'tradeConfirm', 'tradeCancel', 'battleReq', 'battleResp', 'pvpAction', 'pvpForfeit']);

const handlers = {
  // ---------------- conta
  register(c, m) {
    const name = String(m.name || '').trim();
    const pass = String(m.pass || '');
    if (!NAME_RE.test(name)) return send(c, { t: 'auth', ok: false, error: 'Nome inválido (3 a 14 letras, números ou _).' });
    if (pass.length < 4) return send(c, { t: 'auth', ok: false, error: 'A senha precisa ter pelo menos 4 caracteres.' });
    const u = storage.createUser(name, pass);
    if (!u) return send(c, { t: 'auth', ok: false, error: 'Esse nome já está em uso.' });
    loginAccount(c, u);
  },
  login(c, m) {
    const u = storage.getUser(String(m.name || '').trim());
    if (!u || !storage.checkPassword(u, String(m.pass || ''))) return send(c, { t: 'auth', ok: false, error: 'Nome ou senha incorretos.' });
    storage.newToken(u);
    loginAccount(c, u);
  },
  resume(c, m) {
    const u = storage.userByToken(String(m.token || ''));
    if (!u) return send(c, { t: 'auth', ok: false, error: '', expired: true });
    loginAccount(c, u);
  },

  // ---------------- mundos
  worlds(c) { sendWorlds(c); },
  createWorld(c, m) {
    const name = String(m.name || '').trim().slice(0, 24);
    if (!name) return send(c, { t: 'error', text: 'Dê um nome ao mundo.' });
    const w = storage.createWorld(c.user, name, !!m.cheats);
    if (!w) return send(c, { t: 'error', text: 'Você chegou ao limite de mundos. Exclua algum para criar outro.' });
    log(`[mundo] ${c.user.name} criou "${w.name}"${w.cheats ? ' (com cheats)' : ''}`);
    sendWorlds(c, { created: w.id });
  },
  // cheats ligados/desligados pelo dono (como abrir para LAN com cheats no Minecraft)
  setCheats(c, m) {
    const w = storage.db.worlds[m.id];
    if (!w || w.owner !== key(c)) return;
    w.cheats = !!m.on;
    storage.markDirty();
    for (const o of inWorld(w.id)) send(o, { t: 'worldInfo', world: worldSummary(w, key(o)) });
    sendWorlds(c);
  },
  renameWorld(c, m) {
    const w = storage.db.worlds[m.id];
    if (!w || w.owner !== key(c)) return;
    const name = String(m.name || '').trim().slice(0, 24);
    if (name) { w.name = name; storage.markDirty(); }
    sendWorlds(c);
  },
  trash(c) { send(c, { t: 'trash', list: storage.trashOf(key(c)) }); },
  restoreWorld(c, m) {
    const w = storage.restoreWorld(m.id, key(c));
    if (!w) return send(c, { t: 'error', text: 'Não deu para restaurar esse mundo.' });
    log(`[mundo] ${c.user.name} restaurou "${w.name}" da lixeira`);
    sendWorlds(c, { joined: w.id, joinedName: w.name });
    send(c, { t: 'trash', list: storage.trashOf(key(c)) });
  },
  deleteWorld(c, m) {
    const w = storage.db.worlds[m.id];
    if (!w || w.owner !== key(c)) return;
    for (const o of inWorld(w.id)) leaveRoom(o, 'Este mundo foi excluído pelo dono.');
    storage.deleteWorld(w.id);
    log(`[mundo] ${c.user.name} excluiu "${w.name}" (fica 7 dias na lixeira)`);
    sendWorlds(c);
  },
  leaveMembership(c, m) {
    const w = storage.db.worlds[m.id];
    if (!w || w.owner === key(c)) return;
    if (c.worldId === w.id) leaveRoom(c);
    storage.removeMember(w, key(c));
    sendWorlds(c);
  },
  invite(c, m) {
    const w = storage.db.worlds[m.id];
    if (!w || w.owner !== key(c)) return;
    if (m.action === 'new' || (m.action === 'get' && !w.invite)) storage.newInvite(w);
    if (m.action === 'off') { w.invite = null; storage.markDirty(); }
    send(c, { t: 'invite', id: w.id, code: w.invite, lan: lanUrls() });
  },
  joinInvite(c, m) {
    const w = storage.worldByInvite(m.code);
    if (!w) return send(c, { t: 'error', text: 'Código de convite inválido ou desativado.' });
    storage.addMember(w, c.user);
    sendWorlds(c, { joined: w.id, joinedName: w.name });
  },
  kickMember(c, m) {
    const w = storage.db.worlds[m.id];
    if (!w || w.owner !== key(c)) return;
    const k = Storage.key(m.member || '');
    if (k === w.owner) return;
    for (const o of inWorld(w.id)) if (key(o) === k) leaveRoom(o, 'Você foi removido deste mundo pelo dono.');
    storage.removeMember(w, k);
    sendWorlds(c);
  },
  enterWorld(c, m) {
    const w = storage.db.worlds[m.id];
    if (!w || !w.members.includes(key(c))) return send(c, { t: 'error', text: 'Você não tem acesso a este mundo.' });
    if (c.worldId) leaveRoom(c);
    c.worldId = w.id;
    c.save = w.players[key(c)] || null;
    c.look = c.save?.look || null;
    c.pos = c.save?.pos || { map: 'world', x: 0, y: 0, dir: 0, mode: 'walk' };
    c.follower = null;
    c.joined = false;
    send(c, {
      t: 'world', world: worldSummary(w, key(c)), accountKey: key(c), save: c.save, houses: w.houses, now: Date.now(),
      players: inWorld(w.id).filter((o) => o !== c && o.joined).map(publicPlayer),
    });
    log(`[mundo] ${c.user.name} entrou em "${w.name}"`);
  },
  exitWorld(c) { leaveRoom(c); sendWorlds(c); },

  // ---------------- jogo
  save(c, m) { persistSave(c, m.save); },
  pos(c, m) {
    c.pos = { map: String(m.map).slice(0, 64), x: m.x | 0, y: m.y | 0, dir: m.dir | 0, mode: m.mode || 'walk' };
    onJoinedWorld(c);
    sendWorld(c.worldId, { t: 'p', id: c.id, ...c.pos }, c);
  },
  look(c, m) {
    if (!m.look) return;
    c.look = m.look;
    sendWorld(c.worldId, { t: 'plook', id: c.id, look: c.look }, c);
  },
  follower(c, m) {
    c.follower = m.follower && POKEDEX[m.follower.species] ? { species: m.follower.species, shiny: !!m.follower.shiny } : null;
    sendWorld(c.worldId, { t: 'pfollow', id: c.id, follower: c.follower }, c);
  },
  emote(c, m) { sendWorld(c.worldId, { t: 'pemote', id: c.id, e: String(m.e).slice(0, 8) }, c); },
  chat(c, m) {
    const text = String(m.text || '').trim().slice(0, 160);
    if (!text) return;
    const now = Date.now();
    if (c.lastChat && now - c.lastChat < 500) return;
    c.lastChat = now;
    sendWorld(c.worldId, { t: 'chat', from: trainerName(c), id: c.id, text }, c);
  },
  buyHouse(c, m) {
    const w = worldOf(c);
    const b = PLOTS[m.plotId];
    if (!b) return send(c, { t: 'error', text: 'Casa inexistente.' });
    if (w.houses[m.plotId]) return send(c, { t: 'error', text: 'Esta casa já tem dono!' });
    const price = housePrice(b.city, BUILDINGS[b.type].plot);
    const save = c.save;
    if (!save || (save.money | 0) < price) return send(c, { t: 'error', text: 'Dinheiro insuficiente.' });
    save.money -= price;
    c.moneyLock = Date.now() + 3000;
    const h = { owner: key(c), ownerName: trainerName(c), floor: 'madeira', wall: 'creme', furniture: [], locked: false, roof: '#c9573d', bought: Date.now() };
    w.houses[m.plotId] = h;
    save.houses = [...(save.houses || []), m.plotId];
    storage.markDirty();
    send(c, { t: 'money', money: save.money });
    sendWorld(w.id, { t: 'house', plotId: m.plotId, data: h }, c);
    send(c, { t: 'house', plotId: m.plotId, data: h, mine: true, bought: true });
    sendWorld(w.id, { t: 'chat', sys: true, text: `${trainerName(c)} comprou uma casa em ${map.cities.find((x) => x.id === b.city)?.name || b.city}!` });
  },
  sellHouse(c, m) {
    const w = worldOf(c);
    const h = w.houses[m.plotId];
    const b = PLOTS[m.plotId];
    if (!h || !b || h.owner !== key(c)) return send(c, { t: 'error', text: 'Esta casa não é sua.' });
    const refund = Math.floor(housePrice(b.city, BUILDINGS[b.type].plot) / 2);
    delete w.houses[m.plotId];
    const save = c.save;
    save.money = (save.money | 0) + refund;
    save.houses = (save.houses || []).filter((x) => x !== m.plotId);
    // móveis voltam para o inventário
    save.furnitureInv ||= {};
    for (const f of h.furniture) save.furnitureInv[f.id] = (save.furnitureInv[f.id] || 0) + 1;
    c.moneyLock = Date.now() + 3000;
    storage.markDirty();
    send(c, { t: 'money', money: save.money, furnitureInv: save.furnitureInv });
    sendWorld(w.id, { t: 'house', plotId: m.plotId, data: null });
  },
  houseSave(c, m) {
    const w = worldOf(c);
    const h = w.houses[m.plotId];
    const b = PLOTS[m.plotId];
    if (!h || !b || h.owner !== key(c)) return;
    const interior = makeInterior(b, { floor: 'madeira', wall: 'creme', furniture: [] });
    const list = [];
    const rejected = [];
    for (const f of (Array.isArray(m.furniture) ? m.furniture : []).slice(0, 400)) {
      if (!FURNITURE[f.id]) continue;
      const item = { id: f.id, x: f.x | 0, y: f.y | 0 };
      if (canPlaceFurniture(interior, item.id, item.x, item.y, -1, list)) list.push(item);
      else rejected.push(item.id);
    }
    h.furniture = list;
    if (rejected.length) send(c, { t: 'houseRejected', plotId: m.plotId, items: rejected });
    if (FLOORS[m.floor]) h.floor = m.floor;
    if (WALLS[m.wall]) h.wall = m.wall;
    if (typeof m.locked === 'boolean') h.locked = m.locked;
    if (typeof m.roof === 'string' && /^#[0-9a-f]{6}$/i.test(m.roof)) h.roof = m.roof;
    h.ownerName = trainerName(c);
    storage.markDirty();
    sendWorld(w.id, { t: 'house', plotId: m.plotId, data: h });
  },
  // ---------------- trocas
  tradeReq(c, m) {
    const o = clients.get(m.to);
    if (!o || !o.user || o === c || !sameWorld(c, o)) return;
    if (trades.has(c.id) || trades.has(o.id) || pvps.has(o.id)) return send(c, { t: 'error', text: `${trainerName(o)} está ocupado agora.` });
    send(o, { t: 'tradeReq', from: c.id, name: trainerName(c) });
    send(c, { t: 'info', text: `Pedido de troca enviado para ${trainerName(o)}.` });
  },
  tradeResp(c, m) {
    const o = clients.get(m.from);
    if (!o || !o.user || !sameWorld(c, o)) return;
    if (!m.accept) return send(o, { t: 'info', text: `${trainerName(c)} recusou a troca.` });
    if (trades.has(c.id) || trades.has(o.id) || pvps.has(c.id) || pvps.has(o.id)) return send(o, { t: 'info', text: `${trainerName(c)} está ocupado agora.` });
    const t = { a: o.id, b: c.id, offer: {}, confirm: {} };
    trades.set(o.id, t);
    trades.set(c.id, t);
    send(o, { t: 'tradeStart', partner: c.id, name: trainerName(c) });
    send(c, { t: 'tradeStart', partner: o.id, name: trainerName(o) });
  },
  tradeOffer(c, m) {
    const t = trades.get(c.id);
    if (!t || !validMon(m.mon)) return;
    t.offer[c.id] = m.mon;
    t.confirm = {};
    const other = clients.get(c.id === t.a ? t.b : t.a);
    send(c, { t: 'tradeOffer', who: 'me', mon: m.mon });
    if (other) send(other, { t: 'tradeOffer', who: 'them', mon: m.mon });
  },
  tradeConfirm(c) {
    const t = trades.get(c.id);
    if (!t || !t.offer[t.a] || !t.offer[t.b]) return;
    t.confirm[c.id] = true;
    const ca = clients.get(t.a), cb = clients.get(t.b);
    for (const x of [ca, cb]) if (x) send(x, { t: 'tradeState', confirmMe: !!t.confirm[x.id], confirmThem: !!t.confirm[x.id === t.a ? t.b : t.a] });
    if (t.confirm[t.a] && t.confirm[t.b]) {
      if (ca) send(ca, { t: 'tradeDone', give: t.offer[t.a].uid, receive: t.offer[t.b], partner: cb ? trainerName(cb) : '' });
      if (cb) send(cb, { t: 'tradeDone', give: t.offer[t.b].uid, receive: t.offer[t.a], partner: ca ? trainerName(ca) : '' });
      endTrade(t, null);
    }
  },
  tradeCancel(c) {
    const t = trades.get(c.id);
    if (t) endTrade(t, `${trainerName(c)} cancelou a troca.`);
  },
  // ---------------- batalhas PvP
  battleReq(c, m) {
    const o = clients.get(m.to);
    if (!o || !o.user || o === c || !sameWorld(c, o)) return;
    if (pvps.has(c.id) || pvps.has(o.id) || trades.has(o.id)) return send(c, { t: 'error', text: `${trainerName(o)} está ocupado agora.` });
    c.pendingTeam = Array.isArray(m.team) ? m.team : [];
    c.pendingTo = o.id;
    send(o, { t: 'battleReq', from: c.id, name: trainerName(c) });
    send(c, { t: 'info', text: `Desafio enviado para ${trainerName(o)}.` });
  },
  battleResp(c, m) {
    const o = clients.get(m.from);
    if (!o || !o.user || o.pendingTo !== c.id || !sameWorld(c, o)) return;
    o.pendingTo = null;
    if (!m.accept) return send(o, { t: 'info', text: `${trainerName(c)} recusou o desafio.` });
    if (pvps.has(c.id) || pvps.has(o.id) || trades.has(c.id) || trades.has(o.id)) return send(o, { t: 'info', text: `${trainerName(c)} está ocupado agora.` });
    startPvp(o, c, o.pendingTeam || [], Array.isArray(m.team) ? m.team : []);
  },
  pvpAction(c, m) { if (m.action && typeof m.action === 'object') pvpAction(c, m.action); },
  pvpForfeit(c) { pvpForfeit(c); },
  ping(c) { send(c, { t: 'pong', now: Date.now() }); },
};

wss.on('connection', (ws) => {
  const c = { id: nextId++, ws, user: null, worldId: null, save: null, pos: null, look: null };
  clients.set(c.id, c);
  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    const h = handlers[m && m.t];
    if (!h) return;
    if (!c.user && !PRE_AUTH.has(m.t)) return;
    if (IN_WORLD.has(m.t) && (!worldOf(c) || (m.t !== 'save' && !c.save && m.t !== 'pos' && m.t !== 'look'))) return;
    try { h(c, m); } catch (e) { console.error('[erro]', m.t, e); }
  });
  ws.on('close', () => {
    leaveRoom(c);
    clients.delete(c.id);
    if (c.user) log(`[conta] ${c.user.name} desconectou`);
  });
});

server.listen(PORT, () => {
  console.log(`\n  Pokémon Freedom rodando!  Abra: http://localhost:${PORT}`);
  for (const u of lanUrls()) console.log(`  Na rede local: ${u}`);
  console.log('');
});

const shutdown = () => { console.log('\nSalvando dados...'); storage.close(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
