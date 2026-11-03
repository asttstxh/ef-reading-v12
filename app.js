import {STORY,CHALLENGES} from './story-data.js';
import {QUESTIONS,nextQuestion,recommendLevel,LEVELS} from './quiz-data.js';
import {art,icon} from './art.js';
import {StoryAudio} from './audio.js?v=20261102-11';
import {GOALS} from './learning-meta.js';
import {QUIZ_NARRATION} from './quiz-narration.js';
import {pageHotspots,storyKeywords,portraitStyle} from './reader-content.js?v=20261102-12';
import {ReadAloud} from './read-aloud.js?v=20261102-11';

const app=document.querySelector('#app'),overlay=document.querySelector('#overlay');
const KEY='ef-hen-reading-v2';
const RESET_KEY=KEY+':reset';
const progressKey=generation=>generation ? KEY+':'+generation : KEY;
const isProgressKey=key=>key===KEY||(key.startsWith(KEY+':')&&key!==RESET_KEY);
let sessionGeneration=null;
const fresh=()=>({step:'quiz',quizIntroSeen:false,answers:[],level:1,recommended:1,page:0,seen:[],ai:true,readerAudio:{mode:'companion',playing:true},challengeIndex:0,results:{},drafts:{},words:[],hotspots:{},seconds:0,recordings:0,completed:false,started:false});
let storageAvailable=true,storageNoticeShown=false;let savedReaderAudio=null;let state=fresh();
try {
 sessionGeneration=localStorage.getItem(RESET_KEY);
 const s=JSON.parse(localStorage.getItem(progressKey(sessionGeneration)));
 if(s&&['quiz','recommend','reader','challenge','result'].includes(s.step)&&Array.isArray(s.answers)){
  state={...state,...s};
  savedReaderAudio=s.readerAudio;
 }
} catch {storageAvailable=false;}
state.level=[1,2,3].includes(state.level)?state.level:1;state.page=Math.min(7,Math.max(0,state.page||0));
if(!state.hotspots||typeof state.hotspots!=='object')state.hotspots={};
if(!savedReaderAudio||!['companion','narration'].includes(savedReaderAudio.mode)||typeof savedReaderAudio.playing!=='boolean')state.readerAudio={mode:'companion',playing:state.level===1&&state.ai};
const quizHeard=new Set(),quizAutoPlayed=new Set(),challengeHeard=new Set();let modalTrigger=null;let returnFromReference=null;let busy=false,translation=false,selection=null,order=[],feedback=null,modal=null;
let audioState={status:'idle',context:''};let lastTick=Date.now();let toastTimer;let hasEntered=false;
const audio=new StoryAudio(s=>{audioState=s;updateAudioUI();});
const readAloud=new ReadAloud({getState:()=>state,currentPage,audio,showModal,closeModal,render,save:()=>save(),toast,icon,esc,modalKind:()=>modal});
function esc(s){return String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');}
function save(){
 if(!hasEntered)return;
 if(storageAvailable){
  try{
   if(localStorage.getItem(RESET_KEY)===sessionGeneration)localStorage.setItem(progressKey(sessionGeneration),JSON.stringify(state));
  }catch{storageAvailable=false;}
 }
 if(!storageAvailable&&!storageNoticeShown){storageNoticeShown=true;toast('当前浏览器无法保存进度，这次仍可以继续阅读。');}
}
function currentPage(){return STORY.levels[state.level].pages[state.page];}
const bookWords=()=>state.words.filter(w=>w.readingLevel===state.level);
const collectedWords=()=>bookWords().filter(w=>w.collected!==false);
const goalFor=c=>GOALS[state.level].find(g=>g.id===c.goalId)||GOALS[state.level][0];
function restoreChallenge(){const c=CHALLENGES[state.level][state.challengeIndex],r=state.results[c?.id];const draft=state.drafts?.[c?.id];if(draft){selection=draft.selection;order=[...draft.order];}else if(r){feedback={correct:r.correct??r.firstCorrect};if(c.kind==='order')order=[...r.choice];else selection=r.choice;}}
function saveDraft(){const c=CHALLENGES[state.level][state.challengeIndex];state.drafts[c.id]={selection,order:[...order]};save();}
const scene=(n,cls='')=>`<div class="story-art scene-${n} ${cls}" role="img" aria-label="${esc(STORY.levels[1].pages[n]?.title||'小红母鸡的故事')}" style="--atlas:url('assets/story-${n<4?1:2}.webp');--sx:${n%2?100:0}%;--sy:${n%4>1?100:0}%"></div>`;
const smallBrand=()=>`<span class="brand"><b class="ef-logo">EF</b><span>阅读大赛</span></span>`;
const menuButton=()=>`<button class="icon-btn" data-action="menu" aria-label="我的阅读">${icon('more')}</button>`;
const header=(back=false,center='')=>`<header class="topbar">${back?`<button class="icon-btn" data-action="back" aria-label="返回">${icon('back')}</button>`:smallBrand()}${center?`<div class="header-title">${center}</div>`:''}${menuButton()}</header>`;
const primary=(label,action,extra='')=>`<button class="primary" data-action="${action}" ${extra}>${label}${icon('arrow',20)}</button>`;
function toast(text){const t=document.querySelector('#toast');t.textContent=text;t.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('visible'),2200);}
function dismissToast(){
 clearTimeout(toastTimer);
 const notice=document.querySelector('#toast');
 notice.classList.remove('visible');notice.textContent='';
}
function go(step){dismissToast();audio.stop();readAloud.cancel();closeModal();state.step=step;busy=false;translation=false;selection=null;order=[];feedback=null;if(step==='challenge')restoreChallenge();save();render();window.scrollTo({top:0,behavior:'instant'});if(step==='reader')resumePage();}
function render(){if(!hasEntered){app.className='app-shell welcome-screen';app.innerHTML=renderWelcome();return;}if(state.step==='quiz'&&state.answers.length===0&&!state.quizIntroSeen){app.className='app-shell quiz-intro-screen';app.innerHTML=renderQuizIntro();return;}app.className=`app-shell ${state.step}-screen`;app.innerHTML=({quiz:renderQuiz,recommend:renderRecommend,reader:renderReader,challenge:renderChallenge,result:renderResult}[state.step])();updateAudioUI();autoQuizAudio();}

