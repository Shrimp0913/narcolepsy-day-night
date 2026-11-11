#!/usr/bin/env python3
"""角落剪影素材：端坐（白天，原样）+ 趴睡（黑夜，转白色，保留 alpha）。
源图由用户提供（1920x1080 RGBA 透明底剪影，四周留白很大）。
两张按 alpha 联合包围盒 + 统一余量裁剪——昼夜同窗裁剪保证换图时完全对位。
第三个参数为 Zzz 睡觉符号（可选）：独立紧裁 + 同样转白，贴在趴睡剪影右上角。
用法：python3 tools/prep_figure.py <端坐.png> <趴睡.png> [Zzz.png]
"""
import sys
from pathlib import Path
from PIL import Image

SITE = Path(__file__).resolve().parent.parent
MARGIN = 12  # 裁剪余量（px）


def make_white(rgba):
    """RGB 全部置白，alpha 原样保留（剪影形状不变，颜色变白）"""
    white = Image.new("RGBA", rgba.size, (255, 255, 255, 0))
    white.putalpha(rgba.getchannel("A"))
    return white


def main():
    sit_src, sleep_src = sys.argv[1], sys.argv[2]
    sit = Image.open(sit_src).convert("RGBA")
    sleep = Image.open(sleep_src).convert("RGBA")

    # 联合包围盒（两张同一裁剪窗 → 同尺寸输出，同位叠放不跑偏）
    ba, bb = sit.getchannel("A").getbbox(), sleep.getchannel("A").getbbox()
    l = max(0, min(ba[0], bb[0]) - MARGIN)
    t = max(0, min(ba[1], bb[1]) - MARGIN)
    r = min(sit.size[0], max(ba[2], bb[2]) + MARGIN)
    bo = min(sit.size[1], max(ba[3], bb[3]) + MARGIN)
    window = (l, t, r, bo)

    sit_c = sit.crop(window)
    sit_c.save(SITE / "assets" / "figure-sit.png")

    white_c = make_white(sleep).crop(window)
    white_c.save(SITE / "assets" / "figure-sleep.png")

    # 校验：白色版不透明像素应为纯白
    px = list(white_c.getdata())
    op = [p for p in px if p[3] > 200]
    assert op and all(p[0] == 255 and p[1] == 255 and p[2] == 255 for p in op), "白色转换异常"
    w, h = sit_c.size
    print(f"figure-sit.png / figure-sleep.png  {w}x{h}  aspect-ratio: {w} / {h}  (白色版校验通过)")

    # Zzz 睡觉符号（可选第三参）：独立紧裁 + 转白，CSS 里贴趴睡剪影右上角
    if len(sys.argv) > 3:
        zzz = Image.open(sys.argv[3]).convert("RGBA")
        bz = zzz.getchannel("A").getbbox()
        zl = max(0, bz[0] - MARGIN)
        zt = max(0, bz[1] - MARGIN)
        zr = min(zzz.size[0], bz[2] + MARGIN)
        zb = min(zzz.size[1], bz[3] + MARGIN)
        zzz_c = make_white(zzz).crop((zl, zt, zr, zb))
        zzz_c.save(SITE / "assets" / "figure-zzz.png")
        px = list(zzz_c.getdata())
        op = [p for p in px if p[3] > 200]
        assert op and all(p[0] == 255 and p[1] == 255 and p[2] == 255 for p in op), "Zzz 白色转换异常"
        print(f"figure-zzz.png  {zzz_c.size[0]}x{zzz_c.size[1]}  (白色版校验通过)")


if __name__ == "__main__":
    main()
