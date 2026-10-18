// Этап 3: для каждого термина ищем старые карты, напечатанные на русском (lang:ru),
// и сохраняем их русский текст (printed_text, printed_type_line) как подтверждение.
// Запуск: node scripts/find-ru-terms.js   → data/ru-term-evidence.json
import fs from 'node:fs';
import { getJson } from './lib/scryfall.js';

// [идентификатор, поисковый запрос Scryfall] — запрос дописывается к "lang:ru"
const TERMS = [
  // Ключевые слова
  ['trample', 'kw:trample'], ['flying', 'kw:flying'], ['vigilance', 'kw:vigilance'],
  ['reach', 'kw:reach'], ['lifelink', 'kw:lifelink'], ['double-strike', 'kw:"double strike"'],
  ['first-strike', 'kw:"first strike"'], ['haste', 'kw:haste'], ['deathtouch', 'kw:deathtouch'],
  ['menace', 'kw:menace'], ['hexproof', 'kw:hexproof'], ['indestructible', 'kw:indestructible'],
  ['ward', 'kw:ward'], ['flash', 'kw:flash'], ['flashback', 'kw:flashback'],
  ['equip', 'kw:equip'], ['enchant', 'o:"enchant creature" t:aura'], ['kicker', 'kw:kicker'],
  ['scry', 'kw:scry'], ['mill', 'kw:mill'], ['amass', 'kw:amass'],
  ['treasure', 'o:"treasure token"'], ['landfall', 'kw:landfall'], ['ferocious', 'kw:ferocious'],
  ['affinity', 'kw:affinity'], ['fight', 'kw:fight'], ['adventure', 't:adventure'],
  ['saga', 't:saga'], ['storied', 'kw:storied'], ['recruit', 'kw:recruit'],
  // Повторяющиеся формулировки
  ['enters-tapped', 't:land o:"enters tapped" -t:basic'],
  ['enters', 'o:"when ~ enters, draw a card"'],
  ['dies', 'o:"when ~ dies"'],
  ['until-eot', 'o:"gets +2/+2 until end of turn"'],
  ['creatures-you-control', 'o:"creatures you control get +1/+1 until end of turn"'],
  ['counter-p1', 'o:"put a +1/+1 counter on target creature"'],
  ['choose-one', 'o:"choose one —"'],
  ['choose-one-or-both', 'o:"choose one or both —"'],
  ['sorcery-speed', 'o:"activate only as a sorcery"'],
  ['search-basic', 'o:"search your library for a basic land card"'],
  ['any-target', 'o:"damage to any target"'],
  ['mana-value', 'o:"mana value"'],
  ['noncreature', 'o:"whenever you cast a noncreature spell"'],
  ['nontoken', 'o:"nontoken creature"'],
  ['nonland', 'o:"nonland card"'],
  ['play-exiled', 'o:"exile the top card of your library" o:"you may play"'],
  ['cant-be-blocked', 'o:"can\'t be blocked this turn"'],
  ['cant-be-countered', 'o:"this spell can\'t be countered"'],
  ['counter-unless', 'o:"counter target spell unless its controller pays"'],
  ['counter-spell', 'o:"counter target spell." -o:unless'],
  ['sacrifice-creature', 'o:"sacrifices a creature"'],
  ['discard-draw', 'o:"draw a card, then discard a card"'],
  ['reveal-hand', 'o:"reveals their hand"'],
  ['upkeep', 'o:"at the beginning of your upkeep"'],
  ['beginning-combat', 'o:"at the beginning of combat on your turn"'],
  ['main-phase', 'o:"first main phase"'],
  ['additional-combat', 'o:"additional combat phase"'],
  ['combat-damage-player', 'o:"deals combat damage to a player"'],
  ['gain-life', 'o:"you gain 2 life"'],
  ['lose-life', 'o:"loses 1 life and you gain 1 life"'],
  ['loses-abilities', 'o:"loses all abilities"'],
  ['doesnt-untap', 'o:"doesn\'t untap during its controller\'s untap step"'],
  ['random-order', 'o:"bottom of your library in a random order"'],
  ['divided', 'o:"divided as you choose"'],
  ['additional-land', 'o:"play an additional land"'],
  ['base-pt', 'o:"base power and toughness"'],
  ['costs-less', 'o:"this spell costs" o:"less to cast"'],
  ['equipped-creature', 'o:"equipped creature gets"'],
  ['attach', 'o:"attach it to target creature"'],
  ['owners-control', 'o:"return" o:"to the battlefield under its owner\'s control"'],
  ['other-types', 'o:"in addition to its other types"'],
  ['spend-only', 'o:"spend this mana only to cast"'],
  ['any-color', 'o:"add one mana of any color"'],
  ['equal-number', 'o:"power is equal to the number of creatures you control"'],
  ['permanent-card', 'o:"permanent card"'],
  ['additional-time', 'o:"triggers an additional time"'],
  ['second-card', 'o:"draw your second card each turn"'],
  ['top-or-bottom', 'o:"top or bottom of their library"'],
  ['shuffle-into', 'o:"shuffles" o:"into their library"'],
  ['exile-instead', 'o:"would die" o:"exile it instead"'],
  ['remove-counters', 'o:"remove all counters from"'],
  ['legendary-permanent', 'o:"legendary permanent"'],
  ['if-you-do', 'o:"if you do,"'],
  ['when-you-do', 'o:"when you do,"'],
  ['power-or-greater', 'o:"power 4 or greater"'],
  ['token-copy', 'o:"create a 1/1 white soldier creature token"'],
  ['equip-cost', 'o:"equip abilities"'],
  ['tapped-creature', 'o:"target tapped creature"'],
  ['each-other', 'o:"each other creature you control"'],
  ['first-time', 'o:"for the first time each turn"'],
  ['flavor', 'o:"total power"'],
  // Типы и подтипы
  ['t-legendary', 't:legendary t:creature'], ['t-instant', 't:instant'], ['t-sorcery', 't:sorcery'],
  ['t-enchantment', 't:enchantment -t:aura -t:saga'], ['t-aura', 't:aura'], ['t-artifact', 't:artifact -t:creature'],
  ['t-equipment', 't:equipment'], ['t-land', 't:land -t:basic'],
  ['t-dwarf', 't:dwarf'], ['t-noble', 't:noble'], ['t-artificer', 't:artificer'], ['t-bard', 't:bard'],
  ['t-warrior', 't:warrior'], ['t-citizen', 't:citizen'], ['t-scout', 't:scout'], ['t-insect', 't:insect'],
  ['t-bird', 't:bird'], ['t-human', 't:human'], ['t-archer', 't:archer'], ['t-avatar', 't:avatar'],
  ['t-wizard', 't:wizard'], ['t-soldier', 't:soldier'], ['t-halfling', 't:halfling'], ['t-rogue', 't:rogue'],
  ['t-cleric', 't:cleric'], ['t-advisor', 't:advisor'], ['t-dragon', 't:dragon'], ['t-wurm', 't:wurm'],
  ['t-goblin', 't:goblin'], ['t-wolf', 't:wolf'], ['t-bat', 't:bat'], ['t-horror', 't:horror'],
  ['t-elf', 't:elf'], ['t-ranger', 't:ranger'], ['t-druid', 't:druid'], ['t-spider', 't:spider'],
  ['t-bear', 't:bear'], ['t-shapeshifter', 't:shapeshifter'], ['t-army', 'o:"army creature token"'], ['t-orc', 't:orc'],
  // Шаги хода и образцы для новых механик
  ['flying-reminder', 'kw:flying o:"can\'t be blocked except by creatures with flying or reach"'],
  ['declare-attackers', 'o:"declare attackers step"'],
  ['declare-blockers', 'o:"declare blockers step"'],
  ['end-of-combat', 'o:"at end of combat"'],
  ['cleanup', 'o:"cleanup step"'],
  ['end-step', 'o:"at the beginning of your end step"'],
  ['combat-damage-step', 'o:"combat damage step"'],
  ['draw-step', 'o:"draw step"'],
  ['untap-step', 'o:"untap step"'],
  ['ascend', 'kw:ascend'],
  ['investigate', 'kw:investigate'],
  ['connive', 'kw:connive'],
  ['monarch', 'o:"you become the monarch"'],
  ['next-upkeep', 'o:"at the beginning of the next upkeep"'],
  ['you-own', 'o:"target creature you own"'],
  ['token-named', 'o:"colorless" o:"artifact token named"'],
  ['first-main', 'o:"first main phase"'],
  ['second-main', 'o:"postcombat main phase"'],
  ['wolf-token', 'o:"2/2 green wolf creature token"'],
  ['bird-soldier', 'o:"bird soldier creature token"'],
  ['dwarf-token', 'o:"red dwarf creature token"'],
  ['dragon-token', 'o:"red dragon creature token with flying"'],
  ['elf-token', 'o:"1/1 green elf"'],
  ['human-soldier-token', 'o:"white human soldier creature token"'],
];

