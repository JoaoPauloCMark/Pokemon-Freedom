// Pokétch: o relógio do Diamond com aplicativos úteis.
import { ui, esc, money } from './ui.js';
import { audio } from '../audio.js';
import { net } from '../net.js';
import { S, markDirty } from '../state.js';
import { clockText, timeOfDay } from '../../shared/time.js';
import { ITEMS } from '../../shared/data/items.js';
import { POKEDEX } from '../../shared/data/pokedex.js';
import { monName } from '../../shared/pokemon.js';
import { outbreakOf, trophyOf } from '../../shared/world/encounters.js';
import { iconImg } from './pickers.js';
import { berryReady, honeyState, digReady } from '../game/features.js';
import { JOB_KINDS, openJobs } from '../game/jobs.js';
import { contacts, relStatus, callContact, inviteContact, knownPeople, TRAITS } from '../game/relations.js';
import { drawPortrait } from '../render/character.js';

const APPS = [
  ['contacts', '📱', 'Contatos'], ['clock', '🕒', 'Relógio'], ['pedo', '👣', 'Pedômetro'], ['dowse', '📡', 'Radar de Itens'], ['berry', '🍒', 'Radar de Frutas'],
  ['eggs', '🥚', 'Incubadora'], ['friend', '💗', 'Amizade'], ['jobs', '💼', 'Trabalhos'], ['news', '📺', 'Notícias'], ['coin', '🪙', 'Moeda'],
];
let lastApp = 'contacts';

export function openPoketch(game) {
  const s = S();
  let app = lastApp;
  let timer = null;
  ui.panel({
    title: 'Pokétch', sub: 'Aplicativos do seu relógio', width: 'min(680px,96vw)', cls: 'poketch-panel',
    onClose: () => clearInterval(timer),
    build: (body) => {
      body.innerHTML = `<div class="poketch"><div class="pk-apps"></div><div class="pk-screen"></div></div>`;
      const apps = body.querySelector('.pk-apps'), screen = body.querySelector('.pk-screen');
      apps.innerHTML = APPS.map(([id, ic, name]) => `<button class="pk-app" data-app="${id}" title="${name}"><span>${ic}</span><small>${name}</small></button>`).join('');
      const render = () => {
        apps.querySelectorAll('.pk-app').forEach((b) => b.classList.toggle('on', b.dataset.app === app));
        screen.innerHTML = APP_RENDER[app](game, s);
        const bind = APP_BIND[app];
        if (bind) bind(screen, game, s, render);
      };
      apps.querySelectorAll('.pk-app').forEach((b) => b.onclick = () => { app = lastApp = b.dataset.app; audio.sfx('select'); render(); });
      timer = setInterval(() => { if (app === 'clock' || app === 'dowse' || app === 'pedo') render(); }, 1000);
      render();
    },
  });
}

// mini-radar: pontos relativos ao jogador
function radar(game, points, range) {
  const p = game.player;
  const dots = points.map((o) => {
    const dx = (o.x - p.x) / range, dy = (o.y - p.y) / range;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) return '';
    return `<i class="pk-dot ${o.cls || ''}" style="left:${50 + dx * 46}%;top:${50 + dy * 46}%" title="${esc(o.title || '')}"></i>`;
  }).join('');
  return `<div class="pk-radar"><i class="pk-me"></i>${dots}</div>`;
}

