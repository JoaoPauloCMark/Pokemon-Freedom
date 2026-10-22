// Trabalhos informais: quadros de aviso nos Centros Pokémon com bicos para
// ganhar dinheiro sem batalhar (entregas, colheita, pesca, passeios, limpeza...).
import { CITIES, ZONES, ZONE_INDEX, T, W } from '../../shared/world/defs.js';
import { buildEncounterTables } from '../../shared/world/encounters.js';
import { POKEDEX } from '../../shared/data/pokedex.js';
import { ITEMS } from '../../shared/data/items.js';
import { TYPE_PT } from '../../shared/data/types.js';
import { hashStr, mulberry32 } from '../../shared/rng.js';
import { S, state, addMoney, addItem, markDirty, saveNow } from '../state.js';
import { ui, money, esc } from '../ui/ui.js';
import { audio } from '../audio.js';
import { net } from '../net.js';

export const MAX_JOBS = 3;
const BLOCK_MS = 3 * 3600 * 1000; // o quadro de cada cidade muda a cada 3 horas

export const JOB_KINDS = {
  entrega: { icon: '📦', name: 'Entrega' },
  frutas: { icon: '🍒', name: 'Colheita de Frutas' },
  mineracao: { icon: '⛏️', name: 'Escavação' },
  pesca: { icon: '🎣', name: 'Pesca' },
  passeio: { icon: '🐾', name: 'Passeio com Pokémon' },
  limpeza: { icon: '🧹', name: 'Limpeza da Cidade' },
  cacada: { icon: '⚔️', name: 'Controle de Selvagens' },
  captura: { icon: '📸', name: 'Pesquisa de Campo' },
  mel: { icon: '🍯', name: 'Apicultura' },
};

const HUNT_TYPES = ['Normal', 'Bug', 'Flying', 'Poison', 'Water', 'Grass', 'Rock', 'Ground', 'Psychic', 'Ghost', 'Fire', 'Electric', 'Ice', 'Fighting', 'Dark', 'Steel', 'Dragon'];

const cityById = (id) => CITIES.find((c) => c.id === id);
const cityTier = (id) => (ZONES[ZONE_INDEX[id]] || { tier: 1 }).tier;
const round50 = (n) => Math.max(100, Math.round(n / 50) * 50);

// Espécies que aparecem perto (zonas com tier parecido) — usadas em pesquisa de campo.
function nearbySpecies(tier) {
  const tables = buildEncounterTables();
  const out = new Set();
  for (const z of ZONES) {
    if (!z || z.city || Math.abs(z.tier - tier) > 1) continue;
    for (const c of tables[z.id].grass) if (c.w >= 8) out.add(c.id);
  }
  return [...out].sort((a, b) => a - b);
}

function makeJob(kind, cityId, tier, rng, block) {
  const mult = 1 + (tier - 1) * 0.18;
  const base = { id: `${cityId}:${block}:${kind}`, kind, city: cityId, have: 0 };
  const from = cityById(cityId);
  const n = (a, b) => a + Math.floor(rng() * (b - a + 1));
  switch (kind) {
    case 'entrega': {
      const others = CITIES.filter((c) => c.id !== cityId && c.id !== 'league');
      const dest = others[Math.floor(rng() * others.length)];
      const d = Math.hypot(dest.cx - from.cx, dest.cy - from.cy);
      const who = ['a Enfermeira Joy', 'um senhor simpático', 'a dona da floricultura', 'um colecionador', 'a vovó do Centro', 'um treinador ansioso'][n(0, 5)];
      return { ...base, need: 1, dest: dest.id, pay: round50((300 + d * 9) * mult), title: `Levar encomenda até ${dest.name}`, desc: `Pacote de ${who}. Entregue no quadro de trabalhos do Centro Pokémon de ${dest.name}.` };
    }
    case 'frutas': {
      const need = n(3, 6);
      return { ...base, need, pay: round50((160 * need + 150) * mult), title: `Colher ${need} frutas`, desc: 'Colha frutas nas árvores das rotas (aquelas com frutinhas coloridas).' };
    }
    case 'mineracao': {
      const need = n(1, 3);
      return { ...base, need, pay: round50((650 * need + 200) * mult), title: `Desenterrar ${need} ${need > 1 ? 'tesouros' : 'tesouro'}`, desc: 'Escave nas paredes brilhantes das cavernas e desenterre itens.' };
    }
    case 'pesca': {
      const need = n(2, 4);
      return { ...base, need, pay: round50((380 * need) * mult), title: `Fisgar ${need} Pokémon`, desc: 'Pesque (tecla F de frente para a água) e fisgue Pokémon. Precisa de uma vara de pescar.' };
    }
    case 'passeio': {
      const need = n(3, 8) * 100;
      return { ...base, need, pay: round50((need * 1.6) * mult), title: `Passear ${need} passos`, desc: 'Ande com um Pokémon na equipe (ele te segue). Correr e pedalar também valem!' };
    }
    case 'limpeza': {
      const need = n(4, 7);
      return { ...base, need, pay: round50((140 * need + 250) * mult), title: `Limpar ${need} sujeiras em ${from.name}`, desc: `Recolha o lixo espalhado pelas ruas de ${from.name} (aparece quando você aceita).`, trash: null };
    }
    case 'cacada': {
      const type = HUNT_TYPES[Math.floor(rng() * Math.min(HUNT_TYPES.length, 9 + tier))];
      const need = n(3, 5);
      return { ...base, need, type, pay: round50((320 * need) * mult), title: `Vencer ${need} selvagens do tipo ${TYPE_PT[type]}`, desc: `Pokémon do tipo ${TYPE_PT[type]} estão causando confusão. Vença ${need} em batalhas selvagens.` };
    }
    case 'captura': {
      const list = nearbySpecies(tier);
      if (!list.length) return null;
      const sp = list[Math.floor(rng() * list.length)];
      return { ...base, need: 1, species: sp, pay: round50((900 + (POKEDEX[sp].catchRate < 100 ? 900 : 300)) * mult), title: `Capturar um ${POKEDEX[sp].name}`, desc: `Um pesquisador quer dados de ${POKEDEX[sp].name}. Capture um (ele fica com você!).` };
    }
    case 'mel': {
      return { ...base, need: 1, pay: round50(850 * mult), title: 'Passar mel numa árvore dourada', desc: 'O apicultor te dá 1 Mel: passe numa árvore de mel (tronco dourado) nas rotas.', giveHoney: true };
    }
    default: return null;
  }
}

