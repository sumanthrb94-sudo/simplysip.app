"""Generate 10 casual-style Instagram image posts (1080x1080) using product images."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

REPO = Path(__file__).resolve().parent.parent
IMG_DIR = REPO / "public" / "images"
OUT_DIR = REPO / "public" / "posts"
OUT_DIR.mkdir(parents=True, exist_ok=True)

FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

SIZE = 1080
BULLET = "•"

POSTS = [
    {"file": "hulk-greens.webp", "name": "Hulk Greens",   "ingr": "Green Apple · Cucumber · Ginger · Spinach · Lime", "tag": "your daily green fix",      "price": 119, "bg": (168, 196, 154), "ink": (40, 60, 35)},
    {"file": "melon-booster.webp","name": "Melon Booster", "ingr": "Watermelon · Cucumber · Mint",                    "tag": "summer in a glass",         "price": 89,  "bg": (245, 175, 175), "ink": (90, 30, 40)},
    {"file": "abc.webp",          "name": "ABC",           "ingr": "Apple · Beetroot · Carrot",                       "tag": "the original glow-up",      "price": 109, "bg": (216, 128, 128), "ink": (60, 20, 25)},
    {"file": "a-star.webp",       "name": "A-Star",        "ingr": "Apple · Pomegranate",                             "tag": "tart & sweet, easy win",    "price": 119, "bg": (196, 78, 78),   "ink": (250, 240, 235)},
    {"file": "amg.webp",          "name": "AMG",           "ingr": "Apple · Mint · Ginger",                           "tag": "the wake-up juice",         "price": 119, "bg": (159, 203, 168), "ink": (30, 60, 40)},
    {"file": "ganga-jamuna.webp", "name": "Ganga Jamuna",  "ingr": "Orange · Mosambi",                                "tag": "pure citrus, nothing else", "price": 109, "bg": (242, 166, 90),  "ink": (70, 35, 10)},
    {"file": "coco-fresh.webp",   "name": "Coco Fresh",    "ingr": "Tender Coconut Water",                            "tag": "just coconut. that's it.",  "price": 119, "bg": (240, 230, 210), "ink": (60, 50, 35)},
    {"file": "sunshine-sip.webp", "name": "Sunshine Sip",  "ingr": "Mosambi",                                         "tag": "sweet lime, simple",        "price": 109, "bg": (242, 220, 140), "ink": (70, 55, 20)},
    {"file": "golden-sunrise.webp","name": "Golden Sunrise","ingr": "Orange",                                         "tag": "morning orange. cold.",     "price": 119, "bg": (243, 156, 92),  "ink": (70, 35, 15)},
    {"file": "orchard-gold.webp", "name": "Orchard Gold",  "ingr": "Apple",                                           "tag": "an apple a day, juiced",    "price": 129, "bg": (216, 92, 92),   "ink": (250, 240, 235)},
]


def fit_text(draw, text, font_path, max_w, start_size, min_size=28):
    size = start_size
    while size > min_size:
        f = ImageFont.truetype(font_path, size)
        if draw.textlength(text, font=f) <= max_w:
            return f
        size -= 2
    return ImageFont.truetype(font_path, min_size)


def make_post(p):
    bg = p["bg"]
    ink = p["ink"]
    img = Image.new("RGB", (SIZE, SIZE), bg)
    draw = ImageDraw.Draw(img, "RGBA")

    # Soft off-white plate where the product sits — gives the "casual home photo" feel
    plate_pad = 80
    plate_box = (plate_pad, 220, SIZE - plate_pad, 820)
    draw.rounded_rectangle(plate_box, radius=40, fill=(255, 255, 255, 60))

    # Product image, centered in plate, preserving aspect
    src_path = IMG_DIR / p["file"]
    product = Image.open(src_path).convert("RGBA")
    target_h = 560
    ratio = target_h / product.height
    target_w = int(product.width * ratio)
    if target_w > SIZE - plate_pad * 2 - 40:
        target_w = SIZE - plate_pad * 2 - 40
        ratio = target_w / product.width
        target_h = int(product.height * ratio)
    product = product.resize((target_w, target_h), Image.LANCZOS)
    px = (SIZE - target_w) // 2
    py = 240 + (560 - target_h) // 2
    img.paste(product, (px, py), product)

    # Top: brand mark + handle (handle sits under, away from the price chip)
    tag_font = ImageFont.truetype(FONT_REG, 32)
    draw.text((80, 90), "simplysip", font=tag_font, fill=ink)
    handle_font = ImageFont.truetype(FONT_REG, 24)
    draw.text((80, 130), "@simplysip.app", font=handle_font, fill=ink)

    # Thin divider
    draw.rectangle((80, 178, SIZE - 80, 180), fill=ink)

    # Product name — bold but not screaming
    name_font = fit_text(draw, p["name"], FONT_BOLD, SIZE - 160, 96)
    name_w = draw.textlength(p["name"], font=name_font)
    draw.text(((SIZE - name_w) // 2, 850), p["name"], font=name_font, fill=ink)

    # Tagline — lowercase, casual
    tag_font_2 = fit_text(draw, p["tag"], FONT_REG, SIZE - 200, 42)
    tag_w = draw.textlength(p["tag"], font=tag_font_2)
    draw.text(((SIZE - tag_w) // 2, 950), p["tag"], font=tag_font_2, fill=ink)

    # Ingredients line — small, faint
    ing_font = fit_text(draw, p["ingr"], FONT_REG, SIZE - 240, 26, min_size=18)
    ing_w = draw.textlength(p["ingr"], font=ing_font)
    draw.text(((SIZE - ing_w) // 2, 1005), p["ingr"], font=ing_font, fill=ink)

    # Price chip — bottom right corner, simple rectangle
    price_text = f"₹{p['price']}"
    price_font = ImageFont.truetype(FONT_BOLD, 44)
    pw = draw.textlength(price_text, font=price_font)
    chip_w = int(pw + 60)
    chip_h = 80
    chip_x = SIZE - chip_w - 60
    chip_y = 60
    draw.rounded_rectangle((chip_x, chip_y, chip_x + chip_w, chip_y + chip_h), radius=12, fill=ink)
    bg_on_ink = (255, 255, 255) if sum(ink[:3]) < 380 else (40, 40, 40)
    draw.text((chip_x + 30, chip_y + 14), price_text, font=price_font, fill=bg_on_ink)

    return img


def main():
    out_files = []
    for i, p in enumerate(POSTS, 1):
        img = make_post(p)
        out = OUT_DIR / f"{i:02d}-{p['file'].replace('.webp', '')}.png"
        img.save(out, "PNG", optimize=True)
        out_files.append(out)
        print(out)
    print(f"\nGenerated {len(out_files)} posts in {OUT_DIR}")


if __name__ == "__main__":
    main()
