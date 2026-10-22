// Menu principal e telas: equipe, resumo, bolsa, Pokédex, perfil, roupas e opções.
import { ui, esc, money } from './ui.js';
import { audio } from '../audio.js';
import { S, state, markDirty, saveNow, useItem, addItem, healParty } from '../state.js';
import { POKEDEX } from '../../shared/data/pokedex.js';
import { DEXTEXT } from '../../shared/data/dextext.js';
import { MOVES } from '../../shared/data/moves.js';
import { ITEMS, itemSprite } from '../../shared/data/items.js';
import { TYPE_PT, STAT_PT } from '../../shared/data/types.js';
import { GYMS } from '../../shared/world/npcs.js';
import { speciesLocations } from '../../shared/world/encounters.js';
import { calcStats, maxHp, monName, NATURES, abilityName, abilityDesc, expForLevel, evolutionTarget, gainExp, tryLearn, makeMove } from '../../shared/pokemon.js';
import { spriteUrl, fallbackSprite, monImg } from '../assets.js';
import { pcardHtml, pickPartyMon, typeChip, genderHtml, statusHtml, moveDesc, learnMoveFlow, pickMove } from './pickers.js';
import { evolutionScene } from './evolution.js';
import { editLook } from './creator.js';
import { drawPortrait } from '../render/character.js';
import { net } from '../net.js';
import { openInvite } from './worlds.js';

let game = null;
export function setMenuGame(g) { game = g; }

