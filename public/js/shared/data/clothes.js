// Personalização de personagem: cabelos, peles, roupas e onde comprar.

export const SKINS = ['#ffe0c7', '#f6cfa9', '#e2b08a', '#c68d63', '#9a6644', '#6e4630'];
export const EYES = ['#3b2a20', '#2f6fb3', '#3f8f4d', '#8a5a2b', '#6b6b6b', '#9b3fb5'];
export const HAIR_COLORS = [
  ['Preto', '#2a2526'], ['Castanho', '#5b3a24'], ['Castanho Claro', '#8a5d3b'], ['Loiro', '#e8c36a'],
  ['Ruivo', '#c4502c'], ['Branco', '#ecebe6'], ['Azul', '#3a6fd1'], ['Rosa', '#f07ab7'],
  ['Verde', '#3fa66a'], ['Roxo', '#7a4bc4'], ['Laranja', '#f08a2c'], ['Cinza', '#8d8f99'],
];
export const HAIR_STYLES = [
  ['short', 'Curto'], ['spiky', 'Espetado'], ['sidepart', 'Repartido'], ['long', 'Longo'],
  ['ponytail', 'Rabo de Cavalo'], ['twintails', 'Maria-Chiquinha'], ['bob', 'Chanel'], ['bun', 'Coque'],
  ['afro', 'Black Power'], ['curly', 'Cacheado'], ['mohawk', 'Moicano'], ['buzz', 'Raspado'],
  ['wavy', 'Longo Ondulado'], ['bangs', 'Longo com Franja'], ['highponytail', 'Rabo Alto'], ['sideponytail', 'Rabo Lateral'],
  ['braid', 'Trança'], ['braids2', 'Tranças Duplas'], ['doublebun', 'Coque Duplo'], ['pixie', 'Joãozinho'],
  ['curlylong', 'Cacheado Longo'], ['hime', 'Corte Princesa'],
];

export const COLORS = [
  ['vermelho', 'Vermelho', '#d8433c'], ['azul', 'Azul', '#3a68c9'], ['verde', 'Verde', '#3f9a54'],
  ['amarelo', 'Amarelo', '#efc23a'], ['preto', 'Preto', '#2f2f36'], ['branco', 'Branco', '#f2f2ee'],
  ['rosa', 'Rosa', '#ef7fb3'], ['roxo', 'Roxo', '#7b52c2'], ['laranja', 'Laranja', '#ee8a33'],
  ['cinza', 'Cinza', '#8b8f99'], ['marrom', 'Marrom', '#7a5234'], ['celeste', 'Azul-Claro', '#71c3ec'],
];

