// Справочник по MTG — всё приложение на одной странице.
// Экраны переключаются по адресу после «#»: #/deck/dwarves, #/deck/dwarves/card/3 и т. д.
import { renderCard } from './card.js';
import { GLOSSARY, TURN, TURN_TIP } from './content.js';

const app = document.getElementById('app');
const SECTIONS = [
  ['creatures', 'Существа'],
  ['spells', 'Заклинания и артефакты'],
  ['lands', 'Земли'],
];
const COLOR_NAMES = { W: 'белый', U: 'синий', B: 'чёрный', R: 'красный', G: 'зелёный' };

let DATA; // содержимое data/app.json

// ---------- Хранилище руки (localStorage, все обращения в try/catch) ----------
const HAND_KEY = id => 'mtg-hand-v1:' + id;
function loadHand(deckId) {
  try {
    const v = JSON.parse(localStorage.getItem(HAND_KEY(deckId)) || '[]');
    return Array.isArray(v) ? v.filter(s => DATA.cards[s]) : [];
  } catch { return []; }
}
function saveHand(deckId, hand) {
  try { localStorage.setItem(HAND_KEY(deckId), JSON.stringify(hand)); } catch { /* хранилище недоступно */ }
}

// ---------- Мелкие помощники ----------
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plural = (n, one, few, many) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};
const cardsWord = n => `${n} ${plural(n, 'карта', 'карты', 'карт')}`;
const deckById = id => DATA.decks.find(d => d.id === id);
// Все карты колоды подряд, в порядке списков
const deckCards = deck => SECTIONS.flatMap(([key]) => deck.sections[key] || []);
const go = hash => { location.hash = hash; };

let toastTimer;
function toast(text) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

