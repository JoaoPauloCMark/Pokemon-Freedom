// Efeitos de partículas para golpes na batalha.
import { TYPE_COLOR } from '../../shared/data/types.js';

const STYLE = {
  Fire: { colors: ['#ffef8a', '#ffb02e', '#ff5a1f'], shape: 'flame', glow: true },
  Water: { colors: ['#d6f1ff', '#6fc3ff', '#2f7fe0'], shape: 'drop' },
  Grass: { colors: ['#b8f28a', '#5cc24f', '#2f8a3a'], shape: 'leaf' },
  Electric: { colors: ['#fff7a8', '#ffe03a', '#ffb800'], shape: 'bolt', glow: true },
  Ice: { colors: ['#ffffff', '#c8f0ff', '#7fd6f0'], shape: 'crystal', glow: true },
  Psychic: { colors: ['#ffc2dc', '#ff6fa8', '#d63d82'], shape: 'ring' },
  Ghost: { colors: ['#d4b8ff', '#8a5ad8', '#4a2a7a'], shape: 'wisp' },
  Dark: { colors: ['#8a7a9a', '#4a3a5a', '#1e1424'], shape: 'wisp' },
  Fighting: { colors: ['#ffd29a', '#f07a3a', '#b8331f'], shape: 'star' },
  Poison: { colors: ['#e8b0ff', '#b155d8', '#6e2a8f'], shape: 'bubble' },
  Ground: { colors: ['#e8cf8a', '#b8913f', '#7a5a22'], shape: 'rock' },
  Rock: { colors: ['#d9d2c0', '#a69a7c', '#6e624c'], shape: 'rock' },
  Flying: { colors: ['#ffffff', '#dceeff', '#a8c8f0'], shape: 'wind' },
  Bug: { colors: ['#e6f59a', '#a6c21a', '#6b7f12'], shape: 'dot' },
  Dragon: { colors: ['#c8b0ff', '#7a4cf0', '#3a1fa8'], shape: 'flame', glow: true },
  Steel: { colors: ['#ffffff', '#d8dde8', '#9aa4b8'], shape: 'star', glow: true },
  Fairy: { colors: ['#ffffff', '#ffc2e6', '#f080c0'], shape: 'sparkle', glow: true },
  Normal: { colors: ['#ffffff', '#f0ecd8', '#c8c0a0'], shape: 'star' },
  '???': { colors: ['#ffffff', '#dddddd', '#999999'], shape: 'star' },
};

export class BattleFX {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.parts = [];
    this.flashes = [];
    this.running = false;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const d = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = r.width * d;
    this.canvas.height = r.height * d;
    this.d = d;
  }

  loop() {
    if (this.running) return;
    this.running = true;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.update(dt);
      this.draw();
      if (this.parts.length || this.flashes.length) requestAnimationFrame(tick);
      else { this.running = false; this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }
    };
    requestAnimationFrame(tick);
  }

  update(dt) {
    for (const p of this.parts) {
      p.t += dt;
      if (p.t < 0) continue;
      if (p.target) {
        const k = Math.min(1, p.t / p.dur);
        const e = k * k * (3 - 2 * k);
        p.x = p.x0 + (p.target[0] - p.x0) * e + Math.sin(k * Math.PI) * p.arcX;
        p.y = p.y0 + (p.target[1] - p.y0) * e - Math.sin(k * Math.PI) * p.arcY;
      } else {
        p.vy += (p.g || 0) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      p.rot += p.vr * dt;
    }
    this.parts = this.parts.filter((p) => p.t < p.life);
    for (const f of this.flashes) f.t += dt;
    this.flashes = this.flashes.filter((f) => f.t < f.life);
  }

  draw() {
    const ctx = this.ctx;
    const d = this.d || 1;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const f of this.flashes) {
      const a = (1 - f.t / f.life) * f.a;
      ctx.fillStyle = f.color.replace('A', a.toFixed(3));
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    for (const p of this.parts) {
      if (p.t < 0) continue;
      const k = p.t / p.life;
      const alpha = p.fade ? Math.max(0, 1 - k) : k > 0.8 ? (1 - k) * 5 : 1;
      ctx.save();
      ctx.globalAlpha = alpha;
      if (p.glow) ctx.globalCompositeOperation = 'lighter';
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      const s = p.size * (p.grow ? 1 + k * p.grow : 1);
      drawShape(ctx, p.shape, s, p.color, k);
      ctx.restore();
    }
  }

  flash(color = 'rgba(255,255,255,A)', a = 0.7, life = 0.25) {
    this.flashes.push({ color, a, life, t: 0 });
    this.loop();
  }

  // Efeito de golpe: from/to = [x, y] em pixels CSS do canvas
  move(type, category, from, to, selfTarget) {
    const st = STYLE[type] || STYLE.Normal;
    const pick = () => st.colors[Math.floor(Math.random() * st.colors.length)];
    const add = (p) => this.parts.push({ rot: 0, vr: 0, vx: 0, vy: 0, t: 0, fade: true, glow: st.glow, shape: st.shape, ...p });
    if (category === 'Status') {
      const c = selfTarget ? from : to;
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2;
        add({ x: c[0] + Math.cos(a) * 50, y: c[1] + Math.sin(a) * 30, vx: -Math.cos(a) * 20, vy: -60 - Math.random() * 40, size: 5 + Math.random() * 4, color: pick(), life: 0.9, t: -i * 0.015, shape: st.shape === 'ring' ? 'ring' : 'sparkle', glow: true });
      }
      add({ x: c[0], y: c[1], size: 30, grow: 2.5, color: st.colors[1], life: 0.6, shape: 'ring' });
      this.loop();
      return 700;
    }
    if (category === 'Special') {
      const n = st.shape === 'bolt' ? 10 : st.shape === 'ring' ? 6 : 22;
      for (let i = 0; i < n; i++) {
        add({
          x: from[0], y: from[1], x0: from[0] + (Math.random() - 0.5) * 20, y0: from[1] + (Math.random() - 0.5) * 20,
          target: [to[0] + (Math.random() - 0.5) * 40, to[1] + (Math.random() - 0.5) * 30], dur: 0.45, arcX: (Math.random() - 0.5) * 30, arcY: 20 + Math.random() * 30,
          size: st.shape === 'ring' ? 14 : 6 + Math.random() * 6, grow: st.shape === 'ring' ? 1.5 : 0, color: pick(), life: 0.55, t: -i * 0.022, vr: (Math.random() - 0.5) * 10, fade: false,
        });
      }
      setTimeout(() => this.burst(type, to, 18), 480);
      this.loop();
      return 800;
    }
    // físico: impacto no alvo
    this.burst(type, to, 16);
    add({ x: to[0], y: to[1], size: 26, grow: 1.6, color: '#ffffff', life: 0.25, shape: 'star', glow: true });
    this.loop();
    return 450;
  }

  burst(type, at, n) {
    const st = STYLE[type] || STYLE.Normal;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 80 + Math.random() * 180;
      this.parts.push({
        x: at[0], y: at[1], vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (st.shape === 'rock' ? 60 : 0), g: st.shape === 'rock' || st.shape === 'drop' ? 500 : 0,
        size: 5 + Math.random() * 7, color: st.colors[Math.floor(Math.random() * st.colors.length)], life: 0.5 + Math.random() * 0.3,
        t: 0, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12, fade: true, glow: st.glow, shape: st.shape,
      });
    }
    this.loop();
  }

  statUp(at, up) {
    for (let i = 0; i < 14; i++) {
      this.parts.push({ x: at[0] + (Math.random() - 0.5) * 80, y: at[1] + 30, vx: 0, vy: up ? -140 - Math.random() * 60 : 140, size: 8, color: up ? '#ff8a5a' : '#5a8aff', life: 0.7, t: -i * 0.03, rot: up ? 0 : Math.PI, vr: 0, fade: true, shape: 'arrow' });
    }
    this.loop();
  }

  sparkle(at, color = '#fff6a0') {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      this.parts.push({ x: at[0], y: at[1], vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, size: 7, color, life: 0.6, t: 0, rot: 0, vr: 4, fade: true, glow: true, shape: 'sparkle' });
    }
    this.loop();
  }
}

