from PIL import Image, ImageDraw, ImageFont
import os

BG = (13, 17, 23)
ACCENT = (46, 204, 204)
TEXT = (236, 238, 242)
SUB = (140, 145, 155)

w, h = 1200, 630
img = Image.new('RGBA', (w, h), BG + (255,))
draw = ImageDraw.Draw(img)

# Background accent line
draw.rounded_rectangle([60, 60, w-60, h-60], radius=24, outline=ACCENT + (80,), width=2)

# Try to load a font; fallback to default
try:
    font_title = ImageFont.truetype("arial.ttf", 72)
    font_sub = ImageFont.truetype("arial.ttf", 36)
    font_mono = ImageFont.truetype("arial.ttf", 28)
except:
    font_title = ImageFont.load_default()
    font_sub = ImageFont.load_default()
    font_mono = ImageFont.load_default()

# Title
title = "Ferias Libres de Chile"
draw.text((100, 160), title, font=font_title, fill=TEXT + (255,))

# Subtitle
subtitle = "1,764 ferias · 16 regiones · 284 comunas"
draw.text((100, 260), subtitle, font=font_sub, fill=SUB + (255,))

# Accent bar
bar_w = 180
bar_h = 6
draw.rounded_rectangle([100, 330, 100+bar_w, 330+bar_h], radius=3, fill=ACCENT + (255,))

# Footer
footer = "Datos abiertos de ODEPA · Mapa interactivo"
draw.text((100, 460), footer, font=font_mono, fill=SUB + (255,))

out_path = r'C:\JULLOAR-CODE\sp\ferias_libres\web\public\icons\og-image.png'
img.save(out_path)
print('OG image saved to', out_path)
