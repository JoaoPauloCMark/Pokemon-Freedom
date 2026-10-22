// Móveis, pisos, papéis de parede e casas à venda.
import { CLUBS } from './clothes.js';

// art = rotina de desenho; w,h em tiles; walk = dá para pisar em cima (tapetes);
// wall = fica pendurado na parede; light = brilha à noite.
const BASE = [
  // camas
  ['cama', 'Cama de Solteiro', 'bed', 1, 2, 2500, ['vermelho', 'azul', 'verde', 'rosa', 'amarelo', 'roxo']],
  ['camacasal', 'Cama de Casal', 'bed2', 2, 2, 5500, ['vermelho', 'azul', 'branco', 'rosa', 'roxo']],
  ['camapokebola', 'Cama Poké Bola', 'pokebed', 2, 2, 9000, null],
  // mesas
  ['mesa', 'Mesa de Madeira', 'table', 2, 1, 1800, null],
  ['mesaredonda', 'Mesa Redonda', 'roundtable', 2, 2, 2400, null],
  ['mesinha', 'Mesa de Cabeceira', 'nightstand', 1, 1, 900, null],
  ['escrivaninha', 'Escrivaninha', 'desk', 2, 1, 2200, null],
  ['mesacentro', 'Mesa de Centro', 'coffeetable', 2, 1, 1500, null],
  // cadeiras e sofás
  ['cadeira', 'Cadeira', 'chair', 1, 1, 600, ['marrom', 'vermelho', 'azul', 'verde', 'branco']],
  ['banqueta', 'Banqueta', 'stool', 1, 1, 400, null],
  ['poltrona', 'Poltrona', 'armchair', 1, 1, 1600, ['vermelho', 'azul', 'verde', 'marrom', 'roxo', 'amarelo']],
  ['sofa', 'Sofá', 'sofa', 2, 1, 3200, ['vermelho', 'azul', 'verde', 'marrom', 'roxo', 'cinza', 'rosa']],
  ['sofagrande', 'Sofá Grande', 'sofa', 3, 1, 4800, ['vermelho', 'azul', 'cinza', 'marrom', 'preto']],
  // armazenamento
  ['estante', 'Estante de Livros', 'bookshelf', 2, 1, 2600, null],
  ['armario', 'Armário', 'cabinet', 2, 1, 2000, null],
  ['guardaroupa', 'Guarda-Roupa', 'wardrobe', 2, 1, 3000, null],
  ['geladeira', 'Geladeira', 'fridge', 1, 1, 3500, null],
  ['fogao', 'Fogão', 'stove', 1, 1, 2500, null],
  ['pia', 'Pia de Cozinha', 'sink', 1, 1, 1800, null],
  ['balcao', 'Balcão', 'counter', 1, 1, 1200, null],
  // eletrônicos
  ['tv', 'TV de Tela Plana', 'tv', 2, 1, 6000, null],
  ['pc', 'Computador', 'pc', 1, 1, 4500, null],
  ['videogame', 'Videogame', 'console', 1, 1, 3000, null],
  ['som', 'Aparelho de Som', 'stereo', 1, 1, 2200, null],
  // decoração
  ['vaso', 'Vaso de Planta', 'plant', 1, 1, 700, null],
  ['arvorevaso', 'Árvore no Vaso', 'bigplant', 1, 1, 1500, null],
  ['flores', 'Arranjo de Flores', 'flowers', 1, 1, 900, ['vermelho', 'amarelo', 'rosa', 'roxo', 'branco']],
  ['aquario', 'Aquário', 'aquarium', 2, 1, 7000, null],
  ['piano', 'Piano', 'piano', 2, 1, 15000, null],
  ['lareira', 'Lareira', 'fireplace', 2, 1, 8000, null],
  ['luminaria', 'Luminária de Chão', 'lamp', 1, 1, 1200, null],
  ['abajur', 'Abajur', 'smalllamp', 1, 1, 800, null],
  ['estatua', 'Estátua de Poké Bola', 'statue', 1, 1, 6500, null],
  ['trofeu', 'Troféu Dourado', 'trophy', 1, 1, 12000, null],
  ['relogio', 'Relógio de Parede', 'clock', 1, 1, 1000, null, 'wall'],
  ['quadro', 'Quadro de Paisagem', 'painting', 1, 1, 1600, null, 'wall'],
  ['poster', 'Pôster Pokémon', 'poster', 1, 1, 800, ['vermelho', 'azul', 'amarelo', 'verde'], 'wall'],
  ['janela', 'Janela Decorativa', 'window', 1, 1, 1100, null, 'wall'],
  ['tapete', 'Tapete', 'rug', 2, 2, 1400, ['vermelho', 'azul', 'verde', 'amarelo', 'roxo', 'rosa', 'cinza'], 'walk'],
  ['tapetegrande', 'Tapete Grande', 'rug', 3, 2, 2200, ['vermelho', 'azul', 'verde', 'marrom', 'roxo'], 'walk'],
  ['tapeteredondo', 'Tapete Redondo', 'roundrug', 2, 2, 1800, ['vermelho', 'azul', 'rosa', 'amarelo', 'verde'], 'walk'],
  ['tapetepokebola', 'Tapete Poké Bola', 'pokerug', 2, 2, 3000, null, 'walk'],
  // linha de luxo (Decor Luxo do Condomínio Bela Vista)
  ['jacuzzi', 'Jacuzzi', 'jacuzzi', 2, 2, 25000, null],
  ['sinuca', 'Mesa de Sinuca', 'pooltable', 3, 2, 18000, null],
  ['espreguicadeira', 'Espreguiçadeira', 'lounger', 1, 2, 4000, ['azul', 'branco', 'amarelo']],
  ['fonte', 'Fonte Decorativa', 'fountain', 2, 2, 30000, null],
  ['telao', 'Telão de Cinema', 'tv', 3, 1, 22000, null],
  ['aquariogigante', 'Aquário Gigante', 'aquarium', 3, 1, 26000, null],
  ['camaking', 'Cama King', 'bed2', 2, 2, 15000, ['dourado', 'branco', 'preto']],
  ['sofacouro', 'Sofá de Couro', 'sofa', 3, 1, 16000, ['preto', 'branco', 'marrom']],
  ['estatuadourada', 'Estátua Dourada', 'statue', 1, 1, 40000, ['dourado']],
  ['lustre', 'Lustre de Cristal', 'chandelier', 1, 1, 20000, null, 'wall'],
  ['sorveteria', 'Máquina de Sorvete', 'icecream', 1, 1, 9000, null],
  ['fliperama', 'Fliperama', 'arcade', 1, 1, 14000, null],
  ['tapetepersa', 'Tapete Persa', 'rug', 3, 2, 9000, ['dourado', 'vermelho'], 'walk'],
  // eletrônicos e games
  ['tvtubo', 'TV de Tubo', 'crt', 1, 1, 1800, null],
  ['smarttv', 'Smart TV 75"', 'tvwide', 3, 1, 18000, null],
  ['videogamepro', 'Videogame Nova Geração', 'console2', 1, 1, 6500, null],
  ['videogameretro', 'Videogame Retrô', 'retroconsole', 1, 1, 2500, null],
  ['pcgamer', 'PC Gamer', 'pcgamer', 2, 1, 14000, null],
  ['cadeiragamer', 'Cadeira Gamer', 'gamerchair', 1, 1, 3800, ['vermelho', 'azul', 'preto', 'rosa', 'verde']],
  ['notebook', 'Notebook', 'laptop', 1, 1, 5000, null],
  ['caixasom', 'Caixa de Som', 'speaker', 1, 1, 1600, null],
  ['radio', 'Rádio Antigo', 'radio', 1, 1, 1200, null],
  // cozinha e jantar
  ['microondas', 'Micro-ondas', 'microwave', 1, 1, 1500, null],
  ['cafeteira', 'Cafeteira', 'coffeemaker', 1, 1, 900, null],
  ['mesajantar', 'Mesa de Jantar', 'dining', 3, 2, 6000, null],
  ['lavalouca', 'Lava-louças', 'dishwasher', 1, 1, 3200, null],
  // banheiro e lavanderia
  ['banheira', 'Banheira', 'bathtub', 2, 1, 7000, null],
  ['vasosanitario', 'Vaso Sanitário', 'toilet', 1, 1, 1200, null],
  ['chuveiro', 'Box com Chuveiro', 'shower', 1, 1, 3500, null],
  ['piabanheiro', 'Pia de Banheiro', 'bathsink', 1, 1, 1500, null],
  ['maquinalavar', 'Máquina de Lavar', 'washer', 1, 1, 3800, null],
  ['espelhoparede', 'Espelho de Parede', 'wallmirror', 1, 1, 1400, null, 'wall'],
  // quarto
  ['beliche', 'Beliche', 'bunkbed', 1, 2, 4500, ['vermelho', 'azul', 'verde']],
  ['penteadeira', 'Penteadeira', 'vanity', 2, 1, 4200, null],
  ['comoda', 'Cômoda', 'dresser', 2, 1, 2600, null],
  ['cabideiro', 'Cabideiro', 'coatrack', 1, 1, 700, null],
  // sala e lazer
  ['pufe', 'Pufe', 'pouf', 1, 1, 800, ['vermelho', 'azul', 'verde', 'amarelo', 'rosa', 'roxo', 'cinza']],
  ['rede', 'Rede de Descanso', 'hammock', 2, 1, 2200, null],
  ['estantetrofeus', 'Estante de Troféus', 'trophycase', 2, 1, 6000, null],
  ['pingpong', 'Mesa de Ping-Pong', 'pingpong', 3, 2, 9000, null],
  ['pebolim', 'Pebolim', 'foosball', 2, 1, 7500, null],
  ['trave', 'Trave de Futebol', 'goal', 3, 1, 5000, null],
  ['bolafutebol', 'Bola de Futebol', 'soccerball', 1, 1, 300, null],
  ['piscinabolinhas', 'Piscina de Bolinhas', 'ballpit', 2, 2, 6500, null],
  ['esteira', 'Esteira de Corrida', 'treadmill', 1, 2, 8000, null],
  ['halteres', 'Halteres', 'dumbbells', 1, 1, 1200, null],
  ['sacopancada', 'Saco de Pancada', 'punchbag', 1, 1, 2800, null],
  // decoração
  ['bonsai', 'Bonsai', 'bonsai', 1, 1, 2000, null],
  ['cacto', 'Cacto no Vaso', 'cactuspot', 1, 1, 600, null],
  ['ventilador', 'Ventilador', 'fan', 1, 1, 900, null],
  ['arcondicionado', 'Ar-Condicionado', 'aircon', 1, 1, 4000, null, 'wall'],
  ['mapasinnoh', 'Mapa de Sinnoh', 'mapposter', 1, 1, 1500, null, 'wall'],
  ['quadropikachu', 'Quadro de Pikachu', 'pikaframe', 1, 1, 2500, null, 'wall'],
  ['luminarialava', 'Luminária de Lava', 'lavalamp', 1, 1, 1300, null],
  ['globo', 'Globo Terrestre', 'globe', 1, 1, 1800, null],
  ['aquarioredondo', 'Aquário Redondo', 'fishbowl', 1, 1, 1500, null],
  // tema Pokémon
  ['casinhapoke', 'Casinha de Pokémon', 'pokehouse', 1, 1, 3500, null],
  ['caminhapoke', 'Caminha de Pokémon', 'petbed', 1, 1, 1800, ['vermelho', 'azul', 'rosa', 'amarelo'], 'walk'],
  ['pufepokebola', 'Pufe Poké Bola', 'pokepouf', 1, 1, 2200, null],
  ['luminariapokebola', 'Luminária Poké Bola', 'pokelamp', 1, 1, 2400, null],
  ['relogiopokebola', 'Relógio Poké Bola', 'pokeclock', 1, 1, 1600, null, 'wall'],
];
// móveis exclusivos da loja de luxo + alguns clássicos caros que ela também vende
const LUX_ONLY = ['jacuzzi', 'sinuca', 'espreguicadeira', 'fonte', 'telao', 'aquariogigante', 'camaking', 'sofacouro', 'estatuadourada', 'lustre', 'sorveteria', 'fliperama', 'tapetepersa'];
export const LUXURY = [...LUX_ONLY, 'piano', 'lareira', 'trofeu', 'boneco_384', 'boneco_149'];

