// Interiores dos prédios. Cada interior é um mapa pequeno com tiles, objetos e NPCs.
import { HOUSE_SIZES, FURNITURE } from '../data/furniture.js';
import { GYMS, SPECIAL_LOOKS } from './npcs.js';
import { hashStr, mulberry32 } from '../rng.js';
import { randomLook } from '../data/clothes.js';

export const IT = { VOID: 0, FLOOR: 1, WALL: 2, EXIT: 3, COUNTER: 4, ENC: 5, POOL: 6 };

const SOLID = new Set([IT.VOID, IT.WALL, IT.COUNTER, IT.POOL]);

function base(w, h, floor = 'madeira', wall = 'creme') {
  const tiles = new Uint8Array(w * h).fill(IT.FLOOR);
  for (let x = 0; x < w; x++) { tiles[x] = IT.WALL; tiles[w + x] = IT.WALL; }
  const exitX = Math.floor(w / 2);
  tiles[(h - 1) * w + exitX] = IT.EXIT;
  return { w, h, tiles, floor, wall, objects: [], npcs: [], exit: { x: exitX, y: h - 1 }, encounters: null, dark: 0 };
}

const obj = (m, kind, x, y, extra = {}) => { m.objects.push({ kind, x, y, w: 1, h: 1, solid: true, ...extra }); };
const furn = (m, id, x, y, extra = {}) => {
  const f = FURNITURE[id];
  m.objects.push({ kind: 'furniture', item: id, x, y, w: f.w, h: f.h, solid: !f.walk && !f.wall, ...extra });
};
const npc = (m, role, x, y, name, extra = {}) => { m.npcs.push({ role, x, y, name, dir: 2, ...extra }); };
const counterRow = (m, x0, x1, y) => { for (let x = x0; x <= x1; x++) m.tiles[y * m.w + x] = IT.COUNTER; };

const STAFF_LOOK = {
  nurse: { body: 'f', skin: 0, eyes: 2, hair: 'twintails', hairColor: '#f07ab7', hat: 'beret_branco', top: 'dress_rosa', bottom: 'skirt_branco', shoes: 'sneakers_branco', acc: null, back: null },
  clerk: { body: 'm', skin: 2, eyes: 0, hair: 'short', hairColor: '#2a2526', hat: 'cap_azul', top: 'vest_verde', bottom: 'pants_azul', shoes: 'sneakers_preto', acc: null, back: null },
  stylist: { body: 'f', skin: 3, eyes: 5, hair: 'bob', hairColor: '#7a4bc4', hat: null, top: 'dress_roxo', bottom: 'leggings_preto', shoes: 'boots_preto', acc: 'sunglasses_rosa', back: null },
  agent: { body: 'm', skin: 1, eyes: 1, hair: 'sidepart', hairColor: '#5b3a24', hat: null, top: 'suit_azul', bottom: 'pants_azul', shoes: 'formal_preto', acc: 'glasses_preto', back: null },
  carvalho: { body: 'm', skin: 1, eyes: 0, hair: 'sidepart', hairColor: '#b9b9b5', hat: null, top: 'labcoat_branco', bottom: 'pants_marrom', shoes: 'formal_marrom', acc: null, back: null },
  furniture: { body: 'm', skin: 4, eyes: 0, hair: 'buzz', hairColor: '#2a2526', hat: 'bandana_laranja', top: 'vest_marrom', bottom: 'jeans_azul', shoes: 'boots_marrom', acc: null, back: null },
  daycare: { body: 'f', skin: 2, eyes: 3, hair: 'bun', hairColor: '#ecebe6', hat: null, top: 'sweater_laranja', bottom: 'longskirt_verde', shoes: 'sandals_marrom', acc: 'glasses_marrom', back: null },
  receptionist: { body: 'f', skin: 1, eyes: 1, hair: 'ponytail', hairColor: '#2a2526', hat: null, top: 'suit_preto', bottom: 'skirt_preto', shoes: 'formal_preto', acc: null, back: null },
};
export const staffLook = (k) => STAFF_LOOK[k];

