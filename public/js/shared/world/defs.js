// Definições do mundo: tiles, prédios, cidades, rotas e zonas (inspirado em Sinnoh).

// Coordenadas abaixo estão em "espaço de projeto" (384x288) e são escaladas por S.
export const S = 1.35;
export const W = Math.round(384 * S);
export const H = Math.round(288 * S);
export const sc = (v) => Math.round(v * S);

// ------------------------------------------------------------ tiles do mundo
export const T = {
  DEEP: 0, WATER: 1, SAND: 2, GRASS: 3, TALL: 4, PATH: 5, PAVE: 6, TREE: 7, ROCK: 8, CAVE: 9,
  SNOW: 10, SNOWTALL: 11, FLOWERS: 12, MARSH: 13, ASH: 14, LAVA: 15, BRIDGE: 16, BUILDING: 17,
  DOOR: 18, FENCE: 19, DESERT: 20, PINE: 21, BOULDER: 22, CACTUS: 23, ICE: 24, CITYGRASS: 25,
  LEDGE: 26, ASHTALL: 27, PLAZA: 28,
};

const WALK = new Set([T.SAND, T.GRASS, T.TALL, T.PATH, T.PAVE, T.CAVE, T.SNOW, T.SNOWTALL, T.FLOWERS, T.MARSH, T.ASH, T.BRIDGE, T.DOOR, T.DESERT, T.ICE, T.CITYGRASS, T.ASHTALL, T.PLAZA]);
const SURF = new Set([T.DEEP, T.WATER]);

export const isWalkable = (t) => WALK.has(t);
export const isWater = (t) => SURF.has(t);
export const isPassable = (t) => WALK.has(t) || SURF.has(t);

// habitat de encontro por tile
export function tileHabitat(t) {
  switch (t) {
    case T.TALL: case T.SNOWTALL: case T.FLOWERS: case T.MARSH: case T.ASHTALL: return 'grass';
    case T.DESERT: return 'grass';
    case T.CAVE: return 'cave';
    case T.DEEP: case T.WATER: return 'water';
    default: return null;
  }
}

