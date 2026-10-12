// ---------- Magierhüte statt Sterne (PLAN 6.1a) ----------
// Lila Spitzhut mit goldenem Band und Stern. Leere Plätze grau.
const HAT = `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 3 35 34H13Z" fill="#8a4fd6" stroke="#0a0f06" stroke-width="3" stroke-linejoin="round"/><path d="M28 9c6 0 10 3 12 7" stroke="#0a0f06" stroke-width="3" fill="none"/><ellipse cx="24" cy="36" rx="20" ry="7" fill="#6a35b0" stroke="#0a0f06" stroke-width="3"/><path d="M15 30h18" stroke="#f4d03f" stroke-width="4"/><path d="m22 16 2-4 2 4 4 .5-3 3 1 4-4-2-4 2 1-4-3-3z" fill="#f4d03f" stroke="#0a0f06" stroke-width="1.5"/></svg>`;
export const HAT_TXT = ['geschafft', 'mit über 50 % Leben ins Ziel', 'nie unter 25 % Leben gefallen'];
// n Hüte von 3; neu = wie viele davon gerade dazugekommen sind (springen rein)
export function hatsHtml(n, neu = 0) {
  return `<span class="hats" role="img" aria-label="${n} von 3 Magierhüten">${[0, 1, 2].map(i =>
    `<i class="${i < n ? 'on' : ''}${i < n && i >= n - neu ? ' new' : ''}" style="--d:${i * .18}s">${HAT}</i>`).join('')}</span>`;
}
export const hatSvg = HAT;
