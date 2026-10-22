// Inicialização: carregamento, login, criação de personagem e início do jogo.
import { getWorld } from '../shared/world/world.js';
import { buildEncounterTables } from '../shared/world/encounters.js';
import { registerTMs } from '../shared/data/items.js';
import { MOVES } from '../shared/data/moves.js';
import { net } from './net.js';
import { audio } from './audio.js';
import { input } from './input.js';
import { state, newSave, S, saveNow, ensureSaveFields, markDirty } from './state.js';
import { ui, esc } from './ui/ui.js';
import { Renderer } from './render/renderer.js';
import { Game } from './game/game.js';
import { createHandlers } from './game/interact.js';
import { setMenuGame } from './ui/menus.js';
import { initSocial, addChatLine } from './ui/social.js';
import { createLook } from './ui/creator.js';
import { starterFlow } from './ui/starter.js';
import { DEFAULT_LOOK } from '../shared/data/clothes.js';
import { showWorlds, hideWorlds } from './ui/worlds.js';

registerTMs(MOVES);

const $ = (id) => document.getElementById(id);
const TOKEN_KEY = 'pkonline_token';
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem storage */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* sem storage */ } },
};

let world = null;
let game = null;
// link de convite (?convite=CODIGO): entra no mundo depois do login
let pendingInvite = new URLSearchParams(location.search).get('convite');
if (pendingInvite) history.replaceState(null, '', location.pathname);

function progress(p, text) {
  $('loading-bar').style.width = p + '%';
  if (text) $('loading-text').textContent = text;
  return new Promise((r) => setTimeout(r, 30));
}

async function boot() {
  await progress(10, 'Gerando o mundo de Sinnoh...');
  world = getWorld();
  await progress(55, 'Espalhando Pokémon pelas rotas...');
  buildEncounterTables();
  await progress(75, 'Conectando ao servidor...');
  const unlock = () => { audio.init(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  setupNet();
  const ok = await net.connect();
  await progress(100, ok ? 'Pronto!' : 'Servidor offline');
  $('loading').classList.add('done');
  if (!ok) {
    showOffline();
    return;
  }
  const token = store.get(TOKEN_KEY);
  if (token) net.send({ t: 'resume', token });
  else showLogin();
}

function showOffline() {
  const el = document.createElement('div');
  el.className = 'login-wrap offline';
  el.innerHTML = `<div class="panel login-card"><div class="logo"><span class="pk">Pokémon</span><span class="on">Freedom</span></div>
    <div class="err">Não foi possível conectar ao servidor.</div><div class="muted">Verifique se o servidor está rodando (npm start) e recarregue a página.</div>
    <button class="btn red" onclick="location.reload()">Tentar de novo</button></div>`;
  $('ui').appendChild(el);
}

// ------------------------------------------------------------ login
let loginEl = null;
function showLogin(err = '') {
  if (loginEl) loginEl.remove();
  let mode = 'login';
  loginEl = document.createElement('div');
  loginEl.className = 'login-wrap';
  loginEl.innerHTML = `<div class="panel login-card">
    <div class="logo"><span class="pk">Pokémon</span><span class="on">Freedom</span><span class="sub">Sinnoh • Mundo Aberto</span></div>
    <div class="tabs" style="justify-content:center"><button class="tab on" data-m="login">Entrar</button><button class="tab" data-m="register">Criar conta</button></div>
    <div class="field"><span>Conta</span><input class="nm" maxlength="14" autocomplete="username" placeholder="Nome da conta (ex.: joao_123)"></div>
    <div class="field"><span>Senha</span><input class="pw" type="password" maxlength="64" autocomplete="current-password"></div>
    <div class="err">${esc(err)}</div>
    <button class="btn red go">Entrar</button>
    <div class="server-note">${pendingInvite ? 'Você recebeu um convite! Entre ou crie uma conta para acessar o mundo.' : 'Uma conta pode ter vários mundos. Para jogar com amigos, convide-os para um mundo.'}</div></div>`;
  $('ui').appendChild(loginEl);
  const nm = loginEl.querySelector('.nm'), pw = loginEl.querySelector('.pw'), go = loginEl.querySelector('.go'), er = loginEl.querySelector('.err');
  loginEl.querySelectorAll('.tab').forEach((b) => b.onclick = () => {
    mode = b.dataset.m;
    loginEl.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === b));
    go.textContent = mode === 'login' ? 'Entrar' : 'Criar conta';
  });
  const submit = () => {
    const name = nm.value.trim(), pass = pw.value;
    if (!name || !pass) { er.textContent = 'Preencha nome e senha.'; return; }
    er.textContent = '';
    go.disabled = true;
    state.pendingLogin = { name };
    net.send({ t: mode, name, pass });
    setTimeout(() => { go.disabled = false; }, 1500);
  };
  go.onclick = submit;
  pw.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  nm.addEventListener('keydown', (e) => { if (e.key === 'Enter') pw.focus(); });
  setTimeout(() => nm.focus(), 50);
}

