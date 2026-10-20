#!/usr/bin/env python3
"""Build the same complete curriculum for web, printable HTML and embedded-font PDFs."""
from __future__ import annotations
import json,re,html,hashlib,zipfile,sys,subprocess
from pathlib import Path
from datetime import date
from weasyprint import HTML
from pypdf import PdfReader,PdfWriter
ROOT=Path(__file__).resolve().parents[1]
VERSION='2026.10.20-r3'
OUT=ROOT/'downloads'/'pdf'
OUT.mkdir(parents=True,exist_ok=True)
PRINT=ROOT/'downloads'/'print'
PRINT.mkdir(parents=True,exist_ok=True)
E=lambda s:html.escape(str(s),quote=True)

def load():
    base=[];deep={}
    for n in range(1,4):
        s=(ROOT/f'data/week{n}.js').read_text(encoding='utf8')
        data=json.loads(s.split('.concat(',1)[1].rsplit(')',1)[0]);base+=data
        s=(ROOT/f'data/deep{n}.js').read_text(encoding='utf8')
        deep.update(json.loads(s.split('{},',1)[1].rsplit(')',1)[0].strip()))
    ed={}
    for p in sorted((ROOT/'data/editorial').glob('week*.json')):ed.update(json.loads(p.read_text(encoding='utf8')))
    assert len(base)==len(ed)==21
    return [{**x,**deep[str(x['d'])],**ed[str(x['d'])]} for x in base]

STANDARD=[
 (0,4,'准备与热身','自然音量读三句各两遍；准备计时器与录音；今天只观察一种核心能力。'),
 (4,10,'理解方法与正误对照','读“本课方法”和对照案例；先说自己会怎样回答，再读修正示范，圈出三处差别。'),
 (10,23,'专项带练','前三分钟读清材料与操作要求；接着八分钟做三道带练题；最后两分钟保留首测并核对一处问题。'),
 (23,29,'完整句子','六句各做慢读、自然读两遍；挑两句合上文字重讲；句尾不吞音，不拆完整词。'),
 (29,39,'全文朗读','默读两分钟；自然读并录音约三分钟；回听两分钟；只修正两处再读三分钟。短文提前读完即进入回听。'),
 (39,47,'脱稿复述','看五个关键词准备一分钟；首录60—90秒；回听两分钟；核对关键事实；再讲一次并与首录区分。'),
 (47,56,'独立实战','先不看答案读新情境；准备30—45秒；按题目时长首录；看核对项与示范；修一处后重录。日常或科研示范可在这一时段替换使用，不必全部做。'),
 (56,60,'评分与打卡','按同一评分口径记分，记录未核验项；填写一条录音证据和下一次动作；保存与备份。')]