// ------------------------------------------------------------ prédios
// w,h em tiles; a porta fica no centro da fileira de baixo.
export const BUILDINGS = {
  center: { w: 7, h: 5, name: 'Centro Pokémon', roof: '#e2534b', wall: '#f4efe6', sign: 'PC' },
  mart: { w: 5, h: 4, name: 'Poké Mart', roof: '#3b78d8', wall: '#f1f1ea', sign: 'MART' },
  boutique: { w: 6, h: 4, name: 'Boutique', roof: '#d55ca7', wall: '#fbeef6', sign: 'MODA' },
  furniture: { w: 6, h: 4, name: 'Loja de Móveis', roof: '#a8683a', wall: '#f6ead9', sign: 'MÓVEIS' },
  realty: { w: 5, h: 4, name: 'Imobiliária', roof: '#3f9b5a', wall: '#eef6ee', sign: 'CASAS' },
  gym: { w: 9, h: 6, name: 'Ginásio', roof: '#6b6f86', wall: '#e9e6dc', sign: 'GINÁSIO' },
  lab: { w: 9, h: 5, name: 'Laboratório do Prof. Carvalho', roof: '#7d8b97', wall: '#f7f7f2', sign: 'LAB' },
  house: { w: 4, h: 4, name: 'Casa', roof: '#c9573d', wall: '#f3e7d3' },
  house2: { w: 5, h: 4, name: 'Casa', roof: '#4f7cc2', wall: '#efe9dd' },
  plot_s: { w: 4, h: 4, name: 'Casa Pequena', roof: '#8d7a64', wall: '#efe4d2', plot: 's' },
  plot_m: { w: 5, h: 4, name: 'Casa Média', roof: '#8d7a64', wall: '#efe4d2', plot: 'm' },
  plot_l: { w: 6, h: 5, name: 'Casarão', roof: '#8d7a64', wall: '#efe4d2', plot: 'l' },
  dept: { w: 9, h: 7, name: 'Loja de Departamentos', roof: '#e0a133', wall: '#f7f0df', sign: 'LOJA' },
  league: { w: 11, h: 8, name: 'Liga Pokémon', roof: '#4c3f91', wall: '#ece7f7', sign: 'LIGA' },
  contest: { w: 8, h: 5, name: 'Salão de Concursos', roof: '#e86fa0', wall: '#fff0f6', sign: '★' },
  daycare: { w: 5, h: 4, name: 'Creche Pokémon', roof: '#e8a33d', wall: '#fff6e6', sign: 'CRECHE' },
  lighthouse: { w: 3, h: 6, name: 'Farol', roof: '#d9443c', wall: '#f5f5f5', deco: true },
  tower: { w: 6, h: 7, name: 'Torre Perdida', roof: '#5b4f73', wall: '#bdb6c9', sign: '' },
  chateau: { w: 8, h: 6, name: 'Velho Château', roof: '#3d3a4f', wall: '#9a94a8', sign: '' },
  ruins: { w: 6, h: 4, name: 'Ruínas', roof: '#9c8a6a', wall: '#c9b892', sign: '' },
  powerplant: { w: 7, h: 5, name: 'Usina do Vale', roof: '#c9a227', wall: '#e6e6e6', sign: '⚡' },
  library: { w: 6, h: 5, name: 'Biblioteca', roof: '#8a4b2f', wall: '#efe2cf', sign: 'LIVROS' },
  // condomínio de luxo (pool = colunas da piscina à esquerda; door = coluna da porta)
  mansion: { w: 9, h: 6, name: 'Mansão com Piscina', roof: '#5d6273', wall: '#f6f2ea', plot: 'x', pool: 3, door: 6 },
  mansion2: { w: 12, h: 7, name: 'Mansão de Luxo', roof: '#2f3e5c', wall: '#fbf8f2', plot: 'xl', pool: 4, door: 8 },
  luxfurniture: { w: 7, h: 5, name: 'Decor Luxo', roof: '#2c2c36', wall: '#f2ecdf', sign: 'LUXO' },
  // mecânicas do Diamond
  museum: { w: 8, h: 5, name: 'Museu de Mineração', roof: '#6b5a4c', wall: '#e9e2d4', sign: 'MUSEU' },
  battletower: { w: 7, h: 6, name: 'Torre de Batalha', roof: '#3a4a8a', wall: '#e6e8f2', sign: 'TORRE' },
  safari: { w: 7, h: 5, name: 'Zona Safári', roof: '#5a8a3a', wall: '#f2ecd2', sign: 'SAFÁRI' },
  tvstation: { w: 6, h: 5, name: 'TV Jubilife', roof: '#d8b13a', wall: '#f4f4f4', sign: 'TV' },
  galactic: { w: 8, h: 6, name: 'Prédio Galáctico', roof: '#3a4a6a', wall: '#9fb0c4', sign: 'G' },
  momhouse: { w: 5, h: 4, name: 'Casa da Mamãe', roof: '#e07a5a', wall: '#fff0dc' },
  pkmansion: { w: 10, h: 6, name: 'Mansão Pokémon', roof: '#7a2f3a', wall: '#f2e6d8', sign: '' },
  tutorhouse: { w: 5, h: 4, name: 'Casa do Tutor de Golpes', roof: '#7a52c2', wall: '#f2eefa' },
  deleterhouse: { w: 5, h: 4, name: 'Casa do Esquecedor de Golpes', roof: '#5a8ad2', wall: '#eef4fa' },
  tradehouse: { w: 4, h: 4, name: 'Casa', roof: '#c98a3a', wall: '#f6eedc' },
};

// ------------------------------------------------------------ zonas
// tier -> faixa de nível dos selvagens
export const TIER_LEVELS = {
  1: [2, 6], 2: [5, 11], 3: [10, 17], 4: [16, 24], 5: [22, 30], 6: [28, 36], 7: [34, 44], 8: [42, 55],
};

