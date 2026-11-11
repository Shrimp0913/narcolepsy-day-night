/* 发作性睡病 · 树根系（程序化 SVG · 几何拼贴版 v3.3 主根+子分支）
 * 设计约束（用户 2026-10-28/29 指定）：
 * 1. 根从树干底边「完美连接」长出——顶部不伸进树干图里（树干实体底 = 容器 59.655%，
 *    CSS .stage-roots 的 top 与之对齐，y=0 即树干底边线）；
 * 2. 主干底部实测只有约 25 显示px 宽，8 条根挤不下 → 树干底下接一个「根台」
 *    （拼贴梯形块，属于根系基部，贴住树干底边），8 条根从根台底边散开；
 * 3. 所有根系互不接触（主根之间、主根与子分支、子分支之间）——测试逐点断言；
 * 4. 主根中途分出子分支（用户：分支也是树根，一直显示）——思维导图层级：
 *    主根 = 大主题，子分支 = 二级要点，子分支短、细、下垂；
 * 5. 深度分层错落，要往下、要长；左右次序全程保持；
 * 6. 画风 = 几何拼接：主根沿中心线切成不等长四边形块，块间留细缝、
 *    节点法向抖动、五色板内做明暗变化（固定种子，每次渲染一致）。
 *
 * 坐标系：根区容器恒为 8:9，SVG viewBox 480x540 等比缩放，构建不依赖布局尺寸。
 * 标签（圆点+分支名）用 HTML 绝对定位，字号恒定；子分支挂小号二级主题标签。
 * 命中检测由 app.js 用 build() 导出的中心线折线在虚拟坐标系里做几何判定。 */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var VBW = 480, VBH = 540;

  /* 固定种子随机数（mulberry32）：拼贴块的长度/抖动/配色每次渲染完全一致 */
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* 拼贴色板：围绕底色 #2D3350 的明度阶梯（暗块/亮块差要够大才看得出拼接），
   * gray 少量、carolina 稀疏点缀 */
  var PALETTE = [
    { c: "#1F2438", p: 0.38 },
    { c: "#3D4A6B", p: 0.72 },
    { c: "#2D3350", p: 0.88 },
    { c: "#8795A5", p: 0.96 },
    { c: "#70B0CC", p: 1.00 }
  ];
  function pickColor(rng) {
    var r = rng();
    for (var i = 0; i < PALETTE.length; i++) if (r < PALETTE[i].p) return PALETTE[i].c;
    return PALETTE[0].c;
  }

  /* 布线表（根区归一化坐标：x∈[0,1] 右为正、y∈[0,1] 下为正）。
   * y=0.062 的起点藏在根台后面，可见起点 = 根台底边（y≈34~38 虚拟px）。
   * wneck = 根须起点宽（细），钻出根台后快速长粗到 w0，再锥形收窄到 w1。
   * 起点从根台底边散开（x 0.412~0.588，相邻间隔 ≥ 10 虚拟px > 半宽和 + 缝）。
   * branches = 子分支表：at=主根弧长位置(0~1)、side=分出侧(+1右/-1左)、
   *            ang=初始偏转角(弧度)、len=长度(虚拟px)、droop=下垂偏转(弧度)。
   * 子分支短、细、下垂，不越过与邻根的中线——互不接触由测试逐点保证。 */
  var GEOM = [
    { pts: [[0.377, .062], [0.321, .11], [0.242, .23], [0.181, .40], [0.119, .56]],  wneck: 5, w0: 18, w1: 6.5,   /* 它是什么 */
      branches: [
        { at: .55, side: -1, ang: .70, len: 58, droop: .70 },
        { at: .80, side: -1, ang: .85, len: 48, droop: .72 }
      ] },
    { pts: [[0.426, .062], [0.354, .15], [0.293, .32], [0.259, .58], [0.226, .83]], wneck: 5, w0: 22, w1: 7.5,  /* 五联症 */
      branches: [
        { at: .50, side: -1, ang: .48, len: 60, droop: .78 },
        { at: .74, side: 1,  ang: .52, len: 55, droop: .80 }
      ] },
    { pts: [[0.457, .062], [0.410, .145], [0.366, .24], [0.338, .36], [0.326, .48]], wneck: 5, w0: 17, w1: 6.5,  /* 病因之谜 */
      branches: [
        { at: .48, side: 1,  ang: .55, len: 46, droop: .80 },
        { at: .74, side: 1,  ang: .55, len: 50, droop: .80 }
      ] },
    { pts: [[0.480, .062], [0.455, .20], [0.442, .40], [0.435, .64], [0.427, .87]], wneck: 5, w0: 23, w1: 7.5,  /* 数字里的病 */
      branches: [
        { at: .48, side: -1, ang: .42, len: 55, droop: .85 },
        { at: .74, side: 1,  ang: .42, len: 50, droop: .85 }
      ] },
    { pts: [[0.511, .062], [0.548, .16], [0.567, .34], [0.565, .52], [0.571, .66]],  wneck: 5, w0: 16, w1: 6.5,   /* 诊断之路 */
      branches: [
        { at: .50, side: 1,  ang: .62, len: 55, droop: .78 },
        { at: .76, side: -1, ang: .48, len: 50, droop: .82 }
      ] },
    { pts: [[0.543, .062], [0.599, .15], [0.651, .34], [0.677, .62], [0.681, .82]], wneck: 5, w0: 20, w1: 7.5,  /* 危险与生活影响 */
      branches: [
        { at: .50, side: 1,  ang: .58, len: 55, droop: .78 },
        { at: .74, side: -1, ang: .45, len: 50, droop: .85 }
      ] },
    { pts: [[0.574, .062], [0.655, .14], [0.709, .26], [0.760, .40], [0.788, .50]], wneck: 5, w0: 18, w1: 6.5,  /* 治疗与中国现实 */
      branches: [
        { at: .52, side: -1, ang: .52, len: 52, droop: .80 },
        { at: .78, side: 1,  ang: .65, len: 55, droop: .75 }
      ] },
    { pts: [[0.605, .062], [0.711, .13], [0.788, .30], [0.860, .50], [0.893, .70]], wneck: 5, w0: 19, w1: 6.5,  /* 科学进程 */
      branches: [
        { at: .52, side: 1,  ang: .75, len: 58, droop: .68 },
        { at: .78, side: 1,  ang: .88, len: 50, droop: .72 }
      ] }
  ];

  /* 子分支控制点：从主根节点 N 沿切向偏转出枝，两段下垂弯到末端。
   * 屏幕 y 向下 → rot 正角 = 视觉顺时针 = 把「向下」向量转向左。
   * side=+1 意为向 x 正方向（右）分出 → 初始偏转用 -side*ang；
   * 下垂（转回更垂直）用 +side*droop。 */
  function branchPts(N, b) {
    function rot(dx, dy, th) {
      var c = Math.cos(th), s = Math.sin(th);
      return [dx * c - dy * s, dx * s + dy * c];
    }
    var d1 = rot(N.tx, N.ty, -b.side * b.ang);
    var p0 = [N.x, N.y];
    var p1 = [N.x + d1[0] * b.len * 0.40, N.y + d1[1] * b.len * 0.40];
    var d2 = rot(d1[0], d1[1], b.side * (b.droop || 0.9));
    var p2 = [p1[0] + d2[0] * b.len * 0.33, p1[1] + d2[1] * b.len * 0.33];
    /* 末端压向下方（x 只留小分量），像真根的垂梢 */
    var d3 = [d2[0] * 0.35 + b.side * 0.10, d2[1] * 0.35 + 1];
    var d3l = Math.hypot(d3[0], d3[1]) || 1;
    var p3 = [p2[0] + d3[0] / d3l * b.len * 0.27, p2[1] + d3[1] / d3l * b.len * 0.27];
    return [p0, p1, p2, p3];
  }

  /* Catmull-Rom 平滑：每段控制点间插 seg 个采样点 */
  function crPoint(p0, p1, p2, p3, t) {
    var t2 = t * t, t3 = t2 * t;
    return [
      0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
      0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
    ];
  }
  function sampleLine(pts, seg) {
    var out = [], P = [pts[0]].concat(pts).concat([pts[pts.length - 1]]);
    for (var i = 1; i < P.length - 2; i++)
      for (var j = 0; j < seg; j++)
        out.push(crPoint(P[i - 1], P[i], P[i + 1], P[i + 2], j / seg));
    var last = pts[pts.length - 1];
    out.push([last[0], last[1]]);
    return out;
  }

  /* 宽度包络（三段）：根须 wneck → 前 22% 弧长才长粗到 w0（细须先钻出根台、
   * 散开够了再长壮——这样涨粗期相邻根早已拉开间距）→ 锥形收窄到 w1 */
  function widthAt(t, g) {
    var wneck = g.wneck || 6, w0 = g.w0, w1 = g.w1;
    if (t <= 0.22) return wneck + (w0 - wneck) * (t / 0.22);
    var u = (t - 0.22) / 0.78;
    return w1 + (w0 - w1) * Math.pow(1 - u, 2.2);
  }

  /* 节点结构：中心点（虚拟坐标）+ 单位切向 + 半宽。供分块与命中共用 */
  function nodesOf(sm, g) {
    var n = sm.length, nodes = [];
    for (var i = 0; i < n; i++) {
      var a = sm[Math.max(0, i - 1)], b = sm[Math.min(n - 1, i + 1)];
      var dx = (b[0] - a[0]) * VBW, dy = (b[1] - a[1]) * VBH;
      var len = Math.hypot(dx, dy) || 1;
      var t = i / (n - 1);
      nodes.push({
        x: sm[i][0] * VBW, y: sm[i][1] * VBH,
        tx: dx / len, ty: dy / len,
        hw: widthAt(t, g) / 2, t: t
      });
    }
    return nodes;
  }

  /* 子分支节点（虚拟坐标输入）：细锥形 bw0 → bw1，pow 锥形收窄 */
  function nodesOfVirtual(sm, bw0, bw1) {
    var n = sm.length, nodes = [];
    for (var i = 0; i < n; i++) {
      var a = sm[Math.max(0, i - 1)], b = sm[Math.min(n - 1, i + 1)];
      var dx = b[0] - a[0], dy = b[1] - a[1];
      var len = Math.hypot(dx, dy) || 1;
      var t = i / (n - 1);
      nodes.push({
        x: sm[i][0], y: sm[i][1],
        tx: dx / len, ty: dy / len,
        hw: (bw0 + (bw1 - bw0) * Math.pow(t, 1.3)) / 2, t: t
      });
    }
    return nodes;
  }

  /* 连续锥形底 path：沿节点法向偏移半宽，左右轮廓拼合。
   * 拼贴块的衬底——块间缝露的是深底而不是纸底（贴合树干画风的色块拼接）。 */
  function taperPath(nodes) {
    var L = [], R = [];
    nodes.forEach(function (N) {
      L.push((N.x - N.ty * N.hw).toFixed(1) + " " + (N.y + N.tx * N.hw).toFixed(1));
      R.push((N.x + N.ty * N.hw).toFixed(1) + " " + (N.y - N.tx * N.hw).toFixed(1));
    });
    return "M" + L.join("L") + "L" + R.reverse().join("L") + "Z";
  }

  /* 几何拼贴：沿中心线按弧长切成不等长四边形块，叠在锥形底上。
   * 块间缝细（≤1.2 虚拟px，露深底不露纸底）、节点抖动随根宽等比（±12%）。
   * 返回 [{ d, fill }, ...] —— 每块一个闭合 path。 */
  var GAP = 2.4, JIT = 0.12;
  function buildBlocks(nodes, rng) {
    var blocks = [], i = 0;
    while (i < nodes.length - 1) {
      /* 目标块长（虚拟px）：变化大（14~38），起点附近块更短更碎（根台拼接密度感） */
      var target = (nodes[i].t < 0.12 ? rng() * 10 + 12 : rng() * 18 + 14);
      var j = i + 1, acc = 0;
      while (j < nodes.length - 1) {
        acc += Math.hypot(nodes[j].x - nodes[j - 1].x, nodes[j].y - nodes[j - 1].y);
        if (acc >= target) break;
        j++;
      }
      if (j >= nodes.length - 1 && blocks.length > 0) j = nodes.length - 1; /* 收尾并块 */
      var A = nodes[i], B = nodes[j];
      /* 一半块无缝撞色（靠色差分块），一半块留细缝 */
      var seam = rng() < 0.5;
      var gapA = i === 0 || !seam ? 0 : Math.min(GAP / 2, A.hw * 0.35);
      var gapB = j === nodes.length - 1 || !seam ? 0 : Math.min(GAP / 2, B.hw * 0.35);
      var jitA = 1 + (rng() * 2 - 1) * JIT, jitB = 1 + (rng() * 2 - 1) * JIT;
      var offA = (rng() * 2 - 1) * JIT, offB = (rng() * 2 - 1) * JIT;
      function corner(N, s, side, jit, off) {
        var hw = N.hw * jit;
        return (N.x + N.tx * s + N.ty * side * hw + (-N.ty) * off * hw).toFixed(1) + " " +
               (N.y + N.ty * s + (-N.tx) * side * hw + N.tx * off * hw).toFixed(1);
      }
      var d = "M" + corner(A, gapA, -1, jitA, offA) + "L" + corner(B, -gapB, -1, jitB, offB) +
              "L" + corner(B, -gapB, 1, jitB, offB) + "L" + corner(A, gapA, 1, jitA, offA) + "Z";
      blocks.push({ d: d, fill: pickColor(rng) });
      i = j;
    }
    return blocks;
  }

  /* 根台：树干底边下的积木式基座（拼贴三块：上块贴主干、左右块向两侧错落探出）。
   * 主干底部实测 ≈ 38 虚拟px 宽（图内 96/991），上块顶宽 46 贴住主干底边；
   * 底部展开到 ~120 虚拟px，8 条根的起点段（y=33.5）画在基座下被盖住 → 从台底钻出。 */
  function buildCollar(svg, rng) {
    var pieces = [
      /* 左块：顶藏在树干/上块后，底向左探出 */
      { d: "M213 10L223 10L232 38L180 38Z", c: pickColor(rng) },
      /* 右块：对称 */
      { d: "M257 10L267 10L300 38L248 38Z", c: pickColor(rng) },
      /* 上块：贴主干底边（y=0），最深（底 y=42） */
      { d: "M217 0L263 0L275 42L209 42Z", c: "#2D3350" }
    ];
    pieces.forEach(function (pc) {
      var p = document.createElementNS(NS, "path");
      p.setAttribute("d", pc.d);
      p.setAttribute("fill", pc.c);
      p.setAttribute("class", "root-collar");
      svg.appendChild(p);
    });
    /* 一小块 carolina 点缀（拼贴补丁），贴在上块右肩 */
    var patch = document.createElementNS(NS, "path");
    patch.setAttribute("d", "M250 7L262 7L264 20L252 20Z");
    patch.setAttribute("fill", "#70B0CC");
    patch.setAttribute("class", "root-collar");
    svg.appendChild(patch);
  }

  /* 子分支宽度：起点 5.5 → 末端 1.6 虚拟px（细于主根，视觉层级低一级） */
  var SUB_W0 = 8.5, SUB_W1 = 2.2;

  /* 构建。返回 { els, segments, labels }：
   * els[i]      = 主根 i 的所有元素平铺数组（锥形底/拼贴块/子分支/标签们）
   * segments[]  = 所有折线（主根+子分支）：{ xs, ys, hw, root } —— root=所属主根索引，
   *               命中检测按 root 映射回主根交互
   * labels[i]   = 主根标签点 { nx, ny }（openStory 弹性动画 origin 用） */
  function build(wrap, roots) {
    wrap.innerHTML = "";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 " + VBW + " " + VBH);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("aria-label", "树根系：八大科学知识分支");

    var rng = mulberry32(20261029);
    var els = [], segments = [], labels = [];
    roots.forEach(function (root, i) {
      var g = GEOM[i] || GEOM[0];
      var sm = sampleLine(g.pts, 12);
      var nodes = nodesOf(sm, g);

      var elsRow = [];
      /* 连续锥形底（根轮廓完整，块缝不露纸底） */
      var base = document.createElementNS(NS, "path");
      base.setAttribute("d", taperPath(nodes));
      base.setAttribute("fill", "#2D3350");
      base.setAttribute("class", "root-path");
      svg.appendChild(base);
      elsRow.push(base);
      /* 拼贴块叠底（明度差 = 拼贴感） */
      buildBlocks(nodes, rng).forEach(function (b) {
        var path = document.createElementNS(NS, "path");
        path.setAttribute("d", b.d);
        path.setAttribute("fill", b.fill);
        path.setAttribute("class", "root-path");
        svg.appendChild(path);
        elsRow.push(path);
      });

      var xs = [], ys = [], hw = [];
      nodes.forEach(function (nd) { xs.push(nd.x); ys.push(nd.y); hw.push(nd.hw); });
      segments.push({ xs: xs, ys: ys, hw: hw, root: i });

      /* ---- 子分支：真树根的分叉 = 思维导图二级要点 ---- */
      (root.subs || []).forEach(function (subName, bi) {
        var b = (g.branches || [])[bi];
        if (!b) return;
        var idx = Math.round(b.at * (nodes.length - 1));
        var N = nodes[Math.max(1, Math.min(nodes.length - 2, idx))];
        var bsm = sampleLine(branchPts(N, b), 9);
        var bnodes = nodesOfVirtual(bsm, SUB_W0, SUB_W1);

        var bbase = document.createElementNS(NS, "path");
        bbase.setAttribute("d", taperPath(bnodes));
        bbase.setAttribute("fill", "#2D3350");
        bbase.setAttribute("class", "root-path root-branch");
        svg.appendChild(bbase);
        elsRow.push(bbase);
        buildBlocks(bnodes, rng).forEach(function (blk) {
          var bp = document.createElementNS(NS, "path");
          bp.setAttribute("d", blk.d);
          bp.setAttribute("fill", blk.fill);
          bp.setAttribute("class", "root-path root-branch");
          svg.appendChild(bp);
          elsRow.push(bp);
        });

        var bxs = [], bys = [], bhw = [];
        bnodes.forEach(function (nd) { bxs.push(nd.x); bys.push(nd.y); bhw.push(nd.hw); });
        segments.push({ xs: bxs, ys: bys, hw: bhw, root: i });

        /* 子分支小标签：末端沿末段方向外延 16 虚拟px（小圆点+二级主题名） */
        var bm = bnodes.length, be = bnodes[bm - 1], bpe = bnodes[bm - 2];
        var bdx = be.x - bpe.x, bdy = be.y - bpe.y;
        var bdl = Math.hypot(bdx, bdy) || 1;
        var stag = document.createElement("div");
        stag.className = "root-subtag";
        stag.style.left = ((be.x + bdx / bdl * 16) / VBW * 100).toFixed(2) + "%";
        stag.style.top = ((be.y + bdy / bdl * 16) / VBH * 100).toFixed(2) + "%";
        var sdot = document.createElement("i");
        sdot.className = "root-subdot";
        stag.appendChild(sdot);
        stag.appendChild(document.createTextNode(subName));
        wrap.appendChild(stag);
        elsRow.push(stag);
      });

      /* 标签点：末端沿末段方向外延 14 虚拟px（虚拟空间算方向，归一化比例不能混用） */
      var m = nodes.length, e = nodes[m - 1], pe = nodes[m - 2];
      var ddx = e.x - pe.x, ddy = e.y - pe.y;
      var dl = Math.hypot(ddx, ddy) || 1;
      var lx = e.x + (ddx / dl) * 14, ly = e.y + (ddy / dl) * 14;
      var tag = document.createElement("div");
      tag.className = "root-tag";
      tag.style.left = (lx / VBW * 100).toFixed(2) + "%";
      tag.style.top = (ly / VBH * 100).toFixed(2) + "%";
      var dot = document.createElement("i");
      dot.className = "root-dot";
      var label = document.createElement("span");
      label.className = "root-label";
      label.textContent = root.title;
      tag.appendChild(dot);
      tag.appendChild(label);
      wrap.appendChild(tag);
      elsRow.push(tag);
      els.push(elsRow);
      labels.push({ nx: lx / VBW, ny: ly / VBH });
    });

    /* 根台最后画：盖住 8 条主根的起点段（y<38 虚拟px），根从台底边「钻出」 */
    buildCollar(svg, rng);

    wrap.appendChild(svg);
    return { els: els, segments: segments, labels: labels, w: VBW, h: VBH };
  }

  window.RootTree = { GEOM: GEOM, sampleLine: sampleLine, widthAt: widthAt, build: build, VBW: VBW, VBH: VBH };
})();
