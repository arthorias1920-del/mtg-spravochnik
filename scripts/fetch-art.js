// Арт для плиток колод на главном экране (art_crop из Scryfall).
// На плитке обязательно подписаны художник и «© Wizards of the Coast».
// Запуск: node scripts/fetch-art.js   → site/img/art/*.webp, data/art-credits.json
import fs from 'node:fs';
import sharp from 'sharp';
import { download } from './lib/scryfall.js';

// Какая карта даёт арт какой колоде
const PICK = {
  dwarves: 'thorin-oakenshield',
  humans: 'bard-the-bowman',
  goblins: 'the-great-goblin',
  elves: 'thranduil-sindarin-liege',
};

const picked = JSON.parse(fs.readFileSync('data/scryfall-cards.json', 'utf8'));
fs.mkdirSync('site/img/art', { recursive: true });
const credits = {};
for (const [deck, slug] of Object.entries(PICK)) {
  const c = picked.find(x => x.slug === slug).card;
  const uris = c.image_uris || c.card_faces[0].image_uris;
  const raw = `data/images-original/art-${slug}.jpg`;
  await download(uris.art_crop, raw);
  // Только уменьшаем с сохранением пропорций, ничего не обрезаем и не перекрашиваем
  await sharp(raw).resize({ width: 640, withoutEnlargement: true }).webp({ quality: 85 }).toFile(`site/img/art/${deck}.webp`);
  credits[deck] = { card: slug, artist: c.artist || c.card_faces[0].artist };
}
fs.writeFileSync('data/art-credits.json', JSON.stringify(credits, null, 1));
console.log('Арт для плиток готов:', Object.keys(credits).join(', '));