const APP_RENDER = {
  contacts: () => {
    const list = contacts();
    if (!list.length) return `<div class="pk-sub">Nenhum contato ainda.</div><div class="pk-sub">Converse com os moradores das cidades (aperte A perto deles). Quando a amizade chegar a 20, peça o contato!</div><div class="pk-sub">Pessoas que você conhece: ${knownPeople()}</div>`;
    return `<div class="pk-contacts">${list.map((c) => {
      const st = relStatus(c);
      const t = TRAITS[c.trait] || {};
      return `<div class="pk-contact" data-id="${esc(c.id)}"><canvas width="40" height="72"></canvas>
        <div class="grow"><b>${esc(c.name)}</b><small>${t.ic || ''} ${esc(t.name || '')} • ${st.ic} ${st.label}</small>
          <div class="pk-relbar"><i class="${c.v >= 0 ? 'pos' : 'neg'}" style="${c.v >= 0 ? `left:50%;width:${c.v / 2}%` : `right:50%;width:${-c.v / 2}%`}"></i></div></div>
        <div class="col" style="gap:4px"><button class="btn small" data-call="${esc(c.id)}">📞 Ligar</button><button class="btn small" data-inv="${esc(c.id)}">🏠 Convidar</button></div></div>`;
    }).join('')}</div><div class="pk-sub pk-callres"></div>`;
  },
  clock: () => {
    const now = net.now();
    const tod = { day: 'Dia', night: 'Noite', dusk: 'Entardecer', dawn: 'Amanhecer' }[timeOfDay(now)];
    return `<div class="pk-big">${clockText(now)}</div><div class="pk-sub">${tod}</div>
      <div class="pk-sub">No mundo, um dia inteiro dura 48 minutos reais.</div>`;
  },
  pedo: (game, s) => {
    const base = s.flags.npc.pedo || 0;
    return `<div class="pk-big">${(s.stats.steps - base).toLocaleString('pt-BR')}</div><div class="pk-sub">passos (total: ${s.stats.steps.toLocaleString('pt-BR')})</div>
      <button class="btn small" data-a="reset">Zerar contador</button>`;
  },
  dowse: (game, s) => {
    if (game.map !== 'world') return '<div class="pk-sub">O radar só funciona ao ar livre.</div>';
    const p = game.player;
    const near = game.world.objects.filter((o) => o.kind === 'hidden' && !s.flags.items[o.id] && Math.abs(o.x - p.x) <= 12 && Math.abs(o.y - p.y) <= 12);
    const dist = near.length ? Math.min(...near.map((o) => Math.abs(o.x - p.x) + Math.abs(o.y - p.y))) : null;
    return `${radar(game, near.map((o) => ({ x: o.x, y: o.y, cls: 'hid' })), 12)}
      <div class="pk-sub">${near.length ? `${near.length} item(ns) escondido(s) por perto. O mais perto está a ${dist} passo(s). Fique de frente e aperte A!` : 'Nenhum item escondido por perto.'}</div>`;
  },
  berry: (game, s) => {
    if (game.map !== 'world') return '<div class="pk-sub">Use ao ar livre para ver árvores por perto.</div>';
    const p = game.player, now = net.now();
    const list = game.world.objects.filter((o) => (o.kind === 'berry' || o.kind === 'honey' || o.kind === 'dig') && Math.abs(o.x - p.x) <= 30 && Math.abs(o.y - p.y) <= 30);
    const pts = list.map((o) => {
      if (o.kind === 'berry') return { x: o.x, y: o.y, cls: berryReady(s, o, now) ? 'ripe' : 'grow', title: ITEMS[o.berry].name };
      if (o.kind === 'honey') { const st = honeyState(s, o, now); return { x: o.x, y: o.y, cls: st === 'ready' ? 'honeyready' : 'honey', title: 'Árvore de mel' }; }
      return { x: o.x, y: o.y, cls: digReady(s, o, now) ? 'dig' : 'grow', title: 'Parede de escavação' };
    });
    const ripe = pts.filter((q) => q.cls === 'ripe').length;
    return `${radar(game, pts, 30)}<div class="pk-sub">🔴 frutas maduras: ${ripe} • 🟡 árvore de mel • 💎 parede para escavar • ⚪ crescendo</div>`;
  },
  eggs: (game, s) => {
    const eggs = s.eggs.map((e) => {
      const pct = Math.round(((e.total - e.steps) / e.total) * 100);
      const txt = pct < 40 ? 'Vai demorar para chocar.' : pct < 80 ? 'Às vezes ele se mexe.' : 'Está fazendo barulhos! Vai chocar logo!';
      return `<div class="pk-row"><span class="pk-egg">🥚</span><div class="grow"><div class="job-bar"><i style="width:${pct}%"></i></div><small>${txt}${e.from ? ` (de ${esc(e.from)})` : ''}</small></div></div>`;
    }).join('');
    const d = s.daycare;
    const dc = d && d.mons && d.mons.length ? `Na creche: ${d.mons.map((x) => `${iconImg(x.mon.species)} ${esc(monName(x.mon))}`).join(' ')}${d.egg ? ' • 🥚 Tem um ovo esperando!' : ''}` : 'Ninguém na creche (Solaceon e Hearthome).';
    return `${eggs || '<div class="pk-sub">Nenhum ovo na incubadora. Ganhe ovos na creche ou de presente!</div>'}<div class="pk-sub">${dc}</div>`;
  },
  friend: (game, s) => s.party.map((m) => {
    const f = m.friendship || 70;
    const hearts = f >= 220 ? 3 : f >= 150 ? 2 : f >= 90 ? 1 : 0;
    return `<div class="pk-row">${iconImg(m.species)}<span class="grow">${esc(monName(m))}</span><span class="pk-hearts">${'💗'.repeat(hearts)}${'🤍'.repeat(3 - hearts)}</span></div>`;
  }).join('') || '<div class="pk-sub">Sem Pokémon na equipe.</div>',
  jobs: (game, s) => `${s.jobs.active.map((j) => `<div class="pk-row"><span>${JOB_KINDS[j.kind].icon}</span><div class="grow"><b>${esc(j.title)}</b><div class="job-bar"><i style="width:${Math.round((j.have / j.need) * 100)}%"></i></div></div><small>${money(j.pay)}</small></div>`).join('') || '<div class="pk-sub">Nenhum trabalho ativo. Procure o quadro amarelo nos Centros Pokémon!</div>'}
      <div class="pk-sub">Ganhos: ${money(s.jobs.earned)} • ${s.jobs.count} concluído(s)</div><button class="btn small" data-a="jobs">Abrir trabalhos</button>`,
  news: () => {
    const ob = outbreakOf(net.now());
    return `<div class="pk-row">${iconImg(ob.species)}<div class="grow"><b>Surto!</b> Muitos ${esc(POKEDEX[ob.species].name)} em ${esc(ob.zoneName)} hoje (Nv. ${ob.min}–${ob.max}).</div></div>
      <div class="pk-row">${iconImg(trophyOf(net.now()))}<div class="grow"><b>Jardim de Troféus</b> (Rota 212): hoje aparece ${esc(POKEDEX[trophyOf(net.now())].name)}.</div></div>
      <div class="pk-sub">As notícias mudam todo dia.</div>`;
  },
  coin: () => '<div class="pk-big pk-coin">🪙</div><button class="btn small" data-a="flip">Jogar moeda</button><div class="pk-sub pk-res"></div>',
};