function renderWelcome(){return `<main class="welcome-main" aria-labelledby="welcome-title"><div class="welcome-header"><div class="welcome-brand" aria-label="EF 英孚教育"><b class="ef-logo" aria-hidden="true">EF</b></div>${menuButton()}</div><h1 id="welcome-title"><span>英孚第一季</span><strong>阅读大赛</strong></h1><div class="welcome-illustration">${scene(0)}</div><div class="welcome-action">${primary('开始','enter-activity')}</div></main>`;}

function renderQuizIntro(){audio.primeClips(quizItems(nextQuestion([])));return `${header()}<main class="quiz-intro-main" aria-labelledby="quiz-intro-title"><div class="quiz-intro-art" aria-hidden="true">${art('book')}</div><div class="quiz-intro-copy"><h1 id="quiz-intro-title">一起玩个小游戏</h1><p class="quiz-intro-description">我们会根据你的答案，<br>帮你挑选难度合适的阅读故事</p><p class="quiz-intro-reassurance">不会也没关系，可以跳过哦</p></div><div class="quiz-intro-action">${primary('开始玩','begin-quiz')}</div></main>`;}

function renderQuiz(){
 const q=nextQuestion(state.answers);if(!q){state.recommended=recommendLevel(state.answers);setLevel(state.recommended);state.step='recommend';save();return renderRecommend();}
 const progress=[0,1,2,3,4].map(i=>'<i class="'+(i<state.answers.length?'done':i===state.answers.length?'current':'')+'"></i>').join('');
 const cards=q.choices.map((c,i)=>'<button class="quiz-card" data-action="quiz-answer" data-id="'+c.id+'" aria-label="'+esc(c.label)+'" aria-pressed="false"><span class="choice-marker">'+String.fromCharCode(65+i)+'</span>'+art(c.art,c.label)+(q.showLabels?'<span class="choice-label" lang="en">'+esc(c.label)+'</span>':'')+'</button>').join('');
 return header()+'<main class="quiz-main"><div class="quiz-progress"><span>英语小游戏</span><span class="progress-dots" aria-label="第 '+(state.answers.length+1)+' 题，共 5 题">'+progress+'</span><span>'+(state.answers.length+1)+'<small> / 5</small></span></div><p class="phone-sound">'+icon('sound',17)+' 请打开手机声音，听一听再选</p><h1>'+q.title+'</h1><p class="hint">'+q.hint+'</p><div class="question-prompt '+(q.text?.length>35?'long':'')+'">'+(q.text?'<span lang="en">'+esc(q.text)+'</span>':'')+'<button class="listen-question" data-action="quiz-audio" aria-label="播放题目语音">'+icon('sound',22)+'<span>再听一遍</span><span class="sound-lines"><i></i><i></i><i></i></span></button></div><div class="quiz-options '+(q.choices.length===3?'three-options':'')+' '+(q.id==='before'?'sequence-options':'')+'">'+cards+'</div><div class="quiz-footer"><button class="text-button skip" data-action="quiz-skip">还不太会，下一题 '+icon('chevron',15)+'</button><p>'+(state.answers.length===0?'一共 5 个小游戏，选你觉得合适的就好。':state.answers.length===4?'最后一题，故事就要开始啦。':'不会也没关系，可以跳过哦。')+'</p></div></main>';
}
function quizItems(q){return [{text:QUIZ_NARRATION[q.id],lang:'zh',kind:'quiz-guide'},{text:q.audio||q.text,lang:'en',kind:'quiz-target'}];}
function playQuiz(){const q=nextQuestion(state.answers);if(q&&!busy)audio.play(quizItems(q),'quiz');}
function autoQuizAudio(){if(!hasEntered||state.step!=='quiz'||(state.answers.length===0&&!state.quizIntroSeen)||modal||busy)return;const q=nextQuestion(state.answers);if(!q)return;const key=state.answers.length+':'+q.id;if(quizAutoPlayed.has(key))return;quizAutoPlayed.add(key);playQuiz();}

function answerQuiz(id){if(busy)return;const q=nextQuestion(state.answers);if(!q)return;if(id&&q.audio&&!quizHeard.has(q.id)){toast('先点一下听声音，再选图片吧。');return;}busy=true;audio.stop();app.querySelectorAll('.quiz-card,.skip').forEach(b=>b.disabled=true);if(id){const selected=app.querySelector('[data-id="'+id+'"]');selected?.classList.add('selected');selected?.setAttribute('aria-pressed','true');}state.answers.push({id:q.id,choice:id,correct:id===q.correct,level:q.level,skill:q.skill,heard:q.audio?quizHeard.has(q.id):null});save();const next=nextQuestion(state.answers);if(next)audio.primeClips(quizItems(next));setTimeout(()=>{busy=false;if(state.answers.length===5){state.recommended=recommendLevel(state.answers);state.level=state.recommended;state.ai=state.level===1;state.readerAudio={mode:'companion',playing:state.ai};go('recommend');}else render();},id?420:150);}