// Ofertas do quadro de uma cidade (mudam a cada 3h, diferentes por jogador).
export function boardJobs(cityId) {
  const block = Math.floor(net.now() / BLOCK_MS);
  const rng = mulberry32(hashStr(`${cityId}:${block}:${state.accountKey}:${state.worldId}`));
  const kinds = Object.keys(JOB_KINDS);
  for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
  const jobs = kinds.slice(0, 5).map((k) => makeJob(k, cityId, cityTier(cityId), rng, block)).filter(Boolean);
  const s = S();
  return jobs.filter((j) => !s.jobs.done.includes(j.id) && !s.jobs.active.some((a) => a.id === j.id));
}

// Sujeiras de um trabalho de limpeza: posições livres nas ruas da cidade.
function placeTrash(job, game) {
  const L = game.world.cityLayouts[job.city];
  const rng = mulberry32(hashStr(job.id + ':lixo'));
  const used = new Set(game.world.objects.map((o) => o.y * W + o.x));
  for (const b of game.world.buildings) used.add((b.doorY + 1) * W + b.doorX);
  const out = [];
  for (let k = 0; k < 400 && out.length < job.need; k++) {
    const x = L.x0 + Math.floor(rng() * L.w), y = L.y0 + Math.floor(rng() * L.h);
    const t = game.world.tiles[y * W + x];
    if (!(t === T.PAVE || t === T.CITYGRASS || t === T.PLAZA || t === T.SNOW)) continue;
    if (used.has(y * W + x) || out.some(([a, b]) => Math.abs(a - x) + Math.abs(b - y) < 3)) continue;
    out.push([x, y, 0]);
  }
  return out;
}

export function trashObjects() {
  const out = [];
  for (const j of S().jobs.active) {
    if (j.kind !== 'limpeza' || !j.trash) continue;
    j.trash.forEach(([x, y, done], i) => { if (!done) out.push({ kind: 'trash', x, y, id: `lixo:${j.id}:${i}`, job: j.id, i }); });
  }
  return out;
}

function finishJob(j, game) {
  const s = S();
  s.jobs.active = s.jobs.active.filter((a) => a !== j);
  if (!s.jobs.done.includes(j.id)) s.jobs.done.push(j.id);
  if (s.jobs.done.length > 80) s.jobs.done = s.jobs.done.slice(-80);
  s.jobs.earned += j.pay;
  s.jobs.count += 1;
  addMoney(j.pay);
  audio.sfx('money');
  ui.toast(`${JOB_KINDS[j.kind].icon} Trabalho concluído: ${j.title}! +${money(j.pay)}`, 'good');
  if (s.jobs.count % 10 === 0) {
    addItem('docerarro', 1);
    ui.toast(`Bônus por ${s.jobs.count} trabalhos: 1 Doce Raro!`, 'good');
  }
  markDirty();
  saveNow();
  if (game) game.buildWorldNpcs(true);
}