const APP_BIND = {
  contacts: (el) => {
    const list = contacts();
    el.querySelectorAll('.pk-contact').forEach((row) => {
      const c = list.find((x) => x.id === row.dataset.id);
      if (c) drawPortrait(row.querySelector('canvas'), c.look, 2, 0);
    });
    const out = el.querySelector('.pk-callres');
    el.querySelectorAll('[data-call]').forEach((b) => b.onclick = () => {
      const r = callContact(b.dataset.call);
      if (!r) return;
      audio.sfx(r.ok ? 'confirm' : 'bump');
      out.textContent = '📞 ' + r.text;
    });
    el.querySelectorAll('[data-inv]').forEach((b) => b.onclick = () => { out.textContent = '🏠 ' + inviteContact(b.dataset.inv); audio.sfx('select'); });
  },
  pedo: (el, game, s, render) => { el.querySelector('[data-a=reset]').onclick = () => { s.flags.npc.pedo = s.stats.steps; markDirty(); audio.sfx('select'); render(); }; },
  jobs: (el, game) => { el.querySelector('[data-a=jobs]').onclick = () => openJobs(game, null); },
  coin: (el) => {
    el.querySelector('[data-a=flip]').onclick = () => {
      const c = el.querySelector('.pk-coin');
      c.classList.remove('flip'); void c.offsetWidth; c.classList.add('flip');
      audio.sfx('select');
      setTimeout(() => { el.querySelector('.pk-res').textContent = Math.random() < 0.5 ? 'Cara!' : 'Coroa!'; }, 600);
    };
  },
};
