// Chat, lista de jogadores, trocas e desafios PvP.
import { ui, esc } from './ui.js';
import { audio } from '../audio.js';
import { net } from '../net.js';
import { S, state, markDirty, saveNow, markCaught } from '../state.js';
import { monName, isUsable, evolutionTarget, cloneMon } from '../../shared/pokemon.js';
import { POKEDEX } from '../../shared/data/pokedex.js';
import { pickPartyMon, pcardHtml, typeChip } from './pickers.js';
import { evolutionScene } from './evolution.js';
import { runPvp } from './battle.js';
import { spriteUrl, fallbackSprite, monImg } from '../assets.js';
import { zoneAt } from '../../shared/world/world.js';
import { runCommand } from './cheats.js';

let game = null;

export function initSocial(g) {
  game = g;
  const chat = document.getElementById('chat');
  const inp = document.getElementById('chat-input');
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const text = inp.value.trim();
      if (text.startsWith('/')) {
        // comandos de cheat (só funcionam em mundos com cheats ativados)
        runCommand(game, text, (msg) => addChatLine(null, msg));
      } else if (text) {
        net.send({ t: 'chat', text });
        addChatLine(state.name, text);
        bubble(game.player, text);
      }
      inp.value = '';
      closeChat();
      e.preventDefault();
    } else if (e.key === 'Escape') { closeChat(); e.preventDefault(); }
    e.stopPropagation();
  });
  inp.addEventListener('blur', () => setTimeout(closeChat, 100));
  net.on('chat', (m) => {
    if (m.sys) addChatLine(null, m.text);
    else {
      addChatLine(m.from, m.text);
      const r = game.remotes.get(m.id);
      if (r) bubble(r, m.text);
      audio.sfx('chat');
    }
  });
  net.on('pemote', (m) => { const r = game.remotes.get(m.id); if (r) r.emote = { e: m.e, at: performance.now() }; });
  net.on('info', (m) => ui.toast(m.text));
  net.on('error', (m) => ui.toast(m.text, 'bad'));
  // ocupado = batalhando, trocando, decorando a casa etc.
  const busy = () => game.locked || !!game.editor;
  net.on('tradeReq', async (m) => {
    if (busy()) { net.send({ t: 'tradeResp', from: m.from, accept: false }); return; }
    audio.sfx('encounter');
    const ok = await ui.ask(`${m.name} quer trocar Pokémon com você. Aceitar?`);
    net.send({ t: 'tradeResp', from: m.from, accept: ok && !busy() });
  });
  net.on('tradeStart', (m) => {
    if (busy()) { net.send({ t: 'tradeCancel' }); return; }
    openTrade(m);
  });
  net.on('battleReq', async (m) => {
    if (busy()) { net.send({ t: 'battleResp', from: m.from, accept: false }); return; }
    audio.sfx('encounter');
    const ok = await ui.ask(`${m.name} desafiou você para uma batalha! Aceitar?`);
    if (ok && !S().party.some(isUsable)) { ui.toast('Você precisa de Pokémon para batalhar.', 'bad'); net.send({ t: 'battleResp', from: m.from, accept: false }); return; }
    net.send({ t: 'battleResp', from: m.from, accept: ok && !busy(), team: S().party.map(cloneMon) });
  });
  net.on('pvpStart', async (m) => {
    if (busy()) { net.send({ t: 'pvpForfeit' }); return; }
    ui.closeAll();
    game.locked = true;
    await game.battleTransition();
    try { await runPvp(m); } finally {
      game.locked = false;
      game.updateMusic();
      saveNow();
    }
  });
  // clicar em outro jogador
  game.renderer.canvas.addEventListener('click', (e) => {
    if (ui.busy || game.locked || game.editor) return;
    const r = game.renderer;
    const wx = (e.clientX - r.vw / 2) / (r.zoomNow || r.zoom) + r.cam.x;
    const wy = (e.clientY - r.vh / 2) / (r.zoomNow || r.zoom) + r.cam.y;
    for (const p of game.remotes.values()) {
      if (p.map !== game.map) continue;
      const px = (p.rx + 0.5) * 48, py = (p.ry + 0.3) * 48;
      if (Math.abs(wx - px) < 26 && Math.abs(wy - py) < 40) { playerMenu(p); return; }
    }
  });
}

