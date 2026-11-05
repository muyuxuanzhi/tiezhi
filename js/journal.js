/* 自定义手账：两页自由拼贴、便签、背景色轮盘、撤销重做、导出 PNG */
(function () {
  var TZ = window.TZ;
  var el = TZ.el, pos = TZ.pos, btn = TZ.btn, clamp = TZ.clamp;
  var PX = 668, PY = 232, PW = 456, PH = 284, K = PW / 900, MAXN = 40, NOTE_W = 150, NOTE_H = 96;
  var QUICK = ['#FFFBEF', '#F4E1EE', '#E0EAD7', '#DDEBF5', '#E6E0F5'];

  function defJournal() {
    return { cur: 0, pages: [{ type: 'dot', bg: '#E0EAD7', v: 1, items: [] }, { type: 'line', bg: '#FDF3E0', v: 1, items: [] }], seq: 1 };
  }
  function hsv2hex(h, s, v) {
    var f = function (n) { var k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
    var x = function (a) { return ('0' + Math.round(a * 255).toString(16)).slice(-2); };
    return ('#' + x(f(5)) + x(f(3)) + x(f(1))).toUpperCase();
  }
  function hex2hsv(hex) {
    var r = parseInt(hex.substr(1, 2), 16) / 255, g = parseInt(hex.substr(3, 2), 16) / 255, b = parseInt(hex.substr(5, 2), 16) / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
    if (d) { if (mx === r) h = ((g - b) / d + 6) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; }
    return { h: h, s: mx ? d / mx : 0, v: mx };
  }
  function baseScale(it) {
    if (it.t === 'stk') { var v = TZ.vis(it.kind); return Math.min(0.6, 130 / Math.max(v.w, v.h)); }
    if (it.t === 'dish') { var b = TZ.workBox(it.theme); return 190 / Math.max(b.w, b.h); }
    return 1;
  }
  function baseSize(it) {
    var bs = baseScale(it);
    if (it.t === 'stk') { var v = TZ.vis(it.kind); return { w: v.w * bs, h: v.h * bs }; }
    if (it.t === 'dish') { var b = TZ.workBox(it.theme); return { w: b.w * bs, h: b.h * bs }; }
    return { w: NOTE_W, h: NOTE_H };
  }
  function extent(it) {
    var s = baseSize(it), r = it.rot * Math.PI / 180, c = Math.abs(Math.cos(r)), n = Math.abs(Math.sin(r));
    return { w: (s.w * c + s.h * n) * it.sc, h: (s.w * n + s.h * c) * it.sc };
  }
  function fit(it) {
    var e = extent(it), k = Math.min(1, 900 / e.w, 560 / e.h);
    if (k < 1) { it.sc *= k; e = extent(it); }
    it.x = clamp(it.x, e.w / 2, 900 - e.w / 2); it.y = clamp(it.y, e.h / 2, 560 - e.h / 2);
  }
  var imgCache = {};
  function getImg(kind) {
    if (!imgCache[kind]) { var i = new Image(); i.src = TZ.imgUrl(kind); imgCache[kind] = i; }
    return imgCache[kind];
  }

  TZ.screens.journal = function (sc) {
    var S = TZ.S;
    if (!S.journal) { S.journal = defJournal(); TZ.persist(); }
    var J = S.journal, sel = null, tab = 'food';
    var hist = [{ u: [], r: [] }, { u: [], r: [] }];
    function page() { return J.pages[J.cur]; }
    function save() { TZ.persist(); }
    function snap() {
      var p = page(), h = hist[J.cur];
      h.u.push(JSON.stringify({ type: p.type, bg: p.bg, v: p.v, items: p.items })); if (h.u.length > 60) h.u.shift();
      h.r = []; syncBtns();
    }
    function restore(str) {
      var o = JSON.parse(str), p = page(); p.type = o.type; p.bg = o.bg; p.v = o.v; p.items = o.items; sel = null; save(); render(); drawTray();
    }

    sc.appendChild(pos(el('div', 'panel bottom-bar'), 45, 605, 1188, 65));
    var t1 = el('div', 'h-title', '贴纸托盘'); pos(t1, 141, 150, 300); sc.appendChild(t1);
    var title = el('div', 'h-title r', '我的自由拼贴手账'); pos(title, 667, 160, 460); sc.appendChild(title);
    var sub = el('div', 'h-sub', ''); pos(sub, 667, 205, 460); sc.appendChild(sub);

    // 纸面
    var paper = el('div', 'jpaper'); pos(paper, PX, PY, PW, PH); sc.appendChild(paper);
    var inner = el('div', 'jinner'); inner.style.transform = 'scale(' + K + ')'; paper.appendChild(inner);

    // 托盘
    var tabs = [['food', '食材'], ['dish', '成品'], ['note', '便签'], ['bg', '背景']];
    var tabEls = {};
    tabs.forEach(function (t, i) {
      var b = btn(t[1], 'teal', 133 + i * 112, 187, 105, 32, function () { tab = t[0]; drawTray(); });
      sc.appendChild(b); tabEls[t[0]] = b;
    });
    var tray = el('div', 'tray'); pos(tray, 133, 228, 445, 300); sc.appendChild(tray);
    var dark = btn('调暗', 'teal', 182, 543, 158, 34, function () { adjV(-0.08); });
    var light = btn('调亮', 'teal', 360, 543, 158, 34, function () { adjV(0.08); });
    sc.appendChild(dark); sc.appendChild(light);

    // 工具条
    var tools = [['旋转−', function (it) { it.rot -= 15; }], ['旋转 +', function (it) { it.rot += 15; }],
    ['缩小', function (it) { it.sc = Math.max(0.3, it.sc / 1.12); }], ['放大', function (it) { it.sc *= 1.12; }],
    ['向后', 'back'], ['向前', 'front'], ['翻面', function (it) { it.flip = !it.flip; }], ['移除', 'del']];
    var toolBtns = tools.map(function (t, i) {
      var b = btn(t[0], 'ghost', 662 + i * 62, 543, 57, 34, function () { act(t[1]); });
      sc.appendChild(b); return b;
    });
    function act(a) {
      var p = page(), it = byId(sel); if (!it) return;
      snap();
      if (a === 'del') { p.items.splice(p.items.indexOf(it), 1); sel = null; }
      else if (a === 'back') { var i = p.items.indexOf(it); if (i > 0) { p.items.splice(i, 1); p.items.splice(i - 1, 0, it); } }
      else if (a === 'front') { var j = p.items.indexOf(it); if (j < p.items.length - 1) { p.items.splice(j, 1); p.items.splice(j + 1, 0, it); } }
      else { a(it); fit(it); }
      save(); render();
    }

    // 底栏
    var bUndo = btn('撤销', 'green', 80, 617, 157, 42, function () {
      var h = hist[J.cur]; if (!h.u.length) return; var p = page();
      h.r.push(JSON.stringify({ type: p.type, bg: p.bg, v: p.v, items: p.items })); restore(h.u.pop()); syncBtns();
    });
    var bRedo = btn('重做', 'green', 256, 617, 156, 42, function () {
      var h = hist[J.cur]; if (!h.r.length) return; var p = page();
      h.u.push(JSON.stringify({ type: p.type, bg: p.bg, v: p.v, items: p.items })); restore(h.r.pop()); syncBtns();
    });
    var bType = btn('换纸型', 'teal', 432, 617, 146, 42, function () { snap(); page().type = page().type === 'dot' ? 'line' : 'dot'; save(); render(); });
    var bPage = btn('', 'green', 593, 617, 144, 42, function () { J.cur = 1 - J.cur; sel = null; save(); render(); drawTray(); });
    var bExp = btn('导出本页PNG', 'coral', 748, 617, 170, 42, exportPng);
    sc.appendChild(bUndo); sc.appendChild(bRedo); sc.appendChild(bType); sc.appendChild(bPage); sc.appendChild(bExp);
    sc.appendChild(btn('回到小手账', 'taupe', 984, 617, 220, 42, function () { TZ.go('home'); }));

    function syncBtns() {
      var h = hist[J.cur];
      bUndo.disabled = !h.u.length; bRedo.disabled = !h.r.length;
      bPage.textContent = '第' + (J.cur ? 1 : 2) + '页';
      var has = !!byId(sel);
      toolBtns.forEach(function (b) { b.disabled = !has; });
    }
    function byId(id) { return id == null ? null : page().items.filter(function (i) { return i.id === id; })[0]; }

    /* ---- 纸面渲染 ---- */
    function render() {
      var p = page();
      inner.style.backgroundColor = p.bg;
      inner.style.backgroundImage = p.type === 'dot'
        ? 'radial-gradient(rgba(90,70,40,.22) 2px, transparent 2.4px)'
        : 'repeating-linear-gradient(to bottom, transparent 0 39px, rgba(90,70,40,.18) 39px 40px)';
      inner.style.backgroundSize = p.type === 'dot' ? '30px 30px' : 'auto';
      inner.innerHTML = '';
      p.items.forEach(function (it, idx) { inner.appendChild(buildItem(it, idx)); });
      sub.textContent = '第 ' + (J.cur + 1) + ' 页 · ' + p.items.length + ' / ' + MAXN + ' 张 · 自动保存';
      syncBtns();
      if (tab === 'bg') drawTray();
    }
    function buildItem(it, idx) {
      var wrap = el('div', 'jitem' + (it.id === sel ? ' sel' : '') + (it.flip ? ' flip' : ''));
      var s = baseSize(it);
      wrap.style.width = s.w + 'px'; wrap.style.height = s.h + 'px'; wrap.style.zIndex = idx + 1;
      wrap.style.transform = 'translate(' + it.x + 'px,' + it.y + 'px) rotate(' + it.rot + 'deg) scale(' + it.sc + ') translate(-50%,-50%)';
      var body;
      if (it.t === 'stk') body = TZ.makeStk(it.kind, baseScale(it), 0);
      else if (it.t === 'dish') body = TZ.makeWork(it.theme, baseScale(it), it.paper || 0);
      else {
        body = el('div', 'jnote'); body.appendChild(el('i', 'tape')); body.appendChild(el('span', '', it.text));
      }
      wrap.appendChild(body);
      wrap.addEventListener('pointerdown', function (e) { itemDown(e, it, wrap); });
      return wrap;
    }

    function itemDown(e, it, wrap) {
      e.preventDefault(); e.stopPropagation(); TZ.audio.init();
      try { TZ.stage.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
      var wasSel = sel === it.id, p0 = TZ.toStage(e), moved = false, id = e.pointerId, ox = it.x, oy = it.y, snapped = false;
      if (!wasSel) { sel = it.id; inner.querySelectorAll('.jitem.sel').forEach(function (x) { x.classList.remove('sel'); }); wrap.classList.add('sel'); syncBtns(); }
      function mv(ev) {
        if (ev.pointerId !== id) return;
        var p = TZ.toStage(ev), dx = (p.x - p0.x) / K, dy = (p.y - p0.y) / K;
        if (!moved && Math.hypot(dx, dy) * K < 4) return;
        if (!snapped) { snap(); snapped = true; }
        moved = true; it.x = ox + dx; it.y = oy + dy; fit(it);
        wrap.style.transform = 'translate(' + it.x + 'px,' + it.y + 'px) rotate(' + it.rot + 'deg) scale(' + it.sc + ') translate(-50%,-50%)';
      }
      function up(ev) {
        if (ev.pointerId !== id) return;
        window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
        if (moved) { save(); TZ.audio.soft(); }
        else if (wasSel && it.t === 'note') editNote(it);
      }
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    }
    paper.addEventListener('pointerdown', function (e) {
      if (e.target === paper || e.target === inner) { sel = null; inner.querySelectorAll('.jitem.sel').forEach(function (x) { x.classList.remove('sel'); }); syncBtns(); }
    });

    function addItem(it) {
      var p = page();
      if (p.items.length >= MAXN) { TZ.toast('这一页最多贴 ' + MAXN + ' 张。'); return null; }
      snap();
      it.id = J.seq++; it.x = 450 + (Math.random() - 0.5) * 120; it.y = 280 + (Math.random() - 0.5) * 80;
      it.sc = 1; it.rot = 0; it.flip = false; fit(it);
      p.items.push(it); sel = it.id; save(); TZ.audio.soft(); render(); return it;
    }

    function editNote(it) {
      var isNew = !it;
      var box = el('div', 'note-edit');
      var input = el('textarea'); input.rows = 3; input.value = isNew ? '慢慢贴，很美好' : it.text;
      var cnt = el('div', 'h-sub', '');
      function lim() {
        var arr = Array.from(input.value.replace(/\n/g, ' '));
        if (arr.length > 20) { input.value = arr.slice(0, 20).join(''); arr = arr.slice(0, 20); }
        cnt.textContent = arr.length + ' / 20 字';
      }
      input.addEventListener('input', lim); lim();
      box.appendChild(input); box.appendChild(cnt);
      TZ.modal(isNew ? '写一张便签' : '修改便签', box, [
        {
          t: '保存', fn: function () {
            var txt = Array.from(input.value.replace(/\n/g, ' ')).slice(0, 20).join('').trim();
            if (!txt) return;
            if (isNew) addItem({ t: 'note', text: txt });
            else { snap(); it.text = txt; save(); render(); }
          }
        },
        { t: '取消', c: 'taupe' }
      ]);
      setTimeout(function () { input.focus(); input.select(); }, 50);
    }

    /* ---- 托盘 ---- */
    function drawTray() {
      for (var k in tabEls) tabEls[k].className = 'btn ' + (k === tab ? 'coral' : 'teal');
      dark.style.display = light.style.display = tab === 'bg' ? '' : 'none';
      tray.innerHTML = '';
      if (tab === 'food') {
        var kinds = TZ.JOURNAL_KINDS.filter(function (k) { return S.touched[k]; });
        if (!kinds.length) { tray.appendChild(el('div', 'tray-tip', '还没有接触过的食材。去贴几张贴纸，它们就会出现在这里。')); return; }
        var g = el('div', 'tray-grid'); tray.appendChild(g);
        kinds.forEach(function (k) {
          var c = el('div', 'tray-cell'); var v = TZ.vis(k), s = Math.min(64 / v.w, 44 / v.h);
          var st = TZ.makeStk(k, s, 0); c.appendChild(st); c.appendChild(el('span', '', TZ.KIND_NAME[k]));
          c.addEventListener('click', function () { addItem({ t: 'stk', kind: k }); });
          g.appendChild(c);
        });
      } else if (tab === 'dish') {
        var keys = Object.keys(S.coll);
        if (!keys.length) { tray.appendChild(el('div', 'tray-tip', '通关主关后，成品会收进收藏册，也能贴到这里。')); return; }
        var g2 = el('div', 'tray-grid dish'); tray.appendChild(g2);
        keys.forEach(function (key) {
          var parts = key.split(':'), th = parts[0], pp = +parts[1];
          var c = el('div', 'tray-cell'); var bb = TZ.workBox(th), s = Math.min(100 / bb.w, 52 / bb.h);
          c.appendChild(TZ.makeWork(th, s, pp)); c.appendChild(el('span', '', TZ.WORKS[th].name + ' · ' + TZ.PAPERS[pp].name));
          c.addEventListener('click', function () { addItem({ t: 'dish', theme: th, paper: pp }); });
          g2.appendChild(c);
        });
      } else if (tab === 'note') {
        var w = el('div', 'tray-tip', '写一张最多 20 个字的便签贴进手账。\n贴好后选中它，再点一下就能重新编辑。');
        tray.appendChild(w);
        var b = btn('写一张便签', 'coral', 120, 150, 200, 40, function () { editNote(null); });
        tray.appendChild(b);
      } else {
        var tip = el('div', 'tray-tip small', '在色盘上点选或拖动，自定义本页底色'); tray.appendChild(tip);
        var cv = document.createElement('canvas'); cv.width = cv.height = 176; cv.className = 'wheel'; pos(cv, 134, 34); tray.appendChild(cv);
        var ctx = cv.getContext('2d'), im = ctx.createImageData(176, 176), r = 88;
        for (var y = 0; y < 176; y++) for (var x = 0; x < 176; x++) {
          var dx = x - r + 0.5, dy = y - r + 0.5, d = Math.hypot(dx, dy), o = (y * 176 + x) * 4;
          if (d > r) { im.data[o + 3] = 0; continue; }
          var h = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, hex = hsv2hex(h, d / r, 1);
          im.data[o] = parseInt(hex.substr(1, 2), 16); im.data[o + 1] = parseInt(hex.substr(3, 2), 16); im.data[o + 2] = parseInt(hex.substr(5, 2), 16); im.data[o + 3] = 255;
        }
        ctx.putImageData(im, 0, 0);
        function pick(e) {
          var rc = cv.getBoundingClientRect(), sx = 176 / rc.width;
          var dx = (e.clientX - rc.left) * sx - r, dy = (e.clientY - rc.top) * sx - r, d = Math.min(r, Math.hypot(dx, dy));
          var h = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, p = page();
          p.bg = hsv2hex(h, d / r, p.v || 1); inner.style.backgroundColor = p.bg; curTxt.textContent = '当前颜色 ' + p.bg;
        }
        var dragging = false, first = true;
        cv.addEventListener('pointerdown', function (e) { e.preventDefault(); dragging = true; snap(); cv.setPointerCapture(e.pointerId); pick(e); });
        cv.addEventListener('pointermove', function (e) { if (dragging) pick(e); });
        cv.addEventListener('pointerup', function () { dragging = false; save(); });
        var curTxt = el('div', 'tray-cur', '当前颜色 ' + page().bg); pos(curTxt, 0, 218, 445); tray.appendChild(curTxt);
        QUICK.forEach(function (c, i) {
          var sw = el('div', 'swatch'); sw.style.background = c; pos(sw, 14 + i * 86, 244, 72, 28);
          sw.addEventListener('click', function () { snap(); var p = page(); p.bg = c; p.v = hex2hsv(c).v; save(); render(); curTxt.textContent = '当前颜色 ' + c; });
          tray.appendChild(sw);
        });
        tray.curTxt = curTxt;
      }
    }
    function adjV(d) {
      var p = page(); snap();
      var c = hex2hsv(p.bg); c.v = clamp(c.v + d, 0.45, 1); p.v = c.v; p.bg = hsv2hex(c.h, c.s, c.v); save(); render();
      if (tray.curTxt) tray.curTxt.textContent = '当前颜色 ' + p.bg;
    }

    /* ---- 导出 ---- */
    function exportPng() {
      var cv = document.createElement('canvas'); cv.width = 900; cv.height = 560;
      var ctx = cv.getContext('2d'), p = page();
      ctx.fillStyle = p.bg; ctx.fillRect(0, 0, 900, 560);
      ctx.fillStyle = 'rgba(90,70,40,.22)';
      if (p.type === 'dot') { for (var y = 15; y < 560; y += 30) for (var x = 15; x < 900; x += 30) { ctx.beginPath(); ctx.arc(x, y, 2, 0, 7); ctx.fill(); } }
      else { ctx.fillStyle = 'rgba(90,70,40,.18)'; for (var yy = 39; yy < 560; yy += 40) ctx.fillRect(0, yy, 900, 1); }
      p.items.forEach(function (it) {
        ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot * Math.PI / 180); ctx.scale(it.sc, it.sc);
        if (it.flip && 'filter' in ctx) ctx.filter = 'brightness(1.7) saturate(.25)';
        var bs = baseScale(it);
        function drawKind(kind, cx, cy) {
          var b = TZ.BB[kind], v = TZ.vis(kind);
          ctx.drawImage(getImg(kind), cx - v.w * bs / 2 - b[2] * bs, cy - v.h * bs / 2 - b[3] * bs, b[0] * bs, b[1] * bs);
        }
        if (it.t === 'stk') drawKind(it.kind, 0, 0);
        else if (it.t === 'dish') {
          var bb = TZ.workBox(it.theme);
          TZ.WORKS[it.theme].pieces.slice().sort(function (a, b) { return a.layer - b.layer; }).forEach(function (pc) {
            drawKind(pc.kind, (pc.x - bb.cx) * bs, (pc.y - bb.cy) * bs);
          });
        } else {
          ctx.shadowColor = 'rgba(0,0,0,.18)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
          ctx.fillStyle = '#F6E7A8'; ctx.fillRect(-NOTE_W / 2, -NOTE_H / 2, NOTE_W, NOTE_H); ctx.shadowColor = 'transparent';
          ctx.fillStyle = 'rgba(214,180,90,.8)'; ctx.fillRect(-26, -NOTE_H / 2 - 6, 52, 14);
          ctx.fillStyle = '#5a4a3a'; ctx.font = '16px "Microsoft YaHei",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          var chars = Array.from(it.text), lines = [], per = 8;
          for (var i = 0; i < chars.length; i += per) lines.push(chars.slice(i, i + per).join(''));
          lines.forEach(function (ln, li) { ctx.fillText(ln, 0, (li - (lines.length - 1) / 2) * 22 + 4); });
        }
        ctx.restore();
      });
      try {
        cv.toBlob(function (b) {
          if (!b) { TZ.toast('导出失败，请用网页地址打开游戏再试。'); return; }
          var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = '贴纸手账_第' + (J.cur + 1) + '页.png';
          document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
          TZ.toast('已导出 900×560 的 PNG。');
        }, 'image/png');
      } catch (e) { TZ.toast('导出失败：请通过网页地址打开游戏（本地文件会限制画布导出）。'); }
    }

    TZ.cleanup = function () { save(); };
    render(); drawTray();
  };
})();