export const ZONES = [
  null,
  { id: 'r201', name: 'Rota 201', tier: 1, biomes: ['meadow'] },
  { id: 'verity', name: 'Lago Verity', tier: 1, biomes: ['lake', 'meadow'] },
  { id: 'r202', name: 'Rota 202', tier: 1, biomes: ['meadow', 'night'] },
  { id: 'r219', name: 'Rota 219', tier: 2, biomes: ['beach', 'sea'] },
  { id: 'r203', name: 'Rota 203', tier: 2, biomes: ['meadow', 'lake', 'forest'] },
  { id: 'gate', name: 'Portão de Oreburgh', tier: 2, biomes: ['cave'] },
  { id: 'r204', name: 'Rota 204', tier: 2, biomes: ['meadow', 'forest', 'night', 'lake'] },
  { id: 'r218', name: 'Rota 218', tier: 3, biomes: ['beach', 'sea'] },
  { id: 'iron', name: 'Ilha de Ferro', tier: 6, biomes: ['cave', 'fossil', 'sea'] },
  { id: 'mine', name: 'Mina de Oreburgh', tier: 3, biomes: ['cave', 'fossil'] },
  { id: 'windworks', name: 'Vale dos Moinhos', tier: 3, biomes: ['electric', 'meadow'] },
  { id: 'r205', name: 'Rota 205', tier: 3, biomes: ['meadow', 'forest', 'lake'] },
  { id: 'eforest', name: 'Floresta Eterna', tier: 3, biomes: ['forest', 'night'], dark: 0.25 },
  { id: 'r206', name: 'Rota 206', tier: 3, biomes: ['mountain', 'meadow'] },
  { id: 'r207', name: 'Rota 207', tier: 4, biomes: ['mountain', 'meadow'] },
  { id: 'coronet', name: 'Monte Coronet', tier: 5, biomes: ['cave', 'mountain', 'dragon'], dark: 0.35 },
  { id: 'r208', name: 'Rota 208', tier: 4, biomes: ['meadow', 'mountain', 'lake'] },
  { id: 'r211', name: 'Rota 211', tier: 4, biomes: ['mountain', 'forest'] },
  { id: 'r209', name: 'Rota 209', tier: 5, biomes: ['meadow', 'lake', 'night'] },
  { id: 'losttower', name: 'Torre Perdida', tier: 5, biomes: ['ghost'] },
  { id: 'r210', name: 'Rota 210', tier: 5, biomes: ['meadow', 'forest', 'night', 'mountain'], weather: 'fog' },
  { id: 'ruins', name: 'Ruínas de Solaceon', tier: 5, biomes: ['ruins'] },
  { id: 'r212', name: 'Rota 212', tier: 5, biomes: ['marsh', 'meadow', 'lake'], weather: 'rain' },
  { id: 'marsh', name: 'Grande Pântano', tier: 6, biomes: ['marsh', 'lake'] },
  { id: 'r215', name: 'Rota 215', tier: 6, biomes: ['meadow', 'forest', 'mountain'], weather: 'rain' },
  { id: 'r214', name: 'Rota 214', tier: 6, biomes: ['mountain', 'desert', 'meadow'] },
  { id: 'valor', name: 'Lago Valor', tier: 6, biomes: ['lake', 'meadow'] },
  { id: 'r213', name: 'Rota 213', tier: 6, biomes: ['beach', 'sea'] },
  { id: 'r222', name: 'Rota 222', tier: 7, biomes: ['beach', 'meadow', 'electric', 'sea'] },
  { id: 'r223', name: 'Rota 223', tier: 8, biomes: ['sea'] },
  { id: 'r216', name: 'Rota 216', tier: 7, biomes: ['snow'], weather: 'snow' },
  { id: 'r217', name: 'Rota 217', tier: 7, biomes: ['snow'], weather: 'blizzard' },
  { id: 'acuity', name: 'Lago Acuity', tier: 7, biomes: ['snow', 'lake'], weather: 'snow' },
  { id: 'desert', name: 'Deserto Rochoso', tier: 8, biomes: ['desert', 'mountain'], weather: 'sand' },
  { id: 'stark', name: 'Montanha Stark', tier: 8, biomes: ['volcano', 'cave'], weather: 'ash' },
  { id: 'victory', name: 'Caminho da Vitória', tier: 8, biomes: ['cave', 'mountain', 'dragon'] },
  { id: 'celruins', name: 'Ruínas Celestic', tier: 5, biomes: ['ruins', 'mountain'] },
  { id: 'chateau', name: 'Velho Château', tier: 3, biomes: ['ghost'] },
  { id: 'northsea', name: 'Mar do Norte', tier: 7, biomes: ['sea'] },
  { id: 'westsea', name: 'Mar do Oeste', tier: 4, biomes: ['sea'] },
  { id: 'eastsea', name: 'Mar do Leste', tier: 7, biomes: ['sea'] },
  { id: 'southsea', name: 'Mar do Sul', tier: 3, biomes: ['sea'] },
  { id: 'rcondo', name: 'Estrada Bela Vista', tier: 2, biomes: ['meadow', 'forest'] },
  { id: 'trophy', name: 'Jardim de Troféus', tier: 5, biomes: ['meadow'] },
  { id: 'safarizone', name: 'Zona Safári', tier: 6, biomes: ['marsh', 'lake'] },
  // cidades (encontros só na água próxima)
  { id: 'twinleaf', name: 'Cidade Twinleaf', tier: 1, biomes: [], city: true },
  { id: 'sandgem', name: 'Cidade Sandgem', tier: 1, biomes: ['sea'], city: true },
  { id: 'jubilife', name: 'Cidade Jubilife', tier: 2, biomes: [], city: true },
  { id: 'canalave', name: 'Cidade Canalave', tier: 3, biomes: ['sea'], city: true },
  { id: 'oreburgh', name: 'Cidade Oreburgh', tier: 2, biomes: [], city: true },
  { id: 'floaroma', name: 'Cidade Floaroma', tier: 2, biomes: [], city: true },
  { id: 'eterna', name: 'Cidade Eterna', tier: 3, biomes: [], city: true },
  { id: 'hearthome', name: 'Cidade Hearthome', tier: 4, biomes: [], city: true },
  { id: 'solaceon', name: 'Cidade Solaceon', tier: 5, biomes: [], city: true },
  { id: 'celestic', name: 'Vila Celestic', tier: 5, biomes: [], city: true },
  { id: 'veilstone', name: 'Cidade Veilstone', tier: 6, biomes: [], city: true },
  { id: 'pastoria', name: 'Cidade Pastoria', tier: 6, biomes: ['sea'], city: true },
  { id: 'sunyshore', name: 'Cidade Sunyshore', tier: 7, biomes: ['sea'], city: true },
  { id: 'snowpoint', name: 'Cidade Snowpoint', tier: 7, biomes: ['sea'], city: true },
  { id: 'league', name: 'Liga Pokémon', tier: 8, biomes: ['sea'], city: true },
  { id: 'condominio', name: 'Condomínio Bela Vista', tier: 2, biomes: [], city: true },
];
export const ZONE_INDEX = Object.fromEntries(ZONES.map((z, i) => [z ? z.id : '', i]));

