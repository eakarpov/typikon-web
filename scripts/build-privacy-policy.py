#!/usr/bin/env python3
"""Build public/privacy-policy.pdf from docs/privacy-policy.txt (requires reportlab).

Uses local Cyrillic fonts. Override with --font and --bold-font on other systems.
"""
from argparse import ArgumentParser
from html import escape
from pathlib import Path
import re

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer


def font_path(explicit, candidates):
    if explicit:
        path = Path(explicit)
        if not path.is_file():
            raise SystemExit(f"Font does not exist: {path}")
        return str(path)
    for candidate in candidates:
        if Path(candidate).is_file():
            return candidate
    raise SystemExit("Install Cyrillic TrueType fonts or pass --font and --bold-font")


def main():
    root = Path(__file__).resolve().parents[1]
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=root / "docs/privacy-policy.txt")
    parser.add_argument("--output", type=Path, default=root / "public/privacy-policy.pdf")
    parser.add_argument("--font")
    parser.add_argument("--bold-font")
    args = parser.parse_args()
    regular = font_path(args.font, [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
    ])
    bold = font_path(args.bold_font, [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    ])
    pdfmetrics.registerFont(TTFont("Policy", regular))
    pdfmetrics.registerFont(TTFont("PolicyBold", bold))
    body = ParagraphStyle("Body", fontName="Policy", fontSize=10.5, leading=15,
                          textColor=colors.HexColor("#242424"), spaceAfter=8)
    heading = ParagraphStyle("Heading", parent=body, fontName="PolicyBold",
                             fontSize=12, leading=16, spaceBefore=13,
                             spaceAfter=8, keepWithNext=True)
    title = ParagraphStyle("Title", parent=heading, fontSize=20, leading=25,
                           spaceBefore=0, spaceAfter=10)
    subtitle = ParagraphStyle("Subtitle", parent=body, fontSize=11, leading=16,
                              textColor=colors.HexColor("#666666"), spaceAfter=4)
    text = args.source.read_text(encoding="utf-8").splitlines()
    if len(text) < 4 or not text[0].startswith("Политика"):
        raise SystemExit("Unexpected policy source")
    story = [Paragraph(escape(text[0]), title),
             Paragraph(escape(text[1]), subtitle),
             Paragraph(escape(text[2]), subtitle), Spacer(1, 5 * mm)]
    for line in text[3:]:
        if not line.strip():
            continue
        style = heading if re.match(r"^\d+\. ", line) else body
        story.append(Paragraph(escape(line), style))

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor("#dddddd"))
        canvas.line(20 * mm, 17 * mm, A4[0] - 20 * mm, 17 * mm)
        canvas.setFont("Policy", 8)
        canvas.setFillColor(colors.HexColor("#777777"))
        canvas.drawString(20 * mm, 12 * mm, text[1] + " | " + text[2])
        canvas.drawRightString(A4[0] - 20 * mm, 12 * mm, str(doc.page))
        canvas.restoreState()

    args.output.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(str(args.output), pagesize=A4, rightMargin=20 * mm,
                            leftMargin=20 * mm, topMargin=19 * mm,
                            bottomMargin=24 * mm, title=text[0],
                            author="Карпов Егор Андреевич", lang="ru-RU")
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print(args.output)


if __name__ == "__main__":
    main()
