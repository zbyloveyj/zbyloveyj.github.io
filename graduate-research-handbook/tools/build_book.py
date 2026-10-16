#!/usr/bin/env python3
"""Create the full Chinese handbook as a printable PDF and editable Word file."""
from pathlib import Path
from html import escape
import json
import re
from bs4 import BeautifulSoup, NavigableString, Tag
import markdown
from weasyprint import HTML
from docx import Document
from docx.shared import Cm, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "downloads"
SOURCE = OUT / "complete-manuscript.md"
source = SOURCE.read_text(encoding="utf-8")
catalog = json.loads((ROOT / "data" / "catalog.json").read_text(encoding="utf-8"))

def validate():
    heads = re.findall(r"^# 第(?:\d+|[零一二三四五六七八九十]+)章",source,re.M)
    if len(heads) != 50: raise ValueError("Source must contain exactly 50 chapters")
    if len(catalog["volumes"]) != 9: raise ValueError("Missing book volumes")

def html_body():
    txt = markdown.markdown(source, extensions=["tables","fenced_code"])
    soup = BeautifulSoup(txt, "html.parser")
    chap = 0
    parts = 0
    for h in soup.find_all("h1"):
        label = h.get_text(" ",strip=True)
        if label == "从读研到做研究":
            h.decompose()
            continue
        if re.match(r"^第[一二三四五六七八九]编",label):
            parts += 1
            h["class"] = "part-heading"
            h["id"] = "part-" + str(parts)
        elif re.match(r"^第(?:\d+|[零一二三四五六七八九十]+)章",label):
            chap += 1
            h["class"] = "chapter-heading"
            h["id"] = "chapter-" + str(chap)
        elif "前言" in label:
            h["class"] = "front-heading"
    if chap != 50 or parts != 9:
        raise ValueError(f"HTML conversion lost chapters/parts: {chap}/{parts}")
    return soup

def build_html(soup):
    part_chapters = []
    names = "一二三四五六七八九"
    for i,title in enumerate(catalog["volumes"],1):
        part_chapters.append("<div class='toc-part'>第"+names[i-1]+"编　"+escape(title)+"</div>")
        for ch in catalog["chapters"]:
            if ch["part"]==i:
                part_chapters.append("<div class='toc-row'><span>"+str(ch["n"]).zfill(2)+"</span><a href='#chapter-"+str(ch["n"])+"'>"+escape(ch["title"])+"</a></div>")
    css = """
@page {
  size: A5;
  margin: 18mm 16mm 18mm 16mm;
  @top-right {content:"从读研到做研究";font-size:7pt;color:#5c7368;}
  @bottom-center {content: counter(page);font-size:8pt;color:#5c7368;}
}
html {font-family:"Noto Serif CJK SC","Noto Serif CJK",serif;color:#25382f;}
body {font-size:10pt;line-height:1.78;}
p {text-align:justify;margin:0 0 3.5mm;orphans:3;widows:3;overflow-wrap:anywhere;}
.cover {page-break-after:always;height:180mm;display:flex;flex-direction:column;justify-content:space-between;}
.cover .label {font-family:sans-serif;letter-spacing:.18em;color:#557d6c;font-size:9pt;}
.cover h1 {font-size:31pt;line-height:1.4;color:#263e32;margin:45mm 0 0;}
.cover p {color:#617166;text-align:left;}
.toc {page-break-after:always;}
.toc h1 {font-size:22pt;color:#263e32;margin:0 0 14mm;}
.toc-part {font-weight:bold;color:#477461;margin-top:4mm;font-size:11pt;border-top:1px solid #d9e1d7;padding-top:3mm;}
.toc-row {font-size:9pt;margin:1.4mm 0 1.4mm 3mm;}
.toc-row span {display:inline-block;width:9mm;color:#7a8d81;}
a {color:#426b57;text-decoration:none;}
h1.part-heading {page-break-before:always;page-break-after:avoid;font-size:22pt;color:#47715e;margin-top:48mm;line-height:1.6;}
h1.chapter-heading {page-break-before:always;page-break-after:avoid;font-size:17pt;line-height:1.55;color:#263e32;margin:0 0 12mm;}
h1.front-heading {page-break-before:always;font-size:19pt;color:#304e3e;}
h1:not(.part-heading):not(.chapter-heading):not(.front-heading) {font-size:16pt;page-break-before:always;color:#304e3e;}
h2 {font-size:12.2pt;color:#365e4a;margin:8mm 0 3mm;page-break-after:avoid;}
h3 {font-size:10.8pt;color:#2f4c3d;margin:5mm 0 2mm;page-break-after:avoid;}
strong {color:#263e32;}
blockquote {background:#f5f7f3;border-left:2px solid #63856f;padding:2mm 4mm;margin:5mm 0;color:#4c6153;}
ul,ol {padding-left:7mm;margin:3mm 0 5mm;}
li {margin:1.5mm 0;}
table {border-collapse:collapse;width:100%;font-size:8pt;margin:5mm 0;table-layout:fixed;}
th,td {border:.4pt solid #d5dfd6;padding:1.6mm;vertical-align:top;overflow-wrap:anywhere;}
th {background:#f0f4ee;}
pre {background:#f6f8f4;border:1px solid #e2e6df;padding:2.5mm;white-space:pre-wrap;overflow-wrap:anywhere;font-size:7.1pt;line-height:1.45;}
code {font-size:.9em;overflow-wrap:anywhere;}
hr {border:0;border-top:.5pt solid #e0e4da;margin:6mm 0;}
"""
    return "<!doctype html><html lang='zh-CN'><head><meta charset='utf-8'><style>"+css+"</style></head><body>"+(
      "<section class='cover'><div class='label'>A RESEARCHER'S FIELD GUIDE · 2026</div>"
      "<div><h1>从读研<br>到做研究</h1><p>研究生学术入门手册 · 九编五十章</p></div>"
      "<p>著 · 一心问道<br>完整版 V2.0 · 2026年10月</p></section>"
      "<section class='toc'><h1>目录</h1>"+''.join(part_chapters)+"</section>"
      +str(soup)+"</body></html>")

