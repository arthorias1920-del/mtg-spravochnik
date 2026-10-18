// Шаблоны областей карты для каждой раскладки.
// Координаты — в пикселях исходной картинки 744×1040 (так их удобно мерить),
// при отрисовке переводятся в проценты от размера карты.
// Файл общий: его используют и приложение, и скрипты подготовки на Node.js.

export const CARD_W = 744;
export const CARD_H = 1040;

// Правый край плашки названия: перед значками мана-стоимости.
// Каждый значок ~39 px, последний кончается на x≈692.
function titleRight(manaCount) {
  return manaCount ? 692 - manaCount * 39 - 6 : 684;
}

// То же для названия приключения: значки мельче (~38 px с промежутком), кончаются на x≈360
function advTitleRight(manaCount) {
  return 360 - manaCount * 38 - 3;
}

// Голографическая печать редких карт: по центру внизу, заходит в текстовое поле дугой.
// Текст кончается выше печати; по бокам — полоски без текста, а прямо над печатью —
// плашка, вырезанная по форме дуги (точки измерены по картинкам).
const STAMP = { x1: 322, x2: 420, top: 937 };
const ARCH = [[322, 958], [328, 955], [334, 950], [342, 946], [350, 943], [358, 941], [372, 940],
  [386, 941], [396, 944], [404, 948], [412, 952], [420, 958]];

// Высота верхнего края дуги в точке x (линейная интерполяция)
function archY(x) {
  for (let i = 1; i < ARCH.length; i++) {
    const [xa, ya] = ARCH[i - 1], [xb, yb] = ARCH[i];
    if (x <= xb) return ya + (yb - ya) * (x - xa) / (xb - xa);
  }
  return ARCH.at(-1)[1];
}

// clip-path для плашки над печатью: сверху прямо, снизу — по дуге
function archClip(x, y, w, h) {
  const px = v => ((v - x) / w * 100).toFixed(2) + '%';
  const py = v => (Math.min(Math.max(v - y, 0), h) / h * 100).toFixed(2) + '%';
  const pts = [[x, y], [x + w, y], [x + w, archY(x + w)]];
  for (const [ax, ay] of [...ARCH].reverse()) if (ax > x && ax < x + w) pts.push([ax, ay]);
  pts.push([x, archY(x)]);
  return 'polygon(' + pts.map(([a, b]) => `${px(a)} ${py(b)}`).join(', ') + ')';
}

function avoidStamp(regions) {
  const out = [];
  for (const reg of regions) {
    const bottom = reg.y + reg.h, right = reg.x + reg.w;
    const hits = bottom > STAMP.top && reg.x < STAMP.x2 && right > STAMP.x1 && reg.role !== 'title' && reg.role !== 'type';
    if (!hits) { out.push(reg); continue; }
    const colorFrom = reg.colorFrom || reg.id;
    // Часть выше печати остаётся целиком (текст или полоска)
    if (reg.y < STAMP.top) out.push({ ...reg, h: STAMP.top - reg.y });
    const top = Math.max(reg.y, STAMP.top), h = bottom - top;
    // Полоски слева и справа от печати
    if (reg.x < STAMP.x1) out.push({ id: reg.id + 'L', x: reg.x, y: top, w: STAMP.x1 - reg.x, h, role: 'cover', colorFrom });
    if (right > STAMP.x2) out.push({ id: reg.id + 'R', x: STAMP.x2, y: top, w: right - STAMP.x2, h, role: 'cover', colorFrom });
    // Над самой печатью — по форме дуги
    const mx = Math.max(reg.x, STAMP.x1), mw = Math.min(right, STAMP.x2) - mx;
    out.push({ id: reg.id + 'M', x: mx, y: top, w: mw, h, role: 'cover', colorFrom, clip: archClip(mx, top, mw, h) });
  }
  return out;
}

// Возвращает список областей для карты.
// card: { layout, manaCount, hasPT, stamp, saga?: { reminder: [y1,y2], chapters: [[y1,y2], …] } }
// Каждая область: { id, x, y, w, h, role, bare? }
//   role: 'title' | 'type' | 'text' | 'cover' (только плашка, без текста)
//   bare: текст без своей плашки (лежит поверх плашки 'cover')
//   colorFrom: взять цвет плашки у другой области
export function regionsFor(card) {
  const r = baseRegions(card);
  return card.stamp ? avoidStamp(r) : r;
}

function baseRegions(card) {
  const r = [];
  const add = (id, x, y, x2, y2, role, extra = {}) => r.push({ id, x, y, w: x2 - x, h: y2 - y, role, ...extra });

  // Название — у всех раскладок одинаково
  add('title', 56, 54, titleRight(card.manaCount), 102, 'title');

  if (card.layout === 'saga') {
    // Сага: строка типа внизу, слева колонка текста, справа арт.
    // Главы накрываем одной плашкой и рисуем свои разделители, поэтому
    // границы глав можно немного сдвигать (настраиваются для каждой саги).
    const s = card.saga;
    add('type', 56, 882, 642, 931, 'type');
    add('reminder', 58, 122, 365, s.reminder[1], 'text');
    const first = s.chapters[0][0], last = s.chapters[s.chapters.length - 1][1];
    add('chapters', 92, first, 365, last, 'cover');
    s.chapters.forEach(([y1, y2], i) =>
      add('ch' + i, 92, y1, 365, y2, 'text', { bare: true, colorFrom: 'chapters', divider: i > 0 }));
    return r;
  }

  add('type', 56, 589, 642, 636, 'type');

  if (card.layout === 'adventure') {
    // Левая страница — приключение, правая — существо (или чары)
    add('advTitle', 51, 654, advTitleRight(card.adventure.manaCount), 697, 'title');
    add('advType', 51, 699, 367, 743, 'type');
    add('advText', 52, 747, 366, 949, 'text');
    if (card.hasPT) {
      add('text', 374, 656, 682, 922, 'text');
      add('textStrip', 374, 922, 566, 949, 'cover', { colorFrom: 'text' });
    } else {
      add('text', 374, 656, 682, 949, 'text');
    }
    return r;
  }

  // Обычная карта (существо, заклинание, артефакт, земля)
  if (card.hasPT) {
    add('text', 57, 656, 682, 922, 'text');
    add('textStrip', 57, 922, 566, 956, 'cover', { colorFrom: 'text' });
  } else {
    add('text', 57, 656, 682, 956, 'text');
  }
  return r;
}
