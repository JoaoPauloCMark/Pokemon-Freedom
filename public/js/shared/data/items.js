// Itens do jogo. "sprite" = nome do arquivo em PokeAPI/sprites/items.
// pocket: 'balls' | 'medicine' | 'items' | 'tms' | 'key'

export const ITEMS = {
  // ---------------------------------------------------------------- bolas
  pokebola: { name: 'Poké Bola', pocket: 'balls', price: 200, sprite: 'poke-ball', ball: 1, desc: 'Uma bola para capturar Pokémon selvagens.' },
  grandebola: { name: 'Grande Bola', pocket: 'balls', price: 600, sprite: 'great-ball', ball: 1.5, desc: 'Bola de alto desempenho, melhor que a Poké Bola.' },
  ultrabola: { name: 'Ultra Bola', pocket: 'balls', price: 1200, sprite: 'ultra-ball', ball: 2, desc: 'Bola de altíssimo desempenho.' },
  masterbola: { name: 'Master Bola', pocket: 'balls', price: 0, sprite: 'master-ball', ball: 255, desc: 'Captura qualquer Pokémon sem falhar.' },
  redebola: { name: 'Rede Bola', pocket: 'balls', price: 1000, sprite: 'net-ball', ball: 'net', desc: 'Funciona muito bem em Pokémon de Água e Inseto.' },
  mergulhobola: { name: 'Mergulho Bola', pocket: 'balls', price: 1000, sprite: 'dive-ball', ball: 'dive', desc: 'Eficaz em Pokémon encontrados na água.' },
  ninhobola: { name: 'Ninho Bola', pocket: 'balls', price: 1000, sprite: 'nest-ball', ball: 'nest', desc: 'Melhor quanto menor o nível do Pokémon.' },
  repetebola: { name: 'Repete Bola', pocket: 'balls', price: 1000, sprite: 'repeat-ball', ball: 'repeat', desc: 'Eficaz em espécies que você já capturou.' },
  tempobola: { name: 'Tempo Bola', pocket: 'balls', price: 1000, sprite: 'timer-ball', ball: 'timer', desc: 'Fica melhor quanto mais longa a batalha.' },
  crepusculobola: { name: 'Crepúsculo Bola', pocket: 'balls', price: 1000, sprite: 'dusk-ball', ball: 'dusk', desc: 'Eficaz à noite e em cavernas.' },
  rapidabola: { name: 'Rápida Bola', pocket: 'balls', price: 1000, sprite: 'quick-ball', ball: 'quick', desc: 'Muito eficaz se usada no primeiro turno.' },
  luxobola: { name: 'Luxo Bola', pocket: 'balls', price: 1000, sprite: 'luxury-ball', ball: 1, friend: true, desc: 'Pokémon capturados ficam amigos mais rápido.' },
  curabola: { name: 'Cura Bola', pocket: 'balls', price: 300, sprite: 'heal-ball', ball: 1, heals: true, desc: 'Cura totalmente o Pokémon capturado.' },
  premierbola: { name: 'Premier Bola', pocket: 'balls', price: 200, sprite: 'premier-ball', ball: 1, desc: 'Uma bola comemorativa rara.' },

  // ---------------------------------------------------------------- remédios
  pocao: { name: 'Poção', pocket: 'medicine', price: 300, sprite: 'potion', heal: 20, desc: 'Restaura 20 PS de um Pokémon.' },
  superpocao: { name: 'Super Poção', pocket: 'medicine', price: 700, sprite: 'super-potion', heal: 50, desc: 'Restaura 50 PS de um Pokémon.' },
  hiperpocao: { name: 'Hiper Poção', pocket: 'medicine', price: 1200, sprite: 'hyper-potion', heal: 200, desc: 'Restaura 200 PS de um Pokémon.' },
  pocaomaxima: { name: 'Poção Máxima', pocket: 'medicine', price: 2500, sprite: 'max-potion', heal: 9999, desc: 'Restaura todos os PS de um Pokémon.' },
  restauracao: { name: 'Restauração Total', pocket: 'medicine', price: 3000, sprite: 'full-restore', heal: 9999, cure: 'all', desc: 'Restaura todos os PS e cura qualquer problema.' },
  aguafresca: { name: 'Água Fresca', pocket: 'medicine', price: 200, sprite: 'fresh-water', heal: 50, desc: 'Água mineral. Restaura 50 PS.' },
  refrigerante: { name: 'Refrigerante', pocket: 'medicine', price: 300, sprite: 'soda-pop', heal: 60, desc: 'Refrigerante gaseificado. Restaura 60 PS.' },
  limonada: { name: 'Limonada', pocket: 'medicine', price: 350, sprite: 'lemonade', heal: 80, desc: 'Limonada bem doce. Restaura 80 PS.' },
  leitemoomoo: { name: 'Leite Moomoo', pocket: 'medicine', price: 500, sprite: 'moomoo-milk', heal: 100, desc: 'Leite nutritivo. Restaura 100 PS.' },
  reviver: { name: 'Reviver', pocket: 'medicine', price: 1500, sprite: 'revive', revive: 0.5, desc: 'Revive um Pokémon desmaiado com metade dos PS.' },
  revivermax: { name: 'Reviver Máximo', pocket: 'medicine', price: 4000, sprite: 'max-revive', revive: 1, desc: 'Revive um Pokémon desmaiado com todos os PS.' },
  antidoto: { name: 'Antídoto', pocket: 'medicine', price: 100, sprite: 'antidote', cure: 'psn', desc: 'Cura um Pokémon envenenado.' },
  antiparalisia: { name: 'Antiparalisia', pocket: 'medicine', price: 200, sprite: 'paralyze-heal', cure: 'par', desc: 'Cura um Pokémon paralisado.' },
  despertar: { name: 'Despertar', pocket: 'medicine', price: 250, sprite: 'awakening', cure: 'slp', desc: 'Acorda um Pokémon adormecido.' },
  antiqueimadura: { name: 'Antiqueimadura', pocket: 'medicine', price: 250, sprite: 'burn-heal', cure: 'brn', desc: 'Cura uma queimadura.' },
  antigelo: { name: 'Antigelo', pocket: 'medicine', price: 250, sprite: 'ice-heal', cure: 'frz', desc: 'Descongela um Pokémon.' },
  curatotal: { name: 'Cura Total', pocket: 'medicine', price: 600, sprite: 'full-heal', cure: 'all', desc: 'Cura qualquer problema de estado.' },
  eter: { name: 'Éter', pocket: 'medicine', price: 1200, sprite: 'ether', pp: 10, desc: 'Restaura 10 PP de um golpe.' },
  etermax: { name: 'Éter Máximo', pocket: 'medicine', price: 2000, sprite: 'max-ether', pp: 99, desc: 'Restaura todos os PP de um golpe.' },
  elixir: { name: 'Elixir', pocket: 'medicine', price: 3000, sprite: 'elixir', pp: 10, allPp: true, desc: 'Restaura 10 PP de todos os golpes.' },
  elixirmax: { name: 'Elixir Máximo', pocket: 'medicine', price: 4500, sprite: 'max-elixir', pp: 99, allPp: true, desc: 'Restaura todos os PP de todos os golpes.' },
  docerarro: { name: 'Doce Raro', pocket: 'medicine', price: 4800, sprite: 'rare-candy', candy: true, desc: 'Aumenta o nível de um Pokémon em 1.' },
  biscoito: { name: 'Biscoito Poké', pocket: 'medicine', price: 400, sprite: 'oran-berry', friend: 40, desc: 'Um petisco gostoso. Aumenta muito a amizade.' },
  proteina: { name: 'Proteína', pocket: 'medicine', price: 9800, sprite: 'protein', vitamin: 1, desc: 'Aumenta o Ataque base de um Pokémon.' },
  ferro: { name: 'Ferro', pocket: 'medicine', price: 9800, sprite: 'iron', vitamin: 2, desc: 'Aumenta a Defesa base de um Pokémon.' },
  calcio: { name: 'Cálcio', pocket: 'medicine', price: 9800, sprite: 'calcium', vitamin: 3, desc: 'Aumenta o Ataque Especial base.' },
  zinco: { name: 'Zinco', pocket: 'medicine', price: 9800, sprite: 'zinc', vitamin: 4, desc: 'Aumenta a Defesa Especial base.' },
  carbos: { name: 'Carbos', pocket: 'medicine', price: 9800, sprite: 'carbos', vitamin: 5, desc: 'Aumenta a Velocidade base.' },
  hpup: { name: 'PS Extra', pocket: 'medicine', price: 9800, sprite: 'hp-up', vitamin: 0, desc: 'Aumenta os PS base de um Pokémon.' },

  // ---------------------------------------------------------------- itens gerais
  repelente: { name: 'Repelente', pocket: 'items', price: 350, sprite: 'repel', repel: 100, desc: 'Afasta Pokémon selvagens fracos por 100 passos.' },
  superrepelente: { name: 'Super Repelente', pocket: 'items', price: 500, sprite: 'super-repel', repel: 200, desc: 'Afasta Pokémon selvagens fracos por 200 passos.' },
  repelentemax: { name: 'Repelente Máximo', pocket: 'items', price: 700, sprite: 'max-repel', repel: 250, desc: 'Afasta Pokémon selvagens fracos por 250 passos.' },
  cordadefuga: { name: 'Corda de Fuga', pocket: 'items', price: 550, sprite: 'escape-rope', escape: true, desc: 'Leva você de volta ao último Centro Pokémon visitado.' },
  pedrafogo: { name: 'Pedra do Fogo', pocket: 'items', price: 2100, sprite: 'fire-stone', evo: true, desc: 'Faz certos Pokémon evoluírem.' },
  pedraagua: { name: 'Pedra da Água', pocket: 'items', price: 2100, sprite: 'water-stone', evo: true, desc: 'Faz certos Pokémon evoluírem.' },
  pedratrovao: { name: 'Pedra do Trovão', pocket: 'items', price: 2100, sprite: 'thunder-stone', evo: true, desc: 'Faz certos Pokémon evoluírem.' },
  pedrafolha: { name: 'Pedra da Folha', pocket: 'items', price: 2100, sprite: 'leaf-stone', evo: true, desc: 'Faz certos Pokémon evoluírem.' },
  pedralua: { name: 'Pedra da Lua', pocket: 'items', price: 2100, sprite: 'moon-stone', evo: true, desc: 'Faz certos Pokémon evoluírem.' },
  pedrasol: { name: 'Pedra do Sol', pocket: 'items', price: 2100, sprite: 'sun-stone', evo: true, desc: 'Faz certos Pokémon evoluírem.' },
  pedradorei: { name: 'Pedra do Rei', pocket: 'items', price: 3000, sprite: 'kings-rock', evo: true, desc: 'Evolui Poliwhirl e Slowpoke.' },
  revestimentometal: { name: 'Revestimento Metálico', pocket: 'items', price: 3000, sprite: 'metal-coat', evo: true, desc: 'Evolui Onix e Scyther.' },
  escamadragao: { name: 'Escama de Dragão', pocket: 'items', price: 3000, sprite: 'dragon-scale', evo: true, desc: 'Evolui Seadra.' },
  upgrade: { name: 'Upgrade', pocket: 'items', price: 3000, sprite: 'up-grade', evo: true, desc: 'Evolui Porygon.' },
  dentemarinho: { name: 'Dente Marinho', pocket: 'items', price: 3000, sprite: 'deep-sea-tooth', evo: true, desc: 'Evolui Clamperl em Huntail.' },
  escamamarinha: { name: 'Escama Marinha', pocket: 'items', price: 3000, sprite: 'deep-sea-scale', evo: true, desc: 'Evolui Clamperl em Gorebyss.' },
  escamaprisma: { name: 'Escama Prisma', pocket: 'items', price: 3000, sprite: 'prism-scale', evo: true, desc: 'Evolui Feebas em Milotic.' },
  cabodeconexao: { name: 'Cabo de Conexão', pocket: 'items', price: 3000, sprite: 'linking-cord', evo: true, desc: 'Evolui Pokémon que só evoluem por troca.' },

  mel: { name: 'Mel', pocket: 'items', price: 300, sprite: 'honey', honey: true, desc: 'Passe numa árvore de mel dourada e volte depois: um Pokémon pode aparecer!' },

  // ---------------------------------------------------------------- frutas
  oran: { name: 'Fruta Oran', pocket: 'berries', price: 200, sprite: 'oran-berry', heal: 10, desc: 'Restaura 10 PS. Dá para colher nas árvores das rotas.' },
  sitrus: { name: 'Fruta Sitrus', pocket: 'berries', price: 600, sprite: 'sitrus-berry', heal: 30, desc: 'Restaura 30 PS.' },
  pecha: { name: 'Fruta Pecha', pocket: 'berries', price: 200, sprite: 'pecha-berry', cure: 'psn', desc: 'Cura envenenamento.' },
  cheri: { name: 'Fruta Cheri', pocket: 'berries', price: 200, sprite: 'cheri-berry', cure: 'par', desc: 'Cura paralisia.' },
  chesto: { name: 'Fruta Chesto', pocket: 'berries', price: 200, sprite: 'chesto-berry', cure: 'slp', desc: 'Acorda um Pokémon.' },
  rawst: { name: 'Fruta Rawst', pocket: 'berries', price: 200, sprite: 'rawst-berry', cure: 'brn', desc: 'Cura queimaduras.' },
  aspear: { name: 'Fruta Aspear', pocket: 'berries', price: 200, sprite: 'aspear-berry', cure: 'frz', desc: 'Descongela um Pokémon.' },
  persim: { name: 'Fruta Persim', pocket: 'berries', price: 300, sprite: 'persim-berry', heal: 15, desc: 'Fruta azedinha. Restaura 15 PS.' },
  leppa: { name: 'Fruta Leppa', pocket: 'berries', price: 800, sprite: 'leppa-berry', pp: 10, desc: 'Restaura 10 PP de um golpe.' },
  lum: { name: 'Fruta Lum', pocket: 'berries', price: 1000, sprite: 'lum-berry', cure: 'all', desc: 'Cura qualquer problema de estado.' },
  razz: { name: 'Fruta Razz', pocket: 'berries', price: 300, sprite: 'razz-berry', desc: 'Uma fruta comum. Ótima para vender ou entregar em trabalhos.' },

  // ---------------------------------------------------------------- tesouros (para vender)
  pepita: { name: 'Pepita', pocket: 'items', price: 10000, sprite: 'nugget', treasure: true, desc: 'Uma pepita de ouro puro. Vende por um bom dinheiro.' },
  pepitagrande: { name: 'Pepita Grande', pocket: 'items', price: 30000, sprite: 'big-nugget', treasure: true, desc: 'Uma pepita enorme. Vale uma fortuna.' },
  perola: { name: 'Pérola', pocket: 'items', price: 1400, sprite: 'pearl', treasure: true, desc: 'Uma pérola brilhante. Pode ser vendida.' },
  perolagrande: { name: 'Pérola Grande', pocket: 'items', price: 7500, sprite: 'big-pearl', treasure: true, desc: 'Uma pérola grande e valiosa.' },
  poestrela: { name: 'Pó de Estrela', pocket: 'items', price: 2000, sprite: 'stardust', treasure: true, desc: 'Areia vermelha que brilha. Pode ser vendida.' },
  pedacoestrela: { name: 'Pedaço de Estrela', pocket: 'items', price: 9800, sprite: 'star-piece', treasure: true, desc: 'Um fragmento de joia vermelha. Muito valioso.' },
  cometa: { name: 'Fragmento de Cometa', pocket: 'items', price: 24000, sprite: 'comet-shard', treasure: true, desc: 'Um pedaço de cometa raríssimo.' },
  cogumelo: { name: 'Cogumelo Pequeno', pocket: 'items', price: 500, sprite: 'tiny-mushroom', treasure: true, desc: 'Um cogumelo raro. Pode ser vendido.' },
  cogumelogrande: { name: 'Cogumelo Grande', pocket: 'items', price: 5000, sprite: 'big-mushroom', treasure: true, desc: 'Um cogumelo grande e raro.' },
  ossoraro: { name: 'Osso Raro', pocket: 'items', price: 10000, sprite: 'rare-bone', treasure: true, desc: 'Um osso antigo muito procurado por colecionadores.' },
  escamacoracao: { name: 'Escama de Coração', pocket: 'items', price: 200, sprite: 'heart-scale', treasure: true, desc: 'Escama bonita. O Tutor de Golpes de Pastoria aceita como pagamento.' },
  fragvermelho: { name: 'Fragmento Vermelho', pocket: 'items', price: 1000, sprite: 'red-shard', treasure: true, desc: 'Um caco vermelho encontrado no subsolo.' },
  fragazul: { name: 'Fragmento Azul', pocket: 'items', price: 1000, sprite: 'blue-shard', treasure: true, desc: 'Um caco azul encontrado no subsolo.' },
  fragverde: { name: 'Fragmento Verde', pocket: 'items', price: 1000, sprite: 'green-shard', treasure: true, desc: 'Um caco verde encontrado no subsolo.' },
  fragamarelo: { name: 'Fragmento Amarelo', pocket: 'items', price: 1000, sprite: 'yellow-shard', treasure: true, desc: 'Um caco amarelo encontrado no subsolo.' },
  minerio: { name: 'Minério Bruto', pocket: 'items', price: 600, sprite: 'hard-stone', treasure: true, desc: 'Minério tirado das paredes das cavernas. Usado em trabalhos de mineração.' },
  pedraeterna: { name: 'Pedra Eterna', pocket: 'items', price: 400, sprite: 'everstone', treasure: true, desc: 'Uma pedra que nunca muda. Pode ser vendida.' },

  // ---------------------------------------------------------------- fósseis
  fossilambar: { name: 'Âmbar Antigo', pocket: 'items', price: 1000, sprite: 'old-amber', fossil: 142, desc: 'Âmbar com material genético. O Museu de Oreburgh pode revivê-lo.' },
  fossildomo: { name: 'Fóssil Domo', pocket: 'items', price: 1000, sprite: 'dome-fossil', fossil: 140, desc: 'Fóssil de um Pokémon antigo. Leve ao Museu de Oreburgh.' },
  fossilhelice: { name: 'Fóssil Hélice', pocket: 'items', price: 1000, sprite: 'helix-fossil', fossil: 138, desc: 'Fóssil de um Pokémon antigo. Leve ao Museu de Oreburgh.' },
  fossilraiz: { name: 'Fóssil Raiz', pocket: 'items', price: 1000, sprite: 'root-fossil', fossil: 345, desc: 'Fóssil de um Pokémon antigo. Leve ao Museu de Oreburgh.' },
  fossilgarra: { name: 'Fóssil Garra', pocket: 'items', price: 1000, sprite: 'claw-fossil', fossil: 347, desc: 'Fóssil de um Pokémon antigo. Leve ao Museu de Oreburgh.' },

  safaribola: { name: 'Safari Bola', pocket: 'balls', price: 0, sprite: 'safari-ball', ball: 1.5, safari: true, desc: 'Bola especial usada só dentro da Zona Safári.' },

  // ---------------------------------------------------------------- itens-chave
  poketch: { name: 'Pokétch', pocket: 'key', price: 0, sprite: 'dowsing-machine', key: 'poketch', desc: 'Relógio com aplicativos: pedômetro, amizade, detector de itens e mais. (Atalho: Q)' },
  flauta: { name: 'Flauta Pokémon', pocket: 'key', price: 0, sprite: 'poke-flute', key: 'flute', desc: 'Uma melodia que acorda até o Pokémon mais preguiçoso.' },
  regador: { name: 'Regador', pocket: 'key', price: 0, sprite: 'squirt-bottle', key: 'bottle', desc: 'Regador da floricultura de Floaroma. Ótimo para plantas... e árvores estranhas.' },

  // ---------------------------------------------------------------- itens-chave (originais)
  bicicleta: { name: 'Bicicleta', pocket: 'key', price: 0, sprite: 'bicycle', key: 'bike', desc: 'Pedale para andar muito mais rápido. (Atalho: B)' },
  expshare: { name: 'Exp. Compartilhada', pocket: 'key', price: 0, sprite: 'exp-share', key: 'expshare', desc: 'Liga/desliga: toda a equipe ganha experiência.' },
  vara: { name: 'Super Vara', pocket: 'key', price: 0, sprite: 'super-rod', key: 'rod', desc: 'Pesque de frente para a água. (Atalho: F)' },
};