// ------------------------------------------------------------ menu principal
// Navegação por setas em qualquer grade de botões: vai para o vizinho mais
// próximo na direção pressionada.
export function navNearest(buttons, cur, k) {
  const r0 = buttons[cur].getBoundingClientRect();
  const cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
  let best = cur, bestD = Infinity;
  buttons.forEach((b, i) => {
    if (i === cur) return;
    const r = b.getBoundingClientRect();
    const dx = r.left + r.width / 2 - cx, dy = r.top + r.height / 2 - cy;
    const ok = k === 'left' ? dx < -4 : k === 'right' ? dx > 4 : k === 'up' ? dy < -4 : dy > 4;
    if (!ok) return;
    const along = k === 'left' || k === 'right' ? Math.abs(dx) : Math.abs(dy);
    const side = k === 'left' || k === 'right' ? Math.abs(dy) : Math.abs(dx);
    const d = along + side * 2.5;
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

export function openMainMenu() {
  const s = S();
  const main = [
    ['party', '🔴', 'Pokémon', 'P'], ['dex', '📕', 'Pokédex', ''], ['bag', '🎒', 'Bolsa', 'I'],
    ['poketch', '⌚', 'Pokétch', 'Q'], ['map', '🗺️', 'Mapa', 'M'], ['jobs', '💼', 'Trabalhos', 'J'],
    ['clothes', '👕', 'Roupas', ''], ['home', '🏠', 'Casas', ''], ['card', '🪪', 'Perfil', ''],
  ];
  const extra = [
    ['players', '👥', 'Jogadores'], ['controls', '⌨️', 'Controles'], ['options', '⚙️', 'Opções'],
    state.world && state.world.isOwner ? ['invite', '✉️', 'Convidar'] : ['worldinfo', '🌍', 'Este mundo'],
    ...(state.world && state.world.cheats ? [['cheats', '🪄', 'Cheats']] : []),
    ['worlds', '🚪', 'Meus mundos'],
  ];
  const hours = Math.floor(s.stats.playMs / 3600000), mins = Math.floor((s.stats.playMs % 3600000) / 60000);
  let sel = 0;
  const layer = ui.panel({
    title: 'Menu', width: 'min(860px,96vw)', cls: 'menu-panel',
    build: (body) => {
      body.innerHTML = `<div class="mm">
          <div class="mm-profile">
            <canvas width="96" height="160"></canvas>
            <div class="mm-name">${esc(state.name)}</div>
            <div class="mm-world" title="Mundo">🌍 ${esc(state.world ? state.world.name : '')}${state.world && state.world.cheats ? ' <span class="chip-cheat">cheats</span>' : ''}</div>
            <div class="mm-stats">
              <div><span>Dinheiro</span><b>${money(s.money)}</b></div>
              <div><span>Insígnias</span><b>${s.badges.length}/8</b></div>
              <div><span>Pokédex</span><b>${s.dex.caught.length}</b></div>
              <div><span>Tempo</span><b>${hours}h${String(mins).padStart(2, '0')}</b></div>
            </div>
            <div class="mm-party">${s.party.map((m) => `<img src="${spriteUrl.icon(m.species)}" alt="" title="${esc(monName(m))} Nv. ${m.level}">`).join('')}</div>
          </div>
          <div class="mm-main">
            <div class="menu-grid">${main.map(([id, ic, n, k]) => `<button class="menu-item" data-id="${id}"><span class="ic">${ic}</span><span class="t">${n}</span>${k ? `<span class="k">${k}</span>` : ''}</button>`).join('')}</div>
            <div class="mm-extra">${extra.map(([id, ic, n]) => `<button class="menu-mini" data-id="${id}"><span>${ic}</span>${n}</button>`).join('')}</div>
            <div class="row mm-foot"><span class="muted">💾 Salvamento automático ligado</span><div class="grow"></div><button class="btn small green" data-a="save">Salvar agora</button></div>
          </div>
        </div>`;
      drawPortrait(body.querySelector('.mm-profile canvas'), s.look, 2, 0);
      const btns = [...body.querySelectorAll('[data-id]')];
      btns.forEach((b, i) => {
        b.onclick = () => go(b.dataset.id);
        b.onmouseenter = () => { sel = i; paint(); };
      });
      body.querySelector('[data-a=save]').onclick = () => { game.storePos(); saveNow(); ui.toast('Jogo salvo!', 'good'); audio.sfx('confirm'); };
      const paint = () => btns.forEach((b, i) => b.classList.toggle('sel', i === sel));
      layer.paint = paint;
      layer.btns = btns;
      paint();
    },
    onKey: (k) => {
      if (!layer.btns) return false;
      if (k === 'left' || k === 'right' || k === 'up' || k === 'down') sel = navNearest(layer.btns, sel, k);
      else if (k === 'a' || k === 'enter') { go(layer.btns[sel].dataset.id); return true; }
      else return false;
      audio.sfx('select'); layer.paint(); return true;
    },
  });
  const go = (id) => {
    audio.sfx('confirm');
    layer.close();
    const fn = {
      party: openParty, dex: openPokedex, bag: () => openBag(), card: openTrainerCard, clothes: openWardrobe, map: () => game.handlers.openMap(),
      players: () => game.handlers.openPlayers(), options: openOptions, controls: () => game.handlers.openControls(),
      jobs: () => game.handlers.openJobs(), poketch: () => game.handlers.openPoketch(), invite: () => openInvite(state.world),
      cheats: () => game.handlers.openCheats(),
      home: () => game.handlers.openHome(),
      worldinfo: () => ui.dialog([`Você está no mundo "${state.world.name}", de ${state.world.ownerName}.`, `Membros: ${state.world.members.join(', ')}.`]),
      worlds: backToWorlds,
    }[id];
    if (fn) fn();
  };
}

async function backToWorlds() {
  if (!(await ui.ask('Salvar e voltar para a tela de mundos?'))) return;
  game.storePos();
  saveNow();
  setTimeout(() => location.reload(), 400);
}

// ------------------------------------------------------------ equipe
export async function openParty() {
  while (true) {
    const s = S();
    if (!s.party.length) { await ui.dialog('Você ainda não tem Pokémon.'); return; }
    const i = await pickPartyMon('Seus Pokémon', { hint: 'Clique em um Pokémon para ver opções.' });
    if (i < 0) return;
    const mon = s.party[i];
    const opts = ['Resumo', 'Mudar de posição', 'Dar apelido', 'Usar item', 'Ver golpes'];
    if (i > 0) opts.splice(1, 0, 'Colocar na frente');
    const c = await ui.choice(`O que fazer com ${monName(mon)}?`, [...opts, 'Voltar']);
    const act = opts[c];
    if (act === 'Resumo') await openSummary(s.party, i);
    else if (act === 'Colocar na frente') { s.party.splice(i, 1); s.party.unshift(mon); markDirty(); game.refreshFollower(); }
    else if (act === 'Mudar de posição') {
      const j = await pickPartyMon(`Trocar ${monName(mon)} de lugar com...`);
      if (j >= 0 && j !== i) { [s.party[i], s.party[j]] = [s.party[j], s.party[i]]; markDirty(); game.refreshFollower(); }
    } else if (act === 'Dar apelido') {
      const n = await ui.prompt('Novo apelido', monName(mon), 12);
      if (n) { mon.nick = n === POKEDEX[mon.species].name ? null : n; markDirty(); }
    } else if (act === 'Usar item') {
      const id = await pickItemField(['medicine', 'berries', 'items', 'tms']);
      if (id) await useFieldItem(id, i);
    } else if (act === 'Ver golpes') {
      await pickMove(mon, `Golpes de ${monName(mon)}`);
    }
  }
}

// ------------------------------------------------------------ resumo
export function openSummary(list, index) {
  return new Promise((resolve) => {
    let i = index;
    const layer = ui.panel({
      title: 'Resumo', width: 'min(860px,96vw)',
      build: (body) => {
        const render = () => {
          const mon = list[i];
          const sp = POKEDEX[mon.species];
          const st = calcStats(mon);
          const nat = NATURES[mon.nature] || NATURES[0];
          const g = sp.growth;
          const next = mon.level >= 100 ? 0 : expForLevel(g, mon.level + 1) - mon.exp;
          body.innerHTML = `<div class="summary">
            <div class="sum-left">
              ${monImg(mon.species, mon.shiny)}
              <div class="nm" style="font-weight:900;font-size:20px">${esc(monName(mon))} ${genderHtml(mon.gender)} ${mon.shiny ? '<span class="shiny">★</span>' : ''}</div>
              <div class="muted">#${String(sp.id).padStart(3, '0')} ${esc(sp.name)} • Nv. ${mon.level}</div>
              <div class="row">${sp.types.map(typeChip).join('')} ${statusHtml(mon.status)}</div>
              <div class="kv" style="width:100%"><span>Treinador</span><span>${esc(mon.ot || '—')}</span></div>
              <div class="kv" style="width:100%"><span>Natureza</span><span>${nat[0]}</span></div>
              <div class="kv" style="width:100%"><span>Amizade</span><span>${'♥'.repeat(Math.ceil((mon.friendship || 70) / 51))}</span></div>
              <div class="kv" style="width:100%"><span>Próximo nível</span><span>${next} EXP</span></div>
              <div class="kv" style="width:100%"><span>Capturado em</span><span>${esc(mon.met || '—')}</span></div>
              <div class="row"><button class="btn small" data-n="-1">◀</button><button class="btn small" data-n="1">▶</button></div>
            </div>
            <div class="col">
              <div class="field"><span>Habilidade: <b style="color:var(--ink)">${esc(abilityName(mon.ability))}</b></span><span class="muted">${esc(abilityDesc(mon.ability))}</span></div>
              <div class="col" style="gap:6px">${STAT_PT.map((n, k) => `<div class="stat-row"><span class="${nat[1] === k && nat[1] !== nat[2] ? 'up' : nat[2] === k && nat[1] !== nat[2] ? 'down' : ''}">${n}</span><b>${k === 0 ? `${mon.hp}/${st[0]}` : st[k]}</b><div class="b"><i style="width:${Math.min(100, (st[k] / (k === 0 ? 400 : 300)) * 100)}%"></i></div></div>`).join('')}</div>
              <div class="col" style="gap:6px">${mon.moves.map((m) => `<div class="move-row" data-m="${m.id}"><span>${typeChip(MOVES[m.id].type)} ${esc(MOVES[m.id].name)}</span><span class="pp">Poder ${MOVES[m.id].basePower || '—'}</span><span class="pp">PP ${m.pp}/${m.ppMax}</span></div>`).join('')}</div>
              <div class="move-desc">Passe o mouse sobre um golpe para ver a descrição.</div>
            </div></div>`;
          body.querySelectorAll('[data-n]').forEach((b) => b.onclick = () => { i = (i + +b.dataset.n + list.length) % list.length; render(); });
          body.querySelectorAll('.move-row').forEach((r) => r.onmouseenter = () => { body.querySelector('.move-desc').textContent = moveDesc(r.dataset.m); });
        };
        layer.render = render;
        render();
      },
      onKey: (k) => {
        if (k === 'left' || k === 'up') { i = (i + list.length - 1) % list.length; layer.render(); return true; }
        if (k === 'right' || k === 'down') { i = (i + 1) % list.length; layer.render(); return true; }
        return false;
      },
      onClose: resolve,
    });
  });
}

// ------------------------------------------------------------ bolsa
const POCKET_PT = { items: 'Itens', medicine: 'Remédios', berries: 'Frutas', balls: 'Poké Bolas', tms: 'MTs', key: 'Itens-Chave' };

function pickItemField(pockets) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; layer.close(); resolve(v); };
    const layer = openBagPanel(pockets, (id) => finish(id), () => { if (!done) { done = true; resolve(null); } });
  });
}