// Окно подтверждения (вместо системного confirm)
function confirmBox(title, text, okText) {
  return new Promise(resolve => {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
      <h2>${esc(title)}</h2><p>${esc(text)}</p>
      <div class="row"><button class="btn btn-burgundy" data-ok>${esc(okText)}</button>
      <button class="btn btn-paper" data-cancel>Отмена</button></div></div>`;
    const close = v => { back.remove(); resolve(v); };
    back.querySelector('[data-ok]').onclick = () => close(true);
    back.querySelector('[data-cancel]').onclick = () => close(false);
    back.onclick = e => { if (e.target === back) close(false); };
    document.body.appendChild(back);
  });
}

function topbar(title, backHash, extra = '') {
  return `<div class="topbar">
    ${backHash != null ? `<button class="btn-back" data-back="${esc(backHash)}">Назад</button>` : ''}
    <h1>${esc(title)}</h1>${extra}</div>`;
}
function wireBack(root) {
  root.querySelectorAll('[data-back]').forEach(b => b.onclick = () => go(b.dataset.back));
}

// ---------- Главный экран ----------
function homeScreen() {
  const tiles = DATA.decks.map(d => `
    <a class="deck-tile" href="#/deck/${d.id}" style="background-image:url('${d.art.image}')">
      <div class="tile-body">
        <h2>${esc(d.title)}</h2>
        <div class="tile-meta">
          <span class="mana-row" aria-label="Цвета: ${d.colors.map(c => COLOR_NAMES[c]).join(' и ')}">
            ${d.colors.map(c => `<img src="img/symbols/${c}.svg" alt="">`).join('')}
          </span>
          <span>${cardsWord(d.total)}</span>
        </div>
        <div class="tile-credit">Худ. ${esc(d.art.artist)} · © Wizards of the Coast</div>
      </div>
    </a>`).join('');
  app.innerHTML = `<main class="screen">
    <h1 class="home-title">Справочник по MTG</h1>
    <span class="ornament" aria-hidden="true"></span>
    <div class="deck-tiles">${tiles}</div>
    <div class="home-buttons">
      <a class="btn btn-primary" href="#/glossary">Словарик</a>
      <a class="btn btn-primary" href="#/turn">Как проходит ход</a>
    </div>
    <a class="about-link" href="#/about">О приложении</a>
  </main>`;
}

// ---------- Экран колоды ----------
function deckScreen(deck) {
  const hand = loadHand(deck.id);
  let index = 0;
  const sections = SECTIONS.map(([key, title]) => {
    const list = deck.sections[key] || [];
    if (!list.length) return '';
    const total = list.reduce((s, c) => s + c.count, 0);
    const items = list.map(({ slug, count }) => {
      const card = DATA.cards[slug];
      return `<button class="thumb" data-i="${index++}" aria-label="${esc(card.ru.name)}, ${count} шт.">
        <span class="card-slot" data-slug="${slug}"></span>
        ${count > 1 ? `<span class="copies">×${count}</span>` : ''}
        <span class="thumb-name">${esc(card.ru.name)}</span>
      </button>`;
    }).join('');
    return `<h2 class="section-title">${title} <span class="count">${cardsWord(total)}</span></h2>
      <div class="card-grid">${items}</div>`;
  }).join('');

  app.innerHTML = `<main class="screen deck-screen">
    ${topbar(deck.title, '#/')}
    ${sections}
    <div class="hand-bar"><button class="btn btn-burgundy" data-hand>
      Рука: <span class="hand-count">${hand.length}</span></button></div>
  </main>`;
  wireBack(app);
  // Миниатюры — те же переведённые карты, только маленькие
  app.querySelectorAll('.card-slot').forEach(slot => slot.replaceWith(renderCard(DATA.cards[slot.dataset.slug])));
  app.querySelectorAll('.thumb').forEach(b => b.onclick = () => go(`#/deck/${deck.id}/card/${b.dataset.i}`));
  app.querySelector('[data-hand]').onclick = () => go(`#/deck/${deck.id}/hand`);
}

// ---------- Просмотр карт на весь экран (колода или рука) ----------
// mode: 'deck' — листаем колоду, кнопка «В руку»; 'hand' — листаем руку, кнопка «Сыграна»
function viewerScreen(deck, mode, startIndex) {
  const list = () => mode === 'deck' ? deckCards(deck).map(c => c.slug) : loadHand(deck.id);
  let index = Math.max(0, Math.min(startIndex || 0, list().length - 1));
  const countInDeck = slug => deckCards(deck).find(c => c.slug === slug)?.count || 0;

  app.innerHTML = `<section class="viewer">
    ${topbar(mode === 'deck' ? deck.title : 'Моя рука', `#/deck/${deck.id}`, '<span class="pos"></span>')}
    <div class="stage"></div>
    <div class="card-name"></div>
    <div class="actions">${mode === 'deck'
      ? '<button class="btn btn-primary" data-add>В руку <span class="in-hand"></span></button>'
      : `<button class="btn btn-burgundy" data-played>Сыграна</button>
         <button class="btn btn-paper btn-newgame" data-newgame>Новая игра</button>`}</div>
  </section>`;
  wireBack(app);

  const stage = app.querySelector('.stage');
  const pos = app.querySelector('.pos');
  const nameEl = app.querySelector('.card-name');
  const zoom = new Zoomer(stage, dir => show(index + dir, dir));

  function updateHandInfo() {
    if (mode !== 'deck') return;
    const slug = list()[index];
    const n = loadHand(deck.id).filter(s => s === slug).length;
    app.querySelector('.in-hand').textContent = n ? `(в руке: ${n})` : '';
  }

  function show(i, dir = 0) {
    const items = list();
    if (!items.length) {
      zoom.clear();
      stage.innerHTML = `<div class="empty"><span class="big">Рука пуста</span>
        Откройте колоду, нажмите на карту, а потом — «В руку».</div>`;
      pos.textContent = '';
      nameEl.textContent = '';
      app.querySelector('[data-played]').hidden = true;
      return false;
    }
    if (i < 0 || i >= items.length) return false; // дальше листать некуда
    index = i;
    const slug = items[index];
    const card = DATA.cards[slug];
    zoom.setCard(renderCard(card), dir);
    pos.textContent = `${index + 1} из ${items.length}`;
    const copies = countInDeck(slug);
    nameEl.textContent = card.ru.name + (mode === 'deck' && copies > 1 ? ` · ×${copies} в колоде` : '');
    updateHandInfo();
    // Адрес обновляем без новой записи в истории, чтобы «Назад» вёл сразу к колоде
    history.replaceState(null, '', `#/deck/${deck.id}/${mode === 'deck' ? 'card' : 'hand'}/${index}`);
    return true;
  }

  if (mode === 'deck') {
    app.querySelector('[data-add]').onclick = () => {
      const slug = list()[index];
      const hand = loadHand(deck.id);
      const have = hand.filter(s => s === slug).length;
      const max = countInDeck(slug);
      if (have >= max) {
        toast(max === 1 ? 'Эта карта в колоде одна — она уже в руке' : `В колоде всего ${max} такие карты — все уже в руке`);
        return;
      }
      hand.push(slug);
      saveHand(deck.id, hand);
      updateHandInfo();
      toast(`В руке: ${cardsWord(hand.length)}`);
    };
  } else {
    app.querySelector('[data-played]').onclick = () => {
      const hand = loadHand(deck.id);
      hand.splice(index, 1);
      saveHand(deck.id, hand);
      toast('Карта сыграна');
      show(Math.min(index, hand.length - 1));
    };
    app.querySelector('[data-newgame]').onclick = async () => {
      if (await confirmBox('Новая игра?', 'Все карты уйдут из руки.', 'Да, очистить руку')) {
        saveHand(deck.id, []);
        show(0);
        toast('Рука очищена');
      }
    };
  }
  show(index);
}

// ---------- Увеличение двумя пальцами и свайпы ----------
// Карта и русский текст лежат в одном элементе, поэтому масштабируются вместе.
class Zoomer {
  constructor(stage, onSwipe) {
    this.stage = stage;
    this.onSwipe = onSwipe;
    this.pointers = new Map();
    this.s = 1; this.tx = 0; this.ty = 0;
    this.lastTap = 0;
    stage.addEventListener('pointerdown', e => this.down(e));
    stage.addEventListener('pointermove', e => this.move(e));
    stage.addEventListener('pointerup', e => this.up(e));
    stage.addEventListener('pointercancel', e => this.up(e));
    // Не даём Safari увеличивать всю страницу вместо карты
    stage.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
    stage.addEventListener('gesturestart', e => e.preventDefault());
    // Пересчёт размера при повороте экрана; когда экран закрыт — отписываемся
    this.onResize = () => stage.isConnected ? this.layout() : removeEventListener('resize', this.onResize);
    addEventListener('resize', this.onResize);
  }
  clear() { this.stage.innerHTML = ''; this.target = null; }

  // Новая карта; dir = ±1 — с какой стороны она въезжает
  setCard(cardEl, dir = 0) {
    const slide = document.createElement('div');
    slide.className = 'slide';
    const target = document.createElement('div');
    target.className = 'zoom-target';
    target.appendChild(cardEl);
    slide.appendChild(target);
    const old = this.stage.querySelector('.slide');
    if (old && dir) {
      old.style.transition = 'transform .22s ease, opacity .22s ease';
      old.style.transform = `translateX(${-dir * 100}%)`;
      old.style.opacity = '0';
      setTimeout(() => old.remove(), 230);
      slide.style.transform = `translateX(${dir * 100}%)`;
      this.stage.appendChild(slide);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        slide.style.transition = 'transform .22s ease';
        slide.style.transform = 'translateX(0)';
      }));
    } else {
      this.stage.innerHTML = '';
      this.stage.appendChild(slide);
    }
    this.slide = slide;
    this.target = target;
    this.s = 1; this.tx = 0; this.ty = 0;
    this.layout();
  }

  // Размер карты: целиком помещается на сцене
  layout() {
    if (!this.target) return;
    const W = this.stage.clientWidth, H = this.stage.clientHeight;
    const w = Math.min(W, H * 744 / 1040, 640);
    this.w = w; this.h = w * 1040 / 744;
    this.baseX = (W - this.w) / 2; this.baseY = (H - this.h) / 2;
    Object.assign(this.target.style, { position: 'absolute', left: this.baseX + 'px', top: this.baseY + 'px', width: this.w + 'px' });
    this.apply();
  }

  apply(animate = false) {
    if (!this.target) return;
    this.clamp();
    this.target.style.transition = animate ? 'transform .2s ease' : 'none';
    this.target.style.transform = `translate(${this.tx}px, ${this.ty}px) scale(${this.s})`;
  }

  // Не даём увести карту за край экрана
  clamp() {
    const W = this.stage.clientWidth, H = this.stage.clientHeight;
    const fix = (t, base, size, view) => {
      const scaled = size * this.s;
      if (scaled <= view) return (view - scaled) / 2 - base; // меньше экрана — по центру
      return Math.min(-base, Math.max(view - scaled - base, t));
    };
    this.tx = fix(this.tx, this.baseX, this.w, W);
    this.ty = fix(this.ty, this.baseY, this.h, H);
  }

  local(e) {
    const r = this.stage.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // Масштаб s вокруг точки p (координаты сцены)
  zoomAt(p, s, from = { s: this.s, tx: this.tx, ty: this.ty }) {
    s = Math.min(4, Math.max(1, s));
    const cx = (p.x - this.baseX - from.tx) / from.s;
    const cy = (p.y - this.baseY - from.ty) / from.s;
    this.s = s;
    this.tx = p.x - this.baseX - cx * s;
    this.ty = p.y - this.baseY - cy * s;
  }

  down(e) {
    if (!this.target) return;
    try { this.stage.setPointerCapture(e.pointerId); } catch { /* палец уже отпущен */ }
    this.pointers.set(e.pointerId, this.local(e));
    const pts = [...this.pointers.values()];
    this.start = { s: this.s, tx: this.tx, ty: this.ty, p: pts[0], time: Date.now(), moved: false };
    if (pts.length === 2) {
      this.start.dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      this.start.mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      this.pinched = true;
    }
  }

  move(e) {
    if (!this.pointers.has(e.pointerId) || !this.start) return;
    this.pointers.set(e.pointerId, this.local(e));
    const pts = [...this.pointers.values()];
    if (pts.length >= 2 && this.start.dist) {
      // Два пальца: увеличение вокруг середины между пальцами + сдвиг
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      this.zoomAt(this.start.mid, this.start.s * dist / this.start.dist, this.start);
      this.tx += mid.x - this.start.mid.x;
      this.ty += mid.y - this.start.mid.y;
      this.apply();
      return;
    }
    const dx = pts[0].x - this.start.p.x, dy = pts[0].y - this.start.p.y;
    if (Math.hypot(dx, dy) > 8) this.start.moved = true;
    if (this.s > 1.02) {
      // Один палец на увеличенной карте — двигаем её
      this.tx = this.start.tx + dx; this.ty = this.start.ty + dy;
      this.apply();
    } else if (!this.pinched && this.slide) {
      // Один палец на обычной карте — тянем вбок для свайпа
      this.slide.style.transition = 'none';
      this.slide.style.transform = `translateX(${dx}px)`;
    }
  }

  up(e) {
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.local(e);
    this.pointers.delete(e.pointerId);
    if (this.pointers.size > 0) { // убрали один палец из двух — продолжаем как сдвиг
      const rest = [...this.pointers.values()][0];
      this.start = { s: this.s, tx: this.tx, ty: this.ty, p: rest, time: Date.now(), moved: true };
      return;
    }
    const st = this.start;
    this.start = null;
    if (!st) return;
    const dx = p.x - st.p.x, dy = p.y - st.p.y, dt = Date.now() - st.time;

    if (this.pinched) {
      this.pinched = false;
      if (this.s < 1.05) { this.s = 1; this.apply(true); }
      return;
    }
    if (this.s <= 1.02 && st.moved) {
      // Свайп: достаточно далеко или быстро и больше вбок, чем вверх-вниз
      const swipe = Math.abs(dx) > Math.abs(dy) * 1.2 && (Math.abs(dx) > 60 || (Math.abs(dx) > 25 && dt < 250));
      if (swipe && this.onSwipe(dx < 0 ? 1 : -1) !== false) return;
      this.slide.style.transition = 'transform .2s ease';
      this.slide.style.transform = 'translateX(0)';
      return;
    }
    if (!st.moved && dt < 300) {
      // Двойное касание: увеличить в 2,5 раза или вернуть как было
      const now = Date.now();
      if (now - this.lastTap < 320) {
        this.lastTap = 0;
        if (this.s > 1.02) { this.s = 1; this.tx = 0; this.ty = 0; } else this.zoomAt(p, 2.5);
        this.apply(true);
      } else this.lastTap = now;
    }
  }
}

