// Relacionamentos com NPCs no estilo The Sims: cada morador tem nome,
// personalidade e gostos; conversar, elogiar, dar presentes, paquerar ou
// provocar muda a amizade. Amigos entram nos contatos do Pokétch e podem
// visitar a sua casa.
import { ZONES, ZONE_INDEX, TIER_LEVELS } from '../../shared/world/defs.js';
import { buildEncounterTables, evolveForLevel } from '../../shared/world/encounters.js';
import { ITEMS, itemSprite } from '../../shared/data/items.js';
import { POKEDEX } from '../../shared/data/pokedex.js';
import { TYPE_PT } from '../../shared/data/types.js';
import { mulberry32, hashStr } from '../../shared/rng.js';
import { createPokemon, isUsable } from '../../shared/pokemon.js';
import { S, state, useItem, addItem, markDirty, saveNow } from '../state.js';
import { ui, esc } from '../ui/ui.js';
import { audio } from '../audio.js';
import { net } from '../net.js';
import { drawPortrait } from '../render/character.js';
import { runBattle } from '../ui/battle.js';

const DAY = 86400000;
const today = () => Math.floor(net.now() / DAY);
const MALE = ['Lucas', 'Pedro', 'Gabriel', 'Mateus', 'Rafael', 'João', 'Thiago', 'Bruno', 'Felipe', 'Vinícius', 'Gustavo', 'Davi', 'Miguel', 'Caio', 'Diego', 'Enzo', 'Arthur', 'Heitor', 'Leonardo', 'Samuel', 'Otávio', 'Renan', 'Igor', 'Murilo', 'Bernardo', 'Henrique', 'Rodrigo', 'Marcelo'];
const FEMALE = ['Ana', 'Júlia', 'Beatriz', 'Larissa', 'Camila', 'Mariana', 'Carla', 'Letícia', 'Isabela', 'Sofia', 'Laura', 'Helena', 'Renata', 'Paula', 'Bianca', 'Lívia', 'Alice', 'Clara', 'Manuela', 'Yasmin', 'Valentina', 'Lorena', 'Giovana', 'Bruna', 'Luana', 'Rafaela', 'Vitória', 'Cecília'];
const SURNAMES = ['Silva', 'Souza', 'Costa', 'Lima', 'Rocha', 'Alves', 'Pereira', 'Ferreira', 'Gomes', 'Martins', 'Araújo', 'Barbosa', 'Ribeiro', 'Carvalho', 'Moura', 'Teixeira', 'Freitas', 'Nunes'];

export const TRAITS = {
  simpatico: { name: 'Simpático', ic: '😊', like: ['conversar', 'elogiar', 'abracar'], hate: ['provocar', 'discutir'] },
  rabugento: { name: 'Rabugento', ic: '😤', like: ['presente', 'desculpas'], hate: ['piada', 'abracar', 'fofocar'], mult: 0.65 },
  engracado: { name: 'Engraçado', ic: '😂', like: ['piada', 'fofocar', 'conversar'], hate: [] },
  timido: { name: 'Tímido', ic: '😳', like: ['elogiar', 'presente'], hate: ['piada', 'abracar', 'paquerar'] },
  competitivo: { name: 'Competitivo', ic: '🔥', like: ['batalha', 'pokemon'], hate: ['elogiar'] },
  romantico: { name: 'Romântico', ic: '💘', like: ['paquerar', 'elogiar', 'presente'], hate: ['discutir'] },
  fofoqueiro: { name: 'Fofoqueiro', ic: '🗣️', like: ['fofocar', 'conversar'], hate: [] },
  nerd: { name: 'Nerd', ic: '🤓', like: ['pokemon', 'presente'], hate: ['provocar'] },
  aventureiro: { name: 'Aventureiro', ic: '🧭', like: ['pokemon', 'batalha'], hate: [] },
  preguicoso: { name: 'Preguiçoso', ic: '😴', like: ['conversar', 'presente'], hate: ['batalha'] },
};
const TRAIT_IDS = Object.keys(TRAITS);
const GIFT_FAVS = ['mel', 'biscoito', 'pepita', 'perola', 'oran', 'sitrus', 'poestrela', 'docerarro', 'grandebola', 'superpocao', 'pecha', 'escamacoracao'];
const FAV_TYPES = ['Fire', 'Water', 'Grass', 'Electric', 'Psychic', 'Dragon', 'Ghost', 'Fighting', 'Rock', 'Ice', 'Normal', 'Fairy', 'Dark', 'Bug', 'Flying'];

