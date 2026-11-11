# 生成黑夜星星独立贴图：5 色清晰五角星（无光晕）+ 2 色夜尘小圆点
# 输出 site/assets/star-<name>.png / night-dust-<n>.png
# 星形外接圆直径 = 图像边长一半（绘制端按此换算），4x 超采样抗锯齿
from PIL import Image, ImageDraw
import math, os

OUT = os.path.join(os.path.dirname(__file__), "..", "assets")

# 黑夜五色（与 app.js NIGHT_COLORS 一致）+ 文件名
STARS = [
    ("eggshell", "#F7F3E3"),
    ("ice",      "#BFE0F2"),
    ("mist",     "#9FB8D8"),
    ("white",    "#FFFFFF"),
    ("sky",      "#8FC7DE"),
]
DUSTS = [("1", "#E8E2CE"), ("2", "#A9C6DE")]

SS = 4  # 超采样倍数
SIZE = 512          # png 边长
R_OUT = SIZE // 4   # 星外接圆半径 = 边长 1/4 → 直径 = 边长一半
INNER = 0.44        # 内半径比例（与旧版一致）
MID = SIZE / 2


def star_points(cx, cy, r_out, r_in, rot=-math.pi / 2):
    pts = []
    for i in range(10):
        r = r_out if i % 2 == 0 else r_in
        a = rot + i * math.pi / 5
        pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    return pts


def make_star(name, hexcolor):
    big = SIZE * SS
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    n = int(hexcolor[1:3], 16), int(hexcolor[3:5], 16), int(hexcolor[5:7], 16), 255
    d.polygon(star_points(big / 2, big / 2, R_OUT * SS, R_OUT * SS * INNER), fill=n)
    img = img.resize((SIZE, SIZE), Image.LANCZOS)
    img.save(os.path.join(OUT, "star-%s.png" % name))
    print("star-%s.png" % name, hexcolor)


def make_dust(name, hexcolor):
    # 小圆点：直径 = 边长 0.72，留边给极窄柔边
    big = SIZE * SS
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    n = int(hexcolor[1:3], 16), int(hexcolor[3:5], 16), int(hexcolor[5:7], 16), 255
    d.ellipse([big*0.14, big*0.14, big*0.86, big*0.86], fill=n)
    img = img.resize((SIZE, SIZE), Image.LANCZOS)
    img.save(os.path.join(OUT, "night-dust-%s.png" % name))
    print("night-dust-%s.png" % name, hexcolor)


for name, c in STARS:
    make_star(name, c)
for name, c in DUSTS:
    make_dust(name, c)
print("done")
