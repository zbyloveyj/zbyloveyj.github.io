#!/usr/bin/env python3
"""Static GitHub Pages preflight: semantic pages, local links, metadata and citations."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
from xml.etree import ElementTree as ET
import re, json, subprocess, sys
R=Path(__file__).resolve().parents[1]
PAGES=['index.html','research.html','publications.html','projects.html','cv.html','404.html']
class Analyzer(HTMLParser):
 def __init__(self):super().__init__();self.links=[];self.ids=[]
 def handle_starttag(self,tag,attrs):
  d=dict(attrs)
  if d.get('id'):self.ids.append(d['id'])
  if tag in ('a','script','link','img'):
   val=d.get('href') or d.get('src')
   if val:self.links.append((tag,val))
def validate():
 for name in PAGES:
  f=R/name
  if not f.is_file():raise AssertionError('Missing '+name)
  content=f.read_text('utf-8');parser=Analyzer();parser.feed(content)
  if len(parser.ids)!=len(set(parser.ids)):raise AssertionError('Duplicate IDs in '+name)
  for tag,link in parser.links:
   if link.startswith('#'):
    if link[1:] and link[1:] not in parser.ids:raise AssertionError(f'{name}: dead fragment {link}')
    continue
   parsed=urlsplit(link)
   if parsed.scheme or parsed.netloc or link.startswith('//'):continue
   target=(f.parent/unquote(parsed.path)).resolve()
   if target.is_dir():target=target/'index.html'
   if not target.is_relative_to(R) or not target.is_file():raise AssertionError(f'{name}: broken local {tag} link {link}')
   if parsed.fragment and target.suffix.lower()=='.html':
    p=Analyzer();p.feed(target.read_text('utf-8'))
    if parsed.fragment not in p.ids:raise AssertionError(f'{name}: {link} invalid fragment')
  if name in ('research.html','publications.html','projects.html'):
   for x in ('class="inner-hero"','id="main-nav"','assets/v3.js'):
    if x not in content:raise AssertionError(f'{name}: missing {x}')
 for key in ('about','research','publications','open-science','journey','beyond','contact'):
  if f'id="{key}"' not in (R/'index.html').read_text('utf-8'):
   raise AssertionError('Homepage missing '+key)
 for f in ('assets/data.js','assets/site.js','assets/v3.js'):
  subprocess.run(['node','--check',str(R/f)],check=True)
 output=subprocess.run(['node','-e','global.window={};require(process.argv[1]);console.log(JSON.stringify(global.window.ACADEMIC_DATA))',str(R/'assets/data.js')],capture_output=True,text=True,check=True)
 papers=json.loads(output.stdout)['publications']
 if len(papers)!=10 or len({p['doi'] for p in papers})!=10:raise AssertionError('Incorrect DOI count or duplicates')
 for p in papers:
  if not re.fullmatch(r'10\.\d{4,9}/\S+',p['doi']):raise AssertionError('Malformed DOI '+p['doi'])
  if not p.get('fullAuthors') or not p.get('key') or not p.get('focusZh'):
   raise AssertionError('Incomplete full-author metadata '+p['doi'])
 bib=(R/'assets/Baoyuan_Zhu_Selected_Publications.bib').read_text('utf-8')
 ris=(R/'assets/Baoyuan_Zhu_Selected_Publications.ris').read_text('utf-8')
 if bib.count('@article{')!=10 or ris.count('TY  - JOUR')!=10 or ris.count('ER  -')!=10:
  raise AssertionError('Citation export is incomplete')
 for p in papers:
  if p['doi'] not in bib or p['doi'] not in ris:raise AssertionError('DOI missing in export '+p['doi'])
  if p['fullAuthors'][0] not in bib:raise AssertionError('First author absent in BibTeX')
 if len(re.findall(r'class="project-detail"',(R/'projects.html').read_text('utf-8')))!=5:raise AssertionError('Expected five projects')
 for img in ('assets/favicon.svg','assets/ecology-plate.svg'):ET.parse(R/img)
 if (R/'assets/Baoyuan_Zhu_Academic_CV.pdf').read_bytes()[:5]!=b'%PDF-':raise AssertionError('PDF invalid')
 ET.parse(R/'sitemap.xml')
 for label in ('telephone','birth date','home address'):
  if label in (R/'index.html').read_text('utf-8').lower():raise AssertionError('Unnecessary private info')
 # V4 regression checks: release all linked scholarly resources.
 for page in ('index.html','research.html','publications.html','projects.html'):
  html=(R/page).read_text('utf-8')
  if 'assets/editorial-v4.css' not in html or 'href="cv.html"' not in html:
   raise AssertionError('Missing editorial v4 CSS or CV link: '+page)
 if 'graduate-research-handbook/' not in (R/'index.html').read_text('utf-8') or 'graduate-research-handbook/' not in (R/'projects.html').read_text('utf-8'):
  raise AssertionError('Graduate guide must be linked from homepage and open-science page')
 if 'graduate-research-handbook/' not in (R/'sitemap.xml').read_text('utf-8'):
  raise AssertionError('Graduate guide missing from sitemap')
 for fname in ('assets/editorial-v4.css','graduate-research-handbook/index.html','graduate-research-handbook/data/catalog.json','graduate-research-handbook/assets/app.js'):
  if not (R/fname).is_file():raise AssertionError('Missing resource: '+fname)
 if 'resetPubFilters' not in (R/'assets/site.js').read_text('utf-8'):
  raise AssertionError('Missing publication search reset')
 if 'id="pub-clear"' not in (R/'publications.html').read_text('utf-8') or 'id="pub-reset"' not in (R/'publications.html').read_text('utf-8'):
  raise AssertionError('Missing publication reset controls')
 print('PASS: 6 HTML pages; 10 verified DOI records; full-author BibTeX/RIS; 5 projects; internal links; JS syntax; PDF and illustrations.')
if __name__=='__main__':validate()