// ------------------------------------------------------------ identidade
// id: 'npc:<objId>' (moradores das cidades) ou 'res:<prédio>' (moradores de casas)
export function identity(id, seed, look, city) {
  const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const female = look && look.body === 'f';
  const first = (female ? FEMALE : MALE)[Math.floor(rng() * 28)];
  const last = SURNAMES[Math.floor(rng() * SURNAMES.length)];
  return {
    id, name: `${first} ${last}`, first, female, city,
    trait: TRAIT_IDS[Math.floor(rng() * TRAIT_IDS.length)],
    fav: GIFT_FAVS[Math.floor(rng() * GIFT_FAVS.length)],
    favType: FAV_TYPES[Math.floor(rng() * FAV_TYPES.length)],
    look,
  };
}

// estado salvo (S().rel[id])
export function relOf(id) {
  const s = S();
  s.rel ||= {};
  return s.rel[id] || null;
}
function ensureRel(who) {
  const s = S();
  s.rel ||= {};
  let r = s.rel[who.id];
  if (!r) {
    r = s.rel[who.id] = { v: 0, r: 0, met: Date.now(), last: today(), name: who.name, first: who.first, city: who.city, look: who.look, trait: who.trait, fav: who.fav, favType: who.favType, female: who.female, contact: false, dating: false, day: today(), gain: 0, acts: {} };
    markDirty();
  }
  decay(r);
  return r;
}
// amizade esfria sem contato (como no The Sims)
function decay(r) {
  const d = today() - (r.last || today());
  if (d >= 4) {
    const k = Math.min(20, d - 3);
    if (r.v > 0) r.v = Math.max(0, r.v - k); else if (r.v < 0) r.v = Math.min(0, r.v + Math.ceil(k / 2));
    if (r.r > 0) r.r = Math.max(0, r.r - k);
    r.last = today();
  }
  if (r.day !== today()) { r.day = today(); r.gain = 0; r.acts = {}; }
}

export function relStatus(r) {
  if (!r) return { label: 'Desconhecido', cls: 'neutral', ic: '❔' };
  if (r.dating) return { label: 'Namorando', cls: 'love', ic: '💘' };
  if (r.v <= -60) return { label: 'Inimigo', cls: 'enemy', ic: '😡' };
  if (r.v <= -20) return { label: 'Desafeto', cls: 'bad', ic: '😒' };
  if (r.r >= 30 && r.v >= 35) return { label: 'Paquera', cls: 'love', ic: '😍' };
  if (r.v < 15) return { label: 'Conhecido', cls: 'neutral', ic: '🙂' };
  if (r.v < 40) return { label: 'Colega', cls: 'ok', ic: '😄' };
  if (r.v < 70) return { label: 'Amigo', cls: 'good', ic: '🤝' };
  return { label: 'Melhor amigo', cls: 'best', ic: '💛' };
}

