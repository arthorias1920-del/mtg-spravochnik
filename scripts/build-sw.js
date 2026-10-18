// Создаёт site/sw.js — service worker, который заранее кэширует ВСЕ файлы приложения.
// Версия кэша — отпечаток содержимого файлов: любое изменение → новая версия →
// телефон скачает обновление и удалит старый кэш.
// Запуск: node scripts/build-sw.js (после любых изменений в site/)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = 'site';
const SKIP = new Set(['sw.js', 'prototype.html', '.DS_Store']);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    if (SKIP.has(e.name)) return [];
    return e.isDirectory() ? walk(p) : [p];
  });
}

const files = walk(ROOT).map(f => path.relative(ROOT, f).split(path.sep).join('/')).sort();
const hash = crypto.createHash('sha256');
let bytes = 0;
for (const f of files) {
  const buf = fs.readFileSync(path.join(ROOT, f));
  hash.update(f).update(buf);
  bytes += buf.length;
}
const version = hash.digest('hex').slice(0, 10);

// Все пути относительные ("./…"), чтобы работало по адресу имя.github.io/репозиторий/
const list = ['./', ...files.map(f => './' + f)];

const sw = `// Создано скриптом scripts/build-sw.js — не редактируйте вручную.
const VERSION = '${version}';
const CACHE = 'mtg-spravochnik-' + VERSION;
const FILES = ${JSON.stringify(list, null, 1)};

// Установка: скачиваем и кэшируем все файлы приложения
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

// Активация: удаляем кэши старых версий
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('mtg-spravochnik-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Запросы: сначала из кэша, если нет — из сети
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(hit => hit || fetch(event.request))
  );
});
`;
fs.writeFileSync(path.join(ROOT, 'sw.js'), sw);
console.log(`sw.js: версия ${version}, файлов ${list.length}, размер приложения ${(bytes / 1048576).toFixed(1)} МБ`);
