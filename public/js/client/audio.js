// Efeitos sonoros e músicas originais simples, sintetizados com WebAudio (estilo chiptune).
class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.track = null;
    this.timer = null;
    this.musicVol = 0.35;
    this.sfxVol = 0.6;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicVol;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxVol;
    this.sfxGain.connect(this.master);
  }

  setVolumes(music, sfx) {
    this.musicVol = music; this.sfxVol = sfx;
    if (this.musicGain) this.musicGain.gain.value = music;
    if (this.sfxGain) this.sfxGain.gain.value = sfx;
  }

  tone(freq, start, dur, type = 'square', vol = 0.2, dest = this.sfxGain, slide = 0) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g); g.connect(dest);
    o.start(start); o.stop(start + dur + 0.02);
  }

  noise(start, dur, vol = 0.2, filterFreq = 2000) {
    if (!this.ctx) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(this.sfxGain);
    s.start(start);
  }

  sfx(name) {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const t = this.ctx.currentTime;
    const N = (n) => 440 * Math.pow(2, (n - 69) / 12);
    switch (name) {
      case 'select': this.tone(N(84), t, 0.05, 'square', 0.08); break;
      case 'confirm': this.tone(N(79), t, 0.06, 'square', 0.1); this.tone(N(86), t + 0.06, 0.08, 'square', 0.1); break;
      case 'cancel': this.tone(N(74), t, 0.06, 'square', 0.1); this.tone(N(67), t + 0.06, 0.08, 'square', 0.1); break;
      case 'bump': this.tone(90, t, 0.08, 'triangle', 0.25, this.sfxGain, 0.7); break;
      case 'door': this.noise(t, 0.18, 0.15, 900); this.tone(N(60), t + 0.05, 0.12, 'triangle', 0.15); break;
      case 'hit': this.noise(t, 0.16, 0.35, 1800); this.tone(140, t, 0.12, 'square', 0.12, this.sfxGain, 0.5); break;
      case 'superhit': this.noise(t, 0.28, 0.45, 3200); this.tone(220, t, 0.2, 'sawtooth', 0.15, this.sfxGain, 0.3); break;
      case 'weakhit': this.noise(t, 0.1, 0.2, 900); break;
      case 'faint': this.tone(N(72), t, 0.5, 'square', 0.12, this.sfxGain, 0.25); break;
      case 'ball': this.tone(N(72), t, 0.08, 'square', 0.1); this.tone(N(84), t + 0.08, 0.1, 'square', 0.1); break;
      case 'wobble': this.tone(N(60), t, 0.06, 'triangle', 0.2); this.tone(N(55), t + 0.07, 0.06, 'triangle', 0.2); break;
      case 'caught': [72, 76, 79, 84, 79, 84].forEach((n, i) => this.tone(N(n), t + i * 0.11, 0.14, 'square', 0.1)); break;
      case 'levelup': [72, 76, 79, 84].forEach((n, i) => this.tone(N(n), t + i * 0.08, 0.12, 'square', 0.1)); break;
      case 'heal': [76, 79, 84, 79, 88].forEach((n, i) => this.tone(N(n), t + i * 0.13, 0.16, 'triangle', 0.18)); break;
      case 'money': this.tone(N(88), t, 0.06, 'square', 0.08); this.tone(N(93), t + 0.06, 0.12, 'square', 0.08); break;
      case 'encounter': for (let i = 0; i < 6; i++) this.tone(N(60 + (i % 2) * 7), t + i * 0.06, 0.06, 'square', 0.1); break;
      case 'evolve': [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => this.tone(N(n), t + i * 0.12, 0.2, 'triangle', 0.18)); break;
      case 'item': [79, 83, 86, 91].forEach((n, i) => this.tone(N(n), t + i * 0.09, 0.12, 'square', 0.09)); break;
      case 'chat': this.tone(N(91), t, 0.05, 'sine', 0.1); break;
      case 'grass': this.noise(t, 0.08, 0.06, 2500); break;
      case 'buy': this.tone(N(84), t, 0.05, 'square', 0.08); this.tone(N(88), t + 0.05, 0.05, 'square', 0.08); this.tone(N(91), t + 0.1, 0.1, 'square', 0.08); break;
      default: break;
    }
  }

  // ------------------------------------------------------------ música
  // Melodias originais curtas: [nota MIDI ou 0 (pausa), duração em colcheias]
  static TRACKS = {
    town: { bpm: 112, lead: [[72, 2], [76, 2], [79, 2], [76, 2], [77, 2], [81, 2], [79, 4], [76, 2], [74, 2], [72, 2], [74, 2], [76, 4], [72, 4], [74, 2], [77, 2], [81, 2], [77, 2], [76, 2], [79, 2], [84, 4], [83, 2], [81, 2], [79, 2], [77, 2], [76, 4], [74, 4]], bass: [48, 48, 53, 53, 55, 55, 48, 48, 50, 50, 53, 53, 55, 55, 48, 48] },
    route: { bpm: 132, lead: [[67, 1], [72, 1], [76, 2], [74, 1], [72, 1], [74, 2], [76, 1], [79, 1], [81, 2], [79, 2], [76, 2], [77, 1], [76, 1], [74, 2], [72, 1], [71, 1], [72, 4], [0, 2], [79, 1], [81, 1], [83, 2], [84, 2], [83, 1], [81, 1], [79, 2], [76, 2], [77, 2], [74, 2], [79, 4], [0, 2]], bass: [48, 55, 53, 55, 48, 55, 50, 55, 53, 60, 55, 59, 48, 55, 55, 55] },
    night: { bpm: 84, lead: [[69, 3], [72, 1], [76, 4], [74, 2], [72, 2], [71, 4], [69, 3], [67, 1], [69, 4], [0, 4], [72, 3], [74, 1], [76, 4], [79, 2], [77, 2], [76, 4], [74, 2], [71, 2], [69, 8]], bass: [45, 45, 52, 52, 43, 43, 50, 50] },
    battle: { bpm: 168, lead: [[69, 1], [69, 1], [72, 1], [69, 1], [76, 2], [74, 1], [72, 1], [71, 1], [72, 1], [74, 1], [71, 1], [67, 2], [69, 2], [69, 1], [69, 1], [72, 1], [69, 1], [77, 2], [76, 1], [74, 1], [76, 1], [77, 1], [79, 1], [80, 1], [81, 4]], bass: [45, 45, 45, 45, 43, 43, 43, 43, 41, 41, 41, 41, 40, 40, 44, 44] },
    gym: { bpm: 176, lead: [[64, 1], [67, 1], [71, 1], [74, 1], [76, 2], [74, 1], [71, 1], [72, 2], [71, 1], [69, 1], [67, 2], [71, 2], [64, 1], [67, 1], [71, 1], [74, 1], [79, 2], [78, 1], [76, 1], [78, 2], [79, 1], [81, 1], [83, 4]], bass: [40, 40, 40, 40, 43, 43, 45, 45, 40, 40, 40, 40, 47, 47, 45, 45] },
    cave: { bpm: 96, lead: [[62, 2], [0, 2], [65, 2], [64, 2], [62, 4], [0, 2], [57, 2], [60, 2], [62, 2], [65, 2], [67, 2], [65, 4], [64, 4]], bass: [38, 38, 38, 38, 36, 36, 41, 41] },
    victory: { bpm: 140, lead: [[72, 1], [76, 1], [79, 1], [84, 3], [83, 1], [81, 1], [79, 2], [81, 2], [84, 4], [79, 2], [81, 2], [83, 2], [84, 6]], bass: [48, 48, 53, 53, 55, 55, 48, 48] },
  };

  play(name) {
    if (!this.ctx || this.track === name) return;
    this.track = name;
    clearTimeout(this.timer);
    if (!name) return;
    const tr = Audio.TRACKS[name];
    if (!tr) return;
    const eighth = 60 / tr.bpm / 2;
    const N = (n) => 440 * Math.pow(2, (n - 69) / 12);
    let next = this.ctx.currentTime + 0.1;
    const loop = () => {
      if (this.track !== name) return;
      let t = next;
      for (const [n, d] of tr.lead) {
        if (n) this.tone(N(n), t, d * eighth * 0.9, 'square', 0.05, this.musicGain);
        t += d * eighth;
      }
      const total = t - next;
      const step = total / tr.bass.length;
      tr.bass.forEach((n, i) => this.tone(N(n), next + i * step, step * 0.85, 'triangle', 0.12, this.musicGain));
      next = t;
      this.timer = setTimeout(loop, Math.max(50, (next - this.ctx.currentTime - 0.3) * 1000));
    };
    loop();
  }
}

export const audio = new Audio();
