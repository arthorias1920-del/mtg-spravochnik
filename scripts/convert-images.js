// Сжимаем исходные PNG от Scryfall в WebP для приложения.
// Размер и пропорции не меняем, цвета не трогаем — только сжатие.
// Качество 95: визуально без потерь (сжатие совсем без потерь дало бы ~59 МБ).
// Запуск: node scripts/convert-images.js
import fs from 'node:fs';
import sharp from 'sharp';

const QUALITY = 95;
const picked = JSON.parse(fs.readFileSync('data/scryfall-cards.json', 'utf8'));
fs.mkdirSync('site/img/cards', { recursive: true });

let total = 0;
for (const p of picked) {
  for (const src of p.images) {
    const out = 'site/img/cards/' + src.split('/').pop().replace(/\.png$/, '.webp');
    if (!fs.existsSync(out)) {
      await sharp(src).webp({ quality: QUALITY, effort: 6, smartSubsample: true }).toFile(out);
    }
    total += fs.statSync(out).size;
  }
}
console.log(`Готово: ${picked.length} карт, ${(total / 1048576).toFixed(1)} МБ`);