// slot, estilo, nome, preço base, cores disponíveis (vazio = todas)
const STYLES = [
  ['hat', 'cap', 'Boné', 800, []],
  ['hat', 'beanie', 'Gorro', 900, []],
  ['hat', 'bucket', 'Chapéu Pescador', 1200, ['verde', 'marrom', 'celeste', 'amarelo', 'preto']],
  ['hat', 'sunhat', 'Chapéu de Praia', 1500, ['branco', 'amarelo', 'rosa', 'celeste']],
  ['hat', 'cowboy', 'Chapéu de Cowboy', 2500, ['marrom', 'preto', 'branco']],
  ['hat', 'beret', 'Boina', 1800, ['vermelho', 'preto', 'roxo', 'azul']],
  ['hat', 'tophat', 'Cartola', 6000, ['preto', 'roxo', 'vermelho']],
  ['hat', 'bandana', 'Bandana', 600, ['vermelho', 'azul', 'verde', 'preto', 'laranja']],
  ['hat', 'ears', 'Tiara de Orelhinhas', 3500, ['amarelo', 'rosa', 'preto', 'branco']],
  ['hat', 'flower', 'Presilha de Flor', 700, ['rosa', 'amarelo', 'vermelho', 'branco', 'roxo']],
  ['hat', 'crown', 'Coroa de Campeão', 50000, ['amarelo']],
  ['top', 'tee', 'Camiseta', 600, []],
  ['top', 'striped', 'Camiseta Listrada', 1100, []],
  ['top', 'tank', 'Regata', 500, []],
  ['top', 'hoodie', 'Moletom', 1800, []],
  ['top', 'jacket', 'Jaqueta', 2800, []],
  ['top', 'coat', 'Casaco de Inverno', 3500, ['vermelho', 'azul', 'branco', 'preto', 'roxo', 'celeste']],
  ['top', 'sweater', 'Suéter', 2000, []],
  ['top', 'dress', 'Vestido', 3000, ['vermelho', 'azul', 'rosa', 'amarelo', 'branco', 'preto', 'roxo', 'celeste']],
  ['top', 'labcoat', 'Jaleco', 2500, ['branco']],
  ['top', 'vest', 'Colete', 1500, ['marrom', 'preto', 'verde', 'laranja']],
  ['top', 'kimono', 'Quimono', 5000, ['vermelho', 'azul', 'rosa', 'roxo']],
  ['top', 'suit', 'Terno', 8000, ['preto', 'cinza', 'azul', 'branco']],
  ['bottom', 'pants', 'Calça', 900, []],
  ['bottom', 'jeans', 'Calça Jeans', 1400, ['azul', 'preto', 'celeste']],
  ['bottom', 'shorts', 'Bermuda', 700, []],
  ['bottom', 'skirt', 'Saia', 1000, []],
  ['bottom', 'longskirt', 'Saia Longa', 1600, ['preto', 'azul', 'roxo', 'branco', 'verde']],
  ['bottom', 'leggings', 'Legging', 1100, []],
  ['shoes', 'sneakers', 'Tênis', 1000, []],
  ['shoes', 'boots', 'Botas', 1800, ['marrom', 'preto', 'branco', 'vermelho']],
  ['shoes', 'sandals', 'Sandálias', 500, ['marrom', 'preto', 'rosa', 'azul']],
  ['shoes', 'formal', 'Sapato Social', 2500, ['preto', 'marrom']],
  ['acc', 'glasses', 'Óculos', 1200, ['preto', 'vermelho', 'azul', 'marrom']],
  ['acc', 'sunglasses', 'Óculos Escuros', 2000, ['preto', 'vermelho', 'rosa', 'amarelo']],
  ['acc', 'scarf', 'Cachecol', 1300, []],
  ['acc', 'necklace', 'Colar', 2500, ['amarelo', 'branco', 'roxo']],
  ['back', 'backpack', 'Mochila', 1500, []],
  ['back', 'satchel', 'Bolsa', 1300, []],
  ['back', 'cape', 'Capa', 7000, ['vermelho', 'preto', 'roxo', 'azul']],
  ['back', 'wings', 'Asinhas', 12000, ['branco', 'preto', 'rosa']],
  // ---- linha feminina (todos podem usar)
  ['hat', 'bow', 'Laço de Cabelo', 600, ['vermelho', 'rosa', 'branco', 'preto', 'azul', 'amarelo', 'roxo']],
  ['hat', 'headband', 'Tiara', 700, ['preto', 'branco', 'rosa', 'vermelho', 'azul', 'amarelo']],
  ['hat', 'hairclips', 'Presilhas', 500, ['rosa', 'amarelo', 'celeste', 'roxo', 'branco']],
  ['hat', 'sunvisor', 'Viseira', 900, ['branco', 'rosa', 'amarelo', 'celeste', 'preto']],
  ['top', 'croptop', 'Cropped', 1200, []],
  ['top', 'blouse', 'Blusa de Babado', 1600, ['branco', 'rosa', 'amarelo', 'celeste', 'vermelho', 'roxo', 'preto']],
  ['top', 'offshoulder', 'Blusa Ombro a Ombro', 1800, ['branco', 'preto', 'vermelho', 'rosa', 'amarelo', 'celeste', 'verde']],
  ['top', 'body', 'Body', 1500, ['preto', 'branco', 'rosa', 'vermelho', 'roxo', 'azul', 'marrom']],
  ['top', 'sundress', 'Vestido Florido', 2600, ['amarelo', 'rosa', 'celeste', 'branco', 'verde', 'vermelho']],
  ['top', 'longdress', 'Vestido Longo', 3800, ['vermelho', 'azul', 'preto', 'branco', 'verde', 'roxo', 'rosa']],
  ['top', 'partydress', 'Vestido de Festa', 6500, ['vermelho', 'preto', 'roxo', 'rosa', 'azul', 'amarelo']],
  ['top', 'bikini', 'Biquíni', 1400, ['vermelho', 'rosa', 'amarelo', 'celeste', 'preto', 'branco', 'verde', 'laranja', 'roxo']],
  ['top', 'swimsuit', 'Maiô', 1800, ['preto', 'vermelho', 'azul', 'rosa', 'amarelo', 'branco', 'verde']],
  ['bottom', 'shortshorts', 'Shortinho', 800, []],
  ['bottom', 'denimshorts', 'Short Jeans', 1200, ['azul', 'celeste', 'preto', 'branco']],
  ['bottom', 'bikinibottom', 'Calcinha de Biquíni', 900, ['vermelho', 'rosa', 'amarelo', 'celeste', 'preto', 'branco', 'verde', 'laranja', 'roxo']],
  ['bottom', 'miniskirt', 'Minissaia', 1200, []],
  ['bottom', 'pleated', 'Saia Plissada', 1500, ['preto', 'azul', 'vermelho', 'cinza', 'rosa', 'branco']],
  ['bottom', 'flare', 'Calça Flare', 1800, ['azul', 'preto', 'branco', 'marrom', 'celeste']],
  ['shoes', 'heels', 'Salto Alto', 2800, ['preto', 'vermelho', 'branco', 'rosa', 'amarelo']],
  ['shoes', 'flats', 'Sapatilha', 1200, ['preto', 'rosa', 'vermelho', 'branco', 'azul', 'amarelo']],
  ['shoes', 'platform', 'Tênis Plataforma', 2400, ['branco', 'preto', 'rosa', 'celeste']],
  ['shoes', 'kneeboots', 'Bota Cano Alto', 3200, ['preto', 'marrom', 'branco', 'vermelho']],
  ['shoes', 'flipflops', 'Chinelo', 300, ['azul', 'amarelo', 'verde', 'rosa', 'preto', 'branco']],
  ['acc', 'earrings', 'Brincos', 900, ['amarelo', 'branco', 'rosa', 'celeste', 'vermelho']],
  ['acc', 'pearls', 'Colar de Pérolas', 4500, ['branco', 'rosa']],
  ['acc', 'choker', 'Gargantilha', 800, ['preto', 'branco', 'rosa', 'vermelho', 'roxo']],
  ['acc', 'bracelets', 'Pulseiras', 700, ['amarelo', 'rosa', 'celeste', 'verde', 'roxo', 'branco']],
  ['acc', 'cateye', 'Óculos Gatinho', 2200, ['preto', 'rosa', 'vermelho', 'branco']],
  ['back', 'handbag', 'Bolsa de Mão', 2000, ['preto', 'vermelho', 'rosa', 'branco', 'marrom', 'amarelo']],
];

