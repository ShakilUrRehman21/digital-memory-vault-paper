"""Renders figsrc/fig1.svg and fig2.svg to Fig1.pdf and Fig2.pdf with Playwright (pip install playwright; playwright install chromium).
Usage: python3 render_diagrams.py fig1 fig2"""
import sys
from playwright.sync_api import sync_playwright
def render(svg, pdf, png):
    s = open(svg).read()
    import re
    w = re.search(r'width="([\d.]+)mm"', s).group(1); h = re.search(r'height="([\d.]+)mm"', s).group(1)
    html = f"<html><head><style>@page{{size:{w}mm {h}mm;margin:0}}html,body{{margin:0;padding:0}}svg{{display:block}}</style></head><body>{s}</body></html>"
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(device_scale_factor=4)
        pg.set_content(html)
        pg.pdf(path=pdf, width=f"{w}mm", height=f"{h}mm", print_background=True)
        pg.set_viewport_size({"width": int(float(w)*3.78)+1, "height": int(float(h)*3.78)+1})
        pg.screenshot(path=png, full_page=True)
        b.close()
for a in sys.argv[1:]:
    render(f"figsrc/{a}.svg", f"{a.capitalize()}.pdf", f"preview-{a}.png")
