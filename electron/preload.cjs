const { contextBridge } = require('electron');

// Пока рендереру от нативной части ничего не нужно: данные лежат в IndexedDB.
// Мост оставлен как точка роста — сюда добавятся экспорт в файл, автозапуск, трей.
contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  version: process.versions.electron,
});
