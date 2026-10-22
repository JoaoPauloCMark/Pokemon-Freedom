// Cena de evolução.
import { ui } from './ui.js';
import { audio } from '../audio.js';
import { input } from '../input.js';
import { POKEDEX } from '../../shared/data/pokedex.js';
import { evolve, evolutionTarget, monName, createPokemon } from '../../shared/pokemon.js';
import { spriteUrl, loadImage, fallbackSprite } from '../assets.js';
import { S, markCaught, markDirty, addPokemon } from '../state.js';
import { learnMoveFlow } from './pickers.js';
import { net } from '../net.js';
import { timeOfDay } from '../../shared/time.js';

export async function evolutionScene(mon, targetId, { cancelable = true } = {}) {
  const fromName = monName(mon);
  const el = document.createElement('div');
  el.className = 'evo';
  el.innerHTML = `<img alt=""><div class="msg"></div>`;
  const img = el.querySelector('img'), msg = el.querySelector('.msg');
  const layer = { el, onKey: () => {} };
  ui.push(layer);
  const a = spriteUrl.front(mon.species, mon.shiny), b = spriteUrl.front(targetId, mon.shiny);
  await Promise.all([loadImage(a), loadImage(b)]);
  img.src = a;
  img.onerror = () => { img.onerror = null; img.src = fallbackSprite(); };
  msg.textContent = `O quê? ${fromName} está evoluindo!`;
  audio.play(null);
  audio.sfx('evolve');
  await ui.wait(1200);
  let cancelled = false;
  const off = input.onPress((k) => { if (k === 'b' && cancelable) cancelled = true; });
  img.classList.add('flash');
  for (let i = 0; i < 6 && !cancelled; i++) {
    await ui.wait(260);
    img.src = i % 2 ? a : b;
  }
  await ui.wait(1500);
  off();
  img.classList.remove('flash');
  if (cancelled) {
    img.src = a;
    msg.textContent = `Hã? ${fromName} parou de evoluir!`;
    await ui.wait(1600);
    ui.pop(layer);
    return false;
  }
  img.src = b;
  const res = evolve(mon, targetId);
  markCaught(targetId);
  audio.sfx('caught');
  msg.textContent = `Parabéns! Seu ${fromName} evoluiu para ${POKEDEX[targetId].name}!`;
  await ui.wait(2200);
  ui.pop(layer);
  for (const mv of res.newMoves) await learnMoveFlow(mon, mv);
  // Nincada -> Shedinja aparece se houver espaço
  if (targetId === 291 && S().party.length < 6) {
    const shed = createPokemon(292, mon.level, { ot: mon.ot });
    addPokemon(shed);
    await ui.dialog('Um Pokémon misterioso apareceu na sua equipe: Shedinja!');
  }
  markDirty();
  return true;
}

// Verifica evoluções por nível/amizade depois das batalhas
export async function checkLevelEvolutions() {
  const time = timeOfDay(net.now()) === 'night' ? 'night' : 'day';
  for (const mon of S().party) {
    if (!mon._evoCheck) continue;
    delete mon._evoCheck;
    const to = evolutionTarget(mon, { trigger: 'level', time });
    if (to) await evolutionScene(mon, to);
  }
}
