#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MindFlow 品牌图标生成器 —— 设计系统「纸 · 墨 · 流」

原创图标，替换上游 MoodsNote 晨暮日记遗留的图标素材。
构图含义：一滴纸白的墨点落下，化作一条流青色的流带（记录 → 复盘 → 沉淀）。

用法：
    python scripts/generate-icon.py            # 生成并写入仓库
    python scripts/generate-icon.py --dry-run  # 只打印将要写出的文件

依赖：Pillow（pip install Pillow）
"""

import argparse
import math
import os
import struct
import sys

from PIL import Image, ImageDraw, ImageFilter

# ---------------------------------------------------------------- 品牌配色
# 取自 src/style.css 设计系统变量
PAPER = (250, 247, 241)        # --paper（纸感暖白）
INK = (35, 43, 38)             # --ink（深墨）
ACCENT = (47, 126, 110)        # --accent（流青 #2F7E6E）
ACCENT_LIGHT = (87, 160, 145)  # 深色主题下的 accent

BG_TOP = (44, 53, 48)          # 墨底渐变起
BG_BOTTOM = (22, 26, 23)       # 墨底渐变止
FLOW_START = (126, 207, 192)   # 流带：入（亮）
FLOW_END = (47, 126, 110)      # 流带：出（深，沉淀）
DROP = PAPER                   # 墨滴：纸白

# ---------------------------------------------------------------- 构图参数
# 墨滴（纸白）：一滴墨落下
DROP_CENTER = (0.41, 0.145)
DROP_RADIUS = 0.072
# 流带：沿垂直方向推进的正弦 S 形，宽度由粗到细、颜色由亮到深（入 → 出 → 沉淀）
FLOW_AMP = 0.21          # 横向摆幅
FLOW_DRIFT = 0.10        # 整体向右下漂移
FLOW_X = 0.46            # 摆动中心
FLOW_Y0 = 0.275
FLOW_Y1 = 0.79
FLOW_W0 = 0.110          # 起点宽度（占画布）
FLOW_W1 = 0.040          # 终点宽度
CORNER_RATIO = 0.2237    # 圆角比例（接近 Apple 连续圆角观感）


def lerp(a, b, t):
    return a + (b - a) * t


def mix(c1, c2, t):
    return tuple(int(round(lerp(c1[i], c2[i], t))) for i in range(3))


def cubic(p0, p1, p2, p3, t):
    """保留备用：三次贝塞尔求值（当前构图用正弦 S，历史构图曾用贝塞尔）。"""
    mt = 1.0 - t
    return (
        mt ** 3 * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t ** 3 * p3[0],
        mt ** 3 * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t ** 3 * p3[1],
    )


def render(size, square=False, super_sample=None):
    """渲染一张 size x size 的图标。square=True 时四角不透明、无圆角（应用商店用）。"""
    if super_sample is None:
        super_sample = 6 if size <= 48 else (4 if size <= 256 else 3)
    n = size * super_sample

    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))

    # 1) 墨底垂直渐变
    grad = Image.new("RGB", (1, n))
    gd = ImageDraw.Draw(grad)
    for y in range(n):
        gd.point((0, y), fill=mix(BG_TOP, BG_BOTTOM, y / max(1, n - 1)))
    bg = grad.resize((n, n), Image.NEAREST).convert("RGBA")

    # 2) 右下角流青柔光（增加质感，避免大面积纯色平板）
    glow = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    gd2 = ImageDraw.Draw(glow)
    gr = 0.46 * n
    gx, gy = 0.86 * n, 0.92 * n
    gd2.ellipse([gx - gr, gy - gr, gx + gr, gy + gr], fill=ACCENT_LIGHT + (76,))
    glow = glow.filter(ImageFilter.GaussianBlur(0.16 * n))
    bg = Image.alpha_composite(bg, glow)

    # 3) 圆角裁切
    if square:
        radius = 0
        mask = Image.new("L", (n, n), 255)
    else:
        radius = int(round(CORNER_RATIO * n))
        mask = Image.new("L", (n, n), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, n - 1, n - 1], radius=radius, fill=255)
    img.paste(bg, (0, 0), mask)

    d = ImageDraw.Draw(img)

    # 4) 流带：正弦 S 形，逐点画圆形成由粗到细的渐变描边
    steps = max(240, n // 3)
    for i in range(steps + 1):
        t = i / steps
        x = (FLOW_X + FLOW_AMP * math.sin(2 * math.pi * t) + FLOW_DRIFT * t) * n
        y = (FLOW_Y0 + (FLOW_Y1 - FLOW_Y0) * t) * n
        w = lerp(FLOW_W0, FLOW_W1, t ** 1.05) * n
        r = w / 2.0
        d.ellipse([x - r, y - r, x + r, y + r], fill=mix(FLOW_START, FLOW_END, t) + (255,))

    # 5) 墨滴（纸白圆点）
    cx, cy = DROP_CENTER[0] * n, DROP_CENTER[1] * n
    dr = DROP_RADIUS * n
    d.ellipse([cx - dr, cy - dr, cx + dr, cy + dr], fill=DROP + (255,))

    # 6) 降采样输出
    out = img.resize((size, size), Image.LANCZOS)
    if square:
        out = out.convert("RGB")
    return out


def flow_point(t):
    """流带中心线与半宽（归一化坐标）。"""
    x = FLOW_X + FLOW_AMP * math.sin(2 * math.pi * t) + FLOW_DRIFT * t
    y = FLOW_Y0 + (FLOW_Y1 - FLOW_Y0) * t
    return x, y, lerp(FLOW_W0, FLOW_W1, t ** 1.05) / 2.0


def build_svg(size=1024):
    """输出矢量源：流带用真实变宽轮廓（上下边界 + 法向偏移），非等宽描边。"""
    steps = 260
    upper, lower = [], []
    for i in range(steps + 1):
        t = i / steps
        x, y, hw = flow_point(t)
        # 切线（有限差分）→ 法向
        xp, yp, _ = flow_point(min(1.0, t + 1e-4))
        xm, ym, _ = flow_point(max(0.0, t - 1e-4))
        dx, dy = xp - xm, yp - ym
        ln = math.hypot(dx, dy) or 1.0
        nx, ny = -dy / ln, dx / ln
        upper.append((x + nx * hw, y + ny * hw))
        lower.append((x - nx * hw, y - ny * hw))
    pts = upper + lower[::-1]
    poly = " ".join("%.2f,%.2f" % (p[0] * size, p[1] * size) for p in pts)

    return """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {s} {s}" width="{s}" height="{s}" role="img" aria-label="MindFlow icon">
  <defs>
    <linearGradient id="ink" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#{bg0}"/><stop offset="1" stop-color="#{bg1}"/>
    </linearGradient>
    <linearGradient id="flow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#{f0}"/><stop offset="1" stop-color="#{f1}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.86" cy="0.92" r="0.46">
      <stop offset="0" stop-color="#{glow}" stop-opacity="0.30"/>
      <stop offset="1" stop-color="#{glow}" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="squircle">
      <rect x="0" y="0" width="{s}" height="{s}" rx="{r}" ry="{r}"/>
    </clipPath>
  </defs>
  <g clip-path="url(#squircle)">
    <rect width="{s}" height="{s}" fill="url(#ink)"/>
    <rect width="{s}" height="{s}" fill="url(#glow)"/>
    <polygon points="{poly}" fill="url(#flow)"/>
    <circle cx="{cx}" cy="{cy}" r="{dr}" fill="#{paper}"/>
  </g>
