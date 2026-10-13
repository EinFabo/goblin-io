import { CARD_MAX, CARD_RARITY, CHESTS, RARITY, cardName, isWeapon, upgradeCost } from '../data/cards.js';
import { COSMO_CHEST } from '../data/cosmetics.js';
import { icon } from '../render/icons.js';

// ---------- Bilder für Truhen und Karten (SVG/HTML) ----------
// Truhe: Korpus aus Brettern mit Metallbeschlägen, Deckel als eigene Gruppe (.lid) zum Aufklappen
export function chestSvg(type, cls = '') {
  const C = CHESTS[type] || COSMO_CHEST, c = C.color, m = C.metal, dark = 'rgba(0,0,0,.28)';
  const rune = type === 'cosmo' ? `<path d="M52 60h16M60 52v16" stroke="${m}" stroke-width="4" stroke-linecap="round"/><circle cx="60" cy="60" r="4" fill="${m}"/>` : type === 'mage' ? `<path d="M60 58l3 7 7 .5-5.5 4.5 2 7-6.5-4-6.5 4 2-7-5.5-4.5 7-.5Z" fill="${m}" stroke="#1a1408" stroke-width="1.2"/>` : '';
  return `<svg class="chest ${cls}" viewBox="0 0 120 104" aria-hidden="true">
    <ellipse cx="60" cy="96" rx="48" ry="7" fill="rgba(0,0,0,.35)"/>
    <g class="body">
      <rect x="12" y="44" width="96" height="48" rx="4" fill="${c}" stroke="#140c05" stroke-width="3"/>
      <path d="M14 60h92M14 76h92" stroke="${dark}" stroke-width="2"/>
      <rect x="12" y="44" width="10" height="48" fill="${m}" stroke="#140c05" stroke-width="2"/><rect x="98" y="44" width="10" height="48" fill="${m}" stroke="#140c05" stroke-width="2"/>
      <rect x="50" y="46" width="20" height="24" rx="3" fill="${m}" stroke="#140c05" stroke-width="2"/><circle cx="60" cy="56" r="3" fill="#140c05"/><path d="M60 58v6" stroke="#140c05" stroke-width="2.4"/>
      ${rune}
    </g>
    <g class="lid">
      <path d="M12 46 C12 16, 108 16, 108 46 Z" fill="${c}" stroke="#140c05" stroke-width="3" stroke-linejoin="round"/>
      <path d="M20 34 C40 26, 80 26, 100 34" stroke="${dark}" stroke-width="2" fill="none"/>
      <path d="M22 46 C22 22, 30 20, 34 19 M98 46 C98 22, 90 20, 86 19" stroke="${m}" stroke-width="7" fill="none"/>
      <rect x="52" y="38" width="16" height="10" rx="2" fill="${m}" stroke="#140c05" stroke-width="2"/>
    </g>
  </svg>`;
}

// Karte: Icon, Name, Seltenheit, Stufe, Fortschritt zur nächsten Stufe
export function cardHtml(id, st, extra = '') {
  const r = CARD_RARITY[id], cost = upgradeCost(id, st.lv), ready = cost && st.n >= cost.cards;
  const bar = st.lv >= CARD_MAX ? '<div class="cbar max"><i style="width:100%"></i><span>Max</span></div>'
    : `<div class="cbar${ready ? ' ready' : ''}"><i style="width:${Math.min(100, st.n / cost.cards * 100).toFixed(0)}%"></i><span>${st.n} / ${cost.cards}</span></div>`;
  return `<div class="ccard r-${r}${ready ? ' up' : ''}" style="--rc:${RARITY[r].color}" ${extra}>
    <span class="clv">Stufe ${st.lv}</span><img src="${icon(id)}" alt=""><b>${cardName(id)}</b><small>${isWeapon(id) ? 'Waffe' : 'Passiv'}</small>${bar}</div>`;
}