// ------------------------------------------------------------ interações
const ACTS = [
  // id, nome, grupo, requisito (função -> texto do bloqueio ou null)
  ['conversar', '💬 Conversar', 'amigavel', () => null],
  ['pokemon', '🔴 Falar de Pokémon', 'amigavel', () => null],
  ['piada', '😂 Contar piada', 'amigavel', () => null],
  ['elogiar', '✨ Elogiar', 'amigavel', (r) => (r.v < -20 ? 'Precisa não ser desafeto' : null)],
  ['fofocar', '🗣️ Fofocar', 'amigavel', (r) => (r.v < 15 ? 'Amizade 15+' : null)],
  ['abracar', '🤗 Abraçar', 'amigavel', (r) => (r.v < 50 ? 'Amizade 50+' : null)],
  ['presente', '🎁 Dar presente', 'outros', () => null],
  ['batalha', '⚔️ Chamar para batalhar', 'outros', () => null],
  ['contato', '📱 Pedir o contato', 'outros', (r) => (r.contact ? 'Já está nos contatos' : r.v < 20 ? 'Amizade 20+' : null)],
  ['convidar', '🏠 Convidar para sua casa', 'outros', (r) => (!r.contact ? 'Peça o contato antes' : r.v < 30 ? 'Amizade 30+' : !(S().houses || []).length ? 'Você não tem casa' : null)],
  ['paquerar', '😘 Paquerar', 'romance', (r) => (r.v < 35 ? 'Amizade 35+' : null)],
  ['namorar', '💍 Pedir em namoro', 'romance', (r) => (r.dating ? 'Vocês já namoram' : r.v < 70 || r.r < 60 ? 'Amizade 70+ e romance 60+' : null)],
  ['terminar', '💔 Terminar namoro', 'romance', (r) => (!r.dating ? 'Vocês não namoram' : null)],
  ['provocar', '😜 Provocar', 'maldoso', () => null],
  ['discutir', '😠 Discutir', 'maldoso', () => null],
  ['desculpas', '🙏 Pedir desculpas', 'maldoso', (r) => (r.v >= 0 ? 'Não há o que desculpar' : null)],
];
const GROUPS = [['amigavel', 'Amigável'], ['romance', 'Romântico'], ['outros', 'Outros'], ['maldoso', 'Maldoso']];

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const LINES = {
  conversar: { good: ['Que bom conversar com você!', 'Haha, verdade! Sinnoh anda agitada.', 'Você sempre tem histórias boas.', 'Adorei esse papo!'], bad: ['Hum... tá bom.', 'Desculpa, estou meio ocupado agora.', 'Uhum...'] },
  pokemon: { good: ['Eu AMO Pokémon do tipo {type}!', 'Sabia que dá para chocar ovos andando muito? Incrível!', 'Seu time parece forte! Quem é seu favorito?', 'Vi um Pokémon raro perto daqui ontem!'], bad: ['Pokémon de novo? Tá bom...', 'Não entendo muito disso.'] },
  piada: { good: ['HAHAHA! Essa foi ótima!', 'Kkkk, não acredito!', 'Você é engraçado demais!'], bad: ['...Isso era uma piada?', 'Não achei graça.', 'Que piada sem graça...'] },
  elogiar: { good: ['Ah, obrigado! Você é um amor.', 'Que gentil! Fiquei sem graça.', 'Você também está ótimo hoje!'], bad: ['Hm. Você quer alguma coisa?', 'Elogio barato...'] },
  fofocar: { good: ['Não acredito! Me conta tudo!', 'Eu SABIA! Dizem que o líder de ginásio...', 'Shhh, isso fica entre nós!'], bad: ['Não gosto de falar dos outros.', 'Isso não é legal...'] },
  abracar: { good: ['Que abraço gostoso!', 'Você é um amigo de verdade!', 'Abraço apertado!'], bad: ['Opa, calma aí!', 'Ei, sem abraços, por favor.'] },
  paquerar: { good: ['Você é bem charmoso, sabia?', 'Ai... assim eu fico vermelho!', 'Hehe, gostei disso.'], bad: ['Hã? Acho que você se confundiu.', 'Melhor sermos só amigos.', 'Que vergonha... não.'] },
  provocar: { good: ['Hahaha, você é muito bobo!'], bad: ['Ei! Isso não foi legal!', 'Quem você pensa que é?', 'Grr... Vou me lembrar disso.'] },
  discutir: { good: [], bad: ['Você é insuportável!', 'Nunca mais fale comigo!', 'Que absurdo! Some daqui!'] },
  desculpas: { good: ['Tudo bem... vamos esquecer isso.', 'Desculpas aceitas.'], bad: ['Não é tão fácil assim.', 'Hmph.'] },
};

