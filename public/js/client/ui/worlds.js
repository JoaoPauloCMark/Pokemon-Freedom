// Tela "Meus Mundos": uma conta pode ter vários mundos (saves), cada um com seu
// treinador. Convidar alguém é convidar para um mundo específico.
import { ui, esc, money } from './ui.js';
import { net } from '../net.js';
import { audio } from '../audio.js';
import { drawPortrait } from '../render/character.js';

let el = null;
let current = { list: [], lan: [], account: '' };
let onPlayCb = null;

function fmtTime(ms) {
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return h ? `${h}h ${m}min` : `${m}min`;
}

export function inviteLinks(code, lan) {
  const links = [`${location.origin}/?convite=${code}`];
  for (const u of lan || []) {
    const l = `${u}/?convite=${code}`;
    if (!links.includes(l)) links.push(l);
  }
  return links;
}

export function showWorlds(data, onPlay) {
  current = { ...current, ...data };
  onPlayCb = onPlay;
  if (!el) {
    el = document.createElement('div');
    el.className = 'login-wrap worlds-screen';
    document.getElementById('ui').appendChild(el);
    net.on('worlds', onWorldsMsg);
  }
  render();
}

export function hideWorlds() {
  if (!el) return;
  net.off('worlds', onWorldsMsg);
  el.remove();
  el = null;
}

function onWorldsMsg(m) {
  current.list = m.list;
  current.lan = m.lan || current.lan;
  render();
  if (m.created) {
    ui.toast('Mundo criado! Clique em Jogar para criar seu treinador.', 'good');
    highlight(m.created);
  }
  if (m.joined) {
    ui.toast(`Você entrou no mundo "${m.joinedName}"!`, 'good');
    highlight(m.joined);
  }
}

function highlight(id) {
  const card = el && el.querySelector(`[data-world="${id}"]`);
  if (card) { card.classList.add('flash'); card.scrollIntoView({ block: 'nearest' }); }
}

function render() {
  if (!el) return;
  const { list, account } = current;
  el.innerHTML = `<div class="panel worlds-panel">
      <div class="row worlds-head">
        <div class="logo small"><span class="pk">Pokémon</span><span class="on">Freedom</span></div>
        <div class="grow"></div>
        <span class="muted">Conta: <b>${esc(account)}</b></span>
        <button class="btn small" data-a="trash" title="Mundos excluídos nos últimos 7 dias">🗑️ Lixeira</button>
        <button class="btn small" data-a="logout">Sair da conta</button>
      </div>
      <h2>Meus Mundos <span class="sub">Cada mundo é um save com seu próprio treinador</span></h2>
      <div class="worlds-grid scroll"></div>
      <div class="row join-row">
        <input class="code" maxlength="8" placeholder="Código de convite (ex.: K7P2QX)">
        <button class="btn blue" data-a="join">Entrar com convite</button>
      </div>
      <div class="muted">Jogar sozinho: crie um mundo e não convide ninguém. Jogar com amigos: abra "Convidar" e mande o link ou o código só para quem você quiser.</div>
    </div>`;
  const grid = el.querySelector('.worlds-grid');
  for (const w of list) {
    const card = document.createElement('div');
    card.className = 'world-card';
    card.dataset.world = w.id;
    const tr = w.trainer;
    card.innerHTML = `
      <div class="wc-top"><canvas width="64" height="120"></canvas>
        <div class="col grow" style="gap:2px;min-width:0">
          <div class="wc-name">${esc(w.name)}${w.cheats ? ' <span class="chip-cheat" title="Cheats ativados neste mundo">🪄 cheats</span>' : ''}</div>
          <div class="muted">${w.isOwner ? 'Seu mundo' : `Mundo de ${esc(w.ownerName)}`} • ${w.members.length} membro(s)</div>
          ${tr ? `<div class="wc-tr"><b>${esc(tr.name)}</b> • ${tr.badges} insígnia(s) • ${tr.caught} capturados • ${fmtTime(tr.playMs)} • ${money(tr.money)}</div>`
    : '<div class="wc-tr muted">Você ainda não tem treinador neste mundo.</div>'}
          ${w.online ? `<div class="wc-online">● ${w.online} jogando agora</div>` : ''}
        </div></div>
      <div class="row wc-actions">
        <button class="btn red" data-a="play">${tr ? 'Jogar' : 'Criar treinador'}</button>
        ${w.isOwner ? '<button class="btn" data-a="invite">Convidar</button>' : ''}
        <button class="btn small" data-a="more">⋯</button>
      </div>`;
    const cv = card.querySelector('canvas');
    if (tr && tr.look) drawPortrait(cv, tr.look, 2, 0); else cv.style.visibility = 'hidden';
    card.querySelector('[data-a=play]').onclick = () => { audio.init(); audio.sfx('confirm'); if (onPlayCb) onPlayCb(w); };
    const inv = card.querySelector('[data-a=invite]');
    if (inv) inv.onclick = () => openInvite(w);
    card.querySelector('[data-a=more]').onclick = () => moreMenu(w);
    grid.appendChild(card);
  }
  const add = document.createElement('div');
  add.className = 'world-card new';
  add.innerHTML = '<div class="plus">＋</div><div class="wc-name">Criar novo mundo</div>';
  add.onclick = () => openCreateWorld(`Mundo ${list.filter((w) => w.isOwner).length + 1}`);
  grid.appendChild(add);
  el.querySelector('[data-a=trash]').onclick = () => openTrash();
  el.querySelector('[data-a=logout]').onclick = () => {
    try { localStorage.removeItem('pkonline_token'); } catch { /* sem storage */ }
    location.href = location.pathname;
  };
  const code = el.querySelector('.code');
  const join = () => { const v = code.value.trim(); if (v) net.send({ t: 'joinInvite', code: v }); };
  el.querySelector('[data-a=join]').onclick = join;
  code.addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); e.stopPropagation(); });
}

