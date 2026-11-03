(function () {
  var saved = localStorage.getItem('theme');
  var firstVisit = !saved && localStorage.getItem('onboarding.done.v1') !== '1';
  if (firstVisit) {
    localStorage.setItem('dashboard.first-look.v1', '1');
    localStorage.setItem('theme', 'glass');
    if (!localStorage.getItem('accent')) localStorage.setItem('accent', 'graphite');
    if (!localStorage.getItem('app.wallpaper.v1')) localStorage.setItem('app.wallpaper.v1', '/backgrounds/diverse-2026-10/01-city-cloud.webp');
  }
  // Убираем только прежний автоматически установленный ролик; выбор пользователя сохраняем.
  try {
    var live = JSON.parse(localStorage.getItem('app.livewallpaper.v1') || 'null');
    if (live && live.kind === 'builtin' && live.ref === '/backgrounds/motion/city-fog.mp4') localStorage.removeItem('app.livewallpaper.v1');
  } catch (_) {}
  var t = saved || (firstVisit ? 'glass' : 'dark');
  if (['light', 'dark', 'glass', 'glass-light', 'work', 'work-light'].indexOf(t) === -1) t = 'dark';
  var glass = t === 'glass' || t === 'glass-light';
  document.documentElement.classList.toggle('dark', t === 'dark' || t === 'glass' || t === 'work');
  document.documentElement.classList.toggle('glass', glass);
  document.documentElement.classList.toggle('glass-light', t === 'glass-light');
  document.documentElement.classList.toggle('work', t === 'work' || t === 'work-light');
  document.documentElement.classList.toggle('work-light', t === 'work-light');
  if (glass) {
    var wp = localStorage.getItem('app.wallpaper.v1') || '/wallpapers/wp14.jpg';
    document.documentElement.style.setProperty('--app-wallpaper', "url('" + wp + "')");
  }
})();
