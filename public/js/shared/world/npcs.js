// Treinadores, líderes de ginásio, Elite dos Quatro e falas de NPCs.
import { ZONES, ZONE_INDEX, TIER_LEVELS } from './defs.js';
import { buildEncounterTables, evolveForLevel } from './encounters.js';
import { mulberry32 } from '../rng.js';
import { randomLook } from '../data/clothes.js';

const MALE = ['Lucas', 'Pedro', 'Gabriel', 'Mateus', 'Rafael', 'João', 'Thiago', 'Bruno', 'Felipe', 'Vinícius', 'Gustavo', 'Davi', 'Miguel', 'Caio', 'Diego', 'Enzo', 'Arthur', 'Heitor', 'Leonardo', 'Samuel', 'Otávio', 'Renan', 'Igor', 'Murilo'];
const FEMALE = ['Ana', 'Júlia', 'Beatriz', 'Larissa', 'Camila', 'Mariana', 'Carla', 'Letícia', 'Isabela', 'Sofia', 'Laura', 'Helena', 'Renata', 'Paula', 'Bianca', 'Lívia', 'Alice', 'Clara', 'Manuela', 'Yasmin', 'Valentina', 'Lorena', 'Giovana', 'Bruna'];

const CLASSES = {
  meadow: [['Jovem', 'm'], ['Garota', 'f'], ['Campista', 'm'], ['Piqueniqueira', 'f'], ['Criador', 'm']],
  forest: [['Caçador de Insetos', 'm'], ['Ranger', 'f'], ['Ranger', 'm'], ['Garota', 'f']],
  mountain: [['Montanhista', 'm'], ['Faixa Preta', 'm'], ['Ranger', 'f'], ['Ás', 'f']],
  cave: [['Montanhista', 'm'], ['Explorador', 'm'], ['Trabalhador', 'm']],
  lake: [['Pescador', 'm'], ['Nadadora', 'f']],
  sea: [['Nadador', 'm'], ['Nadadora', 'f'], ['Marinheiro', 'm']],
  beach: [['Nadador', 'm'], ['Banhista', 'f'], ['Pescador', 'm']],
  snow: [['Esquiadora', 'f'], ['Esquiador', 'm'], ['Ás', 'm']],
  desert: [['Ruinista', 'm'], ['Explorador', 'm'], ['Ás', 'f']],
  volcano: [['Mestre do Fogo', 'm'], ['Ás', 'f']],
  marsh: [['Pescador', 'm'], ['Ranger', 'f']],
  electric: [['Guitarrista', 'm'], ['Cientista', 'm'], ['Cientista', 'f']],
  ruins: [['Psíquica', 'f'], ['Psíquico', 'm'], ['Ruinista', 'm']],
  ghost: [['Médium', 'f'], ['Médium', 'm']],
  night: [['Jovem', 'm'], ['Garota', 'f']],
  dragon: [['Domador de Dragões', 'm'], ['Ás', 'f']],
  fossil: [['Trabalhador', 'm'], ['Cientista', 'f']],
};

const INTROS = [
  'Ei! Você parece forte. Vamos batalhar?', 'Meus Pokémon estão loucos para lutar!', 'Treinei muito aqui. Topa um desafio?',
  'Nossos olhares se cruzaram! Isso significa batalha!', 'Não vou pegar leve com você!', 'Quer ver do que meus Pokémon são capazes?',
  'Uma batalha rapidinha? Prometo que vai ser divertido!', 'Estava esperando alguém como você!',
];
const DEFEATS = [
  'Uau, você é muito bom!', 'Perdi... Preciso treinar mais.', 'Que batalha incrível!', 'Não acredito que perdi!',
  'Você e seus Pokémon formam uma ótima equipe.', 'Ok, ok, você venceu!', 'Vou ficar mais forte, você vai ver!',
];
const AFTER = [
  'Volte mais tarde para uma revanche!', 'Vou treinar e te desafiar de novo.', 'Já estou me recuperando... volte depois!',
];

export const TRAINER_COOLDOWN_MS = 20 * 60 * 1000;

