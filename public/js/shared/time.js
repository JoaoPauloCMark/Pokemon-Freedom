// Relógio do jogo: 1 dia no jogo = 48 minutos reais (sincronizado pelo servidor).
export const DAY_MS = 48 * 60 * 1000;

export function gameHour(ms) {
  return ((ms % DAY_MS) / DAY_MS) * 24;
}

export function timeOfDay(ms) {
  const h = gameHour(ms);
  if (h >= 21 || h < 5) return 'night';
  if (h < 6.5) return 'dawn';
  if (h >= 18.5) return 'dusk';
  return 'day';
}

export function isNight(ms) {
  const t = timeOfDay(ms);
  return t === 'night';
}

export function clockText(ms) {
  const h = gameHour(ms);
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
