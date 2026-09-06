const { contextBridge, ipcRenderer } = require('electron');

// Данные живут в IndexedDB рендерера, натив нужен только там, где браузерных
// возможностей не хватает: напоминания при закрытом окне.
contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  version: process.versions.electron,
  /** Передать расписание напоминаний main-процессу: он показывает их и тогда,
   *  когда окно свёрнуто в трей и рендерер не выполняется. */
  setReminders: (reminders) => ipcRenderer.send('reminders:set', reminders),
});
