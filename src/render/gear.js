// Klassenwaffen als Canvas-Zeichnungen (Phase 9): für Icons, Geschosse und den Klassen-Wähler.
// Alle Formen liegen um (0, 0), etwa 60 Einheiten groß, Spitze/Kopf nach oben.
import { TAU } from '../core/util.js';

const OL = '#0a0f06';
function st(g, fill, lw = 2.5) { g.fillStyle = fill; g.fill(); g.strokeStyle = OL; g.lineWidth = lw; g.stroke(); }

// Bogen mit Sehne (gold: Meister-Stufe)
export function drawBow(g, gold = false) {
  g.beginPath(); g.moveTo(-4, -28); g.quadraticCurveTo(22, 0, -4, 28);
  g.lineWidth = 9; g.strokeStyle = OL; g.stroke(); g.lineWidth = 5; g.strokeStyle = gold ? '#f4c430' : '#8a5a32'; g.stroke();
  g.beginPath(); g.moveTo(-4, -28); g.lineTo(-4, 28); g.lineWidth = 1.6; g.strokeStyle = '#f2ead6'; g.stroke();
  g.beginPath(); g.rect(3, -5, 7, 10); st(g, '#3b2414', 2);
}
// Pfeil nach rechts (Geschoss)
export function drawArrow(g) {
  g.beginPath(); g.roundRect(-24, -2, 40, 4, 2); st(g, '#a8763e', 2);
  g.beginPath(); g.moveTo(14, -6); g.lineTo(28, 0); g.lineTo(14, 6); g.closePath(); st(g, '#d6dde2', 2);
  g.beginPath(); g.moveTo(-26, -7); g.lineTo(-16, 0); g.lineTo(-26, 7); g.lineTo(-20, 0); g.closePath(); st(g, '#e5484d', 1.6);
}
// Zauberstab mit leuchtendem Kristall
export function drawStaff(g, gold = false) {
  g.beginPath(); g.moveTo(-3, 28); g.lineTo(3, -14); g.lineWidth = 8; g.strokeStyle = OL; g.stroke(); g.lineWidth = 4.5; g.strokeStyle = gold ? '#f4c430' : '#6b4424'; g.stroke();
  const gr = g.createRadialGradient(4, -22, 2, 4, -22, 16); gr.addColorStop(0, 'rgba(190,150,255,.9)'); gr.addColorStop(1, 'rgba(150,90,255,0)');
  g.fillStyle = gr; g.fillRect(-14, -40, 36, 36);
  g.beginPath(); g.moveTo(4, -34); g.lineTo(11, -22); g.lineTo(4, -12); g.lineTo(-3, -22); g.closePath(); st(g, '#a77bff', 2);
  g.beginPath(); g.moveTo(4, -31); g.lineTo(7, -22); g.lineTo(4, -20); g.closePath(); g.fillStyle = '#efe4ff'; g.fill();
}
// Magie-Kugel (Geschoss)
export function drawOrb(g) {
  const gr = g.createRadialGradient(0, 0, 2, 0, 0, 22); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.35, '#c9a8ff'); gr.addColorStop(.7, 'rgba(140,80,255,.55)'); gr.addColorStop(1, 'rgba(120,60,255,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 22, 0, TAU); g.fill();
}
// Keule mit Nieten
export function drawClub(g, gold = false) {
  g.beginPath(); g.moveTo(-3, 28); g.lineTo(-1, 0); g.lineWidth = 8; g.strokeStyle = OL; g.stroke(); g.lineWidth = 4.5; g.strokeStyle = '#5a3a22'; g.stroke();
  g.beginPath(); g.moveTo(-6, 2); g.quadraticCurveTo(-12, -24, 2, -30); g.quadraticCurveTo(14, -24, 6, 2); g.closePath(); st(g, gold ? '#f4c430' : '#a8763e');
  g.fillStyle = '#c9d1d8'; for (const [x, y] of [[-4, -14], [4, -20], [3, -6]]) { g.beginPath(); g.arc(x, y, 2.4, 0, TAU); g.fill(); g.lineWidth = 1.2; g.strokeStyle = OL; g.stroke(); }
}
