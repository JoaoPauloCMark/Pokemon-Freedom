// Interações: NPCs, objetos, portas, ginásios, Liga, pesca etc.
import { T, isWater, ZONES } from '../../shared/world/defs.js';
import { zoneAt } from '../../shared/world/world.js';
import { IT } from '../../shared/world/interiors.js';
import { GYMS, ELITE, NPC_LINES, gymTeam, eliteTeam, TRAINER_COOLDOWN_MS } from '../../shared/world/npcs.js';
import { rollEncounter } from '../../shared/world/encounters.js';
import { createPokemon, monName, isUsable } from '../../shared/pokemon.js';
import { POKEDEX } from '../../shared/data/pokedex.js';
import { ITEMS } from '../../shared/data/items.js';
import { FURNITURE } from '../../shared/data/furniture.js';
import { TYPE_PT, typeEffect, TYPES } from '../../shared/data/types.js';
import { mulberry32 } from '../../shared/rng.js';
import { timeOfDay } from '../../shared/time.js';
import { ui, fade, money } from '../ui/ui.js';
import { audio } from '../audio.js';
import { net } from '../net.js';
import { S, state, addItem, addMoney, healParty, markDirty, saveNow, markSeen } from '../state.js';
import { runBattle } from '../ui/battle.js';
import { openMainMenu, openParty, openBag, openWardrobe } from '../ui/menus.js';
import { openMart, openBoutique, openSalon, openFurnitureShop } from '../ui/shops.js';
import { plotDoor, openRealty, openHouseEditor, openHome } from '../ui/houses.js';
import { openPC } from '../ui/pc.js';
import { starterFlow } from '../ui/starter.js';
import { checkLevelEvolutions } from '../ui/evolution.js';
import { openChat, emote, playerMenu, openPlayers } from '../ui/social.js';
import { openMap } from '../ui/map.js';
import { DXY } from '../input.js';
import { openControls } from '../ui/controls.js';
import { openCheats } from '../ui/cheats.js';
import { openPoketch } from '../ui/poketch.js';
import { createFeatures } from './features.js';
import { openJobs, jobEvent } from './jobs.js';
import { identity, openSocial, whoFromRel } from './relations.js';

const GYM_TM = { roark: 'mt_rocktomb', gardenia: 'mt_gigadrain', maylene: 'mt_drainpunch', wake: 'mt_waterpulse', fantina: 'mt_shadowball', byron: 'mt_flashcannon', candice: 'mt_icebeam', volkner: 'mt_thunderbolt' };

const LORE = [
  'Dizem que um pássaro de gelo lendário descansa entre os pinheiros ao sul do Lago Acuity.',
  'Nas profundezas do Monte Coronet existe uma presença psíquica que ninguém consegue explicar...',
  'Um rugido vem do topo do Monte Coronet, onde o céu encontra a montanha.',
  'Contam que um pássaro de fogo vive no cume da Montanha Stark, na ilha vulcânica.',
  'Nos moinhos do Vale, os raios caem com frequência estranha. Algo elétrico vive por lá.',
  'Três golems antigos dormem: um no gelo do norte, um nas rochas do deserto e um na Ilha de Ferro.',
  'Os mares guardam colossos: um no leste, que agita o oceano, e outro que dorme perto da Ilha de Ferro.',
  'No coração da Floresta Eterna existe um santuário que atravessa o tempo.',
  'Entre as flores de Floaroma, às vezes aparece algo pequeno e rosado que some num piscar de olhos.',
  'Um dragão vermelho voa invisível sobre o Grande Pântano; o azul prefere o Lago Verity.',
  'Três feras lendárias percorrem Sinnoh: perto do Lago Valor, da Rota 222 e do deserto ao norte.',
  'Uma estrela que realiza desejos dorme perto das Ruínas Celestic.',
];