// Avanço automático dos trabalhos. info: { type, types, species, i (lixo) }
export function jobEvent(kind, amount = 1, info = {}, game = null) {
  const s = S();
  if (!s || !s.jobs) return;
  for (const j of [...s.jobs.active]) {
    if (j.kind !== kind || j.kind === 'entrega') continue;
    if (kind === 'cacada' && !(info.types || []).includes(j.type)) continue;
    if (kind === 'captura' && info.species !== j.species) continue;
    if (kind === 'limpeza') {
      if (info.job !== j.id || !j.trash || !j.trash[info.i] || j.trash[info.i][2]) continue;
      j.trash[info.i][2] = 1;
    }
    j.have = Math.min(j.need, j.have + amount);
    markDirty();
    if (j.have >= j.need) finishJob(j, game);
    else if (kind !== 'passeio' || j.have % 100 === 0) ui.toast(`${JOB_KINDS[j.kind].icon} ${j.title}: ${j.have}/${j.need}`);
  }
}

// ------------------------------------------------------------ painel
// cityId: cidade do quadro (null = só mostra seus trabalhos, ex.: pelo Pokétch)
export function openJobs(game, cityId = null) {
  const s = S();
  // entregas para esta cidade são concluídas ao abrir o quadro
  if (cityId) {
    for (const j of [...s.jobs.active]) {
      if (j.kind === 'entrega' && j.dest === cityId) { j.have = 1; finishJob(j, game); }
    }
  }
  const city = cityId ? cityById(cityId) : null;
  return new Promise((resolve) => {
    ui.panel({
      title: city ? `Quadro de Trabalhos — ${esc(city.name)}` : 'Meus Trabalhos',
      sub: `Ganhos com trabalhos: ${money(s.jobs.earned)} • ${s.jobs.count} concluído(s)`,
      width: 'min(760px,96vw)',
      onClose: () => resolve(),
      build: (body, L) => {
        const render = () => {
          const offers = city ? boardJobs(cityId) : [];
          const act = s.jobs.active;
          body.innerHTML = `
            <h3 class="jobs-h">Seus trabalhos (${act.length}/${MAX_JOBS})</h3>
            <div class="jobs-list">${act.length ? act.map((j, i) => `
              <div class="job-card active">
                <div class="job-ic">${JOB_KINDS[j.kind].icon}</div>
                <div class="grow"><b>${esc(j.title)}</b><div class="muted">${esc(j.desc)}</div>
                  <div class="job-bar"><i style="width:${Math.round((j.have / j.need) * 100)}%"></i></div>
                  <div class="muted">${j.kind === 'entrega' ? 'Leve até o destino' : `${j.have}/${j.need}`} • Pagamento: <b>${money(j.pay)}</b></div></div>
                <button class="btn small" data-quit="${i}">Desistir</button>
              </div>`).join('') : '<div class="muted">Nenhum trabalho no momento.</div>'}</div>
            ${city ? `<h3 class="jobs-h">Ofertas de hoje <span class="muted">(o quadro muda a cada 3 horas)</span></h3>
              <div class="jobs-list">${offers.length ? offers.map((j, i) => `
                <div class="job-card">
                  <div class="job-ic">${JOB_KINDS[j.kind].icon}</div>
                  <div class="grow"><b>${esc(j.title)}</b><div class="muted">${esc(j.desc)}</div></div>
                  <div class="col" style="align-items:flex-end;gap:4px"><b class="job-pay">${money(j.pay)}</b><button class="btn green small" data-take="${i}">Aceitar</button></div>
                </div>`).join('') : '<div class="muted">Você já pegou todas as ofertas deste quadro. Volte mais tarde!</div>'}</div>`
    : '<div class="desc-box">Os quadros de trabalho ficam dentro dos Centros Pokémon de cada cidade. Lá você aceita bicos e entrega encomendas.</div>'}`;
          body.querySelectorAll('[data-quit]').forEach((b) => b.onclick = async () => {
            const j = act[+b.dataset.quit];
            if (!(await ui.ask(`Desistir de "${j.title}"?`))) return;
            s.jobs.active = s.jobs.active.filter((a) => a !== j);
            markDirty();
            if (game) game.buildWorldNpcs(true);
            render();
          });
          body.querySelectorAll('[data-take]').forEach((b) => b.onclick = () => {
            if (s.jobs.active.length >= MAX_JOBS) { ui.toast(`Você só pode ter ${MAX_JOBS} trabalhos ao mesmo tempo.`, 'bad'); return; }
            const j = offers[+b.dataset.take];
            if (j.kind === 'limpeza') j.trash = placeTrash(j, game);
            if (j.giveHoney) { addItem('mel', 1); ui.toast(`Você recebeu 1 ${ITEMS.mel.name}.`, 'good'); }
            s.jobs.active.push(j);
            markDirty();
            audio.sfx('confirm');
            ui.toast(`${JOB_KINDS[j.kind].icon} Trabalho aceito: ${j.title}`, 'good');
            if (game) game.buildWorldNpcs(true);
            render();
          });
        };
        L.render = render;
        render();
      },
    });
  });
}