export function openBag() {
  openBagPanel(['items', 'medicine', 'berries', 'balls', 'tms', 'key'], async (id, layer) => {
    const it = ITEMS[id];
    const opts = [];
    if (it.pocket === 'key') opts.push('Usar');
    else if (it.heal || it.revive || it.cure || it.pp || it.candy || it.vitamin !== undefined || it.friend || it.evo || it.tm) opts.push('Usar');
    else if (it.repel || it.escape) opts.push('Usar');
    if (it.pocket !== 'key') opts.push('Jogar fora');
    const c = await ui.choice(it.name, [...opts, 'Cancelar']);
    if (opts[c] === 'Usar') {
      if (it.repel || it.escape || it.pocket === 'key') { layer.close(); await useFieldItem(id, -1); return; }
      const i = await pickPartyMon(`Usar ${it.name} em qual Pokémon?`, { extra: it.tm ? (m) => (POKEDEX[m.species].tms.includes(it.tm) ? '• Pode aprender' : '• Não pode') : null });
      if (i >= 0) await useFieldItem(id, i);
      layer.refresh();
    } else if (opts[c] === 'Jogar fora') {
      const n = await ui.quantity(`Jogar fora quantos?`, S().bag[id]);
      if (n > 0) { useItem(id, n); ui.toast(`Você jogou fora ${n}× ${it.name}.`); layer.refresh(); }
    }
  });
}

