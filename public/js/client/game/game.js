// Núcleo do jogo: movimento, mapas, entidades, encontros e sincronização.
import { T, W, H, ZONES, TIER_LEVELS, tileHabitat, isWalkable, isWater, isPassable } from '../../shared/world/defs.js';
import { zoneAt } from '../../shared/world/world.js';
import { makeInterior, interiorSolidAt, IT } from '../../shared/world/interiors.js';
import { rollEncounter, ENCOUNTER_RATE } from '../../shared/world/encounters.js';
import { trainerData, TRAINER_COOLDOWN_MS, GYMS } from '../../shared/world/npcs.js';
import { createPokemon, isUsable, monName, healMon } from '../../shared/pokemon.js';
import { randomLook } from '../../shared/data/clothes.js';
import { mulberry32 } from '../../shared/rng.js';
import { timeOfDay, clockText } from '../../shared/time.js';
import { input, DXY } from '../input.js';
import { net } from '../net.js';
import { audio } from '../audio.js';
import { ui, fade, money, esc } from '../ui/ui.js';
import { S, state, markDirty, saveNow, leadMon, partyAlive, healParty, addMoney } from '../state.js';
import { runBattle } from '../ui/battle.js';
import { spriteUrl, loadImage } from '../assets.js';
import { TS } from '../render/terrain.js';
import { hpClass } from '../ui/pickers.js';
import { WildSpawner } from './wilds.js';
import { trashObjects } from './jobs.js';
import { relOf, guestsAt } from './relations.js';
import { SPECIAL_LOOKS } from '../../shared/world/npcs.js';

const SPECIAL_MON = { snorlax: 143, sudowoodo: 185 };
const SPECIAL_NAME = { barry: 'Barry', grunt: 'Recruta Galáctico', mars: 'Comandante Mars', saturn: 'Comandante Saturn', cyrus: 'Cyrus' };

const SPEED = { walk: 0.2, run: 0.12, bike: 0.075, surf: 0.15 };
const TERRAIN_OF_TILE = {
  [T.TALL]: 'grass', [T.FLOWERS]: 'grass', [T.SNOWTALL]: 'snow', [T.DESERT]: 'desert', [T.MARSH]: 'marsh',
  [T.ASHTALL]: 'volcano', [T.CAVE]: 'cave', [T.WATER]: 'water', [T.DEEP]: 'water',
};

export class Game {
  constructor(world, renderer) {
    this.world = world;
    this.renderer = renderer;
    this.map = 'world';
    this.interior = null;
    this.building = null;
    this.player = { x: 0, y: 0, rx: 0, ry: 0, dir: 2, mode: 'walk', moving: null, frame: 0, animT: 0, kind: 'player' };
    this.follower = null;
    this.trail = [];
    this.remotes = new Map();
    this.entities = [];
    this.npcs = [];
    this.locked = false;
    this.turnHold = 0;
    this.lastBump = 0;
    this.zone = null;
    this.zoneShownAt = 0;
    this.hidden = new Set();
    this.onlineCount = 1;
    this.handlers = null; // interações (definidas em interact.js)
    this.saveTimer = 0;
    this.posTimer = 0;
    this.repel = 0;
    this.lastFrame = performance.now();
    this.encounterGrace = 0;
    this.wilds = new WildSpawner(this);
    this.buildTrainerCache();
    input.onPress((k) => this.onKey(k));
  }

  // ------------------------------------------------------------ início
  start() {
    const s = S();
    for (const id of Object.keys(s.flags.items)) this.hidden.add(id);
    for (const [sp, v] of Object.entries(s.flags.legends)) if (v === 'caught') this.hidden.add('leg' + sp);
    for (const role of ['snorlax', 'sudowoodo']) if (s.flags.npc && s.flags.npc[role]) this.hidden.add('sp_' + role);
    const pos = s.pos;
    if (pos && pos.map && pos.map.startsWith('int:')) {
      const b = this.world.buildings.find((x) => x.id === pos.map.slice(4));
      // casa que foi vendida ou trancada desde o último acesso: começa do lado de fora
      const h = b && b.plotId ? state.houses[b.plotId] : null;
      const blockedHouse = b && b.plotId && (!h || (h.locked && h.owner !== state.accountKey));
      if (b && blockedHouse) this.setPos(b.doorX, b.doorY + 1);
      else if (b) this.enterBuilding(b, true, pos);
      else this.placeAtStart();
    } else if (pos && pos.map === 'world') {
      const [fx, fy] = this.nearestFree(pos.x, pos.y);
      this.setPos(fx, fy);
      this.player.dir = pos.dir ?? 2;
    } else this.placeAtStart();
    if (this.map === 'world') {
      this.zone = zoneAt(this.world, this.player.x, this.player.y);
      this.buildWorldNpcs(true);
    }
    this.refreshFollower();
    this.sendPos();
    this.updateMusic();
    requestAnimationFrame((t) => this.frame(t));
  }