// Criar mundo: nome e opção de cheats (como no Minecraft)
function openCreateWorld(defName) {
  let cheats = false;
  ui.panel({
    title: 'Criar novo mundo', width: 'min(520px,96vw)',
    build: (body, L) => {
      body.innerHTML = `<div class="field"><span>Nome do mundo</span><input class="wname" maxlength="24" value="${esc(defName)}"></div>
        <button class="switch-row" data-a="cheats"><span class="sw"><i></i></span><span class="col" style="gap:2px;text-align:left"><b>Permitir cheats</b>
          <span class="muted">Libera o painel de cheats e os comandos do chat (/dinheiro, /pokemon, /item...). Bom para testar. Dá para mudar depois.</span></span></button>
        <div class="row" style="justify-content:flex-end"><button class="btn" data-a="cancel">Cancelar</button><button class="btn red" data-a="ok">Criar mundo</button></div>`;
      const inp = body.querySelector('.wname');
      const sw = body.querySelector('[data-a=cheats]');
      const paint = () => sw.classList.toggle('on', cheats);
      sw.onclick = () => { cheats = !cheats; audio.sfx('select'); paint(); };
      const ok = () => {
        const name = inp.value.trim();
        if (!name) { ui.toast('Dê um nome ao mundo.', 'bad'); return; }
        net.send({ t: 'createWorld', name, cheats });
        audio.sfx('confirm');
        L.close();
      };
      body.querySelector('[data-a=ok]').onclick = ok;
      body.querySelector('[data-a=cancel]').onclick = () => L.close();
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); e.stopPropagation(); });
      setTimeout(() => { inp.focus(); inp.select(); }, 40);
      paint();
    },
  });
}

// Lixeira: mundos excluídos ficam 7 dias e podem ser restaurados
function openTrash() {
  let layer = null;
  const onTrash = (m) => { if (layer) layer.render(m.list); };
  net.on('trash', onTrash);
  layer = ui.panel({
    title: '🗑️ Lixeira de mundos', width: 'min(560px,96vw)',
    onClose: () => net.off('trash', onTrash),
    build: (body, L) => {
      L.render = (list) => {
        body.innerHTML = `<div class="muted">Mundos que você excluiu ficam aqui por 7 dias. Depois disso são apagados de vez.</div>
          <div class="col">${list.length ? list.map((t) => `<div class="home-card"><span class="hic">🌍</span><div class="grow"><b>${esc(t.name)}</b>
            <small>Excluído em ${new Date(t.deletedAt).toLocaleString('pt-BR')} • ${t.players} treinador(es)</small></div>
            <button class="btn small green" data-r="${esc(t.id)}">Restaurar</button></div>`).join('') : '<div class="muted">A lixeira está vazia.</div>'}</div>`;
        body.querySelectorAll('[data-r]').forEach((b) => b.onclick = () => { net.send({ t: 'restoreWorld', id: b.dataset.r }); audio.sfx('confirm'); });
      };
      body.innerHTML = '<div class="muted">Carregando...</div>';
      net.send({ t: 'trash' });
    },
  });
}

