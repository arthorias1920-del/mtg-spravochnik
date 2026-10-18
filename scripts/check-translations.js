// Этап 5: автоматическая проверка перевода (data/cards.json) против английского оригинала.
//  • символы маны ({T}, {2}, {R/W}…) — те же и в том же количестве;
//  • числа (цифры, X, слова two/три…) — те же;
//  • ключевые слова карты переведены по словарю docs/terms.md;
//  • типы существ в строке типа переведены по словарю;
//  • название карты в тексте правил заменено русским;
//  • буква ё на месте, нет сленга вроде «тапнуть».
// Запуск: node scripts/check-translations.js   (код выхода 1, если есть ошибки)
import fs from 'node:fs';
import { loadJson } from './lib/cardinfo.js';

const picked = loadJson('data/scryfall-cards.json');
const ru = loadJson('data/cards.json');

// Ключевые слова Scryfall → что должно быть в русском тексте
const KEYWORDS = {
  Trample: 'Пробивной удар', Storied: 'Сказание', 'Double strike': 'Двойной удар', Vigilance: 'Бдительность',
  Reach: 'Захват', Lifelink: 'Цепь жизни', Flying: 'Полёт', Equip: 'Снарядить', Flash: 'Миг',
  Flashback: 'Воспоминание', Ward: 'Оберег', Recruit: 'Вербовку', Scry: 'Предскажите', Mill: 'скру',
  Kicker: 'Усилитель', Enchant: 'Зачаровать', Treasure: 'Клад', Haste: 'Ускорение', Amass: 'Скопище Гоблинов',
  Ferocious: 'Свирепость', Menace: 'Угроз', Deathtouch: 'Смертельное касание', Landfall: 'Землепад',
  Affinity: 'Родство', Hexproof: 'Порчеустойчивость', Fight: 'дерётся',
};
// Способности и действия, которые встречаются внутри фраз («gains first strike»).
// Русская часть — регулярное выражение по основе слова (падежи и формы глагола разные).
const PHRASES = [
  [/first strike/i, /Первый удар/], [/indestructible/i, /Неразрушимость/], [/hexproof/i, /Порчеустойчивость/],
  [/lifelink/i, /Цепь жизни/], [/\breach\b/i, /Захват/], [/trample/i, /Пробивной удар/], [/menace/i, /Угроз/],
  [/flying/i, /Полёт/], [/vigilance/i, /Бдительность/], [/\bhaste\b/i, /Ускорение/], [/\bward\b/i, /Оберег/],
  [/\bexile/i, /изг[он]/i], [/sacrifice/i, /жертв/i], [/\bdestroy/i, /уничтож/i], [/discard/i, /сбр[аоы]/i],
  [/\buntap/i, /развер|развор/i], [/\btap\b/i, /поверн|повёрн/i], [/graveyard/i, /кладбищ/i], [/library/i, /библиотек/i],
  [/\bcounter target spell/i, /Отмените целевое заклинание/], [/\+1\/\+1 counter/i, /жетон/],
  [/opponent/i, /оппонент/], [/until end of turn/i, /до конца хода/i], [/\btoken/i, /фиш/i],
  [/upkeep/i, /шага поддержки/], [/mana value/i, /манов[а-яё]* ценност/i], [/as a sorcery/i, /только как волшебство/],
];
// Типы существ и карт
const TYPES = {
  Legendary: 'Легендарн', Creature: 'Существо', Artifact: 'Артефакт', Equipment: 'Снаряжение', Instant: 'Мгновенное заклинание',
  Sorcery: 'Волшебство', Enchantment: 'Чары', Aura: 'Аура', Saga: 'Сага', Land: 'Земля', Adventure: 'Приключение',
  Dwarf: 'Гном', Elf: 'Эльф', Goblin: 'Гоблин', Human: 'Человек', Halfling: 'Полурослик', Noble: 'Аристократ',
  Artificer: 'Механик', Bard: 'Бард', Warrior: 'Воин', Citizen: 'Гражданин', Scout: 'Разведчик', Insect: 'Насекомое',
  Bird: 'Птица', Archer: 'Лучник', Avatar: 'Аватара', Wizard: 'Чародей', Soldier: 'Солдат', Rogue: 'Бродяга',
  Cleric: 'Священник', Advisor: 'Советник', Dragon: 'Дракон', Wurm: 'Вурм', Wolf: 'Волк', Bat: 'Летучая мышь',
  Horror: 'Ужас', Ranger: 'Следопыт', Druid: 'Друид', Spider: 'Паук', Bear: 'Медведь', Shapeshifter: 'Имитатор',
};
// Слова, которые должны писаться через ё (как договорились)
const NEED_YO = [
  [/Полет/, 'Полёт'], [/поверну?т(ой|ым|ыми|ых|ое|ую|ая)/, 'повёрнут…'], [/зелен(ый|ое|ая)/, 'зелёный'],
  [/черн(ая|ый|ое)/i, 'чёрный'], [/[Сс]наряженн/, 'Снаряжённ…'], [/(^|[^а-яё])(ее|нее)([^а-яё]|$)/, 'её / неё'],
  [/берет(е)?([^а-яё]|$)/, 'берёт / берёте'], [/кладет/, 'кладёт'], [/(^|[^а-яё])свое([^а-яё]|$)/, 'своё'],
  [/(^|[^а-яё])идет/, 'идёт'], [/разделенн/, 'разделённ…'], [/возвращенн/, 'возвращённ…'], [/дерется/, 'дерётся'],
];
const SLANG = /тапн|тапа|анта?п|\bтап\b/i;