const LIGHT_ART = new Set(['lamp', 'smalllamp', 'fireplace', 'lavalamp', 'pokelamp', 'chandelier']);

const COLOR_HEX = {
  vermelho: ['Vermelho', '#d8433c'], azul: ['Azul', '#3a68c9'], verde: ['Verde', '#3f9a54'], amarelo: ['Amarelo', '#efc23a'],
  preto: ['Preto', '#3a3a42'], branco: ['Branco', '#f2f2ee'], rosa: ['Rosa', '#ef7fb3'], roxo: ['Roxo', '#7b52c2'],
  marrom: ['Marrom', '#8a5a36'], cinza: ['Cinza', '#8b8f99'], dourado: ['Dourado', '#e2b13c'],
};

export const FURNITURE = {};
for (const [id, name, art, w, h, price, colors, flag] of BASE) {
  const variants = colors ? colors.map((c) => [`${id}_${c}`, `${name} ${COLOR_HEX[c][0]}`, COLOR_HEX[c][1]]) : [[id, name, null]];
  for (const [vid, vname, color] of variants) {
    FURNITURE[vid] = { id: vid, name: vname, art, w, h, price, color, walk: flag === 'walk', wall: flag === 'wall', light: LIGHT_ART.has(art) };
  }
}

// Móveis temáticos dos times (cores do clube e escudo genérico, sem logotipos oficiais)
const CLUB_ITEMS = [
  ['cama', 'Cama', 'clubbed', 1, 2, 4500, null],
  ['tapete', 'Tapete', 'clubrug', 2, 2, 2500, 'walk'],
  ['bandeira', 'Bandeira', 'clubflag', 1, 1, 900, 'wall'],
  ['pufe', 'Pufe', 'clubpouf', 1, 1, 1500, null],
  ['quadro', 'Quadro do Escudo', 'clubcrest', 1, 1, 1200, 'wall'],
];
for (const [cid, club, pattern, colors, trim, crest] of CLUBS) {
  const of = cid === 'brasil' ? 'da Seleção Brasileira' : `do ${club}`;
  for (const [kind, name, art, w, h, price, flag] of CLUB_ITEMS) {
    const id = `${kind}_${cid}`;
    FURNITURE[id] = {
      id, name: `${name} ${of}`, art, w, h, price, color: colors[0], club: cid, pattern, colors, trim, crest,
      walk: flag === 'walk', wall: flag === 'wall', light: false,
    };
  }
}

