// Componentes reutilizáveis: cartões de Pokémon, seleção de equipe, itens e golpes.
import { ui, esc } from './ui.js';
import { S } from '../state.js';
import { POKEDEX } from '../../shared/data/pokedex.js';
import { MOVES } from '../../shared/data/moves.js';
import { ITEMS, itemSprite } from '../../shared/data/items.js';
import { TYPE_PT, TYPE_COLOR, STATUS_PT, STATUS_COLOR, CATEGORY_PT } from '../../shared/data/types.js';
import { monName, maxHp, makeMove } from '../../shared/pokemon.js';
import { spriteUrl, fallbackSprite } from '../assets.js';
import { audio } from '../audio.js';

export function typeChip(t) {
  return `<span class="chip" style="background:${TYPE_COLOR[t]}">${TYPE_PT[t]}</span>`;
}

export function hpClass(hp, max) {
  const r = hp / max;
  return r > 0.5 ? '' : r > 0.2 ? 'mid' : 'low';
}

export function genderHtml(g) {
  return g === 'M' ? '<span class="g-m">♂</span>' : g === 'F' ? '<span class="g-f">♀</span>' : '';
}

export function statusHtml(st) {
  return st ? `<span class="st" style="background:${STATUS_COLOR[st]}">${STATUS_PT[st]}</span>` : '';
}

export function iconImg(species, cls = 'icon') {
  return `<img class="${cls}" src="${spriteUrl.icon(species)}" onerror="this.onerror=null;this.src='${fallbackSprite()}'" alt="">`;
}

export function pcardHtml(mon, extra = '') {
  const mh = maxHp(mon);
  const sp = POKEDEX[mon.species];
  return `${iconImg(mon.species)}
    <div class="grow col" style="gap:3px">
      <div class="nm">${esc(monName(mon))} ${genderHtml(mon.gender)} ${mon.shiny ? '<span class="shiny">★</span>' : ''} ${statusHtml(mon.status)}
        <span class="lv" style="margin-left:auto">Nv. ${mon.level}</span></div>
      <div class="row" style="gap:4px">${sp.types.map(typeChip).join('')}</div>
      <div class="hpbar"><i class="${hpClass(mon.hp, mh)}" style="width:${Math.max(0, (mon.hp / mh) * 100)}%"></i></div>
      <div class="hptext">${mon.hp}/${mh} ${extra}</div>
    </div>`;
}

// Seleciona um Pokémon da equipe. filter(mon, i) -> string de erro ou null
export function pickPartyMon(title, opts = {}) {
  const party = opts.party || S().party;
  return new Promise((resolve) => {
    let sel = Math.max(0, opts.start || 0);
    let done = false;
    const finish = (v) => { if (done) return; done = true; layer.close(); resolve(v); };
    const layer = ui.panel({
      title, width: 'min(780px,96vw)', backdrop: !opts.noCancel,
      build: (body) => {
        const grid = document.createElement('div');
        grid.className = 'party';
        party.forEach((m, i) => {
          const c = document.createElement('div');
          c.className = 'pcard' + (m.hp <= 0 ? ' fainted' : '');
          c.innerHTML = pcardHtml(m, opts.extra ? opts.extra(m, i) : '');
          c.onclick = () => choose(i);
          c.onmouseenter = () => { sel = i; paint(); };
          grid.appendChild(c);
        });
        body.appendChild(grid);
        if (opts.hint) body.insertAdjacentHTML('beforeend', `<div class="muted">${esc(opts.hint)}</div>`);
        const paint = () => [...grid.children].forEach((c, i) => c.classList.toggle('sel', i === sel));
        layer.paint = paint;
        paint();
      },
      onKey: (k) => {
        if (k === 'up') sel = Math.max(0, sel - 2);
        else if (k === 'down') sel = Math.min(party.length - 1, sel + 2);
        else if (k === 'left') sel = Math.max(0, sel - 1);
        else if (k === 'right') sel = Math.min(party.length - 1, sel + 1);
        else if (k === 'a' || k === 'enter') { choose(sel); return true; }
        else if (k === 'b') { if (opts.noCancel) return true; finish(-1); return true; }
        else return false;
        layer.paint();
        audio.sfx('select');
        return true;
      },
      onClose: () => { if (!done) { done = true; resolve(-1); } },
    });
    const choose = (i) => {
      const err = opts.filter ? opts.filter(party[i], i) : null;
      if (err) { ui.toast(err, 'bad'); audio.sfx('bump'); return; }
      audio.sfx('confirm');
      finish(i);
    };
    if (opts.noCancel) layer.el.querySelector('.close').style.display = 'none';
  });
}