// ------------------------------------------------------------ cidades
// rows: fileiras de prédios (de cima para baixo). A rua vertical passa no meio.
export const CITIES = [
  { id: 'twinleaf', name: 'Cidade Twinleaf', cx: 46, cy: 250, rows: [['momhouse', 'plot_s'], ['plot_m', 'house2']], desc: 'Uma cidade pequena e tranquila com cheiro de folhas novas.' },
  { id: 'sandgem', name: 'Cidade Sandgem', cx: 104, cy: 250, rows: [['lab', 'center'], ['mart', 'house', 'plot_s']], theme: 'beach', desc: 'Cidade litorânea onde fica o Laboratório do Professor Carvalho.' },
  { id: 'jubilife', name: 'Cidade Jubilife', cx: 102, cy: 190, rows: [['center', 'mart', 'boutique', 'tvstation'], ['furniture', 'realty', 'plot_m', 'house2'], ['plot_l', 'house', 'plot_s', 'house']], big: true, desc: 'A cidade mais moderna de Sinnoh, cheia de lojas.' },
  { id: 'canalave', name: 'Cidade Canalave', cx: 32, cy: 170, rows: [['center', 'gym'], ['library', 'mart'], ['deleterhouse', 'plot_m']], theme: 'beach', gym: 'byron', desc: 'Cidade portuária cortada por um canal.' },
  { id: 'oreburgh', name: 'Cidade Oreburgh', cx: 168, cy: 192, rows: [['center', 'gym', 'mart'], ['museum', 'plot_s', 'boutique', 'tradehouse']], theme: 'mining', gym: 'roark', desc: 'Cidade mineira que brilha com energia.' },
  { id: 'floaroma', name: 'Cidade Floaroma', cx: 96, cy: 124, rows: [['center', 'mart', 'tradehouse'], ['furniture', 'plot_m', 'house2']], theme: 'flowers', desc: 'Uma cidade coberta de flores perfumadas.' },
  { id: 'eterna', name: 'Cidade Eterna', cx: 162, cy: 84, rows: [['center', 'gym', 'mart'], ['boutique', 'tradehouse', 'plot_l'], ['plot_s', 'house2', 'furniture']], gym: 'gardenia', desc: 'Cidade histórica cercada por florestas antigas.' },
  { id: 'hearthome', name: 'Cidade Hearthome', cx: 264, cy: 190, rows: [['center', 'gym', 'contest', 'mart'], ['boutique', 'furniture', 'realty', 'tradehouse'], ['plot_l', 'house2', 'plot_m', 'daycare']], big: true, gym: 'fantina', desc: 'A cidade dos corações calorosos.' },
  { id: 'solaceon', name: 'Cidade Solaceon', cx: 284, cy: 126, rows: [['center', 'mart', 'tradehouse'], ['plot_m', 'house2', 'daycare']], desc: 'Uma cidade pacífica entre colinas.' },
  { id: 'celestic', name: 'Vila Celestic', cx: 240, cy: 86, rows: [['center', 'tradehouse', 'mart'], ['house2', 'plot_s']], theme: 'ruins', desc: 'Vila antiga que guarda as lendas de Sinnoh.' },
  { id: 'veilstone', name: 'Cidade Veilstone', cx: 322, cy: 86, rows: [['center', 'gym', 'dept'], ['galactic', 'boutique', 'plot_l', 'house2'], ['realty', 'plot_m', 'furniture']], gym: 'maylene', theme: 'rocky', desc: 'Cidade esculpida entre rochas íngremes.' },
  { id: 'pastoria', name: 'Cidade Pastoria', cx: 306, cy: 230, rows: [['center', 'gym', 'mart'], ['tutorhouse', 'plot_m', 'furniture'], ['safari']], gym: 'wake', theme: 'marsh', desc: 'Cidade ao lado do Grande Pântano.' },
  { id: 'sunyshore', name: 'Cidade Sunyshore', cx: 348, cy: 252, rows: [['center', 'gym', 'mart'], ['plot_l', 'house', 'boutique', 'lighthouse']], gym: 'volkner', theme: 'beach', desc: 'Cidade ensolarada movida a energia solar.' },
  { id: 'snowpoint', name: 'Cidade Snowpoint', cx: 200, cy: 26, rows: [['center', 'gym', 'mart'], ['tradehouse', 'plot_m', 'house2']], gym: 'candice', theme: 'snow', desc: 'Cidade gelada no extremo norte.' },
  { id: 'condominio', name: 'Condomínio Bela Vista', cx: 158, cy: 249, rows: [['center', 'luxfurniture', 'mansion'], ['mansion2', 'mansion'], ['mansion', 'mansion2']], theme: 'luxury', desc: 'Condomínio fechado de luxo: mansões com piscina para quem pode!' },
  { id: 'league', name: 'Liga Pokémon', cx: 356, cy: 120, rows: [['center', 'league', 'mart'], ['battletower']], theme: 'league', desc: 'O desafio final dos treinadores.' },
];

