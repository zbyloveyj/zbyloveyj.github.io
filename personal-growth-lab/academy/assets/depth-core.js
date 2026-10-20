'use strict';
/* Structured, original teaching material. Existing lesson IDs and task counts stay stable. */
(()=>{
const A=window.ACADEMY;
if(!A)throw new Error('Academy course data is required.');
A.version='2026.10.20.2-detailed';
window.DEPTH={
 section:(title,body,kind='lesson',code='')=>({title,body,kind,code}),
 course:id=>{const c=A.courses.find(x=>x.id===id);if(!c)throw Error('Unknown course '+id);return c;},
 apply(c,l,sections,minutes,checks){
  if(!sections.length||sections.some(s=>!s.title||!s.body))throw Error('Empty teaching section');
  l.detail=sections;l.minutes=minutes;l.edition=A.version;
  l.criteria=[...new Set([...l.criteria,...(checks||[])])];
 },
 route(c,l){return '#/'+c.id+'/'+l.id;},
 review:'先独立作答，再展开参考解析。参考答案用于比较推理过程，不要求措辞一致；涉及自己的研究、经历和数据时只能填写真实信息。',
 fields:'建议在下方笔记按“题目—第一次答案—对照后的修订—仍不确定的点”保留四栏。课程不替你填写完成记录，旧版已完成状态也不等于已经练过新增内容。',
 commonCheck:'能否离开本页复述关键步骤？能否指出一个常见错误并修正？交付物是否可以由另一个人按同样标准检查？尚未完成时只保存草稿，不必勾选完成。'
};
A.resources.depth_python={name:'Python 官方：错误与异常',url:'https://docs.python.org/3/tutorial/errors.html'};
A.resources.depth_validation={name:'scikit-learn 官方：交叉验证',url:'https://scikit-learn.org/stable/modules/cross_validation.html'};
A.resources.depth_mne={name:'MNE 官方：MEG/EEG分析全流程',url:'https://mne.tools/stable/auto_tutorials/intro/10_overview.html'};
A.resources.depth_writing={name:'Purdue OWL：反向提纲练习',url:'https://owl.purdue.edu/owl/general_writing/the_writing_process/reverse_outlining.html'};
})();