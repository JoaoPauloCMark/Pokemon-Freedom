// Casas: compra, imobiliária e editor de decoração.
import { ui, esc, money } from './ui.js';
import { audio } from '../audio.js';
import { input, DXY } from '../input.js';
import { net } from '../net.js';
import { S, state, markDirty, addMoney } from '../state.js';
import { BUILDINGS } from '../../shared/world/defs.js';
import { FURNITURE, FLOORS, WALLS, FURN_CATS, housePrice, HOUSE_SIZES } from '../../shared/data/furniture.js';
import { canPlaceFurniture } from '../../shared/world/interiors.js';
import { furnitureIcon } from '../render/sprites.js';
import { TS } from '../render/terrain.js';

const SIZE_PT = { s: 'Casa Pequena', m: 'Casa Média', l: 'Casarão', x: 'Mansão com Piscina', xl: 'Mansão de Luxo' };

function waitHouseReply(plotId) {
  return new Promise((resolve) => {
    const onHouse = (m) => { if (m.plotId === plotId) done(m); };
    const onErr = (m) => done({ error: m.text });
    const t = setTimeout(() => done({ error: 'O servidor não respondeu.' }), 6000);
    net.on('house', onHouse); net.on('error', onErr);
    function done(v) { clearTimeout(t); net.off('house', onHouse); net.off('error', onErr); resolve(v); }
  });
}

export async function buyHouse(b, game) {
  const size = BUILDINGS[b.type].plot;
  const price = housePrice(b.city, size);
  const city = game.world.cities.find((c) => c.id === b.city);
  const H = HOUSE_SIZES[size];
  await ui.dialog(`${SIZE_PT[size]} em ${city.name} (interior ${H.w}×${H.h}). Preço: ${money(price)}.`);
  if (!(await ui.ask('Quer comprar esta casa?'))) return false;
  if (S().money < price) { await ui.dialog('Você não tem dinheiro suficiente. Batalhe com treinadores e líderes para ganhar mais!'); return false; }
  game.storePos();
  net.send({ t: 'save', save: S() });
  net.send({ t: 'buyHouse', plotId: b.plotId });
  const r = await waitHouseReply(b.plotId);
  if (r.error) { await ui.dialog(r.error); return false; }
  audio.sfx('caught');
  await ui.dialog(['Parabéns! A casa agora é sua!', 'Lá dentro, pressione E para decorar com seus móveis.']);
  return true;
}

export async function plotDoor(b, game) {
  const h = state.houses[b.plotId];
  if (!h) {
    const bought = await buyHouse(b, game);
    if (bought) await game.enterBuilding(b);
    return;
  }
  const mine = h.owner === state.accountKey;
  if (!mine && h.locked) { await ui.dialog(`A porta está trancada. Esta é a casa de ${h.ownerName}.`); return; }
  await game.enterBuilding(b);
  if (!mine) ui.toast(`Você está visitando a casa de ${h.ownerName}.`);
}

// ------------------------------------------------------------ Imobiliária
export function openRealty(game) {
  return new Promise((resolve) => {
    const plots = game.world.buildings.filter((b) => b.plotId);
    const layer = ui.panel({
      title: 'Imobiliária de Sinnoh', width: 'min(900px,96vw)', onClose: resolve,
      build: (body) => {
        const render = () => {
          const myName = state.accountKey;
          body.innerHTML = `<div class="muted">Casas disponíveis em toda a região. Você pode comprar daqui ou pela porta da própria casa. Vender devolve 50% do valor.</div>
            <div class="items scroll" style="max-height:62vh;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))"></div><b>Seu dinheiro: ${money(S().money)}</b>`;
          const list = body.querySelector('.items');
          for (const b of plots) {
            const h = state.houses[b.plotId];
            const size = BUILDINGS[b.type].plot;
            const price = housePrice(b.city, size);
            const city = game.world.cities.find((c) => c.id === b.city);
            const d = document.createElement('div');
            d.className = 'item';
            const mine = h && h.owner === myName;
            d.innerHTML = `<span style="font-size:24px">${mine ? '🏡' : h ? '🏠' : '🪧'}</span><span class="nm2"><b>${esc(city.name)}</b><small>${SIZE_PT[size]} • ${h ? (mine ? 'Sua casa' : 'Dono: ' + esc(h.ownerName)) : 'À venda'}</small></span><span class="p">${h ? '' : price.toLocaleString('pt-BR')}</span>`;
            d.onclick = async () => {
              if (!h) {
                const bought = await buyHouse(b, game);
                if (bought) render();
              } else if (mine) {
                const c = await ui.choice(`Sua casa em ${city.name}.`, ['Vender (50%)', 'Cancelar']);
                if (c === 0 && await ui.ask(`Vender por ${money(Math.floor(price / 2))}? Os móveis voltam para o seu inventário.`)) {
                  // envia o save atual antes, para o servidor não usar dinheiro/inventário antigos
                  game.storePos();
                  net.send({ t: 'save', save: S() });
                  net.send({ t: 'sellHouse', plotId: b.plotId });
                  const r = await waitHouseReply(b.plotId);
                  if (r.error || r.data) ui.toast(r.error || 'Não foi possível vender a casa.', 'bad');
                  else ui.toast('Casa vendida.', 'good');
                  render();
                }
              } else ui.toast(`Esta casa pertence a ${h.ownerName}.`);
            };
            list.appendChild(d);
          }
        };
        render();
      },
    });
  });
}

