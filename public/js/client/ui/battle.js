// Tela de batalha (DOM) + controlador local (selvagem/treinador) e PvP (servidor).
import { ui, esc, money } from './ui.js';
import { audio } from '../audio.js';
import { input } from '../input.js';
import { net } from '../net.js';
import { S, state, addMoney, addPokemon, caughtSet, markSeen, useItem, hasItem, markDirty } from '../state.js';
import { Battle } from '../../shared/battle/engine.js';
import { POKEDEX } from '../../shared/data/pokedex.js';
import { MOVES } from '../../shared/data/moves.js';
import { ITEMS, itemSprite } from '../../shared/data/items.js';
import { TYPE_COLOR, TYPE_PT, typeEffect } from '../../shared/data/types.js';
import { monName, maxHp, expProgress, gainExp, expYield, isUsable, healMon } from '../../shared/pokemon.js';
import { spriteUrl, loadImage, fallbackSprite } from '../assets.js';
import { BattleFX } from './battlefx.js';
import { genderHtml, statusHtml, hpClass, pickPartyMon, pickItem, learnMoveFlow, moveDesc } from './pickers.js';
import { drawPortrait } from '../render/character.js';
import { timeOfDay } from '../../shared/time.js';

const BG = {
  grass: ['linear-gradient(#9fd8ff 0%, #d8f2ff 45%, #8fd06a 45%, #6cb84e 100%)', '#5ea845', '#7ec95e'],
  water: ['linear-gradient(#8fd0ff 0%, #d0eeff 42%, #4fa3e3 42%, #2f7fd0 100%)', '#2a6fb8', '#5aaeea'],
  cave: ['linear-gradient(#2a2230 0%, #4a3b3a 45%, #6b5a4c 45%, #4e4036 100%)', '#3a2f28', '#7a6858'],
  snow: ['linear-gradient(#c8dcf0 0%, #eef6ff 45%, #e6eef8 45%, #c9d8ea 100%)', '#aebfd6', '#ffffff'],
  desert: ['linear-gradient(#f5d38a 0%, #fbe9c0 45%, #e8c27a 45%, #c99a52 100%)', '#b8873f', '#f0d39a'],
  volcano: ['linear-gradient(#3a1414 0%, #8a3a22 45%, #6a5a58 45%, #463a3a 100%)', '#3a2e2e', '#8a7a78'],
  marsh: ['linear-gradient(#a8c8b0 0%, #d8e8d0 45%, #7a8a50 45%, #5a6a3a 100%)', '#4f5a30', '#8a9a5a'],
  indoor: ['linear-gradient(#e8dcc8 0%, #f4ecdc 45%, #c9b28a 45%, #a88e64 100%)', '#8a7048', '#d8c098'],
  gym: ['linear-gradient(#3b3f5c 0%, #5a5f86 45%, #c9c3b6 45%, #a9a294 100%)', '#8a8478', '#e6e0d2'],
  night: ['linear-gradient(#1a2148 0%, #3a4a7a 45%, #3f6a3a 45%, #2a4a2a 100%)', '#25401f', '#4f7a42'],
};

function waitKeyOr(ms) {
  return new Promise((resolve) => {
    let done = false;
    const off = input.onPress((k) => { if (k === 'a' || k === 'enter' || k === 'b') finish(); });
    const t = setTimeout(finish, ms);
    function finish() { if (done) return; done = true; clearTimeout(t); off(); resolve(); }
  });
}