SPECIAL={
1:[(0,3,'准备与舒服开口','放松肩颈，以交谈音量读热身句两遍；不憋气，不长时间拉音。'),(3,7,'原始自我介绍','准备30秒，只写身份、日常、兴趣、目标四词；首录45—75秒；不看范文、不重来，回听并记录。'),(7,20,'12对易混音初测','先按顺序读全部12对，共24字；再针对两对不稳的音做字、词、句切换；首测与练后结果分开。'),(20,27,'六句完整表达','每句先慢读再自然读；挑两句不看文字说；最后连读六句并记录一处具体问题。'),(27,38,'原文朗读','默读两分钟；录完整原文约三分钟；回听两分钟；对照文字两分钟；修正两句两分钟。'),(38,46,'脱稿复述','准备一分钟，首录60—90秒；对照关键词回听两分钟；再录一遍；不按是否背出原句评分。'),(46,56,'自我介绍修正版与实战','先按四关键词重录介绍；与首录比较两分钟；随后用本课新情境做一次45—75秒表达并核对，不把示范经历说成自己的。'),(56,60,'建立初始记录','填写量表、听不清的时间点和两组待确认音；保留原始录音。今天不设必须及格的分数。')],
7:[(0,3,'自然热身','只读三句，不预先反复背诵测评题。'),(3,12,'同题与同音复测','录Day01四关键词介绍45—75秒；首读同样12对词；没有旧录音就建立当前基线。'),(12,18,'六句朗读','六句仅首读计分，修正版另记；用文字逐项核对，不以感觉代替错音证据。'),(18,29,'旧段与新文','读Day01原文第一段用于同段比较；读今日新文章用于迁移观察；两种结果分开。'),(29,37,'新文复述','准备一分钟，复述60—90秒；核对主要情节后做修正版；不把熟悉旧文的优势算作新题能力。'),(37,47,'新题独立通知','先不看答案；30秒准备，45—60秒表达；听众或自己回放核对五项信息；保存首录。'),(47,56,'对比与反馈','只比较同题同段；记录观点出现时间、填充词、听不清处；有听众则请其复述三个要点。'),(56,60,'阶段记录','写两条可比较变化或明确无基线；确定一条仍不稳定的问题和下一轮动作。')],
14:[(0,4,'准备与热身','自然读三句；准备三份首录名称；先不阅读新题答案。'),(4,17,'三项独立测评','完成观点与反对意见、证据边界、故事三项题；每题准备30秒，分别讲60—90秒、45秒、60—90秒，余时回听。'),(17,23,'六句判断与表达','六句朗读后判断哪些是观点、理由、事实或限定；语调流畅不能掩盖推理缺口。'),(23,34,'今日文章朗读','默读两分钟，首录三分钟，回听三分钟，只改两处后三分钟再读。'),(34,42,'脱稿复述','五词准备一分钟；首录60—90秒；核对后重讲，保留两版。'),(42,51,'新材料建议','读新活动容量材料，准备45秒，讲90秒；核对已知与未知，修一处再录。'),(51,56,'同题比较','有Day07同题录音时重录同题进行对照；没有则记录本次基线，不计算增幅。'),(56,60,'第二阶段打卡','标出一项结构问题、一项证据越界及其修正；填写100分自评。')],
21:[(0,4,'准备与热身','舒适音量热身；准备Day01原始录音；没有记录就注明，不补造。'),(4,10,'独立演讲提纲','只写六行：题目、主张、理由一、理由二、真实或模拟片段、收尾；先不看长示范。'),(10,17,'今日原文与同段朗读','录结业原文；再读Day01第一段，作为同段比较；挑一处清晰度问题。'),(17,23,'结业原文复述','准备一分钟，首录60—90秒；按五节点核对，短暂修正。'),(23,41,'五分钟演讲两版','首录约五分钟；回听五分钟；修改提纲三分钟；再录约五分钟。两版保留；允许合理时长浮动，不拖字。'),(41,51,'同题介绍与新追问','录Day01四关键词介绍45—75秒；与原始版同口径比较；再回答一个未预习问题，观察迁移。'),(51,60,'结业评分与后续计划','按量表评分；写一项有录音支持的变化、一项仍不稳定的能力、一项下轮练习；无早期记录的项目填不可比较。')]}
RUBRICS={
1:[('一分钟自我介绍',15),('12组易混音',24),('完整句子',12),('文章朗读',20),('脱稿复述',12),('实战表达',12),('录音与复盘',5)],
2:[('18组平翘舌对照',36),('六句完整朗读',18),('文章朗读',16),('脱稿复述',12),('情境表达',12),('录音与纠音',6)],
3:[('18组前后鼻音',36),('六句完整朗读',18),('文章朗读',16),('脱稿复述',12),('情境表达',12),('录音与纠音',6)],
4:[('n/l对照词',20),('f/h对照词',20),('完整句子',18),('文章朗读',16),('脱稿复述',10),('情境表达',10),('纠音记录',6)],
5:[('原始语速记录',10),('三档语速切换',15),('语义停顿',20),('文章朗读',20),('脱稿复述',15),('情境表达',15),('复盘记录',5)],
7:[('专项抽测',20),('介绍结构',20),('文章朗读',15),('脱稿复述',15),('独立实战',20),('对比复盘',10)],
14:[('即时答题',20),('观点结构',20),('文章朗读',15),('脱稿复述',15),('独立实战',20),('对比复盘',10)],
21:[('五分钟演讲',40),('同题自我介绍',15),('原文朗读',10),('文章复述',10),('结构与证据',15),('对比复盘',10)]}
NORMAL=[('专项练习',20),('完整句子',15),('文章朗读',20),('脱稿复述',15),('情境实战',20),('录音与复盘',10)]
RULES={
'一分钟自我介绍':'身份、日常工作、训练目的各5分；信息部分完整可记2分，缺失0分。首录计分。',
'12组易混音':'12对共24字，每字1分。正确1，错误0，待核验记“？”并单列数量；不要假定自听全对。',
'18组平翘舌对照':'18对共36字，一字1分；以首测计分，练后成绩另记。待确认音单列，不自动计正确。',
'18组前后鼻音':'18对共36字，一字1分；保持原声调，不把额外g音计为正确。未确定项单列待核验。',
'n/l对照词':'10对共20字，一字1分；先记首测，再记录两对薄弱音的迁移表现。',
'f/h对照词':'10对共20字，一字1分；镜子观察不能代替听辨，未核验项单独标记。',
'原始语速记录':'完整保存同题首录5分；记录总秒数、信息遗漏与无意义填充词5分。',
'三档语速切换':'慢、自然、稍快各5分：版本完整2、目标信息清晰2、没有强迫拉音或抢读1。',
'语义停顿':'六句不拆完整词6分；时间地点清楚6分；三档同题可比较4分；指出两处不合适停顿4分。',
'专项抽测':'同Day01的12对共24字，确认正确数÷24×12，四舍五入；完成新题不看稿首测4分；记录待核验项4分。',
'介绍结构':'身份、日常、兴趣、目标各4分；首录与修改版分开4分。',
'即时答题':'三项测试均留首录6分；观点回应反对意见4分；证据边界6分；故事有选择与结果4分。',
'观点结构':'前15秒有主张5分；理由直接支持主张5分；例子对应理由5分；限定或反对意见得到回应5分。',
'五分钟演讲':'中心明确10、结构连贯10、具体片段与事实准确10、时长与自然度10。每项完整10、部分5、缺失0；时长参考4分30秒—5分30秒，不以拖字填满计高分。',
'同题自我介绍':'与Day01同题同准备条件5分；身份日常目标清楚5分；事实真实且非背示范经历5分。',
'原文朗读':'同一段材料可比较4分；关键字清楚3分；语义停顿自然3分。',
'文章复述':'五个关键节点各2分；同义表达不扣分，实质事实错误该项0分。',
'结构与证据':'演讲中的经历真实或标明模拟5分；自述变化有记录或注明无基线5分；新追问不过度承诺5分。',
'对比复盘':'同题同段口径一致4分；至少一个带时间点的证据3分；下一步动作具体3分；无基线可以如实说明，不因缺旧记录伪造变化。'}

