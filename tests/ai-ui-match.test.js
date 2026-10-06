import test from 'node:test';import assert from 'node:assert/strict';import {Worker} from 'node:worker_threads';import {pathToFileURL} from 'node:url';import {setup} from './browser-fixture.js';
const source=pathToFileURL(process.cwd()+'/src/ai/ai-worker.js').href;
const code=`import {parentPort} from 'node:worker_threads';globalThis.self={postMessage:data=>parentPort.postMessage(data)};await import(${JSON.stringify(source)});parentPort.on('message',data=>self.onmessage({data}));`;
class RealWorkerBridge {
 static all=[];
 constructor(){this.worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(code)),{type:'module'});this.pending=false;RealWorkerBridge.all.push(this);this.worker.on('message',data=>{this.pending=false;this.onmessage?.({data});this.resolve?.();});this.worker.on('error',error=>{this.pending=false;this.onerror?.(error);this.resolve?.();});}
 postMessage(d){this.pending=true;this.done=new Promise(resolve=>{this.resolve=resolve;});this.worker.postMessage(d);}
 terminate(){this.pending=false;this.resolve?.();return this.worker.terminate();}
}
test('full phone PvE uses real isolated search, real flight and presentation through result and rematch',async()=>{
 const a=await setup();try {
  let seedIndex=210; a.w.crypto.getRandomValues=values=>{values[0]=seedIndex++;return values;};
  a.w.Worker=RealWorkerBridge;a.click('[data-panel="round-10"]');a.click('[data-panel="computer"]');a.click('[data-panel="start-computer"]');const seed=a.read().matchSeed;
  let aiFlights=0,lastPhase='',finished=false;
  for(let frame=0;frame<16000;frame++) {
   const worker=RealWorkerBridge.all.at(-1);if(worker?.pending)await worker.done;
   a.tick(40);const s=a.read();assert.equal(s.mode,'pve');assert.equal(s.viewOwner,1);
   if(s.current===2&&!s.winner){assert.equal(a.w.document.querySelector('#fab').disabled,true);assert.equal(a.w.document.querySelector('#stack').hidden,true);}
   if(s.phase.includes('FLYING')&&s.phase!==lastPhase)aiFlights++;lastPhase=s.phase;
   if(s.winner&&!a.w.document.querySelector('#overlay').hidden){finished=true;break;}
   if(s.current===1&&!a.w.document.querySelector('#fab').disabled)a.click('#fab');
  }
  assert.ok(finished,'full real UI match must finish');assert.ok(aiFlights>0);assert.match(a.w.document.querySelector('#panel').textContent,/对局结束/);
  a.click('[data-panel="start"]');assert.equal(a.read().mode,'pve');assert.equal(a.read().difficulty,'normal');assert.equal(a.read().maxRounds,10);assert.notEqual(a.read().matchSeed,seed);assert.equal(a.read().current,1);
 }finally{await Promise.all(RealWorkerBridge.all.map(w=>w.terminate()));await a.close();}
});