// Bonecos de pelúcia de Pokémon (desenhados com o sprite oficial)
const DOLLS = [
  [25, 'Pikachu', 1], [1, 'Bulbasaur', 1], [4, 'Charmander', 1], [7, 'Squirtle', 1], [152, 'Chikorita', 1],
  [155, 'Cyndaquil', 1], [158, 'Totodile', 1], [252, 'Treecko', 1], [255, 'Torchic', 1], [258, 'Mudkip', 1],
  [133, 'Eevee', 1], [39, 'Jigglypuff', 1], [35, 'Clefairy', 1], [54, 'Psyduck', 1], [52, 'Meowth', 1],
  [175, 'Togepi', 1], [300, 'Skitty', 1], [183, 'Marill', 1], [172, 'Pichu', 1], [351, 'Castform', 1],
  [26, 'Raichu', 1], [37, 'Vulpix', 1], [58, 'Growlithe', 1], [77, 'Ponyta', 1], [79, 'Slowpoke', 1], [92, 'Gastly', 1],
  [94, 'Gengar', 1], [104, 'Cubone', 1], [129, 'Magikarp', 1], [147, 'Dratini', 1], [151, 'Mew', 1], [179, 'Mareep', 1],
  [194, 'Wooper', 1], [196, 'Espeon', 1], [197, 'Umbreon', 1], [201, 'Unown', 1], [280, 'Ralts', 1], [282, 'Gardevoir', 1],
  [302, 'Sableye', 1], [311, 'Plusle', 1], [312, 'Minun', 1], [334, 'Altaria', 1], [359, 'Absol', 1], [380, 'Latias', 1], [381, 'Latios', 1],
  [143, 'Snorlax', 2], [320, 'Wailmer', 2], [131, 'Lapras', 2], [149, 'Dragonite', 2], [384, 'Rayquaza', 2],
  [6, 'Charizard', 2], [9, 'Blastoise', 2], [3, 'Venusaur', 2], [150, 'Mewtwo', 2], [249, 'Lugia', 2], [250, 'Ho-Oh', 2], [382, 'Kyogre', 2], [383, 'Groudon', 2],
];
for (const [sp, name, size] of DOLLS) {
  FURNITURE[`boneco_${sp}`] = {
    id: `boneco_${sp}`, name: size > 1 ? `Boneco Gigante de ${name}` : `Boneco de ${name}`, art: 'doll', species: sp,
    w: size, h: size, price: size > 1 ? 9000 : 2000, color: null, walk: false, wall: false, light: false,
  };
}