export const SLOT_PT = { hat: 'Chapéu', top: 'Parte de Cima', bottom: 'Parte de Baixo', shoes: 'Calçado', acc: 'Acessório', back: 'Costas' };

// Concordância das cores com a peça: [masculino, feminino, masc. plural, fem. plural]
const COLOR_FORMS = {
  vermelho: ['Vermelho', 'Vermelha', 'Vermelhos', 'Vermelhas'], azul: ['Azul', 'Azul', 'Azuis', 'Azuis'],
  verde: ['Verde', 'Verde', 'Verdes', 'Verdes'], amarelo: ['Amarelo', 'Amarela', 'Amarelos', 'Amarelas'],
  preto: ['Preto', 'Preta', 'Pretos', 'Pretas'], branco: ['Branco', 'Branca', 'Brancos', 'Brancas'],
  rosa: ['Rosa', 'Rosa', 'Rosa', 'Rosa'], roxo: ['Roxo', 'Roxa', 'Roxos', 'Roxas'],
  laranja: ['Laranja', 'Laranja', 'Laranja', 'Laranja'], cinza: ['Cinza', 'Cinza', 'Cinza', 'Cinza'],
  marrom: ['Marrom', 'Marrom', 'Marrons', 'Marrons'], celeste: ['Azul-Claro', 'Azul-Clara', 'Azul-Claros', 'Azul-Claras'],
};
// gênero/número do nome de cada estilo (padrão: masculino singular)
const STYLE_FORM = {
  beret: 1, tophat: 1, bandana: 1, ears: 1, flower: 1, crown: 1, tee: 1, striped: 1, tank: 1, jacket: 1,
  pants: 1, jeans: 1, shorts: 1, skirt: 1, longskirt: 1, leggings: 1, backpack: 1, satchel: 1, cape: 1,
  glasses: 2, sunglasses: 2, boots: 3, sandals: 3, wings: 3,
  headband: 1, hairclips: 3, sunvisor: 1, blouse: 1, offshoulder: 1, sundress: 0, longdress: 0, partydress: 0,
  denimshorts: 0, miniskirt: 1, pleated: 1, flare: 1, shortshorts: 0, flats: 1, kneeboots: 1,
  earrings: 2, pearls: 0, choker: 1, bracelets: 3, cateye: 2, handbag: 1, bikinibottom: 1,
};