// ------------------------------------------------------------ rede
function setupNet() {
  net.on('auth', (m) => {
    if (!m.ok) {
      if (m.expired) { store.del(TOKEN_KEY); showLogin(); return; }
      showLogin(m.error || 'Erro ao entrar.');
      return;
    }
    store.set(TOKEN_KEY, m.token);
    // cartão de "servidor offline" de uma tentativa anterior
    document.querySelectorAll('.login-wrap.offline').forEach((e) => e.remove());
    if (game && loginEl) {
      // o login expirou com o jogo aberto: recarrega para usar o save do servidor
      location.reload();
      return;
    }
    state.myId = m.id;
    state.account = m.account;
    state.accountKey = m.account.toLowerCase();
    if (game && state.worldId) {
      // reconexão: volta para o mesmo mundo mantendo o estado local
      net.send({ t: 'enterWorld', id: state.worldId });
      return;
    }
    if (loginEl) { loginEl.remove(); loginEl = null; }
    if (pendingInvite) { net.send({ t: 'joinInvite', code: pendingInvite }); pendingInvite = null; }
    showWorlds({ list: m.list, lan: m.lan, account: m.account }, (w) => net.send({ t: 'enterWorld', id: w.id }));
  });
  net.on('world', async (m) => {
    state.worldId = m.world.id;
    state.world = m.world;
    state.accountKey = m.accountKey;
    state.houses = m.houses || {};
    if (game) {
      // reconexão
      game.remotes.clear();
      for (const p of m.players) game.onRemote(p);
      game.onlineCount = m.players.length + 1;
      net.send({ t: 'look', look: S().look });
      game.sentFollower = null;
      game.refreshFollower();
      game.sendPos();
      saveNow();
      ui.toast('Reconectado!', 'good');
      return;
    }
    hideWorlds();
    if (m.save && m.save.version) {
      state.save = m.save;
      migrateSave(state.save);
    } else {
      // primeiro acesso a este mundo: cria o treinador
      let name = null;
      while (!name) name = await ui.prompt(`Nome do seu treinador em "${m.world.name}"`, state.account, 14);
      const look = await createLook({ ...DEFAULT_LOOK }, `${name}: crie seu personagem`);
      state.save = ensureSaveFields(newSave(name, look || DEFAULT_LOOK));
      saveNow();
    }
    state.name = state.save.name;
    startGame(m.players);
  });
  net.on('worldClosed', (m) => { alert(m.text); location.reload(); });
  net.on('worldInfo', (m) => {
    if (!state.world || m.world.id !== state.world.id) return;
    const was = !!state.world.cheats;
    state.world = m.world;
    if (game && was !== !!m.world.cheats) ui.toast(m.world.cheats ? '🪄 Cheats ativados neste mundo (Menu → Cheats ou /ajuda no chat).' : 'Cheats desativados neste mundo.', 'good');
  });
  net.on('error', (m) => { if (!game) ui.toast(m.text, 'bad'); });
  net.on('kicked', (m) => { net.wantReconnect = false; alert(m.text); location.reload(); });
  net.on('close', ({ was }) => { if (game && was) ui.toast('Conexão perdida. Reconectando...', 'bad'); });
  net.on('reconnected', () => {
    const token = store.get(TOKEN_KEY);
    if (token) net.send({ t: 'resume', token });
    else if (!loginEl && !game) { document.querySelectorAll('.login-wrap.offline').forEach((e) => e.remove()); showLogin(); }
  });
  net.on('pjoin', (m) => { if (!game) return; game.onRemote(m.p); game.onlineCount = game.remotes.size + 1; });
  net.on('pleave', (m) => { if (!game) return; game.remotes.delete(m.id); game.onlineCount = game.remotes.size + 1; });
  net.on('p', (m) => {
    if (!game) return;
    if (!game.remotes.has(m.id)) return;
    game.remoteMove(m);
  });
  net.on('plook', (m) => { const r = game && game.remotes.get(m.id); if (r) r.look = m.look; });
  net.on('pfollow', (m) => { const r = game && game.remotes.get(m.id); if (r) game.setRemoteFollower(r, m.follower); });
  net.on('house', (m) => {
    // enquanto o dono decora, o editor controla o estado local da casa
    if (game && game.editor && game.building && game.building.plotId === m.plotId && m.data) return;
    if (m.data) state.houses[m.plotId] = m.data; else delete state.houses[m.plotId];
    if (game && game.building && game.building.plotId === m.plotId && !game.editor) {
      if (!m.data) { game.exitBuilding(); return; }
      game.rebuildInterior();
    }
    if (S() && m.mine && m.bought) { S().houses = [...new Set([...(S().houses || []), m.plotId])]; }
  });
  net.on('houseRejected', (m) => {
    if (!S()) return;
    const inv = S().furnitureInv ||= {};
    for (const id of m.items) inv[id] = (inv[id] || 0) + 1;
    markDirty();
    ui.toast(`${m.items.length} móvel(is) não couberam e voltaram para o inventário.`, 'bad');
  });
  net.on('money', (m) => {
    if (!S()) return;
    S().money = m.money;
    if (m.furnitureInv) S().furnitureInv = m.furnitureInv;
  });
}