function renderRecommend(){audio.primePage(state.level,state.completed?0:state.page);const l=LEVELS[state.level];const continuing=state.started&&!state.completed;return `${header()}<main class="recommend-main"><div class="eyebrow">${continuing?'你的故事，等你继续':state.completed?'我的阅读记录':'小游戏完成啦'}</div><h1>${continuing?'接着读故事吧':state.completed?'这个故事，你读完啦':'故事准备好啦！'}</h1><p class="hint">${continuing?'小红母鸡还在农场等你。':state.completed?'再读一遍，或换个难度试一试。':'来读《小红母鸡》，看看发生了什么。'}</p><div class="book-cover">${scene(0)}<div class="cover-lettering"><span>THE LITTLE RED HEN</span><h2>小红母鸡</h2><p>一颗小种子，一场大冒险</p></div><span class="book-corner">8 页故事</span></div><div class="level-recommend"><div class="level-badge level-${state.level}">L${state.level}</div><div><span class="tiny-label">${state.level===state.recommended?'推荐难度':'我的选择'}</span><h3>${l.name}</h3><p>${l.description}</p></div><button class="text-button" data-action="levels">调整 ${icon('chevron',15)}</button></div><div class="reading-goal"><span>${icon('leaf',16)} ${GOALS[state.level][0].label}</span><p>${GOALS[state.level][0].observable}</p></div><div class="journey-preview"><span>${icon('book',17)} 读一个故事</span><i></i><span>${icon('star',17)} ${CHALLENGES[state.level].length} 个小挑战</span></div>${primary(continuing?`继续第 ${state.page+1} 页`:state.completed?'再读一次':'开始阅读','start-reading')}<p class="under-button">${continuing?'阅读进度已为你留好':'跟着自己的节奏，随时可以暂停'}</p></main>`;}
function wordById(id){return STORY.levels[state.level].pages.flatMap(p=>p.words).find(w=>w.id===id);}
function sentenceMarkup(s,i,p){let text='',cursor=0;for(const ref of [...(s.wordRefs||[])].sort((a,b)=>a.start-b.start)){text+=esc(s.en.slice(cursor,ref.start));const surface=s.en.slice(ref.start,ref.end);text+=`<button class="word" data-action="word" data-id="${esc(ref.wordId)}" data-surface="${esc(surface)}">${esc(surface)}</button>`;cursor=ref.end;}text+=esc(s.en.slice(cursor));return `<div class="sentence" data-sentence="${i}"><p lang="en" data-action="sentence-audio" data-index="${i}">${text}<span class="sentence-actions"><button class="sentence-listen" data-action="sentence-audio" data-index="${i}" aria-label="朗读第 ${i+1} 句">${icon('sound',15)}</button><button class="sentence-meaning" data-action="sentence-meaning" data-index="${i}" aria-label="查看这句中文">中</button></span></p></div>`;}

function renderReader(){
 const p=currentPage();audio.primePage(state.level,state.page);if(!state.seen.includes(state.page)){state.seen.push(state.page);save();}
 const companion='<section class="companion '+(state.ai?'enabled':'')+'" aria-label="AI 伴读"><div class="zap-portrait" aria-hidden="true"><span class="zap-sprite"></span></div><div class="companion-copy"><div class="companion-heading">Zap <span>AI 伴读</span><button class="switch '+(state.ai?'on':'')+'" role="switch" aria-checked="'+state.ai+'" data-action="ai-toggle" aria-label="AI 伴读开关"><i></i></button></div><p class="companion-status">'+(state.ai?'我陪你一起读':'需要时，叫我一起读')+'</p></div><button class="companion-play icon-btn" data-action="companion" aria-label="播放 AI 伴读">'+icon('play',19)+'</button></section>';
 const hotspots=pageHotspots(state.level,state.page).map(h=>readAloud.hotspotMarkup(h)).join('');
 return header(true,'<span>小红母鸡</span><small>L'+state.level+' · '+LEVELS[state.level].name+'</small>')+'<div class="reading-progress"><span style="width:'+((state.page+1)/8*100)+'%"></span></div><main class="reader-main"><div class="page-meta"><span>'+esc(p.title)+'</span><span><b>'+String(state.page+1).padStart(2,'0')+'</b> / 08</span></div><div class="picture-page scene-'+p.scene+'" style="'+portraitStyle(p.scene)+'"><article class="picture-text level-text-'+state.level+'">'+p.sentences.map((sentence,i)=>sentenceMarkup(sentence,i,p)).join('')+'</article><div class="picture-stage"><div class="portrait-art" role="img" aria-label="'+esc(p.title)+'"></div>'+hotspots+'</div></div><div class="reading-tools"><button class="tool-button narration" data-action="narrate">'+icon('sound',19)+'<span>听英文</span></button><button class="tool-button" data-action="translation">'+icon('translate',18)+'<span>看中文</span></button><button class="tool-button" data-action="record">'+icon('mic',18)+'<span>我来读</span></button></div><p class="word-hint">点句子听英文 · 点词听发音、看意思</p></main>'+(returnFromReference?'<button class="reference-return" data-action="reference-return">'+icon('back',16)+' '+(returnFromReference==='challenge'?'回到这道挑战':'回到单词小口袋')+'</button>':'')+'<footer class="reader-footer">'+companion+'<button class="previous icon-btn" data-action="prev-page" aria-label="上一页" '+(state.page===0?'disabled':'')+'>'+icon('back',23)+'</button><span class="page-count">'+(state.page+1)+' / 8</span>'+primary(state.page===7?'完成阅读，去挑战':'下一页',state.page===7?'start-challenge':'next-page')+'</footer>';
}
const narrationItems=()=>currentPage().sentences.map((s,i)=>({text:s.en,lang:'en',kind:'sentence',sentence:i}));
function pageAudioItems(mode){return mode==='companion'?[{text:currentPage().guide,lang:'zh',kind:'guide'},...narrationItems()]:narrationItems();}
function resumePage(){
 if(state.level>1){audio.play(narrationItems(),'narration');return;}
 if(state.readerAudio.playing)audio.play(pageAudioItems(state.readerAudio.mode),state.readerAudio.mode);
}
function playPage(companion=false){
 const mode=companion?'companion':'narration';
 const active=audioState.context===mode&&['playing','loading'].includes(audioState.status);
 state.readerAudio={mode,playing:!active};if(companion)state.ai=true;save();
 if(active)audio.pause();else if(audioState.context===mode&&audioState.status==='paused')audio.resume();else audio.play(pageAudioItems(mode),mode);
 updateAudioUI();
}
function navigatePage(page,index=null,reference=null){
 const target=Math.max(0,Math.min(7,page));
 const move=()=>{dismissToast();audio.stop();readAloud.cancel();closeModal();state.page=target;if(reference)returnFromReference=reference;state.step='reader';translation=false;save();render();window.scrollTo({top:0,behavior:'instant'});resumePage();if(index!==null)focusSentence(index);};
 if(target<=state.page)move();else guardJourney(target,move);
}
function guardJourney(target,next){
 for(let page=state.page;page<target;page++){
  const point=pageHotspots(state.level,page).find(h=>!readAloud.done(h));
  if(!point)continue;
  if(state.step!=='reader'||state.page!==page){state.page=page;go('reader');}
  readAloud.remind(point);
  return;
 }
 next();
}
function pageTurn(delta){navigatePage(state.page+delta);}

