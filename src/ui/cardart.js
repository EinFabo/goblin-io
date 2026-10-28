import { CARD_MAX, CARD_RARITY, CHESTS, RARITY, cardName, isWeapon, upgradeCost } from '../data/cards.js';
import { COSMO_CHEST } from '../data/cosmetics.js';
import { icon } from '../render/icons.js';
import { RUNES, RUNE_BAG, parseRune, tierInfo } from '../data/runes.js';

// ---------- Bilder für Truhen und Karten (SVG/HTML) ----------
// Truhe: Korpus aus Brettern mit Metallbeschlägen, Deckel als eigene Gruppe (.lid) zum Aufklappen
export function chestSvg(type, cls = '') {
  const C = CHESTS[type] || (type === 'runebag' ? RUNE_BAG : COSMO_CHEST), c = C.color, m = C.metal, dark = 'rgba(0,0,0,.28)';
  const rune = type === 'runebag' ? `<path d="M56 52v18M56 52l8 4.5-8 4.5 8 9" stroke="${m}" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : type === 'cosmo' ? `<path d="M52 60h16M60 52v16" stroke="${m}" stroke-width="4" stroke-linecap="round"/><circle cx="60" cy="60" r="4" fill="${m}"/>` : type === 'mage' ? `<path d="M60 58l3 7 7 .5-5.5 4.5 2 7-6.5-4-6.5 4 2-7-5.5-4.5 7-.5Z" fill="${m}" stroke="#1a1408" stroke-width="1.2"/>` : '';
  return `<svg class="chest ${cls}" viewBox="0 0 120 104" aria-hidden="true">
    <ellipse cx="60" cy="96" rx="48" ry="7" fill="rgba(0,0,0,.35)"/>
    <g class="body">
      <rect x="12" y="44" width="96" height="48" rx="4" fill="${c}" stroke="#140c05" stroke-width="3"/>
      <path d="M14 60h92M14 76h92" stroke="${dark}" stroke-width="2"/>
      <rect x="12" y="44" width="10" height="48" fill="${m}" stroke="#140c05" stroke-width="2"/><rect x="98" y="44" width="10" height="48" fill="${m}" stroke="#140c05" stroke-width="2"/>
      <rect x="50" y="46" width="20" height="24" rx="3" fill="${m}" stroke="#140c05" stroke-width="2"/><circle cx="60" cy="56" r="3" fill="#140c05"/><path d="M60 58v6" stroke="#140c05" stroke-width="2.4"/>
      <path d="M23 80h75v10H23Z" fill="rgba(28,20,48,.22)"/><path d="M25 49h24" stroke="rgba(255,248,232,.3)" stroke-width="3" stroke-linecap="round"/>
      ${rune}
    </g>
    <g class="lid"${type === 'gold' ? ' style="--lk:.56"' : type === 'mage' ? ' style="--lk:.53"' : ''}>${lid(type, c, m, dark)}</g>
  </svg>`;
}

// Deckel je Truhenart (Phase 13): eigene Silhouette, Glanz oben links. Holz flach mit Brettern, Eisen gewölbt mit Nieten,
// Gold hoch gewölbt mit Juwel, Magier spitz wie ein Zauberhut; Runenbeutel und Kosmetik behalten den gewölbten Deckel.
// --lk: die hohen Deckel sind etwa doppelt so hoch, die Öffnen-Animation (translateY in % der Deckelhöhe) wird damit gleich weit
function lid(type, c, m, dark) {
  const ol = 'stroke="#140c05" stroke-width="3" stroke-linejoin="round"', lock = `<rect x="52" y="38" width="16" height="10" rx="2" fill="${m}" stroke="#140c05" stroke-width="2"/>`;
  const gloss = (d, w = 5) => `<path d="${d}" stroke="rgba(255,248,232,.4)" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
  if (type === 'wood') return `<path d="M10 46 L16 24 H104 L110 46 Z" fill="${c}" ${ol}/>
      <path d="M14 35h92" stroke="${dark}" stroke-width="2"/><path d="M40 24v22M80 24v22" stroke="${dark}" stroke-width="1.6"/>
      <path d="M22 46 L26 24M98 46 L94 24" stroke="${m}" stroke-width="6"/>${gloss('M20 29h28', 3)}${lock}`;
  if (type === 'gold') return `<path d="M8 46 C8 6, 112 6, 112 46 Z" fill="${c}" ${ol}/>
      <path d="M18 30 C40 20, 80 20, 102 30" stroke="${dark}" stroke-width="2" fill="none"/>
      <path d="M22 46 C22 18, 32 14, 38 12 M98 46 C98 18, 88 14, 82 12" stroke="${m}" stroke-width="7" fill="none"/>
      <path d="M52 15 L60 4 L68 15 L60 21 Z" fill="#e5484d" stroke="#140c05" stroke-width="2"/><path d="M57 10 L60 7" stroke="#fff" stroke-width="1.6"/>
      ${gloss('M24 26 C30 18, 40 15, 46 14')}${lock}`;
  if (type === 'mage') return `<path d="M10 46 C12 32, 38 28, 52 12 C56 6, 62 2, 70 6 C64 8, 62 14, 66 22 C78 32, 106 32, 110 46 Z" fill="${c}" ${ol}/>
      <path d="M14 42 C40 34, 80 34, 106 42" stroke="${m}" stroke-width="5" fill="none"/>
      <path d="M58 22l2 4.5 4.8.4-3.7 3 1.3 4.7-4.4-2.6-4.4 2.6 1.3-4.7-3.7-3 4.8-.4Z" fill="${m}" stroke="#140c05" stroke-width="1"/>
      ${gloss('M22 36 C34 30, 44 24, 50 16', 4)}${lock}`;
  const rivets = type === 'iron' ? [26, 46, 74, 94].map(x => `<circle cx="${x}" cy="${x < 40 || x > 80 ? 34 : 28}" r="2.4" fill="${m}" stroke="#140c05" stroke-width="1"/>`).join('') : '';
  return `<path d="M12 46 C12 16, 108 16, 108 46 Z" fill="${c}" ${ol}/>
      <path d="M20 34 C40 26, 80 26, 100 34" stroke="${dark}" stroke-width="2" fill="none"/>
      <path d="M22 46 C22 22, 30 20, 34 19 M98 46 C98 22, 90 20, 86 19" stroke="${m}" stroke-width="7" fill="none"/>
      ${rivets}${gloss('M26 30 C32 24, 40 22, 46 21')}${lock}`;
}

