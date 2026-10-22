// Editor de visual: criação do personagem, guarda-roupa, salão e Boutique usam
// o mesmo componente (abas por categoria, modelos em cartões e cores separadas).
import { ui, esc, money } from './ui.js';
import { audio } from '../audio.js';
import { drawPortrait } from '../render/character.js';
import { SKINS, EYES, HAIR_COLORS, HAIR_STYLES, CLOTHES, STYLE_NAMES, DEFAULT_LOOK, CREATOR_STYLES } from '../../shared/data/clothes.js';

const SLOTS = ['hat', 'top', 'bottom', 'shoes', 'acc', 'back'];
const OPTIONAL = new Set(['hat', 'acc', 'back']);
const TAB_INFO = {
  body: ['🙂', 'Corpo'], hair: ['💇', 'Cabelo'], hat: ['🧢', 'Chapéu'], top: ['👕', 'Parte de cima'],
  bottom: ['👖', 'Parte de baixo'], shoes: ['👟', 'Calçado'], acc: ['👓', 'Acessório'], back: ['🎒', 'Costas'],
};
const STYLE_ICON = {
  cap: '🧢', cap2: '🧢', beanie: '🧶', bucket: '👒', sunhat: '👒', cowboy: '🤠', beret: '🎨', tophat: '🎩', bandana: '🏴‍☠️',
  ears: '🐱', flower: '🌸', crown: '👑', tee: '👕', striped: '👕', tank: '🎽', hoodie: '🧥', jacket: '🧥', coat: '🧥',
  sweater: '🧶', dress: '👗', labcoat: '🥼', vest: '🦺', kimono: '👘', suit: '🤵', jersey: '⚽', pants: '👖', jeans: '👖',
  cargo: '👖', trackpants: '👖', shorts: '🩳', skirt: '👗', longskirt: '👗', leggings: '🧘', sneakers: '👟', runners: '👟',
  boots: '🥾', sandals: '🩴', formal: '👞', glasses: '👓', sunglasses: '🕶️', scarf: '🧣', necklace: '📿', wristbands: '💪',
  backpack: '🎒', satchel: '👜', cape: '🦸', wings: '🪽',
  bow: '🎀', headband: '💆', hairclips: '📎', sunvisor: '🧢', croptop: '👚', blouse: '👚', offshoulder: '👚', body: '🩱',
  sundress: '👗', longdress: '👗', partydress: '💃', bikini: '👙', swimsuit: '🩱', shortshorts: '🩳', denimshorts: '🩳',
  bikinibottom: '👙', miniskirt: '👗', pleated: '👗', flare: '👖', heels: '👠', flats: '🥿', platform: '👟', kneeboots: '👢',
  flipflops: '🩴', earrings: '💎', pearls: '📿', choker: '📿', bracelets: '💍', cateye: '👓', handbag: '👜',
};
const HAIR_ICON = {
  short: '💇', spiky: '⚡', sidepart: '💁', long: '👱‍♀️', ponytail: '🎀', twintails: '🎎', bob: '💇‍♀️', bun: '🍡', afro: '☁️', curly: '🌀', mohawk: '🦔', buzz: '🪒',
  wavy: '🌊', bangs: '💇‍♀️', highponytail: '🎀', sideponytail: '🎗️', braid: '🪢', braids2: '🪢', doublebun: '🐼', pixie: '✂️', curlylong: '🌀', hime: '👸',
};

// Amostra de cor de uma peça (duas cores e camisas de time viram padrões)
export function swatchBg(c) {
  if (c.style === 'jersey') {
    const [a, b = a, d = b] = c.colors;
    switch (c.pattern) {
      case 'vstripes': return `repeating-linear-gradient(90deg, ${a} 0 5px, ${b} 5px 10px)`;
      case 'hstripes': return `repeating-linear-gradient(0deg, ${a} 0 5px, ${b} 5px 10px)`;
      case 'vstripes3': return `repeating-linear-gradient(90deg, ${a} 0 4px, ${b} 4px 8px, ${d} 8px 12px)`;
      case 'hstripes3': return `repeating-linear-gradient(0deg, ${a} 0 4px, ${b} 4px 8px, ${d} 8px 12px)`;
      case 'sash': return `linear-gradient(135deg, ${a} 38%, ${b} 38% 62%, ${a} 62%)`;
      case 'chestbands': return `linear-gradient(180deg, ${a} 34%, ${b} 34% 46%, ${d} 46% 58%, ${a} 58%)`;
      default: return `radial-gradient(circle at 50% 42%, ${c.crest ? c.crest[0] : a} 0 18%, ${a} 19%)`;
    }
  }
  if (c.color2 && c.color2 !== c.color) return `linear-gradient(135deg, ${c.color} 50%, ${c.color2} 50%)`;
  return c.color;
}