// muda amizade/romance respeitando o limite diário e a repetição
function applyDelta(r, act, dv, dr = 0) {
  const t = TRAITS[r.trait] || TRAITS.simpatico;
  const rep = r.acts[act] || 0;
  r.acts[act] = rep + 1;
  if (dv > 0) {
    dv *= (t.mult || 1) * Math.pow(0.55, rep);
    if (t.like.includes(act)) dv *= 1.6;
    if (r.gain >= 25) dv *= 0.15; // limite diário
    dv = Math.max(rep >= 3 ? 0 : 1, Math.round(dv));
    if (rep >= 3) dv = -1; // ficou chato
    r.gain += Math.max(0, dv);
  } else if (dv < 0 && t.hate.includes(act)) dv = Math.round(dv * 1.5);
  if (dr > 0) dr = Math.round(dr * Math.pow(0.6, rep) * (t.like.includes('paquerar') ? 1.5 : 1));
  r.v = Math.max(-100, Math.min(100, r.v + dv));
  r.r = Math.max(0, Math.min(100, r.r + dr));
  r.last = today();
  markDirty();
  return { dv, dr };
}

function chance(r, act) {
  const t = TRAITS[r.trait] || TRAITS.simpatico;
  let p = 0.82;
  if (t.like.includes(act)) p += 0.12;
  if (t.hate.includes(act)) p -= 0.45;
  if (r.v < -20) p -= 0.3;
  if (act === 'piada') p -= 0.15;
  if (act === 'paquerar') p = 0.35 + (r.v - 35) / 120 + r.r / 200 + (t.like.includes('paquerar') ? 0.2 : 0) - (t.hate.includes('paquerar') && r.v < 70 ? 0.3 : 0);
  return Math.max(0.05, Math.min(0.97, p));
}

// time do NPC para batalhas amistosas
function npcTeam(who) {
  const lv = Math.max(5, Math.round(S().party.reduce((a, m) => Math.max(a, m.level), 5) * 0.9));
  const z = ZONES[ZONE_INDEX[who.city]] || ZONES.find((x) => x && x.tier >= 1);
  const tables = buildEncounterTables();
  const pool = [];
  for (const zz of ZONES) if (zz && !zz.city && Math.abs(zz.tier - (z ? z.tier : 2)) <= 1) for (const c of tables[zz.id].grass) pool.push(c.id);
  const rng = mulberry32(hashStr(who.id));
  const fav = Object.values(POKEDEX).filter((sp) => sp.types.includes(who.favType) && !sp.legendary && !sp.prevo);
  const team = [];
  const n = 2 + Math.floor(rng() * 2);
  if (fav.length) team.push(fav[Math.floor(rng() * fav.length)].id);
  while (team.length < n && pool.length) team.push(pool[Math.floor(rng() * pool.length)]);
  return team.map((sp, i) => ({ species: evolveForLevel(sp, lv + i, rng), level: Math.min(100, lv + i) }));
}

