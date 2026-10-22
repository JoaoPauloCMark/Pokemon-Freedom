// Lojas: Poké Mart, Loja de Departamentos, Boutique, Salão e Loja de Móveis.
import { ui, esc, money } from './ui.js';
import { audio } from '../audio.js';
import { S, addItem, addMoney, useItem, markDirty } from '../state.js';
import { ITEMS, itemSprite, MART_BASIC, MART_ADVANCED, MART_SPECIAL_BALLS, MART_STONES, MART_EVO_ITEMS, MART_VITAMINS, MART_DRINKS, TM_MOVES } from '../../shared/data/items.js';
import { CLOTHES, boutiqueStock } from '../../shared/data/clothes.js';
import { FURNITURE, FLOORS, WALLS, FURN_CATS, furnitureStock } from '../../shared/data/furniture.js';
import { furnitureIcon } from '../render/sprites.js';
import { editLook, shopLook } from './creator.js';
import { net } from '../net.js';
import { POKEDEX } from '../../shared/data/pokedex.js';

const CITY_TIER = { twinleaf: 1, sandgem: 1, jubilife: 2, canalave: 3, oreburgh: 2, floaroma: 2, eterna: 3, hearthome: 4, solaceon: 5, celestic: 5, veilstone: 6, pastoria: 6, sunyshore: 7, snowpoint: 7, league: 8 };
const CITY_BALLS = {
  canalave: ['redebola', 'mergulhobola'], pastoria: ['redebola', 'mergulhobola'], solaceon: ['crepusculobola', 'ninhobola'],
  hearthome: ['curabola', 'luxobola'], snowpoint: ['tempobola', 'repetebola'], sunyshore: ['rapidabola', 'ninhobola'],
  eterna: ['ninhobola'], celestic: ['crepusculobola'], league: MART_SPECIAL_BALLS,
};

export function martStock(city, kind = 'mart') {
  if (kind === 'dept_tm') return TM_MOVES.map((m) => 'mt_' + m).filter((id) => ITEMS[id]);
  if (kind === 'dept_evo') return [...MART_STONES, ...MART_EVO_ITEMS];
  if (kind === 'dept_basic') return [...MART_BASIC, ...MART_ADVANCED, ...MART_SPECIAL_BALLS, ...MART_DRINKS, ...MART_VITAMINS];
  const tier = CITY_TIER[city] || 1;
  let list = [...MART_BASIC];
  if (tier >= 3) list.push('superrepelente', 'reviver', 'curatotal');
  if (tier >= 4) list.push('ultrabola', 'hiperpocao', 'eter');
  if (tier >= 6) list.push('pocaomaxima', 'restauracao', 'repelentemax', 'elixir');
  if (CITY_BALLS[city]) list.push(...CITY_BALLS[city]);
  if (city === 'sunyshore' || city === 'hearthome') list.push(...MART_DRINKS);
  if (city === 'floaroma' || city === 'pastoria' || city === 'eterna') list.push('mel');
  if (city === 'league') list.push(...MART_ADVANCED, 'docerarro', 'revivermax');
  return [...new Set(list)];
}

