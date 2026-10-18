// Этап 2: находим все карты колод в Scryfall, выбираем нужную версию,
// скачиваем картинки и печатаем сводку.
// Запуск: node scripts/fetch-cards.js
// Повторный запуск в сеть не ходит: всё берётся из data/raw и data/images-original.
import fs from 'node:fs';
import { searchAll, download, slug } from './lib/scryfall.js';

const decks = JSON.parse(fs.readFileSync('data/decks.json', 'utf8')).decks;

// Уникальные названия в порядке первого появления
const names = [];
for (const d of decks) for (const list of Object.values(d.sections)) for (const [, n] of list) {
  if (!names.includes(n)) names.push(n);
}

// Особое оформление, которое по умолчанию не берём
const isSpecial = c =>
  c.border_color === 'borderless' || c.full_art || c.promo ||
  (c.frame_effects || []).some(f => ['showcase', 'extendedart', 'inverted', 'etched'].includes(f)) ||
  (c.promo_types || []).some(t => !['universesbeyond'].includes(t));

// Сопутствующие наборы «Хоббита», кроме арт-карт (ahob) — в них не играют
const isHobbitSet = c => c.set !== 'hob' && /hobbit/i.test(c.set_name) && c.set_type !== 'memorabilia';

// Совпадение по точному названию: целиком или по одной из сторон
const nameMatches = (c, n) => c.name === n || (c.card_faces || []).some(f => f.name === n);

const picked = [];
const report = { notFound: [], notHob: [], variants: [] };

for (const name of names) {
  const s = slug(name);
  const res = await searchAll(`!"${name}"`, `data/raw/search/${s}.json`,
    '&unique=prints&include_extras=true&include_variations=true');
  const prints = res.data.filter(c => c.lang === 'en' && !c.digital && nameMatches(c, name));
  if (!prints.length) { report.notFound.push(name); continue; }

  // Порядок поиска: hob → сопутствующие наборы «Хоббита» → любой сет
  const hob = prints.filter(c => c.set === 'hob');
  const related = prints.filter(isHobbitSet);
  const pool = hob.length ? hob : related.length ? related : prints;
  const normal = pool.filter(c => !isSpecial(c));
  const byNumber = (a, b) => parseInt(a.collector_number) - parseInt(b.collector_number);
  const card = (normal.length ? normal : pool).sort(byNumber)[0];

  if (card.set !== 'hob') report.notHob.push(`${name} → ${card.set} (${card.set_name}) №${card.collector_number}`);

  // Несколько вариантов оформления в наборах «Хоббита»
  const hobbitPrints = prints.filter(c => c.set === 'hob' || isHobbitSet(c));
  if (hobbitPrints.length > 1) {
    report.variants.push(`${name}: ` + hobbitPrints.map(c =>
      `${c.set} №${c.collector_number} (${describe(c)})${c.id === card.id ? ' ← взяли' : ''}`).join('; '));
  }

  // Картинки: у двусторонних карт — у каждой стороны своя
  const faces = card.image_uris ? [card.image_uris] : card.card_faces.map(f => f.image_uris);
  const images = [];
  for (let i = 0; i < faces.length; i++) {
    const file = `data/images-original/${s}${i ? '-back' : ''}.png`;
    if (await download(faces[i].png, file)) console.log('  картинка:', file);
    images.push(file);
  }
  picked.push({ deckName: name, slug: s, images, card });
  console.log(`✓ ${name} — ${card.set} №${card.collector_number}, ${card.layout}`);
}

fs.writeFileSync('data/scryfall-cards.json', JSON.stringify(picked, null, 2));

// ---- Сводка ----
function describe(c) {
  const parts = [];
  if (c.border_color === 'borderless') parts.push('без рамки');
  if (c.full_art) parts.push('полноразмерный арт');
  for (const f of c.frame_effects || []) if (f !== 'legendary') parts.push(f);
  for (const p of c.promo_types || []) if (p !== 'universesbeyond') parts.push(p);
  return parts.join(', ') || 'обычная';
}
const layouts = {};
for (const p of picked) (layouts[p.card.layout] ??= []).push(p.deckName);

console.log('\n===== СВОДКА =====');
console.log(`Найдено: ${picked.length} из ${names.length}`);
console.log('Не найдены:', report.notFound.length ? '\n  ' + report.notFound.join('\n  ') : 'нет');
console.log('Найдены не в hob:', report.notHob.length ? '\n  ' + report.notHob.join('\n  ') : 'нет');
console.log('Раскладки:');
for (const [l, list] of Object.entries(layouts)) console.log(`  ${l}: ${list.length}` + (l !== 'normal' ? ' — ' + list.join(', ') : ''));
console.log('Несколько вариантов оформления:', report.variants.length ? '\n  ' + report.variants.join('\n  ') : 'нет');
fs.writeFileSync('data/raw/fetch-report.json', JSON.stringify({ ...report, layouts }, null, 2));
