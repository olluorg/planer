/** Сжимает картинку до dataURL, влезающего в localStorage.
 *  Фото с телефона (5–10 МБ) в base64 пробивают квоту — поэтому масштабируем и жмём в JPEG. */
export function compressImage(file: File, maxSide = 1920, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('canvas 2d недоступен')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('не удалось прочитать изображение')); };
    img.src = url;
  });
}
