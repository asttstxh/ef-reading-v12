import {ASR_ASSETS} from './asr-assets.js?v=20261102-11';

const nativeFetch=globalThis.fetch.bind(globalThis);
const assetRoot=new URL('./assets/',self.location).href;
const packetRoot=new URL('speech-parts/',assetRoot);
const cacheName='ef-reading-hen-asr-v11';
const diskCache=Promise.resolve().then(()=>self.caches?.open(cacheName)).catch(()=>null);
const complete=new Set(),received=new Map(),progressQueue=[];
let activeDownloads=0,lastReport=0,enginePromise=null,busy=false,totalBytes=0;
function report(id,bytes){
 received.set(id,Math.max(bytes,received.get(id)||0));
 if(Date.now()-lastReport<150)return;
 lastReport=Date.now();
 self.postMessage({type:'progress',stage:'download',totalBytes,bytes:[...received.values()].reduce((a,b)=>a+b,0)});
}
async function limited(work){
 if(activeDownloads>=4)await new Promise(resolve=>progressQueue.push(resolve));
 else activeDownloads++;
 try{return await work();}finally{if(progressQueue.length)progressQueue.shift()();else activeDownloads--;}
}
async function fetchBytes(url,size,id,retry=false){
 const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),18000);
 try{
  const response=await nativeFetch(url,{signal:abort.signal,cache:retry?'reload':'force-cache'});
  if(!response.ok)throw Error('下载失败');
  const bytes=new Uint8Array(size),reader=response.body?.getReader();
  if(!reader){const data=new Uint8Array(await response.arrayBuffer());if(data.length!==size)throw Error('资源不完整');report(id,size);return data;}
  let offset=0;
  for(;;){const {done,value}=await reader.read();if(done)break;if(offset+value.length>size){await reader.cancel();throw Error('资源大小异常');}bytes.set(value,offset);offset+=value.length;report(id,offset);}
  if(offset!==size)throw Error('资源不完整');return bytes;
 }finally{clearTimeout(timer);}
}
async function partBytes(part){
 const url=new URL(part.file,packetRoot).href,cache=await diskCache;
 for(let attempt=0;attempt<2;attempt++){
  try{
   const cached=!attempt&&await cache?.match(url).catch(()=>null);
   const compressed=cached?new Uint8Array(await cached.arrayBuffer()):await fetchBytes(url,part.size,part.file,!!attempt);
   if(compressed.length!==part.size)throw Error('识别资源不完整');
   const raw=new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
   if(raw.length!==part.raw)throw Error('识别资源不完整');
   if(!cached&&cache)await cache.put(url,new Response(compressed)).catch(()=>{});
   report(part.file,part.size);return raw;
  }catch(e){if(attempt)throw Error('识别资源未能下载，请再试一次。');}
 }
}
async function packedResponse(path,spec){
 const url=assetRoot+path,whole=new Uint8Array(spec.bytes);
 if(path.endsWith('.wasm')){
  const needed=Object.entries(ASR_ASSETS).filter(([key])=>!key.endsWith('.wasm')||key===path);
  totalBytes=needed.reduce((sum,[,asset])=>sum+(typeof DecompressionStream==='function'?asset.parts.reduce((n,p)=>n+p.size,0):asset.bytes),0);
 }
 if(typeof DecompressionStream==='function'){
  let offset=0;
  await Promise.all(spec.parts.map(part=>{
   const start=offset;offset+=part.raw;
   return limited(async()=>whole.set(await partBytes(part),start));
  }));
 }else if(path.endsWith('decoder_model_merged_quantized.onnx')){
  const first=16777216;
  await Promise.all([0,1].map(i=>limited(async()=>whole.set(await fetchBytes(url+'.part'+i,i?spec.bytes-first:first,path+i),i?first:0))));
 }else whole.set(await limited(()=>fetchBytes(url,spec.bytes,path)));
 complete.add(path);
 if([...complete].some(k=>k.endsWith('.wasm'))&&[...complete].filter(k=>k.endsWith('.onnx')).length===2){
  self.postMessage({type:'progress',stage:'initializing'});
 }
 return new Response(whole,{status:200,headers:{'Content-Length':String(spec.bytes),'Content-Type':path.endsWith('.wasm')?'application/wasm':path.endsWith('.json')?'application/json':'application/octet-stream'}});
}
globalThis.fetch=(input,options)=>{
 const raw=typeof input==='string'?input:input instanceof URL?input.href:input.url;
 const url=new URL(raw,self.location.href).href.split('?')[0];
 const path=url.startsWith(assetRoot)?url.slice(assetRoot.length):'';
 return ASR_ASSETS[path]?packedResponse(path,ASR_ASSETS[path]):nativeFetch(input,options);
};
async function prepare(){
 if(!enginePromise)enginePromise=(async()=>{
  const {pipeline,env}=await import('./assets/vendor/transformers.min.js');
  env.allowRemoteModels=false;env.allowLocalModels=true;env.useBrowserCache=false;
  env.localModelPath=new URL('models/',assetRoot).href;
  env.backends.onnx.wasm.numThreads=1;env.backends.onnx.wasm.proxy=false;
  env.backends.onnx.wasm.wasmPaths=new URL('vendor/',assetRoot).href;
  const engine=await pipeline('automatic-speech-recognition','whisper-tiny.en',{quantized:true});
  self.postMessage({type:'ready'});return engine;
 })().catch(error=>{enginePromise=null;throw error});
 return enginePromise;
}
self.onmessage=async({data})=>{
 if(data.type==='prepare'){
  try{await prepare();}catch(e){self.postMessage({type:'error',error:String(e.message||e)});}
  return;
 }
 if(data.type!=='transcribe')return;
 if(busy){self.postMessage({type:'error',id:data.id,error:'上一段朗读仍在处理中'});return;}
 busy=true;
 try{
  const engine=await prepare();
  const output=await engine(data.audio,{return_timestamps:false,chunk_length_s:30,stride_length_s:0,max_new_tokens:72,do_sample:false});
  self.postMessage({type:'result',id:data.id,text:output.text||''});
 }catch(e){self.postMessage({type:'error',id:data.id,error:String(e.message||e)});}
 finally{busy=false;}
};
