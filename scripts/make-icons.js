// Иконка приложения: раскрытая книга с закладкой (рисуем сами, без чужих логотипов).
// Делает site/icons/*.png из SVG. Запуск: node scripts/make-icons.js
import fs from 'node:fs';
import sharp from 'sharp';

// full — фон до самого края (для iOS и обычной иконки), pad — доля отступа под маску Android
function svg({ pad = 0 } = {}) {
  const s = 512, inner = s * (1 - pad * 2), o = s * pad;
  const k = inner / 512; // масштаб рисунка
  const t = (x, y) => `${(o + x * k).toFixed(1)},${(o + y * k).toFixed(1)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="75%">
      <stop offset="0" stop-color="#3f6343"/><stop offset="1" stop-color="#1f3324"/>
    </radialGradient>
    <linearGradient id="page" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fbf3df"/><stop offset="1" stop-color="#e9d9b4"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f1d58a"/><stop offset="1" stop-color="#b8892f"/>
    </linearGradient>
  </defs>
  <rect width="${s}" height="${s}" fill="url(#bg)"/>
  <!-- Золотая рамка -->
  <rect x="${o + 22 * k}" y="${o + 22 * k}" width="${468 * k}" height="${468 * k}" rx="${70 * k}" fill="none" stroke="url(#gold)" stroke-width="${7 * k}" opacity=".85"/>
  <!-- Обложка под страницами -->
  <path d="M${t(70, 368)} Q${t(256, 330)} ${t(442, 368)} L${t(442, 392)} Q${t(256, 356)} ${t(70, 392)} Z" fill="#7a2430"/>
  <!-- Левая и правая страницы -->
  <path d="M${t(256, 158)} Q${t(170, 118)} ${t(84, 142)} L${t(84, 362)} Q${t(170, 340)} ${t(256, 372)} Z" fill="url(#page)" stroke="#5a3d22" stroke-width="${5 * k}" stroke-linejoin="round"/>
  <path d="M${t(256, 158)} Q${t(342, 118)} ${t(428, 142)} L${t(428, 362)} Q${t(342, 340)} ${t(256, 372)} Z" fill="url(#page)" stroke="#5a3d22" stroke-width="${5 * k}" stroke-linejoin="round"/>
  <!-- Строки текста -->
  ${[0, 1, 2, 3, 4].map(i => `
  <path d="M${t(112, 182 + i * 34)} Q${t(170, 166 + i * 34)} ${t(228, 186 + i * 34)}" fill="none" stroke="#8a6a44" stroke-width="${6 * k}" stroke-linecap="round" opacity=".55"/>
  <path d="M${t(284, 186 + i * 34)} Q${t(342, 166 + i * 34)} ${t(400, 182 + i * 34)}" fill="none" stroke="#8a6a44" stroke-width="${6 * k}" stroke-linecap="round" opacity=".55"/>`).join('')}
  <!-- Закладка -->
  <path d="M${t(256, 160)} L${t(256, 440)} L${t(240, 420)} L${t(224, 440)} L${t(224, 156)} Z" fill="#9c2d3a" transform="translate(${16 * k},0)"/>
  <!-- Звезда над книгой -->
  <path d="M${t(256, 62)} L${t(268, 96)} L${t(304, 98)} L${t(276, 120)} L${t(286, 154)} L${t(256, 134)} L${t(226, 154)} L${t(236, 120)} L${t(208, 98)} L${t(244, 96)} Z" fill="url(#gold)"/>
</svg>`;
}

fs.mkdirSync('site/icons', { recursive: true });
fs.writeFileSync('site/icons/icon.svg', svg());
const jobs = [
  ['apple-touch-icon.png', 180, {}],
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-maskable-512.png', 512, { pad: 0.1 }],
  ['favicon-32.png', 32, {}],
];
for (const [name, size, opt] of jobs) {
  await sharp(Buffer.from(svg(opt))).resize(size, size).png().toFile(`site/icons/${name}`);
}
console.log('Иконки готовы');