def rules_for(name,score,d):
    if name in RULES:return RULES[name]
    if '句' in name:
        if score==12:return '六句每句2分：完整表达1、目标字词或停顿合理1。首录计分。'
        if score==18:return '六句每句3分：目标字词1、语义完整1、停顿自然1。'
        return '六句全部练完5分（完成3—5句记3）；关键词或逻辑关系正确5分；自然连贯、不拆词5分。'
    if '朗读' in name:
        if score==20:return '不漏改关键事实5；目标字词清晰5；按语义停顿5；录音完整且不过度加速5。每项部分达到记2分。'
        if score==16:return '目标字词或关键信息8分；完整性4分；语义停顿4分。各项部分达到记一半。'
        return '字词与关键事实清晰5；完整朗读5；语义节奏自然5。各项部分达到记2分。'
    if '复述' in name:
        if score==10:return '五个关键节点各2分；同义改述可以，改变事实不计该项。'
        if score==12:return '五节点各2分，共10分；自己的收束句2分。可以提前清楚结束，不机械凑够秒数。'
        return '五节点各2分，共10分；顺序连贯3分；不照读范文2分。'
    if ('复盘' in name or '纠音' in name or '记录' in name):
        if score==5:return '首录按名称保存2；指出具体时间点与问题2；下一次动作明确1。'
        if score==6:return '首录保存2；问题定位2；修正版另存并说明改了什么2。'
        return '首录与修正版分开4；用具体句子或时间点说明问题3；下一次可执行动作3。'
    if '情境' in name or '实战' in name:
        if score==12:return '新题三项核对要求各3分，共9；准备与首录符合要求3。部分符合单项记1分。'
        if score==10:return '新题三项核对要求各3分，共9；首录不先看答案1。'
        return '新题三项核对要求各5分，共15；独立首录、修改版分开5。每项部分符合记2分。'
    return '三道带练题各5分：回应题目2、关键判断正确2、能说出修改理由1；保留独立首录与修正说明5。'

RETELL_EXTRA={
1:'他还请同伴检查新提示，并补上借出和归还日期。后来的借伞者能用自己的话复述规则，说明不是小林自以为说过就够了。',
2:'他们又让新到场的读者复述通知，发现除了数量，还需要说明到服务台登记。纠正读音不能替代补齐信息，两件事要分别检查。',
3:'休息时林明还核对了同行者的姓名，没听清的地方主动追问。出发前说明慢行路段、集合位置和离队时的联系方式，大家便知道怎样互相照应。',
4:'事情平稳后，宁宁检查了每个人的任务是否明确，后来介绍路线时也把方向与标志说开。不是不断重复地名，而是让来宾能够复述应该怎么走。',
5:'回听后阿宁发现，原来的广播不只是快，还缺少明确的新地点。她先补齐信息，再比较不同速度，最后选择重要内容清楚且不零碎的一版。',
6:'老师还用同一句话回答三种不同疑问，让大家判断到底在纠正时间、负责人还是提交内容。所有词都一样重，反而让听众抓不住重点。',
7:'小陈另外用了一段新通知，避免只凭熟悉稿子的流利程度判断进步。没有保存的旧录音他没有补写成绩，能够比较的部分才认真作对照。',
8:'负责人提醒他，开头说“关于报名我有想法”还不算结论；必须让大家知道要决定什么。尚未确认的事情可以先说未定，再说明需要核实的条件。',
9:'有人追问一次成功能否证明议程一定有效，小方承认不能。他们把主张改成小范围试行，同时观察会议是否作出了必要决定，而不只看时间长短。',
10:'讨论还指出了分母差异：按最初十二名受邀者算，与只看十一份回答算，比例并不一样。满意反馈也不能直接证明学习效果提高，这是另一项尚未测量的问题。',
11:'关键转折是小宁在立即再买和先核对之间作了选择。他后来讲故事时保留订单号与成功提示，删去不影响决定的生活细节，因此别人更容易理解经过。',
12:'学生追问检查过是否就一定正确，小吴说明还可能有记录或测量问题。他请学生不用术语复述，这才知道哪些部分已经讲懂、哪些仍需补充。',
13:'小乔只抓住三个关键词，没有在短时间里准备逐字稿。中间忘了一处细节，她换一种说法回到交付物的问题，没有把故事从头重讲。',
14:'小方还用了新材料检查能否独立区分事实与建议。朋友指出的具体问题比一句“挺好”更有用，例如例子不支持观点，或把尚未测试的事情说成确定结果。',
15:'小林没有把困难归因于小乔时间管理差，而是先问哪一项临时要求最影响她。等她说明需要之后，再提出自己能做到的帮助，没有替她作所有决定。',
16:'双方把物资、场地和引导分开，并约定核对做不完时先报告缺什么，而不是临时要求所有人到场。这个范围与退出条件让试行更容易被接受。',
17:'小赵注意到“有没有比较依据”和“是否全面替换”是两个问题，不能重复同一段答案。遇到不知道的费用，他说明需要核实，而没有猜数字。',
18:'他还把收到回复和确认完整分开，避免尚未核实的两份回复被计入已完成。汇报中的请求也从“请支持”变成了明确的候补名额决定。',
19:'她用一份事实底稿固定来源、完成状态和限制。即便面对学生，也不把统计关联说成已经确认的原因，只是换更容易理解的词说明同样边界。',
20:'被追问需要决定什么时，小田先直接回答，再回到安排。压缩篇幅时他删除背景，却保留尚未核实等限制条件，没有为了结束而保证结果。',
21:'小陈发现有几次没有录音，就如实注明缺失，没有补造分数。朋友又问一个陌生问题，他仍有绕远的地方，于是把它留给下一轮练习。'}