class BattleView {
  constructor(opts) {
    this.opts = opts;
    this.disp = [null, null];
    this.menuKey = null;
    const terrain = opts.terrain || 'grass';
    const bgKey = terrain === 'grass' && timeOfDay(net.now()) === 'night' ? 'night' : terrain;
    const [bg, plat, platL] = BG[bgKey] || BG.grass;
    const el = document.createElement('div');
    el.id = 'battle';
    el.innerHTML = `
      <div class="field">
        <div class="bg" style="background:${bg}"></div>
        <div class="scenery sc-${bgKey}"><div class="sky"></div><div class="hills"></div><div class="ground"></div></div>
        <div class="platform foe" style="background:radial-gradient(ellipse at 50% 40%, ${platL}, ${plat})"></div>
        <div class="platform me" style="background:radial-gradient(ellipse at 50% 40%, ${platL}, ${plat})"></div>
        <canvas class="trainer foe" width="300" height="450"></canvas>
        <canvas class="trainer me" width="300" height="450"></canvas>
        <div class="monbox foe"><img class="mon" alt="" style="visibility:hidden"></div>
        <div class="monbox me"><img class="mon" alt="" style="visibility:hidden"></div>
        <canvas class="fx"></canvas>
        <div class="bhud foe hidden"><div class="nm"><span class="n"></span><span class="g"></span><span class="s"></span><span class="lv"></span></div>
          <div class="hpl"><span>PS</span><div class="hpbar"><i></i></div></div><div class="balls"></div></div>
        <div class="bhud me hidden"><div class="nm"><span class="n"></span><span class="g"></span><span class="s"></span><span class="lv"></span></div>
          <div class="hpl"><span>PS</span><div class="hpbar"><i></i></div></div><div class="nums"></div><div class="exp"><i></i></div><div class="balls"></div></div>
      </div>
      <div class="bottom"><div class="msg"></div><div class="side"></div></div>`;
    this.el = el;
    this.q = (s) => el.querySelector(s);
    this.msgEl = this.q('.msg');
    this.sideEl = this.q('.side');
    this.fx = new BattleFX(this.q('canvas.fx'));
    this.layer = { el, onKey: (k) => { if (this.menuKey) this.menuKey(k); } };
    ui.push(this.layer);
    this.fx.resize();
    this.resizeFn = () => { this.fx.resize(); this.scaleSprites(); };
    window.addEventListener('resize', this.resizeFn);
    this.scale = Math.max(1.4, Math.min(2.8, window.innerHeight / 330, window.innerWidth / 230));
  }

  async intro() {
    const o = this.opts;
    // retratos dos treinadores
    const me = this.q('canvas.trainer.me'), foe = this.q('canvas.trainer.foe');
    drawPortrait(me, S().look, 0, 0);
    if (o.trainer && o.trainer.look) drawPortrait(foe, o.trainer.look, 2, 0);
    else foe.style.display = 'none';
    this.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
    me.animate([{ transform: 'translate(150%, -92%)' }, { transform: 'translate(-50%, -92%)' }], { duration: 500, easing: 'ease-out' });
    if (o.trainer) foe.animate([{ transform: 'translate(-250%, -92%)' }, { transform: 'translate(-50%, -92%)' }], { duration: 500, easing: 'ease-out' });
    await ui.wait(450);
  }

  // ------------------------------------------------------------ mensagens
  async say(text, hold = false) {
    const speed = [40, 24, 12, 2][S().options.textSpeed ?? 2] || 12;
    this.msgEl.textContent = '';
    let i = 0;
    let skip = false;
    const off = input.onPress((k) => { if (k === 'a' || k === 'enter') skip = true; });
    await new Promise((r) => {
      const tick = () => {
        if (skip) i = text.length; else i += 1;
        this.msgEl.textContent = text.slice(0, i);
        if (i >= text.length) r(); else setTimeout(tick, speed);
      };
      tick();
    });
    off();
    if (hold) return;
    await waitKeyOr(Math.max(650, Math.min(1600, text.length * 28)));
  }

  // ------------------------------------------------------------ sprites e HUD
  side(s) { return s === 0 ? 'me' : 'foe'; }
  box(s) { return this.q(`.monbox.${this.side(s)}`); }
  img(s) { return this.q(`.monbox.${this.side(s)} img`); }
  hud(s) { return this.q(`.bhud.${this.side(s)}`); }

  pos(s) {
    const field = this.q('.field').getBoundingClientRect();
    const r = this.img(s).getBoundingClientRect();
    if (!r.width) {
      const b = this.box(s).getBoundingClientRect();
      return [b.left - field.left, b.top - field.top - 60];
    }
    return [r.left - field.left + r.width / 2, r.top - field.top + r.height * 0.55];
  }

  async loadSprite(s, species, shiny) {
    const img = this.img(s);
    const urls = s === 0 ? [spriteUrl.back(species, shiny), spriteUrl.back(species, false)] : [spriteUrl.front(species, shiny), spriteUrl.frontStatic(species, shiny)];
    let ok = null;
    for (const u of urls) { ok = await Promise.race([loadImage(u), ui.wait(4000).then(() => null)]); if (ok) { img.src = u; break; } }
    if (!ok) img.src = fallbackSprite();
    img.dataset.nw = ok ? ok.naturalWidth : 64;
    img.dataset.nh = ok ? ok.naturalHeight : 64;
    this.scaleSprites();
  }

  scaleSprites() {
    for (const s of [0, 1]) {
      const img = this.img(s);
      const sc = s === 0 ? this.scale * 1.25 : this.scale;
      img.style.width = (+img.dataset.nw || 64) * sc + 'px';
      img.style.height = (+img.dataset.nh || 64) * sc + 'px';
    }
  }

