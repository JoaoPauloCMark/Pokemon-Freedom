// Cheats (só em mundos criados com "Permitir cheats", como no Minecraft):
// painel no menu e comandos no chat (/ajuda).
import { ui, esc, money } from './ui.js';
import { audio } from '../audio.js';
import { S, state, addItem, addMoney, addPokemon, healParty, markDirty, saveNow, markCaught, markSeen } from '../state.js';
import { POKEDEX } from '../../shared/data/pokedex.js';
import { ITEMS, itemSprite } from '../../shared/data/items.js';
import { CLOTHES } from '../../shared/data/clothes.js';
import { FURNITURE } from '../../shared/data/furniture.js';
import { GYMS } from '../../shared/world/npcs.js';
import { createPokemon, expForLevel, maxHp } from '../../shared/pokemon.js';
import { spriteUrl } from '../assets.js';

export const cheatsOn = () => !!(state.world && state.world.cheats);

const norm = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const SPECIES = Object.values(POKEDEX).sort((a, b) => a.id - b.id);
const ITEM_LIST = Object.entries(ITEMS).map(([id, it]) => ({ id, ...it }));
const POCKET_PT = { balls: 'Poké Bolas', medicine: 'Remédios', berries: 'Frutas', items: 'Itens', tms: 'MTs', key: 'Itens-Chave' };

