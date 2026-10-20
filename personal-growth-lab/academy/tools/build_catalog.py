"""Build a fixed 100-item topical PubMed bibliography. No abstracts/full text copied.
Uses official NCBI E-utilities without an API key; rate limited, bounded retries.
Existing complete catalogues are kept unchanged so learning IDs remain stable.
"""
import json, re, time, urllib.parse, urllib.request, xml.etree.ElementTree as ET
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/papers.js'
current=json.loads(OUT.read_text(encoding='utf-8').split('=',1)[1].strip().rstrip(';'))
if len(current)>=100:
    print('Keeping existing 100-item catalogue'); raise SystemExit(0)
BASE='https://eutils.ncbi.nlm.nih.gov/entrez/eutils/'
def get(endpoint, **params):
    url=BASE+endpoint+'?'+urllib.parse.urlencode(params)
    for attempt in range(4):
        time.sleep(0.45+attempt)
        try:
            req=urllib.request.Request(url,headers={'User-Agent':'GrowthAcademyBibliography/1.0 (educational metadata only)'})
            with urllib.request.urlopen(req,timeout=45) as resp: return resp.read()
        except Exception:
            if attempt==3: raise
    raise RuntimeError('unreachable')
queries=[
 ('微生物与精神健康','gut microbiome depression'),('精神分裂症与微生物','schizophrenia microbiome'),
 ('双相障碍与微生物','bipolar disorder microbiome'),('微生物与脑影像','gut microbiome neuroimaging'),
 ('代谢与免疫','microbiome metabolomics immunity'),('宏基因组方法','metagenomic profiling methods'),
 ('脑网络与异质性','brain networks psychiatric heterogeneity'),('机器学习验证','machine learning validation biomedical'),
 ('神经解码与脑机接口','brain computer interface neural decoding'),('因果推断与可复现性','causal inference reproducibility')]
seen={p['pmid'] for p in current}; groups=[]
for topic,query in queries:
    term=f'({query}) AND ("2000/01/01"[Date - Publication] : "2026/10/20"[Date - Publication]) NOT (Retracted Publication[Publication Type] OR Retraction of Publication[Publication Type] OR Published Erratum[Publication Type])'
    result=json.loads(get('esearch.fcgi',db='pubmed',term=term,retmax=35,sort='relevance',retmode='json'))
    ids=result['esearchresult']['idlist']
    if not ids: raise RuntimeError(f'No bibliography candidates for {topic}')
    tree=ET.fromstring(get('efetch.fcgi',db='pubmed',id=','.join(ids),retmode='xml'))
    records={}
    for article in tree.findall('.//PubmedArticle'):
        pmid=article.findtext('./MedlineCitation/PMID')
        a=article.find('./MedlineCitation/Article')
        if a is None or not pmid: continue
        title=''.join(a.find('ArticleTitle').itertext()) if a.find('ArticleTitle') is not None else ''
        year=a.findtext('./Journal/JournalIssue/PubDate/Year') or a.findtext('./Journal/JournalIssue/PubDate/MedlineDate') or ''
        match=re.search(r'\b(?:19|20)\d{2}\b',year); year=match.group(0) if match else year
        types=[x.text for x in a.findall('./PublicationTypeList/PublicationType') if x.text]
        if any(t in types for t in ['Retracted Publication','Retraction of Publication','Published Erratum']): continue
        if not title or not year: continue
        if 'Review' in types or 'Systematic Review' in types: kind='综述/系统综述（PubMed类型）'
        elif 'Meta-Analysis' in types: kind='Meta分析（PubMed类型）'
        else: kind='期刊文献（具体设计以全文为准）'
        records[pmid]={'pmid':pmid,'title':title,'year':year,'journal':a.findtext('./Journal/Title') or '',
           'topic':topic,'type':kind,'url':f'https://pubmed.ncbi.nlm.nih.gov/{pmid}/','verified':'2026-10-20'}
    groups.append([records[k] for k in ids if k in records])
# Round-robin adds balanced topics while preserving the four verified seed IDs.
while len(current)<100:
    before=len(current)
    for group in groups:
        while group and group[0]['pmid'] in seen: group.pop(0)
        if group and len(current)<100:
            p=group.pop(0);seen.add(p['pmid']);current.append(p)
    if len(current)==before: raise RuntimeError('Not enough unique valid references; original catalogue left unchanged')
assert len(current)==len(seen)==100
OUT.write_text('window.PAPER_CATALOG='+json.dumps(current,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
print('Verified metadata: 100 unique PubMed items; titles/metadata only, no abstracts copied.')