const GYM_LOOK = {
  roark: { body: 'm', skin: 2, eyes: 0, hair: 'short', hairColor: '#c4502c', hat: 'cap_amarelo', top: 'jacket_marrom', bottom: 'jeans_azul', shoes: 'boots_marrom', acc: 'glasses_preto', back: null },
  gardenia: { body: 'f', skin: 1, eyes: 2, hair: 'bob', hairColor: '#e8c36a', hat: null, top: 'vest_verde', bottom: 'shorts_verde', shoes: 'boots_marrom', acc: 'scarf_verde', back: null },
  maylene: { body: 'f', skin: 0, eyes: 5, hair: 'short', hairColor: '#f07ab7', hat: null, top: 'kimono_azul', bottom: 'pants_azul', shoes: 'sandals_preto', acc: null, back: null },
  wake: { body: 'm', skin: 4, eyes: 0, hair: 'mohawk', hairColor: '#3a6fd1', hat: 'bandana_azul', top: 'tank_amarelo', bottom: 'shorts_azul', shoes: 'boots_preto', acc: 'sunglasses_amarelo', back: 'cape_azul' },
  fantina: { body: 'f', skin: 0, eyes: 5, hair: 'long', hairColor: '#7a4bc4', hat: 'tophat_roxo', top: 'dress_roxo', bottom: 'longskirt_roxo', shoes: 'formal_preto', acc: 'necklace_roxo', back: null },
  byron: { body: 'm', skin: 3, eyes: 0, hair: 'buzz', hairColor: '#5b3a24', hat: 'cowboy_marrom', top: 'vest_laranja', bottom: 'jeans_azul', shoes: 'boots_marrom', acc: null, back: null },
  candice: { body: 'f', skin: 1, eyes: 1, hair: 'twintails', hairColor: '#2a2526', hat: null, top: 'sweater_verde', bottom: 'skirt_vermelho', shoes: 'boots_branco', acc: 'scarf_vermelho', back: null },
  volkner: { body: 'm', skin: 1, eyes: 1, hair: 'spiky', hairColor: '#e8c36a', hat: null, top: 'jacket_azul', bottom: 'pants_preto', shoes: 'boots_preto', acc: null, back: null },
  aaron: { body: 'm', skin: 1, eyes: 2, hair: 'spiky', hairColor: '#3a6fd1', hat: null, top: 'vest_verde', bottom: 'pants_branco', shoes: 'sneakers_amarelo', acc: null, back: null },
  bertha: { body: 'f', skin: 2, eyes: 0, hair: 'bun', hairColor: '#ecebe6', hat: null, top: 'sweater_laranja', bottom: 'longskirt_verde', shoes: 'sandals_marrom', acc: 'glasses_marrom', back: null },
  flint: { body: 'm', skin: 4, eyes: 3, hair: 'afro', hairColor: '#c4502c', hat: null, top: 'tank_preto', bottom: 'pants_preto', shoes: 'boots_preto', acc: 'scarf_vermelho', back: null },
  lucian: { body: 'm', skin: 0, eyes: 5, hair: 'sidepart', hairColor: '#7a4bc4', hat: null, top: 'suit_vermelho', bottom: 'pants_preto', shoes: 'formal_preto', acc: 'glasses_preto', back: null },
  cynthia: { body: 'f', skin: 0, eyes: 4, hair: 'long', hairColor: '#e8c36a', hat: null, top: 'coat_preto', bottom: 'pants_preto', shoes: 'boots_preto', acc: null, back: 'cape_preto' },
};
export const leaderLook = (id) => GYM_LOOK[id];

