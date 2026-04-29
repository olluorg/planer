(function () {
  var t = localStorage.getItem('theme') || 'dark';
  document.documentElement.classList.toggle('dark', t === 'dark');
})();
