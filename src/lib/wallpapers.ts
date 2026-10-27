/** Distinct subjects; UHD files are upscaled from generated sources. */
export const DIVERSE_WALLPAPERS = [
  ['01-city-cloud', 'Город над облаками'],
  ['02-tokyo-rain', 'Токио после дождя'],
  ['03-cafe-morning', 'Кафе до открытия'],
  ['04-retro-night', 'Ночная мастерская'],
  ['05-cloud-sea', 'Розовый горизонт'],
  ['06-white-object', 'Белая тишина'],
  ['07-black-object', 'Чёрный монолит'],
  ['08-glass-sculpture', 'Дымчатое стекло'],
  ['09-concrete-light', 'Свет на бетоне'],
  ['10-coastal-train', 'Станция у моря'],
].map(([id, title]) => ({
  id, title,
  src: `/backgrounds/diverse-2026-10/${id}.webp`,
  preview: `/backgrounds/diverse-2026-10/thumbs/${id}.webp`,
}));

/** Earlier rain and fog collection retained for existing selections. */
export const GENERATED_WALLPAPERS = [
  ['01-rain-valley', 'Долина после дождя'],
  ['02-low-clouds', 'Низкие облака'],
  ['03-wet-road', 'Дорога в туман'],
  ['04-silent-lake', 'Озеро в мороси'],
  ['05-cloud-ravine', 'Облачное ущелье'],
  ['06-rain-shelter', 'Дом среди мокрых елей'],
  ['07-storm-fjord', 'Фьорд после шторма'],
  ['08-wet-canopy', 'Влажная хвоя'],
  ['09-blue-drizzle', 'Синие сумерки'],
  ['10-fog-pass', 'Перевал в облаке'],
].map(([id, title]) => ({
  id, title,
  src: `/backgrounds/atmosphere-2026-10/${id}.webp`,
  preview: `/backgrounds/atmosphere-2026-10/thumbs/${id}.webp`,
}));

export const WALLPAPERS = [
  ...Array.from({ length: 20 }, (_, i) => `/wallpapers/wp${i + 1}.jpg`),
  ...DIVERSE_WALLPAPERS.map((w) => w.src),
  ...GENERATED_WALLPAPERS.map((w) => w.src),
];

export const wallpaperPreview = (src: string) =>
  [...DIVERSE_WALLPAPERS, ...GENERATED_WALLPAPERS].find((w) => w.src === src)?.preview
  ?? (/^\/wallpapers\/wp\d+\.jpg$/.test(src) ? src.replace('/wallpapers/', '/backgrounds/stock-thumbs/').replace('.jpg', '.webp') : src);

export const wallpaperTitle = (src: string) =>
  [...DIVERSE_WALLPAPERS, ...GENERATED_WALLPAPERS].find((w) => w.src === src)?.title
  ?? (src.startsWith('/wallpapers/wp') ? `Обои ${src.match(/wp(\d+)/)?.[1]}` : 'Свои обои');