// building: objeto de prédio do mundo; house: dados da casa (para casas de jogadores)
export function makeInterior(building, house = null) {
  const t = building.type;
  const rng = mulberry32(hashStr(building.id));
  let m;
  switch (t) {
    case 'center': {
      m = base(13, 9, 'centro', 'centro');
      counterRow(m, 3, 9, 3);
      npc(m, 'nurse', 6, 2, 'Enfermeira Joy', { look: STAFF_LOOK.nurse });
      obj(m, 'healer', 8, 2);
      obj(m, 'pc', 11, 2, { action: 'pc' });
      furn(m, 'sofa_vermelho', 1, 5); furn(m, 'vaso', 1, 2); furn(m, 'vaso', 11, 5);
      furn(m, 'mesacentro', 1, 6);
      furn(m, 'tapetepokebola', 5, 5);
      obj(m, 'board', 2, 1, { solid: true, text: 'Centro Pokémon: cure seus Pokémon com a Enfermeira Joy. Use o PC para guardar e retirar Pokémon.' });
      obj(m, 'board', 10, 1, { solid: true, action: 'jobs', color: '#e8c33a' });
      break;
    }
    case 'mart': case 'dept': {
      const big = t === 'dept';
      m = base(big ? 15 : 11, big ? 11 : 8, 'azulejo', 'mart');
      counterRow(m, 1, 2, 3); counterRow(m, 1, 2, 4);
      npc(m, 'mart', 1, 2, 'Vendedor', { look: STAFF_LOOK.clerk, shop: big ? 'dept_basic' : 'mart' });
      for (let y = 3; y < m.h - 2; y += 2) for (let x = 5; x + 2 <= m.w - (big ? 4 : 1); x += 3) obj(m, 'shelf', x, y, { w: 2 });
      if (big) {
        counterRow(m, m.w - 3, m.w - 2, 3);
        npc(m, 'mart', m.w - 2, 2, 'Vendedora de MTs', { look: { ...STAFF_LOOK.clerk, body: 'f', hair: 'ponytail', hairColor: '#c4502c' }, shop: 'dept_tm' });
        counterRow(m, m.w - 3, m.w - 2, 7);
        npc(m, 'mart', m.w - 2, 6, 'Vendedor de Evolução', { look: { ...STAFF_LOOK.clerk, hairColor: '#e8c36a' }, shop: 'dept_evo' });
      }
      break;
    }
    case 'boutique': {
      m = base(12, 9, 'marmore', 'rosa');
      counterRow(m, 1, 3, 3);
      npc(m, 'boutique', 2, 2, 'Vendedora da Boutique', { look: { ...STAFF_LOOK.stylist, hair: 'ponytail', hairColor: '#e8c36a' } });
      npc(m, 'salon', 9, 2, 'Cabeleireira', { look: STAFF_LOOK.stylist, dir: 0 });
      obj(m, 'mirror', 10, 1, { solid: true });
      obj(m, 'wardrobeTalk', 6, 1, { solid: true, action: 'wardrobe' });
      for (let x = 2; x < 10; x += 3) obj(m, 'rack', x, 6, { w: 2 });
      furn(m, 'poltrona_roxo', 9, 3); furn(m, 'vaso', 11, 7); furn(m, 'tapeteredondo_rosa', 5, 3);
      break;
    }
    case 'furniture': {
      m = base(12, 9, 'madeiraescura', 'madeira');
      counterRow(m, 1, 3, 3);
      npc(m, 'furniture', 2, 2, 'Vendedor de Móveis', { look: STAFF_LOOK.furniture });
      furn(m, 'sofa_verde', 6, 3); furn(m, 'mesacentro', 6, 4); furn(m, 'luminaria', 9, 3);
      furn(m, 'camacasal_azul', 9, 5); furn(m, 'estante', 5, 1); furn(m, 'boneco_25', 1, 6); furn(m, 'boneco_143', 3, 6);
      furn(m, 'tapete_vermelho', 5, 6); furn(m, 'piano', 9, 1);
      break;
    }
    case 'realty': {
      m = base(10, 8, 'carpeteazul', 'listrado');
      furn(m, 'escrivaninha', 4, 3);
      npc(m, 'realty', 4, 2, 'Corretor de Imóveis', { look: STAFF_LOOK.agent });
      furn(m, 'estante', 1, 1); furn(m, 'vaso', 8, 2); furn(m, 'cadeira_marrom', 4, 4); furn(m, 'cadeira_marrom', 5, 4);
      furn(m, 'quadro', 6, 1); furn(m, 'poltrona_azul', 8, 5);
      break;
    }
    case 'gym': {
      const gymId = Object.keys(GYMS).find((k) => GYMS[k].city === building.city);
      const g = GYMS[gymId];
      m = base(13, 14, 'gym', 'gym');
      m.gym = gymId;
      m.gymColor = g ? g.color : '#888';
      npc(m, 'leader', 6, 3, g ? g.name : 'Líder', { look: GYM_LOOK[gymId], gym: gymId });
      npc(m, 'guide', 4, 11, 'Guia do Ginásio', { look: { ...STAFF_LOOK.clerk, top: 'tee_branco', hat: 'cap_preto' }, gym: gymId });
      for (const [x, y] of [[3, 5], [9, 5], [3, 8], [9, 8]]) obj(m, 'gymStatue', x, y, { color: m.gymColor });
      obj(m, 'gymPlatform', 5, 2, { w: 3, h: 3, solid: false, color: m.gymColor });
      // decoração de acordo com o tipo do ginásio
      const deco = {
        Rock: ['pillar'], Grass: ['f:arvorevaso', 'f:flores_amarelo'], Fighting: ['gymStatue'], Water: ['f:aquario'],
        Ghost: ['grave'], Steel: ['machine'], Ice: ['f:luminaria'], Electric: ['generator'],
      }[g ? g.type : ''] || [];
      const spots = [[1, 3], [11, 3], [1, 7], [11, 7], [1, 10], [11, 10]];
      deco.length && spots.forEach(([x, y], i) => {
        const d = deco[i % deco.length];
        if (d.startsWith('f:')) furn(m, d.slice(2), d.slice(2) === 'aquario' ? (x === 1 ? 1 : 10) : x, y);
        else obj(m, d, x, y, { color: m.gymColor });
      });
      break;
    }
    case 'lab': {
      m = base(13, 10, 'azulejo', 'lab');
      npc(m, 'carvalho', 6, 3, 'Professor Carvalho', { look: STAFF_LOOK.carvalho });
      obj(m, 'starterTable', 5, 5, { w: 3, action: 'starter' });
      for (let x = 1; x < 12; x += 3) furn(m, 'estante', x, 1);
      obj(m, 'machine', 10, 4); obj(m, 'machine', 10, 6); furn(m, 'pc', 1, 4); furn(m, 'vaso', 1, 7); furn(m, 'vaso', 11, 8);
      npc(m, 'aide', 2, 6, 'Assistente', { look: { ...STAFF_LOOK.carvalho, hairColor: '#2a2526', hair: 'short', skin: 3 } });
      break;
    }
    case 'house': case 'house2': {
      m = base(9, 7, rng() < 0.5 ? 'madeira' : 'carpetevermelho', ['creme', 'listrado', 'verde', 'rosa'][Math.floor(rng() * 4)]);
      furn(m, 'mesa', 3, 3); furn(m, 'cadeira_marrom', 3, 4); furn(m, 'estante', 6, 1);
      furn(m, ['tv', 'pc', 'aquario'][Math.floor(rng() * 3)], 1, 1); furn(m, 'vaso', 7, 4); furn(m, 'tapete_azul', 5, 3);
      npc(m, 'resident', 2, 4, 'Morador', { look: randomLook(rng), dir: 0, seed: Math.floor(rng() * 1e9) });
      break;
    }
    case 'daycare': {
      m = base(10, 8, 'grama', 'verde');
      npc(m, 'daycare', 4, 2, 'Dona da Creche', { look: STAFF_LOOK.daycare });
      furn(m, 'mesa', 4, 3); furn(m, 'boneco_175', 1, 2); furn(m, 'boneco_39', 8, 2); furn(m, 'flores_amarelo', 1, 5); furn(m, 'flores_rosa', 8, 5);
      break;
    }
    case 'library': {
      m = base(12, 9, 'madeiraescura', 'madeira');
      for (let x = 1; x < 11; x += 2) furn(m, 'estante', x, 1);
      for (let x = 1; x < 11; x += 3) furn(m, 'estante', x, 4);
      npc(m, 'lore', 6, 6, 'Bibliotecária', { look: { ...STAFF_LOOK.daycare, hair: 'bob', hairColor: '#2a2526' } });
      break;
    }
    case 'contest': {
      m = base(14, 10, 'marmore', 'rosa');
      obj(m, 'stage', 4, 2, { w: 6, h: 2 });
      npc(m, 'resident', 7, 5, 'Apresentadora', { look: { ...STAFF_LOOK.stylist, top: 'dress_amarelo' }, lines: ['Bem-vindo ao Salão de Concursos! Em breve teremos concursos de beleza Pokémon!', 'Enquanto isso, que tal se vestir bem na Boutique ao lado?'] });
      furn(m, 'sofa_rosa', 1, 6); furn(m, 'sofa_rosa', 11, 6); furn(m, 'vaso', 1, 2); furn(m, 'vaso', 12, 2);
      break;
    }
    case 'league': {
      m = base(17, 14, 'marmore', 'noite');
      npc(m, 'leaguedesk', 8, 10, 'Recepcionista', { look: STAFF_LOOK.receptionist });
      const pos = [[3, 6], [6, 4], [10, 4], [13, 6], [8, 2]];
      ['aaron', 'bertha', 'flint', 'lucian', 'cynthia'].forEach((id, i) => {
        npc(m, 'elite', pos[i][0], pos[i][1], '', { look: GYM_LOOK[id], elite: i });
        obj(m, 'gymPlatform', pos[i][0] - 1, pos[i][1] - 1, { w: 3, h: 3, solid: false, color: ['#a6b91a', '#e2bf65', '#ee8130', '#f95587', '#6f35fc'][i] });
      });
      break;
    }
    case 'tower': case 'chateau': case 'ruins': case 'powerplant': {
      const big = t === 'tower' || t === 'chateau';
      m = base(big ? 17 : 14, big ? 13 : 10, t === 'powerplant' ? 'azulejo' : 'pedra', t === 'powerplant' ? 'mart' : 'pedra');
      for (let y = 2; y < m.h - 1; y++) for (let x = 0; x < m.w; x++) {
        const i = y * m.w + x;
        if (m.tiles[i] === IT.FLOOR && !(x === m.exit.x && y >= m.h - 2)) m.tiles[i] = IT.ENC;
      }
      const deco = { tower: 'grave', chateau: 'oldfurniture', ruins: 'pillar', powerplant: 'generator' }[t];
      // a TV assombrada do Château (easter egg: liga sozinha à noite)
      if (t === 'chateau') obj(m, 'tv', 2, 1, { w: 2, action: 'chateautv' });
      for (let k = 0; k < (big ? 14 : 8); k++) {
        const x = 1 + Math.floor(rng() * (m.w - 2)), y = 3 + Math.floor(rng() * (m.h - 5));
        if (Math.abs(x - m.exit.x) <= 1) continue;
        obj(m, deco, x, y);
      }
      m.encounters = building.zone || { tower: 'losttower', chateau: 'chateau', ruins: 'ruins', powerplant: 'windworks' }[t];
      m.dark = t === 'powerplant' ? 0.1 : 0.45;
      break;
    }
    case 'momhouse': {
      m = base(9, 7, 'madeira', 'listrado');
      npc(m, 'mom', 4, 3, 'Mamãe', { look: SPECIAL_LOOKS.mom });
      furn(m, 'tv', 1, 1); furn(m, 'pia', 5, 1); furn(m, 'fogao', 6, 1); furn(m, 'geladeira', 7, 1);
      furn(m, 'mesa', 3, 4); furn(m, 'cadeira_vermelho', 2, 4); furn(m, 'vaso', 1, 5); furn(m, 'tapete_vermelho', 6, 4);
      break;
    }
    case 'museum': {
      m = base(14, 9, 'marmore', 'madeira');
      counterRow(m, 2, 4, 3);
      npc(m, 'fossil', 3, 2, 'Cientista do Museu', { look: SPECIAL_LOOKS.scientist });
      npc(m, 'treasure', 10, 5, 'Curador', { look: SPECIAL_LOOKS.oldman, dir: 3 });
      const ex = [
        [7, 'Fóssil Hélice: Omanyte nadava nos mares antigos usando a concha em espiral.'],
        [9, 'Fóssil Domo: Kabuto vivia no fundo do mar há centenas de milhões de anos.'],
        [11, 'Âmbar Antigo: dentro dele há material genético de Aerodactyl, o senhor dos céus pré-históricos.'],
      ];
      for (const [x, text] of ex) obj(m, 'pillar', x, 2, { text });
      obj(m, 'board', 12, 1, { solid: true, text: 'MUSEU DE MINERAÇÃO DE OREBURGH — Escave nas paredes brilhantes das cavernas! Fósseis podem ser revividos aqui e o Curador compra tesouros.' });
      obj(m, 'machine', 1, 5); furn(m, 'vaso', 12, 7);
      break;
    }
    case 'battletower': {
      m = base(15, 11, 'marmore', 'noite');
      counterRow(m, 6, 8, 4);
      npc(m, 'tower', 7, 3, 'Recepcionista da Torre', { look: STAFF_LOOK.receptionist });
      counterRow(m, 1, 3, 4);
      npc(m, 'bpshop', 2, 3, 'Troca de BP', { look: STAFF_LOOK.clerk });
      npc(m, 'ivjudge', 12, 6, 'Avaliador de Potencial', { look: SPECIAL_LOOKS.oldman, dir: 3 });
      obj(m, 'gymStatue', 4, 7, { color: '#3a4a8a' }); obj(m, 'gymStatue', 10, 7, { color: '#3a4a8a' });
      obj(m, 'board', 11, 1, { solid: true, text: 'TORRE DE BATALHA — Vença 7 treinadores seguidos e ganhe Pontos de Batalha (BP)! Seus Pokémon são curados entre as batalhas.' });
      break;
    }
    case 'safari': {
      m = base(10, 8, 'grama', 'verde');
      counterRow(m, 3, 6, 3);
      npc(m, 'safari', 4, 2, 'Guarda da Zona Safári', { look: SPECIAL_LOOKS.ranger });
      furn(m, 'arvorevaso', 1, 2); furn(m, 'arvorevaso', 8, 2); furn(m, 'flores_amarelo', 1, 5); furn(m, 'flores_rosa', 8, 5);
      obj(m, 'board', 7, 1, { solid: true, text: 'ZONA SAFÁRI DO GRANDE PÂNTANO — Tauros, Kangaskhan, Chansey, Dratini e outros raros vivem no pântano a oeste de Pastoria. Lá dentro, as Safari Bolas são as melhores!' });
      break;
    }
    case 'tvstation': {
      m = base(12, 9, 'carpeteazul', 'listrado');
      counterRow(m, 1, 3, 3);
      npc(m, 'lottery', 2, 2, 'Loteria Pokémon', { look: STAFF_LOOK.receptionist });
      npc(m, 'tvhost', 8, 5, 'Repórter da TV', { look: { ...STAFF_LOOK.stylist, top: 'suit_azul', acc: null }, dir: 2 });
      furn(m, 'tv', 6, 1); furn(m, 'tv', 9, 1); obj(m, 'machine', 10, 5); furn(m, 'sofa_azul', 2, 6);
      break;
    }
    case 'galactic': {
      m = base(15, 12, 'azulejo', 'mart');
      npc(m, 'galactic', 7, 8, 'Recruta Galáctico', { look: SPECIAL_LOOKS.grunt, gal: 'grunt', gid: 'hq1' });
      npc(m, 'galactic', 3, 5, 'Recruta Galáctica', { look: SPECIAL_LOOKS.gruntf, gal: 'grunt', gid: 'hq2', dir: 3 });
      npc(m, 'galactic', 7, 3, 'Comandante Jupiter', { look: SPECIAL_LOOKS.jupiter, gal: 'jupiter', gid: 'hq3' });
      for (const [x, y] of [[1, 2], [13, 2], [1, 8], [13, 8], [11, 5]]) obj(m, 'machine', x, y);
      obj(m, 'board', 4, 1, { solid: true, text: 'EQUIPE GALÁCTICA — Rumo a um novo universo! (Dizem que o chefe Cyrus foi para o topo do Monte Coronet...)' });
      m.dark = 0.15;
      break;
    }
    case 'pkmansion': {
      m = base(17, 12, 'marmore', 'listrado');
      npc(m, 'backlot', 8, 4, 'Sr. Backlot', { look: SPECIAL_LOOKS.backlot });
      npc(m, 'resident', 4, 8, 'Mordomo', { look: { ...STAFF_LOOK.agent, top: 'suit_preto', acc: null }, dir: 1, lines: ['Bem-vindo à Mansão Pokémon.', 'O Sr. Backlot adora contar qual Pokémon apareceu hoje no Jardim de Troféus, aqui fora.'] });
      furn(m, 'lareira', 7, 1); furn(m, 'piano', 12, 1); furn(m, 'estatua', 2, 2); furn(m, 'estatua', 14, 2);
      furn(m, 'sofagrande_vermelho', 7, 6); furn(m, 'tapetegrande_vermelho', 7, 8); furn(m, 'trofeu', 10, 2); furn(m, 'arvorevaso', 1, 9); furn(m, 'arvorevaso', 15, 9);
      break;
    }
    case 'tutorhouse': case 'deleterhouse': case 'tradehouse': {
      m = base(9, 7, rng() < 0.5 ? 'madeira' : 'tatame', ['creme', 'verde', 'madeira'][Math.floor(rng() * 3)]);
      furn(m, 'estante', 6, 1); furn(m, 'vaso', 7, 4); furn(m, 'tapete_azul', 1, 4); furn(m, 'mesinha', 1, 1);
      if (t === 'tutorhouse') npc(m, 'relearner', 4, 3, 'Tutor de Golpes', { look: SPECIAL_LOOKS.oldman });
      else if (t === 'deleterhouse') npc(m, 'deleter', 4, 3, 'Esquecedor de Golpes', { look: { ...SPECIAL_LOOKS.oldman, hair: 'sidepart', top: 'kimono_azul' } });
      else {
        const ev = HOUSE_EVENT[building.city] || { role: 'resident', name: 'Morador' };
        npc(m, ev.role, 4, 3, ev.name, { ...ev, look: ev.look ? SPECIAL_LOOKS[ev.look] : randomLook(rng), seed: Math.floor(rng() * 1e9) });
      }
      break;
    }
    case 'luxfurniture': {
      m = base(13, 9, 'marmore', 'noite');
      counterRow(m, 1, 3, 3);
      npc(m, 'furniture', 2, 2, 'Consultora de Luxo', { look: { ...STAFF_LOOK.stylist, top: 'suit_preto', acc: 'sunglasses_preto' } });
      furn(m, 'jacuzzi', 5, 2); furn(m, 'fonte', 8, 2); furn(m, 'sinuca', 9, 5); furn(m, 'lustre', 10, 1); furn(m, 'fliperama', 11, 2);
      furn(m, 'tapetepersa_dourado', 1, 6);
      break;
    }
    default: {
      m = base(9, 7);
    }
  }
  // casas de jogadores
  if (BUILDING_PLOT[t]) {
    const size = HOUSE_SIZES[BUILDING_PLOT[t]];
    m = base(size.w, size.h, house?.floor || (size.pool ? 'marmore' : 'madeira'), house?.wall || 'creme');
    m.house = true;
    if (size.pool) {
      const [px, py, pw, ph] = size.pool;
      for (let y = py; y < py + ph; y++) for (let x = px; x < px + pw; x++) m.tiles[y * m.w + x] = IT.POOL;
      m.pool = size.pool;
    }
    if (house && Array.isArray(house.furniture)) {
      for (const f of house.furniture) {
        const def = FURNITURE[f.id];
        if (!def) continue;
        m.objects.push({ kind: 'furniture', item: f.id, x: f.x, y: f.y, w: def.w, h: def.h, solid: !def.walk && !def.wall });
      }
    }
  }
  m.id = building.id;
  m.type = t;
  m.name = building.name;
  return m;
}