async function doAct(game, who, r, act, ent) {
  const t = TRAITS[r.trait] || TRAITS.simpatico;
  const say = (txt) => txt.replace('{type}', TYPE_PT[r.favType] || r.favType);
  const emote = (e) => { if (ent) ent.emote = { e, at: performance.now() }; };
  switch (act) {
    case 'presente': {
      const ids = Object.keys(S().bag).filter((id) => ITEMS[id] && ITEMS[id].pocket !== 'key' && S().bag[id] > 0);
      if (!ids.length) return { text: 'Você não tem nada para dar.', mood: 'neutral' };
      const id = await pickGift(ids, r);
      if (!id) return null;
      useItem(id);
      const it = ITEMS[id];
      const fav = id === r.fav;
      const base = 3 + Math.min(12, Math.round((it.price || 300) / 800));
      const { dv } = applyDelta(r, 'presente', fav ? base * 2 + 6 : base);
      emote(fav ? '😍' : '🎁');
      audio.sfx('item');
      return { text: fav ? `${it.name}? É o meu favorito! Muito obrigado!!` : `Um(a) ${it.name}! Que gentil, obrigado!`, dv, mood: 'good' };
    }
    case 'batalha': {
      if (r.acts.batalha) return { text: 'Já batalhamos hoje! Amanhã tem revanche.', mood: 'neutral' };
      if (!S().party.some(isUsable)) return { text: 'Seus Pokémon precisam descansar primeiro.', mood: 'neutral' };
      ui.closeAll();
      const team = npcTeam(who).map((x) => createPokemon(x.species, x.level, { shiny: false }));
      game.locked = true;
      audio.sfx('encounter');
      await game.battleTransition();
      const res = await runBattle({ kind: 'trainer', foe: team, terrain: 'grass', noLoss: true, trainer: { name: r.first, cls: '', look: r.look, reward: 0, defeat: 'Boa batalha!' } });
      await game.afterBattle(res.result === 'lose' ? { ...res, result: 'tower' } : res);
      const win = res.result === 'win';
      const comp = r.trait === 'competitivo';
      const { dv } = applyDelta(r, 'batalha', win ? (comp ? 6 : 3) : (comp ? 2 : 4));
      emote(win ? '👏' : '😎');
      return { text: win ? (comp ? 'Você é bom! Quero revanche amanhã!' : 'Que batalha! Você é demais.') : 'Ganhei! Mas foi divertido!', dv, mood: 'good', reopen: true };
    }
    case 'contato': {
      r.contact = true;
      applyDelta(r, 'contato', 2);
      emote('📱');
      audio.sfx('confirm');
      return { text: `Claro! Anota aí. (${r.first} foi adicionado aos contatos do Pokétch)`, mood: 'good' };
    }
    case 'convidar': {
      const houses = S().houses || [];
      const plotId = houses[0];
      const s = S();
      s.guests = (s.guests || []).filter((g) => g.id !== r.id && g.until > Date.now());
      s.guests.push({ id: r.id, plotId, until: Date.now() + 60 * 60 * 1000 });
      applyDelta(r, 'convidar', 4);
      emote('🏠');
      markDirty();
      return { text: 'Eba! Passo na sua casa daqui a pouco. (Fica por 1 hora)', mood: 'good' };
    }
    case 'namorar': {
      const ok = Math.random() < 0.8;
      if (ok) {
        for (const o of Object.values(S().rel || {})) if (o !== r) o.dating = false;
        r.dating = true;
        applyDelta(r, 'namorar', 8, 10);
        emote('💘');
        audio.sfx('caught');
        return { text: 'SIM! Eu aceito! 💘', mood: 'love' };
      }
      applyDelta(r, 'namorar', -6);
      emote('😳');
      return { text: 'Ah... ainda não estou pronto para isso.', mood: 'bad' };
    }
    case 'terminar': {
      r.dating = false;
      applyDelta(r, 'terminar', -30);
      r.r = Math.floor(r.r / 3);
      emote('💔');
      return { text: 'Entendo... foi bom enquanto durou.', mood: 'bad' };
    }
    case 'provocar': case 'discutir': {
      const dv0 = act === 'provocar' ? -(6 + Math.floor(Math.random() * 7)) : -(14 + Math.floor(Math.random() * 10));
      const funny = act === 'provocar' && r.trait === 'engracado' && r.v > 30 && Math.random() < 0.5;
      const { dv } = applyDelta(r, act, funny ? 2 : dv0);
      emote(funny ? '😂' : '😠');
      return { text: pick(funny ? LINES.provocar.good : LINES[act].bad), dv, mood: funny ? 'good' : 'bad' };
    }
    case 'desculpas': {
      const ok = Math.random() < (r.v > -60 ? 0.75 : 0.45) && !r.acts.desculpas;
      const { dv } = applyDelta(r, 'desculpas', ok ? 10 : -1);
      emote(ok ? '🙂' : '😒');
      return { text: pick(LINES.desculpas[ok ? 'good' : 'bad']), dv, mood: ok ? 'good' : 'bad' };
    }
    default: {
      const ok = Math.random() < chance(r, act);
      const base = { conversar: 3, pokemon: 4, piada: 5, elogiar: 5, fofocar: 5, abracar: 6, paquerar: 2 }[act] || 3;
      const res = ok ? applyDelta(r, act, base + Math.floor(Math.random() * 3), act === 'paquerar' ? 8 + Math.floor(Math.random() * 6) : 0) : applyDelta(r, act, -(2 + Math.floor(Math.random() * 3)), 0);
      emote(ok ? ({ paquerar: '😍', piada: '😂', abracar: '🤗', elogiar: '😊' }[act] || '💬') : '😕');
      const lines = LINES[act] || LINES.conversar;
      return { text: say(pick(ok ? lines.good : lines.bad)), dv: res.dv, dr: res.dr, mood: ok ? (act === 'paquerar' ? 'love' : 'good') : 'bad' };
    }
  }
  void t;
}

