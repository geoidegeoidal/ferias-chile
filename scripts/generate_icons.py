from PIL import Image, ImageDraw, ImageFont
import os

# Colors from Observatorio palette
BG = (13, 17, 23)       # hsl(220, 22%, 9%) ≈ #0d1117
ACCENT = (46, 204, 204) # hsl(185, 80%, 55%) ≈ #2ecccc

# Output directory
out_dir = r'C:\JULLOAR-CODE\sp\ferias_libres\web\public\icons'
os.makedirs(out_dir, exist_ok=True)

def draw_icon(size, maskable=False):
    img = Image.new('RGBA', (size, size), BG + (255,))
    draw = ImageDraw.Draw(img)
    
    # Safe area for maskable: 80% of size centered
    if maskable:
        safe = int(size * 0.8)
        offset = (size - safe) // 2
        # Draw a circle in safe area
        r = safe // 2
        cx, cy = size // 2, size // 2
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=ACCENT + (255,))
        # Draw a small shop icon (simple shapes)
        shop_w = int(safe * 0.5)
        shop_h = int(safe * 0.35)
        shop_x = (size - shop_w) // 2
        shop_y = cy - shop_h // 2 + int(size * 0.05)
        # Shop body
        draw.rectangle([shop_x, shop_y, shop_x + shop_w, shop_y + shop_h], fill=BG + (255,), outline=BG + (255,), width=2)
        # Awning (stripes)
        stripe_w = shop_w // 4
        for i in range(4):
            x0 = shop_x + i * stripe_w
            x1 = x0 + stripe_w
            color = ACCENT if i % 2 == 0 else BG
            draw.rectangle([x0, shop_y - int(size*0.06), x1, shop_y], fill=color + (255,))
        # Door
        door_w = shop_w // 3
        door_h = shop_h // 2
        door_x = shop_x + (shop_w - door_w) // 2
        door_y = shop_y + shop_h - door_h
        draw.rectangle([door_x, door_y, door_x + door_w, door_y + door_h], fill=ACCENT + (255,))
    else:
        # Regular icon: rounded rect background
        pad = size // 10
        r = size // 6
        draw.rounded_rectangle([pad, pad, size - pad, size - pad], radius=r, fill=ACCENT + (255,))
        # Shop icon in dark
        shop_w = int(size * 0.45)
        shop_h = int(size * 0.32)
        shop_x = (size - shop_w) // 2
        shop_y = (size - shop_h) // 2 + int(size * 0.04)
        draw.rectangle([shop_x, shop_y, shop_x + shop_w, shop_y + shop_h], fill=BG + (255,))
        stripe_w = shop_w // 4
        for i in range(4):
            x0 = shop_x + i * stripe_w
            x1 = x0 + stripe_w
            color = ACCENT if i % 2 == 0 else BG
            draw.rectangle([x0, shop_y - int(size*0.05), x1, shop_y], fill=color + (255,))
        door_w = shop_w // 3
        door_h = shop_h // 2
        door_x = shop_x + (shop_w - door_w) // 2
        door_y = shop_y + shop_h - door_h
        draw.rectangle([door_x, door_y, door_x + door_w, door_y + door_h], fill=ACCENT + (255,))
    
    return img

# Generate sizes
for sz in [192, 512]:
    img = draw_icon(sz, maskable=False)
    img.save(os.path.join(out_dir, f'icon-{sz}.png'))

img512m = draw_icon(512, maskable=True)
img512m.save(os.path.join(out_dir, 'icon-maskable-512.png'))

print('Icons generated successfully in', out_dir)