// Dados completos de um treinador de rota (determinístico a partir do objeto do mapa).
export function trainerData(obj) {
  const rng = mulberry32(obj.seed);
  const z = ZONES[ZONE_INDEX[obj.zone]];
  const biomes = z.biomes.length ? z.biomes : ['meadow'];
  const biome = biomes[Math.floor(rng() * biomes.length)];
  const cl = (CLASSES[biome] || CLASSES.meadow);
  const [cls, g] = cl[Math.floor(rng() * cl.length)];
  const female = g === 'f';
  const name = (female ? FEMALE : MALE)[Math.floor(rng() * 24)];
  const tables = buildEncounterTables()[z.id];
  const pool = [...tables.grass, ...tables.cave, ...tables.water].filter((c) => !c.night || rng() < 0.3);
  const [, hi] = TIER_LEVELS[z.tier];
  const count = z.tier <= 1 ? 1 + Math.floor(rng() * 2) : z.tier <= 3 ? 2 + Math.floor(rng() * 2) : 3 + Math.floor(rng() * 2);
  const team = [];
  for (let i = 0; i < count && pool.length; i++) {
    const c = pool[Math.floor(rng() * pool.length)];
    const level = Math.max(2, hi - 1 + Math.floor(rng() * 3) - (count - 1 - i));
    team.push({ species: evolveForLevel(c.id, level, rng), level });
  }
  return {
    id: obj.id, name, cls, female, team,
    look: randomLook(rng, female),
    reward: Math.round(hi * (cls === 'Ás' ? 90 : cls === 'Jovem' || cls === 'Garota' ? 40 : 60)),
    intro: INTROS[Math.floor(rng() * INTROS.length)],
    defeat: DEFEATS[Math.floor(rng() * DEFEATS.length)],
    after: AFTER[Math.floor(rng() * AFTER.length)],
  };
}

// ------------------------------------------------------------ ginásios
// Os times escalam com o número de insígnias (mundo aberto: qualquer ordem).
export const GYMS = {
  roark: { city: 'oreburgh', name: 'Roark', type: 'Rock', badge: 'Insígnia Carvão', color: '#8a7350', team: [74, 95, 299, 246, 138, 347], quote: 'Bem-vindo ao Ginásio de Oreburgh! Rochas são firmes como a minha determinação!' },
  gardenia: { city: 'eterna', name: 'Gardenia', type: 'Grass', badge: 'Insígnia Floresta', color: '#4f9a4a', team: [315, 286, 45, 357, 272, 254], quote: 'Meus Pokémon de Planta florescem na batalha. Vamos lá!' },
  maylene: { city: 'veilstone', name: 'Maylene', type: 'Fighting', badge: 'Insígnia Paralelepípedo', color: '#b5473a', team: [307, 66, 296, 214, 237, 62], quote: 'Corpo e mente em harmonia. Mostre sua força!' },
  wake: { city: 'pastoria', name: 'Crasher Wake', type: 'Water', badge: 'Insígnia Pântano', color: '#3c7cc4', team: [130, 195, 260, 121, 230, 160], quote: 'Eu sou o Crasher Wake! Prepare-se para a onda!' },
  fantina: { city: 'hearthome', name: 'Fantina', type: 'Ghost', badge: 'Insígnia Relíquia', color: '#6d4f96', team: [94, 200, 356, 354, 302, 292], quote: 'Ah, uma visita! Meus Pokémon Fantasma vão encantar você!' },
  byron: { city: 'canalave', name: 'Byron', type: 'Steel', badge: 'Insígnia Mina', color: '#8f97a3', team: [208, 82, 227, 205, 306, 376], quote: 'Aço não enferruja! Minha defesa é inquebrável!' },
  candice: { city: 'snowpoint', name: 'Candice', type: 'Ice', badge: 'Insígnia Pingente', color: '#6fb8d8', team: [215, 221, 124, 362, 365, 131], quote: 'Concentração total! Meus Pokémon de Gelo estão prontos!' },
  volkner: { city: 'sunyshore', name: 'Volkner', type: 'Electric', badge: 'Insígnia Farol', color: '#d8b13a', team: [26, 135, 181, 125, 310, 82], quote: 'Faz tempo que não tenho uma batalha empolgante... Me surpreenda!' },
};

export const ELITE = [
  { id: 'aaron', name: 'Aaron', title: 'Elite dos Quatro', type: 'Bug', team: [212, 214, 127, 348, 291, 213], quote: 'Sou Aaron, da Elite dos Quatro! Pokémon Inseto são lindos e fortes!' },
  { id: 'bertha', name: 'Bertha', title: 'Elite dos Quatro', type: 'Ground', team: [260, 76, 232, 330, 112, 344], quote: 'Ora, ora, uma jovem promessa. Vamos ver sua força, querido.' },
  { id: 'flint', name: 'Flint', title: 'Elite dos Quatro', type: 'Fire', team: [78, 59, 229, 257, 157, 126], quote: 'Sou Flint! Meu fogo vai queimar sua determinação!' },
  { id: 'lucian', name: 'Lucian', title: 'Elite dos Quatro', type: 'Psychic', team: [65, 196, 282, 122, 203, 199], quote: 'Sou Lucian. Leio as batalhas como leio meus livros.' },
  { id: 'cynthia', name: 'Cynthia', title: 'Campeã', type: 'Dragon', team: [149, 373, 350, 248, 282, 376], quote: 'Sou Cynthia, a Campeã. Mostre-me tudo o que você tem!' },
];