COMMON='本课60分钟包括准备、默读、实际开口、回听与记录，不是连续发声60分钟。两套情境选择一套即可，新题可在同一实战时段替换；拓展材料供复练，不额外强制加时。'
SAFETY='用舒服的交谈音量，不憋气、不大喊、不长时间强行拉音。声音嘶哑、疼痛或明显疲劳时停止发声，改做默读和整理；持续不适请寻求专业评估。发声保护参考美国NIDCD《Taking Care of Your Voice》。'
SCORE_NOTE='评分是本课程自定的练习记录工具，不是普通话等级考试、临床评估或经验证心理量表。不同课任务与难度不同，总分不直接用于课间排名。首录用于观察，修正版另记；发音听不确定时标“？”并单列，不把未经核验的自评当作客观准确率。'
PAUSE='“／”表示短暂停顿，“∥”表示更长的语义停顿；“【】”表示试读重点。它们是练习提示，不是文字内容，不要读出符号。没有统一秒数或唯一断句，先让意思完整，再自然换气。'

def prepare():
    lessons=load()
    for x in lessons:
        d=x['d']; x['edition']=VERSION
        if d==1:
            x['warm']=['自然音量：今天／先把一件事讲清楚。','自然音量：先确认事实，／再说明下一步。','不拉长声音：我允许自己停一下，／再继续。']
            x['drill'][-1]='全部12对共24字逐一首测；再挑两对做“字—词—句”切换。首测与练后成绩分开，待核验项标问号。'
        if d==3:x['warm'][0]='班 bān／帮 bāng；分 fēn／风 fēng；心 xīn／星 xīng。先读完整音节，不强行拖长尾音。'
        if d==6:x['drill']=[s.replace('信息重音：分别强调“明天／上午／十点／开会”','信息重音：分别强调“明天／十点／开会”') for s in x['drill']]
        if d==7:
            x['drill'][0]=x['drill'][0].replace('抽测12组词','先读前6对词')
            x['drill'][1]=x['drill'][1].replace('兰 lán','蓝 lán')
        if d==9:x['daily']='我更愿意每天安排二十分钟阅读，而不是完全等有空再读。对我来说，时间短一些更容易和当前日程配合。这只是我的计划，不代表人人适合。比如，我可以读一篇短文，再用两句话写下理解；实施以后还要看自己是否真正读懂，而不只是完成打卡。因此，我会先试一周，再根据实际投入和收获调整。'
        if d==10:
            x['reading']=x['reading'].replace('十二个人中','十二名受邀者中').replace('填写反馈的人里有九人选择满意','最初收到的十一份回答中有九人选择满意')
            x['readingInsert'][0]=x['readingInsert'][0].replace('小岑把分母写在白板上','小岑把最初反馈的分母写在白板上')
        if d==12:x['exercises']=[s.replace('为什么睡眠规律很重要','为什么文件要有版本号') for s in x['exercises']]
        if d==18:x['reading']=x['reading'].replace('但还有两份尚未收到回复','其中两份已回复，／内容仍待核实；／另外两份尚未回复')
        if d==2:x['transfer']['situation']=x['transfer']['situation'].replace('昨天收到14册','其中14册是昨天收到的')
        paras=x['reading'].split('\n\n');x['reading']='\n\n'.join(paras[:-1]+x['readingInsert']+paras[-1:])
        s=x['sample'];marker=next((m for m in ['这个故事','这件事','我觉得','我认为'] if m in s),None)
        if marker:
            pos=s.rfind(marker);x['sample']=s[:pos]+RETELL_EXTRA[d]+s[pos:]
        else:x['sample']=s+RETELL_EXTRA[d]
        plan=SPECIAL.get(d,STANDARD)
        if d in [2,3,4]:
            plan=list(plan)
            instruction={2:'原课18对全部首测；6分钟读字并记号；5分钟做字词句切换；2分钟回听最不稳定的两对。带练题可直接结合这组材料完成。',3:'18对共36字全部首测；依次练an/ang、en/eng、in/ing；把两对不稳的音放回句子；不加额外g音。',4:'10对n/l与10对f/h全部首测；选两对薄弱音做字、词、句与20秒表达；不要平均用力读所有音。'}[d]
            plan[2]=(10,23,'专项带练与首测',instruction)
        x['plan']=[{'start':a,'end':b,'name':c,'do':s} for a,b,c,s in plan]
        x['schedule']=[[f'{a:02d}—{b:02d}',c,s] for a,b,c,s in plan]
        x['exercises']=[f'{a:02d}—{b:02d}分钟｜{c}：{s}' for a,b,c,s in plan]
        x['assessment']=[{'name':n,'max':v,'rule':rules_for(n,v,d)} for n,v in RUBRICS.get(d,NORMAL)]
        x['rubric']=' '.join(f'{r["name"]}{r["max"]}分：{r["rule"]}' for r in x['assessment'])
        x['common']=COMMON;x['safety']=SAFETY;x['scoreNote']=SCORE_NOTE;x['pauseNote']=PAUSE
        x['challenge']=x['transfer']['situation']+' '+x['transfer']['brief']
        x['example']=x['transfer']['model']
        x['recordingGuide']=['首录：先独立完成再看答案，文件名包含课号、任务、first与实际日期。','修正版：只修改一个最影响理解的问题，另存revision，不覆盖首录。','回听：记录mm:ss时间点、原句、问题和改写；统计无意义填充词，不把所有“然后”算错。','有听众：请对方复述重点，并指出一处具体困惑；没有听众就注明自评。','学习记录仅在当前浏览器；录音请主动下载。更换设备或清理浏览器前导出记录。']
        x['optional']='选做复练（不计入今天必做60分钟）：换一个听众或换一组已给事实，按同样步骤再练一次。每次只改一项；不要靠反复背熟范文替代独立表达。'
        if d in [7,21]:x['baselineReading']=lessons[0]['reading'].split('\n\n')[0];x['baselineIntro']='与Day01完全相同：身份、日常、兴趣、训练目标；准备30秒，只写四个词；45—75秒首录，不预读旧稿。'
        x['rec']=list(dict.fromkeys(x['rec']+['本课新情境首录与修正版']))
        assert len(x['lines'])==6,(d,len(x['lines']))
        assert sum(v['max'] for v in x['assessment'])==100,d
        assert x['plan'][0]['start']==0 and x['plan'][-1]['end']==60
        assert all(a['end']==b['start'] for a,b in zip(x['plan'],x['plan'][1:])),d
        assert len(x['reading'])>=400,(d,len(x['reading']))
    return lessons

