/* 发作性睡病 · 昼夜百叶窗版交互 v2
 * 白天：纸底 + 圆粒子贴图（particle-*.png，柠檬黄/亮橙/玫红/西瓜红/牛油果绿/雾蓝随机），
 *   底部上缩避开百叶窗降下后的白缝。
 * 顶部半藏一扇真百叶窗（白色叶片 + 梯绳 + 下梁 + 拉绳圆环，绳轻晃）：
 *   点拉环 → 弹性降下（白天粒子渐隐）→ 白叶 3D 转出去（linear 匀角速）：
 *   绕上边缘向后上翻没 → 隐身段换装（night-color 类：变黑 + 轴心移下边缘）
 *   → 黑叶绕下边缘朝前上掀出归位（与翻没方向相反，往上翻回来）
 *   → 每条黑叶放大吞满面板区（底部白缝保持白色）→ 夜幕在叶片下渐显全黑后
 *   叶片瞬间退场（接力交接恒黑）→ 星星渐渐浮现（拉环全程挂在白缝里不消失）。
 * 夜里点拉环完全镜像：星星渐隐 → 黑幕下叶片点亮 → 夜幕退场（恒黑）→ 黑叶缩回 →
 *   整圈翻回白叶 → 百叶窗升走 → 白天圆形粒子浮现。
 * 所有粒子/星星/微尘都是独立 png 贴图，颜色随机（tools/make_stars.py 生成夜图）。
 */
