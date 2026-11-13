# 把手绘 Zzz 源图矢量化成自适应主题 SVG favicon（同 Shrimp's Alchemy 模式）
# 流程：阈值提取白描边 → 形态学闭合封断口 → floodfill 填实 → 外轮廓 → SVG path
# 输出: assets/favicon.svg —— 默认 fill 纯黑 #000000，dark 媒体查询纯白 #FFFFFF
import cv2
import numpy as np

SRC = "/Users/shrimp/Downloads/发作性睡病：睡着符号.png"
OUT = "/Users/shrimp/WorkBuddy/发作性睡病/narcolepsy-tree/site/assets/favicon.svg"

img = cv2.imread(SRC, cv2.IMREAD_GRAYSCALE)
assert img is not None, "源图读取失败"
mask_all = (img > 12).astype(np.uint8)
ys, xs = np.where(mask_all)
content = img[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
h, w = content.shape
print(f"源图 {img.shape[1]}x{img.shape[0]}，内容 {w}x{h}")

# 1) 白描边（>24）2) close(15) 封描边断口 3) 四角 floodfill 灌背景，剩余背景=Z 内部，填实
m = (content > 24).astype(np.uint8) * 255
kern = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
closed = cv2.morphologyEx(m, cv2.MORPH_CLOSE, kern)
ff = closed.copy()
ffmask = np.zeros((h + 2, w + 2), np.uint8)
for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
    if ff[seed[1], seed[0]] == 0:
        cv2.floodFill(ff, ffmask, seed, 255)
solid = np.where(ff == 0, 255, closed).astype(np.uint8)

# 4.5) 加粗笔画：原稿笔画细，缩到标签页 16px 时几乎整根都是抗锯齿边缘像素
# （与背景混合发灰=「不是纯白纯黑」的观感根源）。膨胀让笔画内部保有实心
# 纯色核心，只有极少边缘参与混色
kern_bold = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13))
solid = cv2.dilate(solid, kern_bold)

# 4) 外轮廓（每根笔画一个），丢小噪点，折线简化
contours, _ = cv2.findContours(solid, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
parts = []
for c in contours:
    if cv2.contourArea(c) < 100:
        continue
    approx = cv2.approxPolyDP(c, 0.75, True).reshape(-1, 2)
    if len(approx) < 3:
        continue
    parts.append("M" + " L".join(f"{p[0]},{p[1]}" for p in approx) + " Z")
print(f"实心 Z 轮廓: {len(parts)} 个")
assert len(parts) == 3, "应有三个 Z"
d_attr = " ".join(parts)

pad = round(max(w, h) * 0.04)  # 收紧留白，让 Z 在 16px 下尽量大
vb = f"-{pad} -{pad} {w + 2 * pad} {h + 2 * pad}"
svg = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb + '">'
    "<!-- 睡着符号 favicon：浅色主题纯黑 / 深色主题纯白，浏览器渲染 favicon 时实时评估 -->"
    "<style>path{fill:#000000}@media (prefers-color-scheme: dark){path{fill:#FFFFFF}}</style>"
    '<path d="' + d_attr + '"/>'
    "</svg>"
)
with open(OUT, "w") as f:
    f.write(svg)
print(f"已生成 {OUT}（{len(svg)} 字节）")

# 自检：还原度 IoU
check = np.zeros_like(solid)
for p in parts:
    pts = np.array([[int(a), int(b)] for a, b in
                    (seg.split(",") for seg in p[1:-2].split(" L"))], np.int32)
    cv2.fillPoly(check, [pts], 255)
inter = ((solid > 0) & (check > 0)).sum()
union = ((solid > 0) | (check > 0)).sum()
print(f"SVG 路径还原 IoU={inter / union:.4f}")