function openBagPanel(pockets, onPick, onClose) {
  let pocket = pockets[0];
  const layer = ui.panel({
    title: 'Bolsa', sub: money(S().money), width: 'min(820px,96vw)',
    build: (body) => {
      body.innerHTML = `<div class="tabs"></div><div class="items scroll" style="max-height:56vh"></div><div class="desc-box">Escolha um item.</div>`;
      const tabs = body.querySelector('.tabs'), list = body.querySelector('.items'), desc = body.querySelector('.desc-box');
      const render = () => {
        tabs.innerHTML = pockets.map((p) => `<button class="tab ${p === pocket ? 'on' : ''}" data-p="${p}">${POCKET_PT[p]}</button>`).join('');
        tabs.querySelectorAll('.tab').forEach((b) => b.onclick = () => { pocket = b.dataset.p; audio.sfx('select'); render(); });
        const s = S();
        const ids = pocket === 'key' ? s.keyItems.slice() : Object.keys(s.bag).filter((id) => ITEMS[id] && ITEMS[id].pocket === pocket && s.bag[id] > 0);
        list.innerHTML = ids.length ? '' : '<div class="muted">Nenhum item aqui.</div>';
        for (const id of ids) {
          const it = ITEMS[id];
          const d = document.createElement('div');
          d.className = 'item';
          const q = pocket === 'key' ? (id === 'expshare' ? (s.expShareOn ? 'LIGADA' : 'DESLIGADA') : '') : '×' + s.bag[id];
          d.innerHTML = `<img src="${itemSprite(id)}" alt=""><span class="n">${esc(it.name)}</span><span class="q">${q}</span>`;
          d.onmouseenter = () => { desc.textContent = it.desc; };
          d.onclick = () => { audio.sfx('confirm'); onPick(id, layer); };
          list.appendChild(d);
        }
      };
      layer.refresh = render;
      render();
    },
    onKey: (k) => {
      const i = pockets.indexOf(pocket);
      if (k === 'left') { pocket = pockets[(i + pockets.length - 1) % pockets.length]; layer.refresh(); return true; }
      if (k === 'right') { pocket = pockets[(i + 1) % pockets.length]; layer.refresh(); return true; }
      return false;
    },
    onClose,
  });
  return layer;
}

