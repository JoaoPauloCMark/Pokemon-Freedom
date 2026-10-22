// Mecânicas e easter eggs do Pokémon Diamond espalhados pelo mundo:
// árvores de frutas e de mel, escavação, itens escondidos, ovos e creche,
// Torre de Batalha, loteria, tutores de golpes, trocas, Equipe Galáctica...
import { T, W, ZONES, TIER_LEVELS } from '../../shared/world/defs.js';
import { zoneAt } from '../../shared/world/world.js';
import { GALACTIC, galacticTeam, rivalTeam, SPECIAL_LOOKS, TRAINER_COOLDOWN_MS } from '../../shared/world/npcs.js';
import { outbreakOf, trophyOf } from '../../shared/world/encounters.js';
import { createPokemon, monName, isUsable, makeMove, gainExp, maxHp } from '../../shared/pokemon.js';
import { POKEDEX } from '../../shared/data/pokedex.js';
import { MOVES } from '../../shared/data/moves.js';
import { ITEMS } from '../../shared/data/items.js';
import { randomLook } from '../../shared/data/clothes.js';
import { hashStr, mulberry32 } from '../../shared/rng.js';
import { timeOfDay } from '../../shared/time.js';
import { S, state, addItem, useItem, addMoney, addPokemon, healParty, markDirty, saveNow, markSeen } from '../state.js';
import { ui, money, esc, fade } from '../ui/ui.js';
import { audio } from '../audio.js';
import { net } from '../net.js';
import { runBattle } from '../ui/battle.js';
import { pickPartyMon, pickMove, typeChip, iconImg } from '../ui/pickers.js';
import { openMining } from '../ui/mining.js';
import { jobEvent } from './jobs.js';

const HOUR = 3600 * 1000;
export const BERRY_REGROW_MS = 2 * HOUR;
export const HONEY_WAIT_MS = 10 * 60 * 1000;
const HONEY_DRY_MS = 24 * HOUR;
const DIG_SLOT_MS = 6 * HOUR; // cada parede pode ser escavada de novo a cada 6 horas
const HONEY_MONS = [[265, 18], [190, 14], [216, 12], [165, 10], [204, 10], [266, 5], [268, 5], [167, 8], [214, 5], [127, 5], [313, 4], [314, 4]];
const BABIES = [172, 173, 174, 236, 238, 239, 240, 298, 360];
const NAMES = ['Lucas', 'Dawn', 'Rafa', 'Bia', 'Teo', 'Lia', 'Caio', 'Nina', 'Duda', 'Gabi', 'Leo', 'Malu'];

export const berryReady = (s, o, now) => !s.berries[o.id] || now - s.berries[o.id] >= BERRY_REGROW_MS;
export function honeyState(s, o, now) {
  const h = s.honey[o.id];
  if (!h) return 'none';
  if (now - h >= HONEY_DRY_MS) return 'dry';
  return now - h >= HONEY_WAIT_MS ? 'ready' : 'wait';
}
export const digReady = (s, o, now) => s.dig[o.id] !== Math.floor(now / DIG_SLOT_MS);

function baseForm(id) {
  let c = id;
  for (let g = 0; g < 4 && POKEDEX[c].prevo; g++) c = POKEDEX[c].prevo;
  return c;
}
const bst = (id) => POKEDEX[id].base.reduce((a, b) => a + b, 0);
export const hatchSteps = (id) => Math.max(450, Math.min(1500, Math.round(bst(id) * 2.2)));

// Compatibilidade simplificada da creche (sem grupos de ovos):
// mesma linhagem, ou com Ditto, ou macho+fêmea que compartilham um tipo.
export function breedResult(a, b) {
  if (!a || !b) return null;
  const A = POKEDEX[a.species], B = POKEDEX[b.species];
  if (A.legendary || B.legendary) return null;
  if (a.species === 132 && b.species === 132) return null;
  if (a.species === 132) return baseForm(b.species);
  if (b.species === 132) return baseForm(a.species);
  if (a.gender === 'N' || b.gender === 'N' || a.gender === b.gender) return null;
  const mother = a.gender === 'F' ? a : b;
  if (baseForm(a.species) === baseForm(b.species)) return baseForm(mother.species);
  if (A.types.some((t) => B.types.includes(t))) return baseForm(mother.species);
  return null;
}