// Karte: Icon, Name, Seltenheit, Stufe, Fortschritt zur nächsten Stufe
export function cardHtml(id, st, extra = '') {
  const r = CARD_RARITY[id], cost = upgradeCost(id, st.lv), ready = cost && st.n >= cost.cards;
  const bar = st.lv >= CARD_MAX ? '<div class="cbar max"><i style="width:100%"></i><span>Max</span></div>'
    : `<div class="cbar${ready ? ' ready' : ''}"><i style="width:${Math.min(100, st.n / cost.cards * 100).toFixed(0)}%"></i><span>${st.n} / ${cost.cards}</span></div>`;
  return `<div class="ccard r-${r}${ready ? ' up' : ''}" style="--rc:${RARITY[r].color}" ${extra}>
    ${r === 'epic' || r === 'legendary' ? '<i class="foil"></i>' : ''}<span class="clv">Stufe ${st.lv}</span><img src="${icon(id)}" alt=""><b>${cardName(id)}</b><small>${isWeapon(id) ? 'Waffe' : 'Passiv'}</small>${bar}</div>`;
}

// Rune: Steinplättchen mit eingeritztem, glühendem Zeichen; der Rand zeigt die Seltenheit (Wunsch Fabi 2026-10-16)
// Der Stein ist bei allen Runen gleich grau, damit Farbe = Runenart und Rand = Stufe eindeutig bleiben
export function runeSvg(key, cls = '') {
  const p = parseRune(key); if (!p) return '';
  const R = RUNES[p.id], rc = tierInfo(p.tier).color, g = R.glyph;
  return `<svg class="rune t${p.tier} ${cls}" viewBox="0 0 40 46" aria-hidden="true">
    <path d="M9 2.5h22l6.5 7v27l-6.5 7H9l-6.5-7v-27Z" fill="#6c6760" stroke="${rc}" stroke-width="${(2.2 + p.tier * .5).toFixed(1)}" stroke-linejoin="round"/>
    <path d="M10 5h20l4.5 5h-29Z" fill="rgba(255,255,255,.16)"/><path d="M5.5 33.5 10 41h20l4.5-7.5Z" fill="rgba(0,0,0,.24)"/>
    <path d="M6 14l3 1M33 25l-3 2M12 36l2-1.5" stroke="rgba(0,0,0,.25)" stroke-width="1" fill="none"/>
    <g transform="translate(10 13)" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="${g}" stroke="rgba(0,0,0,.5)" stroke-width="3.6" transform="translate(.7 .9)"/>
      <path d="${g}" stroke="${R.col}" stroke-width="5.5" opacity=".3"/>
      <path d="${g}" stroke="${R.col}" stroke-width="2.3"/>
      <path d="${g}" stroke="#fff" stroke-width=".8" opacity=".55"/>
    </g>
  </svg>`;
}