function updateAudioUI(){if(!app)return;const playing=audioState.status==='playing',paused=audioState.status==='paused';if(playing&&audioState.context==='quiz'&&audioState.item?.kind==='quiz-target'){const q=nextQuestion(state.answers);if(q)quizHeard.add(q.id);}if(playing&&audioState.context==='challenge')challengeHeard.add(CHALLENGES[state.level][state.challengeIndex].id);const cp=app.querySelector('.companion');if(cp){const active=audioState.context==='companion';cp.classList.toggle('speaking',active&&playing);cp.classList.toggle('waiting',active&&audioState.status==='loading');const status=cp.querySelector('.companion-status');status.textContent=!state.ai?'需要时，叫我一起读':active?(paused?'暂停啦，点一下接着读':audioState.status==='loading'?'准备好，马上开始':audioState.status==='unavailable'?'暂时没能播放，点一下重试':playing?(audioState.item?.kind==='guide'?audioState.item.text:'一起听这页的英文'):'这一页读完啦'):(state.readerAudio.playing?'我陪你一起读':'暂停啦，点一下接着读');const b=cp.querySelector('.companion-play');b.innerHTML=icon(active&&!paused&&!['idle','unavailable'].includes(audioState.status)?'pause':'play',19);b.setAttribute('aria-label',active&&!paused&&!['idle','unavailable'].includes(audioState.status)?'暂停 AI 伴读':'播放 AI 伴读');}
 const n=app.querySelector('.narration');if(n){const active=audioState.context==='narration';n.classList.toggle('active',active&&playing);n.innerHTML=icon(active&&!paused&&!['idle','unavailable'].includes(audioState.status)?'pause':'sound',19)+`<span>${active?(paused?'继续听':playing?'暂停朗读':audioState.status==='loading'?'正在加载':audioState.status==='unavailable'?'重试听':'听英文'):'听英文'}</span>`;}
 app.querySelectorAll('[data-sentence]').forEach(el=>{
  const selected=audioState.item?.sentence===Number(el.dataset.sentence)&&['companion','narration','sentence'].includes(audioState.context);
  el.classList.toggle('reading-active',selected&&playing);
  el.classList.toggle('reading-loading',selected&&audioState.status==='loading');
 });
 if(modal==='word'){
  const button=overlay.querySelector('[data-action="word-audio"]');
  if(button){
   const active=audioState.context==='word'&&audioState.item?.text===button.dataset.word;
   const label=active&&audioState.status==='loading'?'正在加载':active&&playing?'正在读':active&&audioState.status==='unavailable'?'重试听':'听读';
   button.innerHTML=icon('sound',19)+' '+label;
  }
 }
 const challengePlay=app.querySelector('.challenge-listen');if(challengePlay){const active=audioState.context==='challenge';challengePlay.innerHTML=icon(active&&playing?'pause':'sound',22)+` ${active?(paused?'继续听':playing?'暂停声音':'听一听这句话'):'听一听这句话'}`;}
 const q=app.querySelector('.listen-question');if(q){q.classList.toggle('playing',playing&&audioState.context==='quiz');q.querySelector('span').textContent=playing&&audioState.context==='quiz'?'正在读题目':audioState.context==='quiz'&&paused?'点一下，听题目':'再听一遍';}
 if(audioState.blocked)toast('点一下小喇叭，就能听到声音。');
 if(audioState.status==='unavailable')toast('音频暂时没能播放，请点播放键重试。');}

