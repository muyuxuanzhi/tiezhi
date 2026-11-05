/* 入口：预加载素材、适配缩放、绑定顶栏 */
(function () {
  var TZ = window.TZ;
  TZ.load();
  TZ.stage = document.getElementById('stage');
  TZ.fit();
  window.addEventListener('resize', TZ.fit);
  window.addEventListener('orientationchange', function () { setTimeout(TZ.fit, 200); });

  document.getElementById('btn-sound').addEventListener('click', function () {
    TZ.audio.init(); TZ.audio.setSound(!TZ.S.sound); TZ.updateTop();
  });
  document.getElementById('btn-pause').addEventListener('click', function () { if (TZ.pauseClick) TZ.pauseClick(); });
  document.addEventListener('pointerdown', function () { TZ.audio.init(); }, { once: false, passive: true });
  document.addEventListener('visibilitychange', function () { if (document.hidden) TZ.audio.rustleStop(); });
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  var list = ['desk.jpg', 'book.png', 'cover.png', 'foilAurora.jpg', 'foilGlitter.jpg', 'foilPrism.jpg',
    'tweezer0.png', 'tweezer1.png', 'tweezer2.png', 'tweezer3.png'];
  Object.keys(TZ.BB).forEach(function (k) { list.push(k + '.png'); });
  var done = 0;
  function step() {
    done++;
    document.getElementById('load-text').textContent = '正在翻开手账… ' + Math.round(done / list.length * 100) + '%';
    if (done >= list.length) start();
  }
  var started = false;
  function start() {
    if (started) return; started = true;
    var l = document.getElementById('loading'); l.classList.add('hide');
    setTimeout(function () { l.remove(); }, 500);
    TZ.go('home');
  }
  list.forEach(function (n) {
    var i = new Image(); i.onload = i.onerror = step; i.src = 'assets/img/' + n;
  });
  setTimeout(start, 8000);
})();