// ------------------------------------------------------------ rotas
// pts: pontos (o primeiro e o último podem ser âncoras de cidades "id:n|s|e|w").
export const ROUTES = [
  { zone: 'r201', pts: ['twinleaf:e', [76, 252], 'sandgem:w'] },
  { zone: 'verity', pts: ['twinleaf:n', [44, 232], [32, 230]] },
  { zone: 'r202', pts: ['sandgem:n', [104, 226], [100, 214], 'jubilife:s'] },
  { zone: 'r219', pts: ['sandgem:s', [104, 272]] },
  { zone: 'r203', pts: ['jubilife:e', [128, 190], [134, 191], [146, 190], 'oreburgh:w'] },
  { zone: 'r204', pts: ['jubilife:n', [100, 160], [98, 146], 'floaroma:s'] },
  { zone: 'r218', pts: ['jubilife:w', [64, 186], [56, 182], 'canalave:e'], bridge: true },
  { zone: 'windworks', pts: ['floaroma:e', [124, 124], [134, 128]] },
  { zone: 'r205', pts: ['floaroma:n', [98, 108], [110, 100], [124, 96], [138, 90], 'eterna:w'] },
  { zone: 'r206', pts: ['eterna:s', [164, 112], [166, 140], [168, 160], 'oreburgh:n'] },
  { zone: 'r207', pts: ['oreburgh:e', [196, 192], [204, 193]] },
  { zone: 'coronet', pts: [[204, 193], [214, 192], [222, 191]], cave: true },
  { zone: 'r208', pts: [[222, 191], [236, 190], 'hearthome:w'] },
  { zone: 'r211', pts: ['eterna:e', [192, 86], [202, 87]] },
  { zone: 'coronet', pts: [[202, 87], [212, 87], [222, 86]], cave: true },
  { zone: 'r211', pts: [[222, 86], 'celestic:w'] },
  { zone: 'coronet', pts: [[212, 87], [213, 110], [212, 140], [213, 170], [214, 192]], cave: true },
  { zone: 'coronet', pts: [[212, 87], [211, 64], [210, 52]], cave: true },
  { zone: 'r216', pts: [[210, 52], [206, 44], 'snowpoint:s'] },
  { zone: 'r217', pts: ['snowpoint:w', [176, 28], [166, 28]] },
  { zone: 'r209', pts: ['hearthome:n', [266, 168], [276, 158], [282, 146], 'solaceon:s'] },
  { zone: 'r210', pts: ['solaceon:n', [284, 106], [282, 96], [270, 92], 'celestic:e'] },
  { zone: 'r215', pts: [[282, 96], [296, 92], 'veilstone:w'] },
  { zone: 'r214', pts: ['veilstone:s', [322, 120], [324, 150], [330, 162]] },
  { zone: 'valor', pts: [[330, 162], [334, 178], [328, 190]] },
  { zone: 'r213', pts: [[328, 190], [320, 204], 'pastoria:n'] },
  { zone: 'r212', pts: ['hearthome:s', [266, 214], [272, 226], 'pastoria:w'] },
  { zone: 'r222', pts: ['pastoria:e', [330, 238], [338, 246], 'sunyshore:w'] },
  { zone: 'r223', pts: ['sunyshore:n', [356, 216], [362, 180], 'league:s'], sea: true },
  { zone: 'desert', pts: ['veilstone:n', [318, 56], [304, 40], [290, 34]] },
  { zone: 'celruins', pts: ['celestic:n', [240, 66], [242, 58]] },
  { zone: 'rcondo', pts: ['sandgem:e', [128, 252], 'condominio:w'] },
  { zone: 'rcondo', pts: ['condominio:n', [150, 226], [152, 210], 'oreburgh:s'] },
];