function renderChallenge(){const list=CHALLENGES[state.level];state.challengeIndex=Math.min(state.challengeIndex,list.length-1);const c=list[state.challengeIndex],g=goalFor(c);if(c.audio)audio.primeClips([{text:typeof c.audio==='string'?c.audio:c.audio.text,lang:'en'}]);return `${header(true,'<span>故事小挑战</span>')}<main class="challenge-main"><div class="quiz-progress"><span>把发现带走</span><span>${state.challengeIndex+1}<small> / ${list.length}</small></span></div><div class="challenge-heading">${art('star','阅读小挑战')}<div class="eyebrow">${g.label}</div><h1>${c.title}</h1></div><p class="goal-observable">${esc(g.observable)}</p><p class="challenge-prompt" lang="${state.level===1?'zh-CN':'en'}">${esc(c.prompt)}</p>${c.audio?`<button class="challenge-listen secondary" data-action="challenge-audio">${icon('sound',22)} 听一听这句话</button>`:''}${c.kind==='order'?`<p class="hint order-hint">按故事的先后点图片，点上方图片可以重排</p><div class="order-slots">${[0,1,2].map((n)=>{const item=c.choices.find(x=>x.id===order[n]);return `<button class="order-slot ${item?'filled':''}" data-action="order-undo" data-index="${n}" ${feedback?'disabled':''}>${item?scene(item.scene):`<span>${n+1}</span>`}</button>`;}).join('')}</div><div class="challenge-choices order-choices">${c.choices.map(ch=>`<button class="challenge-card ${order.includes(ch.id)?'used':''}" data-action="challenge-order" data-id="${ch.id}" ${order.includes(ch.id)||feedback?'disabled':''}>${scene(ch.scene)}<span>${esc(ch.label)}</span></button>`).join('')}</div>`:`<div class="challenge-choices ${feedback?'feedback-state':''} ${c.choices[0].scene!==undefined?'illustrated':''}">${c.choices.map((ch,i)=>`<button class="challenge-card ${selection===ch.id?'selected':''} ${feedback&&ch.id===c.correct?'answer-correct':''}" data-action="challenge-choice" data-id="${ch.id}" aria-pressed="${selection===ch.id}" ${feedback?'disabled':''}>${ch.scene!==undefined?scene(ch.scene):`<span class="answer-letter">${String.fromCharCode(65+i)}</span>`}<span>${esc(ch.label)}</span>${feedback&&ch.id===c.correct?icon('check',19):''}</button>`).join('')}</div>`}${feedback?`<div class="answer-feedback"><strong>${feedback.correct?'你找到线索啦！':'一起看看故事里的线索'}</strong><p>${esc(c.feedback)}</p><div class="feedback-actions"><button class="text-button" data-action="evidence">回到原文 ${icon('book',14)}</button>${!feedback.correct?'<button class="text-button" data-action="challenge-retry">再试一次</button>':''}</div></div>${primary(state.challengeIndex===list.length-1?'看看我的阅读收获':'下一个小挑战','challenge-next')}`:primary('我选好啦','challenge-check',((c.kind==='order'?order.length!==c.choices.length:!selection)?'disabled':''))}</main>`;}
function checkChallenge(){const c=CHALLENGES[state.level][state.challengeIndex];if(feedback)return;if(c.audio&&!challengeHeard.has(c.id)){toast('先听一听这句话，再来检查答案。');return;}const correct=c.kind==='order'?JSON.stringify(order)===JSON.stringify(c.correct):selection===c.correct;if((c.kind==='order'&&order.length!==c.choices.length)||(c.kind==='choice'&&!selection))return;const previous=state.results[c.id];state.results[c.id]={firstCorrect:previous?.firstCorrect??correct,correct,choice:c.kind==='order'?[...order]:selection,done:true,attempts:(previous?.attempts||0)+1,hintViewed:previous?.hintViewed||!correct};delete state.drafts[c.id];feedback={correct};save();render();setTimeout(()=>app.querySelector('.answer-feedback')?.scrollIntoView({behavior:'smooth',block:'nearest'}),80);}
function resultStatus(r,draft){if(draft)return draft.selection||draft.order.length?'已选择，等你检查':'准备再试一次';if(!r)return '还没有作答';if(!r.correct)return '跟着线索再试试';if(r.firstCorrect)return '首次答对';return r.hintViewed?'看过提示后答对':'再次尝试后答对';}
function renderResult(){const list=CHALLENGES[state.level],tasks=list.map(c=>state.results[c.id]).filter(Boolean),right=tasks.filter(x=>x.correct).length,all=list.length,confident=tasks.length===all&&tasks.every(x=>x.firstCorrect&&x.correct)&&!Object.keys(state.drafts).length,nextLevel=confident?Math.min(3,state.level+1):state.level,elapsed=state.seconds<60?'不到 1':'约 '+Math.max(1,Math.round(state.seconds/60));return `${header()}<main class="result-main"><div class="result-art">${scene(6)}<div class="result-seal">${icon(state.completed?'check':'book',26)}</div></div><div class="eyebrow">${state.completed?'一个故事，一点新发现':'每个小发现，都值得记下'}</div><h1>${state.completed?'故事读到这里，真好！':'看看我的阅读收获'}</h1><p class="hint">${state.completed?'小红母鸡的故事，你有什么新发现？':'继续读、继续试，按自己的节奏来。'}</p><div class="achievement-card"><span class="achievement-level">L${state.level} · ${LEVELS[state.level].name}</span><h2>The Little Red Hen</h2><div class="stats"><div><b>${state.seen.length}<small> / 8</small></b><span>看过的故事页</span></div><div><b>${tasks.length}<small> / ${all}</small></b><span>作答挑战</span></div><div><b>${collectedWords().length}</b><span>收藏的词</span></div></div></div><section class="goal-summary"><span class="tiny-label">今天的学习小结</span>${GOALS[state.level].map(g=>{const cs=list.filter(c=>c.goalId===g.id);return `<h3>${g.label}</h3><p>${g.observable}</p><div class="goal-results">${cs.map(c=>{const r=state.results[c.id];return `<button data-action="review-task" data-id="${c.id}"><span>${c.title}<small>${resultStatus(r,state.drafts[c.id])}${r?.attempts>1?' · 尝试 '+r.attempts+' 次':''}</small></span>${icon(r?.correct?'check':'chevron',18)}</button>`;}).join('')}</div>`;}).join('')}</section>${renderKeywords()}<button class="vocabulary-entry" data-action="vocabulary">${icon('book',22)}<div><strong>我的单词小口袋</strong><span>${collectedWords().length?'带着原文例句，再听一听':'点上方的词，把发现装进口袋'}</span></div>${icon('chevron',20)}</button><div class="next-reading"><span class="tiny-label">接下来，试试这样读</span><h3>${nextLevel>state.level?`用 L${nextLevel} 再发现一点`:confident?'用自己的声音讲一讲':'回到故事，找找线索'}</h3><p>${nextLevel>state.level?'同一个故事，多一点英文，多一些新发现。':confident?'回到你最喜欢的一页，读给自己听。':'再看看人物的行动，或继续还没有完成的小挑战。'}</p><button class="secondary" data-action="suggested-reading" data-level="${nextLevel}">${nextLevel>state.level?'试试 L'+nextLevel:'回到故事'} ${icon('arrow',19)}</button></div><p class="session-note">本次阅读用时 ${elapsed} 分钟${state.recordings?` · 完成 ${state.recordings} 次跟读录音`:''}</p><button class="text-button" data-action="home">回到我的故事</button></main>`;}

