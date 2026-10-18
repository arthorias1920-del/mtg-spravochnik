// Отрисовка переведённой карты: оригинальная картинка + HTML-плашки с русским текстом.
// Все размеры в процентах и единицах контейнера (cqw), поэтому карта одинаково
// выглядит и в миниатюре, и на весь экран.
import { regionsFor, CARD_W, CARD_H } from './layouts.js';

// Пределы размера шрифта (в cqw — сотых долях ширины карты)
export const FONT = {
  title: { max: 4.9, min: 2.9 },
  type: { max: 4.1, min: 2.6 },
  text: { max: 4.2, min: 2.7 }, // минимум ≈ 10,5 px на карте шириной 390 px
};

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Значки маны: {T} -> <img src="img/symbols/T.svg">
function symbols(html) {
  return html.replace(/\{([0-9A-Z/]{1,3})\}/g, (_, s) =>
    `<img class="sym" src="img/symbols/${s.replace('/', '')}.svg" alt="{${s}}">`);
}

// Текст правил: абзацы, пункты «•», поясняющий текст в скобках — курсивом,
// названия способностей вида *Землепад* — тоже курсивом
export function rulesHtml(text) {
  return text.split('\n').map(line => {
    let h = symbols(esc(line))
      .replace(/\([^()]*\)/g, m => `<i class="reminder">${m}</i>`)
      .replace(/\*([^*]+)\*/g, '<i>$1</i>');
    if (line.startsWith('• ')) return `<p class="bullet">${h.slice(2)}</p>`;
    return `<p>${h}</p>`;
  }).join('');
}

// Художественный текст: курсив, отделён чертой
function flavorHtml(flavor) {
  return '<hr class="flavor-bar"><div class="flavor">' +
    flavor.split('\n').map(l => `<p${l.startsWith('—') ? ' class="attrib"' : ''}>${esc(l)}</p>`).join('') +
    '</div>';
}

// Какой текст лежит в какой области
function contentFor(regionId, ru) {
  switch (regionId) {
    case 'title': return esc(ru.name);
    // Неразрывный пробел перед тире: при переносе «—» остаётся в конце первой строки
    case 'type': return esc(ru.type).replace(' — ', '\u00a0— ');
    case 'text': return rulesHtml(ru.text || '') + (ru.flavor ? flavorHtml(ru.flavor) : '');
    case 'advTitle': return esc(ru.adventure.name);
    case 'advType': return esc(ru.adventure.type).replace(' — ', '\u00a0— ');
    case 'advText': return rulesHtml(ru.adventure.text);
    case 'reminder': return rulesHtml(ru.reminder);
    default:
      if (regionId.startsWith('ch')) return rulesHtml(ru.chapters[+regionId.slice(2)]);
      return '';
  }
}

const pct = (v, total) => (v / total * 100).toFixed(3) + '%';

// Создаёт элемент карты. card — запись из data/app.json.
// fit — готовые размеры шрифтов { regionId: cqw }; если нет, берутся максимальные.
export function renderCard(card, fit = card.fit || {}) {
  const el = document.createElement('div');
  el.className = 'mtg-card';
  el.lang = 'ru';
  el.dataset.slug = card.slug;
  let html = `<img class="card-img" src="${card.image}" alt="${esc(card.ru.name)}" draggable="false" loading="lazy" decoding="async">`;
  for (const reg of regionsFor(card.geo)) {
    const plate = card.plates[reg.id] || { c1: '#eee', c2: '#eee', fg: '#111' };
    const style = `left:${pct(reg.x, CARD_W)};top:${pct(reg.y, CARD_H)};width:${pct(reg.w, CARD_W)};height:${pct(reg.h, CARD_H)};` +
      `--c1:${plate.c1};--c2:${plate.c2};--fg:${plate.fg};` +
      (fit[reg.id] ? `--fs:${fit[reg.id]};` : '') +
      (reg.clip ? `clip-path:${reg.clip};-webkit-clip-path:${reg.clip};box-shadow:none;` : '');
    const cls = ['plate', reg.role, reg.bare && 'bare', reg.divider && 'divider', fit[reg.id + ':wrap'] && 'wrap']
      .filter(Boolean).join(' ');
    const inner = reg.role === 'cover' ? '' : `<div class="fit">${contentFor(reg.id, card.ru)}</div>`;
    html += `<div class="${cls}" data-region="${reg.id}" style="${style}">${inner}</div>`;
  }
  el.innerHTML = html;
  return el;
}