// Nome do modelo (sem a cor), usado nos botões de escolha
export const STYLE_NAMES = {
  cap2: 'Boné Bicolor', cargo: 'Calça Cargo', trackpants: 'Calça de Agasalho', runners: 'Tênis Esportivo',
  wristbands: 'Munhequeiras', jersey: 'Camisa de Time',
};
for (const [, style, name] of STYLES) STYLE_NAMES[style] = name;

export const CLOTHES = {};
for (const [slot, style, name, price, colors] of STYLES) {
  const list = colors.length ? COLORS.filter((c) => colors.includes(c[0])) : COLORS;
  for (const [cid, , hex] of list) {
    const label = list.length === 1 && style === 'crown' ? name : `${name} ${COLOR_FORMS[cid][STYLE_FORM[style] || 0]}`;
    CLOTHES[`${style}_${cid}`] = { id: `${style}_${cid}`, slot, style, name: label, color: hex, price };
  }
}

// Peças extras com duas cores (inspiradas no visual "streetwear" de treinador)
const EXTRA = [
  // id, slot, style, nome, cor principal, cor secundária, preço
  ['cargo_preto', 'bottom', 'cargo', 'Calça Cargo Preta', '#262629', '#f2f2ee', 2200],
  ['cargo_verde', 'bottom', 'cargo', 'Calça Cargo Verde', '#4f5b3a', '#2a2e22', 2200],
  ['cargo_bege', 'bottom', 'cargo', 'Calça Cargo Bege', '#c2a878', '#8a7350', 2200],
  ['cargo_cinza', 'bottom', 'cargo', 'Calça Cargo Cinza', '#6e7079', '#2f2f36', 2200],
  ['trackpants_preto', 'bottom', 'trackpants', 'Calça de Agasalho Preta', '#262629', '#f2f2ee', 1800],
  ['trackpants_azul', 'bottom', 'trackpants', 'Calça de Agasalho Azul', '#2c4f9e', '#f2f2ee', 1800],
  ['trackpants_vermelho', 'bottom', 'trackpants', 'Calça de Agasalho Vermelha', '#b8262c', '#f2f2ee', 1800],
  ['trackpants_verde', 'bottom', 'trackpants', 'Calça de Agasalho Verde', '#1f6b3a', '#f2f2ee', 1800],
  ['runners_pretobranco', 'shoes', 'runners', 'Tênis Esportivo Preto e Branco', '#262629', '#f2f2ee', 3000],
  ['runners_branco', 'shoes', 'runners', 'Tênis Esportivo Branco', '#f2f2ee', '#8b8f99', 3000],
  ['runners_vermelho', 'shoes', 'runners', 'Tênis Esportivo Vermelho', '#c8262c', '#f2f2ee', 3000],
  ['runners_azul', 'shoes', 'runners', 'Tênis Esportivo Azul', '#2c4f9e', '#f2f2ee', 3000],
  ['cap2_pretobranco', 'hat', 'cap2', 'Boné Bicolor Preto e Branco', '#1f1f22', '#f2f2ee', 1500],
  ['cap2_vermelhobranco', 'hat', 'cap2', 'Boné Bicolor Vermelho e Branco', '#c8262c', '#f2f2ee', 1500],
  ['cap2_azulbranco', 'hat', 'cap2', 'Boné Bicolor Azul e Branco', '#2c4f9e', '#f2f2ee', 1500],
  ['cap2_verdebranco', 'hat', 'cap2', 'Boné Bicolor Verde e Branco', '#1f6b3a', '#f2f2ee', 1500],
  ['wristbands_preto', 'acc', 'wristbands', 'Munhequeiras Pretas', '#1f1f22', '#1f1f22', 600],
  ['wristbands_branco', 'acc', 'wristbands', 'Munhequeiras Brancas', '#f2f2ee', '#f2f2ee', 600],
  ['wristbands_vermelho', 'acc', 'wristbands', 'Munhequeiras Vermelhas', '#c8262c', '#c8262c', 600],
];
for (const [id, slot, style, name, color, color2, price] of EXTRA) CLOTHES[id] = { id, slot, style, name, color, color2, price };

