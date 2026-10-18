// Собираем всё, что нужно приложению, в один файл site/data/app.json:
// колоды, перевод карт, геометрию областей, цвета плашек и размеры шрифтов.
// Запуск: node scripts/build-app-data.js
import fs from 'node:fs';
import { geometry, loadJson } from './lib/cardinfo.js';

const decks = loadJson('data/decks.json').decks;
const picked = loadJson('data/scryfall-cards.json');
const translations = loadJson('data/cards.json');
const plates = loadJson('data/plates.json');
const fit = fs.existsSync('data/fit.json') ? loadJson('data/fit.json') : {};
const art = loadJson('data/art-credits.json'); // арт для плиток колод (scripts: см. README)

const byName = Object.fromEntries(picked.map(p => [p.deckName, p]));
const cards = {};
const missing = [];

for (const [name, p] of Object.entries(byName)) {
  const ru = translations[name];
  if (!ru) { missing.push(name); continue; }
  const { sagaLayout, ...ruText } = ru;
  const c = p.card;
  cards[p.slug] = {
    slug: p.slug,
    en: name,
    image: `img/cards/${p.slug}.webp`,
    colors: c.colors ?? c.card_faces?.[0].colors ?? [],
    geo: geometry(c, ru),
    ru: ruText,
    plates: plates[p.slug] || {},
    fit: fit[p.slug] || null,
  };
}

// Колоды: только переведённые карты (пока идёт перевод)
const appDecks = decks.map(d => {
  const sections = {};
  const colors = new Set();
  for (const [sec, list] of Object.entries(d.sections)) {
    sections[sec] = list.filter(([, n]) => cards[byName[n].slug]).map(([count, n]) => {
      for (const col of byName[n].card.color_identity) colors.add(col);
      return { slug: byName[n].slug, count };
    });
  }
  const total = Object.values(d.sections).flat().reduce((s, [n]) => s + n, 0);
  return {
    id: d.id, title: d.title, total, colors: 'WUBRG'.split('').filter(c => colors.has(c)), sections,
    art: { image: `img/art/${d.id}.webp`, artist: art[d.id].artist },
  };
});

fs.mkdirSync('site/data', { recursive: true });
fs.writeFileSync('site/data/app.json', JSON.stringify({ decks: appDecks, cards }));
console.log(`app.json: ${Object.keys(cards).length} карт` + (missing.length ? `, без перевода: ${missing.length}` : ''));