// Casas com eventos especiais (uma por cidade)
const HOUSE_EVENT = {
  oreburgh: { role: 'trade', name: 'Garoto Colecionador', look: 'hiker', want: 63, give: 66, nick: 'Kazza' },
  snowpoint: { role: 'trade', name: 'Garota Misteriosa', look: 'gruntf', want: 308, give: 93, nick: 'Gaspar' },
  eterna: { role: 'giftegg', name: 'Cynthia', look: 'cynthia', egg: 175, flag: 'togepi' },
  solaceon: { role: 'giftegg', name: 'Mochileiro', look: 'hiker', egg: 0, flag: 'mysteryegg' },
  celestic: { role: 'flute', name: 'Anciã de Celestic', look: 'elder' },
  floaroma: { role: 'squirt', name: 'Dona da Floricultura', look: 'florist' },
  hearthome: { role: 'friendship', name: 'Avaliadora de Amizade', look: 'elder' },
};

const BUILDING_PLOT = { plot_s: 's', plot_m: 'm', plot_l: 'l', mansion: 'x', mansion2: 'xl' };

export function interiorSolidAt(m, x, y) {
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return true;
  if (SOLID.has(m.tiles[y * m.w + x])) return true;
  for (const o of m.objects) {
    if (!o.solid) continue;
    if (x >= o.x && x < o.x + (o.w || 1) && y >= o.y && y < o.y + (o.h || 1)) return true;
  }
  for (const n of m.npcs) if (n.x === x && n.y === y) return true;
  return false;
}

