'use strict';
// Chord-only teaching arrangements for this course. No lyrics, melody or third-party TAB.
// Bars count quarter-note beats. A two-chord bar changes on beat 3 unless stated otherwise.
// Source charts were used to check harmonic facts; instrumental sections and rehearsal form
// are arranged here for beginner ukulele and are not a transcription of a commercial recording.
(function () {
  const full = name => ({chords:[{name,beats:4}]});
  const split = (first,second) => ({chords:[{name:first,beats:2},{name:second,beats:2}]});
  const bars = values => values.map(value => Array.isArray(value) ? split(value[0],value[1]) : full(value));
  const phrase = (from,to,label) => ({from,to,label});
  const step = (sectionId,label) => ({sectionId,repeat:1,label});
  const capoOptions = [
    {fret:0,soundingKey:'C',label:'不夹 · C'},
    {fret:1,soundingKey:'Db',label:'夹1品 · D♭'},
    {fret:2,soundingKey:'D',label:'夹2品 · D'},
    {fret:3,soundingKey:'Eb',label:'夹3品 · E♭'},
    {fret:4,soundingKey:'E',label:'夹4品 · E'},
    {fret:5,soundingKey:'F',label:'夹5品 · F'}
  ];
  const transpose = extra => ({
    allowedKeys:['C','Db','D','Eb','E','F'],
    capoOptions,
    rule:'先不夹试唱最高句与最低句，再选择舒适的全曲调。使用本谱C指型时，变调夹每升1品，全曲升高1个半音，指法相对夹子计算；旋律也必须一起升调。夹子不能把C指型降调。播放器的变调夹品位与实琴保持一致，合成伴奏会同步升高音高。',
    alternatives:extra || []
  });

  const songs = [
    {
      id:'an-jing',title:'安静',artist:'周杰伦',baseKey:'C',capo:0,
      arrangementLabel:'本课简化伴奏版 · C指型 · 全部唱段',
      meter:{beatsPerBar:4,beatUnit:4},
      tempo:{default:60,min:45,max:80,label:'先用50–60 BPM；这里是一拍一个四分音符的教学速度。'},
      defaultPattern:'pick4',neededChords:['C','Am','F','Dm','G7','Em','G','Em7'],
      verified:'已读一树一花音乐工作室公开发布的尤克里里谱图，确认4/4拍及主歌、衔接、副歌的和弦走向；与公开和弦文本交叉比较。小节配拍、短前奏/间奏和完整演练顺序由本课重新编排。',
      disclaimer:'这是可直接练习的课程和弦伴奏谱，不含歌词、旋律或原版前奏。保留两遍主歌、两遍衔接和三遍副歌；前奏、间奏、结尾已简化。它不是原录音逐拍转录，不能把原音源的时间码直接套在本谱上。',
      howToUse:[
        '先只播放并口数1、2、3、4；每格是一小节。单和弦保持4拍，双和弦各2拍，在第3拍换。',
        '先练主歌1–4小节，再练5–8小节；能各弹清楚3遍后才加唱。旋律先清唱熟悉，人声弱起可以在小节线前进入，和弦仍按格子换。',
        '主歌先用两次下扫或四拍分解；遇到第4、8小节，分解的第3、4拍已经属于G7。不要弹完整旧和弦的四拍才换。',
        '先完成整段，再沿下方演出路线连起来。最后一遍副歌也要唱全，最后两小节数满再结束。'
      ],
      transpose:transpose([{key:'G',label:'需要更低演唱区时，可选G指型全曲移调',chordMap:{C:'G',Am:'Em',F:'C',Dm:'Am',G7:'D7',Em:'Bm',G:'D',Em7:'Bm7'},note:'此版本会增加Bm、Bm7、D7；先查和弦库并逐弦检查，不作为零基础默认版本。全曲统一替换，不能只替换个别难和弦。'}]),
      sources:[
        {title:'一树一花音乐工作室｜108《安静》U教学＋U谱',url:'https://www.sohu.com/a/203230031_664945',scope:'原教学工作室署名页面；已直接查看公开谱图的4/4拍及和弦位置。页面视频未逐段试听。'},
        {title:'弹琴吧｜安静公开和弦文本',url:'https://www.tan8.com/guitarChords-99145.html',scope:'社区和弦资料，用于交叉核对主副歌区别；编配者标为佚名，不作为官方原版证明。'}
      ],
      sections:[
        {id:'intro',title:'前奏 · 4小节',role:'intro',pattern:'pick4',
          bars:bars(['C','Am','F','G7']),
          phrases:[phrase(1,4,'先听四小节，准备进入主歌')],
          practice:['本课用4小节和弦引入代替原版旋律前奏。','最后一小节G7数到4，左手准备C；不要提前停拍。']},
        {id:'verse',title:'主歌 · 8小节',role:'verse',pattern:'pick4',
          bars:bars(['C','Am','F',['Dm','G7'],'C','Am','F',['Dm','G7']]),
          phrases:[phrase(1,2,'主歌第1句'),phrase(3,4,'主歌第2句'),phrase(5,6,'主歌第3句'),phrase(7,8,'主歌第4句')],
          practice:['1–2小节只练C→Am，整句唱完后再进下一组。','第4、8小节为Dm两拍、G7两拍；用口数把第3拍换点唱出来，再轻声哼旋律。','两遍主歌使用同一套和弦。即使唱词重复，也保留第二遍主歌，不跳到副歌。']},
        {id:'prechorus',title:'衔接段 · 8小节',role:'prechorus',pattern:'pick4',
          bars:bars(['Dm','G7','Em','Am','F','C','Dm','G7']),
          phrases:[phrase(1,2,'衔接第1句'),phrase(3,4,'衔接第2句'),phrase(5,6,'衔接第3句'),phrase(7,8,'进入副歌前的末句')],
          practice:['先单练G7→Em，再把第2、3、4小节接起来；这是本段最需要提前摆位的位置。','第7–8小节保持节拍，长音唱完也把剩余拍子数满。','接缝练习：本段第8小节G7＋副歌第1小节C，连续5次不加速。']},
        {id:'chorus',title:'副歌 · 16小节',role:'chorus',pattern:'down4',
          bars:bars(['C','G','Am','G','F',['Em7','Am'],'Dm','G7','C','G','Am','G','F',['Em7','Am'],'Dm',['G7','C']]),
          phrases:[phrase(1,2,'副歌第1句'),phrase(3,4,'副歌第2句'),phrase(5,6,'副歌第3句'),phrase(7,8,'副歌第4句'),phrase(9,10,'副歌第5句'),phrase(11,12,'副歌第6句'),phrase(13,14,'副歌第7句'),phrase(15,16,'副歌收束句')],
          practice:['先做1–4小节，只用四次下扫；不要因为音量增加就加速。','第6、14小节各是Em7两拍→Am两拍。Em7=0202，与Em=0432不同，先逐弦弹清楚。','第16小节G7两拍后回到C两拍；继续进入下一段时保持同一速度，最后一遍则接结尾。']},
        {id:'interlude',title:'间奏 · 4小节',role:'interlude',pattern:'pick4',
          bars:bars(['C','Am','Dm','G7']),phrases:[phrase(1,4,'放松呼吸，准备第二遍主歌')],
          practice:['这是本课缩短后的间奏，不复刻钢琴原奏。','保持4小节长度；只是不唱，不代表右手停止或增加额外休息小节。']},
        {id:'outro',title:'结尾 · 2小节',role:'outro',pattern:'down2',
          bars:bars(['C','C']),phrases:[phrase(1,2,'落在C和弦后数完结尾')],
          practice:['两小节都在第1、3拍轻下扫，第二小节再放轻一些。','最后一次下扫后让余音持续，心里数到第2小节第4拍结束，再轻触琴弦收音。']}
      ],
      form:[step('intro','4小节引入'),step('verse','主歌 · 第1遍'),step('prechorus','衔接 · 第1遍'),step('chorus','副歌 · 第1遍'),step('interlude','4小节间奏'),step('verse','主歌 · 第2遍'),step('prechorus','衔接 · 第2遍'),step('chorus','副歌 · 第2遍'),step('chorus','末次完整副歌'),step('outro','2小节收束')],
      checkpoints:[
        {title:'先过主歌',sectionIds:['verse'],target:'50–60 BPM连续两遍，两个小节内换弦点都准时，右手不中断。'},
        {title:'再过衔接与副歌',sectionIds:['prechorus','chorus'],target:'G7→Em、Em7→Am与G7→C各取5次，至少4次清楚且准时；随后完整连接。'},
        {title:'完整录制',sectionIds:['intro','verse','prechorus','chorus','interlude','outro'],target:'按演出路线保留全部唱段，记录BPM、调及一镜到底录音，按课程五维量表自评。'}
      ]
    },
    {
      id:'qing-tian',title:'晴天',artist:'周杰伦',baseKey:'C',capo:0,
      arrangementLabel:'本课简化伴奏版 · C指型 · 主副歌分开练',
      meter:{beatsPerBar:4,beatUnit:4},
      tempo:{default:66,min:48,max:90,label:'先用55–66 BPM；小节内两次换弦稳定后再升速。'},
      defaultPattern:'down4',neededChords:['Am','F','C','G','E7','Dm'],
      verified:'已直接查看署名Giles Lo的公开尤克里里谱图，确认4/4、主歌/衔接的半小节和弦换点，以及副歌的属和弦进入小和弦；并与C指型公开文本交叉核对。本课移到C，保留E7→Am，末段按同速完整副歌重编。',
      disclaimer:'此谱是本课简化伴奏编配，不含标志性旋律前奏或歌词。主歌不是C–Am–F–G通用循环。原录音尾段的紧凑复述在本课改为同速完整副歌，因此本版的段落时长与原录音不同。',
      howToUse:[
        '主歌多为一小节两个和弦：前一个在第1、2拍，后一个在第3、4拍。先用四次下扫，把每小节第3拍换清楚。',
        '主歌8小节包括中间的唱名段；请把该段也哼唱完整，再进入衔接段，不因页面没有歌词就省略。',
        '副歌第5、13小节是E7，下一小节是Am。E7=1202；这是本版的和声转折，不要把它当成Em或任意熟悉的和弦。',
        '完整路线中，第1遍副歌后进入间奏与衔接，第2遍后再唱一遍完整副歌。最后一遍维持同一BPM，不模仿原录音末段加密的咬字。'
      ],
      transpose:transpose(),
      sources:[
        {title:'圍威喂 Ukulele｜周杰倫《晴天》，Giles Lo署名编配',url:'https://wwwuku.blogspot.com/2017/03/ukulele_22.html',scope:'已直接查看该公开页面关联的原图：4/4、主歌半小节换点、分段标记及副歌B7→Em。页面可能限流；练习所需和弦已在课内重新编配。'},
        {title:'弹琴吧｜晴天C指型公开和弦文本',url:'https://www.tan8.com/guitarChords-97845.html',scope:'社区资料交叉核对Am/F/C/G主歌、E大三和弦进入Am及末段复唱。E7是本课保留相同属功能的编配选择，不把文本中的E误报为Em。'},
        {title:'台灣烏克麗麗教學小教室 #062｜晴天弹唱教学',url:'https://www.youtube.com/watch?v=Yb_V0U3D-FY',scope:'原教学频道可选观看入口；已核对标题与发布者，未逐段试听。课内谱与播放器不依赖视频可用性。'}
      ],
      sections:[
        {id:'intro',title:'前奏 · 4小节',role:'intro',pattern:'down2',
          bars:bars([['Am','F'],['C','G'],['Am','F'],['C','G']]),
          phrases:[phrase(1,2,'两小节和弦引入'),phrase(3,4,'再走一遍，准备主歌')],
          practice:['本课以和弦引入代替原版旋律前奏，先把每小节第3拍的换弦做好。','两次下扫恰好落在两个和弦的开始处：第1拍与第3拍。']},
        {id:'verse',title:'主歌 · 8小节（含唱名段）',role:'verse',pattern:'down4',
          bars:bars([['Am','F'],['C','G'],['Am','F'],['C','G'],['Am','F'],['C','G'],['Am','F'],['C','G']]),
          phrases:[phrase(1,2,'主歌第1组'),phrase(3,4,'主歌第2组'),phrase(5,6,'唱名段'),phrase(7,8,'主歌末句')],
          practice:['每两小节是一组，先只弹Am→F→C→G并数8拍，再加哼唱。','第5、6小节仍有唱段；把唱名当旋律来哼，不能只留伴奏跳过。','固定四次下扫能连续唱两遍后，才在本段尝试八分扫弦；半小节换点不变。']},
        {id:'prechorus',title:'衔接段 · 8小节',role:'prechorus',pattern:'down4',
          bars:bars([['Am','F'],['C','G'],['Am','F'],['C','G'],['Am','F'],['C','G'],['Am','F'],'G']),
          phrases:[phrase(1,2,'衔接前半第1组'),phrase(3,4,'衔接前半第2组'),phrase(5,6,'衔接后半第1组'),phrase(7,8,'副歌前的收束')],
          practice:['本段前7小节通常每2拍一换，第8小节G保持4拍。不要按惯性在第8小节第3拍换走。','先练第7小节Am/F→第8小节G→副歌第1小节C，5轮中至少4轮不断。','唱句跨越小节时右手仍按拍子走，不把每个字都当成一次下扫。']},
        {id:'chorus',title:'副歌 · 16小节＋1小节落点',role:'chorus',pattern:'down4',
          bars:bars(['C','Am',['F','G'],'C','E7','Am','F',['Dm','G'],'C','Am',['F','G'],'C','E7','Am','F',['Dm','G'],'C']),
          phrases:[phrase(1,2,'副歌第1句'),phrase(3,4,'副歌第2句'),phrase(5,6,'副歌第3句'),phrase(7,8,'副歌第4句'),phrase(9,10,'副歌第5句'),phrase(11,12,'副歌第6句'),phrase(13,14,'副歌第7句'),phrase(15,17,'副歌末句与落点')],
          practice:['先单独练E7→Am：各弹一小节，四拍一换，5轮清楚后才加唱。','第3、11小节F两拍→G两拍；第8、16小节Dm两拍→G两拍。双和弦小节只练两次下扫也可以。','第17小节是末句的C落点，数满4拍；它不是漏出来的空白，不能删除。','本课把最后一次副歌也保留17小节，降低密集唱词的协调负担；最后接2小节结尾。']},
        {id:'interlude',title:'间奏 · 4小节',role:'interlude',pattern:'down2',
          bars:bars([['Am','F'],['C','G'],['Am','F'],'G']),
          phrases:[phrase(1,4,'短间奏后直接回衔接段')],
          practice:['这是本课缩短的间奏，不弹原版吉他独奏。','间奏后回到衔接段第1小节Am，不重复开头主歌8小节；提前看清下一段名称。']},
        {id:'outro',title:'结尾 · 2小节',role:'outro',pattern:'down2',
          bars:bars(['C','C']),phrases:[phrase(1,2,'放轻后收音')],
          practice:['副歌末句落点后再留2小节伴奏空间，音量逐步放轻。','保持第1、3拍轻下扫，最后一次触弦后让余音持续到第4拍结束，再收音。']}
      ],
      form:[step('intro','4小节和弦引入'),step('verse','主歌 · 含唱名段'),step('prechorus','衔接 · 第1遍'),step('chorus','副歌 · 第1遍'),step('interlude','4小节间奏'),step('prechorus','衔接 · 第2遍'),step('chorus','副歌 · 第2遍'),step('chorus','末段副歌 · 同速完整复唱'),step('outro','2小节收束')],
      checkpoints:[
        {title:'半小节换弦',sectionIds:['verse'],target:'55–66 BPM，连续8小节的第3拍都不晚到；先弹后唱，不能靠停拍补左手。'},
        {title:'和声转折',sectionIds:['chorus'],target:'E7→Am单独5次至少4次清楚；副歌16＋1小节完整唱完，没有漏掉末句落点。'},
        {title:'完整路线',sectionIds:['intro','verse','prechorus','chorus','interlude','outro'],target:'保留唱名段、第二次衔接和末段完整复唱；整曲录制与五维量表分别检查节奏、换点、协同、音高及结构。'}
      ]
    },
    {
      id:'sadness',title:'一万次悲伤',artist:'逃跑计划',baseKey:'C',capo:0,
      arrangementLabel:'本课简化伴奏版 · C指型 · 12小节主歌',
      meter:{beatsPerBar:4,beatUnit:4},
      tempo:{default:72,min:50,max:100,label:'先用60–72 BPM；全段呼吸与拍点稳定后再尝试80–90 BPM。'},
      defaultPattern:'down4',neededChords:['C','G','Am','F'],
      verified:'已查看署名无限延音的公开首图，核对4/4拍与12小节主歌；以署名Xixixi的公开尤克里里图及两份公开和弦文本交叉核对主副歌不同走向。本课将和声移到C，副歌配拍、短间奏与结尾按教学需要重编。未取得可确认由原教学者持续维护的完整免费尤克里里原发布谱。',
      disclaimer:'本课用明确的12小节主歌、16小节副歌和完整路线练唱，不把四个和弦随意循环当成整首歌。它是课程简化伴奏编配，不含歌词、旋律或原录音的全部器乐声部，也不声称与原录音每拍同步。全部练习材料已内置，外部资料仅供核对和选看。',
      howToUse:[
        '主歌12小节分成三组，每组4小节；副歌16小节分成四组。先数清两段长度的区别，再开始唱。',
        '每小节只有一个和弦，保持4拍；本曲先用四次下扫。即使一句唱到下一小节，也按固定拍点换弦。',
        '第一、第二遍主歌旋律相近而唱词不同；末尾还有6小节主歌回声。完整录制保留这些唱段，间奏则按本谱缩成8小节。',
        '先不用琴清唱最高的句子，再决定调与八度。副歌不靠喊唱增大情绪；若换气让右手停顿，退回两次下扫并降低BPM。'
      ],
      transpose:transpose([{key:'G',label:'另一套完整指型 · G / D / Em / C',chordMap:{C:'G',G:'D',Am:'Em',F:'C'},note:'全曲统一替换：C→G、G→D、Am→Em、F→C。G指型不夹为G调；夹2品为A调，夹4品为B调。选调以自己的音域为准，不把夹品当作难度等级。'}]),
      sources:[
        {title:'无限延音署名｜一万次悲伤公开预览',url:'https://www.318qupu.com/yuepu/33555.html',scope:'已查看公开首图的4/4标记、G/D/Em/C和弦及12小节主歌；只核对公开预览，未获取其余受限页。吉他指法与六线谱不复制到课程。'},
        {title:'公开尤克里里图｜署名Xixixi',url:'https://www.jianpujia.com/youkelilipu/1924.html',scope:'已直接查看公开图片的C指型主副歌和弦；此站为转载，原教学者授权链与原发布入口未核实，因此不称为官方谱。'},
        {title:'Chord4｜一万次悲伤公开和弦文本',url:'https://chord4.com/tabs/2782',scope:'署名thth1969、由reecho提供的社区和弦文本；用于交叉核对G指型主副歌走向，不作为原录音逐拍证明。'},
        {title:'Chord4｜一万次悲伤另一和弦版本',url:'https://chord4.com/tabs/21076',scope:'公开文本用于交叉核对两遍主歌、三次副歌和末尾主歌回声；本课省略转位低音与附加音，并重写器乐段。'},
        {title:'小凤爱guitar｜超详细《一万次悲伤》尤克里里弹唱教学',url:'https://www.youtube.com/watch?v=fSabibDgV4U',scope:'可选教学入口，公开检索可核对标题/频道；未逐段试听或核验配谱下载。课程练习不依赖该链接。'}
      ],
      sections:[
        {id:'intro',title:'前奏 · 4小节',role:'intro',pattern:'down2',
          bars:bars(['C','Am','F','G']),phrases:[phrase(1,4,'短前奏，最后一小节预备进入')],
          practice:['这4小节是本课创作的短和弦引入，代替原曲器乐前奏。','进入主歌前可带出弱起；和弦谱的小节第1拍不等于每句首字都在第1拍。']},
        {id:'verse',title:'主歌 · 12小节',role:'verse',pattern:'down4',
          bars:bars(['C','G','Am','F','C','G','C','G','Am','F','C','G']),
          phrases:[phrase(1,4,'主歌前半 · 开始与展开'),phrase(5,6,'主歌前半 · 句尾'),phrase(7,10,'主歌后半 · 开始与展开'),phrase(11,12,'主歌后半 · 句尾与进入副歌')],
          practice:['先练1–6小节，再练7–12小节；每组都包含句尾的C→G。','不要把主歌误记成C/G/Am/F反复三次：第7小节已经回到C，最后两小节是C、G。','第12小节G数满，再到副歌第1小节C；唱词尾音持续时，手也要完成这个换点。']},
        {id:'chorus',title:'副歌 · 16小节',role:'chorus',pattern:'down4',
          bars:bars(['C','Am','F','C','Am','F','C','G','C','Am','F','C','Am','F','C','G']),
          phrases:[phrase(1,4,'副歌前半 · 第1组'),phrase(5,8,'副歌前半 · 第2组'),phrase(9,12,'副歌后半 · 第1组'),phrase(13,16,'副歌后半 · 第2组')],
          practice:['每4小节先轻声唱完，再在句间自然换气；不要为吸气插入一个额外小节。','注意第4小节C之后第5小节转Am；不要按前奏习惯转去G。','第8、16小节都用G准备回到C。每轮结束后判断右手是否更快，再决定是否循环。','整段四次下扫连续两遍稳定后，可在副歌尝试八分扫弦；节拍与和弦位置保持不变。']},
        {id:'interlude',title:'间奏 · 8小节',role:'interlude',pattern:'down2',
          bars:bars(['F','F','C','G','F','F','C','G']),
          phrases:[phrase(1,4,'间奏第1组'),phrase(5,8,'间奏第2组')],
          practice:['本课把长器乐段缩为8小节，保留F/F/C/G的起伏；这段不唱主歌。','第5小节重新数1，但BPM不变；最后一小节G后进入末次完整副歌。']},
        {id:'tag',title:'末尾主歌回声 · 6小节',role:'tag',pattern:'down2',
          bars:bars(['C','G','Am','F','C','G']),
          phrases:[phrase(1,4,'重现开头主歌的前半'),phrase(5,6,'唱完回声句并准备落点')],
          practice:['末次副歌后回到主歌前半的6小节，唱完该段再结束；不是第四次完整副歌。','音量可以放轻，但6小节都需数满，不跟着长音任意伸缩。']},
        {id:'outro',title:'结尾 · 2小节',role:'outro',pattern:'down2',
          bars:bars(['C','C']),phrases:[phrase(1,2,'C和弦收束')],
          practice:['在C上明确结束；两小节都在第1、3拍轻扫，最后一次触弦后让声音自然延续。','录音保留余音及短暂停留，随后再停止录制。']}
      ],
      form:[step('intro','4小节引入'),step('verse','主歌 · 第1段'),step('chorus','副歌 · 第1遍'),step('verse','主歌 · 第2段'),step('chorus','副歌 · 第2遍'),step('interlude','8小节短间奏'),step('chorus','末次完整副歌'),step('tag','6小节主歌回声'),step('outro','2小节收束')],
      checkpoints:[
        {title:'12小节主歌',sectionIds:['verse'],target:'60–72 BPM，完整数到12小节，第二半从第7小节C进入；两遍都不误加4小节。'},
        {title:'16小节副歌',sectionIds:['chorus'],target:'同一BPM连续两遍，唱到长句后半时右手仍走拍，C→Am与C→G都按实际位置完成。'},
        {title:'全曲与回声',sectionIds:['intro','verse','chorus','interlude','tag','outro'],target:'按两段主歌、三次副歌、末尾回声的路线录一镜到底；不能只录副歌作为本曲结课证据。'}
      ]
    }
  ];

  songs.forEach(song => {
    const lookup = Object.fromEntries(song.sections.map(section => [section.id,section]));
    let nextBar = 1;
    song.form.forEach(part => {
      part.startBar = nextBar;
      part.endBar = nextBar + lookup[part.sectionId].bars.length * part.repeat - 1;
      nextBar = part.endBar + 1;
    });
    song.totalBars = nextBar - 1;
    song.durationAtDefaultSeconds = Math.round(song.totalBars * 4 * 60 / song.tempo.default);
  });

  window.UKE_SCORES = {
    version:'1.0.0',
    meter:{beatsPerBar:4,beatUnit:4},
    arrangementPolicy:'三首均为本课简化和弦伴奏编配。保留唱段和各曲可识别的和声走向；短前奏、器乐间奏、分段练习与部分收束重编。曲谱与播放器在课内可用，不需要购买外部谱本。',
    readingGuide:[
      '一格就是一小节，一小节四拍；C×4表示C保持四拍，Dm×2 / G7×2表示前两拍Dm、后两拍G7。',
      '先跟节拍数拍，再只弹和弦，再哼唱，最后加唱词。页面演示的是合成伴奏，不包含原唱或旋律领唱。',
      '分段循环用于修复最弱的2–4小节；完整模式按演出路线展开，重复的唱段也会完整保留。',
      '伴奏有自己的小节换点；人声弱起、延音或跨小节句子不改变换和弦的时刻。先慢速对准，再提高速度。'
    ],
    assessment:'三首分开评分：节奏25%、换和弦20%、弹唱协同20%、音高20%、结构15%。每维0–5，单曲总分至少80且每维至少3，并有完整一镜到底、0整段重来和录音证据，才标为自评达标；网页不自动听判。',
    songs
  };
}());