export function addChatLine(from, text) {
  const log = document.getElementById('chat-log');
  const d = document.createElement('div');
  d.innerHTML = from ? `<b>${esc(from)}:</b> ${esc(text)}` : `<span class="sys">${esc(text)}</span>`;
  log.appendChild(d);
  while (log.children.length > 40) log.firstChild.remove();
  setTimeout(() => d.classList.add('old'), 12000);
}

function bubble(ent, text) {
  ent.bubble = { text, until: performance.now() + 6000 };
}

export function openChat() {
  const chat = document.getElementById('chat');
  const inp = document.getElementById('chat-input');
  chat.classList.add('open');
  setTimeout(() => inp.focus(), 10);
}

function closeChat() {
  const chat = document.getElementById('chat');
  chat.classList.remove('open');
  document.getElementById('chat-input').blur();
}

export async function emote() {
  const list = ['!', '?', '♥', '♪', '😀', '😢', '💤', '👋'];
  const c = await ui.choice('Expressão', list);
  if (c < 0) return;
  game.player.emote = { e: list[c], at: performance.now() };
  net.send({ t: 'emote', e: list[c] });
}

// ------------------------------------------------------------ jogadores
export async function playerMenu(p) {
  const c = await ui.choice(`${p.name}`, ['Trocar Pokémon', 'Desafiar para batalha', 'Acenar', 'Cancelar']);
  if (c === 0) requestTrade(p);
  else if (c === 1) requestBattle(p);
  else if (c === 2) { game.player.emote = { e: '👋', at: performance.now() }; net.send({ t: 'emote', e: '👋' }); }
}

function requestTrade(p) {
  if (!S().party.length) { ui.toast('Você não tem Pokémon.', 'bad'); return; }
  net.send({ t: 'tradeReq', to: p.id });
}

function requestBattle(p) {
  if (!S().party.some(isUsable)) { ui.toast('Seus Pokémon precisam estar em condições de lutar.', 'bad'); return; }
  net.send({ t: 'battleReq', to: p.id, team: S().party.map(cloneMon) });
}

export function openPlayers() {
  ui.panel({
    title: 'Jogadores online', width: 'min(620px,96vw)',
    build: (body) => {
      const list = [...game.remotes.values()];
      if (!list.length) { body.innerHTML = '<div class="muted">Ninguém mais está online agora. Chame seus amigos!</div>'; return; }
      body.innerHTML = '<div class="col players-list scroll" style="max-height:60vh"></div>';
      const box = body.querySelector('.players-list');
      for (const p of list) {
        let where = 'Em algum lugar';
        if (p.map === 'world') { const z = zoneAt(game.world, p.x, p.y); where = z ? z.name : where; }
        else { const b = game.world.buildings.find((x) => 'int:' + x.id === p.map); if (b) where = b.name; }
        const d = document.createElement('div');
        d.className = 'pl';
        d.innerHTML = `<span style="font-size:20px">🧢</span><div class="grow"><div class="n">${esc(p.name)}</div><div class="muted">${esc(where)}</div></div>
          <button class="btn small" data-a="t">Trocar</button><button class="btn small red" data-a="b">Batalhar</button>`;
        d.querySelector('[data-a=t]').onclick = () => requestTrade(p);
        d.querySelector('[data-a=b]').onclick = () => requestBattle(p);
        box.appendChild(d);
      }
    },
  });
}

