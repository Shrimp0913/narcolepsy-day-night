# 生成干净纯色圆点贴图，覆盖 particle-*.png（原图为 ImageGen 纸感毛边圆）
# 512x512、4x 超采样抗锯齿，圆直径 = 边长（绘制端 drawImage 直径 2r 正好铺满）
# 原始 ImageGen 大图仍保留在 assets/（极简纸本拼贴插画_*.png），可随时回滚
from PIL import Image, ImageDraw
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "assets")

# 2026-11-10 第三次定稿（用户第二张截图，6 色）：柠檬黄/亮橙黄/玫红/西瓜红/
#   牛油果绿/雾蓝。key 语义化；分配逻辑不动（均匀随机）。
# 历史色表（可回滚）：
#   初版冷色：spacecadet #2D3350 / carolina #70B0CC / eggshell #E9E3CE
#     / cadetgray #8795A5 / jet #3A3948
#   二版截图色：concrete #525871 / steel #857C91 / rosewood #CD9FA0
#     / peachcream #F2C1A3 / dawn #F8CCAA
DOTS = [
    ("lemon",   "#F8E473"),  # 1 Lemon Whip 柠檬黄
    ("sunpop",  "#FFB40F"),  # 2 Sun Pop 亮橙黄
    ("bubble",  "#E41E71"),  # 3 Bubbletini 玫红
    ("melon",   "#F15961"),  # 4 Melon Pop 西瓜红
    ("avocado", "#A7B408"),  # 5 Avocado Mash 牛油果绿
    ("breezy",  "#96C1DD"),  # 6 Breezy Harbor 雾蓝
]

SIZE = 512
SS = 4

for name, hexcolor in DOTS:
    big = SIZE * SS
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    n = int(hexcolor[1:3], 16), int(hexcolor[3:5], 16), int(hexcolor[5:7], 16), 255
    # 圆直径 = 边长（留 1px 防裁），中心同心
    d.ellipse([1, 1, big - 2, big - 2], fill=n)
    img = img.resize((SIZE, SIZE), Image.LANCZOS)
    img.save(os.path.join(OUT, "particle-%s.png" % name))
    print("particle-%s.png" % name, hexcolor)
print("done")