  setHud(s, info, partyStatus) {
    const h = this.hud(s);
    h.classList.remove('hidden');
    h.querySelector('.n').textContent = info.name;
    h.querySelector('.g').innerHTML = genderHtml(info.gender);
    h.querySelector('.s').innerHTML = statusHtml(info.status);
    h.querySelector('.lv').textContent = 'Nv. ' + info.level;
    if (s === 1 && this.opts.kind === 'wild' && caughtSet().has(info.species)) h.querySelector('.s').insertAdjacentHTML('beforeend', ' <span title="Já capturado" style="display:inline-block;width:12px;height:12px;border-radius:50%;background:linear-gradient(#e3403b 50%,#fff 50%);border:1.5px solid #333"></span>');
    this.setHp(s, info.hp, info.maxhp);
    if (s === 0) this.setExp(info.expProg ?? 0);
    if (partyStatus) h.querySelector('.balls').innerHTML = partyStatus.map((a) => `<i class="${a ? '' : 'f'}"></i>`).join('');
  }

  setHp(s, hp, max) {
    const bar = this.hud(s).querySelector('.hpbar i');
    bar.style.width = Math.max(0, (hp / max) * 100) + '%';
    bar.className = hpClass(hp, max);
    if (s === 0) this.hud(0).querySelector('.nums').textContent = `${Math.max(0, Math.round(hp))}/${max}`;
  }

  async tweenHp(s, to, max) {
    const d = this.disp[s];
    if (!d) return;
    const from = d.hp;
    d.hp = to; d.maxhp = max;
    const dur = Math.min(900, 250 + Math.abs(to - from) / max * 900);
    const t0 = performance.now();
    await new Promise((r) => {
      const step = (now) => {
        const k = Math.min(1, (now - t0) / dur);
        this.setHp(s, from + (to - from) * k, max);
        if (k < 1) requestAnimationFrame(step); else r();
      };
      requestAnimationFrame(step);
    });
  }

  setExp(p) { this.hud(0).querySelector('.exp i').style.width = Math.max(0, Math.min(1, p)) * 100 + '%'; }

  async tweenExp(from, to) {
    const bar = this.hud(0).querySelector('.exp i');
    bar.style.transition = 'none';
    bar.style.width = from * 100 + '%';
    await ui.wait(30);
    bar.style.transition = 'width .6s';
    bar.style.width = Math.min(1, to) * 100 + '%';
    await ui.wait(650);
  }

