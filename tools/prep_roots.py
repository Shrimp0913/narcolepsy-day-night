#!/usr/bin/env python3
"""树根素材后处理：
1. 裁掉底部 AI 水印
2. 抠掉纸色背景（四角取参考色，只抠与边界连通区域）
3. 按根颈（画面最顶端非透明像素）中心对齐到统一基准点
4. 统一画布裁剪 + 缩放输出 root-1.png ~ root-8.png（前端 8 层同尺寸叠放）
"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage

ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")
N = 8
BASE_X = 512      # 对齐基准：根颈中心 x
BASE_Y = 24       # 对齐基准：根颈顶 y
CROP_BOTTOM = 1280  # 统一裁剪保留的画布高度（对齐后）

def cut_background(img, dist_thr=46):
    a = np.array(img.convert("RGB"))
    corners = np.concatenate([
        a[:40, :40].reshape(-1, 3), a[:40, -40:].reshape(-1, 3),
        a[-160:-40, :40].reshape(-1, 3), a[-160:-40, -40:].reshape(-1, 3),
    ])
    ref = corners.mean(axis=0)
    rgba = np.array(img.convert("RGBA"))
    rgb = rgba[..., :3].astype(np.int16)
    dist = np.sqrt(((rgb - ref.astype(np.int16)) ** 2).sum(axis=-1))
    bg = dist < dist_thr
    labels, n = ndimage.label(bg)
    border = set(np.unique(np.concatenate([
        labels[0, :], labels[-1, :], labels[:, 0], labels[:, -1]
    ])))
    border.discard(0)
    rgba[..., 3] = np.where(np.isin(labels, list(border)), 0, 255).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA"), ref

def crown_point(alpha):
    """根颈顶端中心：最上 6 行非透明像素的 x 中位数。"""
    rows = np.where(alpha.max(axis=1) > 8)[0]
    top = rows[0]
    band = alpha[top:top + 6, :]
    xs = np.where(band.max(axis=0) > 8)[0]
    return top, int(np.median(xs))

masks = {}
out_h = CROP_BOTTOM
mask_hex_list = []   # 128x160 二值命中网格（file:// 下 canvas getImageData 被跨域污染，必须预生成）
MW, MH = 128, 160
for i in range(1, N + 1):
    src = os.path.join(ASSETS, f"root-src-{i}.png")
    img = Image.open(src)
    w, h = img.size
    img = img.crop((0, 0, w, h - 80))  # 裁底部水印
    img, ref = cut_background(img)
    alpha = np.array(img)[..., 3]
    top, cx = crown_point(alpha)
    # 平移：根颈中心 → (BASE_X, BASE_Y)
    dx, dy = BASE_X - cx, BASE_Y - top
    canvas = Image.new("RGBA", img.size, (0, 0, 0, 0))
    canvas.paste(img, (dx, dy))
    # 统一裁剪
    canvas = canvas.crop((0, 0, 1024, min(CROP_BOTTOM, canvas.size[1])))
    # 缩放输出
    out = canvas.resize((512, int(512 * canvas.size[1] / 1024)), Image.LANCZOS)
    out.save(os.path.join(ASSETS, f"root-{i}.png"))
    a = np.array(out)[..., 3]
    ys, xs = np.where(a > 8)
    print(f"root-{i}: {out.size}, 内容 bbox y[{ys.min()}~{ys.max()}] x[{xs.min()}~{xs.max()}], 纸底#{int(ref[0]):02X}{int(ref[1]):02X}{int(ref[2]):02X}")
    out_h = out.size[1]
    # 命中网格：512x640 → 128x160（4px/格），alpha>40 视为命中，每行 128bit = 32 hex 字符
    small = out.resize((MW, MH), Image.LANCZOS)
    sa = np.array(small)[..., 3] > 40
    rows = []
    for y in range(MH):
        bits = 0
        for x in range(MW):
            if sa[y, x]:
                bits |= 1 << (MW - 1 - x)
        rows.append(f"{bits:032x}")
    mask_hex_list.append("".join(rows))

with open(os.path.join(ASSETS, "..", "root-masks.js"), "w") as f:
    f.write("/* 树根命中网格（由 tools/prep_roots.py 生成）：128x160 二值位图，每根 160 行 x 32 hex */\n")
    f.write("window.ROOT_MASKS = [\n")
    for hx in mask_hex_list:
        f.write(f'  "{hx}",\n')
    f.write("];\n")
print(f"root-masks.js written ({sum(len(x) for x in mask_hex_list)} hex chars)")
print("done")
