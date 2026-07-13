/** Предзагрузка изображений в кеш браузера, чтобы обои/превью не «проявлялись»
 *  при открытии пикера и мгновенно менялись. Ссылки на Image держим в модуле,
 *  чтобы GC не выкинул их до завершения загрузки. */
const done = new Set<string>();
const kept: HTMLImageElement[] = [];

export function preloadImages(urls: string[]): void {
  for (const url of urls) {
    if (!url || done.has(url)) continue;
    done.add(url);
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    kept.push(img);
    // после загрузки ссылку можно отпустить — картинка осталась в HTTP-кеше
    img.onload = img.onerror = () => {
      const i = kept.indexOf(img);
      if (i >= 0) kept.splice(i, 1);
    };
  }
}

/** Предзагрузить одну картинку и дождаться готовности (для плавной смены фона). */
export function preloadImage(url: string): Promise<void> {
  if (!url || done.has(url)) return Promise.resolve();
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = img.onerror = () => { done.add(url); resolve(); };
    img.src = url;
  });
}