const shortClub = (c) => c.club.replace('Seleção Brasileira', 'Seleção').replace('Vasco da Gama', 'Vasco').replace('Sport Recife', 'Sport');

// Monta o editor dentro de "body".
// cfg: { look, tabs, items(slot) -> ids disponíveis, owned(id) -> bool, price(id), onChange(), mode }
function buildEditor(body, cfg) {
  let tab = cfg.tabs[0];
  let dir = 2;
  body.innerHTML = `<div class="le">
      <div class="le-stage">
        <canvas width="240" height="330"></canvas>
        <div class="le-rot"><button class="btn small" data-r="1" title="Girar">⟲</button><button class="btn small" data-r="-1" title="Girar">⟳</button></div>
        <div class="le-cap"></div>
      </div>
      <div class="le-side">
        <div class="le-tabs"></div>
        <div class="le-body scroll"></div>
      </div>
    </div>`;
  const cv = body.querySelector('canvas'), tabsEl = body.querySelector('.le-tabs'), panel = body.querySelector('.le-body'), cap = body.querySelector('.le-cap');
  const redraw = () => drawPortrait(cv, cfg.previewLook ? cfg.previewLook() : cfg.look, dir, 0);
  body.querySelectorAll('[data-r]').forEach((b) => b.onclick = () => { dir = (dir + +b.dataset.r + 4) % 4; audio.sfx('select'); redraw(); });

  const set = (k, v) => {
    if (cfg.select) cfg.select(k, v); else cfg.look[k] = v;
    audio.sfx('select');
    render();
    if (cfg.onChange) cfg.onChange();
  };
  const sec = (title, html, extra = '') => `<section class="le-sec"><div class="le-h">${title}${extra}</div>${html}</section>`;

  function clothingTab(slot) {
    const ids = cfg.items(slot);
    const items = ids.map((id) => CLOTHES[id]).filter(Boolean);
    const cur = cfg.current(slot);
    const curItem = cur && CLOTHES[cur];
    const styles = [...new Set(items.map((c) => c.style))];
    let h = '';
    let tiles = OPTIONAL.has(slot) ? `<button class="le-tile ${!cur ? 'on' : ''}" data-k="${slot}" data-v=""><span class="ic">🚫</span><span class="nm">Nenhum</span></button>` : '';
    for (const st of styles) {
      const vars = items.filter((c) => c.style === st);
      const on = curItem && curItem.style === st;
      const pick = on ? cur : (cfg.mode === 'shop' ? vars.find((c) => !cfg.owned(c.id)) || vars[0] : vars[0]).id;
      const ownedAll = cfg.mode === 'shop' && vars.every((c) => cfg.owned(c.id));
      const tag = cfg.mode === 'shop' ? `<span class="pr">${ownedAll ? '✔ tem' : 'a partir de ' + money(Math.min(...vars.map((c) => c.price)))}</span>` : (vars.length > 1 ? `<span class="pr">${vars.length} ${st === 'jersey' ? 'times' : 'cores'}</span>` : '');
      tiles += `<button class="le-tile ${on ? 'on' : ''}" data-k="${slot}" data-v="${pick}" title="${esc(STYLE_NAMES[st] || st)}"><span class="ic">${STYLE_ICON[st] || '👕'}</span><span class="nm">${esc(STYLE_NAMES[st] || st)}</span>${tag}</button>`;
    }
    if (!items.length && !OPTIONAL.has(slot)) tiles += '<div class="muted">Nenhuma peça disponível.</div>';
    h += sec('Modelo', `<div class="le-tiles">${tiles}</div>`);
    if (curItem) {
      const vars = items.filter((c) => c.style === curItem.style);
      const label = `<b class="le-name">${esc(curItem.name)}</b>`;
      if (curItem.style === 'jersey') {
        h += sec('Time', `<div class="le-clubs">${vars.map((c) => `<button class="le-club ${c.id === cur ? 'on' : ''}" data-k="${slot}" data-v="${c.id}" title="${esc(c.name)}"><i style="background:${swatchBg(c)}"></i><span>${esc(shortClub(c))}</span>${cfg.mode === 'shop' && cfg.owned(c.id) ? '<em>✔</em>' : ''}</button>`).join('')}</div>`, ` • ${label}`);
      } else if (vars.length > 1 || cfg.mode === 'shop') {
        h += sec('Cor', `<div class="le-swatches">${vars.map((c) => `<button class="le-sw ${c.id === cur ? 'on' : ''}" data-k="${slot}" data-v="${c.id}" title="${esc(c.name)}" style="background:${swatchBg(c)}">${cfg.mode === 'shop' && cfg.owned(c.id) ? '<em>✔</em>' : ''}</button>`).join('')}</div>`, ` • ${label}`);
      } else h += sec('Peça', `<div>${label}</div>`);
    }
    return h;
  }

  function render() {
    tabsEl.innerHTML = cfg.tabs.map((t) => `<button class="le-tab ${t === tab ? 'on' : ''}" data-tab="${t}" title="${TAB_INFO[t][1]}"><span>${TAB_INFO[t][0]}</span><small>${TAB_INFO[t][1]}</small></button>`).join('');
    tabsEl.querySelectorAll('.le-tab').forEach((b) => b.onclick = () => { tab = b.dataset.tab; audio.sfx('select'); render(); });
    const L = cfg.look;
    let h = '';
    if (tab === 'body') {
      h += sec('Corpo', `<div class="le-tiles two">${[['m', '🧑', 'Masculino'], ['f', '👩', 'Feminino']].map(([v, ic, n]) => `<button class="le-tile ${L.body === v ? 'on' : ''}" data-k="body" data-v="${v}"><span class="ic">${ic}</span><span class="nm">${n}</span></button>`).join('')}</div>`);
      h += sec('Pele', `<div class="le-swatches">${SKINS.map((c, i) => `<button class="le-sw ${L.skin === i ? 'on' : ''}" style="background:${c}" data-k="skin" data-v="${i}"></button>`).join('')}</div>`);
      h += sec('Olhos', `<div class="le-swatches">${EYES.map((c, i) => `<button class="le-sw ${L.eyes === i ? 'on' : ''}" style="background:${c}" data-k="eyes" data-v="${i}"></button>`).join('')}</div>`);
    } else if (tab === 'hair') {
      h += sec('Corte', `<div class="le-tiles">${HAIR_STYLES.map(([v, n]) => `<button class="le-tile ${L.hair === v ? 'on' : ''}" data-k="hair" data-v="${v}"><span class="ic">${HAIR_ICON[v] || '💇'}</span><span class="nm">${n}</span></button>`).join('')}</div>`);
      const hc = HAIR_COLORS.find(([, c]) => c === L.hairColor);
      h += sec('Cor do cabelo', `<div class="le-swatches">${HAIR_COLORS.map(([n, c]) => `<button class="le-sw ${L.hairColor === c ? 'on' : ''}" title="${n}" style="background:${c}" data-k="hairColor" data-v="${c}"></button>`).join('')}</div>`, hc ? ` • <b class="le-name">${hc[0]}</b>` : '');
    } else h += clothingTab(tab);
    panel.innerHTML = h;
    panel.querySelectorAll('[data-k]').forEach((el) => el.onclick = () => {
      const k = el.dataset.k;
      let v = el.dataset.v;
      if (k === 'skin' || k === 'eyes') v = +v;
      if (v === '') v = null;
      set(k, v);
    });
    const sel = cfg.focus ? cfg.focus() : null;
    cap.innerHTML = sel ? sel : '';
    redraw();
  }
  render();
  return { render, redraw };
}

