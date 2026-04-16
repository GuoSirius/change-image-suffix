"""
生成 change-image-suffix 的 ICO 图标
图标设计：深色圆形背景 + 彩色图片叠加缩略图 + 白色循环箭头
"""
from PIL import Image, ImageDraw, ImageFont
import math, os

def draw_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    s = size

    # ── 背景圆 ──
    # 渐变：左上 #5B4FE8（靛紫）→ 右下 #00C2FF（青蓝）
    bg = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg)
    for y in range(s):
        for x in range(s):
            t = (x + y) / (2 * s)
            r = int(91  + (0   - 91)  * t)
            g = int(79  + (194 - 79)  * t)
            b = int(232 + (255 - 232) * t)
            bg_draw.point((x, y), (r, g, b, 255))
    # 裁成圆形
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).ellipse([2, 2, s-3, s-3], fill=255)
    img.paste(bg, (0, 0), mask)

    # ── 三张小缩略图（PNG / JPG / WebP） ──
    card_w = int(s * 0.38)
    card_h = int(s * 0.30)
    radius = max(2, int(s * 0.04))

    def rounded_rect(draw, xy, fill, outline=None, r=4):
        x0, y0, x1, y1 = [int(v) for v in xy]
        # 保证 r 不超过宽高一半
        r = min(r, (x1-x0)//2, (y1-y0)//2)
        if r < 1:
            draw.rectangle([x0, y0, x1, y1], fill=fill)
            return
        draw.rectangle([x0+r, y0, x1-r, y1], fill=fill)
        draw.rectangle([x0, y0+r, x1, y1-r], fill=fill)
        draw.ellipse([x0, y0, x0+2*r, y0+2*r], fill=fill)
        draw.ellipse([x1-2*r, y0, x1, y0+2*r], fill=fill)
        draw.ellipse([x0, y1-2*r, x0+2*r, y1], fill=fill)
        draw.ellipse([x1-2*r, y1-2*r, x1, y1], fill=fill)

    cards = [
        {"color": (255, 107, 107, 230), "label": "PNG", "dx": -int(s*0.18), "dy": -int(s*0.08)},
        {"color": (255, 183, 77,  230), "label": "JPG", "dx":  int(s*0.18), "dy": -int(s*0.08)},
        {"color": (102, 217, 190, 230), "label": "WebP","dx":  0,            "dy":  int(s*0.10)},
    ]
    cx, cy = s // 2, s // 2
    layer = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)

    for card in cards:
        x0 = cx + card["dx"] - card_w // 2
        y0 = cy + card["dy"] - card_h // 2
        x1 = x0 + card_w
        y1 = y0 + card_h
        # 白色底 + 彩色上方色块
        rounded_rect(ld, [x0, y0, x1, y1], (255,255,255,240), r=radius)
        # 上方彩色条
        rounded_rect(ld, [x0, y0, x1, y0 + int(card_h*0.45)], card["color"], r=radius)
        # 标签文字
        fs = max(6, int(s * 0.075))
        try:
            font = ImageFont.truetype("arial.ttf", fs)
        except:
            font = ImageFont.load_default()
        bbox = ld.textbbox((0,0), card["label"], font=font)
        tw, th = bbox[2]-bbox[0], bbox[3]-bbox[1]
        tx = x0 + (card_w - tw) // 2
        ty = y0 + int(card_h*0.55) + (int(card_h*0.45) - th) // 2
        ld.text((tx, ty), card["label"], fill=(60, 60, 60, 255), font=font)

    img = Image.alpha_composite(img, layer)

    # ── 循环箭头（白色，右下角） ──
    draw = ImageDraw.Draw(img)
    ar = int(s * 0.22)   # 箭头圆弧半径
    ax, ay = int(s * 0.70), int(s * 0.70)  # 中心
    lw = max(2, int(s * 0.045))

    # 画圆弧（约300度）
    draw.arc([ax-ar, ay-ar, ax+ar, ay+ar], start=50, end=330,
             fill=(255,255,255,240), width=lw)

    # 箭头头部（在 330° 处）
    angle = math.radians(330)
    tip_x = ax + ar * math.cos(angle)
    tip_y = ay + ar * math.sin(angle)
    head_len = int(s * 0.09)
    for da in [math.radians(140), math.radians(230)]:
        ex = tip_x + head_len * math.cos(angle + da)
        ey = tip_y + head_len * math.sin(angle + da)
        draw.line([tip_x, tip_y, ex, ey], fill=(255,255,255,240), width=lw)

    return img


def main():
    out_dir = os.path.join(os.path.dirname(__file__), '..', 'assets')
    os.makedirs(out_dir, exist_ok=True)

    sizes = [256, 128, 64, 48, 32, 16]
    frames = [draw_icon(sz) for sz in sizes]

    # 保存 ICO（多分辨率）
    ico_path = os.path.join(out_dir, 'icon.ico')
    frames[0].save(
        ico_path,
        format='ICO',
        sizes=[(sz, sz) for sz in sizes],
        append_images=frames[1:]
    )
    print(f'[OK] ICO: {ico_path}')

    # 同时保存一张 256 PNG 预览
    png_path = os.path.join(out_dir, 'icon.png')
    frames[0].save(png_path, format='PNG')
    print(f'[OK] PNG: {png_path}')


if __name__ == '__main__':
    main()
