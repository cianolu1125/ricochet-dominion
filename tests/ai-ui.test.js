import test from 'node:test';import assert from 'node:assert/strict';import {setup} from './browser-fixture.js';
class WorkerStub {
 static all=[];constructor(){this.messages=[];WorkerStub.all.push(this);}postMessage(d){this.messages.push(d);}terminate(){this.dead=true;}
 reply(decision){const m=this.messages.at(-1);this.onmessage?.({data:{requestId:m.requestId,generation:m.generation,decision}});}
}
function computer(a,d='normal'){a.w.Worker=WorkerStub;a.click('[data-panel="computer"]');a.click(`[data-panel="difficulty-${d}"]`);a.click('[data-panel="start-computer"]');}
test('PvE difficulty setup, fixed phone view, input lock and real launch cue',async()=>{
 const a=await setup();try {
  computer(a,'normal');assert.equal(a.read().mode,'pve');assert.equal(a.read().difficulty,'normal');a.click('#fab');
  assert.equal(a.read().current,2);assert.equal(a.read().viewOwner,1);a.tick(200);a.tick(1600);a.tick(16);
  assert.equal(a.w.document.querySelector('#fab').disabled,true);assert.equal(a.w.document.querySelector('#stack').hidden,true);
  const worker=WorkerStub.all.at(-1);assert.ok(worker.messages.length);
  const before=a.read();a.canvas.dispatchEvent(new a.w.PointerEvent('pointerdown',{button:0,clientX:100,clientY:200}));a.w.document.querySelector('#fab').click();assert.deepEqual(a.read(),before);
  worker.reply({type:'launch',kind:'move',direction:{x:-1,y:1},power:.35});a.tick(16);assert.equal(a.read().phase,'MOVE_AIM');a.tick(300);assert.equal(a.read().phase,'MOVE_FLYING');
 }finally{await a.close();}
});
test('PvE overlay pauses reply; restart ignores old worker; rematch keeps difficulty/length',async()=>{
 const a=await setup();try {
  a.click('[data-panel="round-10"]');computer(a,'hard');const seed=a.read().matchSeed;a.click('#fab');a.tick(200);a.tick(1600);a.tick(16);const old=WorkerStub.all.at(-1);
  a.click('#menu');old.reply({type:'end'});a.tick(1000);assert.equal(a.read().current,2);a.click('[data-panel="close"]');a.tick(16);assert.equal(a.read().current,1);assert.equal(a.read().viewOwner,1);
  a.tick(200);a.tick(1600);a.click('#menu');a.click('[data-panel="restart"]');a.click('[data-panel="start"]');
  assert.equal(a.read().difficulty,'hard');assert.equal(a.read().maxRounds,10);assert.notEqual(a.read().matchSeed,seed);old.reply({type:'build'});a.tick(1000);assert.equal(a.read().current,1);
  a.click('#menu');a.click('[data-panel="main-menu"]');a.click('[data-panel="home"]');a.click('[data-panel="start"]');assert.equal(a.read().mode,'local-pvp');
  a.click('#fab');a.tick(401);assert.equal(a.read().viewOwner,2);
 }finally{await a.close();}
});
test('settings and background resume re-show a complete AI aim cue before real launch',async()=>{
 const a=await setup();try {
  computer(a);a.click('#fab');a.tick(200);a.tick(1600);a.tick(16);WorkerStub.all.at(-1).reply({type:'launch',kind:'missile',direction:{x:0,y:1},power:.6});a.tick(16);assert.equal(a.read().phase,'MISSILE_AIM');
  a.click('#menu');a.tick(1000);a.click('[data-panel="close"]');a.tick(16);assert.equal(a.read().phase,'MISSILE_AIM');
  Object.defineProperty(a.w.document,'hidden',{value:true,configurable:true});a.w.document.dispatchEvent(new a.w.Event('visibilitychange'));
  Object.defineProperty(a.w.document,'hidden',{value:false,configurable:true});a.w.document.dispatchEvent(new a.w.Event('visibilitychange'));a.tick(1000);assert.equal(a.read().phase,'MISSILE_AIM');a.tick(300);assert.equal(a.read().phase,'MISSILE_FLYING');
 }finally{await a.close();}
});
