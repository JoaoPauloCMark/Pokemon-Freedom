// Teclado e controles de toque.
// Direções: 0 = cima, 1 = direita, 2 = baixo, 3 = esquerda

// Ações que o jogador pode reconfigurar (nome exibido e teclas padrão).
export const ACTIONS = [
  ['up', 'Andar para cima', ['ArrowUp', 'KeyW']],
  ['down', 'Andar para baixo', ['ArrowDown', 'KeyS']],
  ['left', 'Andar para a esquerda', ['ArrowLeft', 'KeyA']],
  ['right', 'Andar para a direita', ['ArrowRight', 'KeyD']],
  ['a', 'Interagir / Confirmar', ['KeyZ', 'Space']],
  ['b', 'Menu / Voltar', ['KeyX', 'Backspace']],
  ['run', 'Correr (segurando)', ['ShiftLeft', 'ShiftRight']],
  ['runToggle', 'Ligar/desligar corrida', ['KeyR']],
  ['bike', 'Bicicleta', ['KeyB']],
  ['map', 'Mapa', ['KeyM']],
  ['chat', 'Chat', ['KeyT']],
  ['fish', 'Pescar', ['KeyF']],
  ['party', 'Equipe', ['KeyP']],
  ['bag', 'Bolsa', ['KeyI']],
  ['emote', 'Expressões / Decorar casa', ['KeyE']],
  ['poketch', 'Pokétch', ['KeyQ']],
  ['jobs', 'Trabalhos', ['KeyJ']],
  ['controls', 'Ver controles', ['KeyH', 'F1']],
];
// Teclas fixas (não reconfiguráveis)
const FIXED = { Enter: 'enter', Escape: 'b' };
const STORE_KEY = 'pkfreedom_keys';

function loadBindings() {
  const out = {};
  for (const [id, , def] of ACTIONS) out[id] = def.slice();
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (saved) for (const id of Object.keys(out)) if (Array.isArray(saved[id])) out[id] = saved[id].slice(0, 2);
  } catch { /* sem storage */ }
  return out;
}

let BINDINGS = loadBindings();
let KEYMAP = {};
function rebuildKeymap() {
  KEYMAP = { ...FIXED };
  for (const [id, codes] of Object.entries(BINDINGS)) for (const c of codes) if (c && !FIXED[c]) KEYMAP[c] = id;
}
rebuildKeymap();

export function getBindings() { return BINDINGS; }

// Define a tecla `slot` (0 ou 1) de uma ação; tira a tecla de qualquer outra ação.
export function setBinding(action, slot, code) {
  if (FIXED[code]) return false;
  for (const codes of Object.values(BINDINGS)) for (let i = 0; i < codes.length; i++) if (codes[i] === code) codes[i] = null;
  const list = BINDINGS[action];
  while (list.length < 2) list.push(null);
  list[slot] = code;
  persist();
  return true;
}

export function resetBindings() {
  try { localStorage.removeItem(STORE_KEY); } catch { /* sem storage */ }
  BINDINGS = loadBindings();
  rebuildKeymap();
}

function persist() {
  rebuildKeymap();
  try { localStorage.setItem(STORE_KEY, JSON.stringify(BINDINGS)); } catch { /* sem storage */ }
}

// Nome amigável de uma tecla
export function keyLabel(code) {
  if (!code) return '—';
  const named = {
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Espaço', Enter: 'Enter', Escape: 'Esc',
    Backspace: 'Backspace', ShiftLeft: 'Shift esq.', ShiftRight: 'Shift dir.', ControlLeft: 'Ctrl esq.', ControlRight: 'Ctrl dir.',
    AltLeft: 'Alt', Tab: 'Tab', CapsLock: 'Caps Lock',
  };
  if (named[code]) return named[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code;
}

export const DIRS = { up: 0, right: 1, down: 2, left: 3 };
export const DXY = [[0, -1], [1, 0], [0, 1], [-1, 0]];

class Input {
  constructor() {
    this.held = new Set();
    this.order = []; // ordem das direções pressionadas (a última vence)
    this.pressed = [];
    this.listeners = [];
    this.enabled = true;
    this.pressId = 0; // incrementa a cada tecla nova (para saber se a UI já a consumiu)
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => { this.held.clear(); this.order = []; });
    // ao começar a digitar (chat, apelido...), solta as teclas de movimento
    window.addEventListener('focusin', () => { if (this.isTyping()) { this.held.clear(); this.order = []; } });
    this.setupTouch();
  }

  isTyping() {
    const el = document.activeElement;
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
  }

  onKey(e, down) {
    const k = KEYMAP[e.code];
    if (this.capture) { if (down) { e.preventDefault(); const fn = this.capture; this.capture = null; fn(e.code); } return; }
    if (this.isTyping()) {
      if (down && (e.code === 'Escape' || e.code === 'Enter')) this.listeners.forEach((fn) => fn(e.code === 'Escape' ? 'b' : 'enter', e));
      if (down) return;
    }
    if (!k) return;
    if (['up', 'down', 'left', 'right', 'a', 'enter'].includes(k) || e.code === 'Space') e.preventDefault();
    if (down) {
      if (!this.held.has(k)) {
        this.held.add(k);
        if (DIRS[k] !== undefined) this.order.push(k);
        this.pressed.push(k);
        this.pressId++;
        for (const fn of this.listeners) fn(k, e);
      }
    } else {
      this.held.delete(k);
      this.order = this.order.filter((x) => x !== k);
    }
  }

  // Direção mantida pressionada (ou -1)
  dir() {
    for (let i = this.order.length - 1; i >= 0; i--) if (this.held.has(this.order[i])) return DIRS[this.order[i]];
    return -1;
  }

  isHeld(k) { return this.held.has(k); }

  consume() {
    const p = this.pressed;
    this.pressed = [];
    return p;
  }

  onPress(fn) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter((f) => f !== fn); };
  }

  // simula teclas (botões da tela de toque)
  virtual(k, down) {
    if (down) {
      if (this.held.has(k)) return;
      this.held.add(k);
      if (DIRS[k] !== undefined) this.order.push(k);
      this.pressed.push(k);
      this.pressId++;
      for (const fn of this.listeners) fn(k, null);
    } else {
      this.held.delete(k);
      this.order = this.order.filter((x) => x !== k);
    }
  }

  setupTouch() {
    const bind = (sel, key) => {
      document.querySelectorAll(sel).forEach((b) => {
        const k = key(b);
        const on = (e) => { e.preventDefault(); this.virtual(k, true); };
        const off = (e) => { e.preventDefault(); this.virtual(k, false); };
        b.addEventListener('touchstart', on, { passive: false });
        b.addEventListener('touchend', off, { passive: false });
        b.addEventListener('touchcancel', off, { passive: false });
        b.addEventListener('mousedown', on);
        b.addEventListener('mouseup', off);
        b.addEventListener('mouseleave', off);
      });
    };
    const names = ['up', 'right', 'down', 'left'];
    window.addEventListener('DOMContentLoaded', () => {
      bind('#dpad button', (b) => names[+b.dataset.dir]);
      bind('#abtns button, #runbtn button', (b) => b.dataset.key);
    });
    if (document.readyState !== 'loading') {
      bind('#dpad button', (b) => names[+b.dataset.dir]);
      bind('#abtns button, #runbtn button', (b) => b.dataset.key);
    }
  }
}

export const input = new Input();
