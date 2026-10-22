// Sistema de interface: pilha de camadas, diálogos, escolhas, avisos e painéis.
import { input } from '../input.js';
import { audio } from '../audio.js';
import { state } from '../state.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

class UI {
  constructor() {
    this.root = document.getElementById('ui');
    this.stack = [];
    input.onPress((k, e) => this.handleKey(k, e));
  }

  get busy() { return this.stack.length > 0; }

  // true se a tecla atual já foi tratada por alguma camada da interface
  consumed() { return this.handledPressId === input.pressId; }

  push(layer) {
    this.stack.push(layer);
    if (layer.el && !layer.el.parentNode) this.root.appendChild(layer.el);
    return layer;
  }

  pop(layer) {
    const i = this.stack.indexOf(layer);
    if (i >= 0) this.stack.splice(i, 1);
    if (layer.el && layer.el.parentNode) layer.el.remove();
  }

  closeAll() {
    for (const l of [...this.stack]) { if (l.close) l.close(); else this.pop(l); }
  }

  handleKey(k, e) {
    const top = this.stack[this.stack.length - 1];
    if (!top || !top.onKey) return;
    if (input.isTyping() && k !== 'enter' && k !== 'b') return;
    this.handledPressId = input.pressId;
    top.onKey(k, e);
  }

  el(html, cls = '') {
    const d = document.createElement('div');
    if (cls) d.className = cls;
    d.innerHTML = html;
    return d;
  }

  // ------------------------------------------------------------ diálogo
  dialog(texts, opts = {}) {
    const list = Array.isArray(texts) ? texts.slice() : [texts];
    return new Promise((resolve) => {
      const el = this.el('<div class="who"></div><div class="txt"></div><div class="more"></div>', 'dialog');
      const who = el.querySelector('.who'), txt = el.querySelector('.txt'), more = el.querySelector('.more');
      if (opts.who) who.textContent = opts.who; else who.remove();
      let idx = 0, shown = 0, full = '', timer = null;
      const speed = [40, 22, 10, 1][state.save?.options?.textSpeed ?? 2] || 10;
      const layer = { el };
      const show = () => {
        full = list[idx];
        shown = 0;
        more.style.visibility = 'hidden';
        clearInterval(timer);
        timer = setInterval(() => {
          shown += 1;
          txt.textContent = full.slice(0, shown);
          if (shown >= full.length) { clearInterval(timer); timer = null; more.style.visibility = 'visible'; }
        }, speed);
      };
      const advance = () => {
        if (timer) { clearInterval(timer); timer = null; txt.textContent = full; more.style.visibility = 'visible'; return; }
        audio.sfx('select');
        idx++;
        if (idx >= list.length) { this.pop(layer); resolve(); return; }
        show();
      };
      layer.onKey = (k) => { if (k === 'a' || k === 'enter' || k === 'b') advance(); };
      el.addEventListener('click', advance);
      this.push(layer);
      show();
    });
  }

  // ------------------------------------------------------------ escolha
  choice(text, options, opts = {}) {
    return new Promise(async (resolve) => {
      let dlg = null;
      if (text) {
        dlg = this.el(`<div class="txt">${esc(text)}</div>`, 'dialog');
        if (opts.who) dlg.insertAdjacentHTML('afterbegin', `<div class="who">${esc(opts.who)}</div>`);
        this.root.appendChild(dlg);
      }
      const box = this.el('', 'choices');
      let sel = 0;
      options.forEach((o, i) => {
        const b = document.createElement('button');
        b.textContent = o;
        b.onclick = () => done(i);
        b.onmouseenter = () => { sel = i; paint(); };
        box.appendChild(b);
      });
      const paint = () => [...box.children].forEach((b, i) => b.classList.toggle('sel', i === sel));
      const layer = { el: box };
      const done = (i) => {
        this.pop(layer);
        if (dlg) dlg.remove();
        audio.sfx(i >= 0 ? 'confirm' : 'cancel');
        resolve(i);
      };
      layer.onKey = (k) => {
        if (k === 'up') { sel = (sel + options.length - 1) % options.length; paint(); audio.sfx('select'); }
        else if (k === 'down') { sel = (sel + 1) % options.length; paint(); audio.sfx('select'); }
        else if (k === 'a' || k === 'enter') done(sel);
        else if (k === 'b' && opts.cancel !== false) done(-1);
      };
      paint();
      this.push(layer);
    });
  }

  async ask(text, opts = {}) {
    const r = await this.choice(text, ['Sim', 'Não'], opts);
    return r === 0;
  }

