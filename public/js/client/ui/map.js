// Mapa da região com voo rápido para cidades visitadas.
import { ui, esc } from './ui.js';
import { audio } from '../audio.js';
import { S, state } from '../state.js';
import { T, W, H, ZONES, TIER_LEVELS } from '../../shared/world/defs.js';
import { zoneAt } from '../../shared/world/world.js';
import { makeCanvas } from '../render/color.js';

const COLORS = {
  [T.DEEP]: '#2d63b4', [T.WATER]: '#4c94dc', [T.SAND]: '#ecd49a', [T.GRASS]: '#7cc45a', [T.TALL]: '#4f9f45',
  [T.PATH]: '#d8b77f', [T.PAVE]: '#cfcdc8', [T.TREE]: '#2f7a3c', [T.ROCK]: '#8a7a66', [T.CAVE]: '#5e4c40',
  [T.SNOW]: '#f1f5fb', [T.SNOWTALL]: '#c4dcea', [T.FLOWERS]: '#e9a3c9', [T.MARSH]: '#6f7a46', [T.ASH]: '#7d7576',
  [T.LAVA]: '#ff7a2a', [T.BRIDGE]: '#b8814b', [T.BUILDING]: '#c9573d', [T.DOOR]: '#c9573d', [T.DESERT]: '#e7c784',
  [T.PINE]: '#2e7552', [T.BOULDER]: '#9a948c', [T.CACTUS]: '#4f9a4a', [T.CITYGRASS]: '#a3dc84', [T.ASHTALL]: '#5e5557', [T.PLAZA]: '#e3d5bb',
};

let mapCanvas = null;
let zoneInfo = null;

// Centro e tamanho de cada zona (para os rótulos de nível)
function getZoneInfo(world) {
  if (zoneInfo) return zoneInfo;
  const acc = new Map();
  for (let i = 0; i < W * H; i++) {
    const z = world.zone[i];
    if (!z) continue;
    const a = acc.get(z) || { n: 0, x: 0, y: 0 };
    a.n++; a.x += i % W; a.y += (i / W) | 0;
    acc.set(z, a);
  }
  zoneInfo = [...acc.entries()].map(([zi, a]) => ({ zi, x: a.x / a.n, y: a.y / a.n, n: a.n }));
  return zoneInfo;
}

// Nível de referência da equipe: média dos 3 Pokémon mais fortes
export function teamLevel() {
  const lv = S().party.map((m) => m.level).sort((a, b) => b - a).slice(0, 3);
  return lv.length ? Math.round(lv.reduce((a, b) => a + b, 0) / lv.length) : 5;
}

export function zoneDanger(z, ref) {
  const [lo, hi] = TIER_LEVELS[z.tier];
  if (hi < ref - 4) return 'easy';
  if (lo > ref + 4) return 'hard';
  return 'ok';
}
const DANGER_COLOR = { easy: [69, 200, 106], ok: [242, 194, 48], hard: [227, 64, 59] };

