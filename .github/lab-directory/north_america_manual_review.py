#!/usr/bin/env python3
"""Reviewed priority additions and field evidence from official profiles.

Facts reviewed 2026-10-21 via official web reads. Re-run regenerates the same
review snapshot; it does not represent a new verification of the sources.
"""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parent
DATE='2026-10-21'
AT='2026-10-21'

def row(name,institution,country,city,url,title,fields,role,summary,excerpt):
    return dict(name=name,institution=institution,country=country,city=city,url=url,
        sourceUrl=url,sourceTitle=title,fields=fields,role=role,summary=summary,
        sourceExcerpt=excerpt,evidenceLevel='official_directory',verifiedAt=DATE,
        directoryVerifiedAt=AT,reviewMethod='manual_official_profile_web_read',
        evidenceScope='官网个人页核验身份与研究方向；未核验岗位、经费或排名。')

rows=[
row('Bonnie Berger','Massachusetts Institute of Technology','美国','Cambridge',
    'https://www.csail.mit.edu/person/bonnie-berger','MIT CSAIL — Bonnie Berger',
    ['计算生物学','基因组学与基因编辑'],'Professor; PI, Computation and Biology group',
    '计算生物学算法；功能基因组学与基因型—表型建模。',
    'head of the Computation and Biology group'),
row('Manolis Kellis','Massachusetts Institute of Technology','美国','Cambridge',
    'https://www.csail.mit.edu/person/manolis-kellis','MIT CSAIL — Manolis Kellis',
    ['计算生物学','基因组学与基因编辑'],'Professor; PI, Computational Biology Group',
    '计算生物学、基因组学、表观基因组学、基因调控及基因组演化。',
    'computational biology, genomics, epigenomics, gene regulation, and genome evolution'),
row('David Gifford','Massachusetts Institute of Technology','美国','Cambridge',
    'https://www.eecs.mit.edu/people/david-gifford/','MIT EECS — David Gifford',
    ['AI与生物医学'],'Professor of CS and Engineering (Post-Tenure)',
    '医疗与生命科学中的人工智能、机器学习。官网标为 Post-Tenure 教授。',
    'AI for Healthcare and Life Sciences'),
row('Barbara Engelhardt','Stanford University','美国','Stanford',
    'https://dbds.stanford.edu/people/barbara-engelhardt/',
    'Stanford Biomedical Data Science — Barbara Engelhardt',
    ['计算生物学','基因组学与基因编辑'],'Professor of Biomedical Data Science',
    '生物医学数据建模；人群遗传学、基因组技术和演化生物学。',
    'Human Population Genetics'),
row('Jure Leskovec','Stanford University','美国','Stanford',
    'https://profiles.stanford.edu/jure-leskovec?tab=bio','Stanford Profiles — Jure Leskovec',
    ['AI与生物医学','计算生物学'],'Professor of Computer Science',
    '图神经网络、机器学习及计算生物医学，研究涉及药物发现。',
    'computational biomedicine with the focus on drug discovery'),
row('Stephen Quake','ETH Zürich / D-BSSE / BRCCH','瑞士','Basel',
    'https://quakelab.stanford.edu/',
    'ETH D-BSSE — Stephen Quake becoming faculty member',
    ['单细胞与空间组学','基因组学与基因编辑'],'Full Professor of Biophysics and Biomedical Engineering',
    '微流控、分子诊断与单细胞组学；ETH 公告明确 2026 年 8 月 1 日加入 D-BSSE。',
    'Stephen will start on 1 August 2026.')
]
rows[2]['opportunityNote']='MIT CSB 项目页面标注 Professor Post Tenure — Not taking students；这里只记录研究身份，不据此推断未来招生。'
rows[2]['opportunitySourceUrl']='https://csbphd.mit.edu/faculty/david-k-gifford/'
rows[3]['additionalResearchSources']=[dict(url='https://statistics.stanford.edu/people/barbara-engelhardt',fields=['计算生物学'],basis='Official profile describes models for structured biomedical data.')]
rows[-1]['sourceUrl']='https://bsse.ethz.ch/news-and-events/d-bsse-news/2026/05/stephen-quake-becoming-faculty-member.html'
rows[-1]['affiliationNote']='ETH D-BSSE 官方 2026-05-27 公告：2026-08-01 加入 ETH；实验室网址由该公告直接链接到 Stanford 域名。'
rows[-1]['additionalOfficialSources']=[dict(url='https://profiles.stanford.edu/stephen-quake',sourceUrl='https://profiles.stanford.edu/stephen-quake',institution='Stanford University (previous / continuing listed affiliation)')]
rows[-1]['identityMergeEvidence']=rows[-1]['sourceUrl']

patches=[
 dict(name='Hani Goodarzi',institution='Arc Institute / partner universities',
      sourceUrl='https://arcinstitute.org/news/hani-goodarzi-virtual-cell-quest',
      sourceTitle='Arc — Hani Goodarzi on his quest to build a virtual cell',
      fields=['AI虚拟细胞','单细胞与空间组学'],
      sourceExcerpt='Our virtual cell model, State, is all about perturbations.',
      summary='计算生物学与 AI；利用单细胞数据建模细胞对药物及基因扰动的响应。'),
 dict(name='Patrick Hsu',institution='Arc Institute / partner universities',
      sourceUrl='https://arcinstitute.org/labs/hsulab',sourceTitle='Arc — Hsu Lab research focus',
      fields=['AI虚拟细胞','AI与生物医学','合成生物学','基因组学与基因编辑'],
      sourceExcerpt='first steps towards simulating a virtual cell',
      summary='基因组基础模型与虚拟细胞方向；CRISPR、基因组设计及合成生物学。'),
 dict(name='Rahul Satija',institution='New York Genome Center / affiliated universities',
      sourceUrl='https://www.nygenome.org/science-technology/faculty-labs/satija-lab/',
      sourceTitle='NYGC — Satija Lab',
      fields=['AI与生物医学','单细胞与空间组学'],
      sourceExcerpt='novel statistical and machine learning-based methods',
      summary='单细胞基因组学及细胞异质性；结合统计、机器学习和实验研究。'),
 dict(name='Anshul Kundaje',institution='Stanford University',
      sourceUrl='https://profiles.stanford.edu/anshul-kundaje',sourceTitle='Stanford Profiles — Anshul Kundaje',
      fields=['AI与生物医学','计算生物学','基因组学与基因编辑'],
      sourceExcerpt='develops machine learning models of gene regulation',
      summary='基因调控的机器学习与深度学习；解码 DNA、RNA 序列及遗传变异。')
]
for p in patches:
    p.update(verifiedAt=DATE,reviewedAt=AT,reviewMethod='manual_official_profile_web_read')
(ROOT/'north_america_priority_additions.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
(ROOT/'north_america_research_evidence.json').write_text(json.dumps(patches,ensure_ascii=False,indent=2)+'\n')
print({'additions':len(rows),'research_enrichments':len(patches)})