  // ------------------------------------------------------------ texto livre
  prompt(title, value = '', maxLen = 12) {
    return new Promise((resolve) => {
      const ov = this.el(`<div class="panel win" style="width:min(420px,92vw)"><div class="win-head"><h2>${esc(title)}</h2></div>
        <div class="body col"><div class="field"><input maxlength="${maxLen}" value="${esc(value)}"></div>
        <div class="row" style="justify-content:flex-end"><button class="btn" data-a="c">Cancelar</button><button class="btn red" data-a="ok">OK</button></div></div></div>`, 'overlay');
      const inp = ov.querySelector('input');
      const layer = { el: ov };
      const done = (v) => { this.pop(layer); resolve(v); };
      ov.querySelector('[data-a=ok]').onclick = () => done(inp.value.trim());
      ov.querySelector('[data-a=c]').onclick = () => done(null);
      layer.onKey = (k) => { if (k === 'enter') done(inp.value.trim()); if (k === 'b') done(null); };
      this.push(layer);
      setTimeout(() => { inp.focus(); inp.select(); }, 30);
    });
  }

  // quantidade (lojas)
  quantity(title, max, unitPrice = 0) {
    return new Promise((resolve) => {
      let n = 1;
      const ov = this.el(`<div class="panel win" style="width:min(360px,92vw)"><div class="win-head"><h2>${esc(title)}</h2></div>
        <div class="body col"><div class="row" style="justify-content:center;gap:16px"><button class="btn" data-d="-1">−</button><b class="n" style="font-size:28px;min-width:60px;text-align:center">1</b><button class="btn" data-d="1">+</button></div>
        <div class="muted tot" style="text-align:center"></div>
        <div class="row" style="justify-content:flex-end"><button class="btn" data-a="c">Cancelar</button><button class="btn red" data-a="ok">OK</button></div></div></div>`, 'overlay');
      const nEl = ov.querySelector('.n'), tot = ov.querySelector('.tot');
      const paint = () => { nEl.textContent = n; tot.textContent = unitPrice ? `Total: ₽${(n * unitPrice).toLocaleString('pt-BR')}` : ''; };
      const layer = { el: ov };
      const done = (v) => { this.pop(layer); resolve(v); };
      ov.querySelectorAll('[data-d]').forEach((b) => b.onclick = () => { n = Math.max(1, Math.min(max, n + +b.dataset.d)); paint(); });
      ov.querySelector('[data-a=ok]').onclick = () => done(n);
      ov.querySelector('[data-a=c]').onclick = () => done(0);
      layer.onKey = (k) => {
        if (k === 'up' || k === 'right') n = Math.min(max, n + (k === 'up' ? 1 : 10));
        if (k === 'down' || k === 'left') n = Math.max(1, n - (k === 'down' ? 1 : 10));
        if (k === 'a' || k === 'enter') return done(n);
        if (k === 'b') return done(0);
        paint();
      };
      paint();
      this.push(layer);
    });
  }

  // ------------------------------------------------------------ avisos
  toast(text, type = '') {
    const box = document.getElementById('toasts');
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = text;
    box.appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; }, 2600);
    setTimeout(() => t.remove(), 3100);
  }

  // ------------------------------------------------------------ painel genérico
  // build(body, layer) monta o conteúdo; retorna a camada (com close()).
  panel({ title, sub = '', width = 'min(900px, 96vw)', build, onKey, onClose, cls = '', backdrop = true }) {
    const ov = this.el(`<div class="panel win ${cls}" style="width:${width}">
      <div class="win-head"><h2>${title}</h2>${sub ? `<span class="sub">${sub}</span>` : ''}<button class="close" title="Fechar (X)">✕</button></div>
      <div class="body col grow" style="min-height:0"></div></div>`, 'overlay');
    const body = ov.querySelector('.body');
    const layer = { el: ov, body };
    layer.close = () => { this.pop(layer); if (onClose) onClose(); };
    ov.querySelector('.close').onclick = () => { audio.sfx('cancel'); layer.close(); };
    if (backdrop) ov.addEventListener('mousedown', (e) => { if (e.target === ov) { layer.close(); } });
    layer.onKey = (k, e) => {
      if (onKey && onKey(k, e) === true) return;
      if (k === 'b') { audio.sfx('cancel'); layer.close(); }
    };
    layer.setTitle = (t) => { ov.querySelector('h2').firstChild.textContent = t; };
    this.push(layer);
    // monta depois do retorno, para que quem chamou já tenha a referência da camada
    if (build) queueMicrotask(() => build(body, layer));
    return layer;
  }

  wait(ms) { return new Promise((r) => setTimeout(r, ms)); }
}

export const ui = new UI();

export function fade(on, white = false) {
  const f = document.getElementById('fade');
  f.classList.toggle('white', white);
  f.classList.toggle('on', on);
  return new Promise((r) => setTimeout(r, 260));
}

export function money(n) {
  return '₽' + Math.round(n).toLocaleString('pt-BR');
}