// Valida a posição de um móvel numa casa (usada pelo cliente e pelo servidor).
export function canPlaceFurniture(m, item, x, y, ignoreIndex = -1, list = null) {
  const def = FURNITURE[item];
  if (!def) return false;
  if (x < 0 || y < 0 || x + def.w > m.w || y + def.h > m.h) return false;
  for (let yy = y; yy < y + def.h; yy++) for (let xx = x; xx < x + def.w; xx++) {
    const t = m.tiles[yy * m.w + xx];
    if (def.wall) { if (yy > 1) return false; if (t !== IT.WALL) return false; }
    else if (t !== IT.FLOOR) return false;
    if (!def.wall && xx === m.exit.x && yy >= m.h - 2) return false;
  }
  const items = list || m.objects.filter((o) => o.kind === 'furniture').map((o) => ({ id: o.item, x: o.x, y: o.y }));
  for (let i = 0; i < items.length; i++) {
    if (i === ignoreIndex) continue;
    const o = items[i], d2 = FURNITURE[o.id];
    if (!d2) continue;
    // tapetes podem ficar sob móveis; itens de parede só colidem com itens de parede
    if (def.walk !== d2.walk) continue;
    if (def.wall !== d2.wall) continue;
    if (x < o.x + d2.w && x + def.w > o.x && y < o.y + d2.h && y + def.h > o.y) return false;
  }
  return true;
}