</svg>
""".format(
        s=size,
        bg0="%02X%02X%02X" % BG_TOP, bg1="%02X%02X%02X" % BG_BOTTOM,
        f0="%02X%02X%02X" % FLOW_START, f1="%02X%02X%02X" % FLOW_END,
        glow="%02X%02X%02X" % ACCENT_LIGHT, paper="%02X%02X%02X" % PAPER,
        r=round(CORNER_RATIO * size, 2),
        poly=poly,
        cx=round(DROP_CENTER[0] * size, 2), cy=round(DROP_CENTER[1] * size, 2),
        dr=round(DROP_RADIUS * size, 2),
    )


# ---------------------------------------------------------------- ICNS 容器
def build_icns(sizes):
    """按 Apple ICNS 容器格式打包（条目 = 4 字节类型 + 4 字节长度 + PNG 数据）。"""
    entries = []
    type_map = {
        16: "icp4", 32: "icp5", 64: "icp6", 128: "ic07",
        256: "ic08", 512: "ic09", 1024: "ic10",
    }
    retina = {32: "ic11", 64: "ic12", 256: "ic13", 512: "ic14"}
    for s in sizes:
        import io
        buf = io.BytesIO()
        render(s).save(buf, format="PNG")
        data = buf.getvalue()
        for t in filter(None, [type_map.get(s), retina.get(s)]):
            entries.append(t.encode("ascii") + struct.pack(">I", len(data) + 8) + data)
    body = b"".join(entries)
    return b"icns" + struct.pack(">I", len(body) + 8) + body


# ---------------------------------------------------------------- 输出清单
APPLE_SIZES = [16, 20, 29, 32, 40, 48, 50, 55, 57, 58, 60, 64, 66, 72, 76, 80,
               87, 88, 92, 100, 102, 108, 114, 120, 128, 144, 152, 167, 172,
               180, 196, 216, 234, 256, 258, 512, 1024]
ANDROID_SIZES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
WINDOWS_SIZES = [16, 32, 48, 64, 128, 256]
ICO_SIZES = [16, 32, 48, 64, 128, 256]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    root = args.root
    written = []

    def write(rel, image):
        path = os.path.join(root, rel)
        if args.dry_run:
            written.append(rel)
            return
        os.makedirs(os.path.dirname(path), exist_ok=True)
        image.save(path)
        written.append(rel)

    # 主图标（README / favicon）
    write("public/icon.png", render(512))
    write("public/icon1.png", render(1024, square=True))  # 上游遗留的"源图"占位，同步替换

    # Apple
    for s in APPLE_SIZES:
        write("public/AppIcons/Assets.xcassets/AppIcon.appiconset/%d.png" % s, render(s))

    # Android
    for folder, s in ANDROID_SIZES.items():
        write("public/AppIcons/android/mipmap-%s/ic_launcher.png" % folder, render(s))

    # 应用商店（方形不透明）
    write("public/AppIcons/appstore.png", render(1024, square=True))
    write("public/AppIcons/playstore.png", render(512, square=True))

    # Windows / Linux 打包资源
    for s in WINDOWS_SIZES:
        write("build-resources/windows-icons/icon-%d.png" % s, render(s))
    write("build-resources/linux-icons/icon.png", render(512))
    write("build-resources/linux-icons/icon-512.png", render(512))

    # 矢量源（便于后续任意尺寸再导出 / 印刷 / 网页使用）
    svg_path = os.path.join(root, "docs/assets/mindflow-icon.svg")
    if not args.dry_run:
        os.makedirs(os.path.dirname(svg_path), exist_ok=True)
        with open(svg_path, "w", encoding="utf-8") as f:
            f.write(build_svg())
    written.append("docs/assets/mindflow-icon.svg")

    ico = render(256)
    path = os.path.join(root, "build-resources/icon.ico")
    if not args.dry_run:
        ico.save(path, format="ICO", sizes=[(s, s) for s in ICO_SIZES])
    written.append("build-resources/icon.ico")

    icns_path = os.path.join(root, "build-resources/icon.icns")
    if not args.dry_run:
        with open(icns_path, "wb") as f:
            f.write(build_icns([16, 32, 64, 128, 256, 512, 1024]))
    written.append("build-resources/icon.icns")

    for rel in written:
        print("  " + rel)
    print("total: %d files" % len(written))
    return 0


if __name__ == "__main__":
    sys.exit(main())