function pickGift(ids, r) {
  return new Promise((resolve) => {
    let done = false;
    const layer = ui.panel({
      title: `Presente para ${esc(r.first)}`, width: 'min(560px,96vw)',
      onClose: () => { if (!done) { done = true; resolve(null); } },
      build: (body) => {
        body.innerHTML = `<div class="muted">Dica: cada pessoa tem um presente favorito. Itens mais caros agradam mais.</div>
          <div class="items scroll" style="max-height:50vh">${ids.map((id) => `<div class="item" data-id="${id}"><img src="${itemSprite(id)}" alt=""><span class="n">${esc(ITEMS[id].name)}</span><span class="q">×${S().bag[id]}</span></div>`).join('')}</div>`;
        body.querySelectorAll('[data-id]').forEach((el) => el.onclick = () => { done = true; layer.close(); resolve(el.dataset.id); });
      },
    });
  });
}

// ------------------------------------------------------------ painel social
function barHtml(r) {
  const v = r ? r.v : 0;
  const pct = Math.abs(v) / 2;
  const st = relStatus(r);
  return `<div class="rel-bar"><div class="rel-track"><i class="${v >= 0 ? 'pos' : 'neg'}" style="${v >= 0 ? `left:50%;width:${pct}%` : `right:50%;width:${pct}%`}"></i><b></b></div>
    <div class="rel-meta"><span class="rel-st ${st.cls}">${st.ic} ${st.label}</span><span class="muted">Amizade ${v > 0 ? '+' : ''}${v}</span>
    ${r && r.r > 0 ? `<span class="rel-love">💗 Romance ${r.r}</span>` : ''}</div></div>`;
}

// who: identidade; ent: entidade no mapa (para emotes)
export function openSocial(game, who, ent = null) {
  const r = ensureRel(who);
  const t = TRAITS[r.trait] || TRAITS.simpatico;
  let busy = false;
  let lastMsg = r.talked ? pick(['Oi de novo!', 'E aí, tudo bem?', `Olá, ${state.name}!`]) : `Oi! Eu sou ${r.first}. Prazer!`;
  let lastMood = 'neutral';
  r.talked = true;
  if (ent) { ent.showName = true; ent.name = r.first; }
  const layer = ui.panel({
    title: esc(r.name), sub: `${t.ic} ${t.name} • ${esc(cityName(game, r.city))}`, width: 'min(820px,96vw)', cls: 'social-panel',
    build: (body) => {
      const render = () => {
        body.innerHTML = `<div class="soc">
          <div class="soc-left"><canvas width="140" height="250"></canvas>
            <div class="soc-quote ${lastMood}">${esc(lastMsg)}</div></div>
          <div class="soc-right">
            ${barHtml(r)}
            <div class="soc-tags"><span>🎁 Presente favorito: <b>${r.knowsFav ? esc(ITEMS[r.fav] ? ITEMS[r.fav].name : r.fav) : '???'}</b></span><span>🔴 Gosta de Pokémon: <b>${r.knowsType ? esc(TYPE_PT[r.favType] || r.favType) : '???'}</b></span>${r.contact ? '<span>📱 Nos seus contatos</span>' : ''}</div>
            ${GROUPS.map(([g, gn]) => `<div class="soc-group"><div class="le-h">${gn}</div><div class="soc-acts">${ACTS.filter((a) => a[2] === g).map(([id, n, , req]) => {
    const lock = req(r);
    return `<button class="soc-act ${g}" data-act="${id}" ${lock ? 'disabled' : ''} title="${lock ? esc(lock) : ''}">${n}${lock ? `<small>${esc(lock)}</small>` : ''}</button>`;
  }).join('')}</div></div>`).join('')}
          </div></div>`;
        drawPortrait(body.querySelector('canvas'), r.look, 2, 0);
        body.querySelectorAll('[data-act]').forEach((b) => b.onclick = async () => {
          if (busy) return;
          busy = true;
          const act = b.dataset.act;
          const res = await doAct(game, who, r, act, ent);
          busy = false;
          if (!res) { render(); return; }
          lastMsg = res.text; lastMood = res.mood || 'neutral';
          // conversa revela gostos aos poucos
          if (act === 'conversar' && res.mood === 'good' && Math.random() < 0.5) { r.knowsFav = true; lastMsg += ` (Dica: adoro ${ITEMS[r.fav] ? ITEMS[r.fav].name : r.fav}!)`; }
          if (act === 'pokemon' && res.mood === 'good') r.knowsType = true;
          if (res.dv) ui.toast(`${res.dv > 0 ? '💚' : '💢'} ${res.dv > 0 ? '+' : ''}${res.dv} amizade com ${r.first}${res.dr ? ` • 💗 +${res.dr}` : ''}`, res.dv > 0 ? 'good' : 'bad');
          if (act !== 'presente' && act !== 'batalha') audio.sfx(res.mood === 'bad' ? 'bump' : 'select');
          saveNow();
          if (res.reopen) { openSocial(game, who, ent); return; }
          render();
        });
      };
      render();
    },
  });
  return layer;
}

