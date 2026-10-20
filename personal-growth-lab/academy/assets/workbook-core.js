'use strict';
(()=>{
const A=window.ACADEMY;
if(!A||A.courses.length!==10)throw Error('Load the existing ten courses before the workbook edition.');
A.version='2026.10.20.3-workbook';
A.editionName='实操教材版 V3';
A.resources.workbook_csv={name:'Python 官方：CSV 文件读写',url:'https://docs.python.org/3/library/csv.html'};
A.resources.workbook_gradient={name:'PyTorch 官方：自动求导',url:'https://docs.pytorch.org/tutorials/beginner/basics/autogradqs_tutorial.html'};
A.resources.workbook_plot={name:'Matplotlib 官方：绘图入门',url:'https://matplotlib.org/stable/users/explain/quick_start.html'};
for(const c of A.courses){
 c.note+=' 本版新增完整教学样例和参考作答；同一主题的材料会在理解、练习与修改阶段复用，不以重复阅读等同新增能力。';
 if(c.id==='english')c.intro='从逐句中英对照、完整改稿与现场问答，走到自己的学术表达。每个场景连续完成理解、重构和脱稿。';
 if(c.id==='coding')c.intro='从执行流程、变量与断言读懂代码，完成基线和扩展解答，再形成自己的可运行项目。';
 if(c.id==='writing')c.intro='读完整作品，看逐段批注，再动手起草与重写。十二个主题，四十八次连续的写作工作坊。';
}
})();