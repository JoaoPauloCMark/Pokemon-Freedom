// PC de armazenamento (caixas). A creche fica em game/features.js.
import { ui, esc } from './ui.js';
import { audio } from '../audio.js';
import { S, markDirty } from '../state.js';
import { monName, isUsable } from '../../shared/pokemon.js';
import { POKEDEX } from '../../shared/data/pokedex.js';
import { pcardHtml, iconImg, pickPartyMon } from './pickers.js';
import { openSummary } from './menus.js';

const BOX = 30;

export function openPC(game) {
  return new Promise((resolve) => {
    let box = 0;
    let selected = null; // { from: 'party'|'pc', index }
    const layer = ui.panel({
      title: 'PC de Armazenamento', width: 'min(1040px,96vw)', onClose: () => { game.refreshFollower(); resolve(); },
      build: (body) => {
        const render = () => {
          const s = S();
          const boxes = Math.max(1, Math.ceil((s.pc.length + 1) / BOX));
          box = Math.min(box, boxes - 1);
          body.innerHTML = `<div class="pc">
            <div class="col"><b>Equipe (${s.party.length}/6)</b><div class="col party-list"></div></div>
            <div class="col"><div class="row"><button class="btn small" data-b="-1">◀</button><b class="grow" style="text-align:center">Caixa ${box + 1} de ${boxes} • ${s.pc.length} Pokémon guardados</b><button class="btn small" data-b="1">▶</button></div>
              <div class="box-grid"></div><div class="desc-box info">Clique num Pokémon para ver as opções.</div></div></div>`;
          const pl = body.querySelector('.party-list');
          s.party.forEach((m, i) => {
            const c = document.createElement('div');
            c.className = 'pcard' + (selected && selected.from === 'party' && selected.index === i ? ' sel' : '');
            c.style.minHeight = '60px';
            c.innerHTML = pcardHtml(m);
            c.onclick = () => act('party', i);
            pl.appendChild(c);
          });
          const grid = body.querySelector('.box-grid');
          for (let k = 0; k < BOX; k++) {
            const idx = box * BOX + k;
            const m = s.pc[idx];
            const c = document.createElement('div');
            c.className = 'box-cell' + (selected && selected.from === 'pc' && selected.index === idx ? ' sel' : '');
            if (m) {
              c.innerHTML = iconImg(m.species, '');
              c.title = `${monName(m)} Nv. ${m.level}`;
              c.onclick = () => act('pc', idx);
              c.onmouseenter = () => { body.querySelector('.info').textContent = `${monName(m)} • Nv. ${m.level} • ${POKEDEX[m.species].types.join('/')}`; };
            }
            grid.appendChild(c);
          }
          body.querySelectorAll('[data-b]').forEach((b) => b.onclick = () => { box = (box + +b.dataset.b + boxes) % boxes; render(); });
        };
        const act = async (from, index) => {
          const s = S();
          const list = from === 'party' ? s.party : s.pc;
          const m = list[index];
          const opts = from === 'party' ? ['Depositar', 'Resumo', 'Soltar'] : ['Retirar', 'Trocar com a equipe', 'Resumo', 'Soltar'];
          const c = await ui.choice(`${monName(m)} (Nv. ${m.level})`, [...opts, 'Cancelar']);
          const o = opts[c];
          if (o === 'Depositar') {
            if (s.party.filter(isUsable).length <= 1 && isUsable(m)) { ui.toast('Você precisa ficar com pelo menos um Pokémon em condições de lutar!', 'bad'); return; }
            s.party.splice(index, 1); s.pc.push(m); markDirty(); audio.sfx('confirm');
          } else if (o === 'Retirar') {
            if (s.party.length >= 6) { ui.toast('Sua equipe está cheia!', 'bad'); return; }
            s.pc.splice(index, 1); s.party.push(m); markDirty(); audio.sfx('confirm');
          } else if (o === 'Trocar com a equipe') {
            const j = await pickPartyMon(`Trocar ${monName(m)} por...`);
            if (j >= 0) { const tmp = s.party[j]; s.party[j] = m; s.pc[index] = tmp; markDirty(); audio.sfx('confirm'); }
          } else if (o === 'Resumo') {
            await openSummary(list, index);
          } else if (o === 'Soltar') {
            if (from === 'party' && s.party.length <= 1) { ui.toast('Você não pode soltar seu último Pokémon!', 'bad'); return; }
            if (await ui.ask(`Soltar ${monName(m)} na natureza? Isso não pode ser desfeito!`)) {
              list.splice(index, 1); markDirty();
              await ui.dialog(`${monName(m)} foi solto. Tchau, ${monName(m)}!`);
            }
          }
          render();
        };
        render();
      },
    });
  });
}

void esc;
