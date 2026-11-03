import {AUDIO_MAP} from './audio-map.js?v=20261030-9';
import {PAGE_AUDIO_PACKS} from './audio-packs.js';

// Keep the original Microsoft MP3 bytes. A warm page needs no additional media requests.
const packs=new Map();
const pending=new Map();
const packURL=path=>new URL(path,import.meta.url).href;
async function warm(key){
 const spec=PAGE_AUDIO_PACKS[key];
 if(!spec||packs.has(key))return;
 if(pending.has(key))return pending.get(key);
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),18000);
 const work=(async()=>{
  const response=await fetch(packURL(spec.url),{cache:'force-cache',signal:controller.signal});
  if(!response.ok)throw Error('audio pack unavailable');
  const buffer=await response.arrayBuffer();
  const expected=Math.max(...Object.values(spec.clips).map(([offset,length])=>offset+length));
  if(buffer.byteLength!==expected)throw Error('incomplete audio pack');
  packs.set(key,{spec,buffer});
  if(packs.size>5)packs.delete(packs.keys().next().value);
 })().catch(()=>{}).finally(()=>{clearTimeout(timeout);pending.delete(key);});
 pending.set(key,work);
 return work;
}
const looseClips=new Map(),clipQueue=[],queuedClips=new Set();
let fetchingClips=0;
function fillClipCache(){
 while(fetchingClips<2&&clipQueue.length){
  const path=clipQueue.shift();fetchingClips++;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  fetch(packURL(path),{cache:'force-cache',signal:controller.signal}).then(async response=>{
   if(!response.ok||response.headers.get('content-type')?.includes('text/html'))return;
   const bytes=await response.arrayBuffer();if(!bytes.byteLength)return;
   looseClips.set(path,new Blob([bytes],{type:'audio/mpeg'}));
   if(looseClips.size>24)looseClips.delete(looseClips.keys().next().value);
  }).catch(()=>{}).finally(()=>{clearTimeout(timer);queuedClips.delete(path);fetchingClips--;fillClipCache();});
 }
}
function clipBlob(path){
 for(const {spec,buffer} of packs.values()){
  const range=spec.clips[path];
  if(range)return new Blob([new Uint8Array(buffer,range[0],range[1])],{type:'audio/mpeg'});
 }
 return looseClips.get(path)||null;
}
export class StoryAudio{
 constructor(onChange){
  this.audio=new Audio();this.audio.preload='auto';this.audio.id='voice-player';this.audio.hidden=true;document.body.append(this.audio);
  this.onChange=onChange;this.queue=[];this.index=0;this.status='idle';this.context='';this.generation=0;this.rate=1;
  this.activeURL='';this.objectURL=null;this.timer=null;this.retried=false;this.blocked=false;this.warmKey='';
  this.audio.addEventListener('playing',()=>{if(this.current()&&!this.audio.paused){clearTimeout(this.timer);this.status='playing';this.blocked=false;this.emit();}});
  this.audio.addEventListener('waiting',()=>{if(this.current()&&!this.audio.paused&&this.status!=='paused'){this.status='loading';this.watch();this.emit();}});
  this.audio.addEventListener('ended',()=>{if(this.current()&&this.audio.ended){this.index++;this.next();}});
  this.audio.addEventListener('error',()=>{if(this.current()&&this.audio.error)this.failed();});
 }
 primeClips(items){
  for(const item of items){
   const path=AUDIO_MAP[(item.lang||'en')+'|'+item.text];
   if(!path||queuedClips.has(path)||looseClips.has(path)||[...packs.values()].some(p=>p.spec.clips[path]))continue;
   queuedClips.add(path);clipQueue.push(path);
  }
  fillClipCache();
 }
 primePage(level,page){
  const key=level+':'+page;if(this.warmKey===key&&(packs.has(key)||pending.has(key)))return;this.warmKey=key;
  warm(key).then(()=>{if(this.warmKey===key&&page<7&&!navigator.connection?.saveData)warm(level+':'+(page+1));});
 }
 current(){return !!this.activeURL&&this.audio.currentSrc===this.activeURL&&this.queue.length>0;}
 emit(){this.onChange?.({status:this.status,context:this.context,item:this.queue[this.index],index:this.index,blocked:this.blocked});}
 watch(){clearTimeout(this.timer);const token=this.generation;this.timer=setTimeout(()=>{if(token===this.generation&&this.status==='loading')this.failed();},10000);}
 release(){clearTimeout(this.timer);if(this.objectURL)URL.revokeObjectURL(this.objectURL);this.objectURL=null;}
 play(items,context='single',rate=1){this.stop();this.queue=items;this.context=context;this.rate=rate;this.next();if(context==='quiz')this.primeClips(items.slice(1));}
 next(){
  this.release();this.retried=false;this.blocked=false;
  if(this.index>=this.queue.length){this.activeURL='';this.status='idle';this.context='';this.emit();return;}
  this.path=AUDIO_MAP[(this.queue[this.index].lang||'en')+'|'+this.queue[this.index].text];
  if(!this.path){this.activeURL='';this.status='unavailable';this.emit();return;}
  const blob=clipBlob(this.path);
  if(blob)this.objectURL=URL.createObjectURL(blob);
  this.load(this.objectURL||packURL(this.path));
 }
 load(url){
  this.activeURL=url;this.audio.src=url;this.audio.playbackRate=this.rate;
  this.start();
 }
 start(){
  const token=++this.generation;this.blocked=false;this.status='loading';this.emit();this.watch();
  // Keep play() inside the initiating gesture for mobile browsers.
  this.audio.play().catch(error=>{
   if(token!==this.generation||this.status==='paused')return;
   if(error.name==='NotAllowedError'){clearTimeout(this.timer);this.blocked=true;this.status='paused';this.emit();return;}
   this.failed();
  });
 }
 failed(){
  if(!this.queue.length||this.status==='idle'||this.status==='unavailable'||this.status==='paused')return;
  clearTimeout(this.timer);
  if(!this.retried){
   this.retried=true;const fallback=this.objectURL?null:clipBlob(this.path);this.release();
   if(fallback)this.objectURL=URL.createObjectURL(fallback);
   this.load(this.objectURL||packURL(this.path));return;
  }
  this.generation++;this.audio.pause();this.status='unavailable';this.emit();
 }
 pause(){if(['idle','unavailable'].includes(this.status))return;this.generation++;clearTimeout(this.timer);this.blocked=false;this.audio.pause();this.status='paused';this.emit();}
 resume(){if(this.queue.length&&this.activeURL)this.start();}
 stop(){this.generation++;this.activeURL='';this.audio.pause();this.audio.removeAttribute('src');this.release();this.blocked=false;this.queue=[];this.index=0;this.context='';this.status='idle';this.emit();}
 toggle(items,context,rate=1){if(this.context===context&&!['idle','unavailable'].includes(this.status)){this.status==='paused'?this.resume():this.pause();}else this.play(items,context,rate);}
}
