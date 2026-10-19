// Этап 7: проверка приложения в WebKit (движок Safari) с экраном iPhone.
// Снимает главные экраны, проверяет руку (и что она сохраняется после перезагрузки),
// свайпы, увеличение и работу без интернета.
// Запуск: node scripts/test-app.js   → screenshots/app/*.png
import fs from 'node:fs';
import { webkit, devices } from 'playwright';
import { startServer } from './serve.js';

const PORT = 8095, URL = `http://localhost:${PORT}/`;
const OUT = 'screenshots/app';
fs.mkdirSync(OUT, { recursive: true });
const server = await startServer(PORT);
const browser = await webkit.launch();
const context = await browser.newContext({ ...devices['iPhone 15 Pro'] });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

let ok = 0, fail = 0;
const check = (cond, msg) => { cond ? ok++ : fail++; console.log((cond ? '  ✓ ' : '  ✗ ') + msg); };
const shot = async name => { await page.waitForTimeout(350); await page.screenshot({ path: `${OUT}/${name}.png` }); };
const ready = () => page.waitForFunction(() => document.documentElement.dataset.ready === '1');
// Свайп пальцем по сцене (события указателя, как у сенсорного экрана)
async function swipe(dx) {
  await page.evaluate(dx => {
    const st = document.querySelector('.stage');
    const r = st.getBoundingClientRect();
    const y = r.top + r.height / 2, x0 = r.left + r.width / 2;
    const ev = (type, x) => st.dispatchEvent(new PointerEvent(type, { pointerId: 7, clientX: x, clientY: y, bubbles: true, pointerType: 'touch' }));
    ev('pointerdown', x0);
    for (let i = 1; i <= 5; i++) ev('pointermove', x0 + dx * i / 5);
    ev('pointerup', x0 + dx);
  }, dx);
  await page.waitForTimeout(300);
}
// Увеличение двумя пальцами: разводим пальцы в k раз
async function pinch(k) {
  await page.evaluate(k => {
    const st = document.querySelector('.stage');
    const r = st.getBoundingClientRect();
    const cx = r.left + r.width * 0.45, cy = r.top + r.height * 0.72, d0 = 40;
    const ev = (type, id, x, y) => st.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: 'touch' }));
    ev('pointerdown', 1, cx - d0, cy); ev('pointerdown', 2, cx + d0, cy);
    for (let i = 1; i <= 6; i++) { const d = d0 * (1 + (k - 1) * i / 6); ev('pointermove', 1, cx - d, cy); ev('pointermove', 2, cx + d, cy); }
    ev('pointerup', 1, cx - d0 * k, cy); ev('pointerup', 2, cx + d0 * k, cy);
  }, k);
  await page.waitForTimeout(300);
}

console.log('Главный экран');
await page.goto(URL);
await ready();
await page.evaluate(() => document.fonts.ready);
check(await page.locator('.deck-tile').count() === 4, 'четыре плитки колод');
const tiles = await page.locator('.deck-tile h2').allTextContents();
check(tiles.join('|') === 'Колода на гномах|Колода на людях|Колода на гоблинах|Колода на эльфах', 'названия плиток');
const counts = await page.locator('.tile-meta span:last-child').allTextContents();
check(counts.join('|') === '40 карт|44 карты|47 карт|44 карты', 'количество карт: ' + counts.join(', '));
await shot('01-home');

console.log('Экран колоды');
await page.locator('.deck-tile').first().click();
await page.waitForSelector('.deck-screen');
const sectionTitles = await page.locator('.section-title').allTextContents();
check(sectionTitles.length === 3 && sectionTitles[2].startsWith('Земли'), 'разделы: ' + sectionTitles.map(s => s.split(' ')[0]).join(', '));
check(await page.locator('.thumb').count() === 25, 'гномы: 25 разных карт (13 + 11 + 1)');
await shot('02-deck-dwarves');
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await shot('03-deck-dwarves-bottom');

console.log('Колода без земель');
await page.goto(URL + '#/deck/humans');
await page.waitForSelector('.deck-screen');
check(!(await page.locator('.section-title').allTextContents()).some(t => t.startsWith('Земли')), 'у людей раздела «Земли» нет');