// options: { title, allowBody, allowHair, allowClothes, owned: [ids] | null, styles: [estilos] | null, confirmText, cancelable, random }
export function editLook(initial, options = {}) {
  const look = { ...DEFAULT_LOOK, ...initial };
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; layer.close(); resolve(v); };
    const tabs = [];
    if (options.allowBody !== false) tabs.push('body');
    if (options.allowHair !== false) tabs.push('hair');
    const allowed = (c) => (options.owned ? options.owned.includes(c.id) : options.styles ? options.styles.includes(c.style) : true);
    const items = (slot) => Object.values(CLOTHES).filter((c) => c.slot === slot && (allowed(c) || look[slot] === c.id)).map((c) => c.id);
    if (options.allowClothes !== false) for (const sl of SLOTS) if (OPTIONAL.has(sl) || items(sl).length) tabs.push(sl);
    let ed = null;
    const layer = ui.panel({
      title: options.title || 'Seu personagem', width: 'min(1000px,96vw)', cls: 'le-panel',
      build: (body) => {
        const wrap = document.createElement('div');
        body.appendChild(wrap);
        ed = buildEditor(wrap, { look, tabs, items, current: (sl) => look[sl], mode: 'edit' });
        const foot = document.createElement('div');
        foot.className = 'row le-foot';
        foot.innerHTML = `${options.random ? '<button class="btn" data-a="rand">🎲 Aleatório</button>' : ''}<div class="grow"></div>${options.cancelable === false ? '' : '<button class="btn" data-a="cancel">Cancelar</button>'}<button class="btn red ok">${esc(options.confirmText || 'Pronto!')}</button>`;
        body.appendChild(foot);
        foot.querySelector('.ok').onclick = () => { audio.sfx('confirm'); finish(look); };
        const c = foot.querySelector('[data-a=cancel]');
        if (c) c.onclick = () => finish(null);
        const r = foot.querySelector('[data-a=rand]');
        if (r) r.onclick = () => {
          const pick = (a) => a[Math.floor(Math.random() * a.length)];
          look.body = Math.random() < 0.5 ? 'm' : 'f';
          look.skin = Math.floor(Math.random() * SKINS.length);
          look.eyes = Math.floor(Math.random() * EYES.length);
          look.hair = pick(HAIR_STYLES)[0];
          look.hairColor = pick(HAIR_COLORS)[1];
          for (const sl of SLOTS) {
            const ids = items(sl);
            look[sl] = OPTIONAL.has(sl) && Math.random() < 0.35 ? null : ids.length ? pick(ids) : look[sl];
          }
          audio.sfx('select');
          ed.render();
        };
      },
      onKey: (k) => {
        if (k === 'b') { if (options.cancelable === false) return true; finish(null); return true; }
        return false;
      },
      onClose: () => { if (!done) { done = true; resolve(null); } },
    });
    if (options.cancelable === false) layer.el.querySelector('.close').style.display = 'none';
  });
}