function showModal(title,body,kind='generic'){dismissToast();if(modal==='speech')readAloud.cancel();if(!overlay.contains(document.activeElement))modalTrigger=document.activeElement;audio.pause();modal=kind;overlay.innerHTML=`<div class="scrim" data-action="close-modal"></div><section class="sheet ${kind==='speech'?'record-sheet':''}" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-heading"><h2 id="sheet-title">${title}</h2><button class="icon-btn" data-action="close-modal" aria-label="关闭">${icon('close')}</button></div>${body}</section>`;document.body.classList.add('has-modal');overlay.querySelector('.sheet .icon-btn')?.focus();}
function closeModal(){if(modal)audio.stop();readAloud.cancel();overlay.innerHTML='';modal=null;document.body.classList.remove('has-modal');if(modalTrigger?.isConnected)modalTrigger.focus({preventScroll:true});modalTrigger=null;}
function showLevels(){showModal('选个合适的难度',`<p class="sheet-intro">觉得太难或太简单，都可以换一换。</p><div class="level-choices">${[1,2,3].map(l=>`<button class="level-option ${l===state.level?'selected':''}" data-action="choose-level" data-level="${l}"><span class="level-badge level-${l}">L${l}</span><div><strong>${LEVELS[l].name}</strong><span>${LEVELS[l].description}</span></div>${l===state.level?icon('check'):''}</button>`).join('')}</div>`,'levels');}
function setLevel(l){returnFromReference=null;if(l!==state.level){state.level=l;state.ai=l===1;state.readerAudio={mode:'companion',playing:l===1};readAloud.reset();state.page=0;state.seen=[];state.results={};state.drafts={};state.challengeIndex=0;state.completed=false;state.started=false;state.seconds=0;state.recordings=0;}save();}
function wordContexts(w){const out=[];for(const c of w.contexts||[]){const page=STORY.levels[state.level].pages.findIndex(p=>p.id===c.pageId);if(page<0||out.some(x=>x.text===c.en))continue;const index=STORY.levels[state.level].pages[page].sentences.findIndex(x=>x.id===c.sentenceId);out.push({page,index,text:c.en,start:c.start,end:c.end});}return out.slice(0,2);}

function contextMarkup(w){return wordContexts(w).map(c=>`<p class="word-example" lang="en">${esc(c.text.slice(0,c.start))}<mark>${esc(c.text.slice(c.start,c.end))}</mark>${esc(c.text.slice(c.end))}<button class="original-link" data-action="word-original" data-page="${c.page}" data-index="${c.index}">原文</button></p>`).join('');}
function ensureWord(w){let saved=bookWords().find(x=>x.id===w.id);if(!saved){saved={...w,readingLevel:state.level,collected:true};state.words.push(saved);save();}return saved;}
function showWord(id,surface){const base=wordById(id);if(!base)return;const w={...base,en:surface||base.en};const saved=ensureWord(w);showModal('词语小发现',`<div class="word-detail"><span class="tiny-label">${w.pos} · ${w.level?'词汇参考 '+w.level:'拓展词'}</span><h3 lang="en">${esc(w.lemma||w.en)}</h3><span class="word-ipa">${esc(w.ipa||'')}</span>${w.lemma!==w.en?`<small class="word-surface">故事里是：${esc(w.en)}</small>`:''}<p>${esc(w.zh)}</p></div><div class="word-controls"><button class="secondary ${saved.collected?'saved':''}" data-action="save-word" data-id="${w.id}" data-word="${esc(w.en)}">${icon(saved.collected?'check':'book',18)} 生词本</button><button class="secondary" data-action="word-audio" data-word="${esc(w.lemma||w.en)}">${icon('sound',19)} 听读</button></div><div class="word-contexts">${contextMarkup(w)}</div>`,'word');}
function showVocabulary(){showModal('我的单词小口袋',bookWords().length?`<div class="saved-words">${bookWords().map(w=>`<article class="saved-word"><div class="saved-word-heading"><span><b lang="en">${esc(w.lemma||w.en)}</b><small>${esc(w.zh)}</small></span><button class="icon-btn ${w.collected?'saved':''}" data-action="save-word" data-id="${w.id}" aria-label="${w.collected?'取消收藏':'加入生词本'} ${esc(w.en)}">${icon(w.collected?'check':'book',18)}</button><button class="icon-btn" data-action="word-audio" data-word="${esc(w.lemma||w.en)}" aria-label="听读 ${esc(w.en)}">${icon('sound',20)}</button></div>${contextMarkup(w)}</article>`).join('')}</div>`:`<div class="empty-pocket">${art('book')}<p>在故事里点一下感兴趣的词，<br>带着它的原文例句，一起收进来。</p></div>`,'vocabulary');}