export function gymTeam(gym, badges) {
  const level = Math.min(62, 13 + badges * 6);
  const n = Math.min(6, 2 + Math.floor(badges / 2) + (badges >= 7 ? 1 : 0));
  return gym.team.slice(0, n).map((sp, i) => ({ species: evolveForLevel(sp, level + i, () => 0), level: level + i - (i < n - 1 ? 1 : 0) }));
}

export function eliteTeam(member, idx) {
  const base = 58 + idx * 2;
  return member.team.map((sp, i) => ({ species: evolveForLevel(sp, base + i, () => 0), level: base + Math.min(i, 4) }));
}

// ------------------------------------------------------------ falas de NPCs
export const NPC_LINES = [
  'Sabia que você pode ir para qualquer lugar de Sinnoh? Não tem caminho certo!',
  'Dizem que lendários se escondem nos cantos mais distantes do mapa...',
  'Os Pokémon na grama alta ficam mais fortes conforme você vai para o norte.',
  'Você pode comprar uma casa em qualquer cidade! Fale com a Imobiliária ou com a placa da casa.',
  'A Boutique de Hearthome tem as roupas mais elegantes da região.',
  'Aperte Shift para correr e B para usar a bicicleta!',
  'O Professor Carvalho fica no laboratório de Sandgem. Ele sempre ajuda os treinadores.',
  'Os ginásios ficam mais difíceis conforme você ganha insígnias. Desafie na ordem que quiser!',
  'Dá para surfar em qualquer água. Cuidado com os Pokémon do mar!',
  'À noite aparecem Pokémon diferentes. Já viu um Hoothoot?',
  'Um amigo meu trocou um Kadabra e ele evoluiu na hora!',
  'Pedras de evolução são vendidas na Loja de Departamentos de Veilstone.',
  'Falso Golpe é perfeito para capturar Pokémon sem derrotá-los.',
  'O Monte Coronet corta a região ao meio. Os túneis levam a lugares incríveis.',
  'O deserto ao norte de Veilstone é cheio de tempestades de areia.',
  'Ouvi dizer que na Torre Perdida aparecem Pokémon Fantasma...',
  'Na creche você pode deixar um Pokémon treinando enquanto passeia!',
  'Já decorou sua casa? Os bonecos de Pokémon são uma graça!',
  'Pressione Enter para conversar no chat com outros treinadores.',
  'Clique em outro jogador para trocar Pokémon ou batalhar!',
];

// ------------------------------------------------------------ personagens especiais do mapa
export const SPECIAL_LOOKS = {
  barry: { body: 'm', skin: 0, eyes: 0, hair: 'spiky', hairColor: '#e8c36a', hat: null, top: 'striped_laranja', bottom: 'pants_verde', shoes: 'sneakers_branco', acc: 'scarf_verde', back: null },
  grunt: { body: 'm', skin: 1, eyes: 1, hair: 'bob', hairColor: '#3fb4b4', hat: null, top: 'jacket_cinza', bottom: 'pants_cinza', shoes: 'boots_preto', acc: null, back: null },
  gruntf: { body: 'f', skin: 1, eyes: 1, hair: 'bob', hairColor: '#3fb4b4', hat: null, top: 'jacket_cinza', bottom: 'skirt_cinza', shoes: 'boots_preto', acc: null, back: null },
  mars: { body: 'f', skin: 0, eyes: 5, hair: 'bob', hairColor: '#c4502c', hat: null, top: 'jacket_branco', bottom: 'skirt_cinza', shoes: 'boots_preto', acc: null, back: null },
  saturn: { body: 'm', skin: 1, eyes: 1, hair: 'spiky', hairColor: '#3a6fd1', hat: null, top: 'jacket_branco', bottom: 'pants_cinza', shoes: 'boots_preto', acc: null, back: null },
  jupiter: { body: 'f', skin: 0, eyes: 5, hair: 'curly', hairColor: '#7a4bc4', hat: null, top: 'coat_branco', bottom: 'skirt_preto', shoes: 'boots_preto', acc: null, back: null },
  cyrus: { body: 'm', skin: 0, eyes: 4, hair: 'spiky', hairColor: '#3a4f8a', hat: null, top: 'coat_azul', bottom: 'pants_cinza', shoes: 'formal_preto', acc: null, back: null },
  mom: { body: 'f', skin: 1, eyes: 3, hair: 'ponytail', hairColor: '#5b3a24', hat: null, top: 'sweater_rosa', bottom: 'longskirt_azul', shoes: 'sandals_marrom', acc: null, back: null },
  backlot: { body: 'm', skin: 1, eyes: 0, hair: 'sidepart', hairColor: '#ecebe6', hat: null, top: 'suit_preto', bottom: 'pants_preto', shoes: 'formal_preto', acc: 'glasses_preto', back: null },
  scientist: { body: 'f', skin: 2, eyes: 1, hair: 'bun', hairColor: '#2a2526', hat: null, top: 'labcoat_branco', bottom: 'pants_azul', shoes: 'formal_preto', acc: 'glasses_azul', back: null },
  ranger: { body: 'm', skin: 3, eyes: 0, hair: 'short', hairColor: '#5b3a24', hat: 'bucket_verde', top: 'vest_verde', bottom: 'shorts_verde', shoes: 'boots_marrom', acc: null, back: null },
  elder: { body: 'f', skin: 2, eyes: 4, hair: 'bun', hairColor: '#ecebe6', hat: null, top: 'kimono_roxo', bottom: 'longskirt_roxo', shoes: 'sandals_marrom', acc: null, back: null },
  oldman: { body: 'm', skin: 2, eyes: 4, hair: 'buzz', hairColor: '#ecebe6', hat: null, top: 'sweater_marrom', bottom: 'pants_marrom', shoes: 'formal_marrom', acc: 'glasses_marrom', back: null },
  hiker: { body: 'm', skin: 3, eyes: 0, hair: 'curly', hairColor: '#5b3a24', hat: 'beanie_vermelho', top: 'vest_marrom', bottom: 'shorts_marrom', shoes: 'boots_marrom', acc: null, back: 'backpack_vermelho' },
  florist: { body: 'f', skin: 1, eyes: 2, hair: 'long', hairColor: '#e8c36a', hat: 'flower_rosa', top: 'dress_amarelo', bottom: 'skirt_branco', shoes: 'sandals_rosa', acc: null, back: null },
  cynthia: { body: 'f', skin: 0, eyes: 4, hair: 'long', hairColor: '#e8c36a', hat: null, top: 'coat_preto', bottom: 'pants_preto', shoes: 'boots_preto', acc: null, back: 'cape_preto' },
};