// Camisas dos grandes clubes do futebol brasileiro (e a Seleção).
// pattern: solid | vstripes | hstripes | vstripes3 | hstripes3 | sash | chestbands
// colors: cores do padrão; trim: gola/punhos; crest: [fundo, detalhe] do escudo (genérico, sem logotipo oficial)
export const CLUBS = [
  ['atleticomg', 'Atlético-MG', 'vstripes', ['#1c1c1c', '#f4f4f4'], '#1c1c1c', ['#f4f4f4', '#1c1c1c']],
  ['corinthians', 'Corinthians', 'solid', ['#f4f4f4'], '#1c1c1c', ['#1c1c1c', '#f4f4f4']],
  ['palmeiras', 'Palmeiras', 'solid', ['#0b6b3a'], '#f4f4f4', ['#f4f4f4', '#0b6b3a']],
  ['saopaulo', 'São Paulo', 'chestbands', ['#f4f4f4', '#d9262c', '#1c1c1c'], '#1c1c1c', ['#d9262c', '#f4f4f4']],
  ['santos', 'Santos', 'solid', ['#f4f4f4'], '#1c1c1c', ['#1c1c1c', '#f4f4f4']],
  ['flamengo', 'Flamengo', 'hstripes', ['#c8102e', '#1c1c1c'], '#1c1c1c', ['#1c1c1c', '#c8102e']],
  ['fluminense', 'Fluminense', 'vstripes3', ['#7a1f2b', '#f4f4f4', '#0b6b3a'], '#f4f4f4', ['#f4f4f4', '#7a1f2b']],
  ['vasco', 'Vasco da Gama', 'sash', ['#1c1c1c', '#f4f4f4'], '#f4f4f4', ['#f4f4f4', '#d9262c']],
  ['botafogo', 'Botafogo', 'vstripes', ['#1c1c1c', '#f4f4f4'], '#1c1c1c', ['#1c1c1c', '#f4f4f4']],
  ['gremio', 'Grêmio', 'vstripes3', ['#0d80bf', '#1c1c1c', '#f4f4f4'], '#1c1c1c', ['#0d80bf', '#f4f4f4']],
  ['internacional', 'Internacional', 'solid', ['#d9262c'], '#f4f4f4', ['#f4f4f4', '#d9262c']],
  ['cruzeiro', 'Cruzeiro', 'solid', ['#1f4fb4'], '#f4f4f4', ['#f4f4f4', '#1f4fb4']],
  ['bahia', 'Bahia', 'chestbands', ['#f4f4f4', '#1f4fb4', '#d9262c'], '#1f4fb4', ['#1f4fb4', '#d9262c']],
  ['athleticopr', 'Athletico-PR', 'hstripes', ['#d9262c', '#1c1c1c'], '#1c1c1c', ['#1c1c1c', '#d9262c']],
  ['fortaleza', 'Fortaleza', 'hstripes3', ['#1f4fb4', '#d9262c', '#f4f4f4'], '#1f4fb4', ['#d9262c', '#1f4fb4']],
  ['sport', 'Sport Recife', 'hstripes', ['#d9262c', '#1c1c1c'], '#efc23a', ['#1c1c1c', '#efc23a']],
  ['brasil', 'Seleção Brasileira', 'solid', ['#f6d32d'], '#1e8a3c', ['#1f4fb4', '#f6d32d']],
];
for (const [cid, club, pattern, colors, trim, crest] of CLUBS) {
  CLOTHES[`camisa_${cid}`] = {
    id: `camisa_${cid}`, slot: 'top', style: 'jersey', club, pattern, colors, trim, crest,
    name: cid === 'brasil' ? 'Camisa da Seleção Brasileira' : `Camisa do ${club}`,
    color: colors[0], price: cid === 'brasil' ? 3500 : 2800,
  };
}
export const JERSEYS = CLUBS.map(([cid]) => `camisa_${cid}`);

