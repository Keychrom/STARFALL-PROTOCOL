from PIL import Image, ImageDraw
import math

S = 1024
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Rounded background with vertical gradient.
bg = Image.new('RGBA', (S, S), (0, 0, 0, 0))
bd = ImageDraw.Draw(bg)
for y in range(S):
    t = y / (S - 1)
    r = int(4 + 4 * t)
    g = int(13 + 13 * t)
    b = int(24 + 18 * t)
    bd.line([(0, y), (S, y)], fill=(r, g, b, 255))
mask = Image.new('L', (S, S), 0)
md = ImageDraw.Draw(mask)
md.rounded_rectangle([10, 10, S - 10, S - 10], radius=110, fill=255)
img.paste(bg, (0, 0), mask)
draw = ImageDraw.Draw(img)

# Border and faint orbit.
draw.rounded_rectangle([18, 18, S - 18, S - 18], radius=104, outline=(110, 228, 255, 90), width=5)
draw.ellipse([176, 250, 848, 780], outline=(80, 190, 230, 55), width=3)
draw.ellipse([250, 318, 774, 704], outline=(80, 190, 230, 35), width=2)

# Stars.
stars = [(220, 200, 4), (812, 250, 5), (180, 700, 3), (840, 700, 4), (300, 330, 2), (720, 340, 2), (660, 820, 3), (340, 820, 2)]
for x, y, r in stars:
    draw.ellipse([x - r, y - r, x + r, y + r], fill=(190, 245, 255, 150))

# Engine glow.
for ex in (452, 572):
    for rr, alpha in [(80, 30), (55, 60), (32, 120)]:
        draw.ellipse([ex - rr, 748 - rr // 2, ex + rr, 748 + rr], fill=(80, 220, 255, alpha))

# Ship silhouette (pointing up).
outline = (6, 14, 22, 255)
# wings
for side in (-1, 1):
    wing = [
        (512 + side * 46, 430),
        (512 + side * 224, 540),
        (512 + side * 178, 700),
        (512 + side * 68, 646),
    ]
    draw.polygon(wing, fill=(72, 112, 140, 255), outline=outline)
    draw.line([wing[0], wing[1]], fill=(111, 232, 255, 255), width=7)
    draw.line([wing[1], wing[2]], fill=(205, 245, 255, 200), width=4)
    draw.ellipse([512 + side * 186 - 11, 548, 512 + side * 186 + 11, 570], fill=(255, 191, 94, 255))

# tail fins
for side in (-1, 1):
    fin = [(512 + side * 28, 510), (512 + side * 96, 618), (512 + side * 44, 672)]
    draw.polygon(fin, fill=(38, 58, 78, 255), outline=outline)

# hull
hull = [(512, 196), (570, 380), (604, 560), (580, 700), (512, 768), (444, 700), (420, 560), (454, 380)]
draw.polygon(hull, fill=(203, 231, 243, 255), outline=outline)
# inner hull highlight
inner = [(512, 236), (552, 392), (572, 556), (548, 682), (512, 730), (476, 682), (452, 556), (472, 392)]
draw.polygon(inner, fill=(238, 251, 255, 255))
# cockpit
draw.ellipse([474, 330, 550, 482], fill=(15, 70, 104, 255), outline=(225, 252, 255, 255), width=4)
draw.ellipse([488, 344, 530, 428], fill=(105, 238, 255, 255))
draw.ellipse([494, 350, 518, 386], fill=(240, 255, 255, 255))
# nose accent
draw.polygon([(512, 212), (528, 270), (512, 300), (496, 270)], fill=(111, 232, 255, 255))
# panel line
draw.line([(512, 500), (512, 664)], fill=(80, 150, 180, 150), width=3)

# Engine nozzles.
for ex in (452, 572):
    draw.rounded_rectangle([ex - 25, 680, ex + 25, 724], radius=12, fill=(18, 30, 40, 255), outline=(150, 235, 255, 180), width=3)
    draw.ellipse([ex - 13, 688, ex + 13, 714], fill=(130, 244, 255, 255))

# Small amber accent line.
draw.line([(330, 600), (420, 584)], fill=(255, 191, 94, 230), width=6)
draw.line([(604, 584), (694, 600)], fill=(255, 191, 94, 230), width=6)

img = img.resize((512, 512), Image.LANCZOS)
img.save('build/icon.png')
sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
img.save('build/icon.ico', sizes=sizes)
print('wrote build/icon.png and build/icon.ico')