// Подбор размера шрифта: самый крупный, при котором текст помещается в плашку.
// Все текстовые поля одной карты получают одинаковый размер (как на настоящих картах).
// Возвращает { sizes: { regionId: cqw }, small: [поля мельче минимума], overflow: [не влезло совсем] }.
const FLOOR = 1.6; // ниже этого не ищем вообще
export function fitCard(el) {
  const sizes = {}, small = [], overflow = [];
  const plates = [...el.querySelectorAll('.plate:not(.cover)')];
  const roleOf = p => p.classList.contains('title') ? 'title' : p.classList.contains('type') ? 'type' : 'text';

  // Помещается ли содержимое в плашку (с учётом внутренних отступов)
  const fits = plate => {
    const cs = getComputedStyle(plate);
    const w = plate.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const h = plate.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const box = plate.querySelector('.fit');
    return box.offsetWidth <= w + 0.5 && box.scrollWidth <= w + 0.5 && box.offsetHeight <= h + 0.5;
  };
  const set = (p, v) => p.style.setProperty('--fs', v.toFixed(2));

  // Двоичный поиск с точностью 0,02 cqw
  function best(plate) {
    const { max } = FONT[roleOf(plate)];
    set(plate, max);
    if (fits(plate)) return max;
    let lo = FLOOR, hi = max;
    set(plate, lo);
    if (!fits(plate)) return null;
    while (hi - lo > 0.02) {
      const mid = (lo + hi) / 2;
      set(plate, mid);
      if (fits(plate)) lo = mid; else hi = mid;
    }
    return lo;
  }

  let textSize = FONT.text.max;
  for (const p of plates) {
    let v = best(p);
    const id = p.dataset.region;
    // Строка типа не влезает в одну линию крупнее минимума — переносим на две строки
    if (roleOf(p) === 'type' && (v == null || v < FONT.type.min)) {
      p.classList.add('wrap');
      const v2 = best(p);
      if (v2 != null && v2 > (v ?? 0)) { v = v2; sizes[id + ':wrap'] = true; } else p.classList.remove('wrap');
    }
    if (v == null) { overflow.push(id); sizes[id] = FLOOR; continue; }
    sizes[id] = +v.toFixed(2);
    if (roleOf(p) === 'text') textSize = Math.min(textSize, v);
    else if (v < FONT[roleOf(p)].min - 0.01) small.push(`${id}: ${v.toFixed(2)}`);
  }
  // Общий размер для всех текстовых полей карты
  for (const p of plates) {
    if (roleOf(p) !== 'text') continue;
    sizes[p.dataset.region] = +textSize.toFixed(2);
    set(p, textSize);
  }
  if (textSize < FONT.text.min - 0.01 && plates.some(p => roleOf(p) === 'text')) small.push(`text: ${textSize.toFixed(2)}`);
  return { sizes, small, overflow };
}

// Подбирает размеры на «эталонной» карте шириной 744 px вне экрана.
// Результат не зависит от размера карты на экране (всё в cqw).
export async function measureFit(card) {
  await fontsReady();
  const holder = document.createElement('div');
  holder.style.cssText = `position:absolute;left:-20000px;top:0;width:${CARD_W}px;visibility:hidden`;
  const el = renderCard(card, {});
  holder.appendChild(el);
  document.body.appendChild(holder);
  const res = fitCard(el);
  holder.remove();
  return res;
}

let fontsPromise;
export function fontsReady() {
  fontsPromise ??= Promise.all([
    document.fonts.load('400 20px "PT Serif"', 'Ая'),
    document.fonts.load('700 20px "PT Serif"', 'Ая'),
    document.fonts.load('italic 400 20px "PT Serif"', 'Ая'),
  ]).then(() => document.fonts.ready);
  return fontsPromise;
}
