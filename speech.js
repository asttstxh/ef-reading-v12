const speechExpansions = {
  "i'm": ['i','am'], "you're": ['you','are'], "we're": ['we','are'], "they're": ['they','are'],
  "i've": ['i','have'], "you've": ['you','have'], "we've": ['we','have'], "they've": ['they','have'],
  "i'll": ['i','will'], "you'll": ['you','will'], "he'll": ['he','will'], "she'll": ['she','will'],
  "we'll": ['we','will'], "they'll": ['they','will'], "it'll": ['it','will'],
  "can't": ['can','not'], cannot: ['can','not'], "won't": ['will','not'], "shan't": ['shall','not'],
  "don't": ['do','not'], "doesn't": ['does','not'], "didn't": ['did','not'],
  "isn't": ['is','not'], "aren't": ['are','not'], "wasn't": ['was','not'], "weren't": ['were','not'],
  "haven't": ['have','not'], "hasn't": ['has','not'], "hadn't": ['had','not'],
  "couldn't": ['could','not'], "shouldn't": ['should','not'], "wouldn't": ['would','not'], "mustn't": ['must','not']
};
function speechWords(text) {
  // Curly apostrophes retain their offsets in the displayed original sentence.
  return [...String(text).replace(/[’‘]/g,"'").matchAll(/[A-Za-z0-9]+(?:'[A-Za-z0-9]+)*/g)]
    .map(m=>({text:String(text).slice(m.index,m.index+m[0].length),start:m.index,end:m.index+m[0].length,
      parts:speechExpansions[m[0].toLowerCase()]||[m[0].toLowerCase()]}));
}
export function matchWords(target, transcript) {
  const words=speechWords(target), actual=speechWords(transcript).flatMap(w=>w.parts).slice(0,1000);
  const n=words.length,m=actual.length, dp=Array.from({length:n+1},()=>new Uint16Array(m+1));
  const same=(i,j)=>words[i].parts.every((v,k)=>actual[j+k]===v);
  for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--){
    dp[i][j]=Math.max(dp[i+1][j],dp[i][j+1]);
    if(same(i,j))dp[i][j]=Math.max(dp[i][j],1+dp[i+1][j+words[i].parts.length]);
  }
  let i=0,j=0;const marked=words.map(w=>({...w,matched:false}));
  while(i<n&&j<m){
    if(same(i,j)&&dp[i][j]===1+dp[i+1][j+words[i].parts.length]){marked[i].matched=true;j+=words[i].parts.length;i++;}
    else if(dp[i][j+1]===dp[i][j])j++;else i++;
  }
  const matched=marked.filter(w=>w.matched).length;
  return {ruleVersion:'target-ordered-words-v1',words:marked,total:n,matched,ratio:n?matched/n:0,
    passed:n>0&&matched*2>=n,transcript:String(transcript)};
}

// Capture and replay do not depend on the recognition model.
function speechSamples(frames,sampleRate){
 const count=frames.reduce((sum,frame)=>sum+frame.length,0);
 const original=new Float32Array(count);let offset=0;
 for(const frame of frames){original.set(frame,offset);offset+=frame.length;}
 const ratio=sampleRate/16000,result=new Float32Array(Math.floor(count/ratio));
 for(let i=0;i<result.length;i++){
  const from=i*ratio,to=Math.min(count,(i+1)*ratio);let sum=0;
  for(let j=Math.floor(from);j<to;j++)sum+=original[j]*(Math.min(j+1,to)-Math.max(j,from));
  result[i]=sum/(to-from);
 }
 return result;
}
function wavBlob(samples){
 const data=new ArrayBuffer(44+samples.length*2),view=new DataView(data);
 const label=(offset,s)=>{for(let i=0;i<s.length;i++)view.setUint8(offset+i,s.charCodeAt(i));};
 label(0,'RIFF');view.setUint32(4,data.byteLength-8,true);label(8,'WAVE');label(12,'fmt ');
 view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);
 view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);label(36,'data');view.setUint32(40,samples.length*2,true);
 for(let i=0;i<samples.length;i++){const v=Math.max(-1,Math.min(1,samples[i]));view.setInt16(44+i*2,v<0?v*32768:v*32767,true);}
 return new Blob([data],{type:'audio/wav'});
}
export class LocalSpeech{
 constructor(onState){
  this.onState=onState;this.worker=null;this.ready=false;this.active=null;this.serial=0;
  this.preparing=null;this.job=null;this.stage='download';this.bytes=0;this.totalBytes=0;
 }
 modelLabel(){
  if(this.stage==='initializing')return '资源已备好，正在启动识别…';
  return this.bytes?'已加载 '+(this.bytes/1e6).toFixed(1)+(this.totalBytes?' / '+(this.totalBytes/1e6).toFixed(1):'')+' MB，正在准备识别…':'第一次识别，正在准备语音资源…';
 }
 resetWorker(error=new Error('识别已取消')){
  const prep=this.preparing,job=this.job;
  this.preparing=this.job=null;this.ready=false;this.worker?.terminate();this.worker=null;
  if(prep){clearTimeout(prep.idle);clearTimeout(prep.limit);prep.reject(error);}
  if(job){clearTimeout(job.timer);job.reject(error);}
 }
 prepare(){
  if(this.ready)return Promise.resolve();
  if(this.preparing)return this.preparing.promise;
  this.stage='download';this.bytes=0;this.totalBytes=0;
  let ok,fail;
  const promise=new Promise((resolve,reject)=>{ok=resolve;fail=reject;});
  const prep={promise,resolve:ok,reject:fail};this.preparing=prep;
  const timeout=()=>this.resetWorker(new Error('语音资源加载超时。录音已保留，可以重试识别。'));
  const active=()=>{clearTimeout(prep.idle);prep.idle=setTimeout(timeout,35000);};
  active();prep.limit=setTimeout(timeout,180000);
  try{
   const worker=new Worker(new URL('./asr-worker.js?v=20261102-11',import.meta.url),{type:'module'});this.worker=worker;
   worker.onmessage=({data})=>{
    if(this.worker!==worker)return;
    if(data.type==='progress'&&this.preparing===prep){
     active();this.stage=data.stage;this.totalBytes=data.totalBytes||this.totalBytes;this.bytes=Math.max(this.bytes,data.bytes||0);
     this.onState?.({type:'model',label:this.modelLabel()});return;
    }
    if(data.type==='ready'){
     this.ready=true;clearTimeout(prep.idle);clearTimeout(prep.limit);this.preparing=null;prep.resolve();return;
    }
    const job=this.job;
    if(job&&job.id===data.id&&(data.type==='error'||data.type==='result')){
     this.job=null;clearTimeout(job.timer);
     if(data.type==='result')job.resolve(data.text);else{job.reject(new Error(data.error));this.resetWorker();}
    }else if(data.type==='error')this.resetWorker(new Error(data.error||'识别暂时无法启动。'));
   };
   worker.onerror=()=>{if(this.worker===worker)this.resetWorker(new Error('识别暂时无法启动。录音已保留，可以重试。'));};
   worker.postMessage({type:'prepare'});
  }catch{this.resetWorker(new Error('当前浏览器无法启动语音识别。可回听录音或跳过。'));}
  return promise;
 }
 async start(onUpdate){
  this.cancel();
  const s={id:++this.serial,onUpdate,frames:[],stream:null,ctx:null,finishing:false,recognizing:false};this.active=s;
  try{
   const Ctx=window.AudioContext||window.webkitAudioContext;
   if(!navigator.mediaDevices?.getUserMedia||!Ctx)throw Error('当前浏览器无法录音。可更换浏览器，或跳过本次朗读。');
   // Both calls happen in the original tap, including on iOS.
   s.ctx=new Ctx();
   const resumed=s.ctx.resume().then(()=>null,e=>e);
   const microphone=navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
   onUpdate({phase:'permission'});
   s.permissionTimer=setTimeout(()=>{if(this.active===s)this.captureError(s,Error('还没有收到麦克风授权。请检查权限后重试。'));},25000);
   const stream=await microphone;
   if(this.active!==s){stream.getTracks().forEach(t=>t.stop());return;}
   s.stream=stream;const resumeError=await resumed;if(this.active!==s)return;if(resumeError)throw resumeError;
   if(s.ctx.state==='suspended')await s.ctx.resume();if(this.active!==s)return;
   clearTimeout(s.permissionTimer);
   s.sampleRate=s.ctx.sampleRate;s.source=s.ctx.createMediaStreamSource(stream);
   s.processor=s.ctx.createScriptProcessor(2048,1,1);s.gain=s.ctx.createGain();s.gain.gain.value=0;
   s.processor.onaudioprocess=e=>{if(this.active===s&&!s.finishing)s.frames.push(new Float32Array(e.inputBuffer.getChannelData(0)));};
   s.source.connect(s.processor);s.processor.connect(s.gain);s.gain.connect(s.ctx.destination);
   s.started=Date.now();onUpdate({phase:'recording',seconds:0});
   s.interval=setInterval(()=>{if(this.active===s)onUpdate({phase:'recording',seconds:Math.floor((Date.now()-s.started)/1000)});},1000);
   s.limit=setTimeout(()=>{if(this.active===s)this.finish();},30000);
   this.prepare().catch(()=>{}); // Recognition may warm up while the child is speaking.
  }catch(e){if(this.active===s)this.captureError(s,e);}
 }
 releaseCapture(s){
  clearTimeout(s.permissionTimer);clearTimeout(s.limit);clearInterval(s.interval);
  if(s.processor)s.processor.onaudioprocess=null;
  s.stream?.getTracks().forEach(t=>t.stop());
  s.source?.disconnect();s.processor?.disconnect();s.gain?.disconnect();
  if(s.ctx&&s.ctx.state!=='closed')s.ctx.close().catch(()=>{});
  s.stream=s.source=s.processor=s.gain=s.ctx=null;
 }
 captureError(s,error){
  if(this.active!==s)return;
  let message=error?.message||'录音没有成功，请重试。';
  if(error.name==='NotAllowedError')message='麦克风权限未开启。请允许使用麦克风后重试，也可跳过本次朗读。';
  if(error.name==='NotFoundError')message='没有找到麦克风。连接麦克风后可重试。';
  this.cancel();s.onUpdate({phase:'error',message});
 }
 async finish(){
  const s=this.active;if(!s?.started||s.finishing)return;s.finishing=true;this.releaseCapture(s);
  try{
   s.samples=speechSamples(s.frames,s.sampleRate);s.frames=[];
   if(!s.samples.length)throw Error('没有录到声音，请靠近麦克风再试一次。');
   s.replayURL=URL.createObjectURL(wavBlob(s.samples));let energy=0,peak=0;
   for(const v of s.samples){energy+=v*v;peak=Math.max(peak,Math.abs(v));}
   if(Math.sqrt(energy/s.samples.length)<.0017||peak<.006){
    s.onUpdate({phase:'result',text:'',replayURL:s.replayURL});return;
   }
   await this.recognize();
  }catch(e){if(this.active===s)this.captureError(s,e);}
 }
 async recognize(){
  const s=this.active;if(!s?.samples||s.recognizing)return;s.recognizing=true;
  try{
   if(!this.ready){s.onUpdate({phase:'loading-model',replayURL:s.replayURL});await this.prepare();}
   if(this.active!==s)return;
   s.onUpdate({phase:'transcribing',replayURL:s.replayURL});
   const data=s.samples.slice(),id='asr-'+s.id;
   const text=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>this.resetWorker(new Error('这次识别用时较长。录音已保留，可以重试或跳过。')),50000);
    this.job={id,resolve,reject,timer};
    try{this.worker.postMessage({type:'transcribe',id,audio:data},[data.buffer]);}catch(error){this.resetWorker(error);}
   });
   if(this.active===s)s.onUpdate({phase:'result',text,replayURL:s.replayURL});
  }catch(e){if(this.active===s)s.onUpdate({phase:'recognition-error',message:e.message||'这次没有识别成功，可以重试。',replayURL:s.replayURL});}
  finally{s.recognizing=false;}
 }
 cancel(){
  const s=this.active;this.active=null;if(!s)return;
  this.releaseCapture(s);s.frames=[];s.samples=null;
  if(this.job||this.preparing)this.resetWorker();
  if(s.replayURL)URL.revokeObjectURL(s.replayURL);
 }
}