CSS='''
@page{size:A4;margin:17mm 18mm 18mm;@top-left{content:"个人成长实验室  /  21天口才与表达";font:8pt "Noto Sans CJK SC",sans-serif;color:#68786f}@top-right{content:string(day);font:8pt sans-serif;color:#68786f}@bottom-left{content:"自主进度 · 首录与修正版分开保存";font:7.5pt "Noto Sans CJK SC",sans-serif;color:#718078}@bottom-right{content:counter(page) " / " counter(pages);font:8pt sans-serif;color:#718078}}
*{box-sizing:border-box}body{font-family:"Noto Sans CJK SC","DejaVu Sans",sans-serif;color:#24362d;font-size:10pt;line-height:1.65;margin:0}h1,h2,h3{font-weight:700;break-after:avoid;line-height:1.4}h1{font-size:25pt;margin:7mm 0 4mm}h2{font-size:15pt;margin:8mm 0 3mm;border-bottom:1px solid #cedcd4;padding-bottom:2mm}h3{font-size:11pt;margin:4mm 0 2mm}p{margin:0 0 2.8mm;orphans:3;widows:3}ul,ol{margin:2mm 0 4mm;padding-left:6mm}li{margin-bottom:1.8mm}a{color:#275d49;text-decoration:none}.day{string-set:day content();font-size:10pt;letter-spacing:1.5px;color:#285844}.lead{font-size:11pt;color:#51655a}.muted{color:#61756b;font-size:8.4pt}.tag{font-size:8pt;color:#33624e}.panel{background:#f1f6f2;border-left:3px solid #7e9f88;padding:4mm;margin:4mm 0;break-inside:avoid}.case{padding:3mm 4mm;background:#f5f5ef;margin:2mm 0;break-inside:avoid}.bad{border-left:3px solid #b7a38a}.good{border-left:3px solid #71997d}table{width:100%;border-collapse:collapse;font-size:9pt;margin:3mm 0 5mm;table-layout:fixed}th{background:#edf3ed;text-align:left;font-weight:700}td,th{border-bottom:1px solid #dce5de;padding:2.3mm;vertical-align:top;overflow-wrap:anywhere}tr{break-inside:avoid}thead{display:table-header-group}.time{width:25mm}.score{width:16mm}.reading{font-family:"Noto Serif CJK SC","Noto Sans CJK SC",serif;font-size:11pt;line-height:1.95}.reading p{margin-bottom:4mm}.quote{background:#f5f6f1;padding:4mm;margin:3mm 0}.pagebreak{break-before:page}.cover{break-after:page}.cover .compact td{padding:2mm}.cover .panel{font-size:9pt}.task{break-inside:avoid;margin:4mm 0;padding:3mm 4mm;border:1px solid #dce5de}.task p{margin-bottom:2mm}.label{font-size:8pt;font-weight:700;color:#4c705a}.form-line{min-height:10mm;border-bottom:1px solid #bdcec2;margin:1mm 0 4mm}.form-large{min-height:21mm;border-bottom:1px solid #bdcec2;margin:1mm 0 4mm}.scoring{font-size:8.4pt}.note{font-size:8.4pt;line-height:1.7;color:#52665a}.pill{background:#eff3ec;padding:1mm 2mm}.toc td{padding:1.8mm}.title-small{font-size:19pt}strong{font-weight:700}
.checkin{font-size:9pt;line-height:1.45}.checkin h2{margin-top:0}.checkin p{margin-bottom:2mm}.checkin table{font-size:9pt;margin:2mm 0 3mm}.checkin td,.checkin th{padding:1.8mm}.checkin .form-line{min-height:7mm;margin:0 0 2.5mm}.checkin .form-large{min-height:14mm;margin:0 0 2.5mm}.checkin .label{margin:1mm 0}
'''
def p(s,cls=''):
    return f'<p class="{cls}">{E(s).replace(chr(10),"<br>")}</p>'
