#!/usr/bin/env python3
"""Final editorial pass; apply to canonical lesson objects before all outputs."""
from pathlib import Path
import json,re
VERSION='2026.10.20-final'
ROOT=Path(__file__).resolve().parents[1]

def polish(L):
    by={x['d']:x for x in L}
    def replace(d,key,old,new):
        assert old in by[d][key],(d,key,old)
        by[d][key]=by[d][key].replace(old,new)
    for r in by[5]['assessment']:
        if r['name']=='情境表达':
            r['rule']='新题三项核对要求各4分，共12分；独立首录与修正版分开3分。每项完整4、部分2、缺失0。'
    compare='跨期比较另用相同原始指标：主旨首次说清的秒数、每分钟无意义填充词次数、同段漏改字数及同24字的核验结果；不要直接相减不同课的总分。'
    for d in [7,14,21]:
        by[d]['scoreNote']+=' '+compare
        by[d]['recordingGuide'][2]+=' '+compare
    for x in L:
        x['scoreNote']+=' 未做或尚未评分留空，不记为0分；待核验项另记，暂记合计不视为完整成绩。'
    by[7]['lines']=by[1]['lines'].copy()
    by[7]['guided'][1]['prompt']='重新读本课所列12对词与六个完整句（均与Day01相同），再读Day01原文第一段。今日新文另作迁移观察。'
    by[7]['drill'][2]='按Day01原题首录45—75秒自我介绍，只比较相同题目与相同段落；今日新故事用于迁移，不与旧故事直接计算分数差。'
    by[14]['plan'][-2]['do']='重录Day07同一道四关键词自我介绍（准备30秒、45—75秒讲话）；仅比较同题原始指标。无旧录音时记录当前基线，不计算增幅。'
    by[14]['baselineIntro']=by[21]['baselineIntro']
    by[14]['baselineReading']='仅在需要同段复核时使用；不额外挤入必做时段。\n'+by[21]['baselineReading']
    by[14]['drill']=[
        '本课三项必测以带练A/B/C为准：议程建议、8人试用中的6人反馈、一个明确真实或模拟的小故事。',
        '不要再使用其他人数的旧题替换任务B；8人是试用者，另12人未参加，不等于不满意。',
        '三项均先保留首录，再看参考；观点结构按任务A评分，证据边界按任务B，叙事按任务C。',
        '旧题同题比较与新题表现分别记录，不把熟稿优势写成全部表达能力的提升。']
    by[8]['drill']=[
        '本课围绕同一份给定材料练15秒、30秒和最多60秒三个版本，事实不变，只调整细节与顺序。',
        '材料：周五19点，读书会照常；图书馆维修，改到社区中心一楼；到场签到。',
        '首句示范：读书会没有取消。／周五十九点照常，／地点改到社区中心一楼。',
        '信息已说全可提前结束；材料没有提供的状态不补造，新的行动建议须明确说成建议。']
    by[8]['guided'][1]['answer']='30秒版补上场地维修原因；较长版把时间、地点、签到三个要点分开说明，并请听众复述确认。若增加“建议同步更正旧通知”，要明确这是你的建议，不是已发生的事实；无需为凑满60秒扩写。'
    by[5]['guided'][1]['answer']='三版文字完全相同。慢版给关键点多一点停顿；自然版采用聊天节奏；稍快版只略缩短次要部分的发音时长，不删句、不漏字、不牺牲必要停顿。'
    by[5]['transfer']['checks'][0]='时间、地点、入口和签到动作均清楚。'
    by[13]['lines'][2]='第一个理由是信息还不完整，／第二个理由是现在仍有时间核对。'
    by[13]['lines'][5]='最后回到最开始的问题：／我的建议是先问清需要，／再提供帮助。'
    by[16]['lines'][2]='这个方案的好处是提前发现缺项，／代价是需要额外安排核对时间。'
    by[17]['lines'][1]='针对能否提交的问题，／我的直接回答是：／初稿可以，／定稿仍需复核。'
    by[17]['lines'][5]='接下来先核对记录来源，／再检查这个判断是否得到支持。'
    by[19]['lines'][0]='只用一句话解释，／版本号就是帮助我们识别不同稿次的标记。'
    by[20]['lines'][5]='我的建议仍然是先核对版本，／再决定什么时候发送报告。'
    by[20]['guided'][0]['check']='时间、地点不变、调整原因和反馈动作四项都应准确；不得把“不变”漏掉后说成地点也变。'
    by[20]['transfer']['brief']='总计60秒，包含插问与回答：0—30秒报告状态；约30秒插入“今天到底能不能发？”；用约20秒回答；最后约10秒说明下一步。不能承诺今晚一定发出。'
    by[21]['drill'][0]='按本课时间表用六行提纲准备：题目、主张、理由一、理由二、具体片段、收尾；重点是一个中心，不强制三项观点。'
    by[21]['transfer']['brief']='总长参考4分30秒—5分30秒。分段示例：30秒开场、50秒观点一、50秒观点二、100秒具体片段、50秒边界与计划、20秒收尾，合计300秒。时间可合理浮动，不拖字填满。'
    by[21]['rec']=['五分钟演讲首录与修正版（同一主任务，不另录一场）','Day01同题45—75秒自我介绍复测','同段朗读与今日原文复述','一项新追问回答及结业复盘']
    by[15]['case']['good']='你已经为原来的时间留好了安排，现在再改会让你为难，我理解得对吗？\n（等对方回答后再问）最冲突的是哪一段时间？\n（听完具体困难后）你希望我先听你说完，还是一起找调整办法？'
    replace(1,'reading','才开始登记。','再继续登记。')
    replace(2,'reading','小周这才补上“服务台”，','小周便把“服务台”单独重说一次，')
    p=by[4]['reading'].split('\n\n');assert len(p)==7
    by[4]['reading']='\n\n'.join(p[:4]+[p[6]]+p[4:6])
    replace(6,'reading','模拟面试开始后，','第二天模拟面试开始后，')
    replace(6,'reading','同学用同一句话回答，','同学用“我明天交初稿”这句话回答，')
    replace(9,'reading','他把原来的“肯定有效”改成“值得小范围试行”。','他没有把这一次经验说成证明，／而是将建议限定为“值得小范围试行”。')
    p=by[10]['reading'].split('\n\n');assert len(p)==7
    p[3]+='／她把补交日期另作标注，／不让更新后的记录与最初的十一份回答混在一起。'
    by[10]['reading']='\n\n'.join(p[:3]+[p[4],p[5],p[3],p[6]])
    p=by[11]['reading'].split('\n\n');assert len(p)==7
    by[11]['reading']='\n\n'.join(p[:2]+[p[4],p[2],p[3],p[5],p[6]])
    p=by[13]['reading'].split('\n\n');assert len(p)==7
    p[4]=p[4].replace('发言前那一点空隙里，','准备开口的那一点空隙里，')
    by[13]['reading']='\n\n'.join(p[:2]+[p[4],p[2],p[5],p[3],p[6]])
    summaries={
    1:'下雨后，图书馆门口有很多人等着借伞。志愿者小林发现登记纸仍写着旧规则，就先向老师确认。得知当天每人可借一把、三天内归还后，他更新提示并向来宾解释。经同伴提醒，他又补上借出和归还日期。下一位借伞者能复述规则，队伍也有序移动。这件事提醒我，先核实信息，再检查听众是否理解，比只把话说完更重要。',
    2:'旧书交换开始前，小苏发现桌上有四十册书，但展示卡只写十四册。他与小周重新清点、核对登记册，确认十四册只是昨天收到的部分。更新卡片后，小周把数量放回完整通知中练习，请一位读者复述。对方听清数量，却没听到登记地点，他就单独重说服务台。活动顺利进行。我理解的重点是：事实、读音和信息传达都要检查，不能只练单字。',
    4:'宁宁在花房做志愿者。中午起风，靠窗的花架晃动，老林先让来宾离开窗边，再分配引导、关窗和检查的任务。宁宁带人到安全位置并安抚老人。风弱下来、检查确认后，花房恢复参观。事后她向老林复盘指令，下午介绍路线时也把方向与颜色说开，请来宾复述确认。这个故事说明，准确吐字要用于清楚的指令，而不只是反复念地名。',
    5:'露天电影开场前下雨，阿宁第一次广播太快，也没有说明新地点，大家听不清活动是否取消。她核实安排后，先说电影照常，再说明地点改到一楼礼堂、时间改为六点十五分、从左侧进入。活动后，她回听广播，用同一段文字比较三种速度，发现最慢的版本反而过于零碎。这让我明白，先补齐信息，再按意思停顿，比一味放慢更有用。',
    6:'小周通知模拟面试时，白板只写明天十点、带好资料，同学不清楚具体要求。他重新说明上午十点、带简历和一页项目说明。第二天试讲时，老师让同学用同一句话分别回应时间、负责人和提交内容的疑问，每次突出不同的词。大家交换角色，检查听到的重点是否一致，删去多余强调。我的理解是：重音要回应听众的信息差，不是把每个词都说得更响。',
    9:'一次组会因为背景介绍过多而拖延，小方建议会前发简短议程。他说明理由，并用以前提前读表的经历举例。有人追问，一次会议开得快是否足以证明议程有效，他承认人数和议题也可能影响结果。因此大家决定只发三项待决定事项，小范围试行，同时记录准备负担、会议时间和必要决定是否完成。这件事说明，建议要有支持它的理由，也要交代例子的边界。',
    10:'十二名受邀者中，最初十一人回复：九人满意，两人一般，一人尚未回复。有人说所有人都喜欢，小岑指出这是过度推断。她解释，九人占全部受邀者的75%，占已回复者约82%，不能混用分母，也不能用满意度证明学习效果。第二天未回复者补交意见，提到签到指引不清楚，她另记补交日期，再据此改进通知。这个故事提醒我，人数、分母和记录时间都要说清楚。',
    11:'检票前，小宁发现三张车票只有两张显示成功。同伴分别提出重买和先询问，他比较两种选择后，决定先核对，避免重复购买。他把订单编号记在便签上，到服务台确认第三张票已出票，只是页面未更新。大家及时赶到检票口。后来讲述这件事时，他保留成功提示、订单号和确认过程，删掉无关细节。故事的转折来自有理由的选择，而不只是连续发生几件事。',
    14:'小方比较早期和最近的同题录音，发现最近能更快说出结论，但例子仍然较长。他请朋友复述主要理由，删掉无关细节后重录，又用新材料检查能否把事实与建议分开。朋友指出，一处例子并不支持观点，另一处把未测试安排说成确定消息。小方据此设定下一轮练习。测评不是证明自己完美，而是用同题记录和新题表现分别找到可以修改的问题。',
    15:'小乔说最近的临时变化让她疲惫，小林起初急着给建议，她反而沉默。小林意识到需要先听，便确认她的表达目的，复述原计划不断被新要求打断的困难。等她说出调整任务顺序的想法，他继续问哪项要求影响最大、希望得到什么帮助，再提出自己能做到的行动。他没有替她接管安排。这个故事说明，倾听需要等待回答，并用追问核实，而不是把建议一次说完。',
    18:'小方第一次汇报重播每天的工作，别人不知道当前状态。第二次他改用已完成、未完成、风险和下一步，说明三十份报名信息中二十六份完整、四份缺联系方式。缺项中两人已回复但尚未核实，不能计入完整记录。他说明催办安排，并请负责人决定仍缺项时是否保留候补。之后他把收到回复与确认完整分列。汇报变短，是因为状态和待决定事项更明确，而不是省略风险。',
    19:'小宁要向中学生、大学同学和老师介绍同一项工作。她先固定数据来源、检查状态与解释边界，再根据听众分别使用生活类比、方法说明或证据讨论。学生问某种微生物多是否就会生病，她仍保留关联不等于因果的限制，只换成容易理解的话。三种讲法改变的是顺序和深度，不是事实。这个故事提醒我，适配听众既要考虑对方的问题，也不能把未知说成已经确定。',
    21:'小陈在分享会上回顾表达训练：最初怕忘词、遇到停顿就加速，后来用朗读与复述练习组织语言。一次讨论中，他先说结论，得到听众能迅速理解建议的反馈。结业时，他只比较有保存的同题录音，把缺失记录如实注明。面对一个新问题，他仍有绕远的地方，就把它留给下一轮。我的理解是，结业要说明哪些变化有证据、哪些能力仍不稳定，而不是宣称已经完美。'}
    for d,s in summaries.items():by[d]['sample']=s
    p=by[19]['reading'].split('\n\n');assert len(p)==7
    by[19]['reading']='\n\n'.join([p[0],p[4],p[1],p[2],p[3],p[5],p[6]])
    by[13]['drill']=['必做专项使用下面三道带练题及给定输入；每题先独立录一遍，再看参考。','关键词只帮助组织，不写成逐字稿；忘词后换简单说法，仍回应原问题。','第三题的三个短题依次作答，每题30秒准备、45—60秒发言；不额外再加三场长演讲。']
    by[19]['drill']=['必做专项按三道带练题进行；先固定同一份事实底稿，再调整给参加者、志愿者、负责人的顺序。','独立实战使用本课活动材料录三版，各30—45秒；题目不得换成三个不同主题。','科研受众改写为同一时段替代练习，不再额外增加40、60、90秒三场必做演讲。']
    by[20]['drill']=['必做专项按三道带练题：20—30秒通知、60秒插问练习、90秒材料压缩。','插问计入规定总时长；回答后用一句话回到主线，不从头重讲。','独立新题总计60秒，按“30秒汇报＋20秒回应＋10秒收尾”安排；不可删掉未核实等限制。']
    for x in L:
        x['edition']=VERSION
        x['rubric']=' '.join(f'{r["name"]}{r["max"]}分：{r["rule"]}' for r in x['assessment'])
        x['schedule']=[[f'{r["start"]:02d}—{r["end"]:02d}',r['name'],r['do']] for r in x['plan']]
        x['exercises']=[f'{a}分钟｜{n}：{s}' for a,n,s in x['schedule']]
        x['challenge']=x['transfer']['situation']+' '+x['transfer']['brief'];x['example']=x['transfer']['model']
        assert sum(r['max'] for r in x['assessment'])==100
        assert len(x['lines'])==6 and not any('……' in t for t in x['lines'])
        assert len(x['reading'])>=400
    return L