// ------------------------------------------------------------ troca
function openTrade(start) {
  ui.closeAll();
  game.locked = true;
  let mine = null, theirs = null, confirmMe = false, confirmThem = false, finished = false;
  const layer = ui.panel({
    title: `Troca com ${esc(start.name)}`, width: 'min(820px,96vw)',
    build: (body) => {
      const slot = (mon, label, ok) => mon
        ? `<div class="slot"><b>${label}</b>${monImg(mon.species, mon.shiny)}<div style="font-weight:900">${esc(monName(mon))} • Nv. ${mon.level}</div><div class="row">${POKEDEX[mon.species].types.map(typeChip).join('')}</div>${ok ? '<div class="ok">✔ Confirmado</div>' : ''}</div>`
        : `<div class="slot"><b>${label}</b><div class="muted">${label === 'Você oferece' ? 'Escolha um Pokémon' : 'Aguardando escolha...'}</div></div>`;
      const render = () => {
        body.innerHTML = `<div class="trade">${slot(mine, 'Você oferece', confirmMe)}${slot(theirs, `${esc(start.name)} oferece`, confirmThem)}</div>
          <div class="row" style="justify-content:flex-end"><button class="btn" data-a="pick">Escolher Pokémon</button><button class="btn red" data-a="cancel">Cancelar</button><button class="btn green" data-a="ok" ${mine && theirs && !confirmMe ? '' : 'disabled'}>Confirmar troca</button></div>`;
        body.querySelector('[data-a=pick]').onclick = async () => {
          const s = S();
          const i = await pickPartyMon('Oferecer qual Pokémon?', {
            filter: (m) => (s.party.filter(isUsable).length <= 1 && isUsable(m) ? 'Você precisa ficar com um Pokémon que possa lutar.' : s.party.length <= 1 ? 'Você não pode trocar seu único Pokémon.' : null),
          });
          if (i >= 0) { mine = s.party[i]; net.send({ t: 'tradeOffer', mon: cloneMon(mine) }); }
        };
        body.querySelector('[data-a=cancel]').onclick = () => { net.send({ t: 'tradeCancel' }); };
        body.querySelector('[data-a=ok]').onclick = () => { net.send({ t: 'tradeConfirm' }); };
      };
      layer.render = render;
      render();
    },
    onKey: (k) => (k === 'b' ? (net.send({ t: 'tradeCancel' }), true) : false),
    onClose: () => { if (!finished) { finished = true; net.send({ t: 'tradeCancel' }); } cleanup(); },
  });
  layer.el.querySelector('.close').onclick = () => net.send({ t: 'tradeCancel' });
  const onOffer = (m) => { if (m.who === 'them') theirs = m.mon; confirmMe = false; confirmThem = false; layer.render(); };
  const onState = (m) => { confirmMe = m.confirmMe; confirmThem = m.confirmThem; layer.render(); };
  const onCancel = (m) => { if (finished) return; finished = true; layer.close(); ui.toast(m.reason || 'Troca cancelada.', 'bad'); };
  const onDone = async (m) => {
    if (finished) return;
    finished = true;
    layer.close();
    const s = S();
    const idx = s.party.findIndex((x) => x.uid === m.give);
    const recv = m.receive;
    recv.uid = recv.uid + '-t' + Date.now().toString(36);
    if (idx >= 0) s.party[idx] = recv; else s.party.push(recv);
    s.stats.trades++;
    markCaught(recv.species);
    markDirty();
    audio.sfx('caught');
    await ui.dialog(`Você trocou com ${m.partner || start.name} e recebeu ${monName(recv)}!`);
    const to = evolutionTarget(recv, { trigger: 'trade' });
    if (to) await evolutionScene(recv, to);
    game.refreshFollower();
    saveNow();
  };
  const onDrop = () => onCancel({ reason: 'A conexão caiu. Troca cancelada.' });
  net.on('tradeOffer', onOffer); net.on('tradeState', onState); net.on('tradeCancel', onCancel); net.on('tradeDone', onDone); net.on('close', onDrop);
  function cleanup() {
    net.off('tradeOffer', onOffer); net.off('tradeState', onState); net.off('close', onDrop);
    setTimeout(() => { net.off('tradeCancel', onCancel); net.off('tradeDone', onDone); game.locked = false; }, 50);
  }
}

void pcardHtml;
