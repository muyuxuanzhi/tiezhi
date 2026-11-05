/* 非关卡界面：目录首页、装备铺、收藏册、成就、结算 */
(function () {
  var TZ = window.TZ;
  var el = TZ.el, pos = TZ.pos, btn = TZ.btn;

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function label(sc, cls, x, y, w, text) { var d = el('div', cls, text); pos(d, x, y, w); sc.appendChild(d); return d; }
  function barPanel(sc) { sc.appendChild(pos(el('div', 'panel bottom-bar'), 45, 605, 1188, 65)); }
  function backBtn(sc, text, x, w) { sc.appendChild(btn(text || '回到小手账', 'taupe', x || 1023, 617, w || 174, 42, function () { TZ.go('home'); })); }

  /* 目录条目（教学与主关交错） */
  function catalog() {
    var list = [], T = TZ.TEACH, M = TZ.MAIN;
    for (var i = 0; i < 7; i++) {
      list.push({ teach: true, def: T[i] });
      if (i < 6) list.push({ teach: false, def: M[i] });
    }
    for (var j = 6; j < 12; j++) list.push({ teach: false, def: M[j] });
    TZ.EXTRA.forEach(function (d) { list.push({ teach: false, def: d, extra: true }); });
    return list;
  }
  TZ.nextLevel = function (teach, id) {
    var c = catalog();
    for (var i = 0; i < c.length; i++) if (c[i].teach === teach && c[i].def.id === id) return c[i + 1] || null;
    return null;
  };
  function isDone(it) { return it.teach ? !!TZ.S.teach[it.def.id] : !!(TZ.S.main[it.def.id] && TZ.S.main[it.def.id].done); }

  /* ================= 首页 ================= */
  TZ.homePage = 0;
  TZ.screens.home = function (sc) {
    var S = TZ.S, list = catalog(), per = 6, pages = Math.ceil(list.length / per);
    barPanel(sc);
    var cover = el('div', 'cover'); sc.appendChild(cover);
    var cimg = new Image(); cimg.src = 'assets/img/cover.png'; cimg.draggable = false; cover.appendChild(cimg);
    var ct = el('div', 'cover-t'); ct.innerHTML = '贴纸<br>拼拼乐'; cover.appendChild(ct);
    cover.appendChild(el('div', 'cover-s', '每一张，都有新的灵感'));
    var next = null;
    for (var i = 0; i < list.length; i++) if (!isDone(list[i])) { next = list[i]; break; }
    sc.appendChild(btn(next ? '接着贴，好吗？' : '再贴一遍，好吗？', 'green', 170, 541, 229, 38, function () {
      var it = next || list[list.length - 1]; TZ.go('game', { def: it.def, teach: it.teach });
    }));
    label(sc, 'h-title r', 667, 160, 460, '今天，也贴一点小美好');
    var md = TZ.mainDoneCount(), td = Object.keys(S.teach).length;
    label(sc, 'h-sub', 667, 205, 460, md + ' / 12 主关 · ' + TZ.extraDoneCount() + ' / ' + TZ.EXTRA.length + ' 扩展关 · ' + td + ' / 7 教学');
    var box = el('div', 'layer'); sc.appendChild(box);
    function draw() {
      box.innerHTML = '';
      list.slice(TZ.homePage * per, TZ.homePage * per + per).forEach(function (it, i) {
        var done = isDone(it);
        var r = el('div', 'row' + (done ? ' done' : '')); pos(r, 665, 230 + i * 43, 470, 34);
        r.innerHTML = '<span>' + (it.teach ? '教学 ' + pad(it.def.id) : (it.extra ? '扩展 ' : '') + pad(it.def.id)) + ' · ' + it.def.name + '</span><em>' + (done ? '重玩' : '开始') + '</em>';
        r.addEventListener('click', function () { TZ.audio.play('press'); TZ.go('game', { def: it.def, teach: it.teach }); });
        box.appendChild(r);
      });
      prev.disabled = TZ.homePage <= 0; nxt.disabled = TZ.homePage >= pages - 1;
      lab.textContent = (TZ.homePage + 1) + ' / ' + pages;
    }
    var prev = btn('上一页', 'green', 677, 543, 142, 34, function () { TZ.homePage--; draw(); });
    var lab = el('div', 'pill2 center white'); pos(lab, 858, 543, 92, 34); lab.style.lineHeight = '34px';
    var nxt = btn('下一页', 'green', 990, 543, 142, 34, function () { TZ.homePage++; draw(); });
    sc.appendChild(prev); sc.appendChild(lab); sc.appendChild(nxt);
    draw();
    var rdy = TZ.achReady();
    sc.appendChild(btn('成就' + (rdy ? ' · ' + rdy + ' 可领' : ''), 'green', 85, 617, 180, 42, function () { TZ.go('ach'); }));
    sc.appendChild(btn('装备铺', 'green', 303, 617, 182, 42, function () { TZ.go('shop'); }));
    sc.appendChild(btn('收藏册', 'coral', 525, 617, 180, 42, function () { TZ.go('coll'); }));
    sc.appendChild(btn('自定义手账', 'teal', 743, 617, 213, 42, function () { TZ.go('journal'); }));
    sc.appendChild(btn('返回大世界', 'taupe', 1021, 617, 174, 42, function () { TZ.toast('这是单机试玩版，没有大世界，继续贴吧。'); }));
  };

  /* ================= 装备铺 ================= */
  TZ.screens.shop = function (sc) {
    var S = TZ.S;
    barPanel(sc); backBtn(sc);
    label(sc, 'h-title', 141, 154, 420, '挑一把顺手的小镊子');
    label(sc, 'h-title r', 667, 160, 460, '给喜欢的贴纸添点光');
    function owned(kind, id) { return S.owned[kind].indexOf(id) >= 0; }
    function buy(kind, it) {
      if (S.points < it.cost) { TZ.toast('积分还不够，再贴几关吧。'); return; }
      S.points -= it.cost; S.owned[kind].push(it.id); TZ.persist(); TZ.audio.play('buy'); TZ.go('shop');
    }
    function act(kind, it, x, y, w, h) {
      var key = kind === 't' ? 't' : 'p', eq = S.equip[key] === it.id, ow = owned(kind, it.id);
      if (eq) { var b = btn('已装备', 'taupe', x, y, w, h); b.disabled = true; b.classList.add('on'); return b; }
      if (ow) return btn('装备', 'coral', x, y, w, h, function () { S.equip[key] = it.id; TZ.persist(); TZ.go('shop'); });
      if (it.cost < 0) { var l = btn(kind === 't' ? '全主关成就解锁' : '收录6主题成就解锁', 'green', x, y, w, h); l.disabled = true; return l; }
      return btn(it.cost + ' 积分兑换', 'green', x, y, w, h, function () { buy(kind, it); });
    }
    TZ.TWEEZERS.forEach(function (t, i) {
      var y = 209 + i * 76;
      var row = el('div', 'row shoprow'); pos(row, 141, y, 424, 66); sc.appendChild(row);
      var im = new Image(); im.src = 'assets/img/' + t.img + '.png'; im.className = 'shop-tw'; pos(im, 150, y + 5, t.id === 3 ? 28 : 22, t.id === 3 ? 56 : 58);
      im.style.transform = 'rotate(18deg)'; im.draggable = false; sc.appendChild(im);
      label(sc, 'shop-name', 196, y + 10, 200, t.name);
      label(sc, 'h-sub', 196, y + 38, 200, '撕速 ×' + t.speed.toFixed(2).replace(/0$/, '') + ' · 吸附 ' + t.snap);
      sc.appendChild(act('t', t, 404, y + 15, 151, 36));
    });
    TZ.PAPERS.forEach(function (p, i) {
      var c = i % 2, r = Math.floor(i / 2), x = c ? 906 : 646, y = 205 + r * 107;
      var prev = TZ.makeWork('salmon', 0.2, p.id);
      pos(prev, x + 110 - 41, y, null, null); sc.appendChild(prev);
      label(sc, 'paper-name', x, y + 60, 220, p.name + ' ×' + p.mult.toFixed(2));
      sc.appendChild(act('p', p, x, y + 82, 220, 28));
    });
  };

  /* ================= 收藏册 ================= */
  TZ.collPage = 0;
  TZ.screens.coll = function (sc) {
    var S = TZ.S;
    barPanel(sc);
    var cnt = 0, best = 0;
    for (var k in S.coll) { cnt++; best = Math.max(best, S.coll[k].q); }
    label(sc, 'h-title', 141, 154, 420, '把喜欢的，都收在这里');
    var ALL = TZ.ALL_THEMES, CP = Math.ceil(ALL.length / 3);
    label(sc, 'h-sub', 141, 205, 420, cnt + ' / ' + ALL.length * 5 + ' 件作品 · 最佳品质 ' + (cnt ? best : '—'));
    var box = el('div', 'layer'); sc.appendChild(box);
    var prev = btn('上一页', 'green', 107, 617, 170, 42, function () { TZ.collPage--; draw(); });
    var lab = el('div', 'bar-text center'); pos(lab, 330, 628, 140);
    var nxt = btn('下一页', 'green', 546, 617, 172, 42, function () { TZ.collPage++; draw(); });
    sc.appendChild(prev); sc.appendChild(lab); sc.appendChild(nxt); backBtn(sc);
    function draw() {
      box.innerHTML = '';
      for (var r = 0; r < 3; r++) {
        var theme = ALL[TZ.collPage * 3 + r], wid = theme;
        if (!theme) break;
        for (var c = 0; c < 5; c++) {
          var key = theme + ':' + c, got = S.coll[key], x = 180 + c * 186, y = 245 + r * 91;
          var card = el('div', 'card' + (got ? ' got' : '')); pos(card, x, y, 176, 82); box.appendChild(card);
          var bb = TZ.workBox(wid), s = Math.min(70 / bb.w, 54 / bb.h);
          var th = TZ.makeWork(wid, s, got ? c : 0, !got);
          pos(th, x + 8 + (70 - bb.w * s) / 2, y + 14 + (54 - bb.h * s) / 2); box.appendChild(th);
          label(box, 'card-t', x + 86, y + 9, 88, TZ.WORKS[wid].name);
          label(box, 'card-s', x + 86, y + 31, 88, TZ.PAPERS[c].name);
          label(box, 'card-s', x + 86, y + 52, 88, got ? '最佳品质 ' + got.q : '等你来贴');
        }
      }
      prev.disabled = TZ.collPage <= 0; nxt.disabled = TZ.collPage >= CP - 1; lab.textContent = (TZ.collPage + 1) + ' / ' + CP;
    }
    draw();
  };

  /* ================= 成就 ================= */
  TZ.achPage = 0;
  TZ.screens.ach = function (sc) {
    var S = TZ.S;
    barPanel(sc);
    label(sc, 'h-title', 141, 154, 420, '成就 · 收下这份小奖励');
    var sub = label(sc, 'h-sub', 141, 205, 420, '');
    var box = el('div', 'layer'); sc.appendChild(box);
    var prev = btn('上一页', 'green', 107, 617, 170, 42, function () { TZ.achPage--; draw(); });
    var lab = el('div', 'bar-text center'); pos(lab, 330, 628, 140);
    var nxt = btn('下一页', 'green', 546, 617, 172, 42, function () { TZ.achPage++; draw(); });
    sc.appendChild(prev); sc.appendChild(lab); sc.appendChild(nxt); backBtn(sc);
    function claim(i) {
      var a = TZ.ACH[i];
      if (S.claimed[i] || a.cur(S) < a.t) return;
      S.claimed[i] = true; S.points += a.r; S.earned += a.r;
      if (a.tk) S.tickets += a.tk;
      if (a.unlock === 't3' && S.owned.t.indexOf(3) < 0) S.owned.t.push(3);
      if (a.unlock === 'p4' && S.owned.p.indexOf(4) < 0) S.owned.p.push(4);
      TZ.persist(); TZ.audio.play('buy'); TZ.updateTop();
      TZ.toast('收下啦：' + a.n);
      draw();
    }
    function draw() {
      box.innerHTML = '';
      var claimed = 0; for (var q in S.claimed) if (S.claimed[q]) claimed++;
      sub.textContent = '你的进度都记着呢 · 已领 ' + claimed + '/20 · 加映券 ' + S.tickets + ' 张';
      for (var k = 0; k < 4; k++) {
        var i = TZ.achPage * 4 + k, a = TZ.ACH[i];
        var x = (k % 2) ? 707 : 136, y = k < 2 ? 226 : 372, w = (k % 2) ? 431 : 432;
        var card = el('div', 'acard'); pos(card, x, y, w, 132); box.appendChild(card);
        var cur = Math.min(a.cur(S), a.t);
        label(box, 'a-name', x + 18, y + 12, 300, a.n);
        label(box, 'a-prog', x + w - 118, y + 16, 100, cur + ' / ' + a.t).style.textAlign = 'right';
        label(box, 'a-desc', x + 18, y + 44, w - 30, a.d);
        label(box, 'a-rew', x + 18, y + 68, w - 30, a.r + '积分' + (a.tk ? ' + 加映券×' + a.tk : '') + (a.extra ? ' + ' + a.extra : ''));
        var ready = a.cur(S) >= a.t, got = !!S.claimed[i];
        var b = btn(got ? '已收下' : ready ? '收下小奖励' : '慢慢来，快到啦', got ? 'taupe' : 'green', x + 12, y + 94, w - 24, 28, (function (ii) { return function () { claim(ii); }; })(i));
        b.disabled = got || !ready; box.appendChild(b);
      }
      prev.disabled = TZ.achPage === 0; nxt.disabled = TZ.achPage >= 4; lab.textContent = (TZ.achPage + 1) + ' / 5';
    }
    draw();
  };

  /* ================= 结算 ================= */
  TZ.screens.result = function (sc, res) {
    var d = res.def;
    barPanel(sc);
    label(sc, 'h-title', 146, 154, 420, '这一页，贴得真好看。');
    var n = res.works.length;
    var L = {
      1: [{ x: 170, y: 215, w: 380, h: 220 }],
      2: [{ x: 150, y: 250, w: 200, h: 170, ly: 220 }, { x: 365, y: 250, w: 200, h: 170, ly: 220 }],
      3: [{ x: 150, y: 245, w: 200, h: 80, ly: 215 }, { x: 365, y: 245, w: 200, h: 80, ly: 215 }, { x: 255, y: 357, w: 200, h: 80, ly: 330 }]
    }[n];
    res.works.forEach(function (wid, i) {
      var sl = L[i], bb = TZ.workBox(wid), s = Math.min(sl.w / bb.w, sl.h / bb.h, 0.6);
      var comp = TZ.makeWork(wid, s, res.paper);
      pos(comp, sl.x + (sl.w - bb.w * s) / 2, sl.y + (sl.h - bb.h * s) / 2); sc.appendChild(comp);
      if (n > 1) { var lb = label(sc, 'res-lab', sl.x, sl.ly, sl.w, (i + 1) + ' · ' + TZ.WORKS[wid].name); lb.style.textAlign = 'center'; }
    });
    var pl = el('div', 'rate-pill', res.teach ? '教学完成 · 品质 ' + res.Q : res.rating + ' · 品质 ' + res.Q);
    pos(pl, 200, 462, 300, 40); sc.appendChild(pl);
    pl.style.lineHeight = '40px';

    label(sc, 'h-title r', 667, 160, 460, '收好今天的小美好');
    label(sc, 'res-sub', 667, 212, 460, d.name);
    var y = 248;
    res.works.forEach(function (wid, i) {
      label(sc, 'res-row', 667, y + i * 24, 460, TZ.WORKS[wid].name + '  ·  品质 ' + res.qs[i]);
    });
    y += n * 24 + 8;
    sc.appendChild(pos(el('div', 'hr'), 667, y, 460));
    var stepTxt = d.budget ? '还余 ' + Math.max(0, d.budget - res.steps) + ' 步  ·  这次用了 ' + res.steps + ' 步'
      : '理想 ' + d.ideal + ' 步  ·  这次用了 ' + res.steps + ' 步';
    if (res.cr) stepTxt += '  ·  折痕 ' + res.cr + ' 道，品质 −' + res.cr * 2;
    label(sc, 'res-step', 667, y + 10, 460, stepTxt);
    if (res.teach) label(sc, 'res-step small', 667, y + 36, 460, res.first ? '教学奖励首次领取' : '重玩教学没有积分，留给主关吧');
    else label(sc, 'res-step small', 667, y + 36, 460, Math.round(res.base) + ' × ' + res.rm + ' 评级 × ' + res.pm + ' 纸质' + (res.ticket ? ' + 100 加映' : ''));
    label(sc, 'res-pts', 667, y + 58, 460, '+ ' + res.total + ' 积分');
    sc.appendChild(btn('再贴一次', 'green', 677, 498, 170, 36, function () { TZ.go('game', { def: d, teach: res.teach }); }));
    var nx = TZ.nextLevel(res.teach, d.id);
    var b2 = btn(nx ? '去下一关' : '已是最后一关', 'green', 880, 498, 250, 36, function () { if (nx) TZ.go('game', { def: nx.def, teach: nx.teach }); });
    b2.disabled = !nx; sc.appendChild(b2);
    backBtn(sc);
    var rdy = TZ.achReady();
    if (rdy) setTimeout(function () { if (TZ.currentScreen === 'result') TZ.toast('有 ' + rdy + ' 项成就可以领取啦'); }, 600);
  };
})();
