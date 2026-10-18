// Подбор размеров шрифта для всех карт в WebKit (движок Safari) и скриншот каждой карты.
// Результат: data/fit.json (размеры попадают в приложение через build-app-data.js),
// screenshots/cards/<slug>.png и отчёт о картах, где текст мельче минимума.
// Запуск: node scripts/measure-fit.js
import fs from 'node:fs';
import { webkit } from 'playwright';
import { startServer } from './serve.js';

const PORT = 8093;
fs.mkdirSync('screenshots/cards', { recursive: true });
const server = await startServer(PORT);
const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 1100 }, deviceScaleFactor: 1 });
page.on('console', m => { if (m.type() === 'error') console.log('  консоль:', m.text()); });

// Пустая страница на адресе нашего сервера, чтобы работали относительные пути
await page.goto(`http://localhost:${PORT}/__blank`);
await page.setContent(`<!doctype html><html lang="ru"><head><meta charset="utf-8">
  <link rel="stylesheet" href="/css/card.css"><base href="/"></head>
  <body style="margin:0;background:#fff"><div id="slot" style="width:744px;padding:20px"></div></body></html>`);

const data = JSON.parse(fs.readFileSync('site/data/app.json', 'utf8'));
const fit = {}, problems = [];
for (const slug of Object.keys(data.cards)) {
  const res = await page.evaluate(async card => {
    const { renderCard, fitCard, fontsReady } = await import('/js/card.js');
    await fontsReady();
    const slot = document.getElementById('slot');
    slot.innerHTML = '';
    const el = renderCard(card, {});
    slot.appendChild(el);
    await Promise.all([...el.querySelectorAll('img')].map(i => i.decode().catch(() => {})));
    return fitCard(el);
  }, data.cards[slug]);
  fit[slug] = res.sizes;
  if (res.small.length || res.overflow.length) {
    problems.push(`${slug}: ` + [...res.small.map(s => 'мельче минимума ' + s), ...res.overflow.map(o => 'не влезает ' + o)].join(', '));
  }
  await page.locator('.mtg-card').screenshot({ path: `screenshots/cards/${slug}.png` });
}
fs.writeFileSync('data/fit.json', JSON.stringify(fit, null, 1));

// Сводка по размеру текста правил (cqw → px при ширине карты 370 px на iPhone)
const textSizes = Object.entries(fit).map(([s, f]) => [s, f.text ?? f.reminder ?? 0]).sort((a, b) => a[1] - b[1]);
console.log('Самый мелкий текст правил:');
for (const [s, v] of textSizes.slice(0, 8)) console.log(`  ${s}: ${v} cqw ≈ ${(v * 3.7).toFixed(1)} px`);
console.log('Самый крупный:', textSizes.at(-1)[0], textSizes.at(-1)[1]);
console.log(problems.length ? 'ПРОБЛЕМЫ:\n  ' + problems.join('\n  ') : 'Все карты помещаются не мельче минимума.');
await browser.close();
server.close();