// MTs vendidos na Loja de Departamentos (Veilstone) e em algumas lojas.
const TM_LIST = [
  ['dragonclaw', 3000], ['waterpulse', 2000], ['calmmind', 3000], ['roar', 1500], ['toxic', 2000],
  ['hail', 1500], ['bulkup', 3000], ['bulletseed', 2000], ['sunnyday', 1500], ['taunt', 2000],
  ['icebeam', 5000], ['blizzard', 5500], ['hyperbeam', 7500], ['lightscreen', 2000], ['protect', 2000],
  ['raindance', 1500], ['gigadrain', 3000], ['safeguard', 1500], ['solarbeam', 5000], ['irontail', 3000],
  ['thunderbolt', 5000], ['thunder', 5500], ['earthquake', 6000], ['return', 2500], ['dig', 2000],
  ['psychic', 5000], ['shadowball', 4500], ['brickbreak', 3000], ['doubleteam', 1500], ['reflect', 2000],
  ['shockwave', 2000], ['flamethrower', 5000], ['sludgebomb', 4000], ['sandstorm', 1500], ['fireblast', 5500],
  ['rocktomb', 2000], ['aerialace', 2000], ['facade', 2500], ['rest', 2000], ['steelwing', 2500],
  ['overheat', 5000], ['roost', 3000], ['focusblast', 5000], ['energyball', 4500], ['falseswipe', 1500],
  ['chargebeam', 2500], ['dragonpulse', 5000], ['drainpunch', 4000], ['willowisp', 2500], ['silverwind', 3000],
  ['shadowclaw', 3500], ['gigaimpact', 7500], ['stoneedge', 5000], ['thunderwave', 1500], ['swordsdance', 3000],
  ['darkpulse', 4500], ['rockslide', 3500], ['xscissor', 3500], ['poisonjab', 3500], ['grassknot', 3000],
  ['uturn', 3500], ['substitute', 3000], ['flashcannon', 4500], ['surf', 4000], ['fly', 3500],
  ['strength', 2500], ['rocksmash', 1500], ['waterfall', 3500], ['cut', 1000], ['bodyslam', 3000],
  ['psychup', 2000], ['sleeptalk', 2000], ['swagger', 1500], ['dreameater', 3000], ['seedbomb', 3500],
];