// Categoria de cada móvel (para filtrar na loja e no modo decoração)
export const FURN_CATS = [
  ['quarto', '🛏️', 'Quarto'], ['sala', '🛋️', 'Sala'], ['cozinha', '🍳', 'Cozinha'], ['banheiro', '🛁', 'Banheiro'],
  ['eletronicos', '🎮', 'Eletrônicos e Games'], ['lazer', '🏓', 'Lazer'], ['decoracao', '🪴', 'Decoração'], ['tapetes', '🟥', 'Tapetes'],
  ['parede', '🖼️', 'Parede'], ['pokemon', '🔴', 'Pokémon'], ['times', '⚽', 'Times'], ['bonecos', '🧸', 'Bonecos'],
];
const CAT_OF_ART = {
  bed: 'quarto', bed2: 'quarto', bunkbed: 'quarto', nightstand: 'quarto', wardrobe: 'quarto', vanity: 'quarto', dresser: 'quarto', coatrack: 'quarto', cabinet: 'quarto',
  sofa: 'sala', armchair: 'sala', coffeetable: 'sala', pouf: 'sala', hammock: 'sala', bookshelf: 'sala', fireplace: 'sala', trophycase: 'sala', desk: 'sala', roundtable: 'sala',
  table: 'cozinha', chair: 'cozinha', stool: 'cozinha', fridge: 'cozinha', stove: 'cozinha', sink: 'cozinha', counter: 'cozinha', microwave: 'cozinha', coffeemaker: 'cozinha', dining: 'cozinha', dishwasher: 'cozinha',
  bathtub: 'banheiro', toilet: 'banheiro', shower: 'banheiro', bathsink: 'banheiro', washer: 'banheiro', jacuzzi: 'banheiro',
  tv: 'eletronicos', crt: 'eletronicos', tvwide: 'eletronicos', pc: 'eletronicos', console: 'eletronicos', console2: 'eletronicos', retroconsole: 'eletronicos',
  pcgamer: 'eletronicos', gamerchair: 'eletronicos', laptop: 'eletronicos', stereo: 'eletronicos', speaker: 'eletronicos', radio: 'eletronicos', arcade: 'eletronicos',
  piano: 'lazer', pooltable: 'lazer', pingpong: 'lazer', foosball: 'lazer', goal: 'lazer', soccerball: 'lazer', ballpit: 'lazer', treadmill: 'lazer', dumbbells: 'lazer',
  punchbag: 'lazer', lounger: 'lazer', fountain: 'lazer', icecream: 'lazer',
  rug: 'tapetes', roundrug: 'tapetes',
  pokebed: 'pokemon', pokerug: 'pokemon', statue: 'pokemon', pokehouse: 'pokemon', petbed: 'pokemon', pokepouf: 'pokemon', pokelamp: 'pokemon',
  clubbed: 'times', clubrug: 'times', clubflag: 'times', clubpouf: 'times', clubcrest: 'times',
  doll: 'bonecos',
};
export function furnCat(f) {
  if (f.club) return 'times';
  if (f.wall) return f.art === 'pokeclock' || f.art === 'pikaframe' ? 'pokemon' : 'parede';
  return CAT_OF_ART[f.art] || 'decoracao';
}
for (const f of Object.values(FURNITURE)) f.cat = furnCat(f);

