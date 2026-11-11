#!/usr/bin/env python3
"""素材后处理：
1. 粒子图：抠掉 AI 生成的假棋盘格背景（只抠与边界连通的背景区域）→ 裁剪 → 缩放到 512
2. 树干图：裁掉底部水印 → 抠掉纸色背景 → 裁剪
输出：particle-*.png / tree.png
"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage

ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")

PARTICLES = {
    "极简纸本拼贴插画_画面正中一个完整的圆形色块_颜色为纯净的深_2026-10-14T07-25-05.png": "particle-spacecadet.png",
    "极简纸本拼贴插画_画面正中一个完整的圆形色块_颜色为纯净的雾_2026-10-14T10-10-42.png": "particle-carolina.png",
    "极简纸本拼贴插画_画面正中一个完整的圆形色块_颜色为奶油蛋壳_2026-10-14T10-10-40.png": "particle-eggshell.png",
    "极简纸本拼贴插画_画面正中一个完整的圆形色块_颜色为灰蓝色__2026-10-10-39.png": "particle-cadetgray.png",
    "极简纸本拼贴插画_画面正中一个完整的圆形色块_颜色为灰蓝色__2026-10-14T10-10-39.png": "particle-cadetgray.png",
    "极简纸本拼贴插画_画面正中一个完整的圆形色块_颜色为炭黑色__2026-10-14T10-10-42.png": "particle-jet.png",
}
TREE_SRC = "以参考照片中那棵枝干舒展的树的剪影为原型_重构为方块化_模块_2026-10-14T07-24-57.png"
TREE_OUT = "tree.png"


def cut_background(img: Image.Image, sat_thr: int, lum_thr: int, dist_thr: float = None, ref_color=None) -> Image.Image:
    """把与图像边界连通的背景像素抠成透明。

    背景判定二选一：
    - 灰白棋盘格：饱和度 < sat_thr 且亮度 > lum_thr
    - 指定参考色：RGB 欧氏距离 < dist_thr
    """
    rgba = np.array(img.convert("RGBA"))
    rgb = rgba[..., :3].astype(np.int16)
    if ref_color is not None:
        dist = np.sqrt(((rgb - np.array(ref_color, dtype=np.int16)) ** 2).sum(axis=-1))
        bg_mask = dist < dist_thr
    else:
        mx = rgb.max(axis=-1)
        mn = rgb.min(axis=-1)
        sat = mx - mn
        lum = (mx + mn) / 2
        bg_mask = (sat < sat_thr) & (lum > lum_thr)
    # 只抠与边界连通的背景连通域，避免误伤圆内纸纹
    labels, n = ndimage.label(bg_mask)
    border_labels = set(np.unique(np.concatenate([
        labels[0, :], labels[-1, :], labels[:, 0], labels[:, -1]
    ])))
    border_labels.discard(0)
    keep_transparent = np.isin(labels, list(border_labels)) if border_labels else np.zeros_like(bg_mask)
    rgba[..., 3] = np.where(keep_transparent, 0, 255).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def crop_to_content(img: Image.Image, pad: int = 6) -> Image.Image:
    a = np.array(img)
    alpha = a[..., 3]
    ys, xs = np.where(alpha > 8)
    if len(ys) == 0:
        return img
    y0, y1 = max(0, ys.min() - pad), min(a.shape[0], ys.max() + 1 + pad)
    x0, x1 = max(0, xs.min() - pad), min(a.shape[1], xs.max() + 1 + pad)
    return img.crop((x0, y0, x1, y1))


def report(name: str, img: Image.Image):
    a = np.array(img)
    alpha = a[..., 3]
    total = alpha.size
    transparent = (alpha < 8).sum()
    print(f"  {name}: {img.size[0]}x{img.size[1]}, 透明占比 {transparent/total:.1%}")


# ---- 粒子图 ----
for src, dst in PARTICLES.items():
    path = os.path.join(ASSETS, src)
    if not os.path.exists(path):
        continue
    img = Image.open(path)
    out = cut_background(img, sat_thr=14, lum_thr=170)
    out = crop_to_content(out)
    out = out.resize((512, 512), Image.LANCZOS)
    out.save(os.path.join(ASSETS, dst))
    report(dst, out)

# ---- 树干图 ----
tree_path = os.path.join(ASSETS, TREE_SRC)
img = Image.open(tree_path)
w, h = img.size
img = img.crop((0, 0, w, h - 72))  # 裁掉底部 AI 水印
# 取裁剪后四角平均色作为纸底参考色
a = np.array(img.convert("RGB"))
corners = np.concatenate([
    a[:40, :40].reshape(-1, 3), a[:40, -40:].reshape(-1, 3),
    a[-40:160, :40].reshape(-1, 3), a[-40:160, -40:].reshape(-1, 3),
])
ref = corners.mean(axis=0)
print(f"树干纸底参考色: #{int(ref[0]):02X}{int(ref[1]):02X}{int(ref[2]):02X}")
out = cut_background(img, 0, 0, dist_thr=46, ref_color=ref)
out = crop_to_content(out, pad=10)
out.save(os.path.join(ASSETS, TREE_OUT))
report(TREE_OUT, out)
print("done")