// Числа: цифры, X и слова-числительные (кроме «один/one» — в русском «одну фишку» вместо «a token»)
const EN_NUM = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twenty: 20 };
const RU_NUM = {
  два: 2, две: 2, двух: 2, три: 3, трёх: 3, трех: 3, четыре: 4, четырёх: 4, четырех: 4, пять: 5, пяти: 5,
  шесть: 6, семь: 7, восемь: 8, девять: 9, десять: 10, двадцать: 20,
  двумя: 2, тремя: 3, четырьмя: 4,
};
function numbers(text, words) {
  const out = [];
  const plain = text.replace(/\{[^}]+\}/g, ' ').replace(/\b[IV]+\b/g, ' '); // без символов маны и номеров глав
  for (const m of plain.matchAll(/\d+|\bX\b/g)) out.push(m[0]);
  for (const w of plain.toLowerCase().split(/[^a-zа-яё]+/)) if (words[w]) out.push(String(words[w]));
  return out.sort().join(' ');
}
// Название в любом падеже: каждое слово по основе («Гарнизон Эсгарота» → «Гарнизона Эсгарота»)
const stemRe = phrase => new RegExp(phrase.split(/\s+/)
  .map(w => w.slice(0, Math.max(3, w.length - 2)).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[а-яё-]*').join('\\s+'), 'i');
const symbols = t => (t.match(/\{[^}]+\}/g) || []).sort().join('');

const errors = [], warnings = [];
const err = (card, msg) => errors.push(`✗ ${card}: ${msg}`);
const warn = (card, msg) => warnings.push(`? ${card}: ${msg}`);

for (const { deckName: name, card } of picked) {
  const t = ru[name];
  if (!t) { err(name, 'нет перевода'); continue; }
  const faces = card.card_faces || [card];
  const main = faces[0];

  // Пары «английский текст — русский текст» для сравнения
  const pairs = [];
  if (card.layout === 'saga') {
    pairs.push(['текст саги', card.oracle_text.replace(/^[IV, ]+ — /gm, ''), [t.reminder, ...t.chapters].join('\n')]);
  } else {
    pairs.push(['текст', main.oracle_text || '', t.text || '']);
    if (card.layout === 'adventure') pairs.push(['приключение', faces[1].oracle_text, t.adventure.text]);
  }

  for (const [part, en, rus] of pairs) {
    if (symbols(en) !== symbols(rus)) err(name, `${part}: символы маны ${symbols(en)} ≠ ${symbols(rus)}`);
    const nEn = numbers(en, EN_NUM), nRu = numbers(rus, RU_NUM);
    if (nEn !== nRu) err(name, `${part}: числа [${nEn}] ≠ [${nRu}]`);
    for (const [re, ruRe] of PHRASES) {
      if (re.test(en) && !ruRe.test(rus)) warn(name, `${part}: в оригинале «${en.match(re)[0]}», а в переводе нет ${ruRe}`);
    }
    // Название карты в тексте правил
    const faceNames = card.layout === 'adventure' ? [[faces[0].name, t.name], [faces[1].name, t.adventure.name]] : [[name, t.name]];
    for (const [enName, ruName] of faceNames) {
      if (en.includes(enName) && !stemRe(ruName).test(rus)) err(name, `${part}: в тексте упомянута сама карта «${enName}», а русского названия «${ruName}» нет`);
    }
  }

  // Ключевые слова
  const allRu = [t.text, t.adventure?.text, t.reminder, ...(t.chapters || [])].filter(Boolean).join('\n');
  for (const kw of card.keywords) {
    const need = KEYWORDS[kw];
    if (!need) warn(name, `ключевое слово ${kw} нет в словаре проверки`);
    else if (!allRu.toLowerCase().includes(need.toLowerCase())) err(name, `ключевое слово ${kw} → нет «${need}»`);
  }

  // Строка типа
  const typeChecks = [[main.type_line, t.type]];
  if (card.layout === 'adventure') typeChecks.push([faces[1].type_line, t.adventure.type]);
  for (const [enType, ruType] of typeChecks) {
    for (const w of enType.split(/[\s—]+/).filter(Boolean)) {
      if (!TYPES[w]) warn(name, `тип ${w} нет в словаре проверки`);
      else if (!ruType.includes(TYPES[w])) err(name, `тип ${w} → нет «${TYPES[w]}» в «${ruType}»`);
    }
  }

  // ё и сленг — во всём русском тексте карты, включая художественный
  const everything = [t.name, t.type, allRu, t.flavor, t.adventure?.name, t.adventure?.type].filter(Boolean).join('\n');
  for (const [re, good] of NEED_YO) if (re.test(everything)) err(name, `без ё: «${everything.match(re)[0]}» → ${good}`);
  if (SLANG.test(everything)) err(name, `сленг: «${everything.match(SLANG)[0]}»`);

  // Художественный текст есть в оригинале — должен быть и в переводе
  const enFlavor = faces.map(f => f.flavor_text).filter(Boolean).join('\n') || card.flavor_text;
  if (enFlavor && !t.flavor) err(name, 'нет перевода художественного текста');
  if (!enFlavor && t.flavor) err(name, 'лишний художественный текст');
}

const report = [...errors, ...warnings].join('\n');
fs.writeFileSync('data/check-report.txt', report + '\n');
console.log(report || 'Замечаний нет');
console.log(`\nКарт: ${picked.length}. Ошибок: ${errors.length}. Предупреждений: ${warnings.length}.`);
process.exit(errors.length ? 1 : 0);