// ------------------------------------------------------------ Modo Decoração (estilo The Sims)
// Inventário (o que você já tem), Catálogo (compra direto daqui e já coloca)
// e Estilo (piso, parede, telhado e porta). Mover/guardar móveis com o mouse.
export function openHouseEditor(game) {
  const b = game.building;
  const h = b && b.plotId ? state.houses[b.plotId] : null;
  if (!h || h.owner !== state.accountKey) { ui.toast('Você só pode decorar a sua própria casa.'); return; }
  const s = S();
  s.furnitureInv ||= {};
  const furniture = (h.furniture || []).map((f) => ({ ...f }));
  const ed = { item: null, held: null, tool: 'place', cursor: { x: game.player.x, y: Math.max(2, game.player.y - 1) } };
  let tab = 'inv', cat = 'all', query = '';
  let saveTimer = null;
  const persist = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      net.send({ t: 'houseSave', plotId: b.plotId, furniture, floor: h.floor, wall: h.wall, locked: h.locked, roof: h.roof });
      net.send({ t: 'save', save: s });
    }, 400);
  };
  const apply = () => {
    h.furniture = furniture.map((f) => ({ ...f }));
    state.houses[b.plotId] = h;
    game.rebuildInterior();
    markDirty();
    persist();
  };
  const interior = () => game.interior;
  const placing = () => ed.held || ed.item;
  ed.sceneInfo = () => {
    const out = { cursor: ed.cursor };
    const id = placing();
    if (id && ed.tool === 'place') {
      const f = FURNITURE[id];
      const x = ed.cursor.x, y = ed.cursor.y;
      out.ghost = { item: id, x, y, w: f.w, h: f.h, ok: canPlaceFurniture(interior(), id, x, y, -1, furniture) };
    }
    return out;
  };
  game.editor = ed;

  const dock = document.createElement('div');
  dock.className = 'decor';
  const layer = { el: dock };
  const invIds = () => Object.keys(s.furnitureInv).filter((id) => s.furnitureInv[id] > 0 && FURNITURE[id]);
  const matches = (id) => {
    const f = FURNITURE[id];
    if (cat !== 'all' && f.cat !== cat) return false;
    return !query || f.name.toLowerCase().includes(query.toLowerCase());
  };
  const hint = () => {
    if (ed.tool === 'move') return ed.held ? `Segurando: <b>${esc(FURNITURE[ed.held].name)}</b> — clique onde quer colocar` : '✋ Clique num móvel da casa para mudar de lugar';
    if (ed.tool === 'store') return '📦 Clique num móvel para guardar no inventário';
    if (placing()) return `Colocando: <b>${esc(FURNITURE[placing()].name)}</b> — clique no chão (verde = cabe)`;
    return tab === 'cat' ? 'Escolha um móvel do catálogo: ele é comprado e já fica pronto para colocar' : 'Escolha um móvel do inventário e clique no chão da casa';
  };
  const render = () => {
    const inv = invIds();
    dock.innerHTML = `<div class="decor-top">
        <b class="decor-title">🛋️ Modo Decoração</b>
        <div class="seg"><button class="${tab === 'inv' ? 'on' : ''}" data-tab="inv">Inventário (${inv.reduce((a, id) => a + s.furnitureInv[id], 0)})</button><button class="${tab === 'cat' ? 'on' : ''}" data-tab="cat">Catálogo</button><button class="${tab === 'style' ? 'on' : ''}" data-tab="style">Estilo da casa</button></div>
        <div class="grow"></div>
        <button class="btn small ${ed.tool === 'move' ? 'blue' : ''}" data-tool="move">✋ Mover</button>
        <button class="btn small ${ed.tool === 'store' ? 'red' : ''}" data-tool="store">📦 Guardar</button>
        <span class="decor-money">${money(s.money)}</span>
        <button class="btn small green" data-a="done">✔ Concluir</button>
      </div>
      <div class="decor-hint">${hint()}</div>
      ${tab === 'style' ? styleHtml() : `<div class="decor-filters"><input class="decor-q" placeholder="Buscar..." value="${esc(query)}"><div class="decor-cats">${[['all', '✨', 'Tudo'], ...FURN_CATS].map(([id, ic, n]) => `<button class="${cat === id ? 'on' : ''}" data-cat="${id}" title="${n}">${ic} <span>${n}</span></button>`).join('')}</div></div><div class="decor-items"></div>`}`;
    dock.querySelectorAll('[data-tab]').forEach((x) => x.onclick = () => { tab = x.dataset.tab; audio.sfx('select'); render(); });
    dock.querySelectorAll('[data-tool]').forEach((x) => x.onclick = () => {
      const t = x.dataset.tool;
      if (ed.held) returnHeld();
      ed.tool = ed.tool === t ? 'place' : t;
      ed.item = null;
      audio.sfx('select');
      render();
    });
    dock.querySelector('[data-a=done]').onclick = close;
    if (tab === 'style') return bindStyle();
    const q = dock.querySelector('.decor-q');
    q.oninput = () => { query = q.value; paintItems(); };
    q.addEventListener('keydown', (e) => e.stopPropagation());
    dock.querySelectorAll('[data-cat]').forEach((x) => x.onclick = () => { cat = x.dataset.cat; audio.sfx('select'); render(); });
    paintItems();
  };
  const paintItems = () => {
    const list = dock.querySelector('.decor-items');
    if (!list) return;
    list.innerHTML = '';
    const ids = tab === 'inv' ? invIds().filter(matches) : Object.keys(FURNITURE).filter(matches);
    if (!ids.length) {
      list.innerHTML = `<div class="muted decor-empty">${tab === 'inv' ? 'Nada aqui no inventário. Abra o <b>Catálogo</b> para comprar, ou visite uma Loja de Móveis.' : 'Nenhum móvel encontrado.'}</div>`;
      return;
    }
    for (const id of ids.slice(0, 160)) {
      const f = FURNITURE[id];
      const d = document.createElement('button');
      d.className = 'decor-item' + (ed.item === id ? ' sel' : '');
      d.title = `${f.name} (${f.w}×${f.h}${f.wall ? ', parede' : f.walk ? ', tapete' : ''})`;
      d.appendChild(furnitureIcon(id, 48));
      d.insertAdjacentHTML('beforeend', `<span class="nm">${esc(f.name)}</span><span class="q">${tab === 'inv' ? '×' + s.furnitureInv[id] : money(f.price)}</span>`);
      d.onclick = async () => {
        if (ed.held) returnHeld();
        ed.tool = 'place';
        if (tab === 'cat') {
          if (s.money < f.price) { audio.sfx('bump'); ui.toast('Dinheiro insuficiente!', 'bad'); return; }
          addMoney(-f.price);
          s.furnitureInv[id] = (s.furnitureInv[id] || 0) + 1;
          audio.sfx('buy');
          ui.toast(`Comprado: ${f.name}. Clique no chão para colocar!`, 'good');
          markDirty();
        }
        ed.item = ed.item === id && tab === 'inv' ? null : id;
        render();
      };
      list.appendChild(d);
    }
  };
  const styleHtml = () => {
    const sw = (t, kind, id, f, owned) => `<button class="decor-style ${h[kind] === id ? 'sel' : ''}" data-${kind}="${id}"><i style="background:linear-gradient(135deg,${f.a} 50%,${f.b} 50%)"></i><span>${esc(f.name)}</span><small>${owned ? (h[kind] === id ? 'em uso' : 'seu') : money(f.price)}</small></button>`;
    const roofs = [['Vermelho', '#c9573d'], ['Azul', '#4f7cc2'], ['Verde', '#4f9a54'], ['Roxo', '#7b52c2'], ['Rosa', '#e07aa8'], ['Marrom', '#8d6a4a'], ['Preto', '#3a3a44'], ['Laranja', '#e08a3a']];
    return `<div class="decor-style-wrap">
      <div><div class="le-h">Piso</div><div class="decor-styles">${Object.entries(FLOORS).map(([id, f]) => sw('floor', 'floor', id, f, s.floorsOwned.includes(id))).join('')}</div></div>
      <div><div class="le-h">Parede</div><div class="decor-styles">${Object.entries(WALLS).map(([id, f]) => sw('wall', 'wall', id, f, s.wallsOwned.includes(id))).join('')}</div></div>
      <div class="row" style="flex-wrap:wrap"><div class="le-h">Telhado</div>${roofs.map(([n, c]) => `<button class="le-sw ${h.roof === c ? 'on' : ''}" data-roof="${c}" title="${n}" style="background:${c}"></button>`).join('')}
        <div class="grow"></div><button class="btn small" data-a="lock">${h.locked ? '🔒 Porta trancada' : '🔓 Porta aberta'}</button></div></div>`;
  };
  const bindStyle = () => {
    const buyOrUse = async (kind, id) => {
      const owned = kind === 'floor' ? s.floorsOwned : s.wallsOwned;
      const table = kind === 'floor' ? FLOORS : WALLS;
      if (!owned.includes(id)) {
        if (s.money < table[id].price) { audio.sfx('bump'); ui.toast('Dinheiro insuficiente!', 'bad'); return; }
        if (!(await ui.ask(`Comprar ${table[id].name} por ${money(table[id].price)}?`))) return;
        addMoney(-table[id].price);
        owned.push(id);
        audio.sfx('buy');
      }
      h[kind] = id;
      apply();
      render();
    };
    dock.querySelectorAll('[data-floor]').forEach((x) => x.onclick = () => buyOrUse('floor', x.dataset.floor));
    dock.querySelectorAll('[data-wall]').forEach((x) => x.onclick = () => buyOrUse('wall', x.dataset.wall));
    dock.querySelectorAll('[data-roof]').forEach((x) => x.onclick = () => { h.roof = x.dataset.roof; apply(); audio.sfx('select'); render(); });
    dock.querySelector('[data-a=lock]').onclick = () => { h.locked = !h.locked; apply(); render(); };
  };
  const furnitureAt = (x, y) => {
    for (let i = furniture.length - 1; i >= 0; i--) {
      const f = furniture[i], d = FURNITURE[f.id];
      if (d && x >= f.x && x < f.x + d.w && y >= f.y && y < f.y + d.h) return i;
    }
    return -1;
  };
  const returnHeld = () => {
    if (!ed.held) return;
    s.furnitureInv[ed.held] = (s.furnitureInv[ed.held] || 0) + 1;
    ed.held = null;
    markDirty();
  };
  const act = () => {
    const { x, y } = ed.cursor;
    if (ed.tool === 'store' || (ed.tool === 'move' && !ed.held)) {
      const i = furnitureAt(x, y);
      if (i < 0) return;
      const f = furniture.splice(i, 1)[0];
      if (ed.tool === 'store') { s.furnitureInv[f.id] = (s.furnitureInv[f.id] || 0) + 1; audio.sfx('cancel'); }
      else { ed.held = f.id; audio.sfx('select'); }
      apply(); render();
      return;
    }
    const id = placing();
    if (!id) return;
    if (!ed.held && (s.furnitureInv[id] || 0) <= 0) { ed.item = null; render(); return; }
    if (!canPlaceFurniture(interior(), id, x, y, -1, furniture)) { audio.sfx('bump'); return; }
    const d = FURNITURE[id];
    const p = game.player;
    if (!d.walk && !d.wall && p.x >= x && p.x < x + d.w && p.y >= y && p.y < y + d.h) { ui.toast('Saia de onde quer colocar o móvel.'); return; }
    furniture.push({ id, x, y });
    if (ed.held) ed.held = null;
    else {
      s.furnitureInv[id]--;
      if (s.furnitureInv[id] <= 0) { delete s.furnitureInv[id]; ed.item = null; }
    }
    audio.sfx('confirm');
    apply(); render();
  };
  layer.onKey = (k) => {
    const m = interior();
    const dirs = { up: 0, right: 1, down: 2, left: 3 };
    if (dirs[k] !== undefined) {
      const [dx, dy] = DXY[dirs[k]];
      ed.cursor.x = Math.max(0, Math.min(m.w - 1, ed.cursor.x + dx));
      ed.cursor.y = Math.max(0, Math.min(m.h - 1, ed.cursor.y + dy));
    } else if (k === 'a') act();
    else if (k === 'b') {
      if (ed.held) { returnHeld(); render(); } else if (ed.item || ed.tool !== 'place') { ed.item = null; ed.tool = 'place'; render(); } else close();
    } else if (k === 'enter') close();
  };
  // mouse
  const canvas = game.renderer.canvas;
  const toTile = (e) => {
    const r = game.renderer;
    const wx = (e.clientX - r.vw / 2) / (r.zoomNow || r.zoom) + r.cam.x;
    const wy = (e.clientY - r.vh / 2) / (r.zoomNow || r.zoom) + r.cam.y;
    return { x: Math.floor(wx / TS), y: Math.floor(wy / TS) };
  };
  const onMove = (e) => {
    const t = toTile(e);
    const m = interior();
    ed.cursor.x = Math.max(0, Math.min(m.w - 1, t.x));
    ed.cursor.y = Math.max(0, Math.min(m.h - 1, t.y));
  };
  const onClick = (e) => { onMove(e); act(); };
  const onCtx = (e) => { e.preventDefault(); layer.onKey('b'); };
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('contextmenu', onCtx);
  function close() {
    returnHeld();
    canvas.removeEventListener('mousemove', onMove);
    canvas.removeEventListener('click', onClick);
    canvas.removeEventListener('contextmenu', onCtx);
    game.editor = null;
    ui.pop(layer);
    state.houses[b.plotId] = h;
    game.rebuildInterior();
    clearTimeout(saveTimer);
    net.send({ t: 'houseSave', plotId: b.plotId, furniture, floor: h.floor, wall: h.wall, locked: h.locked, roof: h.roof });
    net.send({ t: 'save', save: s });
    ui.toast('Decoração salva!', 'good');
  }
  layer.close = close;
  ui.push(layer);
  render();
  void input;
}