const TM_SPRITE_TYPE = {
  Normal: 'normal', Fire: 'fire', Water: 'water', Grass: 'grass', Electric: 'electric', Ice: 'ice',
  Fighting: 'fighting', Poison: 'poison', Ground: 'ground', Flying: 'flying', Psychic: 'psychic',
  Bug: 'bug', Rock: 'rock', Ghost: 'ghost', Dragon: 'dragon', Dark: 'dark', Steel: 'steel', Fairy: 'fairy',
};

export const TM_MOVES = TM_LIST.map(([m]) => m);

export function registerTMs(MOVES) {
  TM_LIST.forEach(([mv, price], i) => {
    const m = MOVES[mv];
    if (!m) return;
    const n = String(i + 1).padStart(2, '0');
    ITEMS['mt_' + mv] = {
      name: `MT${n} ${m.name}`,
      pocket: 'tms',
      price,
      sprite: 'tm-' + (TM_SPRITE_TYPE[m.type] || 'normal'),
      tm: mv,
      desc: `Ensina o golpe ${m.name} a um Pokémon compatível. Pode ser usado várias vezes.`,
    };
  });
}

export function itemSprite(id) {
  const it = ITEMS[id];
  if (!it) return '';
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${it.sprite}.png`;
}

// Estoque das lojas. Todas as Poké Marts vendem o básico; algumas cidades têm extras.
export const MART_BASIC = ['pokebola', 'grandebola', 'pocao', 'superpocao', 'antidoto', 'antiparalisia', 'despertar', 'antiqueimadura', 'antigelo', 'repelente', 'cordadefuga', 'biscoito'];
export const MART_ADVANCED = ['ultrabola', 'hiperpocao', 'pocaomaxima', 'restauracao', 'reviver', 'curatotal', 'superrepelente', 'repelentemax', 'eter', 'elixir'];
export const MART_SPECIAL_BALLS = ['redebola', 'mergulhobola', 'ninhobola', 'repetebola', 'tempobola', 'crepusculobola', 'rapidabola', 'luxobola', 'curabola'];
export const MART_STONES = ['pedrafogo', 'pedraagua', 'pedratrovao', 'pedrafolha', 'pedralua', 'pedrasol'];
export const MART_EVO_ITEMS = ['pedradorei', 'revestimentometal', 'escamadragao', 'upgrade', 'dentemarinho', 'escamamarinha', 'escamaprisma', 'cabodeconexao'];
export const MART_VITAMINS = ['proteina', 'ferro', 'calcio', 'zinco', 'carbos', 'hpup', 'docerarro', 'etermax', 'elixirmax', 'revivermax'];
export const MART_DRINKS = ['aguafresca', 'refrigerante', 'limonada', 'leitemoomoo'];