function drawShape(ctx, shape, s, color, k) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  switch (shape) {
    case 'flame':
      ctx.beginPath(); ctx.moveTo(0, -s * 1.4); ctx.quadraticCurveTo(s, -s * 0.2, 0, s); ctx.quadraticCurveTo(-s, -s * 0.2, 0, -s * 1.4); ctx.fill(); break;
    case 'drop':
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.quadraticCurveTo(s * 0.9, s * 0.3, 0, s * 0.8); ctx.quadraticCurveTo(-s * 0.9, s * 0.3, 0, -s); ctx.fill(); break;
    case 'leaf':
      ctx.beginPath(); ctx.ellipse(0, 0, s * 1.2, s * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,60,0,0.4)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(s, 0); ctx.stroke(); break;
    case 'bolt':
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-s, -s * 1.5); ctx.lineTo(s * 0.3, -s * 0.2); ctx.lineTo(-s * 0.3, s * 0.2); ctx.lineTo(s, s * 1.5); ctx.stroke(); break;
    case 'crystal':
      ctx.beginPath(); ctx.moveTo(0, -s * 1.3); ctx.lineTo(s * 0.6, 0); ctx.lineTo(0, s * 1.3); ctx.lineTo(-s * 0.6, 0); ctx.closePath(); ctx.fill(); break;
    case 'ring':
      ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.stroke(); break;
    case 'wisp':
      ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-s, 0); ctx.quadraticCurveTo(-s * 0.5, s * 2.2, s * 0.4, s * 1.6); ctx.lineTo(s, 0); ctx.fill(); break;
    case 'bubble':
      ctx.globalAlpha *= 0.85; ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(-s * 0.35, -s * 0.35, s * 0.3, 0, Math.PI * 2); ctx.fill(); break;
    case 'rock':
      ctx.beginPath(); ctx.moveTo(-s, -s * 0.4); ctx.lineTo(-s * 0.3, -s); ctx.lineTo(s * 0.8, -s * 0.6); ctx.lineTo(s, s * 0.5); ctx.lineTo(-s * 0.2, s); ctx.closePath(); ctx.fill(); break;
    case 'wind':
      ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, s * 1.5, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke(); break;
    case 'dot':
      ctx.beginPath(); ctx.arc(0, 0, s * 0.6, 0, Math.PI * 2); ctx.fill(); break;
    case 'sparkle':
      ctx.beginPath();
      for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s); ctx.lineTo(Math.cos(a + Math.PI / 4) * s * 0.3, Math.sin(a + Math.PI / 4) * s * 0.3); }
      ctx.closePath(); ctx.fill(); break;
    case 'arrow':
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.8, 0); ctx.lineTo(s * 0.3, 0); ctx.lineTo(s * 0.3, s); ctx.lineTo(-s * 0.3, s); ctx.lineTo(-s * 0.3, 0); ctx.lineTo(-s * 0.8, 0); ctx.closePath(); ctx.fill(); break;
    case 'star': default:
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
        ctx.lineTo(Math.cos(a + Math.PI / 5) * s * 0.45, Math.sin(a + Math.PI / 5) * s * 0.45);
      }
      ctx.closePath(); ctx.fill();
  }
  void k;
}

export { TYPE_COLOR };
