# Pokémon Freedom

Um "Pokémon Diamond modificado" para navegador: mundo aberto inspirado em Sinnoh, multiplayer só com amigos convidados, gráficos novos desenhados por código, os **386 Pokémon das gerações 1 a 3**, personalização de personagem (inclusive camisas de times brasileiros), casas e mansões com móveis, trabalhos para ganhar dinheiro e as mecânicas do Diamond espalhadas pelo mapa. Tudo em português.

> Projeto de fã, sem fins lucrativos. Pokémon é marca registrada da Nintendo, Game Freak e The Pokémon Company. Os sprites dos Pokémon e dos itens são carregados do repositório público da [PokeAPI](https://github.com/PokeAPI/sprites). As camisas de time usam só as cores e um escudo genérico, sem logotipos oficiais. Não use este projeto comercialmente. O jogo não usa nem inclui nenhuma ROM: tudo foi recriado do zero.

## Como rodar

Requisitos: [Node.js](https://nodejs.org) 18 ou mais novo e [Git](https://git-scm.com) (ou baixe o ZIP pelo botão **Code → Download ZIP** do GitHub).

```bash
git clone https://github.com/JoaoPauloCMark/Pokemon-Freedom.git
cd Pokemon-Freedom
npm install
npm start
```

Abra **http://localhost:3000**, crie uma conta e jogue. Para usar outra porta: `PORT=3001 npm start` (no Windows PowerShell: `$env:PORT=3001; npm start`).

Quem hospeda o servidor é quem "abre" o jogo para os amigos: só uma pessoa precisa rodar `npm start`; os outros só abrem o link no navegador (veja abaixo). O jogo precisa de internet para carregar os sprites dos Pokémon (vêm da PokeAPI).

Para atualizar depois: `git pull` e `npm install` de novo. Os saves ficam guardados na sua máquina e não são apagados pela atualização.

Os dados (contas, mundos, saves e casas) ficam só no computador de quem roda o servidor, em `server/data/db.json` (essa pasta não vai para o Git). O servidor faz cópias de segurança automáticas a cada 30 minutos em `server/data/backups/` (guarda as últimas 48). Para um backup manual, copie o `db.json` com o servidor desligado.

## Conta, mundos e convites

- A **conta** é só o login. Dentro dela você tem vários **mundos** (como os mundos do Minecraft).
- Cada mundo é um save separado, com **seu próprio treinador**: nome, roupa, Pokémon, dinheiro e casas. Você pode ter um mundo solo e outro com os amigos, com treinadores diferentes.
- **Jogar sozinho:** crie um mundo e não convide ninguém. Ninguém consegue entrar.
- **Jogar com amigos:** no card do mundo (ou no menu dentro do jogo), clique em **Convidar**. Mande o **link** ou o **código de 6 letras** só para quem você quiser. Quem entra vira membro daquele mundo e cria o treinador dele lá.
- O dono pode trocar o código (o antigo para de funcionar), desativar convites, remover membros, renomear ou excluir o mundo.
- Mundo excluído vai para a **🗑️ Lixeira** (tela Meus Mundos) e pode ser restaurado por 7 dias.
- Só os jogadores do mesmo mundo se veem, conversam, trocam e batalham.

## Cheats (opcional, por mundo)

Ao criar um mundo, ligue **Permitir cheats** (como no Minecraft). O dono também pode ligar ou desligar depois em **Meus Mundos → ⋯**. Com cheats ligados, todos os membros daquele mundo ganham:

- **Menu → Cheats:** dar qualquer Pokémon (nível e shiny), qualquer item, dinheiro e BP, curar e subir o nível da equipe, todas as insígnias, Pokédex completa, voo para todas as cidades, todas as roupas e móveis, chocar ovos, renovar árvores e escavações, revanche com treinadores, atravessar paredes, desligar encontros e teletransporte.
- **Comandos no chat:** `/ajuda`, `/dinheiro 50000`, `/pokemon pikachu 30 shiny`, `/item ultrabola 20`, `/curar`, `/nivel 50`, `/tp hearthome`, `/insignias`, `/pokedex`, `/voar`, `/roupas`, `/moveis`, `/noclip`, `/semencontros`, `/bp 100`.

Em mundos sem cheats, nada disso aparece e os comandos são recusados.

## Jogar com amigos (rede)

Todo mundo precisa abrir o endereço do **mesmo servidor**. O painel de convite já mostra os links certos.

**Mesma rede (Wi-Fi de casa):** os amigos usam o link com o IP do seu computador (ex.: `http://192.168.0.15:3000/?convite=ABC123`). Se o Windows perguntar, permita o Node.js no firewall.

**Pela internet (amigos em outras casas):**
- **Túnel grátis (mais fácil):** com o servidor rodando, use o [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/):
  ```bash
  cloudflared tunnel --url http://localhost:3000
  ```
  Ele mostra um link `https://....trycloudflare.com`. Mande esse link com `/?convite=CODIGO` no final (ou mande o link e o código separados). O [ngrok](https://ngrok.com) (`ngrok http 3000`) também funciona.
- **Hospedar online:** dá para subir em serviços como Render, Railway ou Fly.io como um "Web Service" Node (comando de início `npm start`). A porta vem da variável `PORT`. Para não perder os dados, aponte a variável `DATA_DIR` para um disco persistente.

## Controles

Todos podem ser trocados em **Menu → Controles** (ou tecla **H**). Clique na tecla e aperte a nova.

| Tecla padrão | Ação |
|---|---|
| Setas / WASD | Andar (toque rápido só vira) |
| Shift (segurar) | Correr |
| R | Liga/desliga a corrida automática (também no botão 🏃) |
| B | Bicicleta |
| Z / Espaço | Falar, interagir, confirmar |
| X / Backspace / Esc | Menu, voltar |
| M | Mapa (níveis por área e voo para cidades visitadas) |
| Q | Pokétch |
| J | Trabalhos |
| T / Enter | Chat |
| F | Pescar (de frente para a água) |
| P / I | Equipe / Bolsa |
| E | Expressões; dentro da **sua casa**, abre o modo **Decorar** |
| H | Controles |

No celular aparecem um direcional, os botões A/B e o botão de correr. Clique em outro jogador para trocar Pokémon ou desafiar para batalha.

## O que tem no jogo

- **Mundo aberto, sem enrolação:** depois de escolher o inicial com o **Professor Carvalho** (Treecko, Cyndaquil ou Squirtle), você vai para onde quiser. Dá para surfar em qualquer água e pedalar desde o começo.
- **Níveis por área:** o mapa (M) pinta cada área de verde (tranquilo), amarelo (no seu nível) ou vermelho (perigoso), comparando com a sua equipe, e mostra a faixa de nível dos selvagens. O canto da tela também mostra o nível da rota onde você está. Nada impede de ir a qualquer lugar.
- **Região inspirada em Sinnoh:** 16 cidades, rotas, Monte Coronet, Floresta Eterna, lagos, neve, deserto, ilha vulcânica, Grande Pântano, Ilha de Ferro e a Liga Pokémon.
- **Condomínio Bela Vista** (a leste de Sandgem, ligado também a Oreburgh): condomínio de luxo com **mansões com piscina** à venda, piscina interna e a loja **Decor Luxo** (jacuzzi, sinuca, fonte, telão, fliperama, lustre...).
- **Trabalhos informais (sem batalhar):** o quadro amarelo dentro de cada Centro Pokémon oferece bicos que mudam a cada 3 horas: entregas entre cidades, colheita de frutas, escavação, pesca, passeio com Pokémon, limpeza das ruas, controle de selvagens, pesquisa de campo e apicultura. Até 3 ao mesmo tempo, com bônus a cada 10 concluídos.
- **Mecânicas e easter eggs do Diamond:**
  - **Pokétch** com relógio, pedômetro, radar de itens escondidos, radar de frutas, incubadora, amizade, trabalhos, notícias e moeda.
  - **Árvores de frutas** que dão frutas e crescem de novo; **árvores de mel** (passe Mel e volte depois para achar um Pokémon).
  - **Escavação** nas paredes brilhantes das cavernas (minijogo com picareta e martelo): tesouros, pedras de evolução e **fósseis**, revividos no **Museu de Oreburgh** (o Curador compra tesouros).
  - **Itens escondidos** pelo mapa (use o radar do Pokétch).
  - **Ovos:** creche com 2 Pokémon (Solaceon e Hearthome) que podem gerar ovos; ovo de Togepi dado pela Cynthia em Eterna e um ovo misterioso em Solaceon. Os ovos chocam andando.
  - **Torre de Batalha** (ilha da Liga): 7 batalhas seguidas e BP para trocar por itens raros; avaliador de potencial (IVs).
  - **Zona Safári** no Grande Pântano (Safari Bolas em Pastoria) com Tauros, Kangaskhan, Chansey, Dratini...
  - **Loteria e notícias** na TV de Jubilife: surto diário de uma espécie numa rota e o Pokémon do dia no **Jardim de Troféus** (Mansão Pokémon, Rota 212).
  - **Tutor de Golpes** em Pastoria (paga com Escama de Coração) e **Esquecedor de Golpes** em Canalave; avaliadora de amizade em Hearthome; trocas com NPCs em Oreburgh e Snowpoint.
  - **Equipe Galáctica:** recrutas espalhados, Mars, Saturn, Jupiter no prédio de Veilstone e Cyrus no alto do Monte Coronet (que dá uma Master Bola).
  - **Barry**, o rival que ameaça te multar, em Sandgem; a **Mamãe** em Twinleaf (cura, presentes diários e os tênis de corrida).
  - Easter eggs: **Snorlax** dormindo na Rota 210 (pegue a flauta em Celestic), **Sudowoodo** na Rota 214 (regador em Floaroma), **Gyarados vermelho** no Lago Valor, o **caminhão** do cais de Canalave e a **TV assombrada** do Velho Château à noite.
- **Gerações 1 a 3:** 365 espécies espalhadas por habitat, mais os lendários escondidos pelo mapa. Os selvagens andam pelo mapa (encoste para batalhar) e também aparecem na grama alta. A Pokédex mostra onde encontrar cada um.
- **Gráficos novos:** personagens em pixel art, terreno com bordas suaves, água animada, prédios com volume, ciclo de dia e noite, chuva, neve, areia, cinzas e neblina.
- **Batalhas completas**, ginásios em qualquer ordem (os líderes ficam mais fortes conforme as insígnias), Elite dos Quatro e treinadores opcionais nas rotas.
- **Personalização:** corpo, pele, olhos, 22 cortes de cabelo (longo ondulado, franja, rabo alto e lateral, tranças, coque duplo, joãozinho, corte princesa...) e mais de 500 roupas, com uma linha feminina completa (cropped, blusa de babado, ombro a ombro, body, vestidos florido/longo/de festa, biquíni, maiô, shortinho, short jeans, minissaia, saia plissada, calça flare, salto alto, sapatilha, tênis plataforma, bota cano alto, brincos, colar de pérolas, gargantilha, pulseiras, óculos gatinho, laço, tiara, presilhas e bolsa de mão — quase tudo também na criação do personagem), incluindo **camisas dos grandes clubes brasileiros** (Atlético-MG, Corinthians, Palmeiras, São Paulo, Santos, Flamengo, Fluminense, Vasco, Botafogo, Grêmio, Internacional, Cruzeiro, Bahia, Athletico-PR, Fortaleza, Sport e Seleção), calças cargo, tênis de corrida, bonés bicolores e munhequeiras, vendidos nas Boutiques. Na criação do personagem só aparecem as peças básicas; camisas de time e roupas especiais são compradas (dá para experimentar antes na Boutique).
- **Casas e decoração estilo The Sims:** compre casas e mansões em várias cidades (o mapa mostra 🏠 onde ficam as suas). Os móveis comprados vão para o seu **inventário** (Menu → Casas). Dentro da sua casa, toque em **🛋️ Decorar casa** (ou E): abra o Inventário ou o **Catálogo** (compra e já coloca), mova ou guarde móveis com o mouse e troque piso, parede, telhado e a tranca da porta. Mais de 300 móveis em categorias: quarto, sala, cozinha, banheiro, eletrônicos e games (smart TV, TV de tubo, consoles, PC gamer, cadeira gamer), lazer (ping-pong, pebolim, trave, piscina de bolinhas, academia), decoração, tema Pokémon, 58 bonecos de Pokémon e **móveis dos times brasileiros** (cama, tapete, bandeira, pufe e quadro de cada clube).
- **Relacionamentos estilo The Sims:** cada morador das cidades tem nome, personalidade (simpático, rabugento, engraçado, tímido, competitivo, romântico, fofoqueiro, nerd...), presente favorito e tipo de Pokémon preferido. Converse (A perto dele) e escolha: conversar, falar de Pokémon, contar piada, elogiar, fofocar, abraçar, dar presente, chamar para batalhar, paquerar, pedir em namoro, provocar, discutir ou pedir desculpas. A amizade vai de inimigo a melhor amigo (e namoro), esfria se vocês não se falarem e muda como a pessoa reage ao te ver. Com amizade 20+ peça o **contato**: ele aparece no app **📱 Contatos** do Pokétch, onde dá para ligar (melhores amigos às vezes mandam presentes) e **convidar para visitar sua casa**.
- **Multiplayer:** chat, expressões, **troca de Pokémon** e **batalhas PvP** com quem está no mesmo mundo.

## Estrutura do código

```
server/            servidor Node (Express + WebSocket): contas, mundos, convites, saves, casas, trocas, PvP
public/index.html  página do jogo
public/css/        estilos da interface
public/js/shared/  lógica usada pelo cliente e pelo servidor
  battle/engine.js   motor de batalha
  world/             gerador do mapa, zonas, encontros, treinadores, interiores
  data/              Pokédex, golpes, itens, roupas, móveis (gerados/curados)
public/js/client/  jogo no navegador
  game/              movimento, interações, trabalhos (jobs.js), mecânicas do Diamond (features.js)
  render/            terreno, prédios, personagens em pixel art
  ui/                menus, batalha, mundos, Pokétch, controles, escavação, lojas
tools/             scripts: geração de dados, prévia do mapa, teste do motor de batalha
```

Ferramentas úteis:

- `npm run build-data` gera de novo os dados dos Pokémon e dos golpes a partir de `tools/raw` e `tools/translations`.
- `node tools/preview-map.mjs mapa.png 3` gera uma imagem do mapa inteiro.
- `node tools/test-battle.mjs 5000` roda milhares de batalhas automáticas para testar o motor.