def patch_reader():
    p=ROOT/'assets/app.js';s=p.read_text(encoding='utf8');mark='// growth-final-reader-20261020'
    if mark not in s:
        def rep(old,new):
            nonlocal s
            assert old in s,old[:100]
            s=s.replace(old,new,1)
        rep('const avg=done.length?Math.round(done.reduce((s,l)=>s+(Number(byDay(l.d).total)||0),0)/done.length):null;',
            'const scored=done.filter(l=>{const a=byDay(l.d).scores;return Array.isArray(a)&&a.length===getRubric(l.d).length&&a.every(v=>v!==null&&v!==""&&Number.isFinite(Number(v)))}).length;')
        rep('("完成课程自评均分："+(avg===null?"尚未评分":avg+" / 100")+"。")','("其中 "+scored+" 课已完整填写评分。各课任务不同，不计算跨课均分。")')
        rep('savedScores=Array.isArray(entry.scores)?entry.scores:rubric.map(()=>0)','savedScores=Array.isArray(entry.scores)?entry.scores:rubric.map(()=>null)')
        rep('value="${Math.max(0,Math.min(c[1],Number(savedScores[i])||0))}"','value="${savedScores[i]===null||savedScores[i]===undefined||savedScores[i]===""?"":Math.max(0,Math.min(c[1],Number(savedScores[i])||0))}" placeholder="未评分"')
        a=s.index('    function setTotal(){');b=s.index('    document.querySelectorAll("[data-check]")',a)
        s=s[:a]+'''    function setTotal(persist=false){
      const vals=scores.map((e,i)=>e.value.trim()===""?null:Math.round(Math.max(0,Math.min(rubric[i][1],Number(e.value)||0))));
      const n=vals.filter(v=>v!==null).length,sum=vals.reduce((a,v)=>a+(v??0),0);
      total.textContent=n===0?"未评分":n===vals.length?`${sum} / 100`:`已记 ${sum} 分（${n}/${vals.length}项）`;
      if(persist){const ok=update(d,"scores",vals);update(d,"total",n===vals.length?sum:null);if(!ok)toast("浏览器未能保存评分，请导出记录备份。");}
    }
    scores.forEach((e,i)=>e.addEventListener("change",()=>{if(e.value.trim()!=="")e.value=String(Math.round(Math.max(0,Math.min(rubric[i][1],Number(e.value)||0))));setTotal(true)}));
    setTotal(false);
''' +s[b:]
        rep('<div class="score-total"><span>本课评分</span>', '<p class="audio-note">未评留空；0分仅用于已评但未达到要求。待核验音请记入笔记，分项未评齐时只显示暂记分。</p><div class="score-total"><span>本课评分</span>')
        rep('typeof obj.lessons!=="object"||Array.isArray(obj.lessons)','!obj.lessons||typeof obj.lessons!=="object"||Array.isArray(obj.lessons)||Object.values(obj.lessons).some(v=>!v||typeof v!=="object"||Array.isArray(v))')
        rep('STATE=obj;save();renderHome();toast("学习记录已导入。")','const previous=STATE;STATE=obj;if(!save()){STATE=previous;throw Error("无法保存")}renderHome();toast("学习记录已导入。");')
        rep('const value=!isDone(d);update(d,"completed",value);','const value=!isDone(d);const ok=update(d,"completed",value);if(!ok){toast("浏览器未能保存完成状态，请导出记录备份。");}')
        rep('id="timer-reset">归零','id="timer-reset">重置60分')
        rep('"与Day01同题录制60秒自我介绍"','"同题介绍复测并回答一项新追问"')
        rep('<small>先照读，再只看要点脱稿讲一遍。</small>','<small>独立首录后再参考；这是替代或复练材料，不额外增加一场必测。</small>')
        rep('      try{\n        stream=await navigator.mediaDevices.getUserMedia','      recStart.disabled=true;\n      try{\n        stream=await navigator.mediaDevices.getUserMedia')
        old='setTimeout(()=>URL.revokeObjectURL(url),30000);recStatus.textContent="录音已在本地生成下载文件。"'
        new='''const box=document.createElement("div");box.className="recording-result";const audio=document.createElement("audio");audio.controls=true;audio.src=url;audio.style.width="100%";const link=document.createElement("a");link.href=url;link.download=a.download;link.textContent="再次下载这段录音";box.append(audio,link);recStatus.after(box);recStatus.textContent="已生成本地录音并请求下载，请确认文件已保存；也可在下方回听或再次下载。关闭页面后临时音频会失效。";'''
        rep(old,new)
        rep('}catch(err){recStatus.textContent="未取得麦克风权限。可以使用手机录音。";', '}catch(err){recStart.disabled=false;recStop.disabled=true;recStatus.textContent="无法开始录音，请检查麦克风权限或改用手机录音。";')
        s=mark+'\n'+s;p.write_text(s,encoding='utf8')
    p=ROOT/'index.html';s=p.read_text(encoding='utf8');s=s.replace('20261020r3','20261020final');p.write_text(s,encoding='utf8')