  anim(el, cls, ms) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    return ui.wait(ms).then(() => el.classList.remove(cls));
  }

  // ------------------------------------------------------------ eventos
  async play(events, mySide = 0, party = null) {
    const S2 = (s) => (mySide === 0 ? s : 1 - s);
    for (const e of events) {
      const side = e.side !== undefined ? S2(e.side) : undefined;
      switch (e.type) {
        case 'msg': await this.say(e.text); break;
        case 'switch': await this.onSwitch(side, e.info, party); break;
        case 'anim': {
          const tside = S2(e.target);
          const self = side === tside;
          const mon = this.img(side);
          if (e.category !== 'Status') this.anim(mon, side === 0 ? 'anim-attack-me' : 'anim-attack-foe', 350);
          const ms = this.fx.move(e.moveType, e.category, this.pos(side), this.pos(tside), self);
          await ui.wait(Math.min(ms, 700));
          break;
        }
        case 'damage': {
          if (e.direct) {
            audio.sfx(e.eff > 1 ? 'superhit' : e.eff < 1 ? 'weakhit' : 'hit');
            if (e.crit) this.fx.flash('rgba(255,255,255,A)', 0.6);
            this.anim(this.img(side), 'anim-hit', 450);
          }
          await this.tweenHp(side, e.hp, e.maxhp);
          if (party && side === 0) this.syncParty(party, e);
          break;
        }
        case 'heal': await this.tweenHp(side, e.hp, e.maxhp); if (party && side === 0) this.syncParty(party, e); break;
        case 'status':
          if (this.disp[side]) { this.disp[side].status = e.status; this.hud(side).querySelector('.s').innerHTML = statusHtml(e.status); }
          if (party && side === 0) this.syncParty(party, e);
          break;
        case 'statusanim': this.fx.burst({ brn: 'Fire', par: 'Electric', psn: 'Poison', tox: 'Poison', slp: 'Psychic', frz: 'Ice', confusion: 'Psychic' }[e.status] || 'Normal', this.pos(side), 10); await ui.wait(300); break;
        case 'boost': audio.sfx(e.amount > 0 ? 'confirm' : 'cancel'); this.fx.statUp(this.pos(side), e.amount > 0); await ui.wait(500); break;
        case 'faint':
          audio.sfx('faint');
          await this.anim(this.img(side), 'anim-faint', 600);
          this.img(side).style.visibility = 'hidden';
          if (side === 1) this.hud(1).classList.add('hidden');
          break;
        case 'ball': await this.ballAnim(e); break;
        case 'charge': this.img(side).style.opacity = e.semi ? '0.15' : '1'; break;
        case 'substitute': this.img(side).style.opacity = e.on ? '0.55' : '1'; break;
        case 'transform': await this.loadSprite(side, e.species, false); break;
        case 'weather': break;
        case 'exp': await this.onExp(e); break;
        case 'levelup': await this.onLevelUp(e); break;
        case 'learn': await this.onLearn(e); break;
        default: break;
      }
    }
  }

  syncParty(party, e) {
    const d = this.disp[0];
    if (!d) return;
    const m = party[d.slot];
    if (!m) return;
    if (e.hp !== undefined) m.hp = e.hp;
    if (e.type === 'status') m.status = e.status;
  }

  async onSwitch(side, info, party) {
    const img = this.img(side);
    const prev = this.disp[side];
    if (prev && img.style.visibility !== 'hidden') {
      audio.sfx('ball');
      await this.anim(img, 'anim-return', 350);
    }
    img.style.visibility = 'hidden';
    img.style.opacity = '1';
    // treinador sai de cena
    const tr = this.q(`canvas.trainer.${this.side(side)}`);
    if (tr.style.display !== 'none' && !tr.dataset.gone) {
      tr.dataset.gone = '1';
      tr.animate([{ transform: 'translate(-50%, -92%)', opacity: 1 }, { transform: `translate(${side === 0 ? '-250%' : '150%'}, -92%)`, opacity: 0 }], { duration: 400, easing: 'ease-in', fill: 'forwards' });
    }
    const mon = this.opts.monLookup ? this.opts.monLookup(side, info) : null;
    this.disp[side] = { ...info };
    if (side === 0 && mon) this.disp[0].expProg = expProgress(mon);
    markSeen(info.species);
    await this.loadSprite(side, info.species, info.shiny);
    let partyStatus = null;
    if (side === 0 && party) partyStatus = party.map((m) => m.hp > 0);
    if (side === 1 && this.opts.foeParty) partyStatus = this.opts.foeParty.map((m) => m.hp > 0);
    this.setHud(side, this.disp[side], partyStatus);
    img.style.visibility = 'visible';
    audio.sfx('ball');
    this.anim(img, 'anim-enter', 500);
    if (info.shiny) setTimeout(() => this.fx.sparkle(this.pos(side)), 350);
    await ui.wait(520);
  }

  async ballAnim(e) {
    const field = this.q('.field');
    const ball = document.createElement('img');
    ball.className = 'ballimg';
    ball.src = itemSprite(e.item);
    field.appendChild(ball);
    const fr = field.getBoundingClientRect();
    const [tx, ty] = this.pos(1);
    const sx = fr.width * 0.15, sy = fr.height * 0.8;
    audio.sfx('ball');
    await ball.animate([
      { transform: `translate(${sx}px, ${sy}px) rotate(0deg) scale(1.2)` },
      { transform: `translate(${(sx + tx) / 2}px, ${ty - fr.height * 0.35}px) rotate(360deg) scale(1)`, offset: 0.5 },
      { transform: `translate(${tx - 18}px, ${ty - 18}px) rotate(720deg) scale(1)` },
    ], { duration: 650, easing: 'ease-out', fill: 'forwards' }).finished;
    if (e.shakes < 0) {
      // bloqueada pelo treinador
      await ball.animate([{ opacity: 1 }, { opacity: 0, transform: `translate(${tx + 60}px, ${ty}px)` }], { duration: 300, fill: 'forwards' }).finished;
      ball.remove();
      return;
    }
    this.fx.flash('rgba(255,255,255,A)', 0.5);
    await this.anim(this.img(1), 'anim-return', 350);
    this.img(1).style.visibility = 'hidden';
    const base = `translate(${tx - 18}px, ${ty + 30}px)`;
    await ball.animate([{ transform: `translate(${tx - 18}px, ${ty - 18}px)` }, { transform: base }], { duration: 300, easing: 'ease-in', fill: 'forwards' }).finished;
    for (let i = 0; i < e.shakes; i++) {
      await ui.wait(350);
      audio.sfx('wobble');
      await ball.animate([{ transform: base + ' rotate(0)' }, { transform: base + ' rotate(-25deg)' }, { transform: base + ' rotate(25deg)' }, { transform: base + ' rotate(0)' }], { duration: 450 }).finished;
    }
    await ui.wait(350);
    if (e.caught) {
      audio.sfx('caught');
      this.fx.sparkle([tx, ty + 48], '#fff6a0');
      ball.style.filter = 'brightness(0.7)';
      await ui.wait(700);
    } else {
      this.fx.flash('rgba(255,255,255,A)', 0.4);
      ball.remove();
      this.img(1).style.visibility = 'visible';
      await this.anim(this.img(1), 'anim-enter', 450);
    }
    if (e.caught) ball.remove();
  }

  async onExp(e) {
    const party = S().party;
    const mon = party.find((m) => m.uid === e.uid);
    if (!mon) return;
    await this.say(`${e.name} ganhou ${e.amount} pontos de experiência!`);
    if (this.disp[0] && this.disp[0].uid === e.uid && !e.levels) {
      const to = e.toProg ?? expProgress(mon);
      await this.tweenExp(this.disp[0].expProg ?? 0, e.leveled ? 1 : to);
      this.disp[0].expProg = e.leveled ? 0 : to;
    }
  }

  async onLevelUp(e) {
    const mon = S().party.find((m) => m.uid === e.uid);
    audio.sfx('levelup');
    if (this.disp[0] && this.disp[0].uid === e.uid && mon) {
      this.disp[0].level = e.level;
      this.hud(0).querySelector('.lv').textContent = 'Nv. ' + e.level;
      const mh = e.after[0];
      const hp = Math.min(mh, this.disp[0].hp + (e.after[0] - e.before[0]));
      this.disp[0].hp = hp; this.disp[0].maxhp = mh;
      this.setHp(0, hp, mh);
      this.fx.statUp(this.pos(0), true);
      await this.tweenExp(0, e.last ? (mon ? expProgress(mon) : 0) : 1);
      this.disp[0].expProg = e.last && mon ? expProgress(mon) : 0;
    }
    await this.say(`${e.name} subiu para o nível ${e.level}!`);
    const STAT = ['PS', 'Ataque', 'Defesa', 'At. Esp.', 'Def. Esp.', 'Velocidade'];
    const lines = STAT.map((n, i) => `${n} +${e.after[i] - e.before[i]}`).join('   ');
    this.msgEl.textContent = lines;
    await waitKeyOr(1600);
  }

  async onLearn(e) {
    const mon = S().party.find((m) => m.uid === e.uid);
    if (!mon) return;
    await learnMoveFlow(mon, e.move);
    markDirty();
  }

  // ------------------------------------------------------------ menus
  clearSide() { this.sideEl.innerHTML = ''; this.sideEl.className = 'side'; this.menuKey = null; }

  menu(buttons, cols = 2, onHover = null, cls = 'acts') {
    return new Promise((resolve) => {
      this.clearSide();
      this.sideEl.className = 'side ' + cls;
      let sel = 0;
      buttons.forEach((b, i) => {
        const el = document.createElement('button');
        el.className = b.cls || '';
        el.innerHTML = b.html;
        if (b.style) el.setAttribute('style', b.style);
        if (b.disabled) el.disabled = true;
        el.onclick = () => { if (!b.disabled) pick(i); };
        el.onmouseenter = () => { sel = i; paint(); };
        this.sideEl.appendChild(el);
      });
      const paint = () => {
        [...this.sideEl.children].forEach((el, i) => el.classList.toggle('sel', i === sel));
        if (onHover) onHover(sel);
      };
      const pick = (i) => { audio.sfx('confirm'); this.clearSide(); this.cancelMenu = null; resolve(i); };
      this.cancelMenu = () => { this.clearSide(); this.cancelMenu = null; resolve(-1); };
      this.menuKey = (k) => {
        const n = buttons.length;
        if (k === 'left') sel = (sel + n - 1) % n;
        else if (k === 'right') sel = (sel + 1) % n;
        else if (k === 'up') sel = (sel - cols + n) % n;
        else if (k === 'down') sel = (sel + cols) % n;
        else if (k === 'a' || k === 'enter') { if (!buttons[sel].disabled) pick(sel); return; }
        else if (k === 'b') { this.clearSide(); resolve(-1); return; }
        audio.sfx('select');
        paint();
      };
      paint();
    });
  }

  async chooseAction(ctx) {
    // ctx: { mon, foeTypes, canRun, canBag, pvp }
    while (true) {
      if (this.aborted) return null;
      this.msgEl.textContent = `O que ${monName(ctx.mon)} vai fazer?`;
      const i = await this.menu([
        { html: 'LUTAR', cls: 'fight' },
        { html: 'BOLSA', cls: 'bag', disabled: !ctx.canBag },
        { html: 'POKÉMON', cls: 'pkmn' },
        { html: ctx.pvp ? 'DESISTIR' : 'FUGIR', cls: 'run' },
      ]);
      if (this.aborted) return null;
      if (i === 0) {
        const m = await this.chooseMove(ctx);
        if (this.aborted) return null;
        if (m !== null) return m;
      } else if (i === 1) {
        const a = await this.chooseBag(ctx);
        if (a) return a;
      } else if (i === 2) {
        const idx = await pickPartyMon('Trocar de Pokémon', {
          party: ctx.party,
          filter: (m, j) => (m.hp <= 0 ? `${monName(m)} não tem energia para lutar!` : j === ctx.activeSlot ? `${monName(m)} já está em batalha!` : null),
        });
        if (idx >= 0) return { type: 'switch', index: idx };
      } else if (i === 3) {
        if (ctx.pvp) { if (await ui.ask('Desistir da batalha?')) return { type: 'forfeit' }; }
        else return { type: 'run' };
      }
    }
  }

  async chooseMove(ctx) {
    const mon = ctx.mon;
    const usable = mon.moves.map((m) => m.pp > 0);
    if (!usable.some(Boolean)) {
      await this.say(`${monName(mon)} não tem mais PP!`);
      return { type: 'move', move: -1 };
    }
    const btns = mon.moves.map((m) => {
      const md = MOVES[m.id];
      let eff = '';
      if (ctx.foeTypes && md.category !== 'Status') {
        const e = typeEffect(md.type, ctx.foeTypes);
        eff = e === 0 ? 'Sem efeito' : e > 1 ? 'Super efetivo' : e < 1 ? 'Pouco efetivo' : '';
      }
      return {
        html: `${esc(md.name)}<small><span>${TYPE_PT[md.type]}${eff ? ' • ' + eff : ''}</span><span>PP ${m.pp}/${m.ppMax}</span></small>`,
        style: `background:linear-gradient(${TYPE_COLOR[md.type]}, ${shadeHex(TYPE_COLOR[md.type])})`,
        disabled: m.pp <= 0,
      };
    });
    while (btns.length < 4) btns.push({ html: '—', disabled: true, style: 'background:#555' });
    const i = await this.menu(btns, 2, (s) => { const m = mon.moves[s]; this.msgEl.textContent = m ? moveDesc(m.id) : ''; }, 'moves');
    this.sideEl.className = 'side';
    if (i < 0) return null;
    return { type: 'move', move: i };
  }

  async chooseBag(ctx) {
    const pockets = ctx.kind === 'wild' ? ['balls', 'medicine', 'berries'] : ['medicine', 'berries', 'balls'];
    const id = await pickItem('Bolsa', pockets);
    if (!id) return null;
    const it = ITEMS[id];
    if (it.pocket === 'balls') {
      if (ctx.kind !== 'wild') { await this.say('Não dá para capturar o Pokémon de outro treinador!'); return null; }
      if (it.safari && this.opts.zoneName !== 'Zona Safári') { await this.say('A Safari Bola só funciona dentro da Zona Safári!'); return null; }
      if (S().party.length >= 6 && S().pc.length >= 2000) { await this.say('Não há espaço para mais Pokémon!'); return null; }
      useItem(id);
      return { type: 'ball', item: id };
    }
    if (it.revive || it.heal || it.cure || it.pp) {
      const idx = await pickPartyMon(`Usar ${it.name} em qual Pokémon?`, {
        party: ctx.party,
        filter: (m) => {
          if (it.revive) return m.hp > 0 ? 'Não está desmaiado.' : null;
          if (m.hp <= 0) return 'Este Pokémon desmaiou.';
          if (it.heal && !it.cure && m.hp >= maxHp(m)) return 'Os PS já estão cheios.';
          if (it.cure && !it.heal && !(m.status && (it.cure === 'all' || it.cure === m.status || (it.cure === 'psn' && m.status === 'tox')))) return 'Não teria efeito.';
          return null;
        },
      });
      if (idx < 0) return null;
      let moveIndex = 0;
      if (it.pp && !it.allPp) {
        const { pickMove } = await import('./pickers.js');
        moveIndex = await pickMove(ctx.party[idx], 'Restaurar PP de qual golpe?');
        if (moveIndex < 0) return null;
      }
      useItem(id);
      return { type: 'item', item: id, target: idx, moveIndex };
    }
    await this.say('Não dá para usar isso agora.');
    return null;
  }

  abort() {
    this.aborted = true;
    if (this.cancelMenu) this.cancelMenu();
    const i = ui.stack.indexOf(this.layer);
    if (i >= 0) for (const l of ui.stack.slice(i + 1)) { if (l.close) l.close(); else ui.pop(l); }
  }

  async close() {
    this.clearSide();
    await this.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300 }).finished;
    window.removeEventListener('resize', this.resizeFn);
    ui.pop(this.layer);
  }
}

