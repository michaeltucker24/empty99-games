"""Generate 1200x630 social preview images (og:image) for every built page.

Run after `npm run build`:  python3 scripts/make_og.py
Writes PNGs to public/<game>/og/<page>.png (commit them), then rebuild.
Needs Python Playwright and a Chrome/Chromium binary (set CHROME_PATH if not /usr/bin/google-chrome).
"""
import asyncio
import base64
import html
import os
import re
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
FONT = next((ROOT / "node_modules/@fontsource-variable/archivo/files").glob("archivo-latin-wght-normal.woff2"))
CHROME = os.environ.get("CHROME_PATH", "/usr/bin/google-chrome")

# Signature look per game: accent color and a sample problem for the art.
GAMES = {"mental-math": {"accent": "#2D6BFF", "badge": "7 × 8"}}
BADGES = {
    "addition": "47 + 38",
    "subtraction": "82 − 57",
    "multiplication": "12 × 15",
    "division": "84 ÷ 7",
    "percentages": "15% × 80",
    "real-life-math": "$45 + 20%",
    "worksheets": "Print it",
}


def page_info(path: Path):
    text = path.read_text(encoding="utf-8")
    h1 = re.search(r"<h1[^>]*>(.*?)</h1>", text, re.S)
    desc = re.search(r'<meta name="description" content="([^"]*)"', text)
    title = html.unescape(re.sub(r"<[^>]+>", "", h1.group(1))).strip() if h1 else "Empty 99 Studios"
    sub = html.unescape(desc.group(1)).split(". ")[0] if desc else ""
    return title, sub


def template(title: str, sub: str, accent: str, badge: str, font_b64: str) -> str:
    return f"""<!doctype html><html><head><style>
@font-face {{ font-family: A; src: url(data:font/woff2;base64,{font_b64}) format('woff2'); font-weight: 100 900; }}
* {{ margin: 0; box-sizing: border-box; }}
body {{ width: 1200px; height: 630px; background: #16161A; font-family: A, sans-serif; color: #fff; position: relative; overflow: hidden; }}
.logo {{ position: absolute; left: 64px; top: 56px; font-weight: 900; font-size: 30px; letter-spacing: .03em; }}
.logo b {{ background: #FFD23F; color: #16161A; border-radius: 10px; padding: 0 10px; margin: 0 6px; }}
.circle {{ position: absolute; right: -60px; top: 80px; width: 520px; height: 520px; border-radius: 50%; background: {accent}; border: 8px solid #FFD23F; }}
.badge {{ position: absolute; right: 70px; top: 270px; width: 400px; text-align: center; font-size: {64 if len(badge) > 9 else 96}px; font-weight: 900; transform: rotate(-6deg); }}
h1 {{ position: absolute; left: 64px; top: 170px; width: 640px; font-size: {72 if len(title) < 22 else 60}px; line-height: 1.05; font-weight: 900; letter-spacing: -0.02em; }}
p {{ position: absolute; left: 64px; top: 410px; width: 600px; font-size: 28px; line-height: 1.35; color: #D3D1C7; }}
.chip {{ position: absolute; left: 64px; bottom: 56px; background: #FFD23F; color: #16161A; font-weight: 900; font-size: 26px; padding: 10px 20px; border-radius: 99px; border: 4px solid #fff; }}
</style></head><body>
<div class="logo">EMPTY<b>99</b>STUDIOS</div>
<div class="circle"></div><div class="badge">{html.escape(badge)}</div>
<h1>{html.escape(title)}</h1><p>{html.escape(sub)}</p>
<div class="chip">Free · No sign-up · Play in your browser</div>
</body></html>"""


async def main():
    font_b64 = base64.b64encode(FONT.read_bytes()).decode()
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        page = await browser.new_page(viewport={"width": 1200, "height": 630})
        for game, look in GAMES.items():
            out_dir = ROOT / "public" / game / "og"
            out_dir.mkdir(parents=True, exist_ok=True)
            for index in sorted((DIST / game).rglob("index.html")):
                rel = index.parent.relative_to(DIST / game)
                name = "index" if str(rel) == "." else str(rel).replace("/", "-")
                title, sub = page_info(index)
                badge = BADGES.get(name, look["badge"])
                await page.set_content(template(title, sub, look["accent"], badge, font_b64))
                await page.wait_for_timeout(150)
                await page.screenshot(path=str(out_dir / f"{name}.png"))
                print("wrote", out_dir / f"{name}.png")
        await browser.close()


asyncio.run(main())