export function createHandlers(game) {
  const h = {};
  const cityId = () => (game.building ? game.building.city : null);
  game.league = { progress: 0 };
  const feat = createFeatures(game);
  h.features = feat;
  h.onStep = () => feat.onStep();
  h.openControls = () => openControls();
  h.openCheats = () => openCheats(game);
  h.openHome = () => openHome(game);
  h.openDecor = () => openHouseEditor(game);
  h.openPoketch = () => openPoketch(game);
  h.openJobs = () => openJobs(game, null);
  // trabalhos que avançam com batalhas (vencer selvagens de um tipo, capturar uma espécie)
  h.battleJobs = (r) => {
    if (!r || !r.foe || r.kind !== 'wild') return;
    const mon = r.foe[0];
    if (r.result === 'win') jobEvent('cacada', 1, { types: POKEDEX[mon.species].types }, game);
    if (r.result === 'caught') jobEvent('captura', 1, { species: mon.species }, game);
  };

  h.openMenu = () => openMainMenu();
  h.openChat = () => openChat();
  h.openMap = () => openMap(game);
  h.openParty = () => openParty();
  h.openBag = () => openBag();
  h.openPlayers = () => openPlayers();
  h.emote = () => {
    const b = game.building;
    const hs = b && b.plotId ? state.houses[b.plotId] : null;
    if (hs && hs.owner === state.accountKey) return openHouseEditor(game);
    return emote();
  };
  h.postBattleEvolutions = () => checkLevelEvolutions();

  h.door = async (b) => {
    if (b.plotId) return plotDoor(b, game);
    await game.enterBuilding(b);
    if (b.type === 'gym') {
      const g = Object.values(GYMS).find((x) => x.city === b.city);
      if (g) ui.toast(`Ginásio de ${g.name} — tipo ${TYPE_PT[g.type]}`);
    }
  };

  // ------------------------------------------------------------ interação geral
  h.interact = async (fx, fy) => {
    const r = game.remoteAt(fx, fy);
    if (r) return playerMenu(r);
    if (game.map === 'world') {
      const wild = game.wilds.at(fx, fy);
      if (wild) return game.wilds.engage(wild);
      const n = game.npcs.find((e) => e.x === fx && e.y === fy);
      if (n) {
        if (n.kind === 'static') return staticObj(n);
        if (n.kind === 'pkmn' || n.role === 'special') { if (n.kind === 'npc') face(n); return feat.worldObject(n); }
        face(n);
        if (n.role === 'trainer') return talkTrainer(n);
        return talkCitizen(n);
      }
      const hid = feat.hiddenAt(fx, fy) || feat.hiddenAt(game.player.x, game.player.y);
      if (hid) return feat.takeHidden(hid);
      const t = game.tileAt(fx, fy);
      if (t === T.DOOR) return game.useDoor(fx, fy);
      if (isWater(t) && game.player.mode !== 'surf') return ui.toast('Ande na água para surfar! Pressione F para pescar.');
      return;
    }
    // interior
    let n = game.npcs.find((e) => e.x === fx && e.y === fy);
    const m = game.interior;
    if (!n && m.tiles[fy * m.w + fx] === IT.COUNTER) {
      // fala por cima do balcão (atravessa balcões com mais de um tile de profundidade)
      const [dx, dy] = DXY[game.player.dir];
      let cx = fx, cy = fy;
      while (m.tiles[cy * m.w + cx] === IT.COUNTER) { cx += dx; cy += dy; }
      n = game.npcs.find((e) => e.x === cx && e.y === cy);
    }
    if (n) { face(n); return talkRole(n); }
    const o = m.objects.find((ob) => fx >= ob.x && fx < ob.x + (ob.w || 1) && fy >= ob.y && fy < ob.y + (ob.h || 1) && ob.kind !== 'gymPlatform');
    if (o) return objAction(o);
  };

  function face(n) {
    const p = game.player;
    n.dir = p.dir === 0 ? 2 : p.dir === 2 ? 0 : p.dir === 1 ? 3 : 1;
  }

  async function staticObj(n) {
    const o = n.obj;
    if (o.kind === 'sign') return ui.dialog(o.text.split('\n'));
    if (o.kind === 'lamp') return;
    if (['berry', 'honey', 'dig', 'trash', 'special'].includes(o.kind)) return feat.worldObject(n);
    if (o.kind === 'item') {
      const it = ITEMS[o.item];
      addItem(o.item, 1);
      S().flags.items[o.id] = true;
      game.hidden.add(o.id);
      game.npcs = game.npcs.filter((x) => x !== n);
      markDirty();
      audio.sfx('item');
      return ui.dialog(`Você encontrou ${it.pocket === 'tms' ? 'a' : 'um(a)'} ${it.name}!`);
    }
    if (o.kind === 'legend') {
      await ui.dialog(o.text);
      const sp = POKEDEX[o.species];
      markSeen(o.species);
      if (!(await ui.ask(`${sp.name} está aqui! Batalhar?`))) return;
      if (!S().party.some(isUsable)) return ui.dialog('Seus Pokémon não estão em condições de lutar!');
      game.locked = true;
      const mon = createPokemon(o.species, o.level, { shiny: o.shiny || Math.random() < 1 / 256 });
      audio.sfx('encounter');
      await game.battleTransition();
      const terrain = game.tileAt(o.x, o.y) === T.CAVE ? 'cave' : isWater(game.tileAt(o.x, o.y)) ? 'water' : game.world.ground[o.y * game.world.W + o.x] === T.SNOW ? 'snow' : 'grass';
      const r = await runBattle({ kind: 'wild', foe: [mon], terrain, music: 'gym', zoneName: zoneAt(game.world, o.x, o.y)?.name || '' });
      if (r.result === 'caught') {
        S().flags.legends[o.species] = 'caught';
        game.hidden.add(o.id);
        game.npcs = game.npcs.filter((x) => x !== n);
      }
      await game.afterBattle(r);
      if (r.result === 'win') await ui.dialog(`${sp.name} desapareceu... mas talvez volte a aparecer.`);
    }
  }

  // ------------------------------------------------------------ NPCs da cidade
  // moradores: painel de relacionamento estilo The Sims
  async function talkCitizen(n) {
    if (!n.obj) return ui.dialog(NPC_LINES[0]);
    game.talkingTo = n;
    const layer = openSocial(game, identity('npc:' + n.obj.id, n.obj.seed, n.look, n.obj.city), n);
    const old = layer.close;
    layer.close = () => { old(); game.talkingTo = null; };
  }

  async function talkTrainer(n) {
    const info = n.info;
    const who = `${info.cls} ${info.name}`;
    if (!game.trainerReady(n.obj)) return ui.dialog(info.after, { who });
    if (!S().party.some(isUsable)) return ui.dialog('Seus Pokémon precisam descansar antes de batalhar!', { who });
    await ui.dialog(info.intro, { who });
    if (!(await ui.ask('Aceitar a batalha?'))) return ui.dialog('Ah, que pena. Volte quando quiser!', { who });
    game.locked = true;
    const rng = mulberry32(n.obj.seed);
    const team = info.team.map((t) => createPokemon(t.species, t.level, { rng, shiny: false }));
    audio.sfx('encounter');
    await game.battleTransition();
    const z = zoneAt(game.world, n.x, n.y);
    const tile = game.tileAt(game.player.x, game.player.y);
    const terrain = tile === T.CAVE ? 'cave' : tile === T.SNOW || tile === T.SNOWTALL ? 'snow' : tile === T.DESERT ? 'desert' : tile === T.SAND ? 'desert' : 'grass';
    const r = await runBattle({ kind: 'trainer', foe: team, trainer: { name: info.name, cls: info.cls, look: info.look, reward: Math.round(info.reward * (1 + team[team.length - 1].level / 20)), defeat: info.defeat }, terrain, zoneName: z?.name });
    if (r.result === 'win') { S().trainers[n.obj.id] = Date.now(); markDirty(); }
    await game.afterBattle(r);
  }

  // ------------------------------------------------------------ papéis dos NPCs de interiores
  async function talkRole(n) {
    const city = cityId();
    const d = n.data || {};
    const who = n.name;
    if (await feat.role(n)) return;
    switch (n.role) {
      case 'nurse': {
        const ok = await ui.ask('Bem-vindo ao Centro Pokémon! Quer que eu cure seus Pokémon?', { who });
        if (!ok) return ui.dialog('Volte sempre que precisar!', { who });
        await ui.dialog('Ok, vou cuidar deles um instante...', { who });
        game.locked = true;
        audio.sfx('heal');
        await fade(true, true);
        healParty();
        await ui.wait(700);
        await fade(false, true);
        game.locked = false;
        saveNow();
        return ui.dialog(['Prontinho! Seus Pokémon estão em plena forma!', 'Esperamos vê-lo novamente!'], { who });
      }
      case 'mart': {
        const kind = d.shop || 'mart';
        const title = kind === 'dept_tm' ? 'Loja de MTs' : kind === 'dept_evo' ? 'Itens de Evolução' : kind === 'dept_basic' ? 'Loja de Departamentos' : 'Poké Mart';
        await ui.dialog('Olá! Posso ajudar?', { who });
        return openMart(city, kind, title);
      }
      case 'boutique': await ui.dialog('Bem-vindo à Boutique! Temos as últimas tendências de Sinnoh.', { who }); return openBoutique(city);
      case 'salon': return openSalon();
      case 'furniture': await ui.dialog('Móveis para deixar sua casa a sua cara!', { who }); return openFurnitureShop(city);
      case 'realty': await ui.dialog('Bem-vindo à Imobiliária! Temos casas em várias cidades da região.', { who }); return openRealty(game);
      case 'carvalho': return talkProfessor(who);
      case 'aide': return talkAide(who);
      case 'leader': return gymLeader(n);
      case 'guide': return gymGuide(n);
      case 'lore': {
        const rng = Math.random;
        return ui.dialog(['Bem-vindo à biblioteca! Temos livros sobre as lendas de Sinnoh.', LORE[Math.floor(rng() * LORE.length)]], { who });
      }
      case 'leaguedesk': return leagueDesk(who);
      case 'elite': return eliteBattle(n);
      case 'guest': {
        const w = whoFromRel(d.relId);
        if (w) return openSocial(game, w, n);
        return ui.dialog('Que casa bonita!', { who });
      }
      case 'resident': default: {
        if (d.lines) return ui.dialog(d.lines, { who });
        if (d.seed && game.building) return openSocial(game, identity('res:' + game.building.id, d.seed, n.look, game.building.city), n);
        const rng = mulberry32(d.seed || 3);
        return ui.dialog(NPC_LINES[Math.floor(rng() * NPC_LINES.length)]);
      }
    }
  }

  async function talkProfessor(who) {
    const s = S();
    if (!s.flags.starter) return starterFlow();
    const c = s.dex.caught.length;
    const msg = c < 10 ? 'Você está apenas começando! Explore as rotas e capture muitos Pokémon.'
      : c < 50 ? 'Muito bem! Sua Pokédex está crescendo. Experimente procurar à noite, na água e nas cavernas.'
        : c < 150 ? 'Impressionante! Você já é um treinador de verdade.'
          : c < 300 ? 'Fantástico! Poucos treinadores chegaram tão longe!'
            : c < 386 ? 'Incrível! Faltam só alguns... Os lendários se escondem nos lugares mais distantes.'
              : 'Você completou a Pokédex! Você é um verdadeiro Mestre Pokémon!';
    await ui.dialog([`Vamos ver sua Pokédex... ${c} capturados de 386.`, msg], { who });
    if ((s.bag.pokebola || 0) < 5) {
      addItem('pokebola', 5);
      audio.sfx('item');
      await ui.dialog('Parece que suas Poké Bolas estão acabando. Leve estas 5!', { who });
    }
  }

  async function talkAide(who) {
    const s = S();
    const day = Math.floor(Date.now() / 86400000);
    if (s.flags.aideDay === day) return ui.dialog('O Professor Carvalho trabalha demais... alguém precisa ajudá-lo!', { who });
    s.flags.aideDay = day;
    const gifts = ['pocao', 'superpocao', 'grandebola', 'reviver', 'biscoito', 'repelente'];
    const g = gifts[day % gifts.length];
    addItem(g, 3);
    markDirty();
    audio.sfx('item');
    return ui.dialog(['Oi! Aqui vai um presentinho do laboratório:', `Você recebeu 3× ${ITEMS[g].name}! Volte amanhã para mais.`], { who });
  }

  // ------------------------------------------------------------ ginásios
  async function gymGuide(n) {
    const g = GYMS[n.data.gym];
    const weak = TYPES.filter((t) => typeEffect(t, [g.type]) > 1).map((t) => TYPE_PT[t]);
    const badges = S().badges.length;
    await ui.dialog([
      `Ei, futuro campeão! Este ginásio usa Pokémon do tipo ${TYPE_PT[g.type]}.`,
      `Golpes do tipo ${weak.join(', ')} são super efetivos!`,
      `O líder ajusta a força ao número de insígnias que você tem (você tem ${badges}). Os times têm nível ~${13 + badges * 6}.`,
    ], { who: n.name });
  }

  async function gymLeader(n) {
    const id = n.data.gym;
    const g = GYMS[id];
    const s = S();
    const who = `Líder ${g.name}`;
    const has = s.badges.includes(id);
    if (has) {
      if (!(await ui.ask('Você já tem minha insígnia! Quer uma revanche?', { who }))) return;
    } else {
      await ui.dialog(g.quote, { who });
      if (!(await ui.ask(`Desafiar ${g.name} pela ${g.badge}?`))) return;
    }
    if (!s.party.some(isUsable)) return ui.dialog('Cure seus Pokémon antes!', { who });
    const badgeCount = has ? Math.max(0, s.badges.length - 1) : s.badges.length;
    const team = gymTeam(g, badgeCount).map((t) => createPokemon(t.species, t.level, { shiny: false }));
    game.locked = true;
    await game.battleTransition();
    const lvl = team[team.length - 1].level;
    const r = await runBattle({
      kind: 'trainer', foe: team, terrain: 'gym', music: 'gym',
      trainer: { name: g.name, cls: 'Líder', look: n.look, reward: lvl * 120, defeat: has ? 'Você continua incrível!' : 'Você mereceu! Tome a insígnia!', gym: true },
    });
    if (r.result === 'win' && !has) {
      s.badges.push(id);
      markDirty();
      audio.sfx('caught');
      await ui.dialog([`Você recebeu a ${g.badge}!`, `Agora você tem ${s.badges.length} insígnia(s).`], { who });
      const tm = GYM_TM[id];
      if (tm && ITEMS[tm]) { addItem(tm, 1); audio.sfx('item'); await ui.dialog(`${g.name} também te deu ${ITEMS[tm].name}!`, { who }); }
      if (s.badges.length === 8) await ui.dialog('Com 8 insígnias você pode desafiar a Liga Pokémon, na ilha a nordeste!', { who });
    }
    await game.afterBattle(r);
  }

  // ------------------------------------------------------------ Liga
  async function leagueDesk(who) {
    const s = S();
    if (s.badges.length < 8) return ui.dialog([`Bem-vindo à Liga Pokémon!`, `Para desafiar a Elite dos Quatro você precisa das 8 insígnias de Sinnoh. Você tem ${s.badges.length}.`], { who });
    const next = ELITE[game.league.progress];
    await ui.dialog([
      'Bem-vindo à Liga Pokémon!',
      'Desafie a Elite dos Quatro na ordem: Aaron, Bertha, Flint e Lucian. Depois, a Campeã Cynthia!',
      'Se perder, o desafio recomeça do início. Boa sorte!',
      next ? `Próximo desafiante: ${next.name}.` : 'Você venceu todos! Fale com a Campeã para uma revanche quando quiser.',
    ], { who });
    if (await ui.ask('Quer que eu cure seus Pokémon?', { who })) { healParty(); audio.sfx('heal'); }
  }

  async function eliteBattle(n) {
    const s = S();
    const idx = n.data.elite;
    const e = ELITE[idx];
    const who = `${e.title} ${e.name}`;
    if (s.badges.length < 8) return ui.dialog('Volte quando tiver as 8 insígnias.', { who });
    if (game.league.progress !== idx && !(idx === 4 && s.league.champion && game.league.progress >= 4)) {
      const need = ELITE[game.league.progress] || ELITE[0];
      return ui.dialog(`Você precisa vencer ${need.name} primeiro.`, { who });
    }
    await ui.dialog(e.quote, { who });
    if (!(await ui.ask(`Batalhar contra ${e.name}?`))) return;
    const team = eliteTeam(e, idx).map((t) => createPokemon(t.species, t.level, { shiny: false }));
    game.locked = true;
    await game.battleTransition();
    const r = await runBattle({ kind: 'trainer', foe: team, terrain: 'gym', music: 'gym', trainer: { name: e.name, cls: e.title, look: n.look, reward: 8000 + idx * 2000, defeat: 'Que batalha... Você é forte de verdade.', gym: true } });
    if (r.result === 'win') {
      game.league.progress = Math.min(5, idx + 1);
      if (idx === 4) {
        const first = !s.league.champion;
        s.league.champion = true;
        s.league.beatenAt = Date.now();
        if (!s.wardrobe.includes('crown_amarelo')) s.wardrobe.push('crown_amarelo');
        markDirty();
        audio.sfx('evolve');
        await ui.dialog([
          'Parabéns! Você é o novo Campeão da Liga Pokémon de Sinnoh!',
          first ? 'Como prêmio, receba a Coroa de Campeão (veja no guarda-roupa) e o título eterno!' : 'Você defendeu seu título mais uma vez!',
        ], { who });
        net.send({ t: 'chat', text: `🏆 Acabei de me tornar Campeão da Liga Pokémon!` });
        game.league.progress = 4;
      }
    } else if (r.result === 'lose') game.league.progress = 0;
    await game.afterBattle(r);
  }

  // ------------------------------------------------------------ objetos de interiores
  async function objAction(o) {
    const s = S();
    if (o.action === 'pc' || (o.kind === 'furniture' && FURNITURE[o.item]?.art === 'pc')) return openPC(game);
    if (o.action === 'wardrobe' || (o.kind === 'furniture' && FURNITURE[o.item]?.art === 'wardrobe')) return openWardrobe();
    if (o.action === 'starter' || o.kind === 'starterTable') {
      if (!s.flags.starter) return starterFlow();
      return ui.dialog('As Poké Bolas da mesa estão vazias. O Professor já entregou todos os iniciais!');
    }
    if (o.action === 'jobs') return openJobs(game, cityId());
    if (o.action === 'chateautv') return feat.chateauTv();
    if (o.text) return ui.dialog(o.text);
    const art = o.kind === 'furniture' ? FURNITURE[o.item]?.art : o.kind;
    switch (art) {
      case 'bed': case 'bed2': case 'pokebed': {
        if (!(await ui.ask('Descansar um pouco?'))) return;
        game.locked = true;
        await fade(true);
        healParty();
        audio.sfx('heal');
        await ui.wait(900);
        await fade(false);
        game.locked = false;
        saveNow();
        return ui.dialog('Você descansou e seus Pokémon estão totalmente recuperados!');
      }
      case 'tv': return ui.dialog(['Está passando um programa sobre Pokémon...', ['"Hoje no Pokémon Notícias: um Magikarp aprendeu a voar! Brincadeira."', '"Previsão do tempo: chuva na Rota 212, neve em Snowpoint e areia no deserto."', '"Concurso de beleza Pokémon em breve em Hearthome!"'][Math.floor(Math.random() * 3)]]);
      case 'console': return ui.dialog('Você jogou videogame por um tempinho. Que divertido!');
      case 'piano': audio.sfx('evolve'); return ui.dialog('♪ Você tocou uma melodia bonita no piano! ♪');
      case 'bookshelf': return ui.dialog('Livros sobre Pokémon, culinária e viagens pela região.');
      case 'aquarium': return ui.dialog('Peixinhos coloridos nadam tranquilos.');
      case 'fireplace': return ui.dialog('A lareira está quentinha e aconchegante.');
      case 'fridge': return ui.dialog('Tem Leite Moomoo, Limonada e frutas frescas.');
      case 'doll': { const sp = POKEDEX[FURNITURE[o.item].species]; return ui.dialog(`Um boneco fofinho de ${sp.name}!`); }
      case 'shelf': return ui.dialog('As prateleiras estão cheias de produtos.');
      case 'healer': return ui.dialog('A máquina de cura do Centro Pokémon.');
      case 'mirror': return ui.dialog('Você se olhou no espelho. Está com tudo!');
      case 'machine': return ui.dialog('Uma máquina de pesquisa cheia de luzes piscando.');
      case 'gymStatue': {
        const g = game.interior.gym ? GYMS[game.interior.gym] : null;
        return ui.dialog(g ? `GINÁSIO POKÉMON — Líder: ${g.name}. Especialidade: tipo ${TYPE_PT[g.type]}.` : 'Uma estátua imponente.');
      }
      case 'grave': return ui.dialog('Um túmulo antigo... Você sente um arrepio.');
      case 'pillar': return ui.dialog('Um pilar com escritas antigas que você não consegue ler.');
      case 'generator': return ui.dialog('O gerador zumbe com eletricidade.');
      case 'crt': case 'tvwide': return ui.dialog(['Você ligou a TV...', ['"Plantão Pokémon: surtos de Pokémon raros acontecem todo dia! Veja no Pokétch."', '"Hoje no Esporte: Sinnoh FC venceu por 3 a 1!"', '"Novela das oito: será que o Magikarp vai evoluir?"'][Math.floor(Math.random() * 3)]]);
      case 'console2': case 'retroconsole': case 'pcgamer': case 'laptop': {
        const games = ['Pokémon Stadium', 'um jogo de corrida', 'um jogo de futebol', 'um RPG de aventura', 'um jogo de luta'];
        return ui.dialog([`Você jogou ${games[Math.floor(Math.random() * games.length)]}!`, Math.random() < 0.5 ? 'Vitória! Que partida incrível.' : 'Perdeu... mas foi divertido!']);
      }
      case 'speaker': case 'radio': case 'stereo': audio.sfx('evolve'); return ui.dialog('♪ Tocando aquela música animada! ♪');
      case 'microwave': return ui.dialog('Você esquentou um lanchinho. Delícia!');
      case 'coffeemaker': return ui.dialog('Você fez um cafezinho fresquinho. ☕');
      case 'dining': return ui.dialog('Uma mesa de jantar arrumada, pronta para receber os amigos.');
      case 'dishwasher': case 'washer': return ui.dialog(art === 'washer' ? 'Você colocou as roupas para lavar.' : 'Você ligou a lava-louças.');
      case 'bathtub': case 'shower': {
        if (!(await ui.ask(art === 'bathtub' ? 'Tomar um banho de banheira?' : 'Tomar um banho?'))) return;
        await fade(true); healParty(); audio.sfx('heal'); await ui.wait(700); await fade(false);
        saveNow();
        return ui.dialog('Que banho relaxante! Você e seus Pokémon estão renovados.');
      }
      case 'toilet': return ui.dialog('...Pronto! Não esqueça de lavar as mãos.');
      case 'bathsink': case 'wallmirror': case 'vanity': return ui.dialog('Você se arrumou no espelho. Lindo(a)!');
      case 'hammock': {
        if (!(await ui.ask('Deitar na rede e descansar?'))) return;
        await fade(true); healParty(); audio.sfx('heal'); await ui.wait(700); await fade(false);
        return ui.dialog('Que soneca boa! Todos descansaram.');
      }
      case 'pingpong': case 'foosball': case 'goal': case 'soccerball': {
        const me = Math.floor(Math.random() * 6), you = Math.floor(Math.random() * 6);
        return ui.dialog([art === 'goal' || art === 'soccerball' ? 'Você chutou a bola...' : 'Você jogou uma partida!', me > you ? `Venceu por ${me} a ${you}!` : me === you ? `Empate: ${me} a ${you}.` : `Perdeu por ${you} a ${me}. Revanche?`]);
      }
      case 'treadmill': case 'dumbbells': case 'punchbag': {
        const l = S().party.find((m) => m.hp > 0);
        if (l) { l.friendship = Math.min(255, (l.friendship || 70) + 2); markDirty(); }
        return ui.dialog(['Você treinou pesado! 💪', l ? 'Seu Pokémon treinou junto e ficou mais próximo de você.' : 'Ufa, cansou!']);
      }
      case 'ballpit': return ui.dialog('Você pulou na piscina de bolinhas! Que divertido!');
      case 'pokehouse': case 'petbed': case 'pokepouf': {
        const l = S().party.find((m) => m.hp > 0);
        if (l) { l.friendship = Math.min(255, (l.friendship || 70) + 1); markDirty(); }
        return ui.dialog(l ? `${POKEDEX[l.species].name} adorou se aconchegar aqui!` : 'Um cantinho perfeito para Pokémon.');
      }
      case 'globe': return ui.dialog('Você girou o globo e parou o dedo em... Sinnoh!');
      case 'fishbowl': return ui.dialog('Um peixinho dourado nada em círculos.');
      case 'fan': case 'aircon': return ui.dialog('Ahhh, que fresquinho!');
      case 'mapposter': return ui.dialog('Um mapa de Sinnoh. Quantos lugares para explorar!');
      case 'pikaframe': return ui.dialog('Um quadro de um ratinho elétrico muito fofo.');
      case 'lavalamp': case 'pokelamp': return ui.dialog('A luminária brilha com uma luz aconchegante.');
      case 'clubbed': case 'clubrug': case 'clubflag': case 'clubpouf': case 'clubcrest': {
        const f = FURNITURE[o.item];
        if (art === 'clubbed') {
          if (!(await ui.ask('Descansar um pouco?'))) return;
          await fade(true); healParty(); audio.sfx('heal'); await ui.wait(700); await fade(false);
          saveNow();
          return ui.dialog('Você dormiu sonhando com o título do seu time!');
        }
        const club = (f && f.name.replace(/^.* (do|da) /, '')) || 'time';
        return ui.dialog(`Vai, ${club}! 🎉`);
      }
      case 'bunkbed': {
        if (!(await ui.ask('Descansar um pouco?'))) return;
        await fade(true); healParty(); audio.sfx('heal'); await ui.wait(700); await fade(false);
        saveNow();
        return ui.dialog('Você descansou e seus Pokémon estão totalmente recuperados!');
      }
      case 'jacuzzi': {
        if (!(await ui.ask('Relaxar na jacuzzi?'))) return;
        await fade(true); healParty(); audio.sfx('heal'); await ui.wait(700); await fade(false);
        saveNow();
        return ui.dialog('Que delícia! Você e seus Pokémon estão renovados.');
      }
      case 'pooltable': return ui.dialog(['Você deu uma tacada...', Math.random() < 0.35 ? 'Caçapa! Que jogada!' : 'Errou feio. Ninguém viu, né?']);
      case 'fountain': return ui.dialog('A água da fonte brilha. Você jogou uma moedinha e fez um pedido!');
      case 'lounger': return ui.dialog('Você se esticou na espreguiçadeira e tomou um solzinho.');
      case 'chandelier': return ui.dialog('Um lustre de cristal brilhante. Chiquérrimo!');
      case 'icecream': return ui.dialog(['A máquina fez um sorvete de casquinha!', 'Sabor Fruta Pecha. Hmmm!']);
      case 'arcade': {
        const pts = Math.floor(Math.random() * 99) * 100;
        const best = Math.max(S().flags.npc.arcade || 0, pts);
        S().flags.npc.arcade = best; markDirty();
        return ui.dialog([`GAME OVER! Pontos: ${pts}`, `Recorde: ${best}`]);
      }
      default: return;
    }
  }

  // ------------------------------------------------------------ pesca
  h.fish = async () => {
    if (game.map !== 'world' || game.player.moving || ui.busy) return;
    if (!S().keyItems.includes('vara')) return ui.toast('Você não tem uma vara de pescar.');
    const [fx, fy] = game.facing();
    const t = game.tileAt(fx, fy);
    if (!isWater(t)) return ui.toast('Fique de frente para a água para pescar.');
    game.locked = true;
    ui.toast('Você jogou a linha...');
    await ui.wait(900 + Math.random() * 1800);
    if (Math.random() < 0.75) {
      game.player.emote = { e: '!', at: performance.now() };
      audio.sfx('encounter');
      await ui.wait(500);
      const z = zoneAt(game.world, fx, fy);
      const time = timeOfDay(net.now()) === 'night' ? 'night' : 'day';
      const enc = z ? rollEncounter(z.id, 'water', time) : null;
      if (enc && S().party.some(isUsable)) {
        await ui.dialog('Fisgou um Pokémon!');
        jobEvent('pesca', 1, {}, game);
        await game.startWild(enc.species, Math.max(2, enc.level - 2), 'water', z);
        return;
      }
    }
    game.locked = false;
    await ui.dialog('Nada mordeu a isca...');
  };

  return h;
}

void ZONES; void money; void addMoney; void TRAINER_COOLDOWN_MS; void monName; void openHouseEditor;