function findSpecies(q) {
  const n = norm(q);
  if (/^#?\d+$/.test(n)) return POKEDEX[+n.replace('#', '')] || null;
  return SPECIES.find((s) => norm(s.name) === n) || SPECIES.find((s) => norm(s.name).startsWith(n)) || null;
}
function findItem(q) {
  const n = norm(q).replace(/\s+/g, '');
  return ITEM_LIST.find((i) => i.id === n) || ITEM_LIST.find((i) => norm(i.name).replace(/\s+/g, '') === n)
    || ITEM_LIST.find((i) => norm(i.name).replace(/\s+/g, '').startsWith(n)) || null;
}

// ------------------------------------------------------------ ações
const act = {
  give(id, level = 50, shiny = false) {
    const sp = POKEDEX[id];
    if (!sp) return 'Pokémon não encontrado.';
    const mon = createPokemon(id, Math.max(1, Math.min(100, level | 0)), { shiny, ot: state.name, otId: state.name, met: 'Cheat' });
    const where = addPokemon(mon);
    return `${shiny ? '✨ ' : ''}${sp.name} Nv. ${mon.level} foi para ${where === 'party' ? 'a equipe' : 'o PC'}.`;
  },
  item(id, n = 1) {
    const it = ITEMS[id];
    if (!it) return 'Item não encontrado.';
    addItem(id, Math.max(1, Math.min(999, n | 0)));
    return `${it.pocket === 'key' ? '' : `${n}× `}${it.name} na bolsa.`;
  },
  money(n) { addMoney(n); return `Dinheiro: ${money(S().money)}.`; },
  heal() { healParty(); return 'Equipe curada.'; },
  levels(target) {
    const s = S();
    for (const m of s.party) {
      if (m.egg) continue;
      const goal = Math.min(100, target === '+5' ? m.level + 5 : +target);
      if (goal <= m.level) continue;
      m.level = goal;
      m.exp = expForLevel(POKEDEX[m.species].growth, goal);
      m.hp = maxHp(m);
    }
    markDirty();
    return 'Níveis da equipe atualizados.';
  },
  badges() { S().badges = Object.keys(GYMS); markDirty(); return 'Todas as 8 insígnias!'; },
  dex(caught) {
    for (const sp of SPECIES) { if (caught) markCaught(sp.id); else markSeen(sp.id); }
    return caught ? 'Pokédex completa (capturados).' : 'Todos os Pokémon marcados como vistos.';
  },
  fly(game) {
    const s = S();
    s.visited = [...new Set([...(s.visited || []), ...game.world.cities.map((c) => c.id)])];
    markDirty();
    return 'Voo liberado para todas as cidades (abra o Mapa).';
  },
  clothes() { const s = S(); s.wardrobe = [...new Set([...s.wardrobe, ...Object.keys(CLOTHES)])]; markDirty(); return 'Todas as roupas no guarda-roupa!'; },
  furniture() { const s = S(); for (const id of Object.keys(FURNITURE)) s.furnitureInv[id] = (s.furnitureInv[id] || 0) + 1; markDirty(); return 'Um de cada móvel no inventário!'; },
  hatch() { const s = S(); let n = 0; for (const e of s.eggs) { e.steps = 0; n++; } return n ? `${n} ovo(s) vão chocar no próximo passo.` : 'Você não tem ovos.'; },
  trees() { const s = S(); s.berries = {}; s.dig = {}; for (const k of Object.keys(s.honey)) s.honey[k] = Date.now() - 11 * 60 * 1000; markDirty(); return 'Árvores e paredes de escavação prontas de novo.'; },
  trainers() { S().trainers = {}; markDirty(); return 'Todos os treinadores querem revanche.'; },
  bp(n) { const s = S(); s.bp = (s.bp || 0) + n; markDirty(); return `Você tem ${s.bp} BP.`; },
  noclip(game) { game.noclip = !game.noclip; return game.noclip ? 'Atravessar paredes: LIGADO.' : 'Atravessar paredes: desligado.'; },
  noenc(game) { game.noEncounters = !game.noEncounters; return game.noEncounters ? 'Sem encontros selvagens: LIGADO.' : 'Encontros selvagens normais.'; },
  async tp(game, q) {
    const n = norm(q);
    const c = game.world.cities.find((x) => norm(x.name).includes(n) || x.id === n);
    if (!c) return 'Cidade não encontrada.';
    const L = c.layout;
    const center = L.buildings.find((b) => b.type === 'center');
    await game.teleport(center ? center.doorX : L.roadX + 1, center ? center.doorY + 1 : L.walkways[0]);
    return `Teleportado para ${c.name}.`;
  },
};

const done = (msg) => { if (msg) { ui.toast('🪄 ' + msg, 'good'); audio.sfx('item'); } markDirty(); };

// ------------------------------------------------------------ painel
export function openCheats(game) {
  if (!cheatsOn()) { ui.toast('Os cheats estão desativados neste mundo.', 'bad'); return; }
  let tab = 'pokemon';
  let shiny = false, level = 50, qty = 10;
  ui.panel({
    title: '🪄 Cheats', sub: 'Mundo com cheats ativados', width: 'min(860px,96vw)',
    build: (body) => {
      body.innerHTML = '<div class="tabs ch-tabs"></div><div class="ch-body"></div>';
      const tabs = body.querySelector('.ch-tabs'), box = body.querySelector('.ch-body');
      const render = () => {
        tabs.innerHTML = [['pokemon', '🔴 Pokémon'], ['items', '🎒 Itens'], ['money', '💰 Dinheiro'], ['utils', '🛠️ Utilidades'], ['help', '💬 Comandos']]
          .map(([id, n]) => `<button class="tab ${tab === id ? 'on' : ''}" data-t="${id}">${n}</button>`).join('');
        tabs.querySelectorAll('.tab').forEach((b) => b.onclick = () => { tab = b.dataset.t; audio.sfx('select'); render(); });
        if (tab === 'pokemon') renderMon(); else if (tab === 'items') renderItems(); else if (tab === 'money') renderMoney(); else if (tab === 'utils') renderUtils(); else renderHelp();
      };
      function renderMon() {
        box.innerHTML = `<div class="row ch-bar"><input class="ch-q" placeholder="Buscar Pokémon por nome ou número..."><label class="ch-lv">Nível <input type="number" min="1" max="100" value="${level}"></label>
          <button class="btn small ${shiny ? 'blue' : ''}" data-a="shiny">✨ Shiny: ${shiny ? 'sim' : 'não'}</button></div>
          <div class="ch-grid scroll"></div>`;
        const q = box.querySelector('.ch-q'), grid = box.querySelector('.ch-grid');
        box.querySelector('.ch-lv input').oninput = (e) => { level = Math.max(1, Math.min(100, +e.target.value || 1)); };
        box.querySelector('[data-a=shiny]').onclick = () => { shiny = !shiny; renderMon(); };
        const list = () => {
          const n = norm(q.value);
          const res = SPECIES.filter((s) => !n || norm(s.name).includes(n) || String(s.id) === n.replace('#', '')).slice(0, 120);
          grid.innerHTML = res.map((s) => `<button class="ch-card" data-id="${s.id}"><img loading="lazy" src="${spriteUrl.icon(s.id)}" alt=""><span>#${String(s.id).padStart(3, '0')}</span><b>${esc(s.name)}</b></button>`).join('') || '<div class="muted">Nada encontrado.</div>';
          grid.querySelectorAll('.ch-card').forEach((b) => b.onclick = () => { done(act.give(+b.dataset.id, level, shiny)); game.refreshFollower(); });
        };
        q.oninput = list;
        q.addEventListener('keydown', (e) => e.stopPropagation());
        list();
        setTimeout(() => q.focus(), 30);
      }
      function renderItems() {
        box.innerHTML = `<div class="row ch-bar"><input class="ch-q" placeholder="Buscar item..."><div class="seg">${[1, 10, 99].map((n) => `<button class="${qty === n ? 'on' : ''}" data-q="${n}">×${n}</button>`).join('')}</div>
          <button class="btn small" data-a="kit">Kit de viagem</button></div><div class="ch-grid items-grid scroll"></div>`;
        const q = box.querySelector('.ch-q'), grid = box.querySelector('.ch-grid');
        box.querySelectorAll('[data-q]').forEach((b) => b.onclick = () => { qty = +b.dataset.q; renderItems(); });
        box.querySelector('[data-a=kit]').onclick = () => {
          for (const [id, n] of [['ultrabola', 20], ['hiperpocao', 15], ['revivermax', 5], ['curatotal', 10], ['repelente', 10], ['docerarro', 10], ['masterbola', 3]]) if (ITEMS[id]) addItem(id, n);
          done('Kit de viagem na bolsa!');
        };
        const list = () => {
          const n = norm(q.value);
          const res = ITEM_LIST.filter((i) => !n || norm(i.name).includes(n) || i.id.includes(n)).slice(0, 150);
          grid.innerHTML = res.map((i) => `<button class="ch-item" data-id="${i.id}"><img loading="lazy" src="${itemSprite(i.id)}" alt=""><span><b>${esc(i.name)}</b><small>${POCKET_PT[i.pocket] || ''}</small></span><em>+</em></button>`).join('') || '<div class="muted">Nada encontrado.</div>';
          grid.querySelectorAll('.ch-item').forEach((b) => b.onclick = () => done(act.item(b.dataset.id, qty)));
        };
        q.oninput = list;
        q.addEventListener('keydown', (e) => e.stopPropagation());
        list();
        setTimeout(() => q.focus(), 30);
      }
      function renderMoney() {
        box.innerHTML = `<div class="ch-money"><div class="ch-now">${money(S().money)}</div>
          <div class="ch-btns">${[1000, 10000, 100000, 1000000].map((v) => `<button class="btn green" data-m="${v}">+ ${money(v)}</button>`).join('')}
          <button class="btn" data-m="max">Máximo</button><button class="btn" data-m="zero">Zerar</button></div>
          <div class="ch-btns"><button class="btn blue" data-bp="50">+ 50 BP</button><button class="btn blue" data-bp="500">+ 500 BP</button></div></div>`;
        box.querySelectorAll('[data-m]').forEach((b) => b.onclick = () => {
          const v = b.dataset.m;
          if (v === 'max') addMoney(9999999); else if (v === 'zero') addMoney(-S().money); else addMoney(+v);
          done(`Dinheiro: ${money(S().money)}`);
          renderMoney();
        });
        box.querySelectorAll('[data-bp]').forEach((b) => b.onclick = () => done(act.bp(+b.dataset.bp)));
      }
      function renderUtils() {
        const U = [
          ['❤️', 'Curar equipe', () => act.heal()],
          ['⬆️', 'Equipe +5 níveis', () => act.levels('+5')],
          ['💯', 'Equipe nível 100', () => act.levels('100')],
          ['🏅', 'Todas as insígnias', () => act.badges()],
          ['📕', 'Pokédex: ver todos', () => act.dex(false)],
          ['📗', 'Pokédex: capturar todos', () => act.dex(true)],
          ['✈️', 'Liberar voo p/ todas as cidades', () => act.fly(game)],
          ['👕', 'Todas as roupas', () => act.clothes()],
          ['🛋️', 'Um de cada móvel', () => act.furniture()],
          ['🥚', 'Chocar ovos agora', () => act.hatch()],
          ['🍒', 'Árvores e escavações prontas', () => act.trees()],
          ['🔁', 'Revanche com treinadores', () => act.trainers()],
          ['👻', `Atravessar paredes: ${game.noclip ? 'ON' : 'OFF'}`, () => act.noclip(game)],
          ['🚫', `Sem encontros: ${game.noEncounters ? 'ON' : 'OFF'}`, () => act.noenc(game)],
        ];
        box.innerHTML = `<div class="ch-utils">${U.map(([ic, n], i) => `<button class="ch-util" data-u="${i}"><span>${ic}</span>${esc(n)}</button>`).join('')}</div>
          <div class="ch-bar row"><span class="muted">Teleportar:</span><select class="ch-tp">${game.world.cities.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select><button class="btn small blue" data-a="tp">Ir</button></div>`;
        box.querySelectorAll('[data-u]').forEach((b) => b.onclick = () => { done(U[+b.dataset.u][2]()); game.refreshFollower(); renderUtils(); });
        box.querySelector('[data-a=tp]').onclick = async () => { const id = box.querySelector('.ch-tp').value; ui.closeAll(); done(await act.tp(game, id)); };
      }
      function renderHelp() {
        box.innerHTML = `<div class="desc-box ch-help">${HELP.map(([c, d]) => `<div><code>${esc(c)}</code> ${esc(d)}</div>`).join('')}</div>`;
      }
      render();
    },
  });
}

// ------------------------------------------------------------ comandos do chat
const HELP = [
  ['/dinheiro 50000', 'adiciona dinheiro'],
  ['/pokemon pikachu 30 shiny', 'dá um Pokémon (nível e shiny opcionais)'],
  ['/item ultrabola 20', 'dá itens (nome ou id)'],
  ['/curar', 'cura a equipe'],
  ['/nivel 50', 'sobe a equipe até o nível'],
  ['/tp hearthome', 'teleporta para uma cidade'],
  ['/insignias', 'todas as insígnias'],
  ['/pokedex', 'marca todos como capturados'],
  ['/voar', 'libera o voo para todas as cidades'],
  ['/roupas • /moveis', 'todas as roupas • um de cada móvel'],
  ['/noclip • /semencontros', 'atravessar paredes • sem selvagens'],
  ['/bp 100', 'Pontos de Batalha'],
];

// Retorna true se a mensagem era um comando (e não deve ir para o chat).
export async function runCommand(game, text, reply) {
  if (!text.startsWith('/')) return false;
  const [cmd, ...args] = text.slice(1).trim().split(/\s+/);
  const c = norm(cmd);
  if (!cheatsOn()) { reply('Os cheats estão desativados neste mundo. O dono pode ativar em Meus Mundos → ⋯.'); return true; }
  let msg = null;
  try {
    switch (c) {
      case 'ajuda': case 'help': case 'comandos': reply('Comandos: ' + HELP.map(([x]) => x).join(' | ')); return true;
      case 'dinheiro': case 'money': msg = act.money(parseInt(args[0], 10) || 10000); break;
      case 'pokemon': case 'poke': {
        const shiny = args.some((a) => norm(a) === 'shiny');
        const rest = args.filter((a) => norm(a) !== 'shiny');
        let sp, lv;
        if (/^#?\d+$/.test(rest[0] || '')) { sp = findSpecies(rest[0]); lv = +rest[1]; }
        else { sp = findSpecies(rest.filter((a) => !/^\d+$/.test(a)).join(' ')); lv = +rest.find((a) => /^\d+$/.test(a)); }
        if (!sp) { reply(`Pokémon "${rest.join(' ')}" não encontrado.`); return true; }
        msg = act.give(sp.id, lv || 50, shiny);
        game.refreshFollower();
        break;
      }
      case 'item': case 'give': {
        const n = /^\d+$/.test(args[args.length - 1] || '') && args.length > 1 ? +args.pop() : 1;
        const it = findItem(args.join(' '));
        if (!it) { reply(`Item "${args.join(' ')}" não encontrado.`); return true; }
        msg = act.item(it.id, n);
        break;
      }
      case 'curar': case 'heal': msg = act.heal(); break;
      case 'nivel': case 'level': msg = act.levels(String(Math.max(1, Math.min(100, parseInt(args[0], 10) || 50)))); break;
      case 'tp': msg = await act.tp(game, args.join(' ')); break;
      case 'insignias': msg = act.badges(); break;
      case 'pokedex': msg = act.dex(true); break;
      case 'voar': msg = act.fly(game); break;
      case 'roupas': msg = act.clothes(); break;
      case 'moveis': msg = act.furniture(); break;
      case 'noclip': msg = act.noclip(game); break;
      case 'semencontros': msg = act.noenc(game); break;
      case 'bp': msg = act.bp(parseInt(args[0], 10) || 50); break;
      case 'chocar': msg = act.hatch(); break;
      default: reply(`Comando desconhecido: /${cmd}. Digite /ajuda.`); return true;
    }
  } catch (e) {
    console.error(e);
    reply('Não deu para executar esse comando.');
    return true;
  }
  if (msg) { reply('🪄 ' + msg); audio.sfx('item'); }
  saveNow();
  return true;
}

