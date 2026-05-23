"""Generate 10 SimplySip-aesthetic Instagram posts (1080x1080) using product images.

Matches the simplysip.in design system: ivory bg, ink/ash type, wide-tracked uppercase
labels, dark pill price chip, Italiana script accent, Sora display, Manrope body.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

REPO = Path(__file__).resolve().parent.parent
IMG_DIR = REPO / "public" / "images"
OUT_DIR = REPO / "public" / "posts"
FONT_DIR = Path(__file__).resolve().parent / "fonts"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Site palette (from tailwind.config.js + src/index.css)
IVORY     = (251, 250, 247)   # #FBFAF7
PORCELAIN = (244, 241, 236)   # #F4F1EC
INK       = (29, 28, 26)      # #1D1C1A
ASH       = (111, 106, 99)    # #6F6A63
BRAND     = (198, 160, 90)    # #C6A05A
HAIRLINE  = (29, 28, 26, 25)  # ink @ ~10%

SIZE = 1080

MANROPE  = str(FONT_DIR / "Manrope-Regular.ttf")
SORA     = str(FONT_DIR / "Sora-Bold.ttf")
ITALIANA = str(FONT_DIR / "Italiana-Regular.ttf")

POSTS = [
    {"file": "hulk-greens.webp",   "name": "Hulk Greens",    "ingr": "Green Apple · Cucumber · Ginger · Spinach · Lime", "tag": "Your daily green",      "day": "Day 01", "price": 119, "mrp": 159},
    {"file": "melon-booster.webp", "name": "Melon Booster",  "ingr": "Watermelon · Cucumber · Mint",                    "tag": "Summer, bottled",       "day": "Day 02", "price": 89,  "mrp": 119},
    {"file": "abc.webp",           "name": "ABC",            "ingr": "Apple · Beetroot · Carrot",                       "tag": "The original glow",     "day": "Day 03", "price": 109, "mrp": 149},
    {"file": "a-star.webp",        "name": "A-Star",         "ingr": "Apple · Pomegranate",                             "tag": "Tart, gently sweet",    "day": "Day 04", "price": 119, "mrp": 159},
    {"file": "amg.webp",           "name": "AMG",            "ingr": "Apple · Mint · Ginger",                           "tag": "The wake-up",           "day": "Day 05", "price": 119, "mrp": 159},
    {"file": "ganga-jamuna.webp",  "name": "Ganga Jamuna",   "ingr": "Orange · Mosambi",                                "tag": "Pure citrus",           "day": "Day 06", "price": 109, "mrp": 149},
    {"file": "coco-fresh.webp",    "name": "Coco Fresh",     "ingr": "Tender Coconut Water",                            "tag": "Nothing added",         "day": "Day 07", "price": 119, "mrp": 159},
    {"file": "sunshine-sip.webp",  "name": "Sunshine Sip",   "ingr": "Mosambi",                                         "tag": "Sweet lime, simply",    "day": "Day 08", "price": 109, "mrp": 149},
    {"file": "golden-sunrise.webp","name": "Golden Sunrise", "ingr": "Orange",                                          "tag": "Morning, cold-pressed", "day": "Day 09", "price": 119, "mrp": 159},
    {"file": "orchard-gold.webp",  "name": "Orchard Gold",   "ingr": "Apple",                                           "tag": "An orchard in a glass", "day": "Day 10", "price": 129, "mrp": 179},
]


def load_font(path, size, weight=None):
    f = ImageFont.truetype(path, size)
    if weight is not None:
        try:
            f.set_variation_by_name(weight)
        except Exception:
            pass
    return f


def tracked_text(draw, xy, text, font, fill, tracking_em=0.0):
    """Draw text with letter-spacing in em units (e.g. 0.4 = 40% of font size between chars)."""
    x, y = xy
    track = int(font.size * tracking_em)
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + track


def tracked_width(draw, text, font, tracking_em=0.0):
    track = int(font.size * tracking_em)
    w = sum(draw.textlength(ch, font=font) for ch in text)
    return int(w + track * max(0, len(text) - 1))


def fit_font(draw, text, font_path, max_w, start_size, min_size=24, weight=None):
    size = start_size
    while size > min_size:
        f = load_font(font_path, size, weight)
        if draw.textlength(text, font=f) <= max_w:
            return f
        size -= 2
    return load_font(font_path, min_size, weight)


def make_post(p):
    img = Image.new("RGB", (SIZE, SIZE), IVORY)
    draw = ImageDraw.Draw(img, "RGBA")

    # ── Top bar: wordmark left, day badge right ─────────────────────────────
    wm_sora = load_font(SORA, 28, "ExtraBold")
    tracked_text(draw, (72, 70), "SIMPLYSIP", wm_sora, INK, tracking_em=0.38)
    wm_italiana = load_font(ITALIANA, 30, "Regular")
    wm_w = tracked_width(draw, "SIMPLYSIP", wm_sora, 0.38)
    draw.text((72 + wm_w + 14, 64), "Elixirs", font=wm_italiana, fill=INK)

    # Day badge — right side, tiny uppercase
    day_font = load_font(MANROPE, 18, "SemiBold")
    day_w = tracked_width(draw, p["day"].upper(), day_font, 0.4)
    tracked_text(draw, (SIZE - 72 - day_w, 74), p["day"].upper(), day_font, ASH, tracking_em=0.4)

    # Hairline divider
    draw.rectangle((72, 130, SIZE - 72, 131), fill=INK + (35,))

    # ── White card with subtle border holding the product photo ─────────────
    card_pad_x = 80
    card_top = 175
    card_bot = 760
    draw.rounded_rectangle(
        (card_pad_x, card_top, SIZE - card_pad_x, card_bot),
        radius=48,
        fill=(255, 255, 255),
        outline=INK + (18,),
        width=1,
    )

    # Tiny category label inside top-left of card
    cat_font = load_font(MANROPE, 16, "Medium")
    tracked_text(draw, (card_pad_x + 34, card_top + 28), "COLD-PRESSED ELIXIR",
                 cat_font, ASH, tracking_em=0.4)

    # Product image, centered in card
    product = Image.open(IMG_DIR / p["file"]).convert("RGBA")
    target_h = 480
    ratio = target_h / product.height
    target_w = int(product.width * ratio)
    max_w = SIZE - card_pad_x * 2 - 80
    if target_w > max_w:
        target_w = max_w
        ratio = target_w / product.width
        target_h = int(product.height * ratio)
    product = product.resize((target_w, target_h), Image.LANCZOS)
    px = (SIZE - target_w) // 2
    py = card_top + 75 + (480 - target_h) // 2
    img.paste(product, (px, py), product)

    # ── Product name (Sora, ExtraBold, large) ───────────────────────────────
    name_font = fit_font(draw, p["name"], SORA, SIZE - 200, 92, weight="ExtraBold")
    name_w = draw.textlength(p["name"], font=name_font)
    draw.text(((SIZE - name_w) // 2, 800), p["name"], font=name_font, fill=INK)

    # Italiana script tagline beneath
    tag_font = load_font(ITALIANA, 44, "Regular")
    tag_w = draw.textlength(p["tag"], font=tag_font)
    draw.text(((SIZE - tag_w) // 2, 895), p["tag"], font=tag_font, fill=INK)

    # Ingredients — tiny, wide-tracked, ash
    ing_text = p["ingr"].upper().replace("·", "·")
    ing_font = fit_font(draw, ing_text, MANROPE, SIZE - 240, 16, min_size=12, weight="Medium")
    ing_w = tracked_width(draw, ing_text, ing_font, 0.28)
    tracked_text(draw, ((SIZE - ing_w) // 2, 960), ing_text, ing_font, ASH, tracking_em=0.28)

    # ── Bottom price strip ──────────────────────────────────────────────────
    # Sora lacks the ₹ glyph — render the symbol in Manrope, the number in Sora.
    mrp_sym  = load_font(MANROPE, 22, "Medium")
    mrp_num  = load_font(MANROPE, 22, "Medium")
    sym_w_m  = draw.textlength("₹", font=mrp_sym)
    num_w_m  = draw.textlength(str(p["mrp"]), font=mrp_num)
    draw.text((80, 1010), "₹", font=mrp_sym, fill=ASH)
    draw.text((80 + sym_w_m, 1010), str(p["mrp"]), font=mrp_num, fill=ASH)
    mrp_total_w = sym_w_m + num_w_m
    draw.line((80, 1024, 80 + mrp_total_w, 1024), fill=ASH, width=2)

    price_sym = load_font(MANROPE, 30, "ExtraBold")
    price_num = load_font(SORA, 32, "ExtraBold")
    px0 = 80 + mrp_total_w + 16
    sym_w_p = draw.textlength("₹", font=price_sym)
    draw.text((px0, 1006), "₹", font=price_sym, fill=INK)
    draw.text((px0 + sym_w_p + 2, 1003), str(p["price"]), font=price_num, fill=INK)

    # Right: dark pill CTA
    cta_text = "TAP TO ORDER"
    cta_font = load_font(MANROPE, 16, "SemiBold")
    cta_w = tracked_width(draw, cta_text, cta_font, 0.3)
    chip_w = cta_w + 60
    chip_h = 48
    chip_x = SIZE - 80 - chip_w
    chip_y = 1004
    draw.rounded_rectangle((chip_x, chip_y, chip_x + chip_w, chip_y + chip_h),
                           radius=chip_h // 2, fill=INK)
    tracked_text(draw, (chip_x + 30, chip_y + 16), cta_text, cta_font,
                 (255, 255, 255), tracking_em=0.3)

    return img


def main():
    for i, p in enumerate(POSTS, 1):
        img = make_post(p)
        out = OUT_DIR / f"{i:02d}-{p['file'].replace('.webp', '')}.png"
        img.save(out, "PNG", optimize=True)
        print(out)
    print(f"\nGenerated {len(POSTS)} posts in {OUT_DIR}")


if __name__ == "__main__":
    main()