function showMenu(){
 const storyLinks=hasEntered&&state.step!=='quiz'?`<button data-action="home">${icon('book')} 我的故事 ${icon('chevron',18)}</button><button data-action="levels">${icon('leaf')} 调整阅读难度 ${icon('chevron',18)}</button><button data-action="summary">${icon('star')} 学习小结 ${icon('chevron',18)}</button><button data-action="vocabulary">${icon('heart')} 单词小口袋 <span>${collectedWords().length}</span></button>`:'';
 const replay=hasEntered?`<button data-action="restart-question">${icon('play')} 再玩一次小游戏 ${icon('chevron',18)}</button>`:'';
 showModal('我的阅读',`<div class="menu-links">${storyLinks}${replay}<button class="clear-progress" data-action="clear-progress">${icon('replay')} 清除缓存重新开始 ${icon('chevron',18)}</button></div>`,'menu');
}
function confirmClearProgress(){
 showModal('要从头开始吗？',`<p class="sheet-intro reset-note">这会清除这台设备上的答题记录、阅读进度和收藏的单词。确认后就回到活动封面。</p><div class="reset-actions"><button class="secondary" data-action="close-modal">取消</button><button class="primary" data-action="clear-progress-confirm">清除并重新开始</button></div>`,'clear-progress');
}
function reloadAtCover(){
 hasEntered=false;
 audio.stop();
 readAloud.reset();
 window.location.reload();
}
function clearActivityProgress(){
 // Commit the new session first. A failed write must leave the previous record intact.
 const generation=globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
 try{
  localStorage.setItem(RESET_KEY,generation);
 }catch{
  // Some browsers allow reads but never store a session. Only restart if there is no save to lose.
  try{if(!Object.keys(localStorage).some(isProgressKey)){reloadAtCover();return;}}catch{}
  toast('暂时无法清除记录，请再试一次。');
  return;
 }
 reloadAtCover();
}
function removeObsoleteProgress(){
 if(!sessionGeneration)return;
 try{
  const activeKey=progressKey(sessionGeneration);
  const obsolete=Object.keys(localStorage).filter(key=>isProgressKey(key)&&key!==activeKey);
  // Another tab might have started a newer session while this page was loading.
  if(localStorage.getItem(RESET_KEY)!==sessionGeneration)return;
  for(const key of obsolete)localStorage.removeItem(key);
 }catch{
  toast('进度已重置，但部分旧记录还没清除，可在右上角重试。');
 }
}
function focusSentence(index){requestAnimationFrame(()=>{const el=app.querySelector(`[data-sentence="${index}"]`);if(el){el.classList.add('reference-highlight');el.setAttribute('tabindex','-1');el.scrollIntoView({behavior:'smooth',block:'center'});el.focus({preventScroll:true});setTimeout(()=>el.classList.remove('reference-highlight'),2500);}});}
function showMeaning(index=null){const sentences=index===null?currentPage().sentences:[currentPage().sentences[index]];showModal('读懂这一句','<div class="meaning-list">'+sentences.map(sentence=>'<div><p lang="en">'+esc(sentence.en)+'</p><p>'+esc(sentence.zh)+'</p><div class="meaning-audio"><button class="text-button" data-action="word-audio" data-word="'+esc(sentence.en)+'">'+icon('sound',17)+' 听英文</button><button class="text-button" data-action="word-audio" data-lang="zh" data-word="'+esc(sentence.zh)+'">'+icon('sound',17)+' 听中文</button></div></div>').join('')+'</div>','meaning');}

function renderKeywords(){const words=storyKeywords(STORY,state.level);audio.primeClips(words.slice(0,6).map(w=>({text:w.lemma||w.en,lang:'en'})));return '<section class="story-keywords"><h2>故事里的重点词</h2><p>点单词听读，点爱心装进单词小口袋。</p><div class="keyword-grid">'+words.map(w=>{const saved=bookWords().find(x=>x.id===w.id)?.collected;return '<article class="keyword-card"><button class="keyword-name" data-action="word-audio" data-word="'+esc(w.lemma||w.en)+'" aria-label="听读 '+esc(w.lemma||w.en)+'"><b lang="en">'+esc(w.lemma||w.en)+'</b>'+icon('sound',13)+'</button><div class="keyword-detail"><span>'+esc(w.zh)+'</span><button class="keyword-collect '+(saved?'saved':'')+'" data-action="collect-keyword" data-id="'+w.id+'" aria-label="'+(saved?'取消收藏':'收藏')+' '+esc(w.lemma||w.en)+'" aria-pressed="'+!!saved+'">'+icon('heart',15)+'</button></div></article>';}).join('')+'</div></section>';}
function collectKeyword(id){const w=wordById(id);if(!w)return;let saved=bookWords().find(x=>x.id===id);if(saved)saved.collected=!saved.collected;else state.words.push({...w,readingLevel:state.level,collected:true});save();render();}