export const FLOORS = {
  madeira: { name: 'Piso de Madeira', price: 0, a: '#c99a64', b: '#b8875a', style: 'planks' },
  madeiraescura: { name: 'Madeira Escura', price: 2500, a: '#7d5235', b: '#6c462d', style: 'planks' },
  azulejo: { name: 'Azulejo Branco', price: 2000, a: '#eceae4', b: '#d9d6cd', style: 'tiles' },
  xadrez: { name: 'Piso Xadrez', price: 3000, a: '#f1f1f1', b: '#3a3a42', style: 'checker' },
  carpeteazul: { name: 'Carpete Azul', price: 2500, a: '#5a7fc9', b: '#5076c0', style: 'carpet' },
  carpetevermelho: { name: 'Carpete Vermelho', price: 2500, a: '#c4514b', b: '#b84843', style: 'carpet' },
  carpeterosa: { name: 'Carpete Rosa', price: 2500, a: '#e893b9', b: '#df86ae', style: 'carpet' },
  grama: { name: 'Gramado Interno', price: 4000, a: '#7cc061', b: '#71b557', style: 'grass' },
  marmore: { name: 'Mármore', price: 6000, a: '#e8e4ec', b: '#d4cfdb', style: 'marble' },
  tatame: { name: 'Tatame', price: 3500, a: '#d6c98a', b: '#c4b878', style: 'tatami' },
};