// ------------------------------------------------------------ Poké Mart
export function openMart(city, kind = 'mart', title = 'Poké Mart') {
  return new Promise((resolve) => {
    let tab = 'buy';
    const stock = martStock(city, kind);
    const layer = ui.panel({
      title, sub: '', width: 'min(860px,96vw)', onClose: resolve,
      build: (body) => {
        const render = () => {
          const s = S();
          layer.el.querySelector('.sub') ? null : null;
          body.innerHTML = `<div class="row"><div class="tabs"><button class="tab ${tab === 'buy' ? 'on' : ''}" data-t="buy">Comprar</button><button class="tab ${tab === 'sell' ? 'on' : ''}" data-t="sell">Vender</button></div><div class="grow"></div><b>Seu dinheiro: ${money(s.money)}</b></div>
            <div class="items scroll" style="max-height:56vh"></div><div class="desc-box">Escolha um item.</div>`;
          body.querySelectorAll('.tab').forEach((b) => b.onclick = () => { tab = b.dataset.t; render(); });
          const list = body.querySelector('.items'), desc = body.querySelector('.desc-box');
          const ids = tab === 'buy' ? stock : Object.keys(s.bag).filter((id) => ITEMS[id] && ITEMS[id].price > 0 && s.bag[id] > 0);
          if (!ids.length) list.innerHTML = '<div class="muted">Nada para vender.</div>';
          for (const id of ids) {
            const it = ITEMS[id];
            const price = tab === 'buy' ? it.price : Math.floor(it.price / 2);
            const d = document.createElement('div');
            d.className = 'item';
            d.innerHTML = `<img src="${itemSprite(id)}" alt=""><span class="n">${esc(it.name)}</span>${tab === 'sell' ? `<span class="q">×${s.bag[id]}</span>` : `<span class="q">${s.bag[id] ? '×' + s.bag[id] : ''}</span>`}<span class="p">${price.toLocaleString('pt-BR')}</span>`;
            d.onmouseenter = () => { desc.textContent = it.desc + (it.tm ? ' ' + tmCompat(it.tm) : ''); };
            d.onclick = async () => {
              if (tab === 'buy') {
                const max = Math.min(99, Math.floor(S().money / price));
                if (max < 1) { audio.sfx('bump'); ui.toast('Dinheiro insuficiente!', 'bad'); return; }
                const n = it.tm ? (S().bag[id] ? 0 : 1) : await ui.quantity(`Comprar ${it.name}`, max, price);
                if (it.tm && S().bag[id]) { ui.toast('Você já tem esta MT (ela pode ser usada várias vezes).'); return; }
                if (n > 0) {
                  addMoney(-n * price); addItem(id, n); audio.sfx('buy');
                  ui.toast(`Você comprou ${n}× ${it.name}!`, 'good');
                  if (id === 'pokebola' && n >= 10) { addItem('premierbola', Math.floor(n / 10)); ui.toast('Brinde: Premier Bola!', 'good'); }
                }
              } else {
                const n = await ui.quantity(`Vender ${it.name}`, S().bag[id], price);
                if (n > 0) { useItem(id, n); addMoney(n * price); audio.sfx('money'); ui.toast(`Você vendeu ${n}× ${it.name} por ${money(n * price)}.`, 'good'); }
              }
              render();
            };
            list.appendChild(d);
          }
        };
        render();
      },
    });
  });
}

function tmCompat(move) {
  const party = S().party;
  if (!party.length) return '';
  const can = party.filter((m) => POKEDEX[m.species].tms.includes(move)).map((m) => m.nick || POKEDEX[m.species].name);
  return can.length ? `Pode ser aprendida por: ${can.join(', ')}.` : 'Ninguém da sua equipe pode aprender.';
}

// ------------------------------------------------------------ Boutique
export function openBoutique(city) {
  return shopLook({
    title: 'Boutique',
    stock: boutiqueStock(city),
    getLook: () => S().look,
    wardrobe: () => S().wardrobe,
    money: () => S().money,
    buy: async (id) => {
      const s = S();
      const c = CLOTHES[id];
      if (s.money < c.price) { audio.sfx('bump'); ui.toast('Dinheiro insuficiente!', 'bad'); return false; }
      if (!(await ui.ask(`Comprar ${c.name} por ${money(c.price)}?`))) return false;
      addMoney(-c.price);
      s.wardrobe.push(id);
      audio.sfx('buy');
      markDirty();
      return true;
    },
    wear: (id) => {
      const s = S();
      const c = CLOTHES[id];
      s.look = { ...s.look, [c.slot]: id };
      markDirty();
      net.send({ t: 'look', look: s.look });
      ui.toast(`Você está vestindo ${c.name}!`, 'good');
    },
  });
}

// ------------------------------------------------------------ Salão
export async function openSalon() {
  const s = S();
  const price = 500;
  const ok = await ui.ask(`Bem-vindo ao salão! Um novo visual custa ${money(price)}. Quer mudar o cabelo?`, { who: 'Cabeleireira' });
  if (!ok) return;
  if (s.money < price) { await ui.dialog('Ah, parece que falta dinheiro...', { who: 'Cabeleireira' }); return; }
  const look = await editLook(s.look, { title: 'Salão de Beleza', allowBody: true, allowHair: true, allowClothes: false, confirmText: 'Ficou ótimo!' });
  if (!look) return;
  addMoney(-price);
  s.look = look;
  markDirty();
  net.send({ t: 'look', look });
  audio.sfx('buy');
  await ui.dialog('Ficou lindo! Volte sempre!', { who: 'Cabeleireira' });
}