function shadeHex(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.floor(((n >> 16) & 255) * 0.72), g = Math.floor(((n >> 8) & 255) * 0.72), b = Math.floor((n & 255) * 0.72);
  return `rgb(${r},${g},${b})`;
}

// ============================================================ batalhas locais
// opts: { kind: 'wild'|'trainer', foe: [mons], trainer: {name, cls, look, reward, defeat, gym}, terrain }
export async function runBattle(opts) {
  const s = S();
  const party = s.party;
  const foe = opts.foe;
  s.stats.battles++;
  const expHook = (battle, fainted, participants) => {
    const events = [];
    const base = expYield(fainted, opts.kind === 'trainer');
    for (const mon of party) {
      if (mon.hp <= 0 || mon.level >= 100) continue;
      const part = participants.has(mon.uid);
      if (!part && !s.expShareOn) continue;
      const amt = part ? base : Math.max(1, Math.floor(base / 2));
      const lvls = gainExp(mon, amt);
      events.push({ type: 'exp', uid: mon.uid, amount: amt, name: monName(mon), leveled: lvls.length > 0, toProg: expProgress(mon) });
      lvls.forEach((L, i) => {
        events.push({ type: 'levelup', uid: mon.uid, level: L.level, before: L.before, after: L.after, name: monName(mon), last: i === lvls.length - 1 });
        for (const mv of L.moves) events.push({ type: 'learn', uid: mon.uid, move: mv });
        mon._evoCheck = true;
      });
    }
    return events;
  };
  const engine = new Battle({
    kind: opts.kind,
    sides: [
      { name: state.name, party },
      { name: opts.trainer ? opts.trainer.name : '', party: foe, ai: opts.kind === 'wild' ? 'wild' : 'trainer', trainerClass: opts.trainer ? opts.trainer.cls : '' },
    ],
    env: { terrain: opts.terrain, time: timeOfDay(net.now()) === 'night' ? 'night' : 'day', caughtSpecies: caughtSet() },
    hooks: { onOpponentFaint: expHook },
  });
  const v = new BattleView({ ...opts, foeParty: foe, monLookup: (side, info) => (side === 0 ? party.find((m) => m.uid === info.uid) : null) });
  audio.play(opts.music || (opts.kind === 'trainer' ? (opts.trainer && opts.trainer.gym ? 'gym' : 'battle') : 'battle'));
  await v.intro();
  await v.play(engine.start(), 0, party);
  while (!engine.over) {
    let action = null;
    const need = engine.needs[0];
    if (need === 'switch') {
      let idx = -1;
      while (idx < 0) {
        idx = await pickPartyMon('Escolha o próximo Pokémon', {
          party, noCancel: true,
          filter: (m, j) => (m.hp <= 0 ? `${monName(m)} não tem energia para lutar!` : j === engine.sides[0].active.slot ? 'Já está em batalha!' : null),
        });
      }
      action = { type: 'switch', index: idx };
    } else if (need === 'action') {
      const act = engine.sides[0].active;
      action = await v.chooseAction({
        mon: act.mon, party, activeSlot: act.slot, foeTypes: engine.sides[1].active ? engine.sides[1].active.types : null,
        kind: opts.kind, canBag: true,
      });
    }
    if (action) engine.choose(0, action);
    await v.play(engine.step(), 0, party);
  }
  // ---------------- resultado
  let result = engine.result;
  if (result === 'win') {
    if (opts.kind === 'trainer') {
      const tr = opts.trainer;
      v.clearSide();
      if (tr.defeat) await v.say(`${tr.cls ? tr.cls + ' ' : ''}${tr.name}: "${tr.defeat}"`);
      const prize = tr.reward + engine.moneyBonus;
      if (prize > 0) {
        addMoney(prize);
        audio.sfx('money');
        await v.say(`Você recebeu ${money(prize)} pela vitória!`);
      }
    } else {
      const lv = foe[0].level;
      const prize = Math.round(lv * 8 + engine.moneyBonus);
      addMoney(prize);
      await v.say(`Você encontrou ${money(prize)} depois da batalha!`);
    }
    audio.play('victory');
  } else if (result === 'caught') {
    const mon = engine.caught;
    healIfNeeded(mon);
    const isNew = !caughtSet().has(mon.species);
    mon.hp = Math.max(1, mon.hp);
    mon.status = mon.status || null;
    if (ITEMS[mon.ball] && ITEMS[mon.ball].heals) healMon(mon);
    if (ITEMS[mon.ball] && ITEMS[mon.ball].friend) mon.friendship = 120;
    mon.met = opts.zoneName || '';
    s.stats.caught++;
    if (isNew) await v.say(`Os dados de ${POKEDEX[mon.species].name} foram registrados na Pokédex!`);
    v.clearSide();
    if (await ui.ask(`Dar um apelido ao ${POKEDEX[mon.species].name}?`)) {
      const nick = await ui.prompt('Apelido', POKEDEX[mon.species].name, 12);
      if (nick && nick !== POKEDEX[mon.species].name) mon.nick = nick;
    }
    const where = addPokemon(mon);
    if (where === 'pc') await v.say(`${monName(mon)} foi enviado para o PC.`);
  } else if (result === 'lose' && opts.noLoss) {
    await v.say('Seus Pokémon não aguentam mais lutar...');
  } else if (result === 'lose') {
    const lost = Math.floor(s.money * 0.1);
    addMoney(-lost);
    await v.say(lost ? `Você deixou cair ${money(lost)} na correria...` : 'Você ficou atordoado...');
    await v.say('Você correu de volta para o Centro Pokémon!');
  }
  await v.close();
  markDirty();
  return { result, engine, foe, kind: opts.kind };
}