document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b||b.disabled)return;const a=b.dataset.action;
 if(a==='enter-activity'){hasEntered=true;lastTick=Date.now();go(state.step);}
 else if(a==='begin-quiz'){state.quizIntroSeen=true;go('quiz');}
 else if(a==='quiz-answer')answerQuiz(b.dataset.id);
 else if(a==='quiz-skip')answerQuiz(null);
 else if(a==='quiz-audio')playQuiz();
 else if(a==='menu')showMenu();
 else if(a==='clear-progress')confirmClearProgress();
 else if(a==='clear-progress-confirm')clearActivityProgress();
 else if(a==='close-modal'){audio.stop();closeModal();}
 else if(a==='levels')showLevels();
 else if(a==='choose-level'){const changed=Number(b.dataset.level)!==state.level;setLevel(Number(b.dataset.level));closeModal();if(changed)go('recommend');else render();}
 else if(a==='home'){returnFromReference=null;go(state.answers.length===5?'recommend':'quiz');}
 else if(a==='back'){if(state.step==='reader')go('recommend');else if(state.step==='challenge')go('reader');else go('recommend');}
 else if(a==='start-reading'){returnFromReference=null;if(state.completed){readAloud.reset();state.readerAudio={mode:'companion',playing:state.level===1};state.ai=state.level===1;state.page=0;state.seen=[];state.results={};state.drafts={};state.challengeIndex=0;state.seconds=0;state.recordings=0;state.completed=false;}state.started=true;go('reader');}
 else if(a==='next-page')pageTurn(1);
 else if(a==='prev-page')pageTurn(-1);
 else if(a==='translation')showMeaning();
 else if(a==='sentence-meaning')showMeaning(Number(b.dataset.index));
 else if(a==='sentence-audio'){const i=Number(b.dataset.index);audio.play([{text:currentPage().sentences[i].en,lang:'en',kind:'sentence',sentence:i}],'sentence');}
 else if(a==='narrate')playPage(false);
 else if(a==='companion'){if(!state.ai){state.ai=true;save();render();}playPage(true);}
 else if(a==='ai-toggle'){state.ai=!state.ai;state.readerAudio={mode:'companion',playing:state.ai};audio.stop();save();render();if(state.ai)audio.play(pageAudioItems('companion'),'companion');}
 else if(a==='word'){
  const w=wordById(b.dataset.id);
  if(w){showWord(w.id,b.dataset.surface);audio.play([{text:w.lemma||w.en,lang:'en'}],'word');}
 }
 else if(a==='word-audio')audio.play([{text:b.dataset.word,lang:b.dataset.lang||'en'}],'word');
 else if(a==='save-word'){const w=bookWords().find(x=>x.id===b.dataset.id);if(w){w.collected=!w.collected;save();if(modal==='vocabulary')showVocabulary();else showWord(b.dataset.id,b.dataset.word);}}
 else if(a==='vocabulary')showVocabulary();
 else if(a==='start-challenge')guardJourney(8,()=>{state.challengeIndex=0;returnFromReference=null;go('challenge');});
 else if(a==='challenge-audio'){const c=CHALLENGES[state.level][state.challengeIndex];audio.toggle([{text:typeof c.audio==='string'?c.audio:c.audio.text,lang:'en'}],'challenge');}
 else if(a==='challenge-retry'){audio.stop();selection=null;order=[];feedback=null;saveDraft();render();}
 else if(a==='review-task'){state.challengeIndex=CHALLENGES[state.level].findIndex(c=>c.id===b.dataset.id);go('challenge');}
 else if(a==='summary')go('result');
 else if(a==='evidence'){const c=CHALLENGES[state.level][state.challengeIndex];const page=STORY.levels[state.level].pages.findIndex(p=>p.sentences.some(x=>c.evidenceSentenceIds.includes(x.id)));const target=page>=0?page:state.page;const index=STORY.levels[state.level].pages[target].sentences.findIndex(x=>c.evidenceSentenceIds.includes(x.id));navigatePage(target,Math.max(0,index),'challenge');}
 else if(a==='word-original')navigatePage(Number(b.dataset.page),Number(b.dataset.index),'vocabulary');
 else if(a==='reference-return'){const target=returnFromReference;returnFromReference=null;if(target==='challenge')go('challenge');else showVocabulary();}
 else if(a==='challenge-choice'){selection=b.dataset.id;saveDraft();render();}
 else if(a==='challenge-order'){if(!order.includes(b.dataset.id)){order.push(b.dataset.id);saveDraft();render();}}
 else if(a==='order-undo'){order.splice(Number(b.dataset.index),1);saveDraft();render();}
 else if(a==='challenge-check')checkChallenge();
 else if(a==='challenge-next'){if(state.challengeIndex<CHALLENGES[state.level].length-1){state.challengeIndex++;selection=null;order=[];feedback=null;restoreChallenge();save();render();window.scrollTo({top:0,behavior:'instant'});}else{state.completed=state.seen.length===8;go('result');}}
 else if(a==='suggested-reading'){returnFromReference=null;const l=Number(b.dataset.level);if(l!==state.level)setLevel(l);else{state.page=0;state.completed=false;}state.started=true;go('reader');}
 else if(a==='record')readAloud.practice();
 else if(a==='hotspot')readAloud.open(b.dataset.id);
 else if(a.startsWith('speech-'))readAloud.action(a);
 else if(a==='collect-keyword')collectKeyword(b.dataset.id);
 else if(a==='restart-question'){showModal('再玩一次小游戏？','<p class="sheet-intro">会重新玩 5 个小游戏，并重新开始这次阅读。收藏的词语会保留。</p><button class="primary" data-action="restart-confirm">重新开始</button>','restart');}
 else if(a==='restart-confirm'){returnFromReference=null;const words=state.words;readAloud.reset();quizAutoPlayed.clear();quizHeard.clear();state={...fresh(),words};go('quiz');}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();if(e.key==='Tab'&&modal){const buttons=[...overlay.querySelectorAll('button:not([disabled])')];if(!buttons.length)return;const first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){last.focus();e.preventDefault();}else if(!e.shiftKey&&document.activeElement===last){first.focus();e.preventDefault();}}});
setInterval(()=>{const now=Date.now();if(hasEntered&&!document.hidden&&['reader','challenge'].includes(state.step)&&!modal){state.seconds+=Math.min(2,(now-lastTick)/1000);save();}lastTick=now;},1000);
window.addEventListener('storage',e=>{if(e.key===RESET_KEY&&e.newValue!==sessionGeneration)reloadAtCover();});
window.addEventListener('pageshow',e=>{
 if(!e.persisted)return;
 try{if(localStorage.getItem(RESET_KEY)!==sessionGeneration)reloadAtCover();}catch{}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){audio.pause();readAloud.background();save();}lastTick=Date.now();});
window.addEventListener('pagehide',()=>{audio.stop();readAloud.cancel();save();});
if(state.step==='challenge')restoreChallenge();
render();
removeObsoleteProgress();