def ul(a):return '<ul>'+''.join('<li>'+E(s)+'</li>' for s in a)+'</ul>'
def headed(title,body):return '<section><h2>'+E(title)+'</h2>'+body+'</section>'
def case_html(x):
    c=x['case'];return p(c['situation'])+'<h3>常见说法：问题出在哪里</h3><div class="case bad">'+p(c['weak'])+'</div><h3>修正示范：保留事实，改变表达</h3><div class="case good">'+p(c['good'])+'</div>'+ul(c['notes'])
def guided_html(x):
    return ''.join('<div class="task"><p class="label">带练 '+str(i+1)+'</p>'+p(g['prompt'])+'<p class="label">参考做法</p>'+p(g['answer'])+'<p class="label">核对标准</p>'+p(g['check'])+'</div>' for i,g in enumerate(x['guided']))
def assessment_html(x):
    return '<table class="scoring"><thead><tr><th style="width:27mm">项目</th><th class="score">满分</th><th>怎样计分</th></tr></thead><tbody>'+''.join('<tr><td>'+E(r['name'])+'</td><td>'+str(r['max'])+'</td><td>'+E(r['rule'])+'</td></tr>' for r in x['assessment'])+'</tbody></table>'+p(SCORE_NOTE,'note')
def checkin(x):
    d=x['d'];rows=''.join('<tr><td>'+E(r['name'])+'</td><td>'+str(r['max'])+'</td><td>________</td></tr>' for r in x['assessment'])
    return '<section class="pagebreak checkin"><h2>可打印打卡页 · DAY '+f'{d:02d}'+'</h2>'+p('实际练习日期：____________    本次用时：______ / 60分钟')+p('记录性质：首次 / 复练    评价来源：自评 / 他人反馈    待核验读音：______ 项')+'<table><thead><tr><th>分项</th><th class="score">满分</th><th style="width:27mm">首录得分</th></tr></thead><tbody>'+rows+'<tr><td><strong>合计</strong></td><td><strong>100</strong></td><td>________</td></tr></tbody></table>'+p('今天三个必留证据：首录文件名；一处问题的时间点；修正版文件名。','note')+''.join('<p class="label">'+E(s)+'</p><div class="'+c+'"></div>' for s,c in [('首录文件名 / 修正版文件名','form-line'),('具体证据：mm:ss 时间点 + 原句 + 出现的问题','form-large'),('我把这句话改成了什么？为什么？','form-large'),('听众复述结果或自评结论：哪些已确认，哪些仍不确定？','form-large'),('下一次只改善的一件事（写动作，不只写“更加自信”）','form-line')])+p('完成核对：□ 首录  □ 六句练习  □ 全文朗读  □ 复述  □ 实战  □ 评分与复盘','note')+'</section>'