console.log('Карта на весь экран, свайпы, рука');
await page.goto(URL + '#/deck/dwarves');
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.goto(URL + '#/deck/dwarves');
await page.waitForSelector('.thumb');
await page.locator('.thumb').nth(1).click(); // Кузнец Железных Холмов, ×2
await page.waitForSelector('.viewer .mtg-card');
check((await page.locator('.card-name').textContent()).includes('Кузнец'), 'открылась нужная карта');
await shot('04-card-full');
await page.locator('[data-add]').click();
await page.locator('[data-add]').click();
await page.locator('[data-add]').click(); // третий раз — больше, чем в колоде
check((await page.locator('.in-hand').textContent()).includes('2'), 'в руке 2 копии (не больше, чем в колоде)');
await swipe(-150);
check((await page.locator('.pos').textContent()).startsWith('3 из'), 'свайп влево — следующая карта');
await page.locator('[data-add]').click(); // Бифур
await swipe(150);
check((await page.locator('.pos').textContent()).startsWith('2 из'), 'свайп вправо — предыдущая карта');
await pinch(2.6);
const scale = await page.evaluate(() => +document.querySelector('.zoom-target').style.transform.match(/scale\(([\d.]+)/)[1]);
check(scale > 2, `увеличение двумя пальцами (×${scale.toFixed(1)})`);
await shot('05-card-zoom');
// Текст на увеличенной карте — настоящий HTML-текст
check(await page.locator('.viewer .plate.text p').count() > 0, 'текст карты — HTML, масштабируется вместе с картинкой');

console.log('Рука сохраняется после перезагрузки');
await page.goto(URL + '#/deck/dwarves');
await page.reload();
await page.waitForSelector('.hand-count');
check((await page.locator('.hand-count').textContent()) === '3', 'после перезагрузки «Рука: 3»');
await shot('06-deck-hand-bar');
await page.locator('[data-hand]').click();
await page.waitForSelector('.viewer');
await shot('07-hand');
await page.locator('[data-played]').click();
check((await page.locator('.pos').textContent()) === '1 из 2', '«Сыграна» убирает одну копию');
await page.locator('[data-newgame]').click();
await shot('08-new-game-confirm');
await page.locator('[data-ok]').click();
check(await page.locator('.empty').count() === 1, '«Новая игра» очищает руку');
await page.goto(URL + '#/deck/goblins');
await page.waitForSelector('.hand-count');
check((await page.locator('.hand-count').textContent()) === '0', 'у другой колоды своя рука');

console.log('Словарик, ход, о приложении');
await page.goto(URL + '#/glossary');
await page.waitForSelector('.term');
const missing = await page.evaluate(() => [...document.querySelectorAll('.term')].filter(t => !t.querySelector('.example')).map(t => t.querySelector('h3').textContent));
check(missing.length === 0, 'у каждого слова есть пример карты' + (missing.length ? ': нет у ' + missing.join(', ') : ''));
await shot('09-glossary');
await page.goto(URL + '#/turn');
await page.waitForSelector('.phase');
await shot('10-turn');
await page.goto(URL + '#/about');
await page.waitForSelector('.about');
await shot('11-about');

console.log('Кнопка «Назад» и размеры кнопок');
for (const h of ['#/deck/elves', '#/deck/elves/card/0', '#/deck/elves/hand', '#/glossary', '#/turn', '#/about']) {
  await page.goto(URL + h);
  await page.waitForSelector('.btn-back');
}
check(true, 'кнопка «Назад» есть на каждом экране');
await page.goto(URL + '#/deck/elves/card/0');
await page.waitForSelector('.btn-back');
const small = await page.evaluate(() => [...document.querySelectorAll('button, a')].filter(b => {
  const r = b.getBoundingClientRect(); return r.width && (r.width < 44 || r.height < 44);
}).map(b => b.textContent.trim().slice(0, 20)));
check(small.length === 0, 'все кнопки не меньше 44×44' + (small.length ? ': ' + small.join(', ') : ''));

console.log('Работа без интернета');
await page.goto(URL);
await ready();
const swReady = await page.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return 'нет поддержки';
  await navigator.serviceWorker.ready;
  for (let i = 0; i < 60 && !navigator.serviceWorker.controller; i++) await new Promise(r => setTimeout(r, 250));
  return navigator.serviceWorker.controller ? 'ok' : 'не управляет страницей';
});
if (swReady === 'ok') {
  server.close(); // сервер выключен — как будто интернета нет
  await context.setOffline(true);
  await page.goto(URL + '#/deck/elves', { waitUntil: 'load' }).catch(() => {});
  await page.waitForSelector('.thumb', { timeout: 5000 }).catch(() => {});
  const imgsOk = await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll('.thumb img.card-img')].slice(0, 6);
    imgs.forEach(i => i.loading = 'eager');
    await Promise.all(imgs.map(i => i.decode().catch(() => {})));
    return imgs.length > 0 && imgs.every(i => i.naturalWidth > 0);
  });
  check(imgsOk, 'без интернета: колода и картинки открываются из кэша');
  await shot('12-offline-deck');
} else {
  check(false, 'service worker: ' + swReady);
}

check(errors.length === 0, 'ошибок JavaScript нет' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
console.log(`\nИтого: ${ok} проверок прошло, ${fail} не прошло`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
