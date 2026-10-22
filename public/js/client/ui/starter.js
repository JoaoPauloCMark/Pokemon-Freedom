// Escolha do Pokémon inicial com o Professor Carvalho.
import { ui, esc } from './ui.js';
import { audio } from '../audio.js';
import { POKEDEX } from '../../shared/data/pokedex.js';
import { DEXTEXT } from '../../shared/data/dextext.js';
import { createPokemon } from '../../shared/pokemon.js';
import { S, state, addPokemon, addItem, markDirty, saveNow } from '../state.js';
import { spriteUrl, fallbackSprite, monImg } from '../assets.js';
import { typeChip } from './pickers.js';

const STARTERS = [252, 155, 7]; // Treecko, Cyndaquil, Squirtle

export async function starterFlow() {
  const who = 'Prof. Carvalho';
  await ui.dialog([
    `Olá, ${state.name}! Eu sou o Professor Carvalho.`,
    'Sem muita conversa: o mundo de Sinnoh está aberto para você explorar do jeito que quiser.',
    'Escolha seu primeiro parceiro!',
  ], { who });
  while (true) {
    const pick = await chooseStarter();
    if (pick === null) continue;
    const name = POKEDEX[pick].name;
    if (!(await ui.ask(`Você escolhe ${name}?`, { who }))) continue;
    const mon = createPokemon(pick, 5, { ot: state.name, otId: state.name, met: 'Laboratório do Prof. Carvalho' });
    mon.friendship = 120;
    addPokemon(mon);
    audio.sfx('caught');
    S().flags.starter = true;
    addItem('pokebola', 10);
    addItem('pocao', 5);
    addItem('bicicleta');
    addItem('expshare');
    addItem('vara');
    markDirty();
    saveNow();
    await ui.dialog([
      `${name} agora é seu parceiro!`,
      'Tome também: 10 Poké Bolas, 5 Poções, uma Bicicleta, a Exp. Compartilhada e uma Super Vara.',
      'Dica: pressione X para abrir o menu, B para a bicicleta, M para o mapa e Enter para conversar com outros treinadores.',
      'Agora vá! O mundo é todo seu.',
    ], { who });
    return;
  }
}

function chooseStarter() {
  return new Promise((resolve) => {
    let sel = 1, done = false;
    const finish = (v) => { if (done) return; done = true; layer.close(); resolve(v); };
    const layer = ui.panel({
      title: 'Escolha seu Pokémon inicial', width: 'min(760px,96vw)',
      build: (body) => {
        body.innerHTML = `<div class="starters"></div><div class="desc-box"></div>`;
        const box = body.querySelector('.starters'), desc = body.querySelector('.desc-box');
        STARTERS.forEach((id, i) => {
          const sp = POKEDEX[id];
          const d = document.createElement('div');
          d.className = 'starter';
          d.innerHTML = `${monImg(id)}<div class="n">${esc(sp.name)}</div><div class="row">${sp.types.map(typeChip).join('')}</div>`;
          d.onclick = () => { audio.sfx('confirm'); finish(id); };
          d.onmouseenter = () => { sel = i; paint(); };
          box.appendChild(d);
        });
        const paint = () => {
          [...box.children].forEach((c, i) => c.classList.toggle('sel', i === sel));
          desc.textContent = `${DEXTEXT[STARTERS[sel]].genus}. ${DEXTEXT[STARTERS[sel]].text}`;
        };
        layer.paint = paint;
        paint();
      },
      onKey: (k) => {
        if (k === 'left') { sel = (sel + 2) % 3; layer.paint(); audio.sfx('select'); return true; }
        if (k === 'right') { sel = (sel + 1) % 3; layer.paint(); audio.sfx('select'); return true; }
        if (k === 'a' || k === 'enter') { audio.sfx('confirm'); finish(STARTERS[sel]); return true; }
        if (k === 'b') return true;
        return false;
      },
      onClose: () => { if (!done) { done = true; resolve(null); } },
    });
    layer.el.querySelector('.close').style.display = 'none';
  });
}