async function moreMenu(w) {
  const opts = w.isOwner ? ['Renomear', 'Membros', w.cheats ? 'Desativar cheats' : 'Ativar cheats', 'Excluir mundo'] : ['Sair deste mundo'];
  const c = await ui.choice(w.name, [...opts, 'Cancelar']);
  const o = opts[c];
  if (o === 'Renomear') {
    const name = await ui.prompt('Novo nome do mundo', w.name, 24);
    if (name) net.send({ t: 'renameWorld', id: w.id, name });
  } else if (o === 'Membros') {
    openMembers(w);
  } else if (o === 'Ativar cheats' || o === 'Desativar cheats') {
    const on = o === 'Ativar cheats';
    if (await ui.ask(on ? `Ativar cheats em "${w.name}"? Todos os membros poderão usar o painel de cheats.` : `Desativar cheats em "${w.name}"?`)) net.send({ t: 'setCheats', id: w.id, on });
  } else if (o === 'Excluir mundo') {
    if (await ui.ask(`Excluir "${w.name}"? Ele vai para a Lixeira e pode ser restaurado por 7 dias.`)) {
      const n = await ui.prompt('Digite EXCLUIR para confirmar', '', 10);
      if (n && n.toUpperCase() === 'EXCLUIR') net.send({ t: 'deleteWorld', id: w.id });
    }
  } else if (o === 'Sair deste mundo') {
    if (await ui.ask(`Sair de "${w.name}"? Você só volta se for convidado de novo.`)) net.send({ t: 'leaveMembership', id: w.id });
  }
}

function openMembers(w) {
  ui.panel({
    title: `Membros de "${esc(w.name)}"`, width: 'min(520px,96vw)',
    build: (body, layer) => {
      body.innerHTML = '<div class="col players-list"></div>';
      const box = body.querySelector('.players-list');
      for (const name of w.members) {
        const d = document.createElement('div');
        d.className = 'pl';
        const owner = name === w.ownerName;
        d.innerHTML = `<span style="font-size:20px">${owner ? '👑' : '🧢'}</span><div class="grow n">${esc(name)}</div>${owner ? '' : '<button class="btn small red">Remover</button>'}`;
        const b = d.querySelector('button');
        if (b) b.onclick = async () => {
          if (await ui.ask(`Remover ${name} deste mundo?`)) { net.send({ t: 'kickMember', id: w.id, member: name }); layer.close(); }
        };
        box.appendChild(d);
      }
    },
  });
}

// Painel de convite (também usado dentro do jogo pelo dono do mundo)
export function openInvite(w) {
  let layer = null;
  const onInvite = (m) => { if (m.id === w.id && layer) layer.render(m); };
  net.on('invite', onInvite);
  layer = ui.panel({
    title: `Convidar para "${esc(w.name)}"`, width: 'min(640px,96vw)',
    onClose: () => net.off('invite', onInvite),
    build: (body, L) => {
      L.render = (m) => {
        if (!m.code) {
          body.innerHTML = `<div class="desc-box">Os convites deste mundo estão desativados. Ninguém novo consegue entrar.</div>
            <div class="row" style="justify-content:flex-end"><button class="btn green" data-a="new">Ativar convites</button></div>`;
          body.querySelector('[data-a=new]').onclick = () => net.send({ t: 'invite', id: w.id, action: 'new' });
          return;
        }
        const links = inviteLinks(m.code, m.lan);
        body.innerHTML = `<div class="muted">Só quem receber este código (ou link) consegue entrar no seu mundo. Você pode trocar o código a qualquer momento.</div>
          <div class="invite-code">${esc(m.code)}</div>
          <div class="col">${links.map((l, i) => `<div class="row"><input class="grow link" readonly value="${esc(l)}"><button class="btn small" data-copy="${i}">Copiar</button></div>`).join('')}</div>
          <div class="muted">• Mesma rede (Wi-Fi): use o link com o IP do seu computador.<br>• Pela internet: crie um link público com um túnel (veja o README) e adicione <b>/?convite=${esc(m.code)}</b> no final, ou mande só o código.</div>
          <div class="row" style="justify-content:flex-end"><button class="btn" data-a="off">Desativar convites</button><button class="btn blue" data-a="new">Gerar novo código</button></div>`;
        body.querySelectorAll('[data-copy]').forEach((b) => b.onclick = () => {
          const v = links[+b.dataset.copy];
          (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(() => ui.toast('Link copiado!', 'good')).catch(() => {
            const inp = body.querySelectorAll('.link')[+b.dataset.copy]; inp.select(); document.execCommand('copy'); ui.toast('Link copiado!', 'good');
          });
        });
        body.querySelector('[data-a=new]').onclick = async () => {
          if (await ui.ask('Gerar um novo código? O código antigo para de funcionar (quem já entrou continua no mundo).')) net.send({ t: 'invite', id: w.id, action: 'new' });
        };
        body.querySelector('[data-a=off]').onclick = () => net.send({ t: 'invite', id: w.id, action: 'off' });
      };
      body.innerHTML = '<div class="muted">Carregando...</div>';
      net.send({ t: 'invite', id: w.id, action: 'get' });
    },
  });
}
