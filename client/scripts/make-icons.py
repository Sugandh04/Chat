"""Generates the app icons: a plain dark tile with a white "C". Run: python scripts/make-icons.py"""
from PIL import Image, ImageDraw, ImageFont

DARK = (39, 39, 42, 255)      # #27272A
LIGHT = (250, 250, 249, 255)  # #FAFAF9
FONT = "C:/Windows/Fonts/arialbd.ttf"
OUT = "assets/images/"


def letter(size, height_ratio, color, bg=None):
    """Square image with a centred 'C' whose height is height_ratio of the canvas."""
    img = Image.new("RGBA", (size, size), bg or (0, 0, 0, 0))
    font_size = int(size * height_ratio * 1.4)
    font = ImageFont.truetype(FONT, font_size)
    d = ImageDraw.Draw(img)
    l, t, r, b = d.textbbox((0, 0), "C", font=font)
    d.text(((size - (r - l)) / 2 - l, (size - (b - t)) / 2 - t), "C", font=font, fill=color)
    return img


letter(1024, 0.5, LIGHT, DARK).save(OUT + "icon.png")
letter(1024, 0.34, LIGHT).resize((512, 512), Image.LANCZOS).save(OUT + "android-icon-foreground.png")
Image.new("RGBA", (512, 512), DARK).save(OUT + "android-icon-background.png")
letter(432, 0.34, (255, 255, 255, 255)).save(OUT + "android-icon-monochrome.png")
letter(96, 0.55, LIGHT, DARK).resize((48, 48), Image.LANCZOS).save(OUT + "favicon.png")
letter(400, 0.6, DARK).save(OUT + "splash-icon.png")
print("icons written")