// ------------------------------------------------------------ áreas especiais
export const AREAS = [
  { zone: 'eforest', kind: 'forest', cx: 124, cy: 96, rx: 22, ry: 15 },
  { zone: 'verity', kind: 'lake', cx: 24, cy: 228, rx: 9, ry: 7 },
  { zone: 'valor', kind: 'lake', cx: 320, cy: 172, rx: 12, ry: 9 },
  { zone: 'acuity', kind: 'lake', cx: 160, cy: 26, rx: 8, ry: 6 },
  { zone: 'r209', kind: 'lake', cx: 290, cy: 160, rx: 5, ry: 4 },
  { zone: 'r205', kind: 'lake', cx: 82, cy: 100, rx: 6, ry: 4 },
  { zone: 'r208', kind: 'lake', cx: 240, cy: 204, rx: 5, ry: 3 },
  { zone: 'r203', kind: 'lake', cx: 120, cy: 204, rx: 4, ry: 3 },
  { zone: 'safarizone', kind: 'marsh', cx: 270, cy: 238, rx: 14, ry: 9 },
  { zone: 'trophy', kind: 'garden', cx: 252, cy: 220, rx: 7, ry: 4 },
  { zone: 'desert', kind: 'desert', cx: 300, cy: 40, rx: 34, ry: 18 },
  { zone: 'windworks', kind: 'meadow', cx: 134, cy: 130, rx: 9, ry: 7 },
  { zone: 'mine', kind: 'cave', cx: 168, cy: 216, rx: 9, ry: 5 },
  { zone: 'gate', kind: 'hill', cx: 134, cy: 191, rx: 6, ry: 12 },
  { zone: 'r206', kind: 'hill', cx: 178, cy: 136, rx: 9, ry: 16 },
  { zone: 'iron', kind: 'island', cx: 13, cy: 116, rx: 8, ry: 11 },
  { zone: 'stark', kind: 'volcano', cx: 364, cy: 38, rx: 15, ry: 20 },
  { zone: 'victory', kind: 'island', cx: 359, cy: 122, rx: 19, ry: 27 },
];