// Usa um item fora de batalha. idx = índice na equipe (ou -1)
export async function useFieldItem(id, idx) {
  const s = S();
  const it = ITEMS[id];
  const mon = idx >= 0 ? s.party[idx] : null;
  if (it.pocket === 'key') {
    if (it.key === 'bike') { game.toggleBike(); return; }
    if (it.key === 'expshare') { s.expShareOn = !s.expShareOn; markDirty(); ui.toast(`Exp. Compartilhada ${s.expShareOn ? 'ligada' : 'desligada'}.`); return; }
    if (it.key === 'rod') { game.handlers.fish(); return; }
    return;
  }
  if (it.repel) {
    if (!useItem(id)) return;
    game.repel = it.repel;
    await ui.dialog(`Você usou ${it.name}. Pokémon selvagens fracos vão ficar longe!`);
    return;
  }
  if (it.escape) {
    const c = s.lastCenter;
    if (!c) { await ui.dialog('Você ainda não visitou nenhum Centro Pokémon.'); return; }
    if (!useItem(id)) return;
    await ui.dialog(`Você usou a ${it.name}!`);
    await game.teleport(c.x, c.y);
    return;
  }
  if (!mon) return;
  const name = monName(mon);
  const mh = maxHp(mon);
  if (it.revive) {
    if (mon.hp > 0) return ui.dialog('Não teria efeito.');
    useItem(id); mon.hp = Math.max(1, Math.floor(mh * it.revive)); mon.status = null;
    audio.sfx('heal'); markDirty(); return ui.dialog(`${name} foi revivido!`);
  }
  if (it.heal || it.cure) {
    if (mon.hp <= 0) return ui.dialog('Este Pokémon desmaiou. Use um Reviver.');
    let did = false;
    if (it.heal && mon.hp < mh) { mon.hp = Math.min(mh, mon.hp + it.heal); did = true; }
    if (it.cure && mon.status && (it.cure === 'all' || it.cure === mon.status || (it.cure === 'psn' && mon.status === 'tox'))) { mon.status = null; did = true; }
    if (!did) return ui.dialog('Não teria efeito.');
    useItem(id); audio.sfx('heal'); markDirty();
    return ui.dialog(`${name} foi tratado. PS: ${mon.hp}/${mh}`);
  }
  if (it.pp) {
    let mi = -1;
    if (!it.allPp) { mi = await pickMove(mon, 'Restaurar PP de qual golpe?'); if (mi < 0) return; }
    const list = it.allPp ? mon.moves : [mon.moves[mi]];
    if (!list.some((m) => m.pp < m.ppMax)) return ui.dialog('Não teria efeito.');
    for (const m of list) m.pp = Math.min(m.ppMax, m.pp + it.pp);
    useItem(id); audio.sfx('heal'); markDirty();
    return ui.dialog(`Os PP de ${name} foram restaurados.`);
  }
  if (it.candy) {
    if (mon.level >= 100) return ui.dialog('Não teria efeito.');
    useItem(id);
    const sp = POKEDEX[mon.species];
    const lv = gainExp(mon, expForLevel(sp.growth, mon.level + 1) - mon.exp);
    audio.sfx('levelup');
    await ui.dialog(`${name} subiu para o nível ${mon.level}!`);
    for (const L of lv) for (const mv of L.moves) await learnMoveFlow(mon, mv);
    const to = evolutionTarget(mon, { trigger: 'level', time: 'day' });
    if (to) await evolutionScene(mon, to);
    markDirty();
    return;
  }
  if (it.vitamin !== undefined) {
    if (!mon.evs) mon.evs = [0, 0, 0, 0, 0, 0];
    if (mon.evs[it.vitamin] >= 100) return ui.dialog('Não teria efeito.');
    useItem(id);
    mon.evs[it.vitamin] = Math.min(100, mon.evs[it.vitamin] + 10);
    mon.friendship = Math.min(255, (mon.friendship || 70) + 5);
    markDirty();
    return ui.dialog(`${STAT_PT[it.vitamin]} de ${name} aumentou!`);
  }
  if (it.friend) {
    useItem(id);
    mon.friendship = Math.min(255, (mon.friendship || 70) + it.friend);
    markDirty();
    await ui.dialog(`${name} adorou o petisco! Parece mais apegado a você.`);
    const to = evolutionTarget(mon, { trigger: 'level', time: 'day' });
    if (to && (mon.friendship >= 200)) await ui.dialog(`${name} parece pronto para evoluir quando subir de nível!`);
    return;
  }
  if (it.evo) {
    const to = evolutionTarget(mon, { trigger: 'item', item: id });
    if (!to) return ui.dialog('Não teria efeito.');
    useItem(id);
    await evolutionScene(mon, to, { cancelable: false });
    game.refreshFollower();
    return;
  }
  if (it.tm) {
    if (!POKEDEX[mon.species].tms.includes(it.tm)) return ui.dialog(`${name} não pode aprender ${MOVES[it.tm].name}.`);
    if (mon.moves.some((m) => m.id === it.tm)) return ui.dialog(`${name} já conhece ${MOVES[it.tm].name}.`);
    await learnMoveFlow(mon, it.tm);
    markDirty();
  }
}