// ------------------------------------------------------------ Loja de Móveis
export function openFurnitureShop(city) {
  return new Promise((resolve) => {
    const stock = furnitureStock(city);
    const cats = FURN_CATS.filter(([id]) => stock.some((x) => FURNITURE[x].cat === id));
    let tab = cats[0] ? cats[0][0] : 'floor';
    let query = '';
    ui.panel({
      title: city === 'condominio' ? 'Decor Luxo' : 'Loja de Móveis', width: 'min(1000px,96vw)', onClose: resolve,
      build: (body) => {
        const render = () => {
          const s = S();
          const isStyle = tab === 'floor' || tab === 'wall';
          body.innerHTML = `<div class="row shop-head"><div class="decor-cats">${cats.map(([id, ic, n]) => `<button class="${tab === id ? 'on' : ''}" data-t="${id}">${ic} <span>${n}</span></button>`).join('')}
              <button class="${tab === 'floor' ? 'on' : ''}" data-t="floor">🟫 <span>Pisos</span></button><button class="${tab === 'wall' ? 'on' : ''}" data-t="wall">🧱 <span>Paredes</span></button></div></div>
            <div class="row"><input class="decor-q" placeholder="Buscar móvel..." value="${esc(query)}" ${isStyle ? 'style="display:none"' : ''}><div class="grow"></div><b>Seu dinheiro: ${money(s.money)}</b></div>
            <div class="shop-grid scroll"></div>
            <div class="desc-box">📦 Tudo o que você compra vai para o seu <b>inventário</b> (Menu → Casas). Na sua casa, toque em <b>🛋️ Decorar casa</b> para colocar os móveis onde quiser.</div>`;
          body.querySelectorAll('[data-t]').forEach((b) => b.onclick = () => { tab = b.dataset.t; audio.sfx('select'); render(); });
          const q = body.querySelector('.decor-q');
          q.oninput = () => { query = q.value; paint(); };
          q.addEventListener('keydown', (e) => e.stopPropagation());
          const paint = () => {
            const list = body.querySelector('.shop-grid');
            list.innerHTML = '';
            if (!isStyle) {
              const ids = stock.filter((x) => FURNITURE[x].cat === tab && (!query || FURNITURE[x].name.toLowerCase().includes(query.toLowerCase())));
              for (const id of ids) {
                const f = FURNITURE[id];
                const d = document.createElement('button');
                d.className = 'decor-item shop-card';
                d.title = `${f.name} • ${f.w}×${f.h}${f.walk ? ' • tapete' : f.wall ? ' • vai na parede' : ''}`;
                d.appendChild(furnitureIcon(id, 60));
                d.insertAdjacentHTML('beforeend', `<span class="nm">${esc(f.name)}</span><small>${f.w}×${f.h}${f.walk ? ' • tapete' : f.wall ? ' • parede' : ''}${s.furnitureInv[id] ? ` • tem ${s.furnitureInv[id]}` : ''}</small><span class="q price">${money(f.price)}</span>`);
                d.onclick = async () => {
                  if (S().money < f.price) { audio.sfx('bump'); ui.toast('Dinheiro insuficiente!', 'bad'); return; }
                  const n = await ui.quantity(`Comprar ${f.name}`, Math.min(20, Math.floor(S().money / f.price)), f.price);
                  if (n > 0) {
                    addMoney(-n * f.price);
                    S().furnitureInv[id] = (S().furnitureInv[id] || 0) + n;
                    markDirty();
                    audio.sfx('buy');
                    ui.toast(`📦 ${n}× ${f.name} no inventário. Na sua casa, toque em 🛋️ Decorar casa!`, 'good');
                    render();
                  }
                };
                list.appendChild(d);
              }
              if (!ids.length) list.innerHTML = '<div class="muted">Nada encontrado.</div>';
            } else {
              const table = tab === 'floor' ? FLOORS : WALLS;
              const owned = tab === 'floor' ? s.floorsOwned : s.wallsOwned;
              for (const [id, f] of Object.entries(table)) {
                const d = document.createElement('button');
                d.className = 'decor-item shop-card' + (owned.includes(id) ? ' owned' : '');
                d.innerHTML = `<i class="style-swatch" style="background:linear-gradient(135deg,${f.a} 50%,${f.b} 50%)"></i><span class="nm">${esc(f.name)}</span><span class="q price">${owned.includes(id) ? '✔ seu' : money(f.price)}</span>`;
                d.onclick = async () => {
                  if (owned.includes(id)) { ui.toast('Você já tem este estilo. Use no modo Decorar → Estilo da casa.'); return; }
                  if (S().money < f.price) { audio.sfx('bump'); ui.toast('Dinheiro insuficiente!', 'bad'); return; }
                  if (!(await ui.ask(`Comprar ${f.name} por ${money(f.price)}?`))) return;
                  addMoney(-f.price); owned.push(id); markDirty(); audio.sfx('buy'); render();
                };
                list.appendChild(d);
              }
            }
          };
          paint();
        };
        render();
      },
    });
  });
}