(function () {
  "use strict";

  /* ---------- 工具 ---------- */
  const $ = (id) => document.getElementById(id);
  const rand = (a, b) => a + Math.random() * (b - a);
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  const ITEMS = STORIES.concat(LEAVES);
  /* 白天场景：从 day-data.js 按 id 一一挂到条目上（it.day）。
   * 同一颗粒子：白天点开看 it.day（日常），黑夜点开看条目本身（真实故事）。 */
  const DAY_SCENES = window.DAY_SCENES || {};
  ITEMS.forEach((it) => { if (DAY_SCENES[it.id]) it.day = DAY_SCENES[it.id]; });
  /* 白天：圆粒子贴图（2026-11-10 用户第二次截图配色，6 色随机：
   * 柠檬黄/亮橙黄/玫红/西瓜红/牛油果绿/雾蓝） */
  const DAY_COLORS = [
    { key: "lemon",    css: "#F8E473" },
    { key: "sunpop",   css: "#FFB40F" },
    { key: "bubble",   css: "#E41E71" },
    { key: "melon",    css: "#F15961" },
    { key: "avocado",  css: "#A7B408" },
    { key: "breezy",   css: "#96C1DD" }
  ];
  /* 黑夜：五色五角星贴图（star-*.png，tools/make_stars.py 生成，深色在黑底看不见，全浅色） */
  const NIGHT_STARS = [
    { key: "eggshell", css: "#F7F3E3" },
    { key: "ice",      css: "#BFE0F2" },
    { key: "mist",     css: "#9FB8D8" },
    { key: "white",    css: "#FFFFFF" },
    { key: "sky",      css: "#8FC7DE" }
  ];
  /* 黑夜微尘小圆点贴图（night-dust-*.png） */
  const NIGHT_DUST = ["dust-1", "dust-2"];

  /* ---------- 浮窗（DOM 逻辑独立于 canvas，jsdom 可测） ---------- */
  const modal = $("modal");
  const card = document.querySelector(".story-card");
  let modalOpen = false;
  /* 换幕动画进行中标记（声明上移：人物心里话弹窗在守卫前也要判它，jsdom 可测） */
  let blindBusy = false;
  /* 昼夜内容分流：day=粒子（日常场景）/ night=星星（真实故事）。
   * 声明在浮窗区（canvas 守卫之前），jsdom 无 canvas 时测试也能切换 */
  let mode = "day";
  window.__setMode = (m) => { mode = m; }; /* 测试注入用 */

  function openStory(item, origin) {
    const dayMode = mode === "day" && !!item.day;
    const d = dayMode ? item.day : item;

    $("story-title").textContent = d.title;
    const personEl = $("story-person");
    if (dayMode) {
      /* 白天：日常没有出处和落款；小纸条给个身份 */
      personEl.hidden = item.kind !== "leaf";
      personEl.textContent = item.kind === "leaf" ? "一张小纸条" : "";
    } else {
      personEl.hidden = false;
      personEl.textContent =
        item.person || item.sub || (item.kind === "leaf" ? "一片小树叶 · 未具名病友的片段" : "");
    }

    $("story-note").hidden = dayMode || !item.note;
    if (!dayMode && item.note) $("story-note").textContent = item.note;

    $("story-body").innerHTML = (dayMode ? d.body : item.body).map((p) => "<p>" + esc(p) + "</p>").join("");

    /* 来源：白天场景是虚构的日常，无出处可挂；真实故事才显示（单 source 或 sources 数组统一渲染） */
    const srcEl = $("story-source");
    if (dayMode) {
      srcEl.hidden = true;
      srcEl.innerHTML = "";
    } else {
      srcEl.hidden = false;
      const list = item.sources || (item.source ? [item.source] : []);
      srcEl.innerHTML =
        '<span class="src-label">来源</span>' +
        list.map((s) =>
          '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' +
          esc(s.media) + "（" + esc(s.year) + "年）</a>"
        ).join("") +
        (item.sourceExtra ? '<span class="src-extra">' + esc(item.sourceExtra) + "</span>" : "");
    }

    /* 开合动画（ease-out 无回弹，2026-11-11 定稿）：详情页从悬停标题中心
     * 放大打开（origin 由 JS 动态设置） */
    if (origin && card) {
      const cr = card.getBoundingClientRect();
      card.style.transformOrigin =
        Math.round(origin.x - cr.left) + "px " + Math.round(origin.y - cr.top) + "px";
    } else if (card) {
      card.style.transformOrigin = "center";
    }

    /* 每次打开从顶部开始读（滚动容器已从 story-card 移到 story-scroll） */
    const sc = $("story-scroll");
    if (sc) sc.scrollTop = 0;

    modal.hidden = false;
    modalOpen = true;
    tf.classList.remove("show");
    requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add("open")));
  }

  function closeModal() {
    if (!modalOpen) return;
    modalOpen = false;
    modal.classList.remove("open");
    setTimeout(() => { modal.hidden = true; }, 540);
  }

  modal.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
  window.__openStory = openStory; /* 测试注入用 */

  /* ---------- 百叶窗 DOM（叶片+梯绳；纯 DOM 操作，供守卫前的首次 buildBlind 使用） ---------- */
  const blind = $("blind");
  const blindPanel = document.querySelector(".blind-panel");
  const pullBtn = $("pull");
  /* 梯绳跟随状态（ropeSync 用）：前段绳↔圆点探针配对，buildBlind 重建后刷新 */
  let ropeParts = null;
  let ropeDirty = false; /* 动画期间写过 transform → 撤类后需清 transform 复位 */
  /* 叶片几何常量（须在首次 buildBlind() 调用前声明，下方会直接执行该调用） */
  const SLAT_H = 24, SLAT_GAP = 5, DOT_Y = SLAT_H / 2; /* DOT_Y=前段绳基准高：叶上缘→穿孔圆点 */

  /* ---------- 粒子系统（昼夜共享同一批锚点） ---------- */
  const canvas = $("canopy");            /* 白天画布 */
  const nightCanvas = $("canopy-night"); /* 黑夜画布 */
  const figDay = $("figure-day");        /* 左下角剪影：白天端坐 */
  const figNight = $("figure-night");    /* 左下角剪影：黑夜趴睡（白） */
  const figZzz = $("figure-zzz");        /* Zzz 符号：贴趴睡右上角，与趴睡同层同呼吸 */
  const ctx = canvas.getContext && canvas.getContext("2d");
  const ctxN = nightCanvas.getContext && nightCanvas.getContext("2d");
  const tf = $("title-float");
  const tfTitle = $("tf-title");
  const tfSub = $("tf-sub");

  /* ---------- 人物心里话弹窗（点击剪影随机一句；DOM 逻辑独立于 canvas，jsdom 可测） ----------
   * 昼夜统一：点白天端坐/黑夜趴睡都弹同一条句子库（whispers.js 三板块全部句子）。
   * 弹窗悬在人物右上角、尖角（左下）指向人物；无遮罩不变暗，
   * 由全屏透明拦截层 #whisper-catch 禁掉拉环/粒子/星星的点击与悬停；
   * 点弹窗外任意处退出（2026-11-12 用户定稿：无叉），退出后可正常操作；
   * 弹窗开着时人物在拦截层之上可点=直接换另一条随机句子（弹窗不重播动画） */
  const whisper = $("whisper");
  const whisperCatch = $("whisper-catch");
  let whisperOpen = false;
  let lastWhisper = -1;

  function pickWhisper() {
    /* 随机一条，永远不与上一条重复（2026-11-12 用户定的规则） */
    let i;
    do { i = Math.floor(Math.random() * WHISPERS.length); }
    while (WHISPERS.length > 1 && i === lastWhisper);
    lastWhisper = i;
    whisper.querySelector(".whisper-text").textContent = WHISPERS[i];
  }

  function placeWhisper() {
    /* 定位：弹窗左下的尖角对准人物头部偏右处（昼夜人物同几何，按当前可见那张算）。
     * 悬停已无 transform（纯变色），rect 无污染，直接读 */
    const fig = document.body.classList.contains("night") ? figNight : figDay;
    const r = fig.getBoundingClientRect();
    /* 尖角中心距弹窗左缘 12px（CSS ::after left:12px 同值）；弹窗底缘离人物头顶留缝。
     * 夜晚趴睡人物矮，弹窗整体上移一点（2026-11-12 用户：夜里往上挪一点点） */
    const TIP = 12;
    const GAP = document.body.classList.contains("night") ? 28 : 12;
    const w = whisper.offsetWidth;
    const left = Math.min(Math.max(8, Math.round(r.left + r.width * 0.58) - TIP),
                          window.innerWidth - w - 8);
    whisper.style.left = left + "px";
    whisper.style.top = "auto";
    whisper.style.bottom = Math.round(window.innerHeight - r.top + GAP) + "px";
  }

  function openWhisper() {
    if (modalOpen) return;
    /* 人物可按性由 CSS pointer-events 全权管理（figure-lock + 昼夜互斥）：
     * 能触发 click 就说明此刻允许弹（正向黑人物一出现即可按，不等 blindBusy 解除） */
    pickWhisper();
    if (whisperOpen) {
      placeWhisper(); /* 已开着：直接换句+按新句宽重定位，不重播弹出动画 */
      return;
    }
    whisper.hidden = false;
    whisperCatch.hidden = false;
    whisperOpen = true;
    document.body.classList.add("whisper-open"); /* CSS：人物提层可点=换句、悬停变色闸关闭 */
    tf.classList.remove("show");                 /* 悬停中的粒子小窗一并撤掉 */
    placeWhisper();
    /* 开启动画与故事弹窗同规则：双 rAF 确保初始态先渲染，再走 420ms ease-out */
    requestAnimationFrame(() => requestAnimationFrame(() => whisper.classList.add("show")));
  }

  function closeWhisper() {
    if (!whisperOpen) return;
    whisperOpen = false;
    document.body.classList.remove("whisper-open");
    whisper.classList.remove("show");
    whisperCatch.hidden = true;  /* 透明层无视觉：立即恢复全站交互 */
    setTimeout(() => { whisper.hidden = true; }, 460);
  }

  whisperCatch.addEventListener("click", closeWhisper);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeWhisper();
  });
  figDay.addEventListener("click", openWhisper);
  figNight.addEventListener("click", openWhisper);
  figZzz.addEventListener("click", openWhisper); /* Zzz 与人物视为同一个东西（2026-11-12 用户定稿） */
  window.__openWhisper = openWhisper;   /* 测试注入用 */
  window.__closeWhisper = closeWhisper;

  buildBlind(); /* 首次生成叶片+梯绳：纯 DOM，无 canvas 依赖（jsdom 也要跑） */
  if (!ctx || !ctxN) return; /* jsdom 等无 canvas 环境：只跑浮窗逻辑 */

  const reducedMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* 物理参数 */
  const SPRING = 7.5;
  const DAMP = 5.2;
  const REPEL_R = 96;
  const REPEL_F = 1050;
  const MAX_DISPLACE_STORY = 44;
  const MAX_DISPLACE_DECO = 52;
  const ANCHOR_CAPTURE = 105;
  const ANCHOR_HOLD = 105;
  const SEL_EASE = 14;
  const AMP = reducedMotion ? 0 : 1.7;

  /* 百叶窗降下后底部白缝（与 CSS --blind-h: 88vh 对应）：白天粒子整体上缩避开 */
  const BLIND_GAP_FRAC = 0.12;

  /* ---------- 左下角剪影禁区：粒子不生成在图上，也不会被鼠标推进图里 ---------- */
  const FIG_BUF = 64; /* 图片几何外扩缓冲 ≥ 最大位移(52)+悬停放大余量 */
  let figZone = null;
  function measureFigure() {
    const r = figDay.getBoundingClientRect();
    /* jsdom/未布局（宽 0）：视为无禁区，不影响测试 */
    figZone = r.width > 20 ? {
      x0: r.left - FIG_BUF, y0: r.top - FIG_BUF,
      x1: r.right + FIG_BUF, y1: r.bottom + FIG_BUF
    } : null;
  }
  const inFigZone = (x, y) =>
    !!figZone && x > figZone.x0 && x < figZone.x1 && y > figZone.y0 && y < figZone.y1;

  let W = 0, H = 0, dpr = 1;
  let particles = [];
  let contentParts = [];
  let anchor = null;
  let sprites = {};       /* 全部贴图：白天 particle-*、黑夜 star-* 与 dust-*，key 区分 */
  const mouse = { x: -9999, y: -9999, active: false };
  let canvasRect = null;

  /* ---------- 贴图预加载：白天圆粒子 / 黑夜五角星 / 夜尘，全部独立 png ---------- */
  function loadSprites(cb) {
    const files = [];
    DAY_COLORS.forEach((c) =>
      files.push({ key: c.key, src: "assets/particle-" + c.key + ".png" }));
    NIGHT_STARS.forEach((s) =>
      files.push({ key: "star-" + s.key, src: "assets/star-" + s.key + ".png" }));
    NIGHT_DUST.forEach((k) =>
      files.push({ key: k, src: "assets/night-" + k + ".png" }));
    let left = files.length;
    files.forEach((f) => {
      const img = new Image();
      img.onload = () => {
        sprites[f.key] = img;
        if (--left === 0) cb();
      };
      img.onerror = () => { if (--left === 0) cb(); };
      img.src = f.src;
    });
  }

  /* ---------- 全屏撒点（底部上缩避开百叶窗白缝） ---------- */
  function makeAnchors(items) {
    const padL = W * 0.07, padR = W * 0.07;
    const padT = 84, padB = H * BLIND_GAP_FRAC + 34; /* 上缩：白缝里不放粒子 */
    const pts = [];
    for (let attempt = 0; attempt < 16 && pts.length < items.length; attempt++) {
      pts.length = 0;
      const md = 64 * Math.pow(0.9, attempt);
      for (let i = 0; i < 9000 && pts.length < items.length; i++) {
        const x = rand(padL, W - padR), y = rand(padT, H - padB);
        if (inFigZone(x, y)) continue; /* 左下角剪影禁区 */
        let ok = true;
        for (const p of pts) {
          if (Math.hypot(p.x - x, p.y - y) < md) { ok = false; break; }
        }
        if (ok) pts.push({ x, y });
      }
    }
    let guard = 24000;
    while (pts.length < items.length && guard-- > 0) {
      const x = rand(padL, W - padR), y = rand(padT, H - padB);
      if (inFigZone(x, y)) continue;
      let ok = true;
      for (const p of pts) {
        if (Math.hypot(p.x - x, p.y - y) < 44) { ok = false; break; }
      }
      if (ok) pts.push({ x, y });
    }
    return pts;
  }

  function buildParticles() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    for (const c of [canvas, nightCanvas]) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctxN.setTransform(dpr, 0, 0, dpr, 0, 0);
    measureFigure(); /* 剪影几何变了（resize），禁区随之更新 */

    particles = []; contentParts = [];

    const items = shuffle(ITEMS.slice());
    const pts = makeAnchors(items);
    const dayPool = shuffle(DAY_COLORS.concat(DAY_COLORS).concat(DAY_COLORS)
      .concat(DAY_COLORS).concat(DAY_COLORS).concat(DAY_COLORS).slice());
    const nightKeys = NIGHT_STARS.map((s) => s.key);
    const nightPool = shuffle(nightKeys.concat(nightKeys).concat(nightKeys)
      .concat(nightKeys).concat(nightKeys).concat(nightKeys).slice());
    items.forEach((item, i) => {
      const pt = pts[i] || { x: W / 2, y: H / 2 };
      /* 星星有大有小：基准随机缩放（白天圆 / 黑夜星各有一套基准，黑夜更醒目） */
      const isStory = item.kind === "story";
      const dayR = Math.round((isStory ? 13 : 10) * rand(0.82, 1.22) * 10) / 10;
      const nightR = Math.round((isStory ? 19 : 15) * rand(0.82, 1.22) * 10) / 10;
      const p = {
        item,
        r: Math.max(dayR, nightR),        /* 物理与间距用大者 */
        dayR, nightR,
        hx: pt.x, hy: pt.y, x: pt.x, y: pt.y, vx: 0, vy: 0,
        dayColor: dayPool[i % dayPool.length].key,
        nightColor: nightPool[i % nightPool.length],
        rot: rand(-0.5, 0.5),             /* 黑夜星的固定随机旋转 */
        phase: rand(0, Math.PI * 2),
        deco: false, selT: 0, selTarget: 0
      };
      particles.push(p); contentParts.push(p);
    });

    /* 装饰小粒子：白天小圆点 / 黑夜微尘，全屏铺满（同样避开底部缝区） */
    const decoN = Math.round(Math.min(170, Math.max(80, (W * H) / 6500)));
    let placed = 0, guard = 0;
    const decoTop = 66, decoBottom = H * BLIND_GAP_FRAC + 18;
    while (placed < decoN && guard++ < decoN * 40) {
      const x = rand(10, W - 10), y = rand(decoTop, H - decoBottom);
      if (inFigZone(x, y)) continue; /* 左下角剪影禁区 */
      const r = guard % 2 ? rand(2.6, 4.8) : rand(2.0, 3.0);
      let ok = true;
      for (const q of particles) {
        if (Math.hypot(q.hx - x, q.hy - y) < q.r + r + 4) { ok = false; break; }
      }
      if (!ok) continue;
      particles.push({
        item: null, r,
        dayR: r, nightR: r * 0.9,
        hx: x, hy: y, x, y, vx: 0, vy: 0,
        dayColor: DAY_COLORS[Math.floor(Math.random() * DAY_COLORS.length)].key,
        nightColor: NIGHT_DUST[guard % 2],
        rot: 0,
        phase: rand(0, Math.PI * 2),
        deco: true, selT: 0, selTarget: 0
      });
      placed++;
    }

    canvasRect = canvas.getBoundingClientRect();
  }

  /* ---------- 百叶窗叶片生成（按视口高度） ---------- */
  function buildBlind() {
    const h = blind.clientHeight || window.innerHeight * 0.88;
    /* 叶片必须正好铺满面板高度：最底一条的底缘贴住面板底缘 h。
     * 之前 floor((h-16)/31) 取整丢余数，叶片只铺到 h-24 左右——
     * 黑叶掀出后底部空一截，吞屏时黑色再往下扩，看起来像百叶窗又降了一点 */
    const slatH = SLAT_H, gap = SLAT_GAP;
    const n = Math.max(6, Math.round(h / (slatH + gap)));
    const step = (h - slatH) / (n - 1);
    let html = "";
    const dotY = DOT_Y; /* 穿孔圆点在叶身垂直中点：绳去除段的长度 = 圆点到下边缘 */
    for (let i = 0; i < n; i++) {
      const top = (i * step).toFixed(2);
      /* 探针×2：圆点探针（与穿孔同心）+ 下缘探针（叶底边），都随叶片旋转——
       * ropeSync 每帧读它们得圆点/下缘的实时投影位置 */
      html += '<div class="slat" style="top:' + top + 'px;height:' + slatH + 'px"><div class="slat-probe l"></div><div class="slat-probe r"></div><div class="slat-probe-b l"></div><div class="slat-probe-b r"></div></div>';
      /* 绳前段：本叶上缘（轴心）→ 圆点。DOM 在本叶之后 = 图层在叶片上面。
       * 静止时是 12px 竖线；叶片翻转期间 ropeSync 每帧把它重写为
       * 「轴心→圆点实时投影位置」的动线段——绳永远连着圆点 */
      html += '<div class="rope-seg front l" style="top:' + top + 'px;height:' + dotY + 'px"></div>';
      html += '<div class="rope-seg front r" style="top:' + top + 'px;height:' + dotY + 'px"></div>';
      if (i < n - 1) {
        /* 绳缝段：本叶下缘 → 下叶上缘，两叶之间常显；与下叶前段在轴心处
         * 首尾相接 → 绳连续。锚点在下叶轴心（固定端），翻转期间由 ropeSync
         * 把顶端实时重写为本叶下缘探针位置——叶翻起来下缘上升，缝里露出的
         * 绳跟着变长，永远连着上下两端 */
        const gt = (i * step + slatH).toFixed(2);
        const gh = (step - slatH).toFixed(2);
        html += '<div class="rope-seg gap l" style="top:' + gt + 'px;height:' + gh + 'px"></div>';
        html += '<div class="rope-seg gap r" style="top:' + gt + 'px;height:' + gh + 'px"></div>';
      }
      /* 圆点 → 本叶下缘：不画绳（去除段，长度=圆点到下边缘 12px）。
       * 这段去除与叶片状态无关——哪怕叶片翻走也始终是空的 */
    }
    html += '<div class="blind-rail"></div>';
    blindPanel.innerHTML = html;
    /* 吞屏高度（v8）：黑叶生长动画的 100% 帧 = scaleY(sy)——轴心在下边缘，
     * 底缘焊死在面板底线上，sy 盖住与上一条的缝（step/slatH）再 +1px 真重叠：
     * 精确临界值会在交界处留 0~0.3px 亚像素透底（面板底 dark 前是米白，
     * 混出灰色发丝线，像素验证实测 rgb 69~87 的横线）；+1px 后交界真重叠，
     * dark 前后都纯黑。顶端多出的 1px：最顶叶伸出面板顶（overflow visible、
     * 视口外），中部叶多盖进上一叶 1px——无感知差异 */
    const sy = Math.max(1, step / slatH) + 1 / slatH;
    blindPanel.style.setProperty("--swallow-sy", sy.toFixed(3));
    /* 收集绳段配对（ropeSync 翻转跟踪用；resize 重建后刷新）：
     * front = 前段绳↔圆点探针（锚段顶=叶轴心，向下延伸）；gap = 缝段绳↔上叶
     * 下缘探针（锚段底=下叶轴心，向上延伸）。基准几何取未变换时的实测 rect
     * （浮点，offsetTop/offsetHeight 会取整到整数造成 ~0.3px 瞄准偏差），
     * 存成面板相对坐标——面板在昼夜间会位移，每帧以当帧面板 rect 平移回视口 */
    ropeParts = [];
    const pr0 = blindPanel.getBoundingClientRect();
    const baseOf = (seg, useBottom) => {
      const r = seg.getBoundingClientRect();
      return {
        cx: r.left + r.width / 2 - pr0.left,
        anchor: (useBottom ? r.bottom : r.top) - pr0.top,
        h: r.height
      };
    };
    const fL = blindPanel.querySelectorAll(".rope-seg.front.l");
    const fR = blindPanel.querySelectorAll(".rope-seg.front.r");
    const pL = blindPanel.querySelectorAll(".slat-probe.l");
    const pR = blindPanel.querySelectorAll(".slat-probe.r");
    for (let i = 0; i < fL.length; i++) {
      ropeParts.push({ kind: "front", seg: fL[i], probe: pL[i], base: baseOf(fL[i], false) });
      ropeParts.push({ kind: "front", seg: fR[i], probe: pR[i], base: baseOf(fR[i], false) });
    }
    const gL = blindPanel.querySelectorAll(".rope-seg.gap.l");
    const gR = blindPanel.querySelectorAll(".rope-seg.gap.r");
    const bL = blindPanel.querySelectorAll(".slat-probe-b.l");
    const bR = blindPanel.querySelectorAll(".slat-probe-b.r");
    for (let i = 0; i < gL.length; i++) {
      ropeParts.push({ kind: "gap", seg: gL[i], probe: bL[i], base: baseOf(gL[i], true) });
      ropeParts.push({ kind: "gap", seg: gR[i], probe: bR[i], base: baseOf(gR[i], true) });
    }
  }

  /* ---------- 梯绳跟随（v6）：叶片「正竖着翻」，绳永远竖直、只随两端伸缩 ----------
   * 正交投影（面板无 perspective）：翻转只产生竖直压缩，轴心原位不动，
   * 圆点/叶下缘只沿竖直线移动（无左右偏移）——连接、显示、变化方式与 v5
   * 完全一致（三段式 + 实时跟随），只是绳不再倾斜：
   * 前段（轴心→圆点）：每帧读圆点探针投影 y，scaleY = 探针距轴心 / 基准高
   *   （圆点升向轴心绳变短，轴心原位不动）。
   * 缝段（上叶下缘→下叶上缘）：锚在下叶轴心（固定端，段底），每帧读上叶
   *   下缘探针投影 y，scaleY = 缝距 / 基准高（叶翻起来下缘上升缝变长）。
   * len 取 abs：θ 越过 90° 时 cos 变负（圆点/下缘投影越过轴心），绳自然缩没
   * 再反向伸出（scaleY 负会镜像绳，必须防）。θ=0 时两者都是恒等变换 */
  function ropeSync() {
    if (!ropeParts) return;
    const cir = blind.classList.contains("circling") || blind.classList.contains("circling-rev");
    if (!cir) {
      if (ropeDirty) { /* 动画类撤掉：清变换回到静态几何（避免残留中途姿态） */
        for (const p of ropeParts) p.seg.style.transform = "";
        ropeDirty = false;
      }
      return;
    }
    const rev = blind.classList.contains("circling-rev");
    /* 正向只在绳可见阶段跟（night-color 隐绳后停写）；反向全程跟——黑叶
     * 阶段虽看不见，但持续更新才能在揭绳瞬间（1470ms 换回白叶）姿态正确 */
    if (!rev && blind.classList.contains("night-color")) return;
    ropeDirty = true;
    const pr = blindPanel.getBoundingClientRect();
    for (const p of ropeParts) {
      const r = p.probe.getBoundingClientRect(); /* 探针投影位置：已是视口绝对坐标 */
      /* 锚点 = 段的固定端（前段=段顶/叶轴心；缝段=段底/下叶轴心）。
       * base 是采集时相对面板的浮点几何，配当帧面板 rect 平移回视口坐标。
       * 正交投影下探针 x ≡ 锚 x（同列、无透视偏移），只取竖直距离 */
      const ay = pr.top + p.base.anchor;
      const len = Math.abs(r.top + r.height / 2 - ay);
      p.seg.style.transform = "scaleY(" + (len / p.base.h).toFixed(4) + ")";
    }
  }

  /* ---------- 昼夜切换状态机 v3 ----------
   * 入夜：降下（白天圆粒子渐隐）→ 白叶整圈翻转变黑叶 → 黑叶匀速长到吞屏
   *   高度（缝的闭合=生长收尾段，全程一场动画）→ 与夜幕同色无缝交接
   *   → 星星浮现 → 拉环归位
   * 回白天：星星渐隐 → 夜幕交还黑叶 → 黑叶反放收拢翻回白叶
   *   → 百叶窗升走 → 白天圆粒子浮现（全程镜像，节奏对称） */
  const T_CIRCLE = 650;
  function toggleBlind() {
    if (blindBusy) return;
    blindBusy = true;
    clearPointer(); /* 粒子即将不可见：悬停锚点与标题浮层立即清空，交互全程失效 */
    if (whisperOpen) closeWhisper();  /* 防御：换幕强制收心里话（正常路径弹窗开着点不了拉环） */
    /* 换幕期间人物整体禁用（2026-11-12 用户定稿）：不能按、无悬停。
     * 解除时机：正向=黑人物浮现那一刻；反向=百叶窗完全翻上去+白天粒子出现（+1540） */
    document.body.classList.add("figure-lock");
    if (mode === "day") {
      /* ---- 入夜 ---- */
      blind.classList.add("lowered");            /* 1) 弹性降下 780ms */
      setTimeout(() => {
        canvas.style.opacity = "0";              /*    白天圆形粒子渐隐 700ms */
        /* 端坐剪影不消失（2026-11-10 用户定稿）：翻转中叶片翻走、后方露出
         * 纸底+端坐黑人，黑叶掀上再盖掉——「黑人物陪伴换幕」是设计的一部分；
         * 直到完整黑背景落定（slats-off）才在黑幕后渐隐（夜幕 z30 恒盖 z1，
         * 渐隐全程藏在黑色里，视觉零察觉） */
      }, 110);
      setTimeout(() => {
        mode = "night";                          /*    画布切夜（星星暂不可见） */
        blind.classList.add("circling");         /* 2) 白叶匀速翻没→隐身→黑叶匀速掀回 650ms linear */
      }, 860);
      setTimeout(() => {
        /* 3) 隐身段换装（keyframes 36%~47% 为隐身窗：叶片高度 0 且 opacity 0，
         *    绝对时刻 860+[1094,1166]ms，取窗中 1130ms）：变黑 + 轴心移到下边缘。
         *    不写进 keyframes——background-color 逐帧动画会强制每帧 repaint，
         *    是翻转卡顿的根源之一；类切换只在不可见瞬间完成一次 */
        blind.classList.add("night-color");
      }, 1130);
      const tExp = 860 + T_CIRCLE + 40;
      setTimeout(() => {
        /* 3) 冻结黑叶姿态（v8：吞屏已并入生长动画——100% 帧即吞屏高度，
         *    缝在生长收尾段匀速闭合，这里只是停住 fill 姿态，无第二段过渡、
         *    无静止帧） */
        blind.classList.add("expanded");
      }, tExp);
      /* 4) dark：生长动画（860+650=1510ms）结束后 20ms 垫黑——缝已闭合，
       *    面板底色瞬变不可见（v8 已证安全，setTimeout 只会晚不会早）。
       *    夜幕 2026-11-11 起无过渡瞬时变黑（它的显隐全程被不透明叶片
       *    盖住，渐显是隐形等待）→ 垫黑后一帧即可揭幕 */
      const tDark = 860 + T_CIRCLE + 20;
      setTimeout(() => {
        blind.classList.add("dark");             /* 5) 夜幕瞬时垫黑（叶片不透明盖住，视觉不变） */
        document.body.classList.add("night");
        pullBtn.setAttribute("aria-label", "收起百叶窗");
      }, tDark);
      setTimeout(() => {
        blind.classList.add("slats-off");        /* 6) 垫黑后一帧即揭幕（tDark+20）：叶片退场
                                                    露出全黑夜幕（接力交接恒黑） */
        figDay.style.opacity = "0";              /*    完整黑背景落定：端坐剪影此刻才走（藏在黑幕下渐隐） */
      }, tDark + 20);
      setTimeout(() => {
        /* 7) 星星与白人从黑幕上完整浮现（2026-11-11 用户定稿）：起点与揭幕
         *    同一时刻——揭幕瞬间亮度为 0，660ms 渐显全程落在可见的黑幕上，
         *    一步不缺（旧版渐显在叶片背面进行被完全遮挡，揭幕时已半亮，
         *    看起来是「瞬间出现」）。速度不变，只是浮现开始得更早 */
        nightCanvas.style.opacity = "1";
        figNight.style.opacity = "1";            /*    趴睡白剪影与星星同步浮现 */
        figZzz.style.opacity = "1";              /*    Zzz 符号同层同步浮现 */
        document.body.classList.remove("figure-lock"); /* 黑人物出现了：此刻起可按（昼张仍被 body.night 互斥禁） */
      }, tDark + 20);
      setTimeout(() => {
        blindBusy = false;                       /* 8) 落定（拉环全程恒在，无需归位步骤） */
      }, tDark + 20 + 660 + 100);
    } else {
      /* ---- 回白天（镜像，v9 2026-11-11 用户定稿「节奏对齐正向 + 去闪烁」）----
       * 核心顺序：星星/人物先在黑幕上完整渐隐（0~660ms，全程可见，和入夜
       * 渐显对称）→ 叶片回归（黑对黑隐形）→ 撤夜幕 → 反向翻回。
       * 正向「降下完→翻转起」隔 80ms；旧版反向「星星消失→反翻起」隔 ~145ms，
       * 中间还夹一次吞屏→基态的条纹闪跳（探针实测 720-805ms avg 16.7→31.6
       * 又跳回）——现在节奏对齐正向且零闪烁 */
      nightCanvas.style.opacity = "0";           /* 1) 星星渐隐 660ms，全程可见（夜幕垫底） */
      figNight.style.opacity = "0";              /*    趴睡白剪影与星星同步渐隐 */
      figZzz.style.opacity = "0";                /*    Zzz 符号同层同步渐隐 */
      document.body.classList.remove("night");
      pullBtn.setAttribute("aria-label", "拉下百叶窗");
      setTimeout(() => {
        /* 2) 渐隐结束（+10ms 余量）点亮黑叶：黑叶本就处于吞屏态盖满面板，
         *    点亮（opacity 0→1）落在夜幕黑上——黑对黑，collapse 的
         *    transition:none 让它一帧完成，画面零变化 */
        blind.classList.remove("slats-off");
        blind.classList.add("collapse");
      }, 670);
      setTimeout(() => {
        /* 3) 叶片已瞬时全不透明且吞屏缝闭合，此刻才撤夜幕（瞬时撤除全程
         *    藏在不透明叶片后）。铁律：撤 dark 必须晚于叶片完全不透明，
         *    否则纸底会从底下透出来（实测均亮骤升的「闪」） */
        blind.classList.remove("dark");
        blind.classList.remove("circling");
        blind.classList.remove("collapse");
        /* 端坐剪影同步渐显回来（镜像入夜「陪伴换幕」：反翻透出的纸底上
         * 他渐显就位） */
        figDay.style.opacity = "1";
        requestAnimationFrame(() => requestAnimationFrame(() => {
          /* 撤吞屏冻结必须与加反向动画同一帧：expanded 基态是缝隙全开的
           * 归位态，先撤再加会在反放起播前闪出米白条纹再跳回吞屏；同帧
           * 切换则动画首帧=100% 吞屏姿态=当前画面，无缝进入反放。
           * circling 同名动画重启铁律不变（先撤提交、再启全新反向） */
          blind.classList.remove("expanded");
          blind.classList.add("circling-rev");
          /* 反放起播=此帧，后续全部相对起播排程（免疫 rAF 抖动）：
           * 隐身窗=倒放 53%~64%（+344~+416ms）→ +377 居中换白；
           * +670 动画结束(650)+20 叶片升走；+730 白天画布恢复；
           * +1540 解锁（升走 780 + 90 余量） */
          setTimeout(() => blind.classList.remove("night-color"), 377);
          setTimeout(() => {
            blind.classList.remove("circling-rev"); /* 白叶就位（反向 fill=0% 白叶态） */
            blind.classList.remove("circling");     /* 正向类一并清掉：基态同为白叶无跳变；
                                                       否则正向 fill 会把黑叶态留到白天 */
            blind.classList.remove("lowered");      /* 百叶窗升走 780ms */
          }, 670);
          setTimeout(() => {
            mode = "day";                           /* 白天画布恢复绘制 */
            canvas.style.opacity = "1";             /* 白天圆形粒子浮现 700ms（端坐剪影已先行渐显） */
          }, 730);
          setTimeout(() => {
            blindBusy = false;
            /* 百叶窗已完全翻上去、白天粒子已浮现（+730 起 700ms 渐显）：
             * 端坐剪影此刻才恢复可按（2026-11-12 用户定稿） */
            document.body.classList.remove("figure-lock");
          }, 1540);
        }));
      }, 700);
    }
  }
  pullBtn.addEventListener("click", toggleBlind);
  /* headless 截图/测试用：直接跳到昼夜终态（类名与 toggleBlind 终态一致，不播动画） */
  window.__forceNight = (on) => {
    mode = on ? "night" : "day";
    blind.classList.toggle("lowered", on);
    blind.classList.toggle("circling", false);
    blind.classList.toggle("circling-rev", false);
    blind.classList.toggle("night-color", on);
    blind.classList.toggle("expanded", on);
    blind.classList.toggle("dark", on);
    blind.classList.toggle("slats-off", on);
    nightCanvas.style.opacity = on ? "1" : "0";
    canvas.style.opacity = on ? "0" : "1";
    figNight.style.opacity = on ? "1" : "0";
    figZzz.style.opacity = on ? "1" : "0";
    figDay.style.opacity = on ? "0" : "1";
    document.body.classList.toggle("night", on);
  };
  /* 测试/验证用：读内容粒子锚点（item id + 原位坐标）。昼夜共用同一数组，
   * 白天两次读取、昼夜各读一次结果都必须完全一致——位置对应的结构保证 */
  window.__anchors = () => contentParts.map((p) => ({
    id: p.item.id, x: Math.round(p.hx), y: Math.round(p.hy)
  }));
  /* 测试/验证用：只读贴图表（key → Image/canvas），验证贴图加载与像素颜色 */
  window.__sprites = () => sprites;

  /* ---------- 交互（两个画布共用同一套 handler，位置完全重合） ---------- */
  /* 悬停态清空：指针离开画布或换幕开始时调用——锚点、标题浮层一并撤掉 */
  function clearPointer() {
    mouse.active = false;
    mouse.x = -9999; mouse.y = -9999;
    if (anchor) { anchor.selTarget = 0; anchor = null; }
    tf.classList.remove("show");
  }
  function bindPointer(c) {
    c.addEventListener("pointermove", (e) => {
      const r = canvasRect || canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
      mouse.active = true;
    });
    c.addEventListener("pointerleave", clearPointer);
    c.addEventListener("pointerdown", (e) => {
      if (blindBusy) return; /* 换幕期间粒子不可见：点击一律无效，防止看不见的故事被误弹 */
      const r = canvasRect || canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
      mouse.active = true;
      /* 粒子命中：按原位判定，用户瞄准的仍是"看起来在那"的那颗 */
      if (anchor && Math.hypot(anchor.hx - mouse.x, anchor.hy - mouse.y) < Math.max(52, anchor.r * 3)) {
        openStory(anchor.item, {
          x: r.left + anchor.x,
          y: r.top + anchor.y - anchor.r - 34
        });
      }
    });
  }
  bindPointer(canvas);
  bindPointer(nightCanvas);

  function updateAnchor() {
    /* blindBusy：换幕期间粒子/星星不可见——不捕获锚点（悬停标题与点击弹故事随之失效） */
    if (!mouse.active || modalOpen || whisperOpen || blindBusy) {
      if (anchor) anchor.selTarget = 0;
      anchor = null;
      return;
    }
    if (anchor && anchor.selTarget === 1) {
      const dCur = Math.hypot(anchor.hx - mouse.x, anchor.hy - mouse.y);
      if (dCur < ANCHOR_HOLD) {
        /* 粘滞区内：另一颗明显更近（近 28% 以上）就切换 */
        let best = null, bestD = dCur;
        for (const p of contentParts) {
          const d = Math.hypot(p.hx - mouse.x, p.hy - mouse.y);
          if (d < bestD * 0.72) { bestD = d; best = p; }
        }
        if (best) {
          anchor.selTarget = 0;
          anchor = best;
          anchor.selTarget = 1;
        }
        return;
      }
      anchor.selTarget = 0;
      anchor = null;
    }
    let best = null, bestD = ANCHOR_CAPTURE;
    for (const p of contentParts) {
      const d = Math.hypot(p.hx - mouse.x, p.hy - mouse.y);
      if (d < bestD) { bestD = d; best = p; }
    }
    if (best && best !== anchor) {
      if (anchor) anchor.selTarget = 0;
      anchor = best;
      anchor.selTarget = 1;
    }
  }

  function updateTitleFloat() {
    if (anchor && !modalOpen && !whisperOpen) {
      const it = anchor.item;
      const dayMode = mode === "day" && !!it.day;
      tfTitle.textContent = dayMode ? it.day.title : it.title;
      tfSub.textContent = dayMode
        ? (it.kind === "leaf" ? "一张小纸条" : "")
        : (it.kind === "leaf" ? "一片小树叶" : it.person);
      const r = canvasRect || canvas.getBoundingClientRect();
      const gap = 12;
      const h = tf.offsetHeight || 58;
      const half = tf.offsetWidth / 2 || 120;
      const tipX = r.left + anchor.x;
      const tipY = r.top + anchor.y - anchor.r * 1.25;
      let top = tipY - gap - h;
      if (top < 8) {
        top = r.top + anchor.y + anchor.r * 1.25 + gap;
        tf.classList.add("below");
      } else {
        tf.classList.remove("below");
      }
      /* 定位一律取整 px（2026-11-11 用户反馈「行间距颤抖」）：浮层随粒子逐帧
       * 移动时，半像素偏移会让文字每帧亚像素渲染都不一样=行间距看着在抖；
       * 整数定位让每一帧的文字都清晰稳定。水平居中由 JS 直接算出左上角
       * （CSS 不再用 translate(-50%)，那正是负半像素位移的来源） */
      tf.style.left = Math.round(Math.min(Math.max(tipX, half + 8), window.innerWidth - half - 8) - half) + "px";
      tf.style.top = Math.round(top) + "px";
      tf.classList.add("show");
      return;
    }
    tf.classList.remove("show");
  }

  /* ---------- 主循环 ---------- */
  let last = 0;
  function frame(t) {
    const dt = Math.min((t - last) / 1000 || 0.016, 0.033);
    last = t;
    updateAnchor();

    /* 换幕动画期间两块画布都不可见/近乎透明——跳过清屏和绘制，
     * 把主线程整个让给 CSS 3D 翻转；逐帧粒子绘制抢帧会让翻转一卡一卡 */
    const dayVis = parseFloat(getComputedStyle(canvas).opacity) > 0.02;
    const nightVis = parseFloat(getComputedStyle(nightCanvas).opacity) > 0.02;
    if (dayVis) ctx.clearRect(0, 0, W, H);
    if (nightVis) ctxN.clearRect(0, 0, W, H);

    /* 物理更新（两个模式共用一套粒子状态） */
    for (const p of particles) {
      const st = p.selTarget || 0;
      p.selT += (st - p.selT) * Math.min(1, dt * SEL_EASE);
      if (p.selT < 0.001) p.selT = 0;

      const fx = AMP ? Math.sin(t * 0.00045 + p.phase) * AMP : 0;
      const fy = AMP ? Math.cos(t * 0.00038 + p.phase * 1.3) * AMP : 0;
      const dampF = Math.exp(-DAMP * dt);

      if (p.selTarget === 1 && p.selT > 0.02) {
        const tx = p.hx + fx * 1.6, ty = p.hy + fy * 1.6;
        p.vx = (p.vx + (tx - p.x) * SPRING * 1.7 * dt) * dampF;
        p.vy = (p.vy + (ty - p.y) * SPRING * 1.7 * dt) * dampF;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.fx = fx * 1.6; p.fy = fy * 1.6;
      } else {
        let ax = (p.hx - p.x) * SPRING;
        let ay = (p.hy - p.y) * SPRING;
        const dxh = p.x - p.hx, dyh = p.y - p.hy;
        const dh = Math.hypot(dxh, dyh);
        const maxD = p.deco ? MAX_DISPLACE_DECO : MAX_DISPLACE_STORY;
        if (dh > maxD) {
          const over = (dh - maxD) / maxD;
          ax -= (dxh / dh) * over * over * 2600;
          ay -= (dyh / dh) * over * over * 2600;
        }
        if (mouse.active && !modalOpen) {
          const dx = p.x - mouse.x, dy = p.y - mouse.y;
          const d = Math.hypot(dx, dy);
          if (d < REPEL_R && d > 0.001) {
            const f = Math.pow(1 - d / REPEL_R, 2) * REPEL_F;
            ax += (dx / d) * f; ay += (dy / d) * f;
          }
        }
        p.vx = (p.vx + ax * dt) * dampF;
        p.vy = (p.vy + ay * dt) * dampF;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.fx = fx; p.fy = fy;
      }
    }

    /* 绘制：当前模式的画布只在该画布实际可见时才画（换幕期间自动让路） */
    const g = mode === "day" ? ctx : ctxN;
    const gVis = mode === "day" ? dayVis : nightVis;
    if (gVis) {
      for (const p of particles) drawParticle(g, p, t);
      if (anchor && anchor.selT > 0.02) drawParticle(g, anchor, t);
    }

    ropeSync(); /* 梯绳跟随：翻转期间绳末端实时连着穿孔圆点 */
    updateTitleFloat();
    requestAnimationFrame(frame);
  }

  function drawParticle(c, p, t) {
    /* 选中放大收敛到约 1.22 倍 + 轻微呼吸（之前 2.3 倍膨胀会显得恶心） */
    const breathe = p.selT > 0 ? Math.sin(t * 0.003 + p.phase) * 0.02 : 0;
    const scale = 1 + p.selT * (0.22 + breathe);
    const x = p.x + (p.fx || 0), y = p.y + (p.fy || 0);

    if (mode === "day") {
      /* 白天：圆形贴图（大小随机，无旋转） */
      const r = p.dayR * scale;
      const spr = sprites[p.dayColor];
      if (spr) {
        if (p.deco) c.globalAlpha = 0.88;
        else c.globalAlpha = 0.8 + 0.2 * Math.min(1, p.selT + 0.2);
        c.drawImage(spr, x - r, y - r, r * 2, r * 2);
        c.globalAlpha = 1;
      } else {
        c.fillStyle = p.dayColor === "bubble" ? "#E41E71" : "#F15961";
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        c.fill();
      }
    } else if (p.deco) {
      /* 黑夜微尘：小圆点贴图（png 圆直径=边长 0.72） */
      const spr = sprites[p.nightColor];
      const r = p.nightR * scale;
      if (spr) {
        c.globalAlpha = 0.8;
        const half = r * 1.39;
        c.drawImage(spr, x - half, y - half, half * 2, half * 2);
        c.globalAlpha = 1;
      }
    } else {
      /* 黑夜：五角星贴图（独立 png，星直径=边长一半，固定随机旋转） */
      const spr = sprites["star-" + p.nightColor];
      const r = p.nightR * scale;
      if (spr) {
        c.globalAlpha = 0.92 + 0.08 * Math.min(1, p.selT + 0.2);
        c.save();
        c.translate(x, y);
        c.rotate(p.rot);
        const half = r * 2;
        c.drawImage(spr, -half, -half, half * 2, half * 2);
        c.restore();
        c.globalAlpha = 1;
      } else {
        c.fillStyle = "#F7F3E3";
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        c.fill();
      }
    }
  }

  /* ---------- 启动 ---------- */
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      buildBlind();      /* 叶片数量随视口重排 */
      buildParticles();  /* 全屏分布按新视口重撒 */
    }, 180);
  });

  loadSprites(() => {
    buildParticles();
    requestAnimationFrame(frame);
  });
})();