def body_html(x):
    d=x['d'];schedule='<table class="compact"><thead><tr><th class="time">分钟</th><th>必做任务</th></tr></thead><tbody>'+''.join(f'<tr><td>{r["start"]:02d}—{r["end"]:02d}</td><td>{E(r["name"])}</td></tr>' for r in x['plan'])+'</tbody></table>'
    b='<section class="cover"><p class="day">DAY '+f'{d:02d}'+' / 21 · 详细自学教材</p><h1>'+E(x['t'])+'</h1>'+p(x['sub'],'lead')+p('2026年10月修订 · 每课60分钟 · 不与自然日期绑定','muted')+'<div class="panel"><strong>完成这一课，你要留下什么？</strong>'+p(x['target'])+'</div><h2>一小时训练路线</h2>'+schedule+p(COMMON,'note')+p(PAUSE,'note')+'<div class="panel">'+p('开始前准备：手机或浏览器录音、计时器、可记录的纸笔。先做首录，再看示范；原始录音不要覆盖。')+'</div></section>'
    b+=headed('01 / 方法讲解与安全边界',p(x['concept'])+p(x['explain'])+'<div class="panel">'+p(SAFETY,'note')+'</div>')
    b+=headed('02 / 一段话怎样改得更清楚',case_html(x))
    b+=headed('03 / 逐分钟操作与专项材料',''.join('<h3>'+f'{r["start"]:02d}—{r["end"]:02d}分钟 · '+E(r['name'])+'</h3>'+p(r['do']) for r in x['plan'])+'<h3>开口热身：全部原句</h3>'+ul(x['warm'])+'<h3>专项练习：全部原始材料</h3>'+ul(x['drill']))
    b+=headed('04 / 三道逐步带练题',guided_html(x))
    b+=headed('05 / 六句完整表达',p('每句先慢读再自然读；只挑两句合上文字重讲。不要把所有拓展材料都挤入本课60分钟。','note')+''.join('<div class="case">'+p(f'{i+1:02d}  '+s)+'</div>' for i,s in enumerate(x['lines']))+'<h3>选做迁移句（复练使用）</h3>'+ul(x['moreLines']))
    b+=headed('06 / 原创朗读：《'+x['readingName']+'》',p(PAUSE,'note')+'<div class="reading">'+''.join(p(s) for s in x['reading'].split('\n\n'))+'</div>')
    b+=headed('07 / 合上原文，重新讲述',p('提纲：'+' → '.join(x['retell']))+p('先准备1分钟，再用自己的话讲60—90秒。先保留首录，再对照下面的完整示范。示范实际时长取决于个人语速，不为凑时长拖字。','note')+'<div class="quote">'+p(x['sample'])+'</div>')
    b+=headed('08 / 独立实战：先作答，再看示范',p(x['transfer']['situation'])+'<div class="panel">'+p(x['transfer']['brief'])+'</div><h3>必须核对的三项</h3>'+ul(x['transfer']['checks'])+'<h3>完成首录后再对照</h3><div class="quote">'+p(x['transfer']['model'])+'</div>')
    b+=headed('09 / 日常与科研完整示范（同一时段任选一套）',p('以下均为教学情境。示范中的经历、人物与数字不代表你的真实工作或成绩；使用时必须按事实改写。','note')+'<h3>日常沟通 · '+E(x['dailyTitle'])+'</h3><div class="quote">'+p(x['daily'])+'</div><h3>科研交流 · '+E(x['labTitle'])+'</h3><div class="quote">'+p(x['lab'])+'</div>'+p(x['optional'],'note'))
    if x.get('baselineReading'):b+=headed('同题复测材料（不依赖另一本教材）',p(x['baselineIntro'])+'<h3>与Day01完全相同的原文首段</h3>'+p(x['baselineReading'],'reading')+p('没有Day01录音时，今天建立当前基线；不能推算或补造过去成绩。','note'))
    b+=headed('10 / 常见错误、回听与自我修正',''.join('<h3>'+E(a)+'</h3>'+p(c) for a,c in x['fix'])+'<h3>怎样保存和复盘</h3>'+ul(x['recordingGuide'])+'<h3>今日应保留的录音</h3>'+ul(x['rec'])+'<h3>回听时回答</h3>'+ul(x['questions']))
    b+=headed('11 / 100分评分口径',assessment_html(x))
    b+=checkin(x)
    b+=p('课程说明：课内文字、场景、练习与量表为自学教学设计；不承诺21天达到某一专业等级。声带保护参考：NIDCD, Taking Care of Your Voice（访问日期2026-10-20）。','note')+'<p class="note"><a href="https://www.nidcd.nih.gov/health/taking-care-your-voice">NIDCD 发声保护资料</a> · <a href="https://zbyloveyj.github.io/personal-growth-lab/?day='+f'{d:02d}'+'">返回本课在线学习</a></p>'
    return b

def doc(body,title):return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>'+E(title)+'</title><meta name="author" content="一心问道"><style>'+CSS+'</style></head><body>'+body+'</body></html>'

