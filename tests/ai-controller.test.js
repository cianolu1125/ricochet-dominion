import test from 'node:test';import assert from 'node:assert/strict';import * as E from '../src/engine.js';
import {AIController} from '../src/ai/ai-controller.js';
class WorkerStub {
 constructor(){this.messages=[];this.terminated=false;}
 postMessage(data){this.messages.push(data);}terminate(){this.terminated=true;}
 reply(result){const message=this.messages.at(-1);this.onmessage?.({data:{...message,...result}});}
}
function rig(){let state=E.createGame(),blocked=false;state.current=2;const workers=[],actions=[],cues=[];
 const controller=new AIController({getState:()=>state,isBlocked:()=>blocked,workerFactory:()=>{const w=new WorkerStub();workers.push(w);return w;},onCue:d=>{if(d)cues.push(d);},execute:d=>{actions.push(d);return true;}});
 controller.start({mode:'pve',difficulty:'normal',matchSeed:4});
 return {controller,workers,actions,cues,get state(){return state;},set state(v){state=v;},set blocked(v){blocked=v;}};
}
test('controller shows actual perturbed aim then executes only after cue and overlay close',()=>{
 const a=rig();a.controller.tick(0);assert.equal(a.workers.length,1);
 a.blocked=true;a.workers[0].reply({decision:{type:'launch',kind:'move',direction:{x:1,y:0},power:.5}});a.controller.tick(500);assert.equal(a.cues.length,0);
 a.blocked=false;a.controller.tick(600);assert.equal(a.cues.length,1);assert.notEqual(a.cues[0].direction.y,0);a.blocked=true;a.controller.tick(1000);assert.equal(a.actions.length,0);
 a.blocked=false;a.controller.tick(1100);assert.equal(a.actions.length,0);a.controller.tick(1361);assert.equal(a.actions.length,1);assert.deepEqual(a.actions[0],a.cues[0]);
});
test('restart cancels workers and old replies cannot modify new matches',()=>{
 const a=rig();a.controller.tick(0);const old=a.workers[0];a.controller.start({mode:'pve',difficulty:'hard',matchSeed:9});
 old.reply({decision:{type:'build'}});a.controller.tick(10);assert.equal(a.actions.length,0);assert.ok(old.terminated);assert.equal(a.workers.length,2);
 a.controller.stop();a.workers[1].reply({decision:{type:'end'}});a.controller.tick(1000);assert.equal(a.actions.length,0);
});
test('changed real state invalidates a reply and triggers fresh planning',()=>{
 const a=rig();a.controller.tick(0);a.state.players[2].pos={x:5,y:4};a.workers[0].reply({decision:{type:'build'}});a.controller.tick(300);assert.equal(a.actions.length,0);a.controller.tick(316);assert.equal(a.workers.length,2);
});
test('worker failure chooses a legal end and never runs search on main thread',()=>{
 const a=rig();a.controller.tick(0);a.workers[0].onerror({preventDefault(){}});a.controller.tick(1);assert.deepEqual(a.actions,[{type:'end'}]);
});
test('local PvP never constructs a worker',()=>{
 const a=rig();a.controller.start({mode:'local-pvp'});a.controller.tick(0);assert.equal(a.workers.length,0);
});
test('pause during aim restarts a full visible cue even when background had no frames',()=>{
 const a=rig();a.controller.tick(0);a.workers[0].reply({decision:{type:'launch',kind:'missile',direction:{x:1,y:0},power:.6}});a.controller.tick(10);assert.equal(a.cues.length,1);
 a.controller.pauseCue();a.controller.tick(1000);assert.equal(a.actions.length,0);assert.equal(a.cues.length,2);a.controller.tick(1200);assert.equal(a.actions.length,0);a.controller.tick(1261);assert.equal(a.actions.length,1);
});
test('explicit stop disables the session even if the old state still belongs to the computer',()=>{
 const a=rig();a.controller.tick(0);const old=a.workers[0];a.controller.stop();
 old.reply({decision:{type:'build'}});a.controller.tick(1000);
 assert.equal(a.workers.length,1);assert.equal(a.controller.active,false);assert.equal(a.actions.length,0);
});