// Seleciona um item da bolsa. pockets: lista de bolsos permitidos
export function pickItem(title, pockets) {
  return new Promise((resolve) => {
    const bag = S().bag;
    let pocket = pockets[0];
    let done = false;
    const finish = (v) => { if (done) return; done = true; layer.close(); resolve(v); };
    const POCKET_PT = { balls: 'Poké Bolas', medicine: 'Remédios', berries: 'Frutas', items: 'Itens', tms: 'MTs', key: 'Itens-Chave' };
    const layer = ui.panel({
      title, width: 'min(760px,96vw)',
      build: (body) => {
        body.innerHTML = `<div class="tabs"></div><div class="items scroll" style="max-height:52vh"></div><div class="desc-box"></div>`;
        const tabs = body.querySelector('.tabs'), list = body.querySelector('.items'), desc = body.querySelector('.desc-box');
        const render = () => {
          tabs.innerHTML = pockets.map((p) => `<button class="tab ${p === pocket ? 'on' : ''}" data-p="${p}">${POCKET_PT[p]}</button>`).join('');
          tabs.querySelectorAll('.tab').forEach((b) => b.onclick = () => { pocket = b.dataset.p; render(); });
          const ids = Object.keys(bag).filter((id) => ITEMS[id] && ITEMS[id].pocket === pocket && bag[id] > 0);
          list.innerHTML = ids.length ? '' : '<div class="muted">Nada aqui.</div>';
          for (const id of ids) {
            const it = ITEMS[id];
            const d = document.createElement('div');
            d.className = 'item';
            d.innerHTML = `<img src="${itemSprite(id)}" alt=""><span class="n">${esc(it.name)}</span><span class="q">×${bag[id]}</span>`;
            d.onmouseenter = () => { desc.textContent = it.desc; };
            d.onclick = () => { audio.sfx('confirm'); finish(id); };
            list.appendChild(d);
          }
          desc.textContent = 'Escolha um item.';
        };
        render();
      },
      onClose: () => { if (!done) { done = true; resolve(null); } },
    });
  });
}

// Seleciona um golpe de um Pokémon
export function pickMove(mon, title, extraMove = null) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; layer.close(); resolve(v); };
    const layer = ui.panel({
      title, width: 'min(560px,96vw)',
      build: (body) => {
        const list = [...mon.moves.map((m) => m.id)];
        if (extraMove) list.push(extraMove);
        body.innerHTML = list.map((id, i) => {
          const md = MOVES[id];
          const slot = mon.moves[i];
          return `<div class="move-row" data-i="${i}" style="cursor:pointer;${i === 4 ? 'outline:3px dashed #45b864' : ''}">
            <span>${typeChip(md.type)} ${esc(md.name)}</span><span class="pp">${CATEGORY_PT[md.category]} • Poder ${md.basePower || '—'}</span>
            <span class="pp">PP ${slot ? slot.pp + '/' + slot.ppMax : md.pp + '/' + md.pp}</span></div>`;
        }).join('') + '<div class="move-desc"></div>';
        body.querySelectorAll('.move-row').forEach((r) => {
          r.onclick = () => { audio.sfx('confirm'); finish(+r.dataset.i); };
          r.onmouseenter = () => { body.querySelector('.move-desc').textContent = moveDesc(list[+r.dataset.i]); };
        });
      },
      onClose: () => { if (!done) { done = true; resolve(-1); } },
    });
  });
}