// ------------------------------------------------------------ pokédex
export function openPokedex() {
  const s = S();
  const seen = new Set(s.dex.seen), caught = new Set(s.dex.caught);
  let filter = 'all';
  const layer = ui.panel({
    title: 'Pokédex', sub: `Vistos: ${seen.size} • Capturados: ${caught.size} / 386`, width: 'min(1000px,96vw)',
    build: (body) => {
      body.innerHTML = `<div class="row"><div class="tabs"><button class="tab on" data-f="all">Todos</button><button class="tab" data-f="caught">Capturados</button><button class="tab" data-f="missing">Faltando</button></div>
        <input class="grow" placeholder="Buscar por nome ou número..." style="border:2px solid var(--line);border-radius:10px;padding:8px 12px;font-weight:700"></div>
        <div class="dex-grid scroll" style="max-height:64vh"></div>`;
      const grid = body.querySelector('.dex-grid'), search = body.querySelector('input');
      const render = () => {
        const q = search.value.trim().toLowerCase();
        let html = '';
        for (let id = 1; id <= 386; id++) {
          const sp = POKEDEX[id];
          const isC = caught.has(id), isS = seen.has(id);
          if (filter === 'caught' && !isC) continue;
          if (filter === 'missing' && isC) continue;
          if (q && !(String(id).includes(q) || (isS && sp.name.toLowerCase().includes(q)))) continue;
          html += `<div class="dex-cell ${isC ? '' : isS ? 'seen' : 'unseen'}" data-id="${id}"><img loading="lazy" src="${spriteUrl.icon(id)}" alt="">#${String(id).padStart(3, '0')} ${isC ? '<span class="ball"></span>' : ''}<span>${isS ? esc(sp.name) : '???'}</span></div>`;
        }
        grid.innerHTML = html || '<div class="muted">Nada encontrado.</div>';
        grid.querySelectorAll('.dex-cell').forEach((c) => c.onclick = () => dexEntry(+c.dataset.id, seen.has(+c.dataset.id), caught.has(+c.dataset.id)));
      };
      body.querySelectorAll('.tab').forEach((b) => b.onclick = () => { filter = b.dataset.f; body.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === b)); render(); });
      search.oninput = render;
      render();
    },
  });
  return layer;
}

