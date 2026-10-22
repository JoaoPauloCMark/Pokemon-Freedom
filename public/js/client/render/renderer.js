// Renderizador do mundo e dos interiores.
import { T, W, H, BUILDINGS } from '../../shared/world/defs.js';
import { IT } from '../../shared/world/interiors.js';
import { Terrain, TS, CHUNK, waterFrame, tallGrass, TALL_COLORS } from './terrain.js';
import {
  treeSprite, pineSprite, palmSprite, boulderSprite, cactusSprite, buildingSprite, lampSprite, signSprite,
  itemBallSprite, objectSprite, floorTile, wallTile, setSpritePR, pokeballSmall,
  berryTreeSprite, honeyTreeSprite, digSpotSprite, trashSprite, truckSprite,
} from './sprites.js';
import { charFrame, CW, CH, setCharPR } from './character.js';
import { hash2 } from '../../shared/rng.js';
import { imageNow, spriteUrl } from '../assets.js';
import { roundRect, makeCanvas, rgba } from './color.js';

const TALL_TILES = new Set([T.TALL, T.SNOWTALL, T.ASHTALL]);

export class Renderer {
  constructor(canvas, world) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.world = world;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.chunkPR = Math.min(this.dpr, 1.5);
    this.terrain = new Terrain(world, this.chunkPR);
    setSpritePR(this.dpr);
    setCharPR(this.dpr);
    this.userZoom = 1;
    this.zoom = 1;
    this.cam = { x: 0, y: 0 };
    this.t = 0;
    this.particles = [];
    this.weather = null;
    this.light = makeCanvas(10, 10);
    this.frontGrass = {};
    this.indexWorld();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setZoom(z) { this.userZoom = z; this.resize(); }

  resize() {
    this.vw = window.innerWidth;
    this.vh = window.innerHeight;
    this.canvas.width = Math.round(this.vw * this.dpr);
    this.canvas.height = Math.round(this.vh * this.dpr);
    const base = Math.min(this.vw, this.vh) < 600 ? 0.72 : this.vw > 2200 ? 1.25 : 1;
    this.zoom = base * this.userZoom;
    this.light.width = Math.ceil(this.vw / 3);
    this.light.height = Math.ceil(this.vh / 3);
  }

  indexWorld() {
    const key = (cx, cy) => cx + ',' + cy;
    this.bIndex = new Map();
    for (const b of this.world.buildings) {
      const extraTop = 3;
      for (let cy = Math.floor((b.y - extraTop) / CHUNK); cy <= Math.floor((b.y + b.h) / CHUNK); cy++) {
        for (let cx = Math.floor(b.x / CHUNK); cx <= Math.floor((b.x + b.w) / CHUNK); cx++) {
          const k = key(cx, cy);
          if (!this.bIndex.has(k)) this.bIndex.set(k, []);
          this.bIndex.get(k).push(b);
        }
      }
    }
    this.oIndex = new Map();
    for (const o of this.world.objects) {
      const k = key(Math.floor(o.x / CHUNK), Math.floor(o.y / CHUNK));
      if (!this.oIndex.has(k)) this.oIndex.set(k, []);
      this.oIndex.get(k).push(o);
    }
  }

