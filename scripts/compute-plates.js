// Определяем цвет фона каждой области каждой карты, чтобы плашки сливались с рамкой.
// Для области берём пиксели, отбрасываем 35% самых «буквенных» (тёмных на светлом фоне
// или светлых на тёмном) и считаем медиану — отдельно по левому и правому краю,
// чтобы плашка повторяла плавный переход цвета.
// Запуск: node scripts/compute-plates.js   → data/plates.json
import fs from 'node:fs';
import sharp from 'sharp';
import { regionsFor, CARD_W, CARD_H } from '../site/js/layouts.js';
import { geometry, loadJson } from './lib/cardinfo.js';

const picked = loadJson('data/scryfall-cards.json');
const translations = fs.existsSync('data/cards.json') ? loadJson('data/cards.json') : {};
const only = process.argv.slice(2); // можно указать slug-и карт для выборочного пересчёта

const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
// Цвет в точке t (0…1) между двумя цветами #rrggbb
const mix = (a, b, t) => {
  t = Math.min(Math.max(t, 0), 1);
  const ca = a.match(/\w\w/g).map(h => parseInt(h, 16)), cb = b.match(/\w\w/g).map(h => parseInt(h, 16));
  return hex(ca.map((v, i) => v + (cb[i] - v) * t));
};
const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

// Медиана цвета фона по набору пикселей
function backgroundColor(pixels) {
  const sorted = pixels.slice().sort((a, b) => lum(...a) - lum(...b));
  const medianL = lum(...sorted[sorted.length >> 1]);
  const dark = medianL < 128; // тёмная плашка (например, полоса приключения)
  const cut = Math.floor(sorted.length * 0.35);
  const bg = dark ? sorted.slice(0, sorted.length - cut) : sorted.slice(cut);
  const med = ch => bg.map(p => p[ch]).sort((a, b) => a - b)[bg.length >> 1];
  return [med(0), med(1), med(2)];
}

const result = fs.existsSync('data/plates.json') ? loadJson('data/plates.json') : {};
for (const p of picked) {
  if (only.length && !only.includes(p.slug)) continue;
  const { data } = await sharp(p.images[0]).resize(CARD_W, CARD_H).removeAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const px = (x, y) => { const i = (y * CARD_W + x) * 3; return [data[i], data[i + 1], data[i + 2]]; };

  const plates = {};
  const regions = regionsFor(geometry(p.card, translations[p.deckName]));
  for (const reg of regions) {
    if (reg.colorFrom) continue; // цвет возьмём у соседней области
    // Собираем пиксели из левой и правой четверти области (с шагом 2 px)
    const side = (x1, x2) => {
      const out = [];
      for (let y = reg.y + 2; y < reg.y + reg.h - 2; y += 2)
        for (let x = x1; x < x2; x += 2) out.push(px(x, y));
      return out;
    };
    const q = Math.max(8, Math.round(reg.w / 4));
    const left = backgroundColor(side(reg.x + 2, reg.x + q));
    const right = backgroundColor(side(reg.x + reg.w - q, reg.x + reg.w - 2));
    const avgL = (lum(...left) + lum(...right)) / 2;
    plates[reg.id] = { c1: hex(left), c2: hex(right), fg: avgL < 128 ? '#ffffff' : '#141210' };
  }
  // Полоски и кусочки у печати берут цвет «соседа» — ровно в своём месте его перехода цвета
  for (const reg of regions) {
    if (!reg.colorFrom) continue;
    const parent = regions.find(r => r.id === reg.colorFrom);
    const pc = plates[reg.colorFrom];
    const at = x => mix(pc.c1, pc.c2, (x - parent.x) / parent.w);
    plates[reg.id] = { c1: at(reg.x), c2: at(reg.x + reg.w), fg: pc.fg };
  }
  result[p.slug] = plates;
}
fs.writeFileSync('data/plates.json', JSON.stringify(result, null, 1));
console.log('Цвета плашек посчитаны:', Object.keys(result).length, 'карт');