// Descrição gerada a partir dos dados do golpe
export function moveDesc(id) {
  const m = MOVES[id];
  if (!m) return '';
  const parts = [];
  parts.push(`${TYPE_PT[m.type]} • ${CATEGORY_PT[m.category]}`);
  if (m.basePower) parts.push(`Poder ${m.basePower}`);
  parts.push(`Precisão ${m.accuracy === true ? '—' : m.accuracy + '%'}`);
  if (m.priority > 0) parts.push('Ataca primeiro');
  if (m.priority < 0) parts.push('Ataca por último');
  const STAT = { atk: 'Ataque', def: 'Defesa', spa: 'At. Esp.', spd: 'Def. Esp.', spe: 'Velocidade', accuracy: 'Precisão', evasion: 'Evasão' };
  const ST = { brn: 'queimar', par: 'paralisar', psn: 'envenenar', tox: 'envenenar gravemente', slp: 'fazer dormir', frz: 'congelar' };
  const sec = m.secondary || (m.secondaries && m.secondaries[0]);
  if (sec) {
    if (sec.status) parts.push(`${sec.chance}% de chance de ${ST[sec.status]}`);
    if (sec.volatileStatus === 'flinch') parts.push(`${sec.chance}% de fazer recuar`);
    if (sec.volatileStatus === 'confusion') parts.push(`${sec.chance}% de confundir`);
    if (sec.boosts) parts.push(`${sec.chance}% de reduzir ${Object.keys(sec.boosts).map((k) => STAT[k]).join('/')} do alvo`);
    if (sec.self && sec.self.boosts) parts.push(`${sec.chance}% de aumentar ${Object.keys(sec.self.boosts).map((k) => STAT[k]).join('/')}`);
  }
  if (m.status) parts.push(`Tenta ${ST[m.status]} o alvo`);
  if (m.boosts) {
    const self = m.target === 'self' || m.target === 'allySide' || m.target === 'allies';
    for (const [k, v] of Object.entries(m.boosts)) parts.push(`${v > 0 ? 'Aumenta' : 'Reduz'} ${STAT[k]} ${self ? 'do usuário' : 'do alvo'}${Math.abs(v) > 1 ? ' muito' : ''}`);
  }
  if (m.drain) parts.push('Recupera PS com o dano');
  if (m.recoil) parts.push('Causa dano de recuo');
  if (m.heal) parts.push('Recupera PS');
  if (m.multihit) parts.push(Array.isArray(m.multihit) ? 'Acerta de 2 a 5 vezes' : `Acerta ${m.multihit} vezes`);
  if (m.critRatio > 1) parts.push('Alta chance de crítico');
  if (m.ohko) parts.push('Nocaute instantâneo');
  if (m.flags && m.flags.charge) parts.push('Precisa de um turno para carregar');
  if (m.recharge) parts.push('Precisa recarregar no turno seguinte');
  if (m.selfSwitch) parts.push('O usuário troca de lugar depois');
  if (id === 'falseswipe') parts.push('Sempre deixa o alvo com pelo menos 1 PS');
  return parts.join(' • ') + '.';
}

// Fluxo de aprender golpe. Retorna true se aprendeu.
export async function learnMoveFlow(mon, moveId) {
  const name = monName(mon);
  const mv = MOVES[moveId];
  if (!mv || mon.moves.some((m) => m.id === moveId)) return false;
  if (mon.moves.length < 4) {
    mon.moves.push(makeMove(moveId));
    audio.sfx('levelup');
    await ui.dialog(`${name} aprendeu ${mv.name}!`);
    return true;
  }
  while (true) {
    await ui.dialog([`${name} quer aprender ${mv.name}.`, `Mas ${name} já conhece quatro golpes.`]);
    const forget = await ui.ask(`Esquecer um golpe para aprender ${mv.name}?`);
    if (forget) {
      const i = await pickMove(mon, `Qual golpe ${name} deve esquecer?`, moveId);
      if (i >= 0 && i < 4) {
        const old = MOVES[mon.moves[i].id].name;
        mon.moves[i] = makeMove(moveId);
        await ui.dialog([`1, 2 e... Pronto!`, `${name} esqueceu ${old}...`, `E aprendeu ${mv.name}!`]);
        audio.sfx('levelup');
        return true;
      }
    }
    if (await ui.ask(`Desistir de aprender ${mv.name}?`)) {
      await ui.dialog(`${name} não aprendeu ${mv.name}.`);
      return false;
    }
  }
}