function dexEntry(id, seen, caught) {
  const sp = POKEDEX[id];
  const t = DEXTEXT[id];
  ui.panel({
    title: seen ? `#${String(id).padStart(3, '0')} ${esc(sp.name)}` : `#${String(id).padStart(3, '0')} ???`, width: 'min(760px,96vw)',
    build: (body) => {
      if (!seen) { body.innerHTML = '<div class="muted">Você ainda não encontrou este Pokémon. Explore o mundo!</div>'; return; }
      const locs = speciesLocations(id);
      const evoText = sp.evos.length ? sp.evos.map((e) => `${POKEDEX[e.to].name} (${e.kind === 'level' ? 'nível ' + e.level : e.kind === 'item' ? ITEMS[e.item]?.name || 'item' : e.kind === 'trade' ? (e.item ? 'troca segurando ' + (ITEMS[e.item]?.name || e.item) + ' ou usando o item' : 'troca ou Cabo de Conexão') : 'amizade' + (e.time ? (e.time === 'day' ? ' (de dia)' : ' (à noite)') : '')})`).join(', ') : 'Não evolui';
      body.innerHTML = `<div class="summary">
        <div class="sum-left">${monImg(id)}
          <div class="row">${sp.types.map(typeChip).join('')}</div>
          <div class="muted">${esc(t.genus)}</div>
          <div class="kv" style="width:100%"><span>Altura</span><span>${sp.height} m</span></div>
          <div class="kv" style="width:100%"><span>Peso</span><span>${sp.weight} kg</span></div>
          <div class="kv" style="width:100%"><span>Status</span><span>${caught ? 'Capturado ✔' : 'Visto'}</span></div></div>
        <div class="col">
          <div class="desc-box">${esc(t.text)}</div>
          ${caught ? `<div class="col" style="gap:5px">${STAT_PT.map((n, k) => `<div class="stat-row"><span>${n}</span><b>${sp.base[k]}</b><div class="b"><i style="width:${Math.min(100, sp.base[k] / 1.6)}%"></i></div></div>`).join('')}</div>` : ''}
          <div class="field"><span>Evolução</span><span class="muted">${esc(evoText)}</span></div>
          <div class="field"><span>Onde encontrar</span><span class="muted">${locs.length ? locs.map((l) => `${esc(l.zone)} (${{ grass: 'grama', water: 'água', cave: 'caverna' }[l.habitat]}${l.night ? ', à noite' : ''}, ${l.rarity})`).join(' • ') : sp.legendary ? 'Lendário: procure em lugares especiais do mapa...' : 'Não aparece na natureza — evolua ou troque!'}</span></div>
        </div></div>`;
    },
  });
}

// ------------------------------------------------------------ perfil
const BADGE_ICON = { roark: '🪨', gardenia: '🌿', maylene: '🥊', wake: '🌊', fantina: '👻', byron: '⚙️', candice: '❄️', volkner: '⚡' };
export function openTrainerCard() {
  const s = S();
  const hours = Math.floor(s.stats.playMs / 3600000), mins = Math.floor((s.stats.playMs % 3600000) / 60000);
  const since = new Date(s.stats.created || Date.now()).toLocaleDateString('pt-BR');
  ui.panel({
    title: 'Cartão de Treinador', width: 'min(760px,96vw)',
    build: (body) => {
      body.innerHTML = `<div class="tcard">
          <div class="tc-top"><span class="tc-label">CARTÃO DE TREINADOR</span><span class="tc-id">ID nº ${esc(s.tid || '—')}</span></div>
          <div class="tc-main">
            <div class="tc-info">
              <div class="tc-name">${esc(state.name)}</div>
              <div class="kv"><span>Dinheiro</span><span>${money(s.money)}</span></div>
              <div class="kv"><span>Pokédex</span><span>${s.dex.caught.length} capturados • ${s.dex.seen.length} vistos</span></div>
              <div class="kv"><span>Tempo de jogo</span><span>${hours}h ${mins}min</span></div>
              <div class="kv"><span>Passos</span><span>${s.stats.steps.toLocaleString('pt-BR')}</span></div>
              <div class="kv"><span>Batalhas • Vitórias PvP</span><span>${s.stats.battles} • ${s.stats.pvpWins}</span></div>
              <div class="kv"><span>Casas</span><span>${(s.houses || []).length}</span></div>
              <div class="kv"><span>Torre de Batalha</span><span>recorde ${(s.tower && s.tower.best) || 0} • ${s.bp || 0} BP</span></div>
              <div class="kv"><span>Aventura desde</span><span>${since}</span></div>
            </div>
            <div class="tc-photo"><canvas width="128" height="220"></canvas>${s.league.champion ? '<div class="tc-champ">🏆 Campeão</div>' : ''}</div>
          </div>
          <div class="tc-badges">${Object.entries(GYMS).map(([id, g]) => {
    const got = s.badges.includes(id);
    return `<div class="tc-badge ${got ? 'got' : ''}" title="${esc(g.badge)} — ${esc(g.name)}" style="${got ? `--bc:${g.color}` : ''}"><i><b>${got ? BADGE_ICON[id] || '★' : ''}</b></i><span>${got ? esc(g.badge.replace('Insígnia ', '')) : '???'}</span></div>`;
  }).join('')}</div>
        </div>`;
      drawPortrait(body.querySelector('canvas'), s.look, 2, 0);
    },
  });
}

