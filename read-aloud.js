import {LocalSpeech,matchWords} from './speech.js?v=20261102-11';
import {pageHotspots} from './reader-content.js?v=20261102-11';

// Only interaction status is saved with the book. Audio and transcripts stay in memory.
export class ReadAloud {
 constructor(options){this.o=options;this.progress=new Map();this.dialog=null;this.next=null;this.playback=null;this.serial=0;this.speech=new LocalSpeech(s=>{if(s.type==='model'&&this.dialog?.phase==='loading-model'){const el=document.querySelector('.speech-clock');if(el)el.textContent=s.label;}});}
 state(h){if(!this.progress.has(h.id))this.progress.set(h.id,{status:this.o.getState().hotspots?.[h.id]||'pending',attempted:false});return this.progress.get(h.id);}
 done(h){return ['viewed','passed','skipped'].includes(this.state(h).status);}
 mark(h,status){
  this.state(h).status=status;
  const record=this.o.getState();(record.hotspots||={})[h.id]=status;this.o.save();
 }
 remind(h){
  this.o.toast('在画面中找找看，是不是漏掉了什么');
  const button=document.querySelector('.picture-hotspot[data-id="'+h.id+'"]');
  if(!button)return;
  button.classList.add('reminded');button.focus({preventScroll:true});
  const b=button.getBoundingClientRect(),stop=document.querySelector('.reader-footer')?.getBoundingClientRect().top||innerHeight;
  if(b.bottom>stop-6||b.top<10){
   const top=Math.max(0,window.scrollY+b.top-stop/2);
   window.scrollTo({top,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
 }
 hotspotMarkup(h){const status=this.state(h).status,read=h.kind==='read';return '<button class="picture-hotspot '+h.kind+' '+status+'" data-action="hotspot" data-id="'+h.id+'" style="--hx:'+h.x+'%;--hy:'+h.y+'%" aria-label="'+this.o.esc(h.object)+'：'+this.o.esc(h.prompt)+(status==='passed'?'，已读过':status==='skipped'?'，已跳过':'')+'">'+this.o.icon(read?'mic':'leaf',19)+'<span>'+(read?(status==='passed'?'读过啦':status==='skipped'?'已跳过':'读一读'):'找线索')+'</span></button>';}
 open(id){const s=this.o.getState(),h=pageHotspots(s.level,s.page).find(x=>x.id===id);if(!h)return;if(h.kind==='read'){this.show(h);return;}this.mark(h,'viewed');const sentence=this.o.currentPage().sentences[h.sentence],e=this.o.esc;this.o.showModal(h.prompt,'<div class="clue-sentence"><p lang="en">'+e(sentence.en)+'</p><p>'+e(sentence.zh)+'</p><div class="meaning-audio"><button class="text-button" data-action="word-audio" data-word="'+e(sentence.en)+'">'+this.o.icon('sound',17)+' 听英文</button><button class="text-button" data-action="word-audio" data-lang="zh" data-word="'+e(sentence.zh)+'">'+this.o.icon('sound',17)+' 听中文</button></div></div><button class="primary" data-action="close-modal">发现啦，继续读</button>','clue');this.o.render();}
 practice(){const s=this.o.getState(),h=pageHotspots(s.level,s.page).find(x=>x.kind==='read')||{id:'practice-L'+s.level+'-p'+s.page,kind:'read',sentence:0,prompt:'用你的声音读一读'};this.show(h);}
 show(h,next=null){
  const sentence=this.o.currentPage().sentences[h.sentence];if(!sentence)return;
  this.o.showModal(h.prompt,'<div class="speech-content"></div>','speech');
  this.next=next;this.dialog={h,sentence,phase:'idle',match:null,replayURL:null,translation:false,message:'',seconds:0};this.serial++;this.update();
 }
 markedSentence(){const d=this.dialog,e=this.o.esc;if(!d.match)return e(d.sentence.en);let out='',cursor=0;for(const w of d.match.words){out+=e(d.sentence.en.slice(cursor,w.start))+'<mark class="'+(w.matched?'matched':'missing')+'">'+e(w.text)+'</mark>';cursor=w.end;}return out+e(d.sentence.en.slice(cursor));}
 update(){
  const d=this.dialog,container=document.querySelector('.speech-content');if(!d||!container||this.o.modalKind()!=='speech')return;
  const e=this.o.esc,icon=this.o.icon,progress=this.state(d.h),phase=d.phase;
  const running=['permission','recording','loading-model','transcribing'].includes(phase),done=['passed','skipped'].includes(progress.status);
  let label='准备好了，就点麦克风',clock='读完后，我们一起看看读到了哪些词。';
  if(phase==='loading-model'){label='录好了，可以先听听自己的声音';clock=this.speech.modelLabel();}
  if(phase==='permission'){label='请允许使用麦克风';clock='允许后，就可以开始读啦。';}
  if(phase==='recording'){label='正在听你读，读完点一下';clock='00:'+String(d.seconds).padStart(2,'0')+' / 00:30';}
  if(phase==='transcribing'){label='正在听你的朗读';clock='马上一起看看读到了哪些词。';}
  if(phase==='result'){label=d.match.passed?'这句读出来啦！':'再试一次，也没关系';clock=d.match.transcript?'读到了 '+d.match.matched+' / '+d.match.total+' 个词':'这次还没有听清，靠近麦克风再试试。';}
  if(phase==='error'){label='这次没有录好';clock=d.message;}
  if(phase==='recognition-error'){label='录音已保留';clock=d.message;}
  if(phase==='cancelled'){label='录音已停下';clock='准备好后可以重新开始。';}
  const recordDisabled=['permission','loading-model','transcribing'].includes(phase);
  const target='<p class="speech-target" lang="en">'+this.markedSentence()+'</p>';
  const helpers='<div class="speech-helpers"><button class="text-button" data-action="speech-demo" '+(running?'disabled':'')+'>'+icon('sound',17)+' 听一遍</button><button class="text-button" data-action="speech-translation" '+(running?'disabled':'')+'>中 '+(d.translation?'收起中文':'看中文')+'</button></div>';
  const translation=d.translation?'<div class="speech-translation"><p>'+e(d.sentence.zh)+'</p><button class="text-button" data-action="speech-chinese" '+(running?'disabled':'')+'>'+icon('sound',17)+' 听中文</button></div>':'';
  const result=phase==='result'?'<div class="speech-result" role="status"><p class="match-legend"><span>绿色：读到了</span><span>橙色：再读读</span></p><p>听到你读：<q lang="en">'+e(d.match.transcript||'还没有听清')+'</q></p></div>':'';
  container.innerHTML=target+helpers+translation+result+'<div class="record-center"><button class="record-button '+(phase==='recording'?'is-recording':'')+'" data-action="speech-record" aria-label="'+(phase==='recording'?'结束录音并识别':phase==='result'||['error','recognition-error'].includes(phase)?'重新录音':'开始录音')+'" '+(recordDisabled?'disabled':'')+'>'+(phase==='recording'?'<span class="stop-square"></span>':icon(phase==='result'?'replay':'mic',30))+'</button><strong class="record-label" aria-live="polite">'+label+'</strong><span class="speech-clock record-time">'+e(clock)+'</span></div><div class="record-actions">'+(d.replayURL?'<button class="secondary" data-action="speech-replay">'+icon('play',17)+' 听我读</button>':'')+(phase==='recognition-error'&&d.replayURL?'<button class="secondary" data-action="speech-retry-match">重试识别</button>':'')+(done?'<button class="primary" data-action="speech-continue">继续故事 '+icon('arrow',17)+'</button>':'')+'</div>'+(!done&&progress.attempted&&(!running||phase==='loading-model'||phase==='transcribing')?'<button class="text-button record-skip" data-action="speech-skip">这次先跳过</button>':'')+'<p class="speech-privacy">录音只在这台设备上识别，关闭后就会清除。</p>';
 }
 async record(){
  const d=this.dialog;if(!d)return;
  if(d.phase==='recording'){this.speech.finish();return;}
  if(['permission','loading-model','transcribing'].includes(d.phase))return;
  this.o.audio.stop();this.playback?.pause();d.match=null;d.replayURL=null;const token=++this.serial;
  await this.speech.start(update=>{
   if(this.serial!==token||this.dialog!==d||this.o.modalKind()!=='speech')return;
   const prior=d.phase;d.phase=update.phase;d.seconds=update.seconds||0;
   if(update.replayURL)d.replayURL=update.replayURL;
   if(['loading-model','transcribing','error','recognition-error'].includes(update.phase))this.state(d.h).attempted=true;
   if(update.phase==='result'){
    d.match=matchWords(d.sentence.en,update.text);d.replayURL=update.replayURL;this.state(d.h).attempted=true;
    if(d.match.passed)this.mark(d.h,'passed');
    const s=this.o.getState();s.recordings++;this.o.save();this.o.render();
   }
   if(update.phase==='error'||update.phase==='recognition-error')d.message=update.message;
   if(prior==='recording'&&update.phase==='recording'){const el=document.querySelector('.speech-clock');if(el)el.textContent='00:'+String(d.seconds).padStart(2,'0')+' / 00:30';}
   else this.update();
  });
 }
 action(action){
  const d=this.dialog;if(!d)return;
  if(action==='speech-record'){this.record();return;}
  if(action==='speech-retry-match'&&d.phase==='recognition-error'){this.speech.recognize();return;}
  if(action==='speech-translation'){d.translation=!d.translation;this.update();return;}
  if(action==='speech-demo'){this.playback?.pause();this.o.audio.play([{text:d.sentence.en,lang:'en'}],'speech-demo');return;}
  if(action==='speech-chinese'){this.playback?.pause();this.o.audio.play([{text:d.sentence.zh,lang:'zh'}],'speech-translation');return;}
  if(action==='speech-replay'&&d.replayURL){this.o.audio.stop();this.playback?.pause();this.playback=new Audio(d.replayURL);this.playback.play().catch(()=>this.o.toast('这段声音暂时无法播放，可以重新录一次。'));return;}
  if(action==='speech-skip'&&this.state(d.h).attempted){if(this.state(d.h).status!=='passed')this.mark(d.h,'skipped');this.proceed();return;}
  if(action==='speech-continue'&&['passed','skipped'].includes(this.state(d.h).status))this.proceed();
 }
 proceed(){const next=this.next;this.o.closeModal();this.o.render();if(next)next();}
 background(){if(!this.dialog)return;const d=this.dialog;this.serial++;this.speech.cancel();this.playback?.pause();d.replayURL=null;if(['permission','recording','loading-model','transcribing','recognition-error'].includes(d.phase)){d.phase='cancelled';}this.update();}
 cancel(){this.serial++;this.playback?.pause();this.playback=null;this.speech.cancel();this.dialog=null;this.next=null;}
 reset(){this.cancel();this.progress.clear();this.o.getState().hotspots={};}
}
