import test from 'node:test';import assert from 'node:assert/strict';import {Worker} from 'node:worker_threads';import {pathToFileURL} from 'node:url';import * as E from '../src/engine.js';
test('actual isolated Worker returns only a reproducible decision and leaves live match intact',async()=>{
 const source=pathToFileURL(process.cwd()+'/src/ai/ai-worker.js').href;
 const wrapper=`import {parentPort} from 'node:worker_threads';globalThis.self={postMessage:data=>parentPort.postMessage(data)};await import(${JSON.stringify(source)});parentPort.on('message',data=>self.onmessage({data}));`;
 const w=new Worker(new URL('data:text/javascript,'+encodeURIComponent(wrapper)),{type:'module'});const s=E.createGame(10,'desktop'),before=structuredClone(s);
 try {
  const reply=await new Promise((resolve,reject)=>{w.once('message',resolve);w.once('error',reject);w.postMessage({requestId:19,generation:8,state:s,session:{difficulty:'normal',matchSeed:6,decisionIndex:0}});});
  assert.equal(reply.requestId,19);assert.equal(reply.generation,8);assert.ok(reply.decision);assert.ok(!('state' in reply));assert.ok(!('cells' in reply));assert.deepEqual(s,before);assert.ok(reply.stats.nodes<=1250);
 }finally{await w.terminate();}
});
