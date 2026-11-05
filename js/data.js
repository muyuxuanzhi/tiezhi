/* 数据配表：素材可见包围盒、作品配方、关卡、装备、成就
   说明：配表数值（步数、奖励、镊子、纸质、成就）取自资料包；
   各作品内部的层次与坐标资料包未提供，为自行设计。 */
(function () {
  var TZ = window.TZ = window.TZ || {};

  // 素材：[原图宽, 原图高, 可见x0, y0, x1, y1]
  TZ.BB = {
    rice: [410, 236, 1, 18, 390, 191], salmon: [386, 190, 2, 14, 385, 176], nori: [114, 256, 20, 1, 67, 254], noriWide: [108, 138, 4, 4, 104, 134],
    riceLower: [400, 290, 19, 3, 391, 286], riceUpper: [300, 220, 10, 1, 290, 207], eel: [352, 180, 1, 2, 350, 163],
    batter: [700, 196, 38, 23, 658, 185], shrimp: [184, 172, 9, 18, 182, 128], dough: [172, 150, 1, 0, 170, 148],
    mayo: [570, 96, 89, 2, 487, 77], soupBowl: [600, 430, 82, 7, 569, 423], noodles: [452, 288, 4, 10, 447, 276],
    beef: [230, 174, 2, 2, 228, 172], greens: [200, 252, 3, 14, 198, 237], scallion: [312, 114, 9, 16, 312, 89],
    plate: [600, 416, 3, 21, 596, 391], tomato: [292, 232, 1, 5, 291, 227], eggs: [312, 224, 10, 5, 311, 208],
    rug: [740, 420, 27, 34, 717, 385], sofa: [446, 280, 24, 13, 421, 279], floorLamp: [156, 340, 10, 1, 145, 336],
    plant: [140, 174, 1, 9, 138, 163], cushion: [126, 104, 6, 6, 123, 98], coffeeTable: [254, 188, 6, 14, 254, 183],
    lemon: [160, 160, 7, 2, 152, 151], cucumber: [160, 160, 0, 2, 160, 158], candy: [160, 160, 10, 10, 159, 150]
  };

  TZ.KIND_NAME = {
    rice: '米饭底', salmon: '鲑鱼片', nori: '海苔饰带', noriWide: '宽海苔片', riceLower: '米饭下', eel: '鳗鱼块', riceUpper: '米饭上',
    batter: '面衣酥', shrimp: '虾仁', dough: '面团', mayo: '美乃滋', soupBowl: '汤碗', noodles: '面条',
    beef: '牛肉', greens: '青菜', scallion: '葱花', plate: '餐盘', tomato: '番茄', eggs: '炒蛋',
    rug: '地毯', sofa: '沙发', floorLamp: '落地灯', plant: '绿植', cushion: '靠垫', coffeeTable: '圆木桌',
    lemon: '柠檬片', cucumber: '黄瓜片', candy: '樱花糖'
  };

  // 作品配方：x,y 为可见部分中心（原图像素）；layer 为层次；deps 为显式依赖（默认依赖所有更低层）
  TZ.WORKS = {
    salmon: {
      name: '鲑鱼寿司', theme: 'salmon', pieces: [
        { id: 'rice', kind: 'rice', x: 0, y: 62, layer: 0 },
        { id: 'salmon', kind: 'salmon', x: 0, y: -8, layer: 1 },
        { id: 'nori', kind: 'nori', x: 0, y: 28, layer: 2 }]
    },
    eel: {
      name: '鳗鱼饭团寿司', theme: 'eel', pieces: [
        { id: 'lower', kind: 'riceLower', x: 0, y: 80, layer: 0 },
        { id: 'eel', kind: 'eel', x: 0, y: 140, layer: 1 },
        { id: 'upper', kind: 'riceUpper', x: 0, y: 42, layer: 2 },
        { id: 'nori', kind: 'noriWide', x: 0, y: 84, layer: 3 }]
    },
    tempura: {
      name: '炸虾天妇罗', theme: 'tempura', pieces: [
        // 现实里：虾仁裹上面团，再整个包进酥脆的面衣里，只有虾尾露在外面；美乃滋最后淋在面衣上
        { id: 's1', kind: 'shrimp', k: 1.15, x: -165, y: -42, layer: 0 },
        { id: 's2', kind: 'shrimp', k: 1.15, x: 165, y: -42, layer: 0 },
        { id: 'd1', kind: 'dough', k: 0.8, x: -150, y: -2, layer: 1, deps: ['s1'] },
        { id: 'd2', kind: 'dough', k: 0.8, x: 150, y: -2, layer: 1, deps: ['s2'] },
        { id: 'batter', kind: 'batter', x: 0, y: 0, layer: 2 },
        { id: 'mayo', kind: 'mayo', x: 0, y: 0, layer: 3 }]
    },
    noodle: {
      name: '红烧牛肉面', theme: 'noodle', pieces: [
        // 面堆在汤面里，露出一圈汤；牛肉与青菜摆在面上，葱花撒在最上
        { id: 'bowl', kind: 'soupBowl', x: 0, y: 0, layer: 0 },
        { id: 'noodles', kind: 'noodles', k: 0.75, x: 0, y: -45, layer: 1 },
        { id: 'beef', kind: 'beef', k: 0.6, x: -58, y: -80, layer: 2 },
        { id: 'greens', kind: 'greens', k: 0.62, x: 68, y: -88, layer: 2 },
        { id: 'scallion', kind: 'scallion', k: 0.5, x: 0, y: -62, layer: 3 }]
    },
    tomato: {
      name: '番茄炒蛋', theme: 'tomato', pieces: [
        { id: 'plate', kind: 'plate', x: 0, y: 0, layer: 0 },
        { id: 'tomato', kind: 'tomato', k: 0.85, x: -88, y: -2, layer: 1 },
        { id: 'eggs', kind: 'eggs', k: 0.8, x: 85, y: 8, layer: 1 },
        { id: 'scallion', kind: 'scallion', k: 0.5, x: 55, y: -12, layer: 2 }]
    },
    living: {
      name: '温馨客厅', theme: 'living', pieces: [
        { id: 'rug', kind: 'rug', x: 0, y: 100, layer: 0 },
        { id: 'sofa', kind: 'sofa', x: -70, y: -5, layer: 1 },
        { id: 'lamp', kind: 'floorLamp', x: 335, y: 50, layer: 1 },
        { id: 'plant', kind: 'plant', x: -335, y: 62, layer: 1 },
        { id: 'cushion', kind: 'cushion', x: -118, y: -22, layer: 2 },
        { id: 'table', kind: 'coffeeTable', x: 96, y: 132, layer: 2 }]
    },

    /* ---- 扩展料理：全部由现有素材重新组合，坐标为自行设计 ---- */
    salmonRice: {
      name: '鲑鱼小定食', theme: 'salmonRice', pieces: [
        { id: 'plate', kind: 'plate', x: 0, y: 0, layer: 0 },
        { id: 'rice', kind: 'rice', k: 0.85, x: 0, y: 40, layer: 1 },
        { id: 'salmon', kind: 'salmon', k: 0.85, x: 0, y: -20, layer: 2 },
        { id: 'nori', kind: 'nori', k: 0.72, x: 0, y: 8, layer: 3 },
        { id: 'scallion', kind: 'scallion', k: 0.45, x: 45, y: -32, layer: 4 }]
    },
    eelPlate: {
      name: '鳗鱼饭团盘', theme: 'eelPlate', pieces: [
        { id: 'plate', kind: 'plate', x: 0, y: 0, layer: 0 },
        { id: 'lower', kind: 'riceLower', x: 0, y: 10, layer: 1 },
        { id: 'eel', kind: 'eel', x: 0, y: 70, layer: 2 },
        { id: 'upper', kind: 'riceUpper', x: 0, y: -28, layer: 3 },
        { id: 'nori', kind: 'noriWide', x: 0, y: 10, layer: 4 }]
    },
    tendon: {
      name: '天妇罗盖饭', theme: 'tendon', pieces: [
        { id: 'plate', kind: 'plate', x: 0, y: 0, layer: 0 },
        // 米饭打底，裹着虾的天妇罗横放在饭上，只露虾尾，再淋美乃滋
        { id: 'rice', kind: 'rice', k: 0.95, x: 0, y: 30, layer: 1 },
        { id: 's1', kind: 'shrimp', k: 1.1, x: -130, y: -33, layer: 2 },
        { id: 's2', kind: 'shrimp', k: 1.1, x: 130, y: -33, layer: 2 },
        { id: 'batter', kind: 'batter', k: 0.8, x: 0, y: -5, layer: 3 },
        { id: 'mayo', kind: 'mayo', k: 0.8, x: 0, y: -5, layer: 4 }]
    },
    beefBowl: {
      name: '牛肉盖饭', theme: 'beefBowl', pieces: [
        // 米饭居中，红烧肉盖在饭上，青菜是盘边配菜
        { id: 'plate', kind: 'plate', x: 0, y: 0, layer: 0 },
        { id: 'rice', kind: 'rice', k: 0.8, x: 30, y: 28, layer: 1 },
        { id: 'greens', kind: 'greens', k: 0.6, x: -160, y: -8, layer: 1 },
        { id: 'b1', kind: 'beef', k: 0.7, x: -2, y: -12, layer: 2 },
        { id: 'b2', kind: 'beef', k: 0.7, x: 78, y: 10, layer: 2 },
        { id: 'scallion', kind: 'scallion', k: 0.5, x: 30, y: -5, layer: 3 }]
    },
    eggNoodle: {
      name: '番茄蛋汤面', theme: 'eggNoodle', pieces: [
        { id: 'bowl', kind: 'soupBowl', x: 0, y: 0, layer: 0 },
        { id: 'noodles', kind: 'noodles', k: 0.75, x: 0, y: -45, layer: 1 },
        { id: 'tomato', kind: 'tomato', k: 0.62, x: -66, y: -80, layer: 2 },
        { id: 'eggs', kind: 'eggs', k: 0.58, x: 66, y: -80, layer: 2 },
        { id: 'scallion', kind: 'scallion', k: 0.5, x: 0, y: -60, layer: 3 }]
    },
    homeStir: {
      name: '家常小炒', theme: 'homeStir', pieces: [
        // 左边番茄炒蛋（蛋盖在番茄边上），右边红烧肉，青菜立在肉后面
        { id: 'plate', kind: 'plate', x: 0, y: 0, layer: 0 },
        { id: 'tomato', kind: 'tomato', k: 0.7, x: -120, y: -5, layer: 1 },
        { id: 'greens', kind: 'greens', k: 0.6, x: 128, y: -42, layer: 1 },
        { id: 'eggs', kind: 'eggs', k: 0.62, x: -35, y: 12, layer: 2 },
        { id: 'beef', kind: 'beef', k: 0.65, x: 118, y: 38, layer: 2 },
        { id: 'scallion', kind: 'scallion', k: 0.45, x: -60, y: -5, layer: 3 }]
    },
    cozyCorner: {
      name: '小憩一角', theme: 'cozyCorner', pieces: [
        { id: 'rug', kind: 'rug', x: 0, y: 100, layer: 0 },
        { id: 'sofa', kind: 'sofa', x: -70, y: -5, layer: 1 },
        { id: 'lamp', kind: 'floorLamp', x: 335, y: 50, layer: 1 },
        { id: 'plant', kind: 'plant', x: -335, y: 62, layer: 1 },
        { id: 'c1', kind: 'cushion', x: -170, y: -22, layer: 2 },
        { id: 'c2', kind: 'cushion', x: -30, y: -22, layer: 2 },
        { id: 'table', kind: 'coffeeTable', x: 96, y: 132, layer: 2 }]
    }
  };
  TZ.THEMES = ['salmon', 'eel', 'tempura', 'noodle', 'tomato', 'living'];
  TZ.THEMES_EX = ['salmonRice', 'eelPlate', 'tendon', 'beefBowl', 'eggNoodle', 'homeStir', 'cozyCorner'];
  TZ.ALL_THEMES = TZ.THEMES.concat(TZ.THEMES_EX);

  // 主关：mode 1=单镊子 2=双镊子；budget=null 为自由；reward 为原色纸理想奖励
  TZ.MAIN = [
    { id: 1, name: '第一口寿司', works: ['salmon'], mode: 1, budget: null, ideal: 6, reward: 150 },
    { id: 2, name: '藏在米饭里的鲜味', works: ['eel'], mode: 1, budget: null, ideal: 8, reward: 150 },
    { id: 3, name: '酥脆的排列', works: ['tempura'], mode: 1, budget: null, ideal: 12, reward: 150 },
    { id: 4, name: '贴纸页的小迷惑', works: ['salmon', 'eel'], mode: 1, budget: null, ideal: 14, reward: 300 },
    { id: 5, name: '精打细算的午餐', works: ['eel', 'tempura'], mode: 1, budget: 24, ideal: 20, reward: 300 },
    { id: 6, name: '两把镊子的默契', works: ['tempura', 'noodle'], mode: 2, budget: 14, ideal: 12, reward: 300 },
    { id: 7, name: '料理手账大合集', works: ['salmon', 'eel', 'tempura'], mode: 2, budget: 18, ideal: 14, reward: 450 },
    { id: 8, name: '一碗热腾腾的牛肉面', works: ['noodle'], mode: 1, budget: null, ideal: 10, reward: 150 },
    { id: 9, name: '番茄与鸡蛋的碰面', works: ['tomato'], mode: 1, budget: null, ideal: 8, reward: 150 },
    { id: 10, name: '家常双拼午餐', works: ['noodle', 'tomato'], mode: 2, budget: 12, ideal: 10, reward: 300 },
    { id: 11, name: '给客厅留一点温柔', works: ['living'], mode: 1, budget: null, ideal: 12, reward: 150 },
    { id: 12, name: '把日子贴成喜欢的样子', works: ['noodle', 'tomato', 'living'], mode: 2, budget: 20, ideal: 16, reward: 450 }
  ];

  // 扩展关（13–28）：复用现有素材的新料理与新组合，步数与奖励为自行设计
  TZ.EXTRA = [
    { id: 13, name: '鲑鱼小定食', works: ['salmonRice'], mode: 1, budget: null, ideal: 10, reward: 180 },
    { id: 14, name: '鳗鱼饭团上桌', works: ['eelPlate'], mode: 1, budget: null, ideal: 10, reward: 180 },
    { id: 15, name: '天妇罗盖饭', works: ['tendon'], mode: 1, budget: null, ideal: 12, reward: 180 },
    { id: 16, name: '牛肉盖饭', works: ['beefBowl'], mode: 1, budget: null, ideal: 12, reward: 180 },
    { id: 17, name: '番茄蛋汤面', works: ['eggNoodle'], mode: 1, budget: null, ideal: 10, reward: 180 },
    { id: 18, name: '家常小炒', works: ['homeStir'], mode: 1, budget: null, ideal: 12, reward: 180 },
    { id: 19, name: '小憩一角', works: ['cozyCorner'], mode: 1, budget: null, ideal: 14, reward: 180 },
    { id: 20, name: '小干扰多的一页', works: ['tendon'], mode: 1, budget: 16, ideal: 12, reward: 240, decoys: ['lemon', 'cucumber', 'candy'] },
    { id: 21, name: '两碗盖饭', works: ['tendon', 'beefBowl'], mode: 1, budget: 28, ideal: 24, reward: 360 },
    { id: 22, name: '饭团与寿司', works: ['eelPlate', 'salmonRice'], mode: 1, budget: 24, ideal: 20, reward: 360 },
    { id: 23, name: '一面一炒', works: ['eggNoodle', 'homeStir'], mode: 1, budget: 26, ideal: 22, reward: 360 },
    { id: 24, name: '双手同拆·午餐', works: ['tendon', 'salmonRice'], mode: 2, budget: 14, ideal: 12, reward: 360 },
    { id: 25, name: '客厅与热面', works: ['cozyCorner', 'eggNoodle'], mode: 2, budget: 14, ideal: 12, reward: 360 },
    { id: 26, name: '双镊子大挑战', works: ['beefBowl', 'eelPlate'], mode: 2, budget: 14, ideal: 12, reward: 360 },
    { id: 27, name: '三道热菜', works: ['homeStir', 'tendon', 'eggNoodle'], mode: 2, budget: 20, ideal: 18, reward: 540 },
    { id: 28, name: '把生活摆满一桌', works: ['cozyCorner', 'beefBowl', 'eelPlate'], mode: 2, budget: 20, ideal: 18, reward: 540 }
  ];

  // 教学奖励关：首次奖励见教学奖励配表
  TZ.TEACH = [
    { id: 0, name: '第一张贴纸', works: ['salmon'], mode: 1, budget: null, ideal: 6, reward: 100,
      hint: '接着揭起下一张，记得先下后上。', hint0: '先按住米饭，向右（或向左、上下）缓缓滑动，把它撕开吧。' },
    { id: 1, name: '上下叠贴', works: ['eel'], mode: 1, budget: null, ideal: 8, reward: 100,
      hint: '先贴下面的，再贴上面的：米饭下、鳗鱼、米饭上、海苔。' },
    { id: 2, name: '同层与叠贴', works: ['tempura'], mode: 1, budget: null, ideal: 12, reward: 120,
      hint: '先虾仁，再面团；最后面衣酥盖在外面，美乃滋压在最上。' },
    { id: 3, name: '认出小干扰', works: ['salmon'], mode: 1, budget: null, ideal: 6, reward: 120, decoys: ['lemon', 'cucumber', 'candy'],
      hint: '页面里混着不属于这道料理的小干扰，认出来，别贴上去。' },
    { id: 4, name: '步数规划', works: ['eel'], mode: 1, budget: 10, ideal: 8, reward: 150,
      hint: '揭起和贴下各算 1 步，规划好，别超过 10 步。' },
    { id: 5, name: '两把镊子', works: ['salmon', 'tomato'], mode: 2, budget: 10, ideal: 8, reward: 180,
      hint: '一次选 1～2 张，同时揭起、同时贴上，更省步数。' },
    { id: 6, name: '空间整理', works: ['living'], mode: 1, budget: null, ideal: 12, reward: 150,
      hint: '贴纸分在几页，翻页不耗步数，选好的贴纸也不会丢。' }
  ];

  TZ.TWEEZERS = [
    // peel：撕开所需的滑动距离基数；speed：撕开速度倍率（自行设计，越好越快）
    { id: 0, name: '基础银镊子', peel: 74, snap: 32, speed: 1.0, cost: 0, img: 'tweezer0' },
    { id: 1, name: '顺滑粉镊子', peel: 62, snap: 44, speed: 1.35, cost: 300, img: 'tweezer1' },
    { id: 2, name: '匠心黄铜镊子', peel: 52, snap: 56, speed: 1.7, cost: 900, img: 'tweezer2' },
    { id: 3, name: '星光镊子', peel: 46, snap: 64, speed: 2.1, cost: -1, img: 'tweezer3' }
  ];
  TZ.PAPERS = [
    { id: 0, name: '原色纸', mult: 1.00, cost: 0, mat: 'Paper' },
    { id: 1, name: '镭射纸', mult: 1.10, cost: 400, mat: 'Film' },
    { id: 2, name: '亮片纸', mult: 1.20, cost: 1000, mat: 'Glitter' },
    { id: 3, name: '金色闪光纸', mult: 1.30, cost: 1600, mat: 'Gold' },
    { id: 4, name: '极光碎箔纸', mult: 1.35, cost: -1, mat: 'Glitter' }
  ];

  // 成就：cur(S) 返回当前进度
  function cnt(o) { var n = 0; for (var k in o) if (o[k]) n++; return n; }
  function mainDone(S) { var n = 0; for (var k in S.main) if (+k <= 12 && S.main[k] && S.main[k].done) n++; return n; }
  function themes(S) { var m = {}; for (var k in S.coll) { var th = k.split(':')[0]; if (TZ.THEMES.indexOf(th) >= 0) m[th] = 1; } return cnt(m); }
  TZ.ACH = [
    { n: '第一张贴纸', d: '陪第一张贴纸走完教学00', t: 1, r: 60, cur: function (S) { return S.teach[0] ? 1 : 0; } },
    { n: '学会新花样', d: '学会3种教学小窍门', t: 3, r: 120, cur: function (S) { return cnt(S.teach); } },
    { n: '手账毕业生', d: '把7种教学小窍门都学会', t: 7, r: 200, tk: 2, cur: function (S) { return cnt(S.teach); } },
    { n: '开张啦', d: '完成你的第1个主关', t: 1, r: 80, cur: mainDone },
    { n: '半册灵感', d: '通关6个不同主关', t: 6, r: 180, cur: mainDone },
    { n: '贴满生活', d: '通关全部12个主关', t: 12, r: 300, unlock: 't3', extra: '永久星光镊子', cur: mainDone },
    { n: '轻轻揭起', d: '滑动剥离10张', t: 10, r: 80, cur: function (S) { return S.stats.peels; } },
    { n: '剥离高手', d: '滑动剥离60张', t: 60, r: 160, cur: function (S) { return S.stats.peels; } },
    { n: '一贴到位', d: '贴放30张', t: 30, r: 150, cur: function (S) { return S.stats.places; } },
    { n: '归位好习惯', d: '归还5张', t: 5, r: 80, cur: function (S) { return S.stats.returns; } },
    { n: '双手合拍', d: '两张同撕5次', t: 5, r: 140, cur: function (S) { return S.stats.pairs; } },
    { n: '优秀手感', d: '主关S评级1次', t: 1, r: 100, cur: function (S) { return S.stats.sRate; } },
    { n: 'S级手账家', d: '主关S评级8次', t: 8, r: 220, cur: function (S) { return S.stats.sRate; } },
    { n: '干净利落', d: '主关品质100且理想步数内3次', t: 3, r: 180, tk: 1, cur: function (S) { return S.stats.clean; } },
    { n: '生活收藏家', d: '收录6种主题，任意纸质', t: 6, r: 250, unlock: 'p4', extra: '永久极光碎箔纸', cur: themes },
    { n: '十二份闪光', d: '收录12种主题×纸质组合', t: 12, r: 300, tk: 3, cur: function (S) { return cnt(S.coll); } },
    { n: '虹彩捕手', d: '镭射纸通关主关3次', t: 3, r: 150, cur: function (S) { return S.stats.paper1; } },
    { n: '闪点收藏', d: '亮片纸通关主关3次', t: 3, r: 180, cur: function (S) { return S.stats.paper2; } },
    { n: '灵感积蓄', d: '累计获得2500积分', t: 2500, r: 200, cur: function (S) { return S.earned; } },
    { n: '幸运加映', d: '使用加映券并成功通关1次', t: 1, r: 100, tk: 1, cur: function (S) { return S.stats.ticketWin; } }
  ];

  // 食材托盘中可用的食材（手账）
  TZ.JOURNAL_KINDS = ['rice', 'salmon', 'nori', 'noriWide', 'riceLower', 'eel', 'riceUpper', 'batter', 'shrimp', 'dough', 'mayo',
    'soupBowl', 'noodles', 'beef', 'greens', 'scallion', 'plate', 'tomato', 'eggs', 'rug', 'sofa', 'floorLamp', 'plant',
    'cushion', 'coffeeTable', 'lemon', 'cucumber', 'candy'];
})();