// Modelos que dá para escolher ao criar o personagem (o resto, como as camisas de
// time, só é vendido nas Boutiques)
export const CREATOR_STYLES = [
  'cap', 'beanie', 'bucket', 'bandana', 'flower', 'cap2',
  'tee', 'striped', 'tank', 'hoodie', 'sweater', 'jacket', 'dress',
  'pants', 'jeans', 'shorts', 'skirt', 'leggings', 'cargo', 'trackpants',
  'sneakers', 'boots', 'sandals', 'runners', 'glasses', 'scarf', 'wristbands', 'backpack', 'satchel',
  // linha feminina
  'bow', 'headband', 'hairclips', 'sunvisor', 'croptop', 'blouse', 'offshoulder', 'body', 'sundress', 'longdress', 'bikini', 'swimsuit',
  'shortshorts', 'denimshorts', 'bikinibottom', 'miniskirt', 'pleated', 'flare', 'flats', 'platform', 'kneeboots', 'heels', 'flipflops',
  'earrings', 'choker', 'bracelets', 'cateye', 'handbag',
];

// Roupas iniciais (ganhas na criação do personagem)
export const STARTER_CLOTHES = [
  'cap_vermelho', 'cap_azul', 'beanie_branco', 'tee_vermelho', 'tee_azul', 'tee_branco', 'tee_preto',
  'hoodie_verde', 'pants_preto', 'pants_azul', 'shorts_azul', 'skirt_rosa', 'skirt_preto',
  'sneakers_vermelho', 'sneakers_preto', 'sneakers_branco', 'backpack_amarelo', 'backpack_vermelho',
];

// O que cada boutique vende (estilos). Todas vendem o básico.
const BASIC_STYLES = ['cap', 'tee', 'pants', 'shorts', 'skirt', 'sneakers', 'backpack', 'cap2', 'cargo', 'trackpants', 'runners', 'wristbands',
  'croptop', 'shortshorts', 'miniskirt', 'bow', 'hairclips', 'flats', 'flipflops', 'bracelets'];
export const BOUTIQUE_STYLES = {
  jubilife: [...BASIC_STYLES, 'hoodie', 'striped', 'jeans', 'leggings', 'glasses', 'satchel', 'beret', 'body', 'platform', 'choker', 'denimshorts', 'headband', 'blouse'],
  oreburgh: [...BASIC_STYLES, 'bandana', 'vest', 'boots', 'cowboy', 'jacket', 'labcoat', 'flare', 'denimshorts'],
  eterna: [...BASIC_STYLES, 'bucket', 'cowboy', 'flower', 'longskirt', 'sweater', 'sandals', 'scarf', 'sundress', 'blouse', 'headband', 'pleated', 'flare'],
  hearthome: [...BASIC_STYLES, 'dress', 'tophat', 'beret', 'cape', 'kimono', 'suit', 'formal', 'necklace', 'ears', 'partydress', 'longdress', 'heels', 'pearls', 'earrings', 'cateye', 'handbag', 'offshoulder', 'body'],
  veilstone: [...BASIC_STYLES, 'hoodie', 'jacket', 'leggings', 'tank', 'sunglasses', 'ears', 'wings', 'kneeboots', 'choker', 'platform', 'offshoulder'],
  sunyshore: [...BASIC_STYLES, 'sunhat', 'tank', 'sandals', 'sunglasses', 'bucket', 'necklace', 'bikini', 'bikinibottom', 'swimsuit', 'sunvisor', 'denimshorts'],
  snowpoint: [...BASIC_STYLES, 'beanie', 'coat', 'scarf', 'boots', 'sweater', 'kneeboots', 'pleated'],
  league: ['crown', 'cape', 'suit', 'wings', 'tophat'],
};

