(function () {
  var t = localStorage.getItem('theme') || 'dark';
  var glass = t === 'glass' || t === 'glass-light';
  document.documentElement.classList.toggle('dark', t === 'dark' || t === 'glass');
  document.documentElement.classList.toggle('glass', glass);
  document.documentElement.classList.toggle('glass-light', t === 'glass-light');
  if (glass) {
    var wp = localStorage.getItem('app.wallpaper.v1') || '/wallpapers/wp14.jpg';
    document.documentElement.style.setProperty('--app-wallpaper', "url('" + wp + "')");
  }
})();
