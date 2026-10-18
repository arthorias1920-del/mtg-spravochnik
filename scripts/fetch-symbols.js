// Скачиваем значки маны ({T}, {R}, {2}, {R/W}…), которые встречаются в текстах карт.
// Хранятся в site/img/symbols, приложение не обращается к Scryfall.
// Запуск: node scripts/fetch-symbols.js
import fs from 'node:fs';
import { getJson, download } from './lib/scryfall.js';

const picked = JSON.parse(fs.readFileSync('data/scryfall-cards.json', 'utf8'));
const needed = new Set();
for (const { card } of picked) {
  const text = JSON.stringify([card.mana_cost, card.oracle_text, card.card_faces]);
  for (const m of text.matchAll(/\{[0-9A-Z/]{1,3}\}/g)) needed.add(m[0]);
}
// Числа, которые могут понадобиться в переводе, тоже берём
for (const n of ['{0}', '{1}', '{2}', '{3}', '{4}', '{5}', '{6}', '{7}', '{8}', '{X}']) needed.add(n);

const symbology = await getJson('/symbology', 'data/raw/symbology.json');
for (const s of symbology.data) {
  if (!needed.has(s.symbol)) continue;
  const file = `site/img/symbols/${symbolFile(s.symbol)}.svg`;
  if (await download(s.svg_uri, file)) console.log('значок:', s.symbol);
  needed.delete(s.symbol);
}
if (needed.size) console.log('Не найдены значки:', [...needed].join(' '));

// "{R/W}" -> "RW", "{T}" -> "T"
export function symbolFile(sym) {
  return sym.replace(/[{}/]/g, '');
}