function healIfNeeded(mon) {
  if (mon.hp <= 0) mon.hp = 1;
}

// ============================================================ PvP
// start: mensagem 'pvpStart' recebida do servidor
export async function runPvp(start) {
  const mySide = start.side;
  const party = start.myParty;
  const foeParty = start.foeParty.map((m) => ({ ...m, hp: 1 }));
  let activeSlot = 0;
  const queue = [];
  let waiter = null;
  let view = null;
  const onEv = (m) => {
    queue.push(m);
    if (m.over && view && !waiter) view.abort();
    if (waiter) { const w = waiter; waiter = null; w(); }
  };
  net.on('pvpEvents', onEv);
  const onWait = (m) => ui.toast(m.text);
  net.on('pvpWaiting', onWait);
  // se a conexão cair, a batalha termina (o servidor conta como desistência)
  const onDrop = () => onEv({ events: [{ type: 'msg', text: 'A conexão caiu. A batalha foi encerrada.' }], needs: null, over: true, result: 'disconnect', winner: 1 - mySide });
  net.on('close', onDrop);
  const next = () => new Promise((r) => { if (queue.length) r(); else waiter = r; }).then(() => queue.shift());
  const v = new BattleView({
    kind: 'pvp', terrain: 'gym', foeParty,
    trainer: { name: start.opponent, look: start.opponentLook },
    monLookup: (side, info) => (side === 0 ? party.find((m) => m.uid === info.uid) : null),
  });
  view = v;
  audio.play('gym');
  await v.intro();
  const track = (events) => {
    for (const e of events) {
      if (e.type === 'switch' && e.side === mySide) activeSlot = e.info.slot;
      if (e.type === 'faint' && e.side !== mySide) { const f = foeParty.find((m) => m.uid === e.uid); if (f) f.hp = 0; }
    }
  };
  track(start.events);
  await v.play(start.events, mySide, party);
  let needs = start.needs;
  let final = null;
  while (true) {
    if (needs) {
      let action;
      if (needs === 'switch') {
        let idx = -1;
        while (idx < 0 && !v.aborted) {
          idx = await pickPartyMon('Escolha o próximo Pokémon', {
            party, noCancel: true,
            filter: (m, j) => (m.hp <= 0 ? 'Desmaiado!' : j === activeSlot ? 'Já está em batalha!' : null),
          });
        }
        action = { type: 'switch', index: idx };
      } else {
        const mon = party[activeSlot];
        action = await v.chooseAction({ mon, party, activeSlot, foeTypes: null, kind: 'pvp', canBag: false, pvp: true });
        if (action && action.type === 'move' && mon.moves[action.move]) mon.moves[action.move].pp = Math.max(0, mon.moves[action.move].pp - 1);
      }
      if (!action || v.aborted || (action.type === 'switch' && action.index < 0)) { /* a batalha já terminou */ }
      else if (action.type === 'forfeit') net.send({ t: 'pvpForfeit' });
      else net.send({ t: 'pvpAction', action });
      v.msgEl.textContent = 'Aguardando o oponente...';
    }
    const m = await next();
    track(m.events);
    await v.play(m.events, mySide, party);
    needs = m.needs;
    if (m.over) {
      final = m.result === 'draw' ? 'draw' : m.winner === mySide ? 'win' : 'lose';
      break;
    }
  }
  if (final === 'win') { S().stats.pvpWins++; audio.play('victory'); await v.say('Você venceu a batalha!'); }
  else if (final === 'lose') await v.say('Você perdeu a batalha... Boa luta!');
  else await v.say('A batalha terminou empatada!');
  net.off('pvpEvents', onEv);
  net.off('pvpWaiting', onWait);
  net.off('close', onDrop);
  await v.close();
  markDirty();
  return final;
}

export { BattleView };
void hasItem; void isUsable;