  nearestFree(x, y) {
    const ok = (xx, yy) => xx >= 0 && yy >= 0 && xx < W && yy < H && isPassable(this.world.tiles[yy * W + xx]) && this.world.tiles[yy * W + xx] !== T.DOOR;
    for (let r = 0; r < 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) === r && ok(x + dx, y + dy)) return [x + dx, y + dy];
    }
    return [x, y];
  }

  placeAtStart() {
    const lab = this.world.buildings.find((b) => b.type === 'lab');
    this.enterBuilding(lab, true);
  }

  setPos(x, y) {
    const p = this.player;
    p.x = x; p.y = y; p.rx = x; p.ry = y; p.moving = null;
    this.trail = [];
    if (this.follower) { this.follower.x = x; this.follower.y = y; this.follower.rx = x; this.follower.ry = y; this.follower.moving = null; }
  }

  // ------------------------------------------------------------ laço principal
  frame(now) {
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    try {
      this.update(dt);
      this.renderer.render(this.scene(), dt);
      this.updateHud(dt);
    } catch (e) {
      console.error(e);
    }
    requestAnimationFrame((t) => this.frame(t));
  }

  update(dt) {
    const p = this.player;
    S().stats.playMs += dt * 1000;
    // movimento do jogador
    if (p.moving) {
      const m = p.moving;
      m.t += dt / m.dur;
      p.animT += dt;
      if (m.t >= 1) {
        p.x = m.tx; p.y = m.ty; p.rx = p.x; p.ry = p.y;
        p.moving = null;
        this.arrive();
      } else {
        p.rx = m.fx + (m.tx - m.fx) * m.t;
        p.ry = m.fy + (m.ty - m.fy) * m.t;
      }
    }
    if (!p.moving && !this.locked && !ui.busy && !this.editor && !this.transitioning) {
      const d = input.dir();
      if (d >= 0) {
        if (d !== p.dir && this.turnHold <= 0) {
          p.dir = d;
          this.turnHold = 0.09;
          this.sendPos();
        } else {
          this.turnHold -= dt;
          if (this.turnHold <= 0) this.tryMove(d);
        }
      } else {
        this.turnHold = 0;
        p.animT = 0;
      }
    }
    // quadro de animação
    if (p.moving) {
      const per = p.moving.dur;
      p.frame = Math.floor((p.animT / per) * 2) % 4;
    } else p.frame = 0;
    this.updateFollower(dt);
    this.updateRemotes(dt);
    this.updateNpcs(dt);
    this.wilds.update(dt);
    // salvamento automático e posição
    this.saveTimer += dt;
    if (this.saveTimer > 20 && state.dirty) { this.saveTimer = 0; this.storePos(); saveNow(); }
    this.posTimer += dt;
    if (this.posTimer > 5) { this.posTimer = 0; this.sendPos(); }
  }

  storePos() {
    const p = this.player;
    S().pos = { map: this.map, x: p.x, y: p.y, dir: p.dir };
    markDirty();
  }

  // ------------------------------------------------------------ colisão
  tileAt(x, y) {
    if (this.map === 'world') return x < 0 || y < 0 || x >= W || y >= H ? T.DEEP : this.world.tiles[y * W + x];
    return null;
  }

  blockedByEntity(x, y) {
    for (const n of this.npcs) if (n.x === x && n.y === y && !n.ghost) return n;
    return null;
  }

  canEnter(x, y, dir) {
    if (this.map === 'world') {
      if (x < 0 || y < 0 || x >= W || y >= H) return false;
      const t = this.tileAt(x, y);
      if (t === T.DOOR) return dir === 0 ? 'door' : false;
      if (this.noclip) return isWater(t) ? 'surf' : 'walk'; // cheat: atravessar paredes
      if (isWalkable(t)) return this.blockedByEntity(x, y) ? false : 'walk';
      if (isWater(t)) return this.blockedByEntity(x, y) ? false : 'surf';
      return false;
    }
    const m = this.interior;
    if (x < 0 || y < 0 || x >= m.w || y >= m.h) return false;
    const t = m.tiles[y * m.w + x];
    if (t === IT.EXIT) return 'exit';
    if (this.noclip) return 'walk';
    if (interiorSolidAt(m, x, y)) return false;
    return 'walk';
  }

  tryMove(dir) {
    if (this.transitioning) return;
    const p = this.player;
    p.dir = dir;
    const [dx, dy] = DXY[dir];
    const nx = p.x + dx, ny = p.y + dy;
    const wild = this.map === 'world' ? this.wilds.at(nx, ny) : null;
    if (wild) { this.wilds.engage(wild); return; }
    const res = this.canEnter(nx, ny, dir);
    if (!res) {
      // descer do surf para a terra é tratado em canEnter; aqui é bloqueio
      if (performance.now() - this.lastBump > 350) { audio.sfx('bump'); this.lastBump = performance.now(); }
      this.sendPos();
      return;
    }
    if (res === 'door') { this.useDoor(nx, ny); return; }
    if (res === 'exit') { this.exitBuilding(); return; }
    // modo de locomoção
    if (res === 'surf' && p.mode !== 'surf') {
      p.prevMode = p.mode === 'bike' ? 'bike' : 'walk';
      p.mode = 'surf';
      audio.sfx('confirm');
    } else if (res === 'walk' && p.mode === 'surf') {
      p.mode = p.prevMode === 'bike' ? 'bike' : 'walk';
      this.followerBack = true;
    }
    let mode = p.mode;
    if (mode === 'walk' && (input.isHeld('run') !== !!S().options.autoRun)) mode = 'run';
    const dur = SPEED[mode] || SPEED.walk;
    p.moving = { fx: p.x, fy: p.y, tx: nx, ty: ny, t: 0, dur };
    p.runMode = mode;
    this.trail.unshift([p.x, p.y, dir]);
    if (this.trail.length > 4) this.trail.pop();
    if (this.follower) this.follower.queue = { x: p.x, y: p.y, dur };
    if (this.followerBack) { this.followerBack = false; this.refreshFollower(); }
    this.sendPos(nx, ny, mode);
  }

  // ------------------------------------------------------------ chegada num tile
  arrive() {
    const p = this.player;
    const s = S();
    s.stats.steps++;
    if (s.stats.steps % 40 === 0) { const l = leadMon(); if (l) l.friendship = Math.min(255, (l.friendship || 70) + 1); }
    if (s.daycare) s.daycare.steps = (s.daycare.steps || 0) + 1;
    if (this.handlers && this.handlers.onStep) this.handlers.onStep();
    if (this.repel > 0) { this.repel--; if (this.repel === 0) ui.toast('O efeito do repelente acabou.'); }
    if (this.map === 'world') {
      const t = this.tileAt(p.x, p.y);
      if (t === T.TALL || t === T.SNOWTALL || t === T.ASHTALL) audio.sfx('grass');
      const z = zoneAt(this.world, p.x, p.y);
      if (z !== this.zone) this.onZoneChange(z);
      if (z && z.city && z.id) {
        if (!s.visited) s.visited = [];
        if (!s.visited.includes(z.id)) { s.visited.push(z.id); markDirty(); }
      }
      this.checkEncounter(t, z);
      this.checkTrainerSight();
    } else if (this.interior) {
      const t = this.interior.tiles[p.y * this.interior.w + p.x];
      if (t === IT.ENC && this.interior.encounters) {
        const z = ZONES.find((zz) => zz && zz.id === this.interior.encounters);
        this.checkEncounter(T.TALL, z, 'grass');
      }
    }
    if (s.stats.steps % 60 === 0) markDirty();
  }

  onZoneChange(z) {
    this.zone = z;
    if (!z) return;
    this.zoneShownAt = performance.now();
    this.updateMusic();
  }

  updateMusic() {
    if (this.map !== 'world') {
      const tp = this.interior?.type;
      audio.play(tp === 'gym' || tp === 'league' ? 'gym' : this.interior?.encounters ? 'cave' : 'town');
      return;
    }
    const z = this.zone;
    const night = timeOfDay(net.now()) === 'night';
    const t = this.tileAt(this.player.x, this.player.y);
    if (t === T.CAVE) audio.play('cave');
    else if (z && z.city) audio.play(night ? 'night' : 'town');
    else audio.play(night ? 'night' : 'route');
  }

  checkEncounter(t, z, habOverride) {
    if (!z || this.encounterGrace > performance.now() || this.noEncounters) return;
    const hab = habOverride || tileHabitat(t);
    if (!hab) return;
    if (!partyAlive()) return;
    let rate = hab === 'grass' ? (t === T.DESERT ? ENCOUNTER_RATE.sand : t === T.FLOWERS ? 0.06 : ENCOUNTER_RATE.grass) : ENCOUNTER_RATE[hab];
    if (Math.random() >= rate * 0.6) return;
    const time = timeOfDay(net.now()) === 'night' ? 'night' : 'day';
    const enc = rollEncounter(z.id, hab, time, Math.random, net.now());
    if (!enc) return;
    const lead = leadMon();
    if (this.repel > 0 && lead && enc.level < lead.level) return;
    this.startWild(enc.species, enc.level, TERRAIN_OF_TILE[t] || (hab === 'cave' ? 'cave' : 'grass'), z);
  }

  async startWild(species, level, terrain, z, shiny) {
    this.locked = true;
    const shinyBoost = S().dex.caught.length >= 380 ? 3 : 1;
    const mon = createPokemon(species, level, { shiny: shiny ?? Math.random() < shinyBoost / 512 });
    loadImage(spriteUrl.front(species, mon.shiny));
    audio.sfx('encounter');
    await this.battleTransition();
    const r = await runBattle({ kind: 'wild', foe: [mon], terrain, zoneName: z ? z.name : '' });
    await this.afterBattle(r);
    return r;
  }

  async battleTransition() {
    const f = document.getElementById('fade');
    for (let i = 0; i < 2; i++) { f.classList.add('white', 'on'); await ui.wait(90); f.classList.remove('on'); await ui.wait(90); }
    f.classList.remove('white');
    await fade(true);
    setTimeout(() => fade(false), 50);
  }

  async afterBattle(r) {
    this.encounterGrace = performance.now() + 1800;
    if (this.handlers && this.handlers.battleJobs) this.handlers.battleJobs(r);
    if (r.result === 'lose') await this.whiteout();
    await this.handlers.postBattleEvolutions();
    this.refreshFollower();
    this.updateMusic();
    this.locked = false;
    this.storePos();
    saveNow();
  }

  async whiteout() {
    await fade(true);
    healParty();
    const c = S().lastCenter;
    if (c) {
      if (this.map !== 'world') this.leaveInterior();
      this.setPos(c.x, c.y);
      this.player.dir = 2;
      this.player.mode = 'walk';
    } else {
      this.placeAtStart();
    }
    this.refreshFollower();
    await ui.wait(300);
    await fade(false);
    await ui.dialog('Seus Pokémon foram curados. Tome mais cuidado!');
  }

  // ------------------------------------------------------------ treinadores
  buildTrainerCache() {
    this.trainerInfo = new Map();
    for (const o of this.world.objects) if (o.kind === 'trainer') this.trainerInfo.set(o.id, trainerData(o));
  }

  trainerReady(o) {
    const t = S().trainers[o.id];
    return !t || Date.now() - t > TRAINER_COOLDOWN_MS;
  }

  checkTrainerSight() {
    // treinadores só mostram "!" — a batalha é opcional (fale com eles)
  }

  // ------------------------------------------------------------ portas e interiores
  useDoor(x, y) {
    const b = this.world.doorAt.get(y * W + x);
    if (!b) return;
    this.handlers.door(b);
  }

  async enterBuilding(b, instant = false, pos = null) {
    this.transitioning = true;
    try { await this.doEnterBuilding(b, instant, pos); } finally { this.transitioning = false; }
  }

  async doEnterBuilding(b, instant, pos) {
    if (!instant) { audio.sfx('door'); await fade(true); }
    const house = b.plotId ? state.houses[b.plotId] : null;
    this.building = b;
    this.interior = makeInterior(b, house);
    this.map = 'int:' + b.id;
    const m = this.interior;
    if (pos && pos.x < m.w && pos.y < m.h && !interiorSolidAt(m, pos.x, pos.y)) this.setPos(pos.x, pos.y);
    else this.setPos(m.exit.x, m.exit.y - 1);
    this.player.dir = pos ? (pos.dir ?? 0) : 0;
    if (this.player.mode !== 'walk') this.player.mode = 'walk';
    this.buildInteriorNpcs();
    if (b.type === 'center') {
      S().lastCenter = { x: b.doorX, y: b.doorY + 1 };
      markDirty();
    }
    this.refreshFollower();
    this.sendPos();
    this.updateMusic();
    this.storePos();
    if (!instant) await fade(false);
  }

  rebuildInterior() {
    if (!this.building) return;
    const house = this.building.plotId ? state.houses[this.building.plotId] : null;
    this.interior = makeInterior(this.building, house);
    this.buildInteriorNpcs();
  }

  leaveInterior() {
    const b = this.building;
    this.map = 'world';
    this.interior = null;
    this.building = null;
    this.npcs = [];
    if (b) this.setPos(b.doorX, b.doorY + 1);
    this.player.dir = 2;
    this.buildWorldNpcs(true);
  }

  async exitBuilding() {
    if (this.transitioning) return;
    this.transitioning = true;
    try { await this.doExitBuilding(); } finally { this.transitioning = false; }
  }

  async doExitBuilding() {
    audio.sfx('door');
    await fade(true);
    this.leaveInterior();
    this.refreshFollower();
    this.zone = zoneAt(this.world, this.player.x, this.player.y);
    this.updateMusic();
    this.sendPos();
    this.storePos();
    await fade(false);
  }

  async teleport(x, y) {
    this.transitioning = true;
    try { await this.doTeleport(x, y); } finally { this.transitioning = false; }
  }

  async doTeleport(x, y) {
    await fade(true);
    if (this.map !== 'world') this.leaveInterior();
    this.setPos(x, y);
    this.player.dir = 2;
    this.player.mode = 'walk';
    this.refreshFollower();
    this.buildWorldNpcs(true);
    this.zone = zoneAt(this.world, x, y);
    this.updateMusic();
    this.sendPos();
    this.storePos();
    await fade(false);
  }

  // ------------------------------------------------------------ NPCs
  buildInteriorNpcs() {
    const m = this.interior;
    this.npcs = m.npcs.map((n, i) => ({
      kind: 'npc', id: `${m.id}:npc${i}`, x: n.x, y: n.y, rx: n.x, ry: n.y, dir: n.dir ?? 2, frame: 0, look: n.look || randomLook(mulberry32(i + 7)),
      role: n.role, name: n.name, data: n, showName: false,
    }));
    // visitas convidadas (relacionamentos) aparecem na sua casa
    const b = this.building;
    const h = b && b.plotId ? state.houses[b.plotId] : null;
    if (h && h.owner === state.accountKey) {
      const spots = [];
      for (let y = 3; y < m.h - 2; y++) for (let x = 1; x < m.w - 1; x++) if (!interiorSolidAt(m, x, y) && Math.abs(x - m.exit.x) > 1) spots.push([x, y]);
      guestsAt(b.plotId).forEach((g, i) => {
        const sp = spots[(i * 7 + 3) % Math.max(1, spots.length)];
        if (!sp) return;
        spots.splice(spots.indexOf(sp), 1);
        this.npcs.push({ kind: 'npc', id: 'guest:' + g.id, x: sp[0], y: sp[1], rx: sp[0], ry: sp[1], ox: sp[0], oy: sp[1], dir: 2, frame: 0, look: g.r.look, role: 'guest', name: g.r.first, data: { relId: g.id }, showName: true, wander: true, nextMove: 2 });
      });
    }
  }

  buildWorldNpcs(force = false) {
    if (this.map !== 'world') return;
    const p = this.player;
    if (!force && this.lastNpcBuild && Math.abs(this.lastNpcBuild[0] - p.x) < 12 && Math.abs(this.lastNpcBuild[1] - p.y) < 12) return;
    this.lastNpcBuild = [p.x, p.y];
    const keep = new Map(this.npcs.map((n) => [n.id, n]));
    const list = [];
    for (const o of this.world.objects) {
      if (Math.abs(o.x - p.x) > 34 || Math.abs(o.y - p.y) > 24) continue;
      if (o.kind === 'npc') {
        const ex = keep.get(o.id);
        if (ex) { list.push(ex); continue; }
        const rng = mulberry32(o.seed);
        const known = relOf('npc:' + o.id);
        list.push({ kind: 'npc', id: o.id, x: o.x, y: o.y, ox: o.x, oy: o.y, rx: o.x, ry: o.y, dir: 2, frame: 0, look: randomLook(rng), role: 'citizen', obj: o, wander: true, nextMove: 1 + Math.random() * 3, name: known ? known.first : '', showName: !!known });
      } else if (o.kind === 'trainer') {
        const ex = keep.get(o.id);
        if (ex) { list.push(ex); continue; }
        const info = this.trainerInfo.get(o.id);
        list.push({ kind: 'npc', id: o.id, x: o.x, y: o.y, rx: o.x, ry: o.y, dir: [2, 1, 3, 0][o.seed % 4], frame: 0, look: info.look, role: 'trainer', obj: o, info, showName: false });
      } else if (o.kind === 'special') {
        if (this.hidden.has(o.id)) continue;
        const ex = keep.get(o.id);
        if (ex) { list.push(ex); continue; }
        if (SPECIAL_MON[o.role]) list.push({ kind: 'pkmn', id: o.id, x: o.x, y: o.y, rx: o.x, ry: o.y, dir: 2, species: SPECIAL_MON[o.role], big: o.role === 'snorlax', sleeping: o.role === 'snorlax', role: 'special', obj: o });
        else if (o.role === 'truck') list.push({ kind: 'static', id: o.id, x: o.x, y: o.y, obj: o, ghost: false });
        else {
          const look = SPECIAL_LOOKS[o.role === 'grunt' && o.n % 2 ? 'gruntf' : o.role] || SPECIAL_LOOKS.grunt;
          list.push({ kind: 'npc', id: o.id, x: o.x, y: o.y, rx: o.x, ry: o.y, dir: 2, frame: 0, look, role: 'special', name: SPECIAL_NAME[o.role] || '', obj: o, showName: o.role === 'barry' || o.role === 'cyrus' });
        }
      } else if (['sign', 'lamp', 'item', 'legend', 'berry', 'honey', 'dig'].includes(o.kind)) {
        if (this.hidden.has(o.id)) continue;
        list.push({ kind: 'static', id: o.id, x: o.x, y: o.y, obj: o, ghost: false });
      }
    }
    // sujeira dos trabalhos de limpeza (só para quem aceitou)
    for (const o of trashObjects()) {
      if (Math.abs(o.x - p.x) > 34 || Math.abs(o.y - p.y) > 24) continue;
      list.push({ kind: 'static', id: o.id, x: o.x, y: o.y, obj: o, ghost: false });
    }
    this.npcs = list;
  }

  updateNpcs(dt) {
    if (this.map === 'world') this.buildWorldNpcs();
    const p = this.player;
    for (const n of this.npcs) {
      if (n.kind === 'static') continue;
      if (n.role === 'trainer') {
        n.alert = this.trainerReady(n.obj) && Math.abs(n.x - p.x) + Math.abs(n.y - p.y) <= 4;
      }
      if (n.moving) {
        n.moving.t += dt / n.moving.dur;
        if (n.moving.t >= 1) { n.x = n.moving.tx; n.y = n.moving.ty; n.rx = n.x; n.ry = n.y; n.moving = null; n.frame = 0; }
        else { n.rx = n.moving.fx + (n.moving.tx - n.moving.fx) * n.moving.t; n.ry = n.moving.fy + (n.moving.ty - n.moving.fy) * n.moving.t; n.frame = Math.floor(n.moving.t * 4) % 4; }
        continue;
      }
      // quem você conhece reage ao te ver (acenar, cara feia, coração...)
      if (n.role === 'citizen' && n.name && n.obj && Math.abs(n.x - p.x) + Math.abs(n.y - p.y) <= 2 && (!n.reactAt || performance.now() - n.reactAt > 15000)) {
        n.reactAt = performance.now();
        const r = relOf('npc:' + n.obj.id);
        const e = !r ? null : r.dating ? '💗' : r.v <= -60 ? '😠' : r.v <= -20 ? '😒' : r.v >= 70 ? '😄' : r.v >= 15 ? '👋' : null;
        if (e) n.emote = { e, at: performance.now() };
      }
      if (!n.wander || this.talkingTo === n) continue;
      n.nextMove -= dt;
      if (n.nextMove > 0) continue;
      n.nextMove = 1.5 + Math.random() * 4;
      const d = Math.floor(Math.random() * 4);
      const [dx, dy] = DXY[d];
      const nx = n.x + dx, ny = n.y + dy;
      n.dir = d;
      if (Math.abs(nx - n.ox) > 3 || Math.abs(ny - n.oy) > 3) continue;
      if (this.map !== 'world') {
        // visitas andando dentro da casa
        const m = this.interior;
        if (!m || interiorSolidAt(m, nx, ny) || ny >= m.h - 2) continue;
      } else {
        const t = this.tileAt(nx, ny);
        if (!(t === T.PAVE || t === T.CITYGRASS || t === T.PLAZA || t === T.SNOW || t === T.GRASS || t === T.PATH)) continue;
      }
      if ((nx === p.x && ny === p.y) || (p.moving && nx === p.moving.tx && ny === p.moving.ty)) continue;
      if (this.npcs.some((o) => o !== n && o.x === nx && o.y === ny)) continue;
      n.moving = { fx: n.x, fy: n.y, tx: nx, ty: ny, t: 0, dur: 0.35 };
    }
  }

  // ------------------------------------------------------------ Pokémon que segue
  refreshFollower() {
    const lead = leadMon();
    const p = this.player;
    if (!lead || p.mode === 'surf') {
      this.follower = null;
    } else {
      const fx = this.trail[0] ? this.trail[0][0] : p.x, fy = this.trail[0] ? this.trail[0][1] : p.y;
      if (!this.follower || this.follower.species !== lead.species || this.follower.shiny !== lead.shiny) {
        this.follower = { kind: 'follower', species: lead.species, shiny: !!lead.shiny, x: fx, y: fy, rx: fx, ry: fy, dir: p.dir, moving: null };
        loadImage(spriteUrl.icon(lead.species));
      }
      if (Math.abs(this.follower.x - p.x) + Math.abs(this.follower.y - p.y) > 2) {
        Object.assign(this.follower, { x: p.x, y: p.y, rx: p.x, ry: p.y, moving: null });
      }
    }
    const key = this.follower ? this.follower.species + (this.follower.shiny ? 's' : '') : '';
    if (key !== this.sentFollower) {
      this.sentFollower = key;
      net.send({ t: 'follower', follower: this.follower ? { species: this.follower.species, shiny: this.follower.shiny } : null });
    }
  }

  updateFollower(dt) {
    const f = this.follower;
    if (!f) return;
    if (this.player.mode === 'surf') { this.refreshFollower(); return; }
    if (f.queue && !f.moving) {
      const q = f.queue;
      f.queue = null;
      if (q.x !== f.x || q.y !== f.y) {
        f.dir = q.x > f.x ? 1 : q.x < f.x ? 3 : q.y > f.y ? 2 : 0;
        f.moving = { fx: f.x, fy: f.y, tx: q.x, ty: q.y, t: 0, dur: q.dur };
      }
    }
    if (f.moving) {
      f.moving.t += dt / f.moving.dur;
      if (f.moving.t >= 1) { f.x = f.moving.tx; f.y = f.moving.ty; f.rx = f.x; f.ry = f.y; f.moving = null; }
      else { f.rx = f.moving.fx + (f.moving.tx - f.moving.fx) * f.moving.t; f.ry = f.moving.fy + (f.moving.ty - f.moving.fy) * f.moving.t; }
    }
  }

  // ------------------------------------------------------------ outros jogadores
  sendPos(tx, ty, mode) {
    const p = this.player;
    net.send({ t: 'pos', map: this.map, x: tx ?? p.x, y: ty ?? p.y, dir: p.dir, mode: mode || p.mode });
  }

  onRemote(m) {
    let r = this.remotes.get(m.id);
    if (!r) {
      r = { kind: 'remote', id: m.id, name: m.name, look: m.look, map: m.map, x: m.x, y: m.y, rx: m.x, ry: m.y, dir: m.dir, mode: m.mode || 'walk', frame: 0, follower: null };
      this.remotes.set(m.id, r);
      if (m.follower) this.setRemoteFollower(r, m.follower);
      return r;
    }
    return r;
  }

  remoteMove(m) {
    const r = this.remotes.get(m.id);
    if (!r) return;
    const sameMap = r.map === m.map;
    const dist = Math.abs(m.x - r.x) + Math.abs(m.y - r.y);
    r.map = m.map;
    r.dir = m.dir;
    r.mode = m.mode || 'walk';
    if (sameMap && dist === 1) {
      r.moving = { fx: r.rx, fy: r.ry, tx: m.x, ty: m.y, t: 0, dur: SPEED[m.mode] || SPEED.walk };
      if (r.follower) r.follower.queue = { x: r.x, y: r.y, dur: SPEED[m.mode] || SPEED.walk };
    } else if (dist > 0 || !sameMap) {
      r.rx = m.x; r.ry = m.y; r.moving = null;
      if (r.follower) Object.assign(r.follower, { x: m.x, y: m.y, rx: m.x, ry: m.y, moving: null });
    }
    r.x = m.x; r.y = m.y;
  }

  setRemoteFollower(r, f) {
    if (!f) { r.follower = null; return; }
    loadImage(spriteUrl.icon(f.species));
    r.follower = { kind: 'follower', species: f.species, shiny: f.shiny, x: r.x, y: r.y, rx: r.x, ry: r.y, dir: r.dir, moving: null };
  }

  updateRemotes(dt) {
    for (const r of this.remotes.values()) {
      if (r.moving) {
        r.moving.t += dt / r.moving.dur;
        if (r.moving.t >= 1) { r.rx = r.moving.tx; r.ry = r.moving.ty; r.moving = null; r.frame = 0; if (r.mode === 'run') r.mode = 'walk'; }
        else { r.rx = r.moving.fx + (r.moving.tx - r.moving.fx) * r.moving.t; r.ry = r.moving.fy + (r.moving.ty - r.moving.fy) * r.moving.t; r.frame = Math.floor(r.moving.t * 4) % 4; }
      }
      const f = r.follower;
      if (f) {
        if (r.mode === 'surf') continue;
        if (f.queue && !f.moving) {
          const q = f.queue; f.queue = null;
          if (q.x !== f.x || q.y !== f.y) { f.dir = q.x > f.x ? 1 : q.x < f.x ? 3 : q.y > f.y ? 2 : 0; f.moving = { fx: f.x, fy: f.y, tx: q.x, ty: q.y, t: 0, dur: q.dur }; }
        }
        if (f.moving) {
          f.moving.t += dt / f.moving.dur;
          if (f.moving.t >= 1) { f.x = f.moving.tx; f.y = f.moving.ty; f.rx = f.x; f.ry = f.y; f.moving = null; }
          else { f.rx = f.moving.fx + (f.moving.tx - f.moving.fx) * f.moving.t; f.ry = f.moving.fy + (f.moving.ty - f.moving.fy) * f.moving.t; }
        }
      }
    }
  }

  remoteAt(x, y) {
    for (const r of this.remotes.values()) if (r.map === this.map && r.x === x && r.y === y) return r;
    return null;
  }

  // ------------------------------------------------------------ teclas
  onKey(k) {
    if (ui.busy || ui.consumed() || this.locked || !this.handlers) return;
    if (this.editor) return;
    switch (k) {
      case 'a': this.interact(); break;
      case 'b': this.handlers.openMenu(); break;
      case 'enter': case 'chat': this.handlers.openChat(); break;
      case 'bike': this.toggleBike(); break;
      case 'map': this.handlers.openMap(); break;
      case 'fish': this.handlers.fish(); break;
      case 'party': this.handlers.openParty(); break;
      case 'bag': this.handlers.openBag(); break;
      case 'emote': this.handlers.emote(); break;
      case 'runToggle': this.toggleRun(); break;
      case 'controls': this.handlers.openControls(); break;
      case 'poketch': this.handlers.openPoketch(); break;
      case 'jobs': this.handlers.openJobs(); break;
      default: break;
    }
  }

  toggleRun() {
    const o = S().options;
    o.autoRun = !o.autoRun;
    markDirty();
    audio.sfx('select');
    ui.toast(o.autoRun ? '🏃 Corrida ligada (segure Shift para andar)' : '🚶 Corrida desligada (segure Shift para correr)');
  }

  toggleBike() {
    const p = this.player;
    if (this.map !== 'world') { ui.toast('Não dá para andar de bicicleta aqui dentro!'); return; }
    if (p.mode === 'surf') return;
    if (!S().keyItems.includes('bicicleta')) { ui.toast('Você não tem uma bicicleta.'); return; }
    p.mode = p.mode === 'bike' ? 'walk' : 'bike';
    audio.sfx('select');
    this.sendPos();
  }

  facing() {
    const p = this.player;
    const [dx, dy] = DXY[p.dir];
    return [p.x + dx, p.y + dy];
  }

  interact() {
    if (this.player.moving) return;
    const [fx, fy] = this.facing();
    this.handlers.interact(fx, fy);
  }

  // ------------------------------------------------------------ cena para o renderizador
  scene() {
    const p = this.player;
    const now = net.now();
    const tod = timeOfDay(now);
    let darkness = tod === 'night' ? 0.58 : tod === 'dusk' ? 0.22 : tod === 'dawn' ? 0.18 : 0;
    let tint = tod === 'dusk' ? 'rgba(255,120,50,0.10)' : tod === 'dawn' ? 'rgba(255,180,120,0.08)' : null;
    const lights = [];
    let weather = null;
    const ents = [];
    const pe = { ...p, kind: 'player', look: S().look, frame: p.frame, mode: p.mode === 'walk' && p.moving && p.runMode === 'run' ? 'run' : p.mode };
    ents.push(pe);
    const overlap = (f, a) => f.x === a.x && f.y === a.y && !f.moving;
    if (this.follower && !overlap(this.follower, p)) ents.push(this.follower);
    if (this.map === 'world') for (const w of this.wilds.list) ents.push(w);
    for (const n of this.npcs) if (n.kind === 'npc' || n.kind === 'pkmn') ents.push(n);
    for (const r of this.remotes.values()) {
      if (r.map !== this.map) continue;
      ents.push(r);
      if (r.follower && r.mode !== 'surf' && !overlap(r.follower, r)) ents.push(r.follower);
    }
    if (this.map === 'world') {
      const z = this.zone || zoneAt(this.world, p.x, p.y);
      weather = z && z.weather ? z.weather : null;
      const g = this.world.ground[p.y * W + p.x];
      if (!weather && g === T.SNOW) weather = 'snow';
      if (z && z.id === 'stark') weather = 'ash';
      if (z && z.dark) darkness = Math.max(darkness, z.dark);
      const t = this.tileAt(p.x, p.y);
      const inCave = t === T.CAVE;
      if (inCave) { darkness = Math.max(darkness, 0.62); tint = null; weather = null; }
      if (darkness > 0) {
        lights.push({ x: p.rx + 0.5, y: p.ry + 0.4, r: inCave ? 5 : 3, a: 0.9 });
        const v = this.renderer.view;
        if (v) {
          const x0 = v.x0 / TS - 3, x1 = v.x1 / TS + 3, y0 = v.y0 / TS - 3, y1 = v.y1 / TS + 3;
          for (const n of this.npcs) {
            if (n.kind !== 'static' || n.x < x0 || n.x > x1 || n.y < y0 || n.y > y1) continue;
            if (n.obj.kind === 'lamp') lights.push({ x: n.x + 0.5, y: n.y - 0.6, r: 3.6, warm: '#ffd27a' });
            if (n.obj.kind === 'legend') lights.push({ x: n.x + 0.5, y: n.y, r: 2.5, warm: '#ffffff' });
          }
          for (const b of this.world.buildings) {
            if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
            lights.push({ x: b.doorX + 0.5, y: b.doorY + 0.9, r: 2.4, warm: '#ffcf70', a: 0.85 });
            lights.push({ x: b.x + b.w / 2, y: b.y + b.h - 0.8, r: Math.max(2, b.w * 0.6), warm: '#ffcf70', a: 0.5 });
          }
          for (const r of this.remotes.values()) if (r.map === this.map) lights.push({ x: r.rx + 0.5, y: r.ry + 0.4, r: 2.6, a: 0.8 });
        }
      }
    } else {
      const m = this.interior;
      darkness = m.dark || 0;
      tint = null;
      if (darkness > 0) {
        lights.push({ x: p.rx + 0.5, y: p.ry + 0.4, r: 4, a: 0.95 });
        lights.push({ x: m.exit.x + 0.5, y: m.exit.y, r: 3, a: 0.7 });
      }
    }
    return {
      mode: this.map === 'world' ? 'world' : 'interior',
      interior: this.interior,
      player: pe,
      entities: ents,
      hidden: this.hidden,
      houses: state.houses,
      extra: this.map === 'world' ? this.npcs.filter((n) => n.kind === 'static' && n.obj.kind === 'trash').map((n) => n.obj) : null,
      objState: { berries: S().berries, honey: S().honey, dig: S().dig, now },
      gymColors: GYM_COLORS,
      light: darkness,
      darkness,
      tint,
      lights,
      weather,
      editor: this.editor ? this.editor.sceneInfo() : null,
    };
  }

  // ------------------------------------------------------------ HUD
  updateHud() {
    const now = performance.now();
    if (!this.hudT || now - this.hudT > 250) {
      this.hudT = now;
      const z = this.zone;
      const zn = this.map === 'world' ? (z ? (z.city ? z.name : `${z.name} • Nv. ${TIER_LEVELS[z.tier].join('–')}`) : '') : (this.building ? this.buildingTitle() : '');
      setText('hud-zone', zn);
      setText('hud-time', `${clockText(net.now())} • ${{ day: 'Dia', night: 'Noite', dusk: 'Entardecer', dawn: 'Amanhecer' }[timeOfDay(net.now())]}`);
      setText('hud-money', S().money.toLocaleString('pt-BR'));
      setText('hud-online', `${this.onlineCount} no mundo`);
      // botão de decorar aparece na sua própria casa
      const hb = this.building && this.building.plotId ? state.houses[this.building.plotId] : null;
      const myHouse = !!(hb && hb.owner === state.accountKey);
      const db = document.getElementById('decorbtn');
      if (db) db.classList.toggle('hidden', !myHouse || !!this.editor);
      if (myHouse && this.hintedHouse !== this.building.id) { this.hintedHouse = this.building.id; ui.toast('🏡 Sua casa! Toque em 🛋️ Decorar casa (ou E) para colocar seus móveis.', 'good'); }
      const runBtn = document.querySelector('#hud-buttons [data-act=run]');
      if (runBtn) runBtn.classList.toggle('on', !!S().options.autoRun);
      const bike = document.querySelector('#hud-buttons [data-act=bike]');
      if (bike) bike.classList.toggle('on', this.player.mode === 'bike');
      const party = S().party;
      const key = party.map((m) => `${m.species}:${m.hp}:${m.level}`).join(',');
      if (key !== this.partyKey) {
        this.partyKey = key;
        document.getElementById('hud-party').innerHTML = party.map((m) => {
          const mh = Math.max(1, calcMax(m));
          return `<div class="hp-mini"><img src="${spriteUrl.icon(m.species)}" alt=""><div class="b"><i class="${hpClass(m.hp, mh)}" style="width:${(m.hp / mh) * 100}%;background:${m.hp / mh > 0.5 ? '#5be07f' : m.hp / mh > 0.2 ? '#f2c230' : '#e3403b'}"></i></div><span class="lv">${m.level}</span></div>`;
        }).join('');
      }
    }
  }

  buildingTitle() {
    const b = this.building;
    if (b.plotId) {
      const h = state.houses[b.plotId];
      return h ? `Casa de ${h.ownerName}` : 'Casa à venda';
    }
    const city = this.world.cities.find((c) => c.id === b.city);
    return city ? `${b.name} — ${city.name}` : b.name;
  }
}

const GYM_COLORS = Object.fromEntries(Object.values(GYMS).map((g) => [g.city, g.color]));

function setText(id, t) {
  const el = document.getElementById(id);
  if (el && el.textContent !== t) el.textContent = t;
}

import { maxHp as calcMax } from '../../shared/pokemon.js';
void esc; void money; void healMon; void monName; void isUsable; void addMoney;