def add_rich(paragraph,tag):
    for node in tag.children:
        if isinstance(node,NavigableString):
            paragraph.add_run(str(node))
        elif isinstance(node,Tag):
            if node.name in ("strong","b","em","i","code"):
                run=paragraph.add_run(node.get_text())
                if node.name in ("b","strong"):run.bold=True
                if node.name in ("em","i"):run.italic=True
            else:
                paragraph.add_run(node.get_text())

def set_font(style,pt,bold=False,color=None):
    style.font.name="Noto Serif CJK SC"
    style.font.size=Pt(pt)
    style.font.bold=bold
    if color: style.font.color.rgb=RGBColor(*color)
    rpr=style.element.get_or_add_rPr()
    fonts=rpr.rFonts
    if fonts is None:
        fonts=OxmlElement("w:rFonts")
        rpr.insert(0,fonts)
    fonts.set(qn("w:eastAsia"),"Noto Serif CJK SC")

def build_word(soup,target):
    d=Document()
    d.core_properties.title="从读研到做研究"
    d.core_properties.author="一心问道"
    sec=d.sections[0]
    sec.page_width=Cm(14.8); sec.page_height=Cm(21)
    sec.left_margin=Cm(1.7);sec.right_margin=Cm(1.6)
    sec.top_margin=Cm(1.8);sec.bottom_margin=Cm(1.6)
    for name,pt,bold,color in [("Normal",10.5,False,None),("Title",27,True,(42,72,54)),("Heading 1",18,True,(42,72,54)),("Heading 2",13,True,(56,99,77)),("Heading 3",11,True,None)]:
        set_font(d.styles[name],pt,bold,color)
    d.styles["Normal"].paragraph_format.line_spacing=1.45
    d.styles["Normal"].paragraph_format.space_after=Pt(6)
    d.styles["Normal"].paragraph_format.first_line_indent=Pt(18)
    d.add_paragraph("\n\n\n\n")
    d.add_heading("从读研到做研究",0)
    p=d.add_paragraph("研究生学术入门手册\n九编五十章 · 完整版 V2.0")
    p.alignment=WD_ALIGN_PARAGRAPH.CENTER
    d.add_paragraph("\n\n\n\n")
    p=d.add_paragraph("一心问道\n2026年10月")
    p.alignment=WD_ALIGN_PARAGRAPH.CENTER
    d.add_page_break()
    d.add_heading("目录",1)
    chinese="一二三四五六七八九"
    for part,title in enumerate(catalog["volumes"],1):
        d.add_paragraph("第"+chinese[part-1]+"编　"+title,style="Heading 2")
        for ch in catalog["chapters"]:
            if ch["part"]==part:
                d.add_paragraph("第"+str(ch["n"]).zfill(2)+"章　"+ch["title"])
    d.add_page_break()
    seen=0
    for block in list(soup.children):
        if not isinstance(block,Tag):continue
        tag=block.name
        if tag=="h1":
            name=block.get_text(" ",strip=True)
            if "编" in name[:5] and name.startswith("第"):
                d.add_page_break();d.add_heading(name,1)
            elif re.match(r"^第(?:\d+|[零一二三四五六七八九十]+)章",name):
                seen+=1;d.add_page_break();d.add_heading(name,1)
            else:d.add_heading(name,1)
        elif tag in ("h2","h3"):
            d.add_heading(block.get_text(),2 if tag=="h2" else 3)
        elif tag=="p":
            p=d.add_paragraph();p.alignment=WD_ALIGN_PARAGRAPH.JUSTIFY;add_rich(p,block)
        elif tag=="blockquote":
            p=d.add_paragraph(block.get_text(" ",strip=True))
            p.style="Quote" if "Quote" in d.styles else "Normal"
        elif tag in ("ul","ol"):
            sty="List Bullet" if tag=="ul" else "List Number"
            for li in block.find_all("li",recursive=False):
                d.add_paragraph(li.get_text(" ",strip=True),style=sty)
        elif tag=="pre":
            p=d.add_paragraph(block.get_text())
            p.style="No Spacing"
            for run in p.runs:run.font.name="Consolas";run.font.size=Pt(8)
        elif tag=="table":
            rows=block.find_all("tr")
            if not rows:continue
            first=rows[0].find_all(["td","th"],recursive=False)
            if not first:continue
            t=d.add_table(rows=0,cols=len(first));t.style="Table Grid"
            for row in rows:
                cells=row.find_all(["td","th"],recursive=False)
                dest=t.add_row().cells
                for i,c in enumerate(cells[:len(dest)]):dest[i].text=c.get_text(" ",strip=True)
        elif tag=="hr":
            d.add_paragraph("")
    if seen!=50:raise ValueError(f"Word output has {seen} chapters")
    footer=sec.footer.paragraphs[0];footer.alignment=WD_ALIGN_PARAGRAPH.CENTER
    footer.add_run("— ")
    fld=OxmlElement("w:fldSimple");fld.set(qn("w:instr"),"PAGE")
    footer._p.append(fld)
    footer.add_run(" —")
    d.save(target)

def main():
    validate()
    soup=html_body()
    page=build_html(soup)
    pdf=OUT/"complete-book.pdf"
    word=OUT/"complete-book.docx"
    print("Rendering complete PDF...")
    HTML(string=page,base_url=str(ROOT)).write_pdf(str(pdf))
    print("Generating editable Word...")
    build_word(soup,word)
    from pypdf import PdfReader
    pages=len(PdfReader(str(pdf)).pages)
    if pages<100 or pdf.stat().st_size<100_000 or word.stat().st_size<50_000:
        raise ValueError(f"Unexpected output sizes: {pages}, {pdf.stat().st_size}, {word.stat().st_size}")
    print(f"SUCCESS: {pages} PDF pages; PDF {pdf.stat().st_size:,} bytes; DOCX {word.stat().st_size:,} bytes")

if __name__=="__main__":
    main()