def install(publication):
    old=publication.prepare
    publication.prepare=lambda:polish(old())
    publication.VERSION=VERSION
    publication.CSS+='\n.scoring{break-inside:avoid}.scoring + p{break-before:avoid}\n'
    publication.SCORE_NOTE+=' 未做或未评分留空，不记0分；待核验读音单列，暂记合计不视为完整成绩。跨期只比较同题同段的原始指标。'
    original=publication.rules_for
    def rules(name,score,d):
        text=original(name,score,d)
        if name=='原文朗读' and d==21:
            text='完整朗读同一指定段落4分；关键字清楚3分；语义停顿自然3分。无早期录音仍可评价当前表现，但不得计算前后变化。'
        if name=='观点结构' and d==14:text='依据带练任务A首录：前15秒有主张5分；理由支持主张5分；例子对应理由5分；回应反对意见或限定5分。'
        return text
    publication.rules_for=rules
    patch_reader()
    out=ROOT/'downloads'/'FINAL-REVIEW.md';out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text('''# 21天口才训练 · 定稿复核说明\n\n版本：2026.10.20-final。\n\n保留21课顺序、每日60分钟、自主打卡和每日PDF。\n\n本轮修正：第5课15分细则加总；第10课受邀/回复人数与时间截面；扩写故事的时间顺序；后半程完整句子的空白占位；第14课旧题与新题混用；第20课插问是否计入总时长；第21课分段示例统一300秒；同题比较不使用不同课总分；网页未评分不再默认记0分；录音保留回听与再次下载入口。\n\n课程量表为自定练习记录，不是专业等级认证。声带保护参考NIDCD《Taking Care of Your Voice》。\n''',encoding='utf8')
