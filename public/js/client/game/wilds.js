// Pokémon selvagens visíveis: aparecem perto do jogador nos habitats do mapa,
// andam por aí e começam uma batalha quando o jogador encosta neles.
import { T, W, H, tileHabitat } from '../../shared/world/defs.js';
import { zoneAt } from '../../shared/world/world.js';
import { rollEncounter } from '../../shared/world/encounters.js';
import { POKEDEX } from '../../shared/data/pokedex.js';
import { timeOfDay } from '../../shared/time.js';
import { DXY } from '../input.js';
import { net } from '../net.js';
import { leadMon, partyAlive } from '../state.js';
import { ui } from '../ui/ui.js';
import { spriteUrl, loadImage } from '../assets.js';

const MAX_WILDS = 6;
const LIFETIME = 45;

// classe do habitat do tile (para o Pokémon não sair do seu ambiente)
function habClass(t) {
  if (t === T.WATER || t === T.DEEP) return 'water';
  if (t === T.CAVE) return 'cave';
  if (t === T.DESERT) return 'desert';
  if (t === T.TALL || t === T.SNOWTALL || t === T.FLOWERS || t === T.ASHTALL || t === T.MARSH) return 'grass';
  return null;
}

export class WildSpawner {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.spawnTimer = 2;
  }

  clear() { this.list = []; }

  at(x, y) {
    return this.list.find((w) => !w.leaving && w.x === x && w.y === y) || null;
  }

  occupied(x, y) {
    const g = this.game;
    const p = g.player;
    if (p.x === x && p.y === y) return true;
    if (p.moving && p.moving.tx === x && p.moving.ty === y) return true;
    if (g.follower && g.follower.x === x && g.follower.y === y) return true;
    if (this.list.some((w) => w.x === x && w.y === y)) return true;
    if (g.npcs.some((n) => n.x === x && n.y === y)) return true;
    return false;
  }

  tile(x, y) {
    return x < 0 || y < 0 || x >= W || y >= H ? T.DEEP : this.game.world.tiles[y * W + x];
  }

  update(dt) {
    const g = this.game;
    if (g.map !== 'world') { if (this.list.length) this.clear(); return; }
    const p = g.player;
    for (const w of this.list) {
      w.age += dt;
      w.alpha = w.leaving ? Math.max(0, w.alpha - dt * 2.5) : Math.min(1, w.alpha + dt * 2.5);
      if (w.age > LIFETIME || Math.abs(w.x - p.x) > 20 || Math.abs(w.y - p.y) > 16) w.leaving = true;
      if (w.moving) {
        w.moving.t += dt / w.moving.dur;
        if (w.moving.t >= 1) { w.x = w.moving.tx; w.y = w.moving.ty; w.rx = w.x; w.ry = w.y; w.moving = null; }
        else { w.rx = w.moving.fx + (w.moving.tx - w.moving.fx) * w.moving.t; w.ry = w.moving.fy + (w.moving.ty - w.moving.fy) * w.moving.t; }
        continue;
      }
      w.next -= dt;
      if (w.next > 0 || w.leaving) continue;
      w.next = 1 + Math.random() * 2.5;
      const d = Math.floor(Math.random() * 4);
      const [dx, dy] = DXY[d];
      const nx = w.x + dx, ny = w.y + dy;
      w.dir = d;
      if (habClass(this.tile(nx, ny)) !== w.hab || this.occupied(nx, ny)) continue;
      w.moving = { fx: w.x, fy: w.y, tx: nx, ty: ny, t: 0, dur: 0.4 };
    }
    this.list = this.list.filter((w) => !(w.leaving && w.alpha <= 0));
    // novos Pokémon
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && !g.locked) {
      this.spawnTimer = 1.2 + Math.random() * 2;
      if (this.list.length < MAX_WILDS) this.trySpawn();
    }
  }

  trySpawn() {
    const g = this.game;
    const p = g.player;
    const time = timeOfDay(net.now()) === 'night' ? 'night' : 'day';
    for (let k = 0; k < 14; k++) {
      const x = p.x + Math.floor(Math.random() * 25) - 12;
      const y = p.y + Math.floor(Math.random() * 19) - 9;
      if (Math.abs(x - p.x) + Math.abs(y - p.y) < 4) continue;
      const t = this.tile(x, y);
      const hab = habClass(t);
      if (!hab || this.occupied(x, y)) continue;
      const z = zoneAt(g.world, x, y);
      if (!z) continue;
      const enc = rollEncounter(z.id, tileHabitat(t), time);
      if (!enc) continue;
      const lead = leadMon();
      if (g.repel > 0 && lead && enc.level < lead.level) continue;
      loadImage(spriteUrl.icon(enc.species));
      this.list.push({
        kind: 'wild', species: enc.species, level: enc.level, shiny: Math.random() < 1 / 400,
        x, y, rx: x, ry: y, dir: Math.floor(Math.random() * 4), moving: null, hab, zone: z,
        age: 0, alpha: 0, next: Math.random() * 2, leaving: false,
        flying: POKEDEX[enc.species].types.includes('Flying'),
        swim: hab === 'water',
      });
      return;
    }
  }

  // jogador encostou: começa a batalha com este Pokémon
  engage(w) {
    if (w.leaving) return false;
    if (!partyAlive()) { ui.toast('Seus Pokémon precisam de cuidados antes de batalhar!', 'bad'); return false; }
    w.leaving = true;
    w.alpha = 0;
    const terrain = { water: 'water', cave: 'cave', desert: 'desert' }[w.hab] ||
      (this.tile(w.x, w.y) === T.SNOWTALL ? 'snow' : this.tile(w.x, w.y) === T.MARSH ? 'marsh' : this.tile(w.x, w.y) === T.ASHTALL ? 'volcano' : 'grass');
    this.game.startWild(w.species, w.level, terrain, w.zone, w.shiny);
    return true;
  }
}
