// Геометрия карты для шаблонов областей: раскладка, число значков маны, есть ли сила/выносливость.
import fs from 'node:fs';

// Сколько значков в мана-стоимости: "{2}{R}{R}" -> 3
export const manaCount = cost => (cost || '').match(/\{[^}]+\}/g)?.length || 0;

// Геометрия одной карты из ответа Scryfall (+ границы глав саги из перевода)
export function geometry(card, translation = {}) {
  const main = card.card_faces ? card.card_faces[0] : card;
  const g = {
    layout: card.layout,
    manaCount: manaCount(main.mana_cost),
    hasPT: main.power != null,
    stamp: card.rarity === 'rare' || card.rarity === 'mythic', // голографическая печать
  };
  if (card.layout === 'adventure') g.adventure = { manaCount: manaCount(card.card_faces[1].mana_cost) };
  if (card.layout === 'saga') g.saga = translation.sagaLayout || { reminder: [122, 304], chapters: [] };
  return g;
}

export const loadJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));