// ---------- Словарик ----------
function glossaryScreen() {
  // Где встречается карта-пример: «колода на гномах»
  const decksOf = slug => DATA.decks.filter(d => deckCards(d).some(c => c.slug === slug))
    .map(d => d.title.replace('Колода', 'колода')).join(', ');
  const sym = t => esc(t).replace(/\{T\}/g, '<img class="sym" src="img/symbols/T.svg" alt="{T}">');
  const groups = GLOSSARY.map(g => `<h2 class="section-title">${esc(g.title)}</h2>` + g.items.map(it => {
    const ex = DATA.cards[it.ex];
    return `<article class="paper term">
      <h3>${esc(it.ru)} <span class="en">${esc(it.en)}</span></h3>
      <p>${sym(it.text)}</p>
      ${ex ? `<p class="example">Пример: <b>${esc(ex.ru.name)}</b> (${esc(decksOf(it.ex))})</p>` : ''}
    </article>`;
  }).join('')).join('');
  app.innerHTML = `<main class="screen">${topbar('Словарик', '#/')}${groups}</main>`;
  wireBack(app);
}

// ---------- Как проходит ход ----------
function turnScreen() {
  const phases = TURN.map((ph, i) => `<article class="paper phase">
    <h2><span class="num">${i + 1}</span>${esc(ph.name)}</h2>
    ${ph.text ? `<p>${esc(ph.text)}</p>` : ''}
    ${ph.steps ? `<ol>${ph.steps.map(s => `<li><b>${esc(s.name)}.</b> ${esc(s.text)}</li>`).join('')}</ol>` : ''}
  </article>`).join('');
  app.innerHTML = `<main class="screen">${topbar('Как проходит ход', '#/')}
    <p>Ход каждого игрока идёт по одним и тем же шагам. Потом ходит соперник.</p>
    ${phases}
    <p class="paper tip">${esc(TURN_TIP)}</p></main>`;
  wireBack(app);
}