// ------------------------------------------------------------ Minhas casas e inventário de móveis
export function openHome(game) {
  const s = S();
  const mine = Object.entries(state.houses).filter(([, h]) => h && h.owner === state.accountKey);
  let cat = 'all';
  ui.panel({
    title: 'Minhas Casas e Móveis', width: 'min(900px,96vw)',
    build: (body, L) => {
      const render = () => {
        const inv = Object.keys(s.furnitureInv || {}).filter((id) => s.furnitureInv[id] > 0 && FURNITURE[id] && (cat === 'all' || FURNITURE[id].cat === cat));
        body.innerHTML = `<div class="le-h">🏠 Suas casas (${mine.length})</div>
          <div class="home-list">${mine.length ? mine.map(([plotId, h]) => {
    const bb = game.world.buildings.find((x) => x.plotId === plotId);
    const city = bb ? game.world.cities.find((c) => c.id === bb.city) : null;
    return `<div class="home-card"><span class="hic">🏡</span><div class="grow"><b>${esc(city ? city.name : plotId)}</b><small>${SIZE_PT[BUILDINGS[bb ? bb.type : 'plot_s'].plot] || 'Casa'} • ${(h.furniture || []).length} móveis • ${h.locked ? '🔒 trancada' : '🔓 aberta'}</small></div>
              <button class="btn small blue" data-go="${esc(plotId)}">✈ Ir para casa</button></div>`;
  }).join('') : '<div class="muted">Você ainda não tem casa. Compre pela Imobiliária ou na porta de uma casa à venda (as mansões ficam no Condomínio Bela Vista).</div>'}</div>
          <div class="le-h">📦 Inventário de móveis</div>
          <div class="decor-cats">${[['all', '✨', 'Tudo'], ...FURN_CATS].map(([id, ic, n]) => `<button class="${cat === id ? 'on' : ''}" data-cat="${id}">${ic} <span>${n}</span></button>`).join('')}</div>
          <div class="home-inv"></div>
          <div class="desc-box">Para decorar: entre na sua casa e toque em <b>🛋️ Decorar</b> (ou aperte E). No modo decoração você também pode comprar móveis pelo Catálogo.</div>`;
        const grid = body.querySelector('.home-inv');
        if (!inv.length) grid.innerHTML = '<div class="muted">Nenhum móvel guardado aqui.</div>';
        for (const id of inv) {
          const d = document.createElement('div');
          d.className = 'decor-item';
          d.appendChild(furnitureIcon(id, 48));
          d.insertAdjacentHTML('beforeend', `<span class="nm">${esc(FURNITURE[id].name)}</span><span class="q">×${s.furnitureInv[id]}</span>`);
          grid.appendChild(d);
        }
        body.querySelectorAll('[data-cat]').forEach((x) => x.onclick = () => { cat = x.dataset.cat; render(); });
        body.querySelectorAll('[data-go]').forEach((x) => x.onclick = async () => {
          const bb = game.world.buildings.find((y) => y.plotId === x.dataset.go);
          if (!bb) return;
          L.close();
          // vai direto para dentro da casa
          await game.teleport(bb.doorX, bb.doorY + 1);
          game.player.dir = 0;
          await game.enterBuilding(bb);
        });
      };
      render();
    },
  });
}