  // ------------------------------------------------------------ quadro principal
  render(scene, dt) {
    this.t += dt;
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = scene.mode === 'world' ? '#2f6fc4' : '#0a0a12';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    // interiores ficam mais próximos para preencher a tela
    let zoomNow = this.zoom;
    if (scene.mode !== 'world') {
      const m = scene.interior;
      zoomNow = Math.max(this.zoom, Math.min(this.zoom * 1.6, (this.vh * 0.86) / (m.h * TS), (this.vw * 0.9) / (m.w * TS)));
    }
    this.zoomNow = zoomNow;
    const z = zoomNow * this.dpr;
    // câmera
    const p = scene.player;
    let camX = (p.rx + 0.5) * TS, camY = (p.ry + 0.5) * TS;
    const halfW = this.vw / 2 / zoomNow, halfH = this.vh / 2 / zoomNow;
    if (scene.mode === 'world') {
      camX = Math.max(halfW, Math.min(W * TS - halfW, camX));
      camY = Math.max(halfH, Math.min(H * TS - halfH, camY));
    } else {
      const m = scene.interior;
      const mw = m.w * TS, mh = m.h * TS;
      camX = mw <= halfW * 2 ? mw / 2 : Math.max(halfW, Math.min(mw - halfW, camX));
      camY = mh <= halfH * 2 - TS ? mh / 2 + TS * 0.3 : Math.max(halfH, Math.min(mh - halfH + TS, camY));
    }
    if (scene.shake) { camX += (Math.random() - 0.5) * scene.shake; camY += (Math.random() - 0.5) * scene.shake; }
    camX = Math.round(camX * z) / z;
    camY = Math.round(camY * z) / z;
    this.cam.x = camX; this.cam.y = camY;
    ctx.setTransform(z, 0, 0, z, this.vw * this.dpr / 2 - camX * z, this.vh * this.dpr / 2 - camY * z);
    const view = { x0: camX - halfW, y0: camY - halfH, x1: camX + halfW, y1: camY + halfH };
    this.view = view;
    const night = scene.light;

    if (scene.mode === 'world') this.drawWorld(scene, view, night);
    else this.drawInterior(scene, view, night);

    // ---- iluminação
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawLighting(scene, view);
    this.drawWeather(scene, dt);
    if (scene.tint) { ctx.fillStyle = scene.tint; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); }
  }

  worldToScreen(x, y) {
    const zz = this.zoomNow || this.zoom;
    return [((x - this.cam.x) * zz + this.vw / 2), ((y - this.cam.y) * zz + this.vh / 2)];
  }

  // ------------------------------------------------------------ mundo
  drawWorld(scene, view, night) {
    const ctx = this.ctx;
    const tx0 = Math.floor(view.x0 / TS) - 1, ty0 = Math.floor(view.y0 / TS) - 1;
    const tx1 = Math.ceil(view.x1 / TS) + 1, ty1 = Math.ceil(view.y1 / TS) + 3;
    const cx0 = Math.max(0, Math.floor(tx0 / CHUNK)), cy0 = Math.max(0, Math.floor(ty0 / CHUNK));
    const cx1 = Math.min(Math.ceil(W / CHUNK) - 1, Math.floor(tx1 / CHUNK)), cy1 = Math.min(Math.ceil(H / CHUNK) - 1, Math.floor(ty1 / CHUNK));
    // gera no máximo 3 chunks novos por quadro (evita travadas)
    let budget = 3;
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        if (!this.terrain.has(cx, cy)) { if (budget-- <= 0) continue; }
        const c = this.terrain.get(cx, cy);
        ctx.drawImage(c, cx * CHUNK * TS, cy * CHUNK * TS, CHUNK * TS, CHUNK * TS);
      }
    }
    // pré-carrega chunks vizinhos aos poucos
    if (budget > 0) {
      outer: for (let cy = cy0 - 1; cy <= cy1 + 1; cy++) for (let cx = cx0 - 1; cx <= cx1 + 1; cx++) {
        if (cx < 0 || cy < 0 || cx * CHUNK >= W || cy * CHUNK >= H) continue;
        if (!this.terrain.has(cx, cy)) { this.terrain.get(cx, cy); if (--budget <= 0) break outer; }
      }
    }
    // ---- brilho da água e lava
    const wf = Math.floor(this.t * 6);
    const tiles = this.world.tiles;
    const lavas = [];
    for (let y = Math.max(0, ty0); y < Math.min(H, ty1); y++) {
      for (let x = Math.max(0, tx0); x < Math.min(W, tx1); x++) {
        const t = tiles[y * W + x];
        if (t === T.DEEP || t === T.WATER) {
          if (hash2(x, y, 3) < 0.55) ctx.drawImage(waterFrame(wf + Math.floor(hash2(x, y, 4) * 16), this.dpr), x * TS, y * TS, TS, TS);
        } else if (t === T.LAVA) lavas.push([x, y]);
      }
    }
    for (const [x, y] of lavas) {
      ctx.fillStyle = `rgba(255,220,120,${0.15 + 0.12 * Math.sin(this.t * 3 + x + y)})`;
      ctx.beginPath(); ctx.arc(x * TS + TS / 2, y * TS + TS / 2, TS * 0.3, 0, Math.PI * 2); ctx.fill();
    }
    // ---- objetos ordenados por profundidade
    const list = [];
    for (let y = Math.max(0, ty0); y < Math.min(H, ty1); y++) {
      for (let x = Math.max(0, tx0); x < Math.min(W, tx1); x++) {
        const t = tiles[y * W + x];
        if (t === T.TREE || t === T.PINE || t === T.BOULDER || t === T.CACTUS) list.push({ k: y + 0.99, tile: t, x, y });
      }
    }
    const seenB = new Set();
    for (let cy = cy0; cy <= cy1 + 1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      for (const b of this.bIndex.get(cx + ',' + cy) || []) {
        if (seenB.has(b)) continue;
        seenB.add(b);
        list.push({ k: b.y + b.h - 0.01, b });
      }
      for (const o of this.oIndex.get(cx + ',' + cy) || []) {
        if (scene.hidden && scene.hidden.has(o.id)) continue;
        list.push({ k: o.y + 0.98, o });
      }
    }
    for (const o of scene.extra || []) if (o.x >= tx0 - 1 && o.x <= tx1 && o.y >= ty0 - 1 && o.y <= ty1) list.push({ k: o.y + 0.98, o });
    for (const e of scene.entities) list.push({ k: e.ry + 1 + (e.kind === 'follower' ? -0.02 : 0), e });
    list.sort((a, b) => a.k - b.k);
    for (const it of list) {
      if (it.tile !== undefined) this.drawTileObject(it.tile, it.x, it.y);
      else if (it.b) this.drawBuilding(it.b, scene, night);
      else if (it.o) this.drawWorldObject(it.o, scene, night);
      else if (it.e) {
        this.drawEntity(it.e, scene);
        this.grassOver(it.e, (x, y) => tiles[y * W + x]);
      }
    }
    // ---- nomes e balões (sempre por cima)
    for (const e of scene.entities) this.drawOverlay(e, scene);
  }

  drawTileObject(t, x, y) {
    const ctx = this.ctx;
    let s;
    if (t === T.TREE) {
      const near = (dx, dy) => this.world.tiles[(y + dy) * W + x + dx] === T.SAND;
      s = (near(1, 0) || near(-1, 0) || near(0, 1) || near(0, -1)) ? palmSprite() : treeSprite(Math.floor(hash2(x, y, 11) * 4));
      ctx.drawImage(s, x * TS + TS / 2 - s.lw / 2, (y + 1) * TS - s.lh + TS * 0.18, s.lw, s.lh);
    } else if (t === T.PINE) {
      s = pineSprite(true);
      ctx.drawImage(s, x * TS + TS / 2 - s.lw / 2, (y + 1) * TS - s.lh + TS * 0.18, s.lw, s.lh);
    } else if (t === T.BOULDER) {
      s = boulderSprite(this.world.ground[y * W + x] === T.SNOW);
      ctx.drawImage(s, x * TS, (y + 1) * TS - s.lh, s.lw, s.lh);
    } else if (t === T.CACTUS) {
      s = cactusSprite();
      ctx.drawImage(s, x * TS, (y + 1) * TS - s.lh, s.lw, s.lh);
    }
  }

  drawBuilding(b, scene, night) {
    const h = b.plotId && scene.houses ? scene.houses[b.plotId] : null;
    const opts = { night: night > 0.25 };
    if (b.plotId) {
      if (h) { opts.roof = h.roof; opts.owner = 'Casa de ' + h.ownerName; }
      else opts.forSale = true;
    }
    if (b.type === 'gym' && scene.gymColors) opts.gymColor = scene.gymColors[b.city];
    const s = buildingSprite(b, opts);
    this.ctx.drawImage(s, b.x * TS, (b.y + b.h) * TS - s.lh, s.lw, s.lh);
  }

  drawWorldObject(o, scene, night) {
    const ctx = this.ctx;
    const X = o.x * TS, Y = o.y * TS;
    switch (o.kind) {
      case 'lamp': { const s = lampSprite(night > 0.2); ctx.drawImage(s, X, Y + TS - s.lh, s.lw, s.lh); break; }
      case 'sign': { const s = signSprite(); ctx.drawImage(s, X, Y + TS - s.lh, s.lw, s.lh); break; }
      case 'item': {
        const s = itemBallSprite();
        ctx.drawImage(s, X, Y + Math.sin(this.t * 3 + o.x) * 1.5, s.lw, s.lh);
        break;
      }
      case 'berry': {
        const st = scene.objState;
        const ripe = !st || !st.berries[o.id] || st.now - st.berries[o.id] >= 2 * 3600 * 1000;
        const s = berryTreeSprite(o.berry, ripe);
        ctx.drawImage(s, X, Y + TS - s.lh + 4, s.lw, s.lh);
        break;
      }
      case 'honey': {
        const st = scene.objState;
        const t0 = st && st.honey[o.id];
        const state = !t0 ? 'none' : st.now - t0 >= 24 * 3600 * 1000 ? 'dry' : st.now - t0 >= 10 * 60 * 1000 ? 'ready' : 'wait';
        const s = honeyTreeSprite(state);
        const shake = state === 'ready' ? Math.sin(this.t * 18) * 1.5 : 0;
        ctx.drawImage(s, X + shake, Y + TS - s.lh + 4, s.lw, s.lh);
        break;
      }
      case 'dig': {
        const st = scene.objState;
        const ready = !st || st.dig[o.id] !== Math.floor(st.now / (6 * 3600 * 1000));
        const s = digSpotSprite(ready);
        ctx.drawImage(s, X, Y + TS - s.lh + 2, s.lw, s.lh);
        if (ready && Math.sin(this.t * 3 + o.x) > 0.7) { ctx.fillStyle = 'rgba(255,240,160,0.8)'; ctx.beginPath(); ctx.arc(X + TS * 0.3 + (o.y % 3) * 6, Y - 6, 2.5, 0, Math.PI * 2); ctx.fill(); }
        break;
      }
      case 'trash': { const s = trashSprite(); ctx.drawImage(s, X, Y, s.lw, s.lh); break; }
      case 'special': {
        if (o.role === 'truck') { const s = truckSprite(); ctx.drawImage(s, X - TS / 2, Y + TS - s.lh, s.lw, s.lh); }
        break;
      }
      case 'legend': {
        const img = imageNow(spriteUrl.frontStatic(o.species));
        const bob = Math.sin(this.t * 2 + o.x) * 4;
        ctx.save();
        const g = ctx.createRadialGradient(X + TS / 2, Y + TS / 2, 4, X + TS / 2, Y + TS / 2, TS * 1.4);
        g.addColorStop(0, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(X - TS, Y - TS, TS * 3, TS * 3);
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(X + TS / 2, Y + TS * 0.9, TS * 0.5, TS * 0.16, 0, 0, Math.PI * 2); ctx.fill();
        if (img) { ctx.imageSmoothingEnabled = false; const s = TS * 2; ctx.drawImage(img, X + TS / 2 - s / 2, Y + TS - s + bob, s, s); ctx.imageSmoothingEnabled = true; }
        ctx.restore();
        break;
      }
      default: break;
    }
  }

  // ------------------------------------------------------------ entidades
  drawEntity(e, scene) {
    const ctx = this.ctx;
    const X = e.rx * TS, Y = e.ry * TS;
    if (e.kind === 'pkmn') {
      const img = imageNow(spriteUrl.icon(e.species));
      if (!img) return;
      const s = e.big ? 3 : 2;
      const w = img.width * s, h = img.height * s;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath(); ctx.ellipse(X + TS / 2, Y + TS * 0.86, TS * (e.big ? 0.6 : 0.32), TS * 0.13, 0, 0, Math.PI * 2); ctx.fill();
      ctx.imageSmoothingEnabled = false;
      const breathe = e.sleeping ? Math.sin(this.t * 1.5) * 2 : Math.sin(this.t * 3 + e.x) * 1.5;
      ctx.drawImage(img, X + TS / 2 - w / 2, Y + TS * 0.95 - h + 8 - breathe, w, h + breathe);
      if (e.sleeping) {
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#3a3f4a'; ctx.lineWidth = 3; ctx.font = '900 16px Nunito, sans-serif';
        const k = (this.t * 0.6) % 1;
        ctx.globalAlpha = 1 - k;
        ctx.strokeText('Z', X + TS * 0.8 + k * 10, Y - 10 - k * 18); ctx.fillText('Z', X + TS * 0.8 + k * 10, Y - 10 - k * 18);
      }
      ctx.restore();
      return;
    }
    if (e.kind === 'follower' || e.kind === 'wild') {
      const img = imageNow(spriteUrl.icon(e.species));
      if (!img) return;
      const s = e.kind === 'wild' ? 2 : 1.5;
      const w = img.width * s, h = img.height * s;
      const fly = e.kind === 'wild' && e.flying && !e.swim ? 10 + Math.sin(this.t * 3 + e.x) * 4 : 0;
      const bob = fly + (e.moving ? Math.abs(Math.sin(this.t * 10)) * 3 : Math.abs(Math.sin(this.t * 3 + e.x)) * 1.5);
      ctx.save();
      if (e.alpha !== undefined) ctx.globalAlpha = e.alpha;
      if (e.swim) {
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
        const k = (this.t * 1.2 + e.x * 0.3) % 1;
        ctx.globalAlpha = (e.alpha ?? 1) * (1 - k);
        ctx.beginPath(); ctx.ellipse(X + TS / 2, Y + TS * 0.78, TS * (0.25 + k * 0.25), TS * (0.08 + k * 0.08), 0, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = e.alpha ?? 1;
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath(); ctx.ellipse(X + TS / 2, Y + TS * 0.86, TS * (fly ? 0.2 : 0.3), TS * (fly ? 0.07 : 0.1), 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.imageSmoothingEnabled = false;
      ctx.translate(X + TS / 2, Y + TS * 0.9 - h + 6 - bob + (e.swim ? h * 0.25 : 0));
      if (e.dir === 1) ctx.scale(-1, 1);
      if (e.swim) { ctx.beginPath(); ctx.rect(-w, -20, w * 2, h * 0.75 + 20); ctx.clip(); }
      ctx.drawImage(img, -w / 2, 0, w, h);
      if (e.shiny && Math.sin(this.t * 4) > 0.5) {
        ctx.fillStyle = '#fff6a0';
        for (const [sx, sy] of [[w / 4, 6], [-w / 3, h / 3], [w / 5, h / 2]]) { ctx.beginPath(); ctx.arc(sx, sy, 2.5, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.restore();
      return;
    }
    if (!e.look) return;
    const frame = charFrame(e.look, e.dir, e.frame || 0, e.mode || 'walk');
    const bob = e.mode === 'surf' ? Math.sin(this.t * 3) * 2 : 0;
    ctx.drawImage(frame, X + TS / 2 - CW / 2, Y + TS * 0.94 - CH + bob, CW, CH);
  }

  grassOver(e, tileAt) {
    if (e.kind === 'follower' || e.kind === 'wild' || e.mode === 'surf') return;
    const x = Math.round(e.rx), y = Math.round(e.ry);
    const t = tileAt(x, y);
    if (!TALL_TILES.has(t)) return;
    let c = this.frontGrass[t];
    if (!c) {
      c = makeCanvas(TS * this.dpr, TS * this.dpr);
      const g = c.getContext('2d');
      g.scale(this.dpr, this.dpr);
      tallGrass(g, 0, 0, 1, 1, TALL_COLORS[t], true);
      this.frontGrass[t] = c;
    }
    this.ctx.drawImage(c, x * TS, y * TS, TS, TS);
  }

  drawOverlay(e, scene) {
    const ctx = this.ctx;
    const X = e.rx * TS + TS / 2, Y = e.ry * TS - CH * 0.62;
    if (e.name && e.showName !== false) {
      ctx.font = '800 11px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const w = ctx.measureText(e.name).width + 12;
      ctx.fillStyle = e.kind === 'remote' ? 'rgba(30,90,200,0.85)' : 'rgba(20,24,40,0.7)';
      roundRect(ctx, X - w / 2, Y - 8, w, 15, 7); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(e.name, X, Y);
    }
    if (e.bubble && e.bubble.until > performance.now()) {
      ctx.font = '800 12px Nunito, sans-serif';
      ctx.textAlign = 'center';
      const lines = wrap(ctx, e.bubble.text, 170);
      const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 16;
      const h = lines.length * 15 + 10;
      const by = Y - 14 - h;
      ctx.fillStyle = 'rgba(255,255,255,0.96)';
      roundRect(ctx, X - w / 2, by, w, h, 9); ctx.fill();
      ctx.beginPath(); ctx.moveTo(X - 5, by + h); ctx.lineTo(X + 5, by + h); ctx.lineTo(X, by + h + 6); ctx.fill();
      ctx.fillStyle = '#1f2430';
      lines.forEach((l, i) => ctx.fillText(l, X, by + 13 + i * 15));
    }
    if (e.emote) {
      const t = (performance.now() - e.emote.at) / 1000;
      if (t < 2) {
        const by = Y - 26 - Math.min(1, t * 6) * 8;
        ctx.fillStyle = '#fff';
        roundRect(ctx, X - 12, by - 12, 24, 22, 8); ctx.fill();
        ctx.font = '900 15px Nunito, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = e.emote.e === '!' ? '#e3403b' : '#1f2430';
        ctx.fillText(e.emote.e, X, by);
      }
    }
    if (e.alert) {
      const by = e.ry * TS - CH * 0.55 - 18 + Math.sin(this.t * 6) * 2;
      ctx.fillStyle = '#fff'; roundRect(ctx, X - 9, by - 11, 18, 20, 6); ctx.fill();
      ctx.fillStyle = '#e3403b'; ctx.font = '900 15px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('!', X, by);
    }
  }

  // ------------------------------------------------------------ interiores
  drawInterior(scene, view, night) {
    const ctx = this.ctx;
    const m = scene.interior;
    // sombra externa
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-6, -6, m.w * TS + 12, m.h * TS + 12);
    for (let y = 0; y < m.h; y++) {
      for (let x = 0; x < m.w; x++) {
        const t = m.tiles[y * m.w + x];
        const X = x * TS, Y = y * TS;
        if (t === IT.VOID) continue;
        if (t === IT.WALL) { ctx.drawImage(wallTile(m.wall, x, y), X, Y, TS, TS); continue; }
        ctx.drawImage(floorTile(m.floor, x, y), X, Y, TS, TS);
        if (t === IT.POOL) {
          const pool = (xx, yy) => m.tiles[yy * m.w + xx] === IT.POOL;
          const g2 = ctx.createLinearGradient(0, Y, 0, Y + TS);
          g2.addColorStop(0, '#6fdaf6'); g2.addColorStop(1, '#3bb2e3');
          ctx.fillStyle = g2; ctx.fillRect(X, Y, TS, TS);
          ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
          const ph = this.t * 1.5 + x * 0.7 + y * 1.3;
          ctx.beginPath(); ctx.moveTo(X + 6, Y + 18 + Math.sin(ph) * 3); ctx.quadraticCurveTo(X + 18, Y + 12 + Math.sin(ph + 1) * 3, X + 30, Y + 18 + Math.sin(ph + 2) * 3); ctx.stroke();
          ctx.fillStyle = '#f4f4f4';
          if (!pool(x, y - 1)) ctx.fillRect(X, Y, TS, 6);
          if (!pool(x, y + 1)) ctx.fillRect(X, Y + TS - 6, TS, 6);
          if (!pool(x - 1, y)) ctx.fillRect(X, Y, 6, TS);
          if (!pool(x + 1, y)) ctx.fillRect(X + TS - 6, Y, 6, TS);
        }
        if (t === IT.EXIT) {
          ctx.fillStyle = '#c94f4a'; roundRect(ctx, X + 4, Y + 8, TS - 8, TS - 14, 5); ctx.fill();
          ctx.strokeStyle = '#f3d27a'; ctx.lineWidth = 2; roundRect(ctx, X + 8, Y + 12, TS - 16, TS - 22, 3); ctx.stroke();
        }
      }
    }
    // sombra da parede no chão
    const g = ctx.createLinearGradient(0, 2 * TS, 0, 2 * TS + 14);
    g.addColorStop(0, 'rgba(0,0,0,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 2 * TS, m.w * TS, 14);
    // balcões
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (m.tiles[y * m.w + x] !== IT.COUNTER) continue;
      const X = x * TS, Y = y * TS;
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(X, Y + TS - 6, TS, 8);
      ctx.fillStyle = m.type === 'center' ? '#f1ece6' : '#c99460';
      ctx.fillRect(X, Y + 4, TS, TS - 6);
      ctx.fillStyle = m.type === 'center' ? '#e3403b' : '#a8713f';
      ctx.fillRect(X, Y + TS * 0.45, TS, TS * 0.55 - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(X, Y + 4, TS, 3);
    }
    // objetos e entidades por profundidade
    const list = [];
    for (const o of m.objects) {
      const def = o.kind === 'furniture';
      const flat = o.kind === 'gymPlatform' || (def && objectFlat(o));
      list.push({ k: flat ? -100 + o.y : o.y + (o.h || 1) - 0.01, o });
    }
    for (const e of scene.entities) list.push({ k: e.ry + 1 + (e.kind === 'follower' ? -0.02 : 0), e });
    list.sort((a, b) => a.k - b.k);
    for (const it of list) {
      if (it.o) {
        const { canvas, oy } = objectSprite(it.o, { night: night > 0.25 });
        ctx.drawImage(canvas, it.o.x * TS, it.o.y * TS + oy, canvas.lw, canvas.lh);
      } else this.drawEntity(it.e, scene);
    }
    // fantasma do editor de casa
    if (scene.editor && scene.editor.ghost) {
      const gh = scene.editor.ghost;
      const { canvas, oy } = objectSprite({ kind: 'furniture', item: gh.item, w: gh.w, h: gh.h });
      ctx.globalAlpha = 0.65;
      ctx.drawImage(canvas, gh.x * TS, gh.y * TS + oy, canvas.lw, canvas.lh);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = gh.ok ? '#45e06a' : '#ff4d4d';
      ctx.lineWidth = 3;
      ctx.strokeRect(gh.x * TS + 2, gh.y * TS + 2, gh.w * TS - 4, gh.h * TS - 4);
    }
    if (scene.editor && scene.editor.cursor) {
      const c = scene.editor.cursor;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.setLineDash([6, 4]); ctx.lineWidth = 2;
      ctx.strokeRect(c.x * TS + 1, c.y * TS + 1, TS - 2, TS - 2);
      ctx.setLineDash([]);
    }
    for (const e of scene.entities) this.drawOverlay(e, scene);
  }

  // ------------------------------------------------------------ luz
  drawLighting(scene, view) {
    const dark = scene.darkness || 0;
    if (dark <= 0.01) return;
    const lc = this.light, l = lc.getContext('2d');
    const sx = lc.width / this.vw;
    l.globalCompositeOperation = 'source-over';
    l.clearRect(0, 0, lc.width, lc.height);
    l.fillStyle = scene.darkColor || `rgba(12,18,52,${dark})`;
    l.fillRect(0, 0, lc.width, lc.height);
    l.globalCompositeOperation = 'destination-out';
    const lights = scene.lights || [];
    for (const L of lights) {
      const [x, y] = this.worldToScreen(L.x * TS, L.y * TS);
      const r = L.r * TS * (this.zoomNow || this.zoom);
      if (x < -r || y < -r || x > this.vw + r || y > this.vh + r) continue;
      const g = l.createRadialGradient(x * sx, y * sx, 0, x * sx, y * sx, r * sx);
      g.addColorStop(0, `rgba(0,0,0,${L.a || 1})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = g;
      l.beginPath(); l.arc(x * sx, y * sx, r * sx, 0, Math.PI * 2); l.fill();
    }
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(lc, 0, 0, this.canvas.width, this.canvas.height);
    // brilho quente
    ctx.globalCompositeOperation = 'lighter';
    for (const L of lights) {
      if (!L.warm) continue;
      const [x, y] = this.worldToScreen(L.x * TS, L.y * TS);
      const r = L.r * TS * (this.zoomNow || this.zoom) * 0.6 * this.dpr;
      if (x < -r || y < -r || x > this.vw + r || y > this.vh + r) continue;
      const g = ctx.createRadialGradient(x * this.dpr, y * this.dpr, 0, x * this.dpr, y * this.dpr, r);
      g.addColorStop(0, rgba(L.warm, 0.22 * Math.min(1, dark * 1.6)));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x * this.dpr, y * this.dpr, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ------------------------------------------------------------ clima
  drawWeather(scene, dt) {
    const w = scene.weather;
    if (w !== this.weather) { this.weather = w; this.particles = []; this.fogT = 0; }
    if (!w) return;
    const ctx = this.ctx;
    const d = this.dpr;
    const W2 = this.vw, H2 = this.vh;
    const want = { rain: 160, snow: 110, blizzard: 260, sand: 140, ash: 70, fog: 0 }[w] || 0;
    while (this.particles.length < want) this.particles.push({ x: Math.random() * W2, y: Math.random() * H2, s: Math.random() });
    ctx.save();
    if (w === 'rain') {
      ctx.fillStyle = 'rgba(30,40,70,0.12)'; ctx.fillRect(0, 0, W2 * d, H2 * d);
      ctx.strokeStyle = 'rgba(200,220,255,0.55)'; ctx.lineWidth = 1.2 * d;
      ctx.beginPath();
      for (const p of this.particles) {
        p.y += (600 + p.s * 300) * dt; p.x -= 120 * dt;
        if (p.y > H2) { p.y = -10; p.x = Math.random() * (W2 + 100); }
        ctx.moveTo(p.x * d, p.y * d); ctx.lineTo((p.x - 4) * d, (p.y + 14) * d);
      }
      ctx.stroke();
    } else if (w === 'snow' || w === 'blizzard') {
      const bl = w === 'blizzard';
      if (bl) { ctx.fillStyle = 'rgba(230,240,255,0.18)'; ctx.fillRect(0, 0, W2 * d, H2 * d); }
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (const p of this.particles) {
        p.y += (bl ? 160 : 40 + p.s * 40) * dt; p.x += (bl ? -260 : Math.sin(this.t + p.s * 10) * 20) * dt;
        if (p.y > H2) { p.y = -5; p.x = Math.random() * W2; }
        if (p.x < -10) p.x = W2 + 5;
        ctx.beginPath(); ctx.arc(p.x * d, p.y * d, (1.2 + p.s * 2) * d, 0, Math.PI * 2); ctx.fill();
      }
    } else if (w === 'sand') {
      ctx.fillStyle = 'rgba(190,140,70,0.3)'; ctx.fillRect(0, 0, W2 * d, H2 * d);
      for (let i = 0; i < 5; i++) {
        const x = ((i * 0.31 + this.t * 0.15) % 1.3 - 0.15) * W2, y = ((i * 0.57) % 1) * H2;
        const g = ctx.createRadialGradient(x * d, y * d, 0, x * d, y * d, 260 * d);
        g.addColorStop(0, 'rgba(200,150,80,0.35)'); g.addColorStop(1, 'rgba(200,150,80,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W2 * d, H2 * d);
      }
      ctx.strokeStyle = 'rgba(150,100,45,0.55)'; ctx.lineWidth = 2 * d;
      ctx.beginPath();
      for (const p of this.particles) {
        p.x -= (500 + p.s * 300) * dt; p.y += Math.sin(this.t * 2 + p.s * 6) * 20 * dt;
        if (p.x < -20) { p.x = W2 + 20; p.y = Math.random() * H2; }
        ctx.moveTo(p.x * d, p.y * d); ctx.lineTo((p.x + 18) * d, p.y * d);
      }
      ctx.stroke();
    } else if (w === 'ash') {
      ctx.fillStyle = 'rgba(60,25,20,0.16)'; ctx.fillRect(0, 0, W2 * d, H2 * d);
      for (const p of this.particles) {
        const ember = p.s > 0.8;
        p.y += (ember ? -40 - p.s * 30 : 25 + p.s * 25) * dt; p.x += Math.sin(this.t + p.s * 9) * 12 * dt;
        if (p.y > H2) { p.y = -5; p.x = Math.random() * W2; }
        if (p.y < -10) { p.y = H2 + 5; p.x = Math.random() * W2; }
        ctx.fillStyle = ember ? 'rgba(255,150,60,0.9)' : 'rgba(50,45,45,0.75)';
        ctx.beginPath(); ctx.arc(p.x * d, p.y * d, (ember ? 1.8 : 2.2) * d, 0, Math.PI * 2); ctx.fill();
      }
    } else if (w === 'fog') {
      this.fogT += dt;
      for (let i = 0; i < 9; i++) {
        const x = ((i * 0.37 + this.fogT * 0.02 * (1 + (i % 3))) % 1.4 - 0.2) * W2;
        const y = ((i * 0.53) % 1) * H2;
        const g = ctx.createRadialGradient(x * d, y * d, 0, x * d, y * d, 320 * d);
        g.addColorStop(0, 'rgba(235,240,245,0.45)'); g.addColorStop(1, 'rgba(235,240,245,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W2 * d, H2 * d);
      }
    }
    ctx.restore();
  }
}

function objectFlat(o) {
  return o.item && (o.item.startsWith('tapete'));
}

function wrap(ctx, text, maxW) {
  const words = String(text).split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 4);
}

export { TS };
void pokeballSmall; void BUILDINGS;