export function boutiqueStock(city) {
  const styles = BOUTIQUE_STYLES[city] || BASIC_STYLES;
  // as camisas de time são vendidas em todas as boutiques
  return Object.values(CLOTHES).filter((c) => styles.includes(c.style) || c.style === 'jersey').map((c) => c.id);
}

export const DEFAULT_LOOK = {
  body: 'm', skin: 1, eyes: 0, hair: 'short', hairColor: '#5b3a24',
  hat: 'cap_vermelho', top: 'tee_vermelho', bottom: 'pants_preto', shoes: 'sneakers_vermelho', acc: null, back: 'backpack_amarelo',
};

// Visual aleatório (NPCs e treinadores)
export function randomLook(rng = Math.random, female = rng() < 0.5) {
  const pick = (a) => a[Math.floor(rng() * a.length)];
  const of = (slot, styles) => {
    const opts = Object.values(CLOTHES).filter((c) => c.slot === slot && (!styles || styles.includes(c.style)));
    return pick(opts).id;
  };
  const hairs = female
    ? ['long', 'ponytail', 'twintails', 'bob', 'bun', 'curly', 'afro', 'wavy', 'bangs', 'highponytail', 'sideponytail', 'braid', 'braids2', 'doublebun', 'pixie', 'curlylong', 'hime']
    : ['short', 'spiky', 'sidepart', 'buzz', 'curly', 'afro', 'mohawk'];
  return {
    body: female ? 'f' : 'm',
    skin: Math.floor(rng() * SKINS.length),
    eyes: Math.floor(rng() * EYES.length),
    hair: pick(hairs),
    hairColor: pick(HAIR_COLORS.slice(0, rng() < 0.85 ? 6 : 12))[1],
    hat: rng() < 0.45 ? of('hat', female ? ['cap', 'beanie', 'bucket', 'sunhat', 'beret', 'flower', 'bow', 'headband', 'hairclips', 'sunvisor'] : ['cap', 'beanie', 'bucket', 'sunhat', 'bandana', 'beret', 'cap2']) : null,
    top: of('top', female ? ['tee', 'striped', 'hoodie', 'dress', 'sweater', 'tank', 'jacket', 'croptop', 'blouse', 'offshoulder', 'sundress', 'longdress', 'body'] : ['tee', 'striped', 'hoodie', 'jacket', 'sweater', 'tank', 'vest']),
    bottom: of('bottom', female ? ['skirt', 'pants', 'shorts', 'jeans', 'leggings', 'shortshorts', 'denimshorts', 'miniskirt', 'pleated', 'flare'] : ['pants', 'jeans', 'shorts', 'cargo', 'trackpants']),
    shoes: of('shoes', female ? ['sneakers', 'boots', 'sandals', 'runners', 'flats', 'platform', 'kneeboots', 'heels'] : ['sneakers', 'boots', 'sandals', 'formal', 'runners', 'flipflops']),
    acc: rng() < 0.25 ? of('acc', female ? ['glasses', 'scarf', 'sunglasses', 'earrings', 'bracelets', 'choker', 'cateye'] : ['glasses', 'scarf', 'sunglasses', 'wristbands']) : null,
    back: rng() < 0.4 ? of('back', female ? ['backpack', 'satchel', 'handbag'] : ['backpack', 'satchel']) : null,
  };
}
