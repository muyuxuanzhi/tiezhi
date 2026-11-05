/* 核心：工具、存档、音频、舞台缩放、页面导航、通用贴纸元素 */
(function () {
  var TZ = window.TZ = window.TZ || {};
  var IMG = 'assets/img/';

  TZ.$ = function (s, r) { return (r || document).querySelector(s); };
  TZ.el = function (tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  TZ.pos = function (e, x, y, w, h) {
    e.style.left = x + 'px'; e.style.top = y + 'px';
    if (w != null) e.style.width = w + 'px';
    if (h != null) e.style.height = h + 'px';
    return e;
  };
  TZ.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  TZ.btn = function (text, cls, x, y, w, h, fn) {
    var b = TZ.el('button', 'btn ' + (cls || 'green'), text);
    TZ.pos(b, x, y, w, h);
    if (fn) b.addEventListener('click', function (e) { e.stopPropagation(); if (!b.disabled) { TZ.audio.play('press'); fn(e); } });
    return b;
  };
  TZ.seeded = function (seed) {
    var s = seed * 9301 + 49297;
    return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  };

  /* ---------------- 存档 ---------------- */
  var KEY = 'tiezhi_save_v1';
  function defSave() {
    return {
      v: 1, points: 0, earned: 0, tickets: 0, owned: { t: [0], p: [0] }, equip: { t: 0, p: 0 },
      teach: {}, main: {}, coll: {}, touched: {},
      stats: { peels: 0, places: 0, returns: 0, pairs: 0, sRate: 0, clean: 0, paper1: 0, paper2: 0, ticketWin: 0 },
      claimed: {}, sound: true, journal: null
    };
  }
  TZ.load = function () {
    var d = defSave();
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var o = JSON.parse(raw);
        for (var k in o) if (o.hasOwnProperty(k)) d[k] = o[k];
        for (var s in defSave().stats) if (d.stats[s] == null) d.stats[s] = 0;
      }
    } catch (e) { }
    TZ.S = d;
    return d;
  };
  TZ.persist = function () { try { localStorage.setItem(KEY, JSON.stringify(TZ.S)); } catch (e) { } };
  TZ.addPoints = function (n) { TZ.S.points += n; TZ.S.earned += n; TZ.persist(); TZ.updateTop(); };
  TZ.mainDoneCount = function () { var n = 0; for (var k in TZ.S.main) if (+k <= 12 && TZ.S.main[k] && TZ.S.main[k].done) n++; return n; };
  TZ.extraDoneCount = function () { var n = 0; for (var k in TZ.S.main) if (+k > 12 && TZ.S.main[k] && TZ.S.main[k].done) n++; return n; };
  TZ.creaseFx = function (stkEl, n) {
    if (!stkEl || !n) return;
    stkEl.classList.remove('cr1', 'cr2', 'cr3');
    stkEl.classList.add('cr' + Math.min(3, n));
  };
  TZ.achReady = function () {
    var n = 0;
    TZ.ACH.forEach(function (a, i) { if (!TZ.S.claimed[i] && a.cur(TZ.S) >= a.t) n++; });
    return n;
  };

  /* ---------------- 音频 ---------------- */
  var NAMES = ['bgm', 'buy', 'complete', 'error', 'peel', 'press', 'pressSoft0', 'pressSoft1', 'pressSoft2', 'result',
    'rustleFilm', 'rustleGlitter', 'rustleGold', 'rustlePaper', 'snap'];
  var A = TZ.audio = {
    ctx: null, bufs: {}, master: null, bgmGain: null, bgmSrc: null, rs: null, rsGain: null, rsName: '',
    lastMove: 0, paused: false, softIdx: 0, loading: false,
    init: function () {
      if (A.ctx || A.loading) { if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume(); return; }
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      A.loading = true;
      try { A.ctx = new AC(); } catch (e) { return; }
      A.master = A.ctx.createGain(); A.master.connect(A.ctx.destination);
      A.master.gain.value = TZ.S.sound ? 1 : 0;
      NAMES.forEach(function (n) {
        fetch('assets/snd/' + n + '.mp3').then(function (r) { return r.arrayBuffer(); }).then(function (ab) {
          return new Promise(function (res, rej) { A.ctx.decodeAudioData(ab, res, rej); });
        }).then(function (buf) {
          A.bufs[n] = buf;
          if (n === 'bgm') A.startBgm();
        }).catch(function () { });
      });
    },
    startBgm: function () {
      if (!A.ctx || !A.bufs.bgm || A.bgmSrc) return;
      var s = A.ctx.createBufferSource(); s.buffer = A.bufs.bgm; s.loop = true;
      A.bgmGain = A.ctx.createGain(); A.bgmGain.gain.value = 0.22;
      s.connect(A.bgmGain); A.bgmGain.connect(A.master); s.start(0); A.bgmSrc = s;
    },
    play: function (name, vol) {
      if (!A.ctx || !A.bufs[name] || !TZ.S.sound || A.paused) return;
      var s = A.ctx.createBufferSource(); s.buffer = A.bufs[name];
      var g = A.ctx.createGain(); g.gain.value = vol == null ? 0.7 : vol;
      s.connect(g); g.connect(A.master); s.start(0);
    },
    soft: function () { A.play('pressSoft' + (A.softIdx++ % 3), 0.8); },
    rustleStart: function (mat) {
      if (!A.ctx || !TZ.S.sound) return;
      var name = 'rustle' + mat;
      if (!A.bufs[name]) return;
      if (A.rs && A.rsName === name) return;
      A.rustleStop();
      var s = A.ctx.createBufferSource(); s.buffer = A.bufs[name]; s.loop = true;
      var g = A.ctx.createGain(); g.gain.value = 0;
      s.connect(g); g.connect(A.master); s.start(0);
      A.rs = s; A.rsGain = g; A.rsName = name; A.lastMove = performance.now();
    },
    rustleSpeed: function (v) {
      if (!A.rs) return;
      A.lastMove = performance.now();
      var g = TZ.clamp(v * 0.9, 0, 0.7);
      A.rsGain.gain.setTargetAtTime(g, A.ctx.currentTime, 0.02);
      A.rs.playbackRate.setTargetAtTime(0.9 + TZ.clamp(v, 0, 1.5) * 0.18, A.ctx.currentTime, 0.05);
    },
    rustleStop: function () {
      if (!A.rs) return;
      try { A.rsGain.gain.cancelScheduledValues(0); A.rsGain.gain.value = 0; A.rs.stop(); } catch (e) { }
      A.rs = null; A.rsGain = null; A.rsName = '';
    },
    tick: function (now) {
      if (A.rs && now - A.lastMove > 90) A.rsGain.gain.setTargetAtTime(0, A.ctx.currentTime, 0.02);
    },
    setSound: function (on) {
      TZ.S.sound = on; TZ.persist();
      if (A.master) A.master.gain.value = on ? 1 : 0;
      if (!on) A.rustleStop();
    },
    pause: function (p) {
      A.paused = p;
      if (p) A.rustleStop();
      if (A.ctx) { if (p) A.ctx.suspend(); else A.ctx.resume(); }
    }
  };

  /* ---------------- 舞台 ---------------- */
  TZ.scale = 1;
  TZ.fit = function () {
    var s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    TZ.scale = s;
    TZ.stage.style.transform = 'scale(' + s + ')';
    var portrait = window.innerHeight > window.innerWidth;
    document.body.classList.toggle('portrait', portrait);
  };
  TZ.toStage = function (e) {
    var r = TZ.stage.getBoundingClientRect();
    return { x: (e.clientX - r.left) / TZ.scale, y: (e.clientY - r.top) / TZ.scale };
  };
  var toastTimer = 0;
  TZ.toast = function (msg) {
    var t = TZ.$('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  };
  TZ.updateTop = function () {
    var p = TZ.$('#pts'); if (p) p.textContent = TZ.S.points + ' 积分';
    var m = TZ.$('#btn-sound'); if (m) m.textContent = TZ.S.sound ? '声音' : '静音';
  };
  TZ.modal = function (title, body, buttons) {
    var ov = TZ.el('div', 'modal');
    var box = TZ.el('div', 'modal-box');
    if (title) box.appendChild(TZ.el('h3', '', title));
    if (typeof body === 'string') { var p = TZ.el('div', 'modal-body'); p.innerHTML = body; box.appendChild(p); }
    else if (body) box.appendChild(body);
    var row = TZ.el('div', 'modal-btns');
    (buttons || [{ t: '好的' }]).forEach(function (b) {
      var x = TZ.el('button', 'btn ' + (b.c || 'green'), b.t);
      x.addEventListener('click', function () {
        if (b.keep !== true) ov.remove();
        if (b.fn) b.fn();
      });
      row.appendChild(x);
    });
    box.appendChild(row); ov.appendChild(box);
    TZ.$('#modals').appendChild(ov);
    return ov;
  };

  /* ---------------- 页面导航 ---------------- */
  TZ.screens = {};
  TZ.cleanup = null;
  TZ.go = function (name, arg) {
    if (TZ.cleanup) { try { TZ.cleanup(); } catch (e) { } TZ.cleanup = null; }
    var sc = TZ.$('#screen'); sc.innerHTML = ''; sc.className = 'screen-' + name;
    TZ.$('#modals').innerHTML = '';
    TZ.audio.rustleStop();
    TZ.$('#btn-pause').style.display = (name === 'game') ? '' : 'none';
    TZ.currentScreen = name;
    TZ.screens[name](sc, arg);
    TZ.updateTop();
  };

  /* ---------------- 素材几何 ---------------- */
  TZ.imgUrl = function (k) { return IMG + k + '.png'; };
  TZ.vis = function (kind) { var b = TZ.BB[kind]; return { w: b[4] - b[2], h: b[5] - b[3] }; };
  var wbCache = {};
  TZ.workBox = function (wid) {
    if (wbCache[wid]) return wbCache[wid];
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    TZ.WORKS[wid].pieces.forEach(function (p) {
      var v = TZ.vis(p.kind);
      x0 = Math.min(x0, p.x - v.w / 2); x1 = Math.max(x1, p.x + v.w / 2);
      y0 = Math.min(y0, p.y - v.h / 2); y1 = Math.max(y1, p.y + v.h / 2);
    });
    return (wbCache[wid] = { x0: x0, y0: y0, x1: x1, y1: y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 });
  };

  /* 贴纸元素：外框=可见包围盒；paper 为纸质编号 */
  TZ.makeStk = function (kind, s, paper) {
    var b = TZ.BB[kind];
    if (paper == null) paper = TZ.S.equip.p;
    var e = TZ.el('div', 'stk p' + paper);
    e.style.width = (b[4] - b[2]) * s + 'px'; e.style.height = (b[5] - b[3]) * s + 'px';
    var inn = TZ.el('div', 'stk-in');
    inn.style.left = -b[2] * s + 'px'; inn.style.top = -b[3] * s + 'px';
    inn.style.width = b[0] * s + 'px'; inn.style.height = b[1] * s + 'px';
    var img = new Image(); img.src = TZ.imgUrl(kind); img.draggable = false;
    inn.appendChild(img);
    var url = 'url(' + TZ.imgUrl(kind) + ')';
    ['foil', 'wear', 'curl'].forEach(function (c) {
      var d = TZ.el('i', c);
      d.style.webkitMaskImage = url; d.style.maskImage = url;
      inn.appendChild(d);
    });
    e.appendChild(inn);
    return e;
  };

  /* 完整作品拼贴（用于结算、收藏、手账成品）；返回 {el,w,h} 元素大小为作品包围盒*s */
  TZ.makeWork = function (wid, s, paper, ghost) {
    var bb = TZ.workBox(wid);
    var root = TZ.el('div', 'work-comp');
    root.style.width = bb.w * s + 'px'; root.style.height = bb.h * s + 'px';
    TZ.WORKS[wid].pieces.forEach(function (p) {
      var v = TZ.vis(p.kind);
      var st = TZ.makeStk(p.kind, s, paper);
      TZ.pos(st, (p.x - v.w / 2 - bb.x0) * s, (p.y - v.h / 2 - bb.y0) * s);
      st.style.zIndex = p.layer * 10;
      if (ghost) st.classList.add('ghost');
      root.appendChild(st);
    });
    return root;
  };
})();