// Prédios fora das cidades
export const LANDMARKS = [
  { type: 'tower', x: 271, y: 151, zone: 'losttower', interior: 'losttower' },
  { type: 'chateau', x: 120, y: 84, zone: 'eforest', interior: 'chateau' },
  { type: 'ruins', x: 293, y: 134, zone: 'ruins', interior: 'ruins' },
  { type: 'powerplant', x: 131, y: 122, zone: 'windworks', interior: 'powerplant' },
  { type: 'ruins', x: 238, y: 56, zone: 'celruins', interior: 'celruins' },
  { type: 'pkmansion', x: 252, y: 212, zone: 'trophy', interior: 'pkmansion' },
];

// Polígono do continente (sentido horário)
export const MAINLAND = [
  [26, 96], [40, 74], [66, 60], [94, 48], [118, 34], [138, 14], [176, 8], [232, 8], [262, 14], [298, 12],
  [330, 18], [338, 40], [334, 66], [336, 92], [332, 104], [330, 132], [332, 150], [328, 168], [334, 196],
  [348, 214], [372, 226], [378, 246], [376, 272], [330, 276], [290, 268], [256, 264], [220, 270], [180, 274],
  [140, 278], [100, 280], [64, 276], [30, 270], [12, 252], [8, 230], [14, 206], [10, 186], [10, 160],
  [26, 140], [30, 124],
];

// Lendários (encontros fixos, uma vez por jogador)
export const LEGENDS = [
  { species: 144, x: 150, y: 38, level: 50, text: 'Um vento gélido sopra ao redor...' },
  { species: 145, x: 140, y: 134, level: 50, text: 'O ar está carregado de eletricidade...' },
  { species: 146, x: 364, y: 30, level: 50, text: 'Um calor intenso emana do cume...' },
  { species: 150, x: 213, y: 156, level: 70, text: 'Uma presença psíquica assustadora...' },
  { species: 151, x: 76, y: 112, level: 30, text: 'Algo pequeno e rosado flutua entre as flores...' },
  { species: 243, x: 340, y: 240, level: 40, text: 'Um trovão ecoa ao longe...' },
  { species: 244, x: 334, y: 54, level: 40, text: 'O chão está fervendo...' },
  { species: 245, x: 320, y: 172, level: 40, text: 'A água do lago está incrivelmente pura...' },
  { species: 249, x: 26, y: 100, level: 60, text: 'O mar está agitado de forma estranha...' },
  { species: 250, x: 213, y: 120, level: 60, text: 'Um brilho de arco-íris preenche a caverna...' },
  { species: 251, x: 116, y: 100, level: 30, text: 'Um santuário antigo no coração da floresta...' },
  { species: 377, x: 296, y: 48, level: 50, text: 'Pedras antigas formam um padrão estranho...' },
  { species: 378, x: 222, y: 18, level: 50, text: 'Um bloco de gelo que nunca derrete...' },
  { species: 379, x: 12, y: 112, level: 50, text: 'Um brilho metálico nas rochas...' },
  { species: 380, x: 270, y: 236, level: 45, text: 'Algo invisível se move no pântano...' },
  { species: 381, x: 22, y: 226, level: 45, text: 'Uma sombra azul paira sobre o lago...' },
  { species: 382, x: 376, y: 200, level: 60, text: 'O oceano se agita com força colossal...' },
  { species: 383, x: 316, y: 30, level: 60, text: 'A terra treme e o sol arde...' },
  { species: 384, x: 210, y: 56, level: 70, text: 'Um rugido vem dos céus...' },
  { species: 385, x: 236, y: 62, level: 30, text: 'Uma estrela parece cochilar aqui...' },
  { species: 386, x: 372, y: 140, level: 50, text: 'Um sinal estranho vindo do espaço...' },
  { species: 130, x: 312, y: 168, level: 30, shiny: true, text: 'Um Gyarados VERMELHO se agita furioso no meio do lago!' },
];

// ------------------------------------------------------------ escala para o tamanho real
for (const c of CITIES) { c.cx = sc(c.cx); c.cy = sc(c.cy); }
for (const r of ROUTES) r.pts = r.pts.map((p) => (Array.isArray(p) ? [sc(p[0]), sc(p[1])] : p));
for (const a of AREAS) { a.cx = sc(a.cx); a.cy = sc(a.cy); a.rx = sc(a.rx); a.ry = sc(a.ry); }
for (const l of LANDMARKS) { l.x = sc(l.x); l.y = sc(l.y); }
for (const l of LEGENDS) { l.x = sc(l.x); l.y = sc(l.y); }
for (const p of MAINLAND) { p[0] = sc(p[0]); p[1] = sc(p[1]); }