function levelOverlay(world, ref) {
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  const byZone = ZONES.map((z) => (z && !z.city ? DANGER_COLOR[zoneDanger(z, ref)] : null));
  for (let i = 0; i < W * H; i++) {
    const col = byZone[world.zone[i]];
    const t = world.tiles[i];
    if (!col || t === T.DEEP || t === T.WATER) continue;
    img.data[i * 4] = col[0]; img.data[i * 4 + 1] = col[1]; img.data[i * 4 + 2] = col[2]; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
function getMapCanvas(world) {
  if (mapCanvas) return mapCanvas;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  const cache = {};
  for (let i = 0; i < W * H; i++) {
    const col = COLORS[world.tiles[i]] || '#ff00ff';
    let rgb = cache[col];
    if (!rgb) { const n = parseInt(col.slice(1), 16); rgb = cache[col] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    img.data[i * 4] = rgb[0]; img.data[i * 4 + 1] = rgb[1]; img.data[i * 4 + 2] = rgb[2]; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  mapCanvas = c;
  return c;
}

export function openMap(game) {
  const world = game.world;
  const s = S();
  const visited = new Set(s.visited || []);
  const layer = ui.panel({
    title: 'Mapa de Sinnoh', sub: 'Clique numa cidade visitada para voar até lá', width: 'auto',
    build: (body) => {
      const pct = (x, y) => [`${((x + 0.5) / W) * 100}%`, `${((y + 0.5) / H) * 100}%`];
      const wrap = document.createElement('div');
      wrap.className = 'mapview';
      const src = getMapCanvas(world);
      const cv = makeCanvas(W * 2, H * 2);
      const ctx = cv.getContext('2d');
      const ref = teamLevel();
      const overlay = levelOverlay(world, ref);
      const labels = [];
      const draw = () => {
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = 1;
        ctx.drawImage(src, 0, 0, W * 2, H * 2);
        if (showLevels) { ctx.globalAlpha = 0.22; ctx.drawImage(overlay, 0, 0, W * 2, H * 2); ctx.globalAlpha = 1; }
        labels.forEach((l) => { l.style.display = showLevels ? '' : 'none'; });
      };
      let showLevels = true;
      try { showLevels = localStorage.getItem('pkfreedom_maplv') !== '0'; } catch { /* sem storage */ }
      wrap.appendChild(cv);
      body.appendChild(wrap);
      // faixas de nível de cada área (não impede ninguém de ir — é só um guia)
      for (const zi of getZoneInfo(world)) {
        const z = ZONES[zi.zi];
        if (!z || z.city || zi.n < 60) continue;
        const [lo, hi] = TIER_LEVELS[z.tier];
        const d = document.createElement('div');
        d.className = `map-lv ${zoneDanger(z, ref)}`;
        d.title = z.name;
        [d.style.left, d.style.top] = pct(zi.x, zi.y);
        d.textContent = `${lo}–${hi}`;
        wrap.appendChild(d);
        labels.push(d);
      }
      const legend = document.createElement('div');
      legend.className = 'row map-legend';
      legend.innerHTML = `<label class="row" style="gap:6px;cursor:pointer"><input type="checkbox" ${showLevels ? 'checked' : ''}> Mostrar níveis</label>
        <span class="map-lv easy static">tranquilo</span><span class="map-lv ok static">no seu nível</span><span class="map-lv hard static">perigoso</span>
        <span class="muted">Sua equipe: Nv. ~${ref}. Os números mostram o nível dos selvagens — dá para ir a qualquer lugar!</span>`;
      legend.querySelector('input').onchange = (e) => {
        showLevels = e.target.checked;
        try { localStorage.setItem('pkfreedom_maplv', showLevels ? '1' : '0'); } catch { /* sem storage */ }
        draw();
      };
      body.appendChild(legend);
      draw();
      const info = document.createElement('div');
      info.className = 'muted';
      const pz = game.map === 'world' ? zoneAt(world, game.player.x, game.player.y) : null;
      info.textContent = `Você está em: ${game.map === 'world' ? (pz ? pz.name : '?') : game.buildingTitle()}`;
      body.appendChild(info);
      for (const c of world.cities) {
        const L = c.layout;
        const [l, t] = pct(L.x0 + L.w / 2, L.y0 - 2);
        const lab = document.createElement('div');
        lab.className = 'map-label';
        lab.style.left = l; lab.style.top = t;
        lab.style.cursor = visited.has(c.id) ? 'pointer' : 'default';
        lab.style.pointerEvents = 'auto';
        lab.innerHTML = `${visited.has(c.id) ? '✈ ' : ''}${esc(c.name.replace('Cidade ', '').replace('Vila ', ''))}`;
        lab.style.opacity = visited.has(c.id) ? '1' : '0.65';
        lab.onclick = async () => {
          if (!visited.has(c.id)) { ui.toast('Você ainda não visitou esta cidade.'); return; }
          if (!(await ui.ask(`Voar para ${c.name}?`))) return;
          // pousa na frente do Centro Pokémon (ou no meio da cidade, se ela não tiver um)
          const center = L.buildings.find((b) => b.type === 'center');
          const tx = center ? center.doorX : L.roadX + 1;
          const ty = center ? center.doorY + 1 : L.walkways[0];
          layer.close();
          audio.sfx('confirm');
          await game.teleport(tx, ty);
        };
        wrap.appendChild(lab);
      }
      // suas casas
      const myHouses = Object.entries(state.houses).filter(([, h]) => h && h.owner === state.accountKey);
      for (const [plotId] of myHouses) {
        const b = world.buildings.find((x) => x.plotId === plotId);
        if (!b) continue;
        const c = world.cities.find((x) => x.id === b.city);
        const d = document.createElement('div');
        d.className = 'map-house';
        d.textContent = '🏠';
        d.title = `Sua casa em ${c ? c.name : b.city}`;
        [d.style.left, d.style.top] = pct(b.doorX, b.doorY);
        wrap.appendChild(d);
      }
      if (myHouses.length) {
        const h = document.createElement('div');
        h.className = 'muted';
        h.textContent = `🏠 Suas casas: ${myHouses.map(([pid]) => { const b = world.buildings.find((x) => x.plotId === pid); const c = b && world.cities.find((x) => x.id === b.city); return c ? c.name.replace('Cidade ', '') : pid; }).join(', ')}`;
        body.appendChild(h);
      }
      // eu
      const px = game.map === 'world' ? game.player.x : (game.building ? game.building.doorX : 0);
      const py = game.map === 'world' ? game.player.y : (game.building ? game.building.doorY : 0);
      const me = document.createElement('div');
      me.className = 'map-me';
      [me.style.left, me.style.top] = pct(px, py);
      wrap.appendChild(me);
      for (const r of game.remotes.values()) {
        let x = r.x, y = r.y;
        if (r.map !== 'world') { const b = world.buildings.find((bb) => 'int:' + bb.id === r.map); if (!b) continue; x = b.doorX; y = b.doorY; }
        const d = document.createElement('div');
        d.className = 'map-other';
        d.title = r.name;
        [d.style.left, d.style.top] = pct(x, y);
        wrap.appendChild(d);
      }
    },
  });
  return layer;
}