export const WALLS = {
  creme: { name: 'Parede Creme', price: 0, a: '#f3e7cf', b: '#e3d4b6', style: 'plain' },
  listrado: { name: 'Papel Listrado Azul', price: 2000, a: '#cfe0f5', b: '#b7cdea', style: 'stripes' },
  rosa: { name: 'Papel Rosa', price: 2000, a: '#f8d6e6', b: '#f0c1d8', style: 'dots' },
  verde: { name: 'Papel Verde Floral', price: 2500, a: '#d4ecd0', b: '#bfdfba', style: 'floral' },
  tijolo: { name: 'Tijolinhos', price: 3000, a: '#c97b5a', b: '#b06a4b', style: 'brick' },
  madeira: { name: 'Painel de Madeira', price: 3000, a: '#b88655', b: '#a67748', style: 'planks' },
  noite: { name: 'Céu Estrelado', price: 5000, a: '#2b3266', b: '#3d4688', style: 'stars' },
  pokebola: { name: 'Papel Poké Bola', price: 4500, a: '#f4f4f4', b: '#e44b43', style: 'pokeball' },
};

// O que as lojas de móveis vendem por cidade (vazio = tudo)
export const FURNITURE_STOCK = {
  jubilife: null, floaroma: ['vaso', 'arvorevaso', 'flores', 'mesa', 'cadeira', 'tapete', 'tapeteredondo', 'cama', 'quadro', 'janela', 'mesinha', 'poltrona', 'banqueta'],
  eterna: null, hearthome: null, veilstone: null, pastoria: null,
  condominio: LUXURY,
};

export function furnitureStock(city) {
  const list = FURNITURE_STOCK[city];
  const all = Object.values(FURNITURE);
  if (!list) return all.filter((f) => !LUX_ONLY.some((b) => f.id === b || f.id.startsWith(b + '_'))).map((f) => f.id);
  return all.filter((f) => list.some((b) => f.id === b || f.id.startsWith(b + '_'))).map((f) => f.id);
}

// Tamanho do interior das casas e preço por cidade
// pool = [x, y, w, h] da piscina interna (só nas mansões)
export const HOUSE_SIZES = {
  s: { w: 10, h: 8, base: 30000 }, m: { w: 12, h: 9, base: 60000 }, l: { w: 15, h: 11, base: 120000 },
  x: { w: 18, h: 12, base: 450000, pool: [1, 6, 6, 4] }, xl: { w: 22, h: 14, base: 900000, pool: [1, 7, 8, 5] },
};
export const CITY_PRICE = {
  twinleaf: 0.8, sandgem: 0.85, jubilife: 1.2, canalave: 1, oreburgh: 0.9, floaroma: 1, eterna: 1, hearthome: 1.3,
  solaceon: 0.9, celestic: 0.8, veilstone: 1.2, pastoria: 1, sunyshore: 1.4, snowpoint: 1.1, league: 2, condominio: 1,
};
export function housePrice(city, size) {
  return Math.round((HOUSE_SIZES[size].base * (CITY_PRICE[city] || 1)) / 1000) * 1000;
}