def main():
    L=prepare();manifest={'edition':VERSION,'lessons':[]}
    for x in L:
        d=x['d'];text=doc(body_html(x),f'Day {d:02d} · {x["t"]}')
        hp=PRINT/f'Day-{d:02d}.html';hp.write_text(text,encoding='utf8')
        fp=OUT/f'Day-{d:02d}.pdf';HTML(string=text,base_url=str(ROOT)).write_pdf(fp)
        reader=PdfReader(fp);pages=len(reader.pages)
        x['pdfPages']=pages;x['pdfBytes']=fp.stat().st_size
        x['pdfPath']=f'downloads/pdf/Day-{d:02d}.pdf';x['printPath']=f'downloads/print/Day-{d:02d}.html'
        x['wordCount']=len(re.findall(r'[\u4e00-\u9fff]',re.sub('<[^>]+>','',body_html(x))))
        manifest['lessons'].append({'day':d,'title':x['t'],'pages':pages,'bytes':fp.stat().st_size,'sha256':hashlib.sha256(fp.read_bytes()).hexdigest(),'path':x['pdfPath'],'chinese_characters':x['wordCount']})
        print(f'Day {d:02d}: {pages} pages; {x["wordCount"]} Chinese chars; {fp.stat().st_size} bytes',flush=True)
    (ROOT/'data/edition-v3.js').write_text('window.GROWTH_LESSONS = '+json.dumps(L,ensure_ascii=False,separators=(',',':'))+';\nwindow.GROWTH_WORKBOOK = {};\n',encoding='utf8')
    (ROOT/'data/curriculum-v3.json').write_text(json.dumps(L,ensure_ascii=False,indent=2),encoding='utf8')
    toc='<p class="day">PERSONAL GROWTH LAB / COMPLETE WORKBOOKS</p><h1>21天口才与表达<br>完整自学教材</h1>'+p('每日独立PDF · 详细带练 · 录音与评分 · 自主学习进度','lead')+p('一心问道 · 2026年10月修订')+'<div class="panel">'+p(COMMON)+'</div>'+p('全部21课开放。不根据日期自动推进，不假定已经完成前面的课程。第一课保留基线；第7、14、21课进行阶段观察。','note')+'<table class="toc"><thead><tr><th style="width:18mm">课次</th><th>主题</th><th style="width:18mm">页数</th></tr></thead><tbody>'+''.join('<tr><td>'+f'{x["d"]:02d}'+'</td><td>'+E(x['t'])+'</td><td>'+str(x['pdfPages'])+'</td></tr>' for x in L)+'</tbody></table>'+p(SCORE_NOTE,'note')
    intro=ROOT/'downloads'/'_collection-front.pdf';HTML(string=doc(toc,'21天口才训练合订本'),base_url=str(ROOT)).write_pdf(intro)
    writer=PdfWriter();writer.append(str(intro))
    for x in L:writer.append(str(OUT/f'Day-{x["d"]:02d}.pdf'),outline_item=f'Day {x["d"]:02d} · {x["t"]}')
    collection=ROOT/'downloads'/'21-days-complete-workbook.pdf'
    with collection.open('wb') as f:writer.write(f)
    manifest['collection']={'path':'downloads/21-days-complete-workbook.pdf','pages':len(writer.pages),'bytes':collection.stat().st_size}
    intro.unlink()
    manifest['bundle']={'path':'downloads/21-daily-pdfs.zip','count':21}
    (ROOT/'downloads'/'pdf-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
    with zipfile.ZipFile(ROOT/'downloads'/'21-daily-pdfs.zip','w',zipfile.ZIP_DEFLATED) as z:
        for f in sorted(OUT.glob('Day-*.pdf')):z.write(f,f.name)
        z.write(ROOT/'downloads'/'pdf-manifest.json','pdf-manifest.json')
    links=''.join('<tr><td>'+f'Day {x["d"]:02d}'+'</td><td><a href="pdf/Day-'+f'{x["d"]:02d}'+'.pdf" download>'+E(x['t'])+'</a></td><td>'+str(x['pdfPages'])+'页</td></tr>' for x in L)
    catalog='<h1>21天口才训练 · PDF教材下载</h1>'+p('详细自学版 · '+VERSION)+'<p><a href="21-daily-pdfs.zip" download>下载全部21份PDF压缩包</a>　 ·　 <a href="21-days-complete-workbook.pdf" download>下载完整合订本</a>　 ·　 <a href="../">返回在线学习</a></p>'+p('每份包含方法讲解、全部练习、朗读与复述、完整情境示范、100分评分和独立打卡页。课程按自己的节奏完成。')+'<table><tr><th>课次</th><th>主题 · 点击下载PDF</th><th>页数</th></tr>'+links+'</table>'
    catalog_css='<style>body{max-width:900px;margin:32px auto;padding:0 18px}table{font-size:16px}td,th{padding:12px}h1{font-size:28px}@media(max-width:600px){table{font-size:14px}h1{font-size:23px}}</style>'
    (ROOT/'downloads/index.html').write_text(doc(catalog,'21份每日PDF下载目录').replace('</head>','<meta name="viewport" content="width=device-width, initial-scale=1">'+catalog_css+'</head>'),encoding='utf8')
    with zipfile.ZipFile(ROOT/'downloads'/'personal-growth-lab-source.zip','w',zipfile.ZIP_DEFLATED) as z:
        for f in ROOT.rglob('*'):
            if f.is_file() and f.suffix not in ['.zip','.ttf','.otf','.ttc'] and '__pycache__' not in str(f):z.write(f,str(f.relative_to(ROOT)))
    print('COMPLETE',manifest['collection'],flush=True)
if __name__=='__main__':main()
