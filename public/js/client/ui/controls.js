// Tela de controles: mostra e permite trocar as teclas de cada ação.
import { ui, esc } from './ui.js';
import { audio } from '../audio.js';
import { input, ACTIONS, getBindings, setBinding, resetBindings, keyLabel } from '../input.js';

export function openControls() {
  let waiting = null; // { action, slot }
  const layer = ui.panel({
    title: 'Controles', sub: 'Clique numa tecla para trocar', width: 'min(720px,96vw)',
    onClose: () => { input.capture = null; },
    build: (body, L) => {
      const render = () => {
        const b = getBindings();
        body.innerHTML = `<div class="controls-table scroll">
            ${ACTIONS.map(([id, name]) => `<div class="ctl-row"><span>${esc(name)}</span>
              ${[0, 1].map((slot) => `<button class="keycap ${waiting && waiting.action === id && waiting.slot === slot ? 'wait' : ''}" data-a="${id}" data-s="${slot}">${waiting && waiting.action === id && waiting.slot === slot ? 'Pressione...' : esc(keyLabel((b[id] || [])[slot]))}</button>`).join('')}
            </div>`).join('')}
            <div class="ctl-row fixed"><span>Confirmar / abrir chat</span><span class="keycap">Enter</span><span></span></div>
            <div class="ctl-row fixed"><span>Voltar / fechar</span><span class="keycap">Esc</span><span></span></div>
          </div>
          <div class="desc-box">No celular: use o direcional e os botões A/B da tela; o botão 🏃 liga a corrida. Clique em outro jogador para trocar Pokémon ou batalhar.</div>
          <div class="row" style="justify-content:flex-end"><button class="btn" data-a="reset">Restaurar padrão</button></div>`;
        body.querySelectorAll('.keycap[data-a]').forEach((btn) => btn.onclick = () => {
          waiting = { action: btn.dataset.a, slot: +btn.dataset.s };
          audio.sfx('select');
          render();
          input.capture = (code) => {
            if (code === 'Escape') { waiting = null; render(); return; }
            if (!setBinding(waiting.action, waiting.slot, code)) ui.toast('Essa tecla é fixa e não pode ser usada.', 'bad');
            else audio.sfx('confirm');
            waiting = null;
            render();
          };
        });
        body.querySelector('[data-a=reset]').onclick = () => { resetBindings(); waiting = null; input.capture = null; ui.toast('Controles restaurados.', 'good'); render(); };
      };
      L.render = render;
      render();
    },
  });
  return layer;
}
