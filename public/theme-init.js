(function () {
  var t = localStorage.getItem('theme') || 'dark';
  document.documentElement.classList.toggle('dark', t === 'dark' || t === 'glass');
  document.documentElement.classList.toggle('glass', t === 'glass');
  if (t === 'glass') {
    var wp = localStorage.getItem('app.wallpaper.v1') || '/wallpapers/wp1.jpg';
    document.documentElement.style.setProperty('--app-wallpaper', "url('" + wp + "')");
  }
})();