// ------------------------------------------------------------ roupas
export async function openWardrobe() {
  const s = S();
  const look = await editLook(s.look, { title: 'Guarda-roupa', allowBody: false, allowHair: false, owned: s.wardrobe, confirmText: 'Vestir' });
  if (look) {
    s.look = look;
    markDirty();
    net.send({ t: 'look', look });
    ui.toast('Visual atualizado!', 'good');
  }
}

// ------------------------------------------------------------ opções
export function openOptions() {
  const s = S();
  const o = s.options;
  ui.panel({
    title: 'Opções', width: 'min(560px,96vw)',
    build: (body) => {
      const seg = (key, list, cur) => `<div class="seg">${list.map(([v, n]) => `<button class="${cur === v ? 'on' : ''}" data-${key}="${v}">${n}</button>`).join('')}</div>`;
      body.innerHTML = `<div class="opt-list">
        <div class="opt-row"><span>📝 Velocidade do texto</span>${seg('ts', [[0, 'Lenta'], [1, 'Normal'], [2, 'Rápida'], [3, 'Instant.']], o.textSpeed)}</div>
        <div class="opt-row"><span>🎵 Música <b class="mv">${Math.round(o.music * 100)}%</b></span><input class="range" type="range" min="0" max="1" step="0.05" value="${o.music}" data-k="music"></div>
        <div class="opt-row"><span>🔔 Efeitos sonoros <b class="sv">${Math.round(o.sfx * 100)}%</b></span><input class="range" type="range" min="0" max="1" step="0.05" value="${o.sfx}" data-k="sfx"></div>
        <div class="opt-row"><span>🔍 Zoom da câmera</span>${seg('z', [[0.75, 'Longe'], [1, 'Normal'], [1.25, 'Perto'], [1.5, 'Bem perto']], o.zoom || 1)}</div>
        <div class="opt-row"><span>🏃 Correr sempre</span>${seg('ar', [[1, 'Sim'], [0, 'Não']], o.autoRun ? 1 : 0)}</div>
        <div class="opt-row"><span>⌨️ Teclas</span><button class="btn small" data-a="controls">Ver e trocar controles</button></div>
      </div>
      <div class="row" style="justify-content:space-between"><button class="btn small" data-a="logout">Sair da conta</button><span class="muted">Pokémon Freedom • projeto de fã</span></div>`;
      const refresh = () => { markDirty(); };
      const segPick = (attr, fn) => body.querySelectorAll(`[data-${attr}]`).forEach((b) => b.onclick = () => {
        fn(b.dataset[attr]);
        body.querySelectorAll(`[data-${attr}]`).forEach((x) => x.classList.toggle('on', x === b));
        audio.sfx('select');
        refresh();
      });
      segPick('ts', (v) => { o.textSpeed = +v; });
      segPick('z', (v) => { o.zoom = +v; game.renderer.setZoom(o.zoom); });
      segPick('ar', (v) => { o.autoRun = v === '1'; });
      const paintRange = (r) => r.style.setProperty('--p', `${r.value * 100}%`);
      body.querySelectorAll('input[type=range]').forEach((r) => {
        paintRange(r);
        r.oninput = () => {
          o[r.dataset.k] = +r.value;
          paintRange(r);
          body.querySelector(r.dataset.k === 'music' ? '.mv' : '.sv').textContent = Math.round(r.value * 100) + '%';
          audio.setVolumes(o.music, o.sfx);
          refresh();
        };
      });
      body.querySelector('[data-a=controls]').onclick = () => game.handlers.openControls();
      body.querySelector('[data-a=logout]').onclick = () => {
        game.storePos(); saveNow();
        try { localStorage.removeItem('pkonline_token'); } catch { /* sem storage */ }
        setTimeout(() => location.reload(), 300);
      };
    },
  });
}

export { healParty, addItem, tryLearn, makeMove, TYPE_PT };