// Equipe Galáctica: times escalam com as insígnias do jogador.
export const GALACTIC = {
  grunt: { cls: 'Recruta Galáctico', team: [41, 109, 198, 261, 23, 52, 88, 228], size: 2, base: 14, quote: 'A Equipe Galáctica vai criar um mundo novo! Saia do caminho!', defeat: 'Não acredito que perdi para uma criança...' },
  mars: { cls: 'Comandante', name: 'Mars', team: [42, 53, 110, 169], size: 3, base: 20, quote: 'Sou Mars, comandante da Equipe Galáctica. A energia deste lugar é nossa!', defeat: 'Hmpf! Você tem talento... por enquanto.' },
  saturn: { cls: 'Comandante', name: 'Saturn', team: [64, 110, 89, 82], size: 3, base: 24, quote: 'Sou Saturn. O lago guarda um segredo que o chefe deseja.', defeat: 'Interessante. Vou relatar isso ao chefe.' },
  jupiter: { cls: 'Comandante', name: 'Jupiter', team: [42, 24, 229, 89], size: 3, base: 26, quote: 'Sou Jupiter. Invadir nosso prédio foi um erro, querida criança.', defeat: 'Você é mais forte do que parece...' },
  cyrus: { cls: 'Chefe Galáctico', name: 'Cyrus', team: [198, 215, 130, 169, 229, 359], size: 4, base: 32, quote: 'Sou Cyrus. Vou criar um mundo sem espírito, perfeito. Você não vai me impedir.', defeat: '...Então este é o poder do espírito. Fascinante.' },
};

export function galacticTeam(role, badges, seed = 1) {
  const g = GALACTIC[role];
  const rng = mulberry32(seed);
  const level = Math.min(role === 'cyrus' ? 66 : 58, g.base + badges * 5);
  const n = Math.min(6, g.size + Math.floor(badges / 3));
  const pool = role === 'grunt' ? [...g.team].sort(() => rng() - 0.5) : g.team;
  return pool.slice(0, n).map((sp, i) => ({ species: evolveForLevel(sp, level + i, () => 0), level: level + i - (i < n - 1 ? 1 : 0) }));
}

// Rival: Barry escolhe o inicial com vantagem sobre o seu.
const RIVAL_STARTER = { 252: 155, 155: 7, 7: 252 };
export function rivalTeam(playerStarter, badges) {
  const level = Math.min(68, 8 + badges * 6);
  const st = RIVAL_STARTER[playerStarter] || 155;
  const extra = [16, 54, 315, 143, 214, 133];
  const n = Math.min(6, 2 + Math.floor(badges * 0.6));
  const team = extra.slice(0, n - 1).map((sp, i) => ({ species: evolveForLevel(sp, level - 2 + i, () => 0), level: level - 2 + i }));
  team.push({ species: evolveForLevel(st, level + 2, () => 0), level: level + 2 });
  return team;
}