function cityName(game, id) {
  const c = game.world.cities.find((x) => x.id === id);
  return c ? c.name : 'Sinnoh';
}

// ------------------------------------------------------------ contatos (Pokétch)
export function contacts() {
  const rel = S().rel || {};
  return Object.entries(rel).filter(([, r]) => r.contact).map(([id, r]) => { decay(r); return { id, ...r }; })
    .sort((a, b) => (b.dating - a.dating) || b.v - a.v);
}

export function knownPeople() {
  return Object.values(S().rel || {}).length;
}

// Ligar para um contato (1 vez por dia): +3 amizade, e melhores amigos às vezes mandam presente
export function callContact(id) {
  const r = relOf(id);
  if (!r) return null;
  decay(r);
  if (r.calledDay === today()) return { text: `${r.first} não atendeu... já conversaram hoje.`, ok: false };
  r.calledDay = today();
  const good = r.v > -20;
  const lines = good
    ? [`Oi, ${state.name}! Que bom que ligou!`, 'Tô treinando meus Pokémon, e você?', 'Vamos batalhar qualquer dia desses!', 'Você viu o surto de Pokémon na TV hoje?']
    : ['O que você quer?', 'Agora não posso falar.', '...'];
  applyDelta(r, 'ligar', good ? 3 : -1);
  let gift = null;
  if (good && r.v >= 70 && Math.random() < 0.35) {
    gift = pick(['superpocao', 'grandebola', 'mel', 'docerarro', 'pepita', 'biscoito', 'sitrus']);
    if (ITEMS[gift]) addItem(gift, 1); else gift = null;
  }
  saveNow();
  return { text: pick(lines) + (gift ? ` Te mandei um presente: ${ITEMS[gift].name}!` : ''), ok: good };
}

export function inviteContact(id) {
  const r = relOf(id);
  const s = S();
  if (!r || !(s.houses || []).length) return 'Você precisa ter uma casa para convidar alguém.';
  if (r.v < 30) return `${r.first} ainda não é próximo o bastante para visitar você.`;
  s.guests = (s.guests || []).filter((g) => g.id !== id && g.until > Date.now());
  s.guests.push({ id, plotId: s.houses[0], until: Date.now() + 60 * 60 * 1000 });
  markDirty();
  return `${r.first} vai visitar sua casa na próxima hora!`;
}

// Visitas presentes numa casa (para o interior)
export function guestsAt(plotId) {
  const s = S();
  s.guests = (s.guests || []).filter((g) => g.until > Date.now());
  return s.guests.filter((g) => g.plotId === plotId).map((g) => ({ ...g, r: relOf(g.id) })).filter((g) => g.r);
}

// identidade a partir de um registro salvo (visitas, contatos)
export function whoFromRel(id) {
  const r = relOf(id);
  return r ? { id, name: r.name, first: r.first, female: r.female, city: r.city, trait: r.trait, fav: r.fav, favType: r.favType, look: r.look } : null;
}

void TIER_LEVELS; void state;
