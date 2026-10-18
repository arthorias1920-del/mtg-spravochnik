// Общий модуль для запросов к Scryfall: заголовки, паузы, кэш на диске.
import fs from 'node:fs';
import path from 'node:path';

const API = 'https://api.scryfall.com';
const HEADERS = {
  'User-Agent': 'MTGSpravochnik/1.0',
  'Accept': 'application/json;q=0.9,*/*;q=0.8',
};

let lastRequest = 0;

// Ждём, чтобы между запросами было не меньше minGap миллисекунд
async function throttle(minGap) {
  const wait = lastRequest + minGap - Date.now();
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastRequest = Date.now();
}

// GET-запрос к API с кэшем: если файл cacheFile уже есть, сеть не трогаем
export async function getJson(urlPath, cacheFile) {
  if (cacheFile && fs.existsSync(cacheFile)) {
    return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  }
  const url = urlPath.startsWith('http') ? urlPath : API + urlPath;
  // Поиск у Scryfall ограничен строже: между такими запросами 1 с
  const gap = /\/cards\/(search|named|collection)/.test(url) ? 1000 : 150;
  let res, json;
  // До 4 попыток: сеть иногда обрывает соединение
  for (let attempt = 1; ; attempt++) {
    await throttle(gap);
    try {
      res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(30000) });
      json = await res.json();
      // 429 — Scryfall просит подождать: ждём минуту и пробуем снова
      if (res.status === 429 && attempt < 4) {
        console.warn('  Scryfall просит подождать (429), пауза 65 с');
        await new Promise(r => setTimeout(r, 65000));
        continue;
      }
      break;
    } catch (e) {
      if (attempt >= 4) throw e;
      console.warn(`  повтор ${attempt} (${e.cause?.code || e.message})`);
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
  // 404 тоже сохраняем: «не найдено» — тоже результат, повторно не спрашиваем
  if (cacheFile && (res.ok || res.status === 404)) {
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(json, null, 2));
  }
  if (!res.ok && res.status !== 404) {
    throw new Error(`Scryfall ${res.status}: ${json.details || url}`);
  }
  return json;
}

// Поиск со всеми страницами результатов
export async function searchAll(query, cacheFile, extra = '') {
  if (cacheFile && fs.existsSync(cacheFile)) {
    return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  }
  let url = `/cards/search?q=${encodeURIComponent(query)}${extra}`;
  const all = [];
  while (url) {
    const page = await getJson(url);
    if (page.object === 'error') break;
    all.push(...page.data);
    url = page.has_more ? page.next_page : null;
  }
  const result = { query, data: all };
  if (cacheFile) {
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(result, null, 2));
  }
  return result;
}

// Скачивание файла (картинки) с паузой; если файл уже есть — пропускаем
export async function download(url, file) {
  if (fs.existsSync(file)) return false;
  for (let attempt = 1; ; attempt++) {
    await throttle(150);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': HEADERS['User-Agent'] }, signal: AbortSignal.timeout(60000) });
      if (!res.ok) throw new Error(`Не скачалось ${url}: ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, buf);
      return true;
    } catch (e) {
      if (attempt >= 4) throw e;
      console.warn(`  повтор ${attempt} (${e.cause?.code || e.message})`);
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
}

// Имя файла из названия карты: "Bilbo Baggins, Burglar" -> "bilbo-baggins-burglar"
export function slug(name) {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
