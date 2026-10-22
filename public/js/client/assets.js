// Sprites oficiais dos Pokémon (carregados do repositório público da PokeAPI) com cache.
const BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites';

export const spriteUrl = {
  front: (id, shiny) => `${BASE}/pokemon/versions/generation-v/black-white/animated/${shiny ? 'shiny/' : ''}${id}.gif`,
  back: (id, shiny) => `${BASE}/pokemon/versions/generation-v/black-white/animated/back/${shiny ? 'shiny/' : ''}${id}.gif`,
  frontStatic: (id, shiny) => `${BASE}/pokemon/versions/generation-v/black-white/${shiny ? 'shiny/' : ''}${id}.png`,
  icon: (id) => `${BASE}/pokemon/versions/generation-vii/icons/${id}.png`,
  art: (id) => `${BASE}/pokemon/other/official-artwork/${id}.png`,
  item: (name) => `${BASE}/items/${name}.png`,
};

const cache = new Map();

// Carrega uma imagem; nunca rejeita (retorna null em caso de erro).
export function loadImage(url) {
  if (cache.has(url)) return cache.get(url);
  const p = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { p.img = img; resolve(img); };
    img.onerror = () => resolve(null);
    img.src = url;
  });
  cache.set(url, p);
  return p;
}

// Retorna a imagem se já carregada, senão dispara o carregamento e retorna null.
export function imageNow(url) {
  const p = cache.get(url) || loadImage(url);
  return p.img || null;
}

// Fallback quando a imagem não carrega (sem internet): uma silhueta de Poké Bola.
export function fallbackSprite() {
  return 'data:image/svg+xml,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="22" fill="#e3403b" stroke="#333" stroke-width="3"/><path d="M10 32a22 22 0 0 0 44 0z" fill="#fff" stroke="#333" stroke-width="3"/><circle cx="32" cy="32" r="7" fill="#fff" stroke="#333" stroke-width="3"/></svg>`);
}

// <img> que mostra primeiro o sprite estático (leve, aparece rápido) e troca
// pelo animado assim que ele terminar de carregar.
export function monImg(id, shiny = false, cls = '') {
  const anim = spriteUrl.front(id, shiny);
  return `<img class="${cls}" src="${spriteUrl.frontStatic(id, shiny)}" data-anim="${anim}" alt=""`
    + ` onload="if(this.dataset.anim){const a=this.dataset.anim;this.removeAttribute('data-anim');const im=new Image();im.onload=()=>{this.src=a};im.src=a}"`
    + ` onerror="this.onerror=null;this.removeAttribute('data-anim');this.src='${fallbackSprite()}'">`;
}

export function imgTag(url, cls = '', alt = '') {
  return `<img class="${cls}" src="${url}" alt="${alt}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackSprite()}'">`;
}
