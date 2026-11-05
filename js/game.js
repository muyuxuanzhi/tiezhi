/* 关卡玩法：撕贴手势、层次依赖、单/双镊子、限步、结算 */
(function () {
  var TZ = window.TZ;
  var el = TZ.el, pos = TZ.pos, clamp = TZ.clamp;
  var AREA = { x: 141, y: 244, w: 434, h: 262 };
  var SLOTS = {
    1: [{ x: 660, y: 250, w: 470, h: 238 }],
    2: [{ x: 650, y: 292, w: 240, h: 212, ly: 252 }, { x: 900, y: 292, w: 240, h: 212, ly: 252 }],
    3: [{ x: 650, y: 290, w: 240, h: 100, ly: 250 }, { x: 900, y: 290, w: 240, h: 100, ly: 250 }, { x: 775, y: 424, w: 240, h: 92, ly: 392 }]
  };
  var G = null;
  // 右页下沿的暂存格（叠页谜题关）
  var STASH = [{ x: 668, y: 494, w: 206, h: 46 }, { x: 890, y: 494, w: 206, h: 46 }];

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function isDouble() { return G.def.mode === 2; }
  function activeWorks() { return G.seq ? [G.works[G.stageIdx]] : G.works; }
  function totalPieces() { var n = 0; G.works.forEach(function (w) { n += w.pieces.length; }); return n; }
  function filledCount(list) { var n = 0; list.forEach(function (w) { w.pieces.forEach(function (p) { if (p.filled) n++; }); }); return n; }
  function stickerName(st) { return TZ.KIND_NAME[st.kind]; }
  // 指针坐标限制在舞台内：拖到窗口外时，贴纸停在边缘，不会丢到看不见的地方
  function stagePt(e) {
    var p = TZ.toStage(e);
    return { x: clamp(p.x, 14, 1266), y: clamp(p.y, 14, 706) };
  }
  // 让后续的 move/up 即使出了窗口也能收到
  function capture(e) {
    try { if (e.pointerId != null && TZ.stage.setPointerCapture) TZ.stage.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
  }
  // 叠压：上面那张还在页上（或双镊子里尚未确认揭起）时，下面的撕不动
  function isCovered(st) {
    var a = st.above; if (!a) return false;
    return a.state === 'page' || (a.state === 'selected' && !G.hand.confirmed);
  }
  function pairOk(a, b) {
    var r = G.def.pair;
    if (r === 'diffWork') return a.wi !== b.wi;
    if (r === 'bigSmall') return !!a.big !== !!b.big;
    return true;
  }
  function pairMsg(short) {
    var t = G.def.pair === 'diffWork' ? '同批两张须来自不同作品' : '同批两张须一大一小';
    return short ? '规则：' + t : '配对规则：' + t + '。';
  }
  function stashAt(x, y) {
    for (var i = 0; i < STASH.length; i++) {
      var r = STASH[i]; if (x >= r.x - 6 && x <= r.x + r.w + 6 && y >= r.y - 6 && y <= r.y + r.h + 6) return i;
    }
    return -1;
  }
  function freeStash(pref, skip) {
    var res = {};
    if (isDouble()) G.hand.sel.forEach(function (s) { if (s !== skip && s.fromStash && s.stashHome >= 0) res[s.stashHome] = 1; });
    if (pref >= 0 && !G.stash[pref] && !res[pref]) return pref;
    for (var i = 0; i < G.stash.length; i++) if (!G.stash[i] && !res[i]) return i;
    return -1;
  }

  /* ================= 构建 ================= */
  function buildState(def, teach, keepTicket) {
    G = {
      def: def, teach: teach, puz: !!def.puzzle, seq: def.mode === 1 && def.works.length > 1 && !def.puzzle, steps: 0, errors: 0, decoyErrs: 0,
      works: [], stickers: [], pages: [], page: 0, stageIdx: 0, hot: null, gesture: null, floats: [], parked: null, stash: [null, null],
      hand: { sel: [], confirmed: false, assign: [], armed: -1 }, paused: false, over: false, busy: 0,
      ticketOn: !!keepTicket, ui: {}, tw: TZ.TWEEZERS[TZ.S.equip.t], paper: TZ.S.equip.p, firstPeel: false,
      pairPeels: 0
    };
    var n = def.works.length;
    def.works.forEach(function (wid, i) {
      var wd = TZ.WORKS[wid], bb = TZ.workBox(wid);
      var slot = G.seq || n === 1 ? SLOTS[1][0] : SLOTS[n][i];
      if (def.puzzle) slot = { x: slot.x, y: slot.y, w: slot.w, h: slot.h - 36, ly: slot.ly };
      var s = Math.min(slot.w / bb.w, slot.h / bb.h, def.puzzle ? (n > 1 ? 0.34 : wd.pieces.length >= 5 ? 0.4 : 0.5) : 0.8);
      wd.pieces.forEach(function (p) {
        var v = TZ.vis(p.kind), k = p.k || 1;
        s = Math.min(s, 424 / (v.w * k), 232 / (v.h * k));
      });
      var w = { wid: wid, wi: i, def: wd, name: wd.name, s: s, slot: slot, pieces: [], done: false, errs: 0 };
      var cx = slot.x + slot.w / 2, cy = slot.y + slot.h / 2;
      wd.pieces.forEach(function (p) {
        var v = TZ.vis(p.kind), k = p.k || 1;
        w.pieces.push({
          id: p.id, key: i + '.' + p.id, kind: p.kind, layer: p.layer, depIds: p.deps, w: w, wi: i, filled: false, pend: false, by: null, k: k,
          sx: cx + (p.x - bb.cx) * s, sy: cy + (p.y - bb.cy) * s, vw: v.w * s * k, vh: v.h * s * k
        });
      });
      w.pieces.forEach(function (t) {
        t.deps = t.depIds ? t.depIds.map(function (id) { return w.pieces.filter(function (q) { return q.id === id; })[0]; })
          : w.pieces.filter(function (q) { return q.layer < t.layer; });
      });
      G.works.push(w);
    });
    var uid = 0;
    G.works.forEach(function (w) {
      w.pieces.forEach(function (t) {
        var v = TZ.vis(t.kind);
        var sk = { uid: uid++, key: t.key, piece: t, wi: w.wi, kind: t.kind, s: w.s * t.k, vw: v.w * w.s * t.k, vh: v.h * w.s * t.k, state: 'page', wear: 0, above: null, below: null, depth: 0 };
        t.st = sk; G.stickers.push(sk);
      });
    });
    if (def.pair === 'bigSmall') {
      G.stickers.slice().sort(function (a, b) { return b.vw * b.vh - a.vw * a.vh || a.uid - b.uid; })
        .forEach(function (st, i) { st.big = i < Math.ceil(G.stickers.length / 2); });
    }
    (def.decoys || []).forEach(function (k) {
      var v = TZ.vis(k), s = G.works[0].s;
      G.stickers.push({ uid: uid++, wi: -1, kind: k, s: s, vw: v.w * s, vh: v.h * s, state: 'page', wear: 0 });
    });
    var order = G.stickers.slice();
    if (def.works.length > 1 || def.decoys) {
      var rnd = TZ.seeded((teach ? 100 : 0) + def.id + 7);
      for (var i = order.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = order[i]; order[i] = order[j]; order[j] = t; }
    }
    var units;
    if (def.puzzle) {
      // 叠压：piles 里每组从上到下列出，只有最上面的一张能撕；其余单张散放
      var byKey = {}, used = {};
      G.stickers.forEach(function (s) { byKey[s.key] = s; });
      units = [];
      (def.piles || []).forEach(function (chain) {
        var u = chain.map(function (k) { used[k] = 1; return byKey[k]; });
        u.forEach(function (s, i) { s.above = i ? u[i - 1] : null; s.below = u[i + 1] || null; });
        units.push(u);
      });
      order.forEach(function (s) { if (!used[s.key]) units.push([s]); });
    } else units = order.map(function (s) { return [s]; });
    paginate(units);
  }

  function paginate(units) {
    var gap = 16, rowGap = 8, labH = 22, OX = 26, OY = 20;
    units.forEach(function (u) {
      var n = u.length, mw = 0, mh = 0;
      u.forEach(function (st) { mw = Math.max(mw, st.vw); mh = Math.max(mh, st.vh); });
      u.hd = n > 1 ? 18 : 0; u.w = Math.max(mw + OX * (n - 1), 60); u.h = mh + OY * (n - 1) + u.hd;
    });
    var pages = [], cur = { rows: [], h: 0 }, row = { items: [], w: 0, h: 0 };
    function closeRow() {
      if (!row.items.length) return;
      if (cur.rows.length && cur.h + rowGap + row.h > AREA.h) { pages.push(cur); cur = { rows: [], h: 0 }; }
      cur.h += (cur.rows.length ? rowGap : 0) + row.h; cur.rows.push(row); row = { items: [], w: 0, h: 0 };
    }
    units.forEach(function (u) {
      var cw = u.w, ch = u.h + labH;
      if (row.items.length && row.w + gap + cw > AREA.w) closeRow();
      row.w += (row.items.length ? gap : 0) + cw; row.h = Math.max(row.h, ch);
      row.items.push({ u: u, cw: cw });
    });
    closeRow(); if (cur.rows.length) pages.push(cur);
    pages.forEach(function (pg) {
      var y = AREA.y + (AREA.h - pg.h) / 2; pg.items = [];
      pg.rows.forEach(function (r) {
        var x = AREA.x + (AREA.w - r.w) / 2;
        r.items.forEach(function (it) {
          var u = it.u, n = u.length, top = y + (r.h - labH - u.h) / 2 + u.hd, cy = top + (u.h - u.hd) / 2, cx = x + it.cw / 2;
          u.forEach(function (st, i) {
            var d = n - 1 - i; st.depth = d;
            st.cell = { x: cx + (d - (n - 1) / 2) * OX - st.vw / 2, y: cy + (d - (n - 1) / 2) * OY - st.vh / 2 };
            pg.items.push(st);
          });
          x += it.cw + gap;
        });
        y += r.h + rowGap;
      });
      pg.stickers = pg.items;
    });
    G.pages = pages;
    G.stickers.forEach(function (st) { st.page = -1; });
    pages.forEach(function (pg, i) { pg.stickers.forEach(function (st) { st.page = i; }); });
  }

  /* ================= 界面 ================= */
  function pill(sc, x, y, w, h, text, cls) {
    var p = el('div', 'pill2 ' + (cls || ''), text); pos(p, x, y, w, h); p.style.lineHeight = h + 'px'; sc.appendChild(p); return p;
  }
  function label(sc, cls, x, y, w, text) {
    var d = el('div', cls, text); pos(d, x, y, w); sc.appendChild(d); return d;
  }

  TZ.screens.game = function (sc, args) {
    var def = args.def, teach = !!args.teach;
    buildState(def, teach, args.keepTicket);
    var U = G.ui;
    sc.appendChild(el('div', 'bar-panel panel'));
    U.pName = pill(sc, 83, 86, 557, 37, (teach ? '教学 ' + pad(def.id) : pad(def.id)) + ' · ' + def.name, 'left');
    U.pMid = pill(sc, 667, 86, 346, 37, '', 'left');
    U.pRight = pill(sc, 1055, 86, 143, 37, '', 'center');

    U.lTitle = label(sc, 'h-title', 141, 154, 420, G.puz ? (G.def.pair ? '压叠 · 配对 · 暂存' : '最上面的，才撕得动') : isDouble() ? '配成一对，更省一步' : '挑一张，慢慢贴');
    U.lCount = label(sc, 'h-sub', 141, 204, 200, '');
    sc.appendChild(pos(el('div', 'hr'), 141, 235, 434));
    sc.appendChild(pos(el('div', 'hr'), 652, 235, 483));
    U.rTitle = label(sc, 'h-title r', 667, 160, 460, '');
    U.rCount = label(sc, 'h-sub right', 835, 204, 300, '');

    if (!teach) {
      U.btnTicket = TZ.btn('', 'teal', isDouble() ? 314 : 269, 193, isDouble() ? 136 : 228, 32, onTicket);
      sc.appendChild(U.btnTicket);
    }
    if (isDouble()) {
      U.btnUndo = TZ.btn('撤回重选', 'taupe', 462, 193, 107, 32, undoHand);
      sc.appendChild(U.btnUndo);
    }
    U.src = el('div', 'layer'); sc.appendChild(U.src);
    U.tgt = el('div', 'layer'); sc.appendChild(U.tgt);
    if (G.puz) {
      U.stash = STASH.map(function (r, i) {
        var s = el('div', 'stash'); pos(s, r.x, r.y, r.w, r.h);
        s.addEventListener('pointerdown', function (e) { onStashDown(e, i); });
        sc.appendChild(s); return s;
      });
    }
    U.btnPrev = TZ.btn('上一页', 'green', 128, 543, 126, 34, function () { flip(-1); });
    U.pageLab = el('div', 'pill2 center white'); pos(U.pageLab, 283, 543, 135, 34); U.pageLab.style.lineHeight = '34px';
    U.btnNext = TZ.btn('下一页', 'green', 448, 543, 124, 34, function () { flip(1); });
    sc.appendChild(U.btnPrev); sc.appendChild(U.pageLab); sc.appendChild(U.btnNext);
    U.hint = el('div', 'hint'); pos(U.hint, 643, 551, 497, 40); sc.appendChild(U.hint);

    sc.appendChild(pos(el('div', 'panel bottom-bar'), 45, 605, 1188, 65));
    if (isDouble()) {
      U.slots = [0, 1].map(function (i) {
        var s = el('div', 'slot'); pos(s, 75 + i * 175, 612, 160, 50);
        s.addEventListener('pointerdown', function (e) { onSlotDown(e, i); });
        sc.appendChild(s); return s;
      });
      U.btnConfirm = TZ.btn('选择 1–2 张', 'green', 483, 614, 214, 46, confirmPeel);
      U.btnCommit = TZ.btn('同时贴上', 'green', 716, 614, 163, 46, commitDouble);
      sc.appendChild(U.btnConfirm); sc.appendChild(U.btnCommit);
    } else {
      var tw = new Image(); tw.src = 'assets/img/' + G.tw.img + '.png'; tw.className = 'tw-icon'; tw.draggable = false;
      sc.appendChild(tw);
      label(sc, 'bar-text', 156, 622, 300, G.tw.name);
      U.steps = label(sc, 'bar-text center', 440, 622, 300, '');
    }
    sc.appendChild(TZ.btn('重置', 'taupe', 905, 617, 147, 42, function () { restart(); }));
    sc.appendChild(TZ.btn('帮助', 'green', 1081, 617, 134, 42, showHelp));
    U.fl = el('div', 'float'); sc.appendChild(U.fl);

    renderTargets();
    renderSource();
    renderStash();
    hud();
    setHint();

    TZ.pauseClick = togglePause;
    var onMove = function (e) { gestureMove(e); };
    var onUp = function (e) { gestureUp(e); };
    var onTap = function (e) {
      if (e.target.closest && e.target.closest('.btn,.cell,.held,.slot,.stash,.modal')) return;
      var q = TZ.toStage(e); if (q.x > 620 && q.y > 130 && q.y < 600) tapRight(e);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    // 切走窗口/标签页时，进行中的撕贴或拖拽按“就地放下”处理，不让贴纸悬在半空
    var onLost = function () { if (G && G.gesture && !G.over) abortGesture(); };
    var onVis = function () { if (document.hidden) onLost(); };
    window.addEventListener('blur', onLost);
    document.addEventListener('visibilitychange', onVis);
    sc.addEventListener('pointerdown', onTap);
    var raf = 0, alive = true;
    function loop(now) { if (!alive) return; tick(now); raf = requestAnimationFrame(loop); }
    raf = requestAnimationFrame(loop);
    TZ.cleanup = function () {
      alive = false; cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp); window.removeEventListener('blur', onLost); document.removeEventListener('visibilitychange', onVis);
      sc.removeEventListener('pointerdown', onTap); TZ.pauseClick = null; TZ.audio.rustleStop(); G.over = true;
    };
    TZ.G = G;
    checkFail(true);
  };

  function restart() {
    TZ.go('game', { def: G.def, teach: G.teach, keepTicket: G.ticketOn });
  }

  function showHelp() {
    var tx = '<p>1. 在左页按住一张贴纸，沿<b>左右或上下</b>慢慢滑动把它撕开（斜着撕不动）。贴纸越长撕得越慢，更好的镊子撕得更快。撕到一半松手、或把撕下的贴纸放回左页，都会留下<b>折痕</b>，每道折痕扣 2 点品质（每张最多计 3 道）。</p>' +
      '<p>2. 把贴纸拖到右页对应的轮廓上松手贴下（也可以松手后轻点想贴的位置）。拖回左页就是归还。</p>' +
      '<p>3. 层次先下后上，同层不限先后；天妇罗的每张面团要等它对应的虾仁。揭起一次算 1 步，贴放一次算 1 步。</p>' +
      (isDouble() ? '<p>4. 双镊子：先揭起 1～2 张放进 A、B 格，点「揭起」确认；再把它们分别对位，点「同时贴上」整批判定，任一张错误整批都不贴入。</p>' : '') +
      (G.puz ? '<p>叠页规则：左页的贴纸互相压着，<b>只有最上面那张能撕</b>，撕走后下面一张才露出来。压叠的顺序可能和右页「先下后上」的贴放顺序冲突——这时把撕下的贴纸先放进右页下沿的<b>暂存格</b>（共 2 格，暂存多花 1 步），等轮到它时再从暂存格拿出来贴。从暂存格取出不耗步数；单镊子手里同时只能拿 1 张。</p>' +
        (G.def.pair === 'diffWork' ? '<p>配对规则：同一批的两张必须来自<b>不同作品</b>；两张都必须在这一批开始前就已露出。</p>' : '') +
        (G.def.pair === 'bigSmall' ? '<p>配对规则：同一批的两张必须<b>一大一小</b>（贴纸下方标有「大」或「小」）；两张都必须在这一批开始前就已露出。</p>' : '') : '') +
      '<p>翻页不耗步数。' + (G.def.budget ? '本关限 ' + G.def.budget + ' 步。' : '') + '</p>';
    TZ.modal('怎么玩', tx, [{ t: '知道啦' }]);
  }

  function togglePause() {
    if (G.over) return;
    if (G.paused) return;
    G.paused = true; TZ.audio.pause(true);
    abortGesture();
    TZ.modal('小憩一下', '<p>时间暂停，音效也安静下来。</p>', [
      { t: '继续', fn: function () { G.paused = false; TZ.audio.pause(false); } },
      { t: '重新开始', c: 'taupe', fn: function () { TZ.audio.pause(false); restart(); } },
      { t: '回到目录', c: 'coral', fn: function () { TZ.audio.pause(false); TZ.go('home'); } }
    ]);
  }

  function onTicket() {
    if (G.ticketOn || TZ.S.tickets < 1) return;
    TZ.modal('使用加映券？', '<p>消耗 1 张加映券，本关成功通关后额外 +100 积分。</p><p>失败、整关重玩或退出不返还。</p>', [
      { t: '用一张', fn: function () { TZ.S.tickets--; TZ.persist(); G.ticketOn = true; hud(); } },
      { t: '再想想', c: 'taupe' }
    ]);
  }

  /* ================= 渲染 ================= */
  function renderTargets() {
    var U = G.ui; U.tgt.innerHTML = '';
    G.works.forEach(function (w) {
      w.labEl = null;
      if (G.works.length > 1 && !G.seq) {
        var lab = el('div', 'wlab'); pos(lab, w.slot.x, w.slot.ly, w.slot.w);
        lab.innerHTML = '<b>' + (w.wi + 1) + ' · ' + w.name + '</b><span></span>'; U.tgt.appendChild(lab); w.labEl = lab;
      }
      w.pieces.forEach(function (t) {
        var e = el('div', 'tgt'); pos(e, t.sx - t.vw / 2, t.sy - t.vh / 2, t.vw, t.vh);
        e.style.zIndex = t.layer * 10 + 1;
        var g = TZ.makeStk(t.kind, w.s * t.k, 0); g.classList.add('ghost'); e.appendChild(g);
        t.ghostEl = g; t.el = e; U.tgt.appendChild(e);
      });
    });
    syncStage();
  }
  function syncStage() {
    G.works.forEach(function (w) {
      var vis = !G.seq || w.wi === G.stageIdx;
      w.pieces.forEach(function (t) { t.el.style.display = vis ? '' : 'none'; });
    });
  }

  function renderSource() {
    var U = G.ui; U.src.innerHTML = '';
    var pg = G.pages[G.page];
    if (!pg) return;
    var multi = G.works.length > 1;
    pg.stickers.forEach(function (st) {
      var holder = st.state === 'page';
      if (G.puz && !holder) return;
      var covered = holder && isCovered(st);
      var c = el('div', 'cell'); pos(c, st.cell.x, st.cell.y, st.vw, st.vh);
      c.style.zIndex = 10 + st.depth;
      var stk = TZ.makeStk(st.kind, st.s, holder ? G.paper : 0);
      if (!holder) stk.classList.add('hole');
      else if (covered) {
        c.classList.add('live', 'covered'); stk.classList.add('under');
        c.addEventListener('pointerdown', function (e) {
          if (e.button > 0) return; e.preventDefault();
          setHint('「' + stickerName(st) + '」被「' + stickerName(st.above) + '」压着，先把上面那张撕走。', true);
        });
      } else {
        c.classList.add('live'); st.cellEl = c;
        c.addEventListener('pointerdown', function (e) { onCellDown(e, st, c); });
        TZ.creaseFx(stk, st.cr);
      }
      c.appendChild(stk);
      var tag = (multi && st.wi >= 0 ? (st.wi + 1) + '·' : '') + stickerName(st) + (G.def.pair === 'bigSmall' ? (st.big ? ' [大]' : ' [小]') : '');
      var lab = el('div', 'clab' + (covered ? ' up' : ''), tag);
      if (covered) { pos(lab, 0, -18, 10); lab.style.width = 'auto'; } else pos(lab, -30, st.vh + 3, st.vw + 60);
      c.appendChild(lab);
      U.src.appendChild(c);
    });
    if (TZ.S.stats.peels < 8 && G.steps === 0 && !G.hand.sel.length && !G.parked) {
      var first = pg.stickers.filter(function (s) { return s.state === 'page' && s.cellEl && !isCovered(s); })[0];
      if (first && first.cellEl) {
        var tut = el('div', 'tut'); first.cellEl.appendChild(tut);
        tut.style.left = first.vw / 2 - 45 + 'px'; tut.style.top = first.vh / 2 - 45 + 'px';
      }
    }
    U.pageLab.textContent = '贴纸 ' + (G.page + 1) + ' / ' + G.pages.length;
    U.btnPrev.disabled = G.page <= 0; U.btnNext.disabled = G.page >= G.pages.length - 1;
  }

  function flip(d) {
    if (G.paused || G.over) return;
    var np = clamp(G.page + d, 0, G.pages.length - 1);
    if (np === G.page) return;
    G.page = np; renderSource();
  }

  function renderStash() {
    var U = G.ui; if (!U.stash) return;
    U.stash.forEach(function (s, i) {
      var st = G.stash[i]; s.innerHTML = '';
      s.className = 'stash' + (st ? ' full' : '');
      if (!st) { s.appendChild(el('span', '', '暂存格 ' + (i + 1) + ' · 空')); return; }
      var v = TZ.vis(st.kind), k = Math.min(32 / v.h, 70 / v.w);
      var thumb = TZ.makeStk(st.kind, k, G.paper); thumb.classList.add('thumb'); s.appendChild(thumb);
      s.appendChild(el('span', 'sl-t', (G.works.length > 1 ? (st.wi + 1) + '·' : '') + stickerName(st)));
    });
  }
  function stashHot(on) {
    var U = G.ui; if (!U.stash) return;
    U.stash.forEach(function (s, i) { s.classList.toggle('hot', on === i); });
  }

  function hud() {
    var U = G.ui, d = G.def;
    var left = 0; G.stickers.forEach(function (s) { if (s.wi >= 0 && s.state !== 'placed') left++; });
    U.lCount.textContent = left + ' 张待用';
    var act = activeWorks();
    var actTotal = 0; act.forEach(function (w) { actTotal += w.pieces.length; });
    U.rCount.textContent = filledCount(act) + ' / ' + actTotal + ' 张就位';
    if (G.works.length === 1) { U.rTitle.textContent = G.works[0].name; U.pMid.textContent = '作品 1 / 1'; }
    else if (G.seq) { U.rTitle.textContent = G.works[G.stageIdx].name; U.pMid.textContent = '作品 ' + (G.stageIdx + 1) + ' / ' + G.works.length; }
    else {
      U.rTitle.textContent = '把这一桌，贴成小美好';
      var dn = 0; G.works.forEach(function (w) { if (w.done) dn++; });
      U.pMid.textContent = '一起完成 ' + dn + ' / ' + G.works.length + ' 件';
    }
    G.works.forEach(function (w) {
      if (w.labEl) w.labEl.querySelector('span').textContent = filledCount([w]) + ' / ' + w.pieces.length;
    });
    if (d.budget) {
      var rest = Math.max(0, d.budget - G.steps);
      U.pRight.textContent = '剩 ' + rest + ' 步'; U.pRight.classList.add('warn');
    } else { U.pRight.textContent = '自由拼贴'; U.pRight.classList.remove('warn'); }
    if (U.steps) U.steps.textContent = '已用 ' + G.steps + ' 步';
    if (U.btnTicket) {
      U.btnTicket.textContent = G.ticketOn ? '加映中 · 成功 +100' : '加映券 ' + TZ.S.tickets;
      U.btnTicket.disabled = G.ticketOn || TZ.S.tickets < 1;
    }
    if (isDouble()) {
      var h = G.hand;
      U.btnUndo.disabled = !h.sel.length;
      [0, 1].forEach(function (i) {
        var s = U.slots[i]; s.innerHTML = '';
        var st = h.sel[i];
        s.className = 'slot' + (st ? ' full' : '') + (h.armed === i ? ' armed' : '');
        if (!st) { s.appendChild(el('span', '', (i ? 'B' : 'A') + ' · 空闲')); return; }
        var v = TZ.vis(st.kind), k = Math.min(34 / v.h, 70 / v.w);
        var thumb = TZ.makeStk(st.kind, k, G.paper); thumb.classList.add('thumb'); s.appendChild(thumb);
        var tg = h.assign[i];
        s.appendChild(el('span', 'sl-t', tg ? '→ ' + (tg.wi + 1) + '·' + stickerName(st) : (i ? 'B' : 'A') + ' · ' + stickerName(st)));
      });
      U.btnConfirm.textContent = h.confirmed ? '已揭起 ' + h.sel.length + ' 张' : (h.sel.length ? '揭起 ' + h.sel.length + ' 张 · 1 步' : '选择 1–2 张');
      U.btnConfirm.disabled = h.confirmed || !h.sel.length;
      U.btnCommit.disabled = !(h.confirmed && h.sel.length && h.sel.every(function (s, i) { return h.assign[i]; }));
    }
  }

  function setHint(msg, bad) {
    var U = G.ui; var d = G.def, text = msg;
    if (!text) {
      if (G.teach && d.id === 0 && G.steps === 0) text = d.hint0;
      else if (G.teach && d.hint) text = d.hint;
      else if (G.puz && !G.parked) text = (isDouble() ? pairMsg(true) : '只有最上面的能撕') + ' · 暂存格放 2 张，暂存多花 1 步';
      else if (isDouble()) text = '跨作品配成一对 · 同撕 1 步 + 同贴 1 步';
      else if (G.parked) text = G.puz ? '拖到右页轮廓上松手贴下，或拖进暂存格（多花 1 步）。' : '拖到右页的轮廓上松手，或轻点想贴的位置；拖回左页可以归还。';
      else text = '按住贴纸，向左右或上下缓缓滑动撕开；半途松手会留折痕。';
    }
    U.hint.textContent = text; U.hint.classList.toggle('bad', !!bad);
  }

  /* ================= 手势 ================= */
  function canPick() {
    if (G.paused || G.over || G.busy > 0 || G.gesture) return false;
    if (isDouble()) return !G.hand.confirmed && G.hand.sel.length < 2;
    return !G.parked;
  }

  function onCellDown(e, st, cellEl) {
    if (e.button > 0) return;
    TZ.audio.init();
    if (G.paused || G.over) return;
    if (!canPick()) {
      if (G.parked) setHint('先把手里的贴纸贴上，或拖回左页归还。', true);
      else if (isDouble() && G.hand.confirmed) setHint('这一批还没贴完，先「同时贴上」或「撤回重选」。', true);
      else if (isDouble() && G.hand.sel.length >= 2) setHint('两把镊子都满了，点「揭起」确认。', true);
      return;
    }
    if (isCovered(st)) { setHint('先把压在上面的「' + stickerName(st.above) + '」撕走。', true); return; }
    if (G.def.pair && isDouble() && G.hand.sel.length === 1 && !pairOk(G.hand.sel[0], st)) { setHint(pairMsg(), true); TZ.audio.play('error', 0.5); return; }
    e.preventDefault(); capture(e);
    var p = TZ.toStage(e);
    G.gesture = { kind: 'peel', st: st, cell: cellEl, sx: p.x, sy: p.y, lx: p.x, ly: p.y, lt: performance.now(), id: e.pointerId, touch: e.pointerType === 'touch', ox: 0, oy: 0,
      axis: null, sign: 1, ux: 0, uy: 0, need: 1, rate: 1, len: 1, target: 0, p: 0, warned: false, releasing: false };
    TZ.audio.rustleStart(TZ.PAPERS[G.paper].mat);
    cellEl.classList.add('grab');
  }

  /* 撕贴参数：只认左右/上下滑动；越长越慢，镊子越好越快 */
  function lockAxis(g, dx, dy) {
    var st = g.st, ax = Math.abs(dx), ay = Math.abs(dy);
    g.axis = ax >= ay ? 'x' : 'y';
    g.sign = (g.axis === 'x' ? dx : dy) >= 0 ? 1 : -1;
    g.ux = g.axis === 'x' ? g.sign : 0; g.uy = g.axis === 'y' ? g.sign : 0;
    var len = g.axis === 'x' ? st.vw : st.vh, big = Math.max(st.vw, st.vh);
    g.len = len;
    g.need = Math.max(46, G.tw.peel * 0.6 + len * 0.3);
    var lenEff = 0.5 * len + 0.5 * big;
    var T = (0.25 + lenEff / 100 * 0.3) / G.tw.speed;
    g.rate = 1 / Math.max(0.35, T);
  }
  function peelTick(g, dt) {
    var tgt = g.releasing ? 1 : g.target, d = tgt - g.p, step;
    if (d > 0) step = Math.min(d, g.rate * dt / 1000); else step = Math.max(d, -g.rate * 3 * dt / 1000);
    g.p += step;
    var c = g.cell;
    c.style.transition = 'none';
    c.style.transform = 'translate(' + (g.ux * g.p * 8).toFixed(1) + 'px,' + (g.uy * g.p * 8).toFixed(1) + 'px)';
    peelFx(g, g.ux, g.uy, g.p);
    TZ.audio.rustleSpeed(Math.abs(step) * g.len / Math.max(1, dt) * 1.6);
    if (g.p >= 0.999) completePeel(g);
  }
  function completePeel(g) {
    var rel = g.releasing, pt = { x: g.lx, y: g.ly };
    doPeel(g, pt);
    if (rel) { TZ.audio.rustleStop(); G.gesture = null; dropHeld(g.held, true); }
  }

  function gestureMove(e) {
    var g = G && G.gesture;
    if (!g || e.pointerId !== g.id || G.paused) return;
    var p = stagePt(e), now = performance.now();
    var dt = Math.max(1, now - g.lt), sp = Math.hypot(p.x - g.lx, p.y - g.ly) / dt;
    g.lx = p.x; g.ly = p.y; g.lt = now;
    if (g.kind === 'peel') {
      if (g.releasing) return;
      var dx = p.x - g.sx, dy = p.y - g.sy, d = Math.hypot(dx, dy), ax = Math.abs(dx), ay = Math.abs(dy);
      if (!g.axis) {
        if (d < 10) return;
        if (Math.min(ax, ay) / Math.max(ax, ay) > 0.62) {
          if (d > 36 && !g.warned) { g.warned = true; setHint('斜着撕不开：请沿左右或上下方向慢慢滑动。', true); }
          return;
        }
        lockAxis(g, dx, dy); setHint();
      }
      var proj = (g.axis === 'x' ? dx : dy) * g.sign;
      g.target = clamp(proj / g.need, 0, 1);
    } else if (g.kind === 'drag') {
      TZ.audio.rustleSpeed(sp);
      var h = g.held;
      h.px = p.x; h.py = p.y; h.vx = sp;
      updateHot(h);
      if (G.puz) stashHot(stashAt(p.x, p.y));
    }
  }

  function abortGesture() {
    var g = G.gesture; if (!g) return;
    TZ.audio.rustleStop();
    if (g.kind === 'peel') springBack(g);
    else if (g.kind === 'drag') { dropHeld(g.held, true); }
    G.gesture = null;
  }

  /* 折叠式翻角：沿拖动方向的反侧揭起，翻起的纸背朝拖动方向翻过去 */
  function peelFx(g, ux, uy, p) {
    var st = g.st, w = st.vw, h = st.vh, c = g.cell;
    if (!g.fx) {
      var orig = c.querySelector('.stk');
      var base = orig.cloneNode(true); base.classList.add('pl-base');
      var back = orig.cloneNode(true); back.classList.add('pl-back');
      back.querySelectorAll('img').forEach(function (i) { i.style.visibility = 'hidden'; });
      back.querySelectorAll('.foil,.wear').forEach(function (i) { i.style.display = 'none'; });
      var cv = back.querySelector('.curl'); if (cv) cv.style.opacity = 1;
      var o = el('div', 'pl-o'), m = el('div', 'pl-m');
      m.appendChild(back); o.appendChild(m);
      orig.style.visibility = 'hidden';
      c.appendChild(base); c.appendChild(o);
      g.fx = { orig: orig, base: base, back: back, o: o, m: m, cv: cv, p: 0, ux: 0, uy: 0 };
    }
    var f = g.fx; f.p = p; f.ux = ux; f.uy = uy;
    var hd = Math.abs(ux) * w / 2 + Math.abs(uy) * h / 2;
    var s = -hd + p * hd * 0.96, L = 3000, nx = -uy, ny = ux;
    var Fx = w / 2 + ux * s, Fy = h / 2 + uy * s;
    function pt(a, b) { return (Fx + nx * L * a + ux * L * b).toFixed(1) + 'px ' + (Fy + ny * L * a + uy * L * b).toFixed(1) + 'px'; }
    f.base.style.clipPath = 'polygon(' + [pt(1, 0), pt(-1, 0), pt(-1, 1), pt(1, 1)].join(',') + ')';
    f.back.style.clipPath = 'polygon(' + [pt(1, 0), pt(-1, 0), pt(-1, -1), pt(1, -1)].join(',') + ')';
    var fd = (w / 2) * ux + (h / 2) * uy + s;
    f.m.style.transformOrigin = '0 0';
    f.m.style.transform = 'matrix(' + [1 - 2 * ux * ux, -2 * ux * uy, -2 * ux * uy, 1 - 2 * uy * uy, 2 * fd * ux, 2 * fd * uy].map(function (v) { return v.toFixed(4); }).join(',') + ')';
    f.o.style.filter = 'drop-shadow(' + (ux * 3).toFixed(1) + 'px ' + (uy * 3 + 2).toFixed(1) + 'px 4px rgba(60,35,10,' + (0.12 + 0.28 * p).toFixed(2) + '))';
    if (f.cv) {
      var th = Math.atan2(ux, -uy) * 180 / Math.PI, fr = Math.max(8, Math.min(100, (s + hd) / (2 * hd) * 100));
      f.cv.style.background = 'linear-gradient(' + th.toFixed(1) + 'deg,#fffdf6 0%,#f7f0de ' + (fr * 0.55).toFixed(1) + '%,#d9ccae ' + fr.toFixed(1) + '%)';
    }
  }
  function clearFx(g) {
    var f = g.fx; if (!f) return;
    f.base.remove(); f.o.remove(); f.orig.style.visibility = '';
    g.fx = null;
  }

  function springBack(g, crease) {
    var c = g.cell; if (!c) return;
    var f = g.fx, t0 = performance.now(), D = 220, p0 = f ? f.p : 0;
    c.style.transition = 'transform ' + D + 'ms cubic-bezier(.3,1.4,.5,1)'; c.style.transform = '';
    var done = function () {
      c.classList.remove('grab');
      if (crease && g.fx) TZ.creaseFx(g.fx.orig, g.st.cr);
      clearFx(g);
    };
    if (!f) { done(); return; }
    (function step(now) {
      var k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3);
      if (!g.fx) return;
      peelFx(g, f.ux, f.uy, p0 * (1 - e));
      if (k < 1) requestAnimationFrame(step); else done();
    })(t0);
  }

  function addCrease(st, why) {
    st.cr = (st.cr || 0) + 1;
    TZ.S.stats.creases = (TZ.S.stats.creases || 0) + 1;
    var msg = why + '「' + stickerName(st) + '」留下了折痕（第 ' + st.cr + ' 道），品质会扣分。';
    setHint(msg, true); TZ.toast(msg);
  }

  function gestureUp(e) {
    var g = G && G.gesture;
    if (!g || e.pointerId !== g.id) return;
    if (g.kind === 'peel') {
      if (g.axis && g.target >= 0.9 && !G.paused) { g.releasing = true; return; }
      G.gesture = null; TZ.audio.rustleStop();
      var cr = g.axis && g.p >= 0.35;
      if (cr) addCrease(g.st, '半途松手，');
      springBack(g, cr); return;
    }
    G.gesture = null; TZ.audio.rustleStop();
    if (g.kind === 'drag') {
      // 取消/丢失指针时没有可靠坐标，按最后一次已知位置松手
      var p = e.type === 'pointercancel' ? { x: g.lx, y: g.ly } : stagePt(e), h = g.held;
      h.px = p.x; h.py = p.y;
      dropHeld(h, false);
    }
  }

  /* 揭离：进入持有状态 */
  function doPeel(g, p) {
    var st = g.st, c = g.cell;
    var cx = st.cell.x + st.vw / 2, cy = st.cell.y + st.vh / 2;
    st.wear++;
    TZ.S.stats.peels++; TZ.S.touched[st.kind] = 1;
    if (!isDouble()) { G.steps++; st.state = 'held'; }
    else { st.state = 'selected'; G.hand.sel.push(st); }
    TZ.persist();
    TZ.audio.rustleStop(); TZ.audio.play('peel');
    if (g.fx) {
      var gh = el('div', 'pl-ghost'); pos(gh, st.cell.x, st.cell.y, st.vw, st.vh);
      gh.style.transform = c.style.transform;
      gh.appendChild(g.fx.base.cloneNode(true)); gh.appendChild(g.fx.o.cloneNode(true));
      G.ui.fl.appendChild(gh);
      gh.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-out' }).onfinish = function () { gh.remove(); };
      g.fx = null;
    }
    var h = makeHeld(st, cx + g.ux * 8, cy + g.uy * 8);
    h.ox = cx - p.x; h.oy = cy - p.y; h.px = p.x; h.py = p.y; h.touch = g.touch; h.dragging = true;
    h.sc = 1.01;
    h.el.animate([{ opacity: 0.2, filter: 'drop-shadow(0 2px 2px rgba(60,35,10,.25))' }, { opacity: 1, filter: 'drop-shadow(0 12px 8px rgba(60,35,10,.3))' }], { duration: 200, easing: 'ease-out' });
    g.kind = 'drag'; g.held = h; G.gesture = g;
    renderSource(); hud(); setHint();
    if (!G.parked) TZ.audio.rustleStart(TZ.PAPERS[G.paper].mat);
  }

  function makeHeld(st, cx, cy) {
    var e = el('div', 'held'); e.style.width = st.vw + 'px'; e.style.height = st.vh + 'px';
    var sk = TZ.makeStk(st.kind, st.s, G.paper); TZ.creaseFx(sk, st.cr); e.appendChild(sk);
    G.ui.fl.appendChild(e);
    var h = { st: st, el: e, x: cx, y: cy, px: cx, py: cy, ox: 0, oy: 0, rot: 0, sc: 1, vx: 0, dragging: true, touch: false, slot: -1 };
    G.floats.push(h);
    return h;
  }
  function removeHeld(h) {
    h.dead = true; h.el.remove();
    var i = G.floats.indexOf(h); if (i >= 0) G.floats.splice(i, 1);
  }

  function updateHot(h) {
    var cx = h.px + h.ox, cy = h.py + h.oy;
    var r = findTarget(h.st, cx, cy, true);
    var t = r.t || null;
    if (t !== G.hot) {
      if (G.hot) G.hot.el.classList.remove('hot');
      G.hot = t;
      if (t) { t.el.classList.add('hot'); TZ.audio.play('snap', 0.45); }
    }
  }
  function clearHot() { if (G.hot) { G.hot.el.classList.remove('hot'); G.hot = null; } if (G.puz) stashHot(-1); }

  /* 目标查找：只对「食材、作品、层次」都允许的目标吸附 */
  function allowed(st, t) {
    if (t.filled || t.pend || st.wi !== t.wi || st.kind !== t.kind) return false;
    if (G.seq && t.wi !== G.stageIdx) return false;
    return t.deps.every(function (d) { return d.filled; });
  }
  function findTarget(st, cx, cy, hyst) {
    var R = G.tw.snap, best = null, bad = null;
    activeWorks().forEach(function (w) {
      w.pieces.forEach(function (t) {
        if (t.filled || t.pend) return;
        var d = Math.hypot(cx - t.sx, cy - t.sy);
        var reff = R + 0.28 * Math.min(t.vw, t.vh);
        if (hyst && G.hot === t) reff *= 1.25;
        if (allowed(st, t)) { if (d <= reff && (!best || d < best.d)) best = { t: t, d: d }; }
        else if (Math.abs(cx - t.sx) <= t.vw * 0.4 && Math.abs(cy - t.sy) <= t.vh * 0.4 && (!bad || d < bad.d)) bad = { t: t, d: d };
      });
    });
    return { t: best && best.t, bad: bad && bad.t };
  }
  function reason(st, t) {
    if (st.wi < 0) return '这是小干扰，不属于任何一道料理。';
    if (st.wi !== t.wi) return '这张贴纸属于另一件作品。';
    if (st.kind !== t.kind) return '这里要贴的不是「' + stickerName(st) + '」。';
    return '要先把下面的一层贴好，才能贴上这一张。';
  }

  /* 松手 */
  function dropHeld(h, forcePark) {
    clearHot(); h.dragging = false;
    var st = h.st, cx = h.px + h.ox, cy = h.py + h.oy;
    if (isDouble()) return dropDouble(h, cx, cy, forcePark);
    if (G.puz && !forcePark) {
      var si = stashAt(h.px, h.py);
      if (h.tap0 && si === h.tap0.idx && Math.hypot(h.px - h.tap0.x, h.py - h.tap0.y) < 10) {
        // 只是点了一下：把贴纸取到手里，挪到右页中间等着贴
        h.tap0 = null; parkAt(h, 910, 360); return;
      }
      if (si >= 0) { stashSingle(h, si); return; }
    }
    if (!forcePark && !st.fromStash && cx < 612 && cy > 120 && cy < 600) { returnSingle(h); return; }
    if (forcePark) { parkHeld(h); return; }
    attemptSingle(h, cx, cy);
  }
  /* 暂存：从页上撕下的贴纸放进暂存格多花 1 步；从暂存格取出的再放回不收费 */
  function parkAt(h, x, y, msg) {
    h.dragging = true; h.touch = false; h.ox = 0; h.oy = 0; h.px = x; h.py = y; G.busy++;
    setTimeout(function () {
      G.busy--; if (h.dead || G.over) return;
      h.dragging = false; parkHeld(h); if (msg) setHint(msg, true);
    }, 340);
  }
  function stashSingle(h, pref) {
    var st = h.st, idx = freeStash(pref);
    if (idx < 0) { TZ.audio.play('error', 0.5); parkAt(h, 910, 360, '暂存格都满了，先把里面的贴上。'); setHint('暂存格都满了，先把里面的贴上。', true); return; }
    if (!st.fromStash) G.steps++;
    st.state = 'stashed'; G.stash[idx] = st; G.parked = null;
    TZ.audio.soft();
    var c = stashCenter(idx);
    flyTo(h, c.x, c.y, function () { renderStash(); hud(); setHint(); checkFail(); });
    h.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' });
    renderStash(); hud();
  }
  function stashCenter(i) { var r = STASH[i]; return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }
  function parkHeld(h) {
    // 停放位置必须整张落在舞台里，否则拖到窗口外松手，贴纸就找不回来了
    var mx = Math.min(h.st.vw / 2 + 8, 600), my = Math.min(h.st.vh / 2 + 8, 340);
    var tx = clamp(h.x, mx, 1280 - mx), ty = clamp(h.y, my, 720 - my);
    if (!h.settling && Math.hypot(tx - h.x, ty - h.y) > 24) { h.settling = true; parkAt(h, tx, ty); return; }
    h.settling = false; h.x = tx; h.y = ty;
    G.parked = h; h.parked = true; h.el.classList.add('parked');
    h.px = h.x - h.ox; h.py = h.y - h.oy;
    setHint();
  }
  function attemptSingle(h, cx, cy) {
    var r = findTarget(h.st, cx, cy);
    if (r.t) { placeSingle(h, r.t); return; }
    if (r.bad) errorFx(h, r.bad);
    parkHeld(h);
  }
  function returnSingle(h) {
    var st = h.st;
    G.steps = Math.max(0, G.steps - 1); st.state = 'page'; TZ.S.stats.returns++; addCrease(st, '放回去也会折到纸，'); TZ.persist();
    G.parked = null; if (G.page !== st.page) { G.page = st.page; renderSource(); }
    flyTo(h, st.cell.x + st.vw / 2, st.cell.y + st.vh / 2, function () { renderSource(); hud(); setHint(); });
    if (G.page !== st.page) { /* 归还到原来的页面，当前页不变 */ }
    TZ.audio.soft();
  }
  function flyTo(h, x, y, done) {
    h.dragging = false; var i = G.floats.indexOf(h); if (i >= 0) G.floats.splice(i, 1); h.dead = true;
    var a = h.el.animate([{ transform: xf(h) }, { transform: 'translate(' + (x - h.st.vw / 2) + 'px,' + (y - h.st.vh / 2) + 'px)' }],
      { duration: 160, easing: 'ease-out', fill: 'forwards' });
    G.busy++;
    a.onfinish = function () { G.busy--; h.el.remove(); if (done) done(); };
  }
  function xf(h) {
    return 'translate(' + (h.x - h.st.vw / 2) + 'px,' + (h.y - h.st.vh / 2) + 'px) rotate(' + h.rot + 'deg) scale(' + h.sc + ')';
  }

  function errorFx(h, t) {
    G.errors++;
    if (h.st.wi >= 0) G.works[h.st.wi].errs++; else G.decoyErrs++;
    TZ.audio.play('error');
    setHint(reason(h.st, t), true);
    var s = h.el.firstChild;
    s.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(7px)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(0)' }], { duration: 260 });
  }

  /* 贴放 */
  function placeSingle(h, t) {
    clearHot();
    G.steps++;
    G.parked = null;
    applyPlace(h, t, 0);
    afterPlace();
  }
  function applyPlace(h, t, delay) {
    var st = h.st;
    st.state = 'placed'; st.t = t; t.filled = true; t.by = st; t.pend = false;
    TZ.S.stats.places++;
    var i = G.floats.indexOf(h); if (i >= 0) G.floats.splice(i, 1); h.dead = true;
    G.busy++;
    var a = h.el.animate([{ transform: xf(h) }, { transform: 'translate(' + (t.sx - st.vw / 2) + 'px,' + (t.sy - st.vh / 2) + 'px) rotate(0deg) scale(1.04)' }],
      { duration: 130, delay: delay, easing: 'cubic-bezier(.2,.8,.25,1)', fill: 'both' });
    a.onfinish = function () {
      G.busy--; h.el.remove();
      showPlaced(t);
    };
  }
  function showPlaced(t) {
    var e = TZ.makeStk(t.kind, t.w.s * t.k, G.paper); e.classList.add('placed'); TZ.creaseFx(e, t.by && t.by.cr);
    t.el.appendChild(e); t.placedEl = e; t.ghostEl.style.display = 'none';
    if (t.pendEl) { t.pendEl.remove(); t.pendEl = null; }
    TZ.audio.soft();
    e.animate([{ transform: 'scale(1.04)', filter: 'drop-shadow(0 8px 8px rgba(70,40,10,.32))' }, { transform: 'scale(.985)', filter: 'drop-shadow(0 1px 1px rgba(70,40,10,.2))', offset: .55 }, { transform: 'scale(1)', filter: 'drop-shadow(0 1px 1px rgba(70,40,10,.2))' }], { duration: 260, easing: 'cubic-bezier(.3,.9,.4,1)' });
  }

  function afterPlace() {
    var completed = [];
    G.works.forEach(function (w) {
      if (!w.done && w.pieces.every(function (t) { return t.filled; })) { w.done = true; completed.push(w); }
    });
    hud(); setHint();
    if (G.works.every(function (w) { return w.done; })) {
      G.over = true; TZ.audio.play('complete');
      completed.forEach(function (w) { workGlow(w); });
      setTimeout(finish, 1100);
      return;
    }
    if (completed.length) {
      TZ.audio.play('complete');
      completed.forEach(function (w) { workGlow(w); });
      if (G.seq) {
        G.busy++;
        setTimeout(function () { G.busy--; G.stageIdx++; syncStage(); hud(); setHint('下一件作品：' + G.works[G.stageIdx].name); checkFail(); }, 900);
        return;
      }
    }
    checkFail();
  }
  function workGlow(w) {
    w.pieces.forEach(function (t) {
      if (t.placedEl) t.placedEl.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.25)' }, { filter: 'brightness(1)' }], { duration: 600, delay: 160 });
    });
  }

  function checkFail(initial) {
    var d = G.def;
    if (!d.budget || G.over) return;
    var rest = totalPieces() - filledCount(G.works);
    var inRound = G.hand.confirmed || G.parked;
    var need = 2;
    if (G.puz) {
      if (G.gesture) return;
      // 按每张贴纸当前位置估算最少还要几步：页上 2 步（揭+贴），暂存/手里 1 步
      need = 0;
      var onPage = 0;
      G.stickers.forEach(function (s) {
        if (s.state === 'page') { onPage++; if (!isDouble()) need += 2; }
        else if (s.state === 'stashed' || s.state === 'held') need += 1;
      });
      if (isDouble()) {
        // 下限：揭起批数 + 贴放批数，每批最多 2 张
        var hs = G.hand.confirmed ? G.hand.sel.length : 0, p = onPage + (G.hand.confirmed ? 0 : G.hand.sel.length);
        var sn = G.stash.filter(Boolean).length;
        need = Math.ceil((p + sn) / 2) + Math.ceil((p + sn + hs) / 2);
      }
      inRound = false;
    }
    if (rest > 0 && !inRound && G.steps + need > d.budget) {
      G.over = true;
      TZ.audio.play('error');
      TZ.modal('步数用完啦', '<p>这一桌需要在 ' + d.budget + ' 步内贴完，还差 ' + rest + ' 张。换个配对的方式再来一次吧。</p><p>已收藏的作品和已消费的加映券保留。</p>', [
        { t: '重新来过', fn: function () { restart(); } },
        { t: '回到目录', c: 'taupe', fn: function () { TZ.go('home'); } }
      ]);
    }
  }

  /* 点按放置（松手后持有，或双镊子选中的槽位） */
  function tapRight(e) {
    if (G.paused || G.over || G.busy > 0 || G.gesture) return;
    var p = TZ.toStage(e);
    if (isDouble()) {
      var h = G.hand;
      if (h.confirmed && h.armed >= 0 && h.sel[h.armed] && !h.assign[h.armed]) {
        var st = h.sel[h.armed], r = findTarget(st, p.x, p.y);
        if (r.t) { assignTarget(h.armed, r.t); }
        else if (r.bad) { G.errors++; G.works[st.wi >= 0 ? st.wi : 0].errs++; TZ.audio.play('error'); setHint(reason(st, r.bad), true); }
      }
      return;
    }
    if (!G.parked) return;
    var held = G.parked, r2 = findTarget(held.st, p.x, p.y);
    if (r2.t) { held.x = r2.t.sx; held.y = r2.t.sy; placeSingle(held, r2.t); }
    else if (r2.bad) errorFx(held, r2.bad);
  }

  /* 取回已停放的贴纸继续拖 */
  function onHeldDown(e, h) {
    if (G.paused || G.over || G.gesture || h.dead || isDouble()) return;
    TZ.audio.init(); e.preventDefault(); e.stopPropagation(); capture(e);
    var p = TZ.toStage(e);
    h.parked = false; h.el.classList.remove('parked'); G.parked = null;
    h.ox = h.x - p.x; h.oy = h.y - p.y; h.px = p.x; h.py = p.y; h.dragging = true; h.touch = e.pointerType === 'touch';
    G.gesture = { kind: 'drag', held: h, id: e.pointerId, lx: p.x, ly: p.y, lt: performance.now() };
    TZ.audio.rustleStart(TZ.PAPERS[G.paper].mat);
  }

  /* 暂存格：点一下或拖出来取回（取回不耗步数）；单镊子手里有贴纸时，点空格即可暂存 */
  function onStashDown(e, i) {
    if (e.button > 0) return;
    if (G.paused || G.over || G.gesture || G.busy > 0) return;
    TZ.audio.init(); e.preventDefault(); e.stopPropagation(); capture(e);
    var st = G.stash[i], p = TZ.toStage(e);
    if (!st) {
      if (!isDouble() && G.parked) stashSingle(G.parked, i);
      else setHint(isDouble() ? '先点「揭起」，再把贴纸拖进暂存格。' : '把撕下的贴纸拖到这里就能暂存。');
      return;
    }
    if (isDouble()) {
      var hand = G.hand;
      if (hand.confirmed) { setHint('这一批已经揭起了，先贴完或撤回，再取暂存格里的。', true); return; }
      if (hand.sel.length >= 2) { setHint('两把镊子都满了，点「揭起」确认。', true); return; }
      if (hand.sel.length === 1 && !pairOk(hand.sel[0], st)) { setHint(pairMsg(), true); TZ.audio.play('error', 0.5); return; }
      G.stash[i] = null; st.state = 'selected'; st.fromStash = true; st.stashHome = i; hand.sel.push(st);
      TZ.audio.soft(); renderStash(); renderSource(); hud(); setHint('从暂存格取出了「' + stickerName(st) + '」，点「揭起」确认这一批。');
      return;
    }
    if (G.parked) { setHint('先把手里的贴纸贴上，或放进暂存格。', true); return; }
    G.stash[i] = null; st.state = 'held'; st.fromStash = true;
    var c = stashCenter(i), h = makeHeld(st, c.x, c.y);
    h.ox = c.x - p.x; h.oy = c.y - p.y; h.px = p.x; h.py = p.y; h.touch = e.pointerType === 'touch'; h.dragging = true; h.sc = 1.01;
    h.tap0 = { x: p.x, y: p.y, idx: i };
    G.gesture = { kind: 'drag', held: h, id: e.pointerId, lx: p.x, ly: p.y, lt: performance.now() };
    TZ.audio.rustleStart(TZ.PAPERS[G.paper].mat);
    renderStash(); hud();
  }

  /* ================= 双镊子 ================= */
  function slotIndex(st) { return G.hand.sel.indexOf(st); }

  function dropDouble(h, cx, cy, forcePark) {
    var st = h.st, hand = G.hand;
    var i = slotIndex(st);
    if (!hand.confirmed) {
      // 选择阶段：松手放进镊子槽，或拖回左页归还
      if (!forcePark && cx < 612 && cy > 120 && cy < 600) { returnSelected(st, h); return; }
      if (G.puz && !forcePark && stashAt(h.px, h.py) >= 0) setHint('先点「揭起」确认，再把贴纸拖进暂存格。', true);
      toSlot(h, i); return;
    }
    // 已揭起：尝试对位
    if (forcePark) { toSlot(h, i); return; }
    if (G.puz) {
      var si = stashAt(h.px, h.py);
      if (si >= 0) { stashFromHand(h, i, si); return; }
    }
    var r = findTarget(st, cx, cy);
    if (r.t) { toSlotThenAssign(h, i, r.t); return; }
    if (r.bad) errorFx(h, r.bad);
    toSlot(h, i);
  }
  /* 双镊子：已揭起的贴纸可以拖进暂存格，耗 1 步 */
  function stashFromHand(h, i, pref) {
    var hand = G.hand, st = h.st, idx = freeStash(pref, st);
    if (idx < 0) { setHint('暂存格都满了，先把里面的贴上。', true); TZ.audio.play('error', 0.5); toSlot(h, i); return; }
    unassign(i);
    hand.sel.splice(i, 1); hand.assign.splice(i, 1); hand.armed = -1; hand.usedStash = true;
    G.steps++; st.state = 'stashed'; G.stash[idx] = st; st.stashHome = -1;
    if (!hand.sel.length) { hand.confirmed = false; hand.usedStash = false; }
    TZ.audio.soft();
    var c = stashCenter(idx);
    flyTo(h, c.x, c.y, function () { renderStash(); renderSource(); hud(); setHint(); checkFail(); });
    h.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' });
    renderStash(); hud();
  }
  function slotCenter(i) { return { x: 75 + i * 175 + 80, y: 637 }; }
  function toSlot(h, i) {
    var c = slotCenter(i);
    flyTo(h, c.x, c.y, function () { hud(); });
    h.el.style.opacity = 0.0;
    h.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' });
  }
  function toSlotThenAssign(h, i, t) {
    removeHeld(h); assignTarget(i, t);
  }
  // 从暂存格取来的贴纸放回去：不扣折痕、不记归还
  function backToStash(st, h) {
    var idx = st.stashHome >= 0 && !G.stash[st.stashHome] ? st.stashHome : freeStash(-1);
    st.fromStash = false; st.state = 'stashed'; G.stash[idx] = st;
    if (h) { var c = stashCenter(idx); flyTo(h, c.x, c.y, function () { renderStash(); renderSource(); hud(); setHint(); }); }
    else { renderStash(); renderSource(); hud(); setHint(); }
    TZ.audio.soft();
  }
  function returnSelected(st, h) {
    var hand = G.hand, i = hand.sel.indexOf(st);
    if (i >= 0) { hand.sel.splice(i, 1); hand.assign.splice(i, 1); }
    if (st.fromStash) { backToStash(st, h); return; }
    st.state = 'page'; TZ.S.stats.returns++; addCrease(st, '放回去也会折到纸，'); TZ.persist();
    if (G.page !== st.page) { G.page = st.page; renderSource(); }
    if (h) flyTo(h, st.cell.x + st.vw / 2, st.cell.y + st.vh / 2, function () { renderSource(); hud(); });
    else { renderSource(); hud(); }
    TZ.audio.soft();
  }
  function onSlotDown(e, i) {
    if (G.paused || G.over || G.gesture || G.busy > 0) return;
    TZ.audio.init();
    var hand = G.hand, st = hand.sel[i];
    if (!st) return;
    e.preventDefault(); capture(e);
    var p0 = TZ.toStage(e), moved = false, id = e.pointerId;
    function mv(ev) {
      if (ev.pointerId !== id) return;
      var p = stagePt(ev);
      if (!moved && Math.hypot(p.x - p0.x, p.y - p0.y) > 8 && (hand.confirmed ? !hand.assign[i] : true)) {
        moved = true;
        var h = makeHeld(st, p.x, p.y); h.px = p.x; h.py = p.y; h.touch = ev.pointerType === 'touch'; h.dragging = true;
        G.gesture = { kind: 'drag', held: h, id: id, lx: p.x, ly: p.y, lt: performance.now() };
        TZ.audio.rustleStart(TZ.PAPERS[G.paper].mat);
        window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
      }
    }
    function up(ev) {
      if (ev.pointerId !== id) return;
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      if (moved) return;
      // 点按
      if (!hand.confirmed) { returnSelected(st, null); return; }
      if (hand.assign[i]) { unassign(i); }
      else { hand.armed = hand.armed === i ? -1 : i; hud(); if (hand.armed === i) setHint('轻点右页要贴的位置，或把它拖过去。'); }
    }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  }
  function confirmPeel() {
    var hand = G.hand;
    if (hand.confirmed || !hand.sel.length) return;
    if (G.def.budget && G.steps + 2 > G.def.budget) { setHint('步数不够再揭起一批了。', true); return; }
    G.steps++; hand.confirmed = true; hand.usedStash = false;
    if (hand.sel.length === 2) { TZ.S.stats.pairs++; TZ.persist(); }
    TZ.audio.play('peel', 0.6);
    if (G.puz) renderSource();
    hud(); setHint('把 A、B 分别对位到右页的轮廓，再点「同时贴上」。');
  }
  function assignTarget(i, t) {
    var hand = G.hand, st = hand.sel[i];
    t.pend = true; t.pendSt = st; hand.assign[i] = t; hand.armed = -1;
    var e = TZ.makeStk(t.kind, t.w.s * t.k, G.paper); e.classList.add('pending'); t.el.appendChild(e); t.pendEl = e;
    TZ.audio.play('snap', 0.5);
    hud(); setHint();
  }
  function unassign(i) {
    var hand = G.hand, t = hand.assign[i];
    if (t) { t.pend = false; t.pendSt = null; if (t.pendEl) t.pendEl.remove(); t.pendEl = null; }
    hand.assign[i] = null; hud();
  }
  function commitDouble() {
    var hand = G.hand;
    if (!hand.confirmed) return;
    var items = hand.sel.map(function (st, i) { return { st: st, t: hand.assign[i] }; });
    if (items.some(function (it) { return !it.t; })) return;
    // 整体判定：食材、作品、层次任一错误，整批都不贴入
    var ok = true;
    items.forEach(function (it) {
      var t = it.t, st = it.st;
      t.pend = false;
      var good = !t.filled && st.wi === t.wi && st.kind === t.kind && t.deps.every(function (d) { return d.filled; });
      t.pend = true;
      if (!good) ok = false;
    });
    if (items.length === 2 && items[0].t === items[1].t) ok = false;
    if (!ok) {
      G.errors++; items.forEach(function (it) { if (it.st.wi >= 0) G.works[it.st.wi].errs++; });
      items.forEach(function (it, i) { unassign(i); });
      TZ.audio.play('error'); setHint('这一批有贴不上的，整批都没有贴入，重新对位吧。', true);
      return;
    }
    G.steps++;
    items.forEach(function (it, k) {
      var t = it.t; t.pend = false; t.pendSt = null;
      if (t.pendEl) { t.pendEl.remove(); t.pendEl = null; }
      var c = slotCenter(k);
      var h = makeHeld(it.st, c.x, c.y); h.sc = 1;
      applyPlace(h, t, k * 90);
    });
    hand.sel = []; hand.assign = []; hand.confirmed = false; hand.armed = -1; hand.usedStash = false;
    afterPlace();
  }
  function undoHand() {
    var hand = G.hand;
    if (!hand.sel.length || G.busy > 0) return;
    // 这一批里已经暂存过贴纸的，揭起的那一步不再退还
    if (hand.confirmed && !hand.usedStash) G.steps = Math.max(0, G.steps - 1);
    var back = hand.sel.slice();
    hand.sel = []; hand.assign.forEach(function (t, i) { if (t) { t.pend = false; t.pendSt = null; if (t.pendEl) t.pendEl.remove(); t.pendEl = null; } });
    hand.assign = []; hand.confirmed = false; hand.armed = -1; hand.usedStash = false;
    var creased = false;
    back.forEach(function (st) {
      if (st.fromStash) { backToStash(st, null); return; }
      st.state = 'page'; TZ.S.stats.returns++; st.cr = (st.cr || 0) + 1; creased = true;
    });
    TZ.persist(); renderSource(); renderStash(); hud();
    setHint(creased ? '已撤回，放回的贴纸留下了折痕。' : '已撤回。', creased);
  }

  /* ================= 逐帧 ================= */
  function tick(now) {
    TZ.audio.tick(now);
    if (!G) return;
    var dt = Math.min(50, G.lt ? now - G.lt : 16.7); G.lt = now;
    var kf = dt / 16.7;
    function lp(a) { return 1 - Math.pow(1 - a, kf); }
    var pg = G.gesture;
    if (pg && pg.kind === 'peel' && pg.axis && !G.paused && !G.over) peelTick(pg, dt);
    G.floats.forEach(function (h) {
      if (h.dead) return;
      if (h.dragging) {
        var ty = h.touch ? -52 : 0;
        h.ox += (0 - h.ox) * lp(0.3); h.oy += (ty - h.oy) * lp(0.3);
        var dx = h.px + h.ox, dy = h.py + h.oy;
        if (G.hot) { dx += (G.hot.sx - dx) * 0.55; dy += (G.hot.sy - dy) * 0.55; }
        var px = h.x;
        h.x += (dx - h.x) * lp(0.34); h.y += (dy - h.y) * lp(0.34);
        var tr = clamp((h.x - px) * 1.4 / kf, -12, 12);
        h.rot += (tr - h.rot) * lp(0.16);
        h.sc += (1.05 - h.sc) * lp(0.2);
      } else if (h.parked) {
        h.rot += (0 - h.rot) * lp(0.2);
      }
      h.el.style.transform = xf(h);
      if (h.parked && !h.bound) { h.bound = true; h.el.addEventListener('pointerdown', function (e) { onHeldDown(e, h); }); }
    });
  }

  /* ================= 结算 ================= */
  function finish() {
    var d = G.def, S = TZ.S, teach = G.teach;
    var over = Math.max(0, G.steps - d.ideal);
    var qs = G.works.map(function (w) { return Math.max(40, 100 - 8 * w.errs); });
    var avg = qs.reduce(function (a, b) { return a + b; }, 0) / qs.length;
    var crN = 0; G.stickers.forEach(function (s) { crN += Math.min(s.cr || 0, 3); });
    var Q = Math.max(30, Math.round(avg - 2 * over - 5 * G.decoyErrs - 2 * crN));
    var rating = (over === 0 && Q >= 90) ? 'S' : (over <= 2 && Q >= 75) ? 'A' : Q >= 55 ? 'B' : 'C';
    var res = { def: d, teach: teach, cr: crN, works: G.works.map(function (w) { return w.wid; }), qs: qs, Q: Q, over: over,
      steps: G.steps, rating: rating, paper: G.paper, ticket: G.ticketOn, total: 0, base: 0, rm: 1, pm: 1, first: false };
    if (teach) {
      res.first = !S.teach[d.id];
      res.total = res.first ? d.reward : 0;
      S.teach[d.id] = true;
    } else {
      var rm = { S: 1.5, A: 1.2, B: 1.0, C: 0.8 }[rating], pm = TZ.PAPERS[G.paper].mult;
      res.base = d.reward / 1.5; res.rm = rm; res.pm = pm;
      res.total = Math.round(res.base * rm * pm) + (G.ticketOn ? 100 : 0);
      var m = S.main[d.id] || { done: false, plays: 0 };
      m.done = true; m.plays++;
      var order = { S: 3, A: 2, B: 1, C: 0 };
      if (!m.best || order[rating] > order[m.best.rating] || (rating === m.best.rating && Q > m.best.Q)) m.best = { rating: rating, Q: Q, steps: G.steps };
      S.main[d.id] = m;
      if (rating === 'S') S.stats.sRate++;
      if (Q === 100 && over === 0) S.stats.clean++;
      if (G.paper === 1) S.stats.paper1++;
      if (G.paper === 2) S.stats.paper2++;
      if (G.ticketOn) S.stats.ticketWin++;
      G.works.forEach(function (w, i) {
        var key = w.def.theme + ':' + G.paper;
        if (!S.coll[key] || S.coll[key].q < qs[i]) S.coll[key] = { q: qs[i] };
      });
    }
    TZ.addPoints(res.total);
    TZ.persist();
    TZ.audio.play('result');
    TZ.lastRes = res;
    TZ.go('result', res);
  }
})();