fs.mkdirSync('data/raw/ru-terms', { recursive: true });
const evidence = {};
for (const [id, q] of TERMS) {
  const query = `lang:ru ${q}`;
  const res = await getJson(
    `/cards/search?q=${encodeURIComponent(query)}&unique=prints&order=released&dir=desc&include_multilingual=true`,
    `data/raw/ru-terms/${id}.json`);
  const cards = (res.data || []).filter(c => c.lang === 'ru');
  // Берём 3 самые свежие русские карты из разных сетов
  const sample = [];
  for (const c of cards) {
    if (sample.some(s => s.set === c.set)) continue;
    const faces = c.card_faces || [c];
    sample.push({
      name: c.name, set: c.set, set_name: c.set_name, released: c.released_at,
      printed_name: faces.map(f => f.printed_name).filter(Boolean).join(' // '),
      printed_type_line: faces.map(f => f.printed_type_line).filter(Boolean).join(' // '),
      printed_text: faces.map(f => f.printed_text).filter(Boolean).join('\n//\n'),
      oracle_text: faces.map(f => f.oracle_text).filter(Boolean).join('\n//\n'),
    });
    if (sample.length >= 3) break;
  }
  evidence[id] = { query, total: res.total_cards || 0, sample };
  console.log(`${id}: ${res.total_cards || 0} рус. карт`);
}
fs.writeFileSync('data/ru-term-evidence.json', JSON.stringify(evidence, null, 2));