// Visual da criação de personagem: só peças básicas (camisas de time e roupas
// especiais ficam para as Boutiques).
export function createLook(initial, title) {
  return editLook(initial, { title, styles: CREATOR_STYLES, cancelable: false, confirmText: 'Começar aventura!', random: true });
}

// Boutique: experimenta as peças à venda e compra/veste.
// opts: { stock: [ids], getLook(), wardrobe(), money(), buy(id) -> Promise<bool>, wear(id) }
export function shopLook(opts) {
  return new Promise((resolve) => {
    const slots = SLOTS.filter((sl) => opts.stock.some((id) => CLOTHES[id] && CLOTHES[id].slot === sl));
    const trying = {}; // slot -> peça sendo experimentada
    let focus = null;
    let ed = null, foot = null;
    const layer = ui.panel({
      title: opts.title || 'Boutique', width: 'min(1000px,96vw)', cls: 'le-panel', onClose: () => resolve(),
      build: (body) => {
        const wrap = document.createElement('div');
        body.appendChild(wrap);
        const look = () => ({ ...opts.getLook(), ...trying });
        const cfg = {
          get look() { return look(); },
          tabs: slots,
          mode: 'shop',
          items: (sl) => opts.stock.filter((id) => CLOTHES[id] && CLOTHES[id].slot === sl),
          current: (sl) => (sl in trying ? trying[sl] : opts.getLook()[sl]),
          owned: (id) => opts.wardrobe().includes(id),
          previewLook: look,
          select: (k, v) => { trying[k] = v; focus = v; paintFoot(); },
          focus: () => '',
        };
        ed = buildEditor(wrap, cfg);
        foot = document.createElement('div');
        foot.className = 'row le-foot';
        body.appendChild(foot);
        const paintFoot = () => {
          const c = focus && CLOTHES[focus];
          const has = c && opts.wardrobe().includes(c.id);
          const wearing = c && opts.getLook()[c.slot] === c.id;
          foot.innerHTML = `<span class="muted">Seu dinheiro: <b>${money(opts.money())}</b></span><div class="grow"></div>
            ${c ? `<span class="le-buyname"><b>${esc(c.name)}</b> ${has ? '<span class="tagok">✔ no guarda-roupa</span>' : `<span class="price">${money(c.price)}</span>`}</span>` : '<span class="muted">Escolha uma peça para experimentar</span>'}
            <button class="btn ${has ? 'blue' : 'red'}" data-a="buy" ${!c || wearing ? 'disabled' : ''}>${!c ? 'Comprar' : wearing ? 'Vestindo' : has ? 'Vestir' : 'Comprar'}</button>`;
          const b = foot.querySelector('[data-a=buy]');
          b.onclick = async () => {
            if (!c) return;
            if (!opts.wardrobe().includes(c.id)) {
              if (!(await opts.buy(c.id))) return;
              if (!(await ui.ask('Quer vestir agora?'))) { paintFoot(); ed.render(); return; }
            }
            opts.wear(c.id);
            delete trying[c.slot];
            paintFoot();
            ed.render();
          };
        };
        paintFoot();
      },
    });
    void layer;
  });
}