export function createFeatures(game) {
  const f = {};
  const who = (n) => n.name;
  const now = () => net.now();
  const badges = () => S().badges.length;

  // ------------------------------------------------------------ batalhas auxiliares
  const terrainHere = () => {
    const t = game.map === 'world' ? game.tileAt(game.player.x, game.player.y) : null;
    return t === T.CAVE ? 'cave' : t === T.SNOW || t === T.SNOWTALL ? 'snow' : t === T.SAND || t === T.DESERT ? 'desert' : game.map === 'world' ? 'grass' : 'gym';
  };
  async function trainerBattle(t, opts = {}) {
    if (!S().party.some(isUsable)) { await ui.dialog('Seus Pokémon precisam descansar antes de batalhar!'); return null; }
    game.locked = true;
    const team = t.team.map((x) => createPokemon(x.species, x.level, { shiny: false }));
    audio.sfx('encounter');
    await game.battleTransition();
    const z = game.map === 'world' ? zoneAt(game.world, game.player.x, game.player.y) : null;
    const r = await runBattle({
      kind: 'trainer', foe: team, terrain: opts.terrain || terrainHere(), music: opts.music || (t.boss ? 'gym' : 'battle'), zoneName: z ? z.name : '', noLoss: opts.noLoss,
      trainer: { name: t.name, cls: t.cls, look: t.look, reward: t.reward, defeat: t.defeat, gym: !!t.boss },
    });
    await game.afterBattle(opts.noLoss && r.result === 'lose' ? { ...r, result: 'tower' } : r);
    return r;
  }
  const ready = (id) => { const t = S().trainers[id]; return !t || Date.now() - t > TRAINER_COOLDOWN_MS; };
  const beaten = (id) => { S().trainers[id] = Date.now(); markDirty(); };

  async function galacticBattle(role, id, name, look) {
    const g = GALACTIC[role];
    const full = g.name ? `${g.cls} ${g.name}` : name || g.cls;
    if (!ready(id)) return ui.dialog(role === 'cyrus' ? '...Volte quando tiver algo novo a me mostrar.' : 'Grr... Ainda estou me recuperando da derrota!', { who: full });
    await ui.dialog(g.quote, { who: full });
    if (!(await ui.ask('Enfrentar a Equipe Galáctica?'))) return;
    const lvlTeam = galacticTeam(role, badges(), hashStr(id));
    const r = await trainerBattle({ name: g.name || name || 'Recruta', cls: g.name ? g.cls : '', look, team: lvlTeam, reward: lvlTeam[lvlTeam.length - 1].level * (role === 'grunt' ? 50 : 110), defeat: g.defeat, boss: role !== 'grunt' });
    if (r && r.result === 'win') {
      beaten(id);
      if (role === 'cyrus' && !S().flags.npc.cyrus) {
        S().flags.npc.cyrus = true;
        addItem('masterbola', 1);
        audio.sfx('caught');
        await ui.dialog(['Cyrus: Leve isto. Uma Master Bola... Ela captura qualquer Pokémon.', 'Você recebeu a Master Bola!'], { who: 'Cyrus' });
      }
    }
  }

  // ------------------------------------------------------------ objetos do mapa
  f.hiddenAt = (x, y) => game.world.objects.find((o) => o.kind === 'hidden' && o.x === x && o.y === y && !S().flags.items[o.id]) || null;

  f.takeHidden = async (o) => {
    S().flags.items[o.id] = true;
    addItem(o.item, 1);
    markDirty();
    audio.sfx('item');
    await ui.dialog(`Hum? Tinha algo escondido aqui... Você encontrou ${ITEMS[o.item].name}!`);
  };

  f.worldObject = async (n) => {
    const o = n.obj;
    const s = S();
    switch (o.kind) {
      case 'berry': {
        const it = ITEMS[o.berry];
        if (!berryReady(s, o, now())) {
          const left = Math.ceil((BERRY_REGROW_MS - (now() - s.berries[o.id])) / 60000);
          return ui.dialog(`É uma árvore de ${it.name}. Os frutos ainda estão crescendo... (mais ~${left} min)`);
        }
        if (!(await ui.ask(`É uma árvore de ${it.name}! Colher os frutos?`))) return;
        const qty = 2 + Math.floor(Math.random() * 3);
        s.berries[o.id] = now();
        addItem(o.berry, qty);
        audio.sfx('item');
        await ui.dialog(`Você colheu ${qty}× ${it.name}!`);
        jobEvent('frutas', qty, {}, game);
        return;
      }
      case 'honey': return honeyTree(o);
      case 'dig': return digSpot(o);
      case 'trash': {
        audio.sfx('item');
        jobEvent('limpeza', 1, { job: o.job, i: o.i }, game);
        game.buildWorldNpcs(true);
        return ui.toast('🧹 Você recolheu o lixo!');
      }
      case 'special': return special(o, n);
      default: return null;
    }
  };

  async function honeyTree(o) {
    const s = S();
    const st = honeyState(s, o, now());
    if (st === 'ready') {
      delete s.honey[o.id];
      markDirty();
      await ui.dialog('A árvore está balançando... Um Pokémon atraído pelo mel apareceu!');
      const total = HONEY_MONS.reduce((a, [, w]) => a + w, 0);
      let r = Math.random() * total, sp = 265;
      for (const [id, w] of HONEY_MONS) { r -= w; if (r <= 0) { sp = id; break; } }
      // um pouco acima dos selvagens da área
      const z = zoneAt(game.world, o.x, o.y);
      const [, hi] = TIER_LEVELS[(z && z.tier) || o.tier || 2];
      const lv = Math.min(60, hi + Math.floor(Math.random() * 3));
      await game.startWild(sp, lv, 'grass', z);
      return;
    }
    if (st === 'wait') return ui.dialog('O mel ainda está fresquinho na árvore. Volte daqui a pouco para ver se algo apareceu!');
    if (st === 'dry') { delete s.honey[o.id]; markDirty(); await ui.dialog('O mel secou e nenhum Pokémon apareceu...'); }
    if (!(await ui.ask('Uma árvore dourada com cheiro doce. Passar Mel nela?'))) return;
    if (!useItem('mel')) return ui.dialog('Você não tem Mel. Compre no Mart de Floaroma, Eterna ou Pastoria!');
    s.honey[o.id] = now();
    markDirty();
    audio.sfx('confirm');
    await ui.dialog('Você passou Mel na árvore! Volte em uns 10 minutos para ver se algum Pokémon apareceu.');
    jobEvent('mel', 1, {}, game);
  }

  async function digSpot(o) {
    const s = S();
    if (!digReady(s, o, now())) return ui.dialog('Você já escavou esta parede há pouco. As rachaduras brilham de novo em algumas horas.');
    if (!(await ui.ask('A parede tem rachaduras brilhantes. Escavar?'))) return;
    const slot = Math.floor(now() / DIG_SLOT_MS);
    s.dig[o.id] = slot;
    markDirty();
    game.locked = true;
    const items = await openMining({ seed: hashStr(`${o.id}:${slot}:${state.accountKey}`), tier: o.tier || 3 });
    game.locked = false;
    for (const id of items) addItem(id, 1);
    if (items.length) {
      await ui.dialog(`Você levou para casa: ${items.map((id) => ITEMS[id].name).join(', ')}!`);
      jobEvent('mineracao', items.length, {}, game);
    }
    saveNow();
  }

  async function special(o, n) {
    const s = S();
    switch (o.role) {
      case 'barry': {
        const w = 'Barry';
        if (!ready(o.id)) return ui.dialog('Ufa! Vou treinar mais e volto! Se você se atrasar, vou te multar!', { who: w });
        await ui.dialog(['Ei! Sou o Barry, seu rival! Bora batalhar AGORA!', 'Se eu perder... você vai levar uma multa de 10 milhões!'], { who: w });
        if (!(await ui.ask('Batalhar com Barry?'))) return ui.dialog('Que demora! Vou te multar, hein!', { who: w });
        const starter = [252, 155, 7].find((id) => s.dex.caught.includes(id)) || 252;
        const team = rivalTeam(starter, badges());
        const r = await trainerBattle({ name: 'Barry', cls: 'Rival', look: SPECIAL_LOOKS.barry, team, reward: team[team.length - 1].level * 70, defeat: 'O quê?! Perdi?! ...Tá, a multa fica pra próxima!' });
        if (r && r.result === 'win') beaten(o.id);
        return;
      }
      case 'truck': {
        if (s.flags.npc.truck) return ui.dialog('Um caminhão velho parado no cais. Dizem que tem um Pokémon raro escondido embaixo dele... Será?');
        await ui.dialog(['Um caminhão velho e enferrujado no cais de Canalave.', 'Você olhou embaixo dele...']);
        s.flags.npc.truck = true;
        addItem('docerarro', 1);
        audio.sfx('item');
        await ui.dialog(['Você encontrou um Doce Raro!', 'Também tinha uma pena rosa brilhante... Será que um Pokémon pequeno e rosado anda pelas flores de Floaroma?']);
        markDirty();
        return;
      }
      case 'snorlax': {
        if (!s.keyItems.includes('flauta')) return ui.dialog(['Um Snorlax enorme está dormindo no meio do caminho!', 'Ele não acorda de jeito nenhum... Dizem que a Anciã de Celestic tem uma flauta especial.']);
        if (!(await ui.ask('Um Snorlax está dormindo aqui. Tocar a Flauta Pokémon?'))) return;
        audio.sfx('evolve');
        await ui.dialog(['♪ ♫ ♪ ... ♫', 'Snorlax acordou! Ele parece mal-humorado!']);
        const r = await game.startWild(143, Math.min(55, 30 + badges() * 3), 'grass', zoneAt(game.world, o.x, o.y));
        if (r && (r.result === 'win' || r.result === 'caught')) { s.flags.npc.snorlax = true; game.hidden.add(o.id); game.buildWorldNpcs(true); markDirty(); }
        else await ui.dialog('Snorlax bocejou e voltou a dormir...');
        return;
      }
      case 'sudowoodo': {
        if (!s.keyItems.includes('regador')) return ui.dialog(['Uma árvore estranha bloqueia o caminho...', 'Ela tremeu?! A floricultura de Floaroma deve ter algo para regar plantas.']);
        if (!(await ui.ask('Uma árvore estranha... Usar o Regador nela?'))) return;
        await ui.dialog(['Você regou a árvore...', 'A árvore não gostou nada disso! É um Sudowoodo!']);
        const r = await game.startWild(185, Math.min(50, 22 + badges() * 3), 'grass', zoneAt(game.world, o.x, o.y));
        if (r && (r.result === 'win' || r.result === 'caught')) { s.flags.npc.sudowoodo = true; game.hidden.add(o.id); game.buildWorldNpcs(true); markDirty(); }
        else await ui.dialog('Sudowoodo fingiu de novo que é uma árvore...');
        return;
      }
      case 'grunt': case 'mars': case 'saturn': case 'cyrus':
        return galacticBattle(o.role, o.id, n.name, n.look);
      default: return null;
    }
  }

  // ------------------------------------------------------------ ovos e creche
  f.addEgg = async (species, from) => {
    const s = S();
    if (s.eggs.length >= 6) { await ui.dialog('Sua incubadora está cheia (6 ovos)! Choque alguns antes.'); return false; }
    const total = hatchSteps(species);
    s.eggs.push({ species, steps: total, total, from, at: Date.now(), shiny: Math.random() < 1 / 400 });
    markDirty();
    audio.sfx('item');
    await ui.dialog(['Você recebeu um Ovo Pokémon!', 'Ele fica na sua incubadora (veja no Pokétch). Ande bastante para ele chocar!']);
    return true;
  };

  let hatching = false;
  f.onStep = () => {
    const s = S();
    const run = game.player.runMode === 'run' || game.player.mode === 'bike';
    for (const e of s.eggs) e.steps = Math.max(0, e.steps - (run ? 1.25 : 1));
    if (!hatching && s.eggs.some((e) => e.steps <= 0)) hatch();
    const d = s.daycare;
    if (d && d.mons && d.mons.length === 2 && !d.egg && d.steps > 0 && d.steps % 150 === 0) {
      const sp = breedResult(d.mons[0].mon, d.mons[1].mon);
      if (sp && Math.random() < 0.55) { d.egg = sp; markDirty(); ui.toast('🥚 A Dona da Creche encontrou algo! Passe na Creche.', 'good'); }
    }
    if (game.follower && game.map === 'world') jobEvent('passeio', 1, {}, game);
  };

  async function hatch() {
    const s = S();
    const i = s.eggs.findIndex((e) => e.steps <= 0);
    if (i < 0) return;
    hatching = true;
    while (game.locked || ui.busy || game.transitioning || game.player.moving) await ui.wait(300);
    game.locked = true;
    try {
      const e = s.eggs.splice(i, 1)[0];
      await ui.dialog(['Oh?', 'O ovo está se mexendo...']);
      audio.sfx('evolve');
      await fade(true, true);
      const mon = createPokemon(e.species, 1, { shiny: e.shiny, met: 'Ovo chocado' });
      mon.friendship = 120;
      await ui.wait(500);
      await fade(false, true);
      const where = addPokemon(mon);
      audio.sfx('caught');
      await ui.dialog(`O ovo chocou! Nasceu um ${POKEDEX[e.species].name}!${mon.shiny ? ' Ele brilha!' : ''}`);
      if (await ui.ask(`Dar um apelido ao ${POKEDEX[e.species].name}?`)) {
        const nick = await ui.prompt('Apelido', POKEDEX[e.species].name, 12);
        if (nick && nick !== POKEDEX[e.species].name) mon.nick = nick;
      }
      if (where === 'pc') await ui.dialog(`${monName(mon)} foi enviado para o PC.`);
      saveNow();
      game.refreshFollower();
    } finally {
      game.locked = false;
      hatching = false;
    }
  }

  async function daycare(n) {
    const s = S();
    const w = who(n);
    const d = s.daycare || (s.daycare = { mons: [], steps: 0, at: Date.now() });
    if (d.egg) {
      const sp = d.egg;
      await ui.dialog('Ah, que bom que você veio! Encontramos um Ovo com os seus Pokémon. Não sabemos de onde veio...', { who: w });
      if (await ui.ask('Quer ficar com o Ovo?', { who: w })) {
        if (await f.addEgg(sp, 'Creche')) d.egg = null;
      } else { d.egg = null; await ui.dialog('Tudo bem, vamos cuidar dele por aqui.', { who: w }); }
      markDirty();
      return;
    }
    const names = d.mons.map((x) => monName(x.mon));
    const opts = [];
    if (d.mons.length < 2) opts.push('Deixar um Pokémon');
    d.mons.forEach((x) => opts.push(`Buscar ${monName(x.mon)}`));
    opts.push('Sair');
    let intro = 'Olá! Esta é a Creche Pokémon. Seus Pokémon ganham experiência enquanto você anda.';
    if (d.mons.length === 2) {
      const sp = breedResult(d.mons[0].mon, d.mons[1].mon);
      intro = `${names[0]} e ${names[1]} ${sp ? 'parecem se dar muito bem! Talvez apareça um Ovo...' : 'não parecem muito interessados um no outro.'}`;
    } else if (d.mons.length === 1) intro = `Seu ${names[0]} está ótimo! Deixe dois Pokémon compatíveis e talvez apareça um Ovo.`;
    const c = await ui.choice(intro, opts, { who: w });
    const o = opts[c];
    if (!o || o === 'Sair') return;
    if (o === 'Deixar um Pokémon') {
      if (s.party.length <= 1) return ui.dialog('Você precisa ficar com pelo menos um Pokémon!', { who: w });
      const i = await pickPartyMon('Deixar qual Pokémon na creche?', {
        filter: (m) => (s.party.filter(isUsable).length <= 1 && isUsable(m) ? 'Você precisa de um Pokémon para lutar!' : null),
      });
      if (i < 0) return;
      const mon = s.party.splice(i, 1)[0];
      d.mons.push({ mon, steps0: d.steps });
      markDirty();
      game.refreshFollower();
      return ui.dialog(`Pode deixar! Vamos cuidar muito bem do seu ${monName(mon)}.`, { who: w });
    }
    const idx = opts.indexOf(o) - (d.mons.length < 2 ? 1 : 0);
    const slot = d.mons[idx];
    const mon = slot.mon;
    const gained = Math.max(0, (d.steps - slot.steps0) * 3);
    const preview = JSON.parse(JSON.stringify(mon));
    gainExp(preview, gained);
    const lv = preview.level - mon.level;
    const price = 100 + lv * 100;
    await ui.dialog(lv > 0 ? `Seu ${monName(mon)} subiu ${lv} nível(is) aqui com a gente!` : `Seu ${monName(mon)} ainda não subiu de nível.`, { who: w });
    if (!(await ui.ask(`Buscar ${monName(mon)} por ${money(price)}?`, { who: w }))) return;
    if (s.party.length >= 6) return ui.dialog('Sua equipe está cheia!', { who: w });
    if (s.money < price) return ui.dialog('Você não tem dinheiro suficiente...', { who: w });
    addMoney(-price);
    const levels = gainExp(mon, gained);
    for (const L of levels) for (const mv of L.moves) {
      if (mon.moves.some((m) => m.id === mv)) continue;
      if (mon.moves.length >= 4) mon.moves.shift();
      mon.moves.push(makeMove(mv));
    }
    mon.hp = maxHp(mon);
    s.party.push(mon);
    d.mons.splice(idx, 1);
    markDirty();
    game.refreshFollower();
    await ui.dialog(`Aqui está seu ${monName(mon)}. Volte sempre!`, { who: w });
  }

  // ------------------------------------------------------------ lista de escolha (painel)
  function pickFromList(title, rows) {
    return new Promise((resolve) => {
      let done = false;
      const layer = ui.panel({
        title, width: 'min(560px,96vw)',
        onClose: () => { if (!done) { done = true; resolve(null); } },
        build: (body) => {
          body.innerHTML = `<div class="col scroll" style="max-height:60vh;gap:6px">${rows.map((r, i) => `<div class="move-row" data-i="${i}" style="cursor:pointer">${r.html}</div>`).join('')}</div>`;
          body.querySelectorAll('[data-i]').forEach((el) => el.onclick = () => { done = true; audio.sfx('confirm'); layer.close(); resolve(rows[+el.dataset.i].value); });
        },
      });
    });
  }

  // ------------------------------------------------------------ NPCs de interiores
  f.role = async (n) => {
    const s = S();
    const d = n.data || {};
    const w = who(n);
    switch (n.role) {
      case 'daycare': await daycare(n); return true;
      case 'mom': {
        const day = Math.floor(now() / 86400000);
        if (!s.flags.npc.momShoes) {
          s.flags.npc.momShoes = true;
          if (!s.wardrobe.includes('runners_vermelho')) s.wardrobe.push('runners_vermelho');
          audio.sfx('item');
          await ui.dialog([`${state.name}! Que bom te ver, querido(a)!`, 'Tome, comprei uns Tênis de Corrida pra você! (Estão no seu guarda-roupa.)', 'Lembre: segure Shift (ou toque em 🏃) para correr!'], { who: w });
        } else await ui.dialog([`Oi, ${state.name}! Está se cuidando direitinho?`, 'Seus Pokémon parecem cansados. Deixa eu cuidar deles!'], { who: w });
        healParty();
        audio.sfx('heal');
        if (s.flags.npc.momDay !== day) {
          s.flags.npc.momDay = day;
          const gift = ['superpocao', 'biscoito', 'grandebola', 'mel', 'reviver'][day % 5];
          addItem(gift, 2);
          await ui.dialog(`Leve isto também: 2× ${ITEMS[gift].name}. Volte amanhã, viu?`, { who: w });
        }
        markDirty();
        return true;
      }
      case 'fossil': {
        const fossils = Object.keys(s.bag).filter((id) => ITEMS[id] && ITEMS[id].fossil && s.bag[id] > 0);
        await ui.dialog('Olá! Eu revivo Pokémon a partir de fósseis encontrados nas escavações.', { who: w });
        if (!fossils.length) return ui.dialog('Você não tem fósseis. Escave nas paredes brilhantes das cavernas!', { who: w }), true;
        const c = await ui.choice('Qual fóssil você quer reviver?', [...fossils.map((id) => ITEMS[id].name), 'Cancelar'], { who: w });
        if (c < 0 || c >= fossils.length) return true;
        const id = fossils[c];
        const sp = ITEMS[id].fossil;
        useItem(id);
        game.locked = true;
        await ui.dialog('Certo! Vai levar só um instante...', { who: w });
        audio.sfx('evolve');
        await fade(true, true); await ui.wait(800); await fade(false, true);
        game.locked = false;
        const mon = createPokemon(sp, 20, { met: 'Museu de Oreburgh' });
        const where = addPokemon(mon);
        audio.sfx('caught');
        await ui.dialog([`Pronto! O ${POKEDEX[sp].name} voltou à vida!`, where === 'pc' ? 'Ele foi enviado para o seu PC.' : 'Ele já está na sua equipe!'], { who: w });
        saveNow();
        return true;
      }
      case 'treasure': {
        const list = Object.keys(s.bag).filter((id) => ITEMS[id] && ITEMS[id].treasure && id !== 'escamacoracao' && s.bag[id] > 0);
        if (!list.length) return ui.dialog('Sou o Curador. Compro tesouros das escavações pelo preço cheio! Volte quando tiver algum.', { who: w }), true;
        const total = list.reduce((a, id) => a + ITEMS[id].price * s.bag[id], 0);
        await ui.dialog(`Hum... ${list.map((id) => `${s.bag[id]}× ${ITEMS[id].name}`).join(', ')}.`, { who: w });
        if (!(await ui.ask(`Vender tudo por ${money(total)}? (Escamas de Coração ficam com você.)`, { who: w }))) return true;
        for (const id of list) delete s.bag[id];
        addMoney(total);
        audio.sfx('money');
        markDirty();
        await ui.dialog('Negócio fechado! Esses itens vão para a exposição.', { who: w });
        return true;
      }
      case 'tower': await battleTower(w); return true;
      case 'bpshop': await bpShop(w); return true;
      case 'ivjudge': {
        await ui.dialog('Eu avalio o potencial escondido dos Pokémon. Qual você quer que eu veja?', { who: w });
        const i = await pickPartyMon('Avaliar qual Pokémon?');
        if (i < 0) return true;
        const m = s.party[i];
        const sum = m.ivs.reduce((a, b) => a + b, 0);
        const STATS = ['PS', 'Ataque', 'Defesa', 'Ataque Especial', 'Defesa Especial', 'Velocidade'];
        const best = m.ivs.indexOf(Math.max(...m.ivs));
        const overall = sum <= 90 ? 'tem um potencial decente' : sum <= 120 ? 'tem um potencial acima da média' : sum <= 150 ? 'tem um potencial relativamente superior' : 'tem um potencial excelente';
        const bestTxt = m.ivs[best] === 31 ? 'não poderia ser melhor' : m.ivs[best] >= 26 ? 'é fantástico' : m.ivs[best] >= 16 ? 'é muito bom' : 'é razoável';
        await ui.dialog([`Hum... ${monName(m)} ${overall}.`, `O ponto forte é ${STATS[best]}: ${bestTxt}.`], { who: w });
        return true;
      }
      case 'safari': {
        await ui.dialog(['Bem-vindo à Zona Safári do Grande Pântano!', 'Lá vivem Tauros, Kangaskhan, Chansey, Scyther, Pinsir, Dratini e outros Pokémon raros.'], { who: w });
        if (!(await ui.ask(`Comprar 30 Safari Bolas por ${money(500)}?`, { who: w }))) return true;
        if (s.money < 500) return ui.dialog('Você não tem dinheiro suficiente...', { who: w }), true;
        addMoney(-500);
        addItem('safaribola', 30);
        audio.sfx('item');
        await ui.dialog('Aqui estão! O pântano fica a oeste da cidade. Boa caçada!', { who: w });
        return true;
      }
      case 'lottery': {
        const day = Math.floor(now() / 86400000);
        await ui.dialog([`Bem-vindo à Loteria Pokémon da TV Jubilife!`, `Todo dia sorteamos um número. Se bater com o seu ID de Treinador (${s.tid}), você ganha prêmios!`], { who: w });
        if (s.flags.npc.lottery === day) return ui.dialog('Você já participou hoje. Volte amanhã para o próximo sorteio!', { who: w }), true;
        s.flags.npc.lottery = day;
        const win = String(10000 + Math.floor(mulberry32(day * 977 + 3)() * 90000));
        let match = 0;
        while (match < 5 && win[4 - match] === s.tid[4 - match]) match++;
        await ui.dialog(`O número de hoje é ${win}... Seu ID é ${s.tid}.`, { who: w });
        const PRIZE = [null, ['ultrabola', 3], ['revivermax', 2], ['docerarro', 3], ['pepitagrande', 1], ['masterbola', 1]];
        const p = PRIZE[match];
        if (!p) return ui.dialog('Que pena, nenhum dígito bateu. Tente amanhã!', { who: w }), true;
        addItem(p[0], p[1]);
        audio.sfx('caught');
        await ui.dialog([`Parabéns! ${match} dígito(s) final(is) bateram!`, `Seu prêmio: ${p[1]}× ${ITEMS[p[0]].name}!`], { who: w });
        markDirty();
        return true;
      }
      case 'tvhost': {
        const ob = outbreakOf(now());
        await ui.dialog([
          'Plantão Pokémon Notícias!',
          `Um surto de ${POKEDEX[ob.species].name} foi visto em ${ob.zoneName}! Corra antes que acabe (dura o dia todo).`,
          `No Jardim de Troféus da Mansão Pokémon, hoje está aparecendo ${POKEDEX[trophyOf(now())].name}!`,
          ['Previsão do tempo: chuva na Rota 212 e na 215, neve no norte e areia no deserto.', 'Dica do dia: árvores de mel atraem Pokémon raros. Passe Mel e volte depois!', 'Dica do dia: o quadro de trabalhos dos Centros Pokémon paga bem!'][Math.floor(Math.random() * 3)],
        ], { who: w });
        return true;
      }
      case 'galactic': await galacticBattle(d.gal, `int:${d.gid}`, n.name, n.look); return true;
      case 'backlot': {
        const sp = trophyOf(now());
        markSeen(sp);
        await ui.dialog(['Ho ho! Sou o Sr. Backlot, dono desta mansão!', `Hoje vi um ${POKEDEX[sp].name} no meu Jardim de Troféus! Que maravilha!`, 'Pode procurar à vontade na grama do jardim, aqui fora.'], { who: w });
        return true;
      }
      case 'relearner': await relearner(w); return true;
      case 'deleter': await deleter(w); return true;
      case 'trade': await npcTrade(n, d); return true;
      case 'giftegg': {
        const flag = d.flag;
        if (s.flags.npc[flag]) return ui.dialog(d.egg ? 'Como vai o Ovo? Cuide bem dele!' : 'E aí, o ovo já chocou?', { who: w }), true;
        await ui.dialog(d.egg ? ['Olá! Sou Cynthia. Estou estudando a história de Sinnoh.', 'Este Ovo precisa de alguém que viaje bastante... Pode cuidar dele para mim?'] : ['Ei! Achei este ovo durante minhas viagens.', 'Não faço ideia do que vai nascer! Quer ficar com ele?'], { who: w });
        if (!(await ui.ask('Aceitar o Ovo?', { who: w }))) return true;
        const sp = d.egg || BABIES[hashStr(s.tid) % BABIES.length];
        if (await f.addEgg(sp, w)) { s.flags.npc[flag] = true; markDirty(); }
        return true;
      }
      case 'flute': {
        if (s.keyItems.includes('flauta')) return ui.dialog('A flauta tocada perto de um Pokémon dorminhoco faz milagres... Hohoho.', { who: w }), true;
        await ui.dialog(['Celestic guarda muitas lendas, jovem.', 'Uma delas fala de um Pokémon enorme que dorme na Rota 210, na neblina...', 'Leve esta flauta. A melodia dela acorda até o mais preguiçoso!'], { who: w });
        addItem('flauta');
        audio.sfx('item');
        await ui.dialog('Você recebeu a Flauta Pokémon!');
        return true;
      }
      case 'squirt': {
        if (s.keyItems.includes('regador')) return ui.dialog('Regue bem aquela árvore esquisita da Rota 214!', { who: w }), true;
        await ui.dialog(['Uma árvore que se mexe sozinha na Rota 214? Que estranho!', 'Tome este Regador. Uma boa molhada resolve tudo!'], { who: w });
        addItem('regador');
        audio.sfx('item');
        await ui.dialog('Você recebeu o Regador!');
        return true;
      }
      case 'friendship': {
        const m = s.party.find(isUsable) || s.party[0];
        if (!m) return ui.dialog('Você não tem Pokémon com você...', { who: w }), true;
        const fr = m.friendship || 70;
        const txt = fr >= 255 ? 'é completamente apaixonado por você! Não dá pra ser mais próximo!' : fr >= 200 ? 'te adora! Vocês são inseparáveis.' : fr >= 150 ? 'gosta muito de você.' : fr >= 100 ? 'está ficando próximo de você.' : fr >= 50 ? 'ainda está se acostumando com você.' : 'parece não gostar muito de você...';
        await ui.dialog([`Deixa eu ver seu ${monName(m)}...`, `Hum! Ele ${txt}`, 'Andar junto, batalhar e não deixar desmaiar aumentam a amizade.'], { who: w });
        return true;
      }
      default: return false;
    }
  };

  // ------------------------------------------------------------ Torre de Batalha
  async function battleTower(w) {
    const s = S();
    await ui.dialog(['Bem-vindo à Torre de Batalha!', `Sua melhor sequência: ${s.tower.best} vitória(s). Você tem ${s.bp} BP.`, 'São 7 batalhas seguidas. Os rivais acompanham o nível do seu Pokémon mais forte.'], { who: w });
    if (!s.party.some(isUsable)) return ui.dialog('Seus Pokémon precisam estar em condições de lutar!', { who: w });
    if (!(await ui.ask('Começar um desafio?', { who: w }))) return;
    const top = Math.max(...s.party.map((m) => m.level));
    const lv = Math.max(25, Math.min(100, top));
    const pool = Object.values(POKEDEX).filter((sp) => !sp.legendary && !sp.evos.length && bst(sp.id) >= 420 && bst(sp.id) <= 600).map((sp) => sp.id);
    for (let i = 0; i < 7; i++) {
      healParty();
      const rng = mulberry32(Date.now() + i * 101);
      const n = i < 2 ? 2 : 3;
      const team = [];
      while (team.length < n) { const sp = pool[Math.floor(rng() * pool.length)]; if (!team.some((t) => t.species === sp)) team.push({ species: sp, level: Math.min(100, lv + Math.floor(i / 3)) }); }
      const female = rng() < 0.5;
      await ui.dialog(`Batalha ${i + 1} de 7!`, { who: w });
      const r = await trainerBattle({ name: NAMES[Math.floor(rng() * NAMES.length)], cls: 'Ás da Torre', look: randomLook(rng, female), team, reward: lv * 20, defeat: ['Você é bom mesmo!', 'Impressionante...', 'Que estratégia!'][i % 3], boss: i === 6 }, { noLoss: true, music: 'gym', terrain: 'gym' });
      if (!r || r.result !== 'win') {
        healParty();
        s.tower.streak = 0;
        markDirty();
        await ui.dialog([`Fim do desafio! Você venceu ${i} batalha(s).`, 'Seus Pokémon foram curados. Tente de novo quando quiser!'], { who: w });
        return;
      }
      s.tower.streak++;
      s.tower.best = Math.max(s.tower.best, s.tower.streak);
      const gain = i === 6 ? 7 : 1 + Math.floor(i / 3);
      s.bp += gain;
      markDirty();
      if (i < 6 && !(await ui.ask(`Vitória! (+${gain} BP, total ${s.bp}) Continuar para a batalha ${i + 2}?`, { who: w }))) {
        healParty();
        s.tower.streak = 0;
        await ui.dialog('Você pode voltar quando quiser. Seus BP ficam guardados!', { who: w });
        return;
      }
    }
    healParty();
    s.tower.streak = 0;
    audio.sfx('caught');
    await ui.dialog(['Incrível! Você venceu as 7 batalhas!', `Você tem ${s.bp} BP. Troque no balcão ao lado!`], { who: w });
    saveNow();
  }

  async function bpShop(w) {
    const s = S();
    const STOCK = [['docerarro', 8], ['proteina', 4], ['ferro', 4], ['calcio', 4], ['zinco', 4], ['carbos', 4], ['hpup', 4], ['escamacoracao', 1], ['pepita', 6], ['masterbola', 60]];
    while (true) {
      const c = await ui.choice(`Você tem ${s.bp} BP. O que vai querer?`, [...STOCK.map(([id, p]) => `${ITEMS[id].name} — ${p} BP`), 'Sair'], { who: w });
      if (c < 0 || c >= STOCK.length) return;
      const [id, p] = STOCK[c];
      if (s.bp < p) { await ui.dialog('Você não tem BP suficiente. Vença na Torre de Batalha!', { who: w }); continue; }
      s.bp -= p;
      addItem(id, 1);
      audio.sfx('money');
      markDirty();
      await ui.dialog(`Você recebeu ${ITEMS[id].name}!`, { who: w });
    }
  }

  // ------------------------------------------------------------ tutores de golpes
  async function relearner(w) {
    const s = S();
    await ui.dialog(['Sou o Tutor de Golpes! Posso fazer um Pokémon lembrar golpes que ele esqueceu.', 'Meu preço: uma Escama de Coração (acha nas escavações).'], { who: w });
    if (!(s.bag.escamacoracao > 0)) return ui.dialog('Você não tem Escama de Coração. Escave nas cavernas ou ganhe na Torre de Batalha!', { who: w });
    const i = await pickPartyMon('Qual Pokémon vai relembrar?');
    if (i < 0) return;
    const m = s.party[i];
    const known = new Set(m.moves.map((x) => x.id));
    const opts = [];
    for (const [lvl, id] of POKEDEX[m.species].moves) if (lvl <= m.level && MOVES[id] && !known.has(id) && !opts.includes(id)) opts.push(id);
    if (!opts.length) return ui.dialog(`${monName(m)} não tem golpes para relembrar.`, { who: w });
    const id = await pickFromList(`Relembrar qual golpe? (${monName(m)})`, opts.map((mv) => ({ value: mv, html: `<span>${typeChip(MOVES[mv].type)} ${esc(MOVES[mv].name)}</span><span class="pp">Poder ${MOVES[mv].basePower || '—'} • PP ${MOVES[mv].pp}</span>` })));
    if (!id) return;
    if (m.moves.length < 4) m.moves.push(makeMove(id));
    else {
      const k = await pickMove(m, `Esquecer qual golpe para aprender ${MOVES[id].name}?`);
      if (k < 0 || k > 3) return;
      m.moves[k] = makeMove(id);
    }
    useItem('escamacoracao');
    audio.sfx('levelup');
    markDirty();
    await ui.dialog(`${monName(m)} relembrou ${MOVES[id].name}! Obrigado pela escama!`, { who: w });
  }

  async function deleter(w) {
    const s = S();
    await ui.dialog('Sou o Esquecedor de Golpes. Faço qualquer Pokémon esquecer um golpe, de graça!', { who: w });
    const i = await pickPartyMon('Qual Pokémon vai esquecer um golpe?', { filter: (m) => (m.moves.length <= 1 ? 'Só conhece um golpe.' : null) });
    if (i < 0) return;
    const m = s.party[i];
    const k = await pickMove(m, `Qual golpe ${monName(m)} deve esquecer?`);
    if (k < 0 || k >= m.moves.length) return;
    const old = MOVES[m.moves[k].id].name;
    if (!(await ui.ask(`Esquecer ${old}?`, { who: w }))) return;
    m.moves.splice(k, 1);
    markDirty();
    await ui.dialog(`Pronto! ${monName(m)} esqueceu ${old}.`, { who: w });
  }

  // ------------------------------------------------------------ trocas com NPCs
  async function npcTrade(n, d) {
    const s = S();
    const w = who(n);
    const flag = `trade_${d.give}`;
    const want = POKEDEX[d.want].name, give = POKEDEX[d.give].name;
    if (s.flags.npc[flag]) return ui.dialog(`Obrigado pela troca! Como vai o ${d.nick}?`, { who: w });
    await ui.dialog([`Ei, você tem um ${want}?`, `Eu troco pelo meu ${give}, o ${d.nick}! O que acha?`], { who: w });
    const i = s.party.findIndex((m) => m.species === d.want);
    if (i < 0) return ui.dialog(`Volte quando tiver um ${want} na equipe!`, { who: w });
    if (!(await ui.ask(`Trocar seu ${monName(s.party[i])} pelo ${d.nick}?`, { who: w }))) return;
    const old = s.party[i];
    const mon = createPokemon(d.give, old.level, { ot: w, otId: 'NPC', met: 'Troca' });
    mon.nick = d.nick;
    s.party[i] = mon;
    s.flags.npc[flag] = true;
    s.stats.trades = (s.stats.trades || 0) + 1;
    markSeen(d.give);
    if (!s.dex.caught.includes(d.give)) s.dex.caught.push(d.give);
    markDirty();
    audio.sfx('caught');
    await ui.dialog([`${monName(old)} foi trocado por ${d.nick}!`, d.give === 93 ? 'Dizem que Haunter evolui quando é trocado com outro treinador...' : `Cuide bem do ${d.nick}!`], { who: w });
    game.refreshFollower();
    saveNow();
  }

  // ------------------------------------------------------------ easter egg do Château
  f.chateauTv = async () => {
    if (timeOfDay(now()) !== 'night') return ui.dialog('Uma TV antiga e empoeirada. Está desligada... Dizem que ela liga sozinha à noite.');
    await ui.dialog(['A TV ligou sozinha!', 'Uma sombra sai da tela!']);
    const sp = [92, 93, 94][Math.floor(Math.random() * 3)];
    await game.startWild(sp, sp === 94 ? 34 : 24, 'cave', ZONES.find((z) => z && z.id === 'chateau'));
  };

  return f;
}

void W; void iconImg;