// ---------- О приложении ----------
function aboutScreen() {
  app.innerHTML = `<main class="screen">${topbar('О приложении', '#/')}
  <div class="paper about">
    <p><b>Справочник по MTG</b> — неофициальный некоммерческий проект: перевод на русский язык карт из четырёх колод для семейной игры. Перевод любительский.</p>
    <p>Данные и изображения карт взяты из Scryfall (scryfall.com).</p>
    <p>Magic: The Gathering, изображения и тексты карт — © Wizards of the Coast LLC.</p>
    <p lang="en"><i>Справочник по MTG is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.</i></p>
    <p>«Справочник по MTG» — неофициальный фанатский материал, разрешённый Политикой фанатского контента (Fan Content Policy). Не одобрен и не поддерживается Wizards. Часть использованных материалов принадлежит Wizards of the Coast. ©Wizards of the Coast LLC.</p>
    <p>Шрифты PT Serif и Cormorant Garamond распространяются по лицензии SIL Open Font License.</p>
  </div></main>`;
  wireBack(app);
}

// ---------- Переключение экранов ----------
function route() {
  document.getElementById('toast').classList.remove('show');
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  window.scrollTo(0, 0);
  if (parts[0] === 'deck') {
    const deck = deckById(parts[1]);
    if (!deck) return go('#/');
    if (parts[2] === 'card') return viewerScreen(deck, 'deck', +parts[3] || 0);
    if (parts[2] === 'hand') return viewerScreen(deck, 'hand', +parts[3] || 0);
    return deckScreen(deck);
  }
  if (parts[0] === 'glossary') return glossaryScreen();
  if (parts[0] === 'turn') return turnScreen();
  if (parts[0] === 'about') return aboutScreen();
  homeScreen();
}

DATA = await (await fetch('data/app.json')).json();
addEventListener('hashchange', route);
route();
document.documentElement.dataset.ready = '1';