function migrateSave(s) {
  s.options ||= { textSpeed: 2, music: 0.35, sfx: 0.6, zoom: 1, autoRun: false };
  s.flags ||= { starter: !!s.party?.length, items: {}, legends: {} };
  s.flags.items ||= {};
  s.flags.legends ||= {};
  s.visited ||= [];
  s.stats ||= { steps: 0, battles: 0, caught: 0, trades: 0, pvpWins: 0, playMs: 0 };
  s.league ||= { champion: false, beatenAt: 0 };
  s.floorsOwned ||= ['madeira'];
  s.wallsOwned ||= ['creme'];
  s.furnitureInv ||= {};
  s.keyItems ||= [];
  s.trainers ||= {};
  ensureSaveFields(s);
}

// ------------------------------------------------------------ jogo
function startGame(players) {
  const renderer = new Renderer($('game'), world);
  game = new Game(world, renderer);
  window.__game = game; // útil para depuração no console
  game.handlers = createHandlers(game);
  setMenuGame(game);
  initSocial(game);
  for (const p of players) game.onRemote(p);
  game.onlineCount = players.length + 1;
  const o = S().options;
  audio.setVolumes(o.music, o.sfx);
  renderer.setZoom(o.zoom || 1);
  $('hud').classList.remove('hidden');
  document.querySelectorAll('#hud-buttons button').forEach((b) => b.onclick = () => {
    audio.init();
    if (ui.busy || game.locked) return;
    const a = b.dataset.act;
    if (a === 'menu') game.handlers.openMenu();
    if (a === 'map') game.handlers.openMap();
    if (a === 'bike') game.toggleBike();
    if (a === 'run') game.toggleRun();
    if (a === 'chat') game.handlers.openChat();
    if (a === 'controls') game.handlers.openControls();
    if (a === 'poketch') game.handlers.openPoketch();
  });
  $('decorbtn').onclick = () => { audio.init(); if (!ui.busy && !game.locked) game.handlers.openDecor(); };
  net.send({ t: 'look', look: S().look });
  game.start();
  addChatLine(null, `Bem-vindo ao mundo "${state.world.name}", ${state.name}! ${players.length ? `${players.length} treinador(es) jogando aqui agora.` : 'Ninguém mais está aqui agora.'}`);
  if (!S().flags.starter) {
    setTimeout(async () => {
      game.locked = true;
      await starterFlow();
      game.locked = false;
      game.refreshFollower();
    }, 600);
  }
  window.addEventListener('beforeunload', () => { game.storePos(); saveNow(); });
  void input;
}

boot();
