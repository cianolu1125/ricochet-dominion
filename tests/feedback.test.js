import test from 'node:test';
import assert from 'node:assert/strict';
import { FeedbackDirector, tilePresentation, chargeSpec } from '../src/feedback.js';
import * as E from '../src/engine.js';
import * as P from '../src/physics.js';
import { drainFacts } from '../src/feedback-events.js';
test('simultaneous siege layers keep all visuals and produce one sound/shake',()=>{
 const heard=[],d=new FeedbackDirector({play:e=>heard.push(e.type)});
 const events=['destroy','damage','blast','siege'].map((type,i)=>({type,eventId:`s${i}`,groupId:'impact',owner:1,x:2,y:3}));
 d.submit(events,0);assert.deepEqual(heard,['siege']);assert.equal(d.effects.length,4);assert.equal(d.impulses,1);
 d.submit(events,10);assert.equal(heard.length,1);
});
test('three real quick bounces and HP losses each survive, duplicates do not',()=>{
 const heard=[],d=new FeedbackDirector({play:e=>heard.push(e.type)});
 for(let n=0;n<3;n++)d.submit([{type:'bounce',eventId:`b${n}`,groupId:`b${n}`},{type:'damage',eventId:`d${n}`,groupId:`d${n}`}],n*10);
 assert.equal(heard.length,6);assert.equal(d.effects.filter(e=>e.type==='damage').length,3);
 for(let t=0;t<250;t++){const p=d.shake(t);assert.ok(Math.abs(p.x)<=3 && Math.abs(p.y)<=3);}
 d.reduced=true;assert.deepEqual(d.shake(30),{x:0,y:0});
});
test('all charge levels are distinct, maxed relay is short, wave switches at landing',()=>{
 assert.deepEqual([1,2,3].map(n=>chargeSpec(n).count),[6,10,16]);
 assert.ok(chargeSpec(3).duration<=340);assert.equal(chargeSpec(3,true).duration,120);
 const tr={from:2,to:1,born:0,delay:80,duration:340,wave:true};
 assert.equal(tilePresentation(tr,150,false).owner,2);assert.equal(tilePresentation(tr,350,false).owner,1);
 assert.equal(tilePresentation(tr,150,true).lift,0);
});
test('carry traversal emits distinct facts for each actual HP decrement',()=>{
 const s=E.createGame();s.cells.fill(0);for(const x of [3,5,7])s.cells[E.index(s,{x,y:8})]=2;
 const m={carried:2,wasOwn:false};P.carryAlong(s,m,{x:2.5,y:8.5},{x:8.5,y:8.5});
 const f=drainFacts(s);assert.equal(s.players[2].hp,7);assert.equal(f.length,3);assert.equal(new Set(f.map(e=>e.groupId)).size,3);
});

test('actual role hit and explosion share one causal sound group',()=>{
 const s=E.createGame();const enemy=s.towers.find(t=>t.owner===2);s.players[2].pos={...enemy.pos};s.players[2].hp=10;
 s.phase='MISSILE_AIM';s.charge=0;P.launch(s,{x:0,y:-1},1);
 s.activeBody.x=enemy.pos.x+.5;s.activeBody.y=enemy.pos.y+1.3;s.activeBody.vx=0;s.activeBody.vy=-15;
 P.stepBody(s,.1);const f=drainFacts(s),damage=f.find(e=>e.type==='damage'),blast=f.find(e=>e.type==='blast');
 assert.ok(damage);assert.ok(blast);assert.equal(damage.groupId,blast.groupId);
 const heard=[],d=new FeedbackDirector({play:e=>heard.push(e.type)});d.submit(f,0);assert.deepEqual(heard,['blast']);
});

test('a weak independent hit reinjects feedback without erasing a stronger active shock',()=>{
 const d=new FeedbackDirector({play(){}});d.submit([{type:'siege',eventId:'strong',groupId:'strong'}],0);
 d.submit([{type:'damage',eventId:'weak',groupId:'weak'}],10);
 assert.ok(d.envelope.amplitude>2);assert.equal(d.impulses,2);
});
test('release damage is recorded at actual legal landing, not prior carried world',()=>{
 const s=E.createGame();s.cells.fill(0);s.cells[E.index(s,{x:5,y:6})]=2;s.players[2].world={x:5.4,y:5.4};
 const m={x:5.5,y:5.5,vx:0,vy:-10,carried:2,wasOwn:false};const tower={pos:{x:5,y:5}};
 P.releaseBefore(s,m,tower);const f=drainFacts(s);assert.equal(f.length,1);assert.deepEqual({x:f[0].x,y:f[0].y},{x:5.5,y:6.5});
});
