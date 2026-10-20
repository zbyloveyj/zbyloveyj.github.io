/* Growth Academy • original learning briefs • 2026-10-20. */
'use strict';
window.ACADEMY={version:'2026.10.20.1',courses:[],resources:{
phrase:{name:'University of Manchester · Academic Phrasebank',url:'https://www.phrasebank.manchester.ac.uk/'},
python:{name:'Python 官方教程',url:'https://docs.python.org/3/tutorial/'},
sklearn:{name:'scikit-learn · Common pitfalls',url:'https://scikit-learn.org/stable/common_pitfalls.html'},
torch:{name:'PyTorch · Learn the Basics',url:'https://docs.pytorch.org/tutorials/beginner/basics/intro.html'},
writing:{name:'Purdue OWL · The Writing Process',url:'https://owl.purdue.edu/owl/general_writing/the_writing_process/index.html'},
brain:{name:'MIT OCW · Introduction to Neuroscience',url:'https://ocw.mit.edu/courses/9-01-introduction-to-neuroscience-fall-2007/'},
mne:{name:'MNE · Tutorials',url:'https://mne.tools/stable/auto_tutorials/index.html'},
plot:{name:'Matplotlib · Tutorials',url:'https://matplotlib.org/stable/tutorials/index.html'},
storms:{name:'STORMS · 微生物组研究报告规范（2021）',url:'https://pubmed.ncbi.nlm.nih.gov/34789871/'},
meta:{name:'MetaPhlAn 4 · 方法原文（2023）',url:'https://pubmed.ncbi.nlm.nih.gov/36823356/'},
gutbrain:{name:'肠道微生物神经活性潜能与抑郁 · 原文（2019）',url:'https://pubmed.ncbi.nlm.nih.gov/30718848/'},
metrics:{name:'Understanding metric-related pitfalls · 原文（2024）',url:'https://pubmed.ncbi.nlm.nih.gov/38347140/'}
}};
window.addCourse=function(c){c.lessons=c.lessons.map((l,i)=>({...l,id:i+1}));ACADEMY.courses.push(c);};
window.brief=function(title,stage,concept,task,output,refs=[],example=''){return{title,stage,minutes:45,concept,example,tasks:[`概念拆解（10分钟）：${concept}`,`动手练习（25分钟）：${task}`,`验收与复盘（10分钟）：${output}；记录一个尚未解决的问题。`],output,criteria:['交付物回应本节的具体问题','关键判断有依据，并写出适用边界','留下可再次检查的版本或记录'],refs};};
