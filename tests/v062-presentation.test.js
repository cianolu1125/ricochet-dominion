import test from 'node:test';
import assert from 'node:assert/strict';
import {FeedbackDirector} from '../src/feedback.js';
import {visualChanges,snapshot} from '../src/visual-changes.js';
import * as E from '../src/engine.js';
import {drainFacts} from '../src/feedback-events.js';
import * as P from '../src/physics.js';
const U=await import('../src/ultimate.js').catch(()=>({}));
const event={type:'charge3Ultimate',eventId:'u',groupId:'g',owner:1,x:8.5,y:16.5,width:18,height:32,born:1000,attackCells:[],destroyedTowers:[]};
test('ultimate camera locks before blast, pulls to whole board and restores exactly',()=>{
  assert.equal(typeof U.ultimateCamera,'function');
  const near=U.ultimateCamera(event,1200,false);assert.ok(near.zoom>=1.55);
  const wide=U.ultimateCamera(event,1500,false);assert.ok(wide.zoom<=.96);
  const restored=U.ultimateCamera(event,4000,false);assert.equal(restored.zoom,1);assert.equal(restored.focus,null);
});
test('reduced motion has no camera translation or shake',()=>{
  assert.equal(typeof U.ultimateCamera,'function');
  for(const t of [1000,1200,1500,1800]) {
    const c=U.ultimateCamera(event,t,true);assert.equal(c.zoom,1);assert.equal(c.focus,null);
    assert.deepEqual(c.shake,{x:0,y:0});
  }
});
test('purge arrival precedes distinct damage wave; zero distance stays finite',()=>{
  assert.equal(typeof U.waveDelay,'function');
  const timing=U.ultimateTiming(false),near=U.waveDelay(event,{x:8.5,y:16.5},false);
  const far=U.waveDelay(event,{x:8.5,y:31.5},false);
  assert.equal(near,timing.purge);assert.ok(far>near && far<timing.damage);
  assert.ok(U.waveDelay(event,{x:8.5,y:31.5},true)<U.ultimateTiming(true).damage);
});
test('ultimate fact suppresses immediate ordinary blast and global demolition feedback',()=>{
  const f=new FeedbackDirector({play(){}});f.submit([{...event},{type:'siege',eventId:'s',groupId:'g',owner:1,x:8,y:16}],1000);
  assert.equal(f.effects.filter(e=>e.type==='siege').length,0);
  assert.equal(f.effects.filter(e=>e.type==='charge3Ultimate').length,1);
  f.submit([event],1050);assert.equal(f.effects.filter(e=>e.type==='charge3Ultimate').length,1);
});
test('ultimate holds old protected tiles until the wave; authoritative state stays final',()=>{
  const s=E.createGame();const before=snapshot(s);const target=s.towers[1];
  E.paintMissile(s,1,{x:target.pos.x,y:target.pos.y},3);
  const facts=drainFacts(s),tr=new Map();visualChanges(s,before,facts,1000,false,tr);
  const i=E.index(s,target.pos),change=tr.get(i);
  assert.equal(s.cells[i],1);assert.ok(!s.towers.includes(target));
  assert.ok(change.delay>=280);assert.equal(change.fromProtected,true);
});
test('ultimate audio emits one primary pulse and a lighter later damage pulse',()=>{
  const played=[],f=new FeedbackDirector({play:e=>played.push(e.type)});
  f.submit([event],1000);assert.ok(!played.includes('ultimateBlast'));
  f.update(1300);assert.equal(played.filter(t=>t==='ultimateBlast').length,1);
  f.update(1600);f.update(2200);assert.equal(played.filter(t=>t==='ultimateBlast').length,1);
  assert.equal(played.filter(t=>t==='ultimateDamage').length,1);
  f.update(5000);assert.equal(f.effects.length,0);
});
test('forecast uses real flight, does not mutate live state and reaches actual final mask',()=>{
  assert.equal(typeof P.predictFinalImpact,'function');
  const s=E.createGame();s.towers=[];s.cells.fill(0);s.players[1].pos={x:5,y:16};
  E.recompute(s);E.chooseAim(s,'missile');s.charge=3;P.launch(s,{x:1,y:0},.2);
  const before=structuredClone(s),predicted=P.predictFinalImpact(s);
  assert.deepEqual(s,before);assert.ok(predicted.duration>0);assert.equal(predicted.willDetonate,true);
  for(let n=0;n<1000&&s.activeBody;n++)P.stepBody(s,1/120);
  const impact=drainFacts(s).find(e=>e.type==='charge3Ultimate');
  assert.deepEqual(predicted.position,{x:impact.x,y:impact.y});
});
test('chase starts at normal board center, leads toward predicted impact and clears after capture',()=>{
  assert.equal(typeof U.UltimateDirector,'function');
  const c=new U.UltimateDirector();
  c.startFlight({x:3.5,y:26.5},{position:{x:9.5,y:8.5},duration:900,width:18,height:32},100);
  assert.deepEqual(c.camera(100,{x:3.5,y:26.5}).focus,{x:9,y:16});
  const lead=c.camera(920,{x:7.5,y:12.5});assert.ok(lead.focus.y<10);
  c.update(940,{activeBody:null});assert.equal(c.camera(940).focus,null);
});
test('ultimate does not animate unchanged cells outside its mask',()=>{
  const s=E.createGame();s.cells.fill(0);s.towers=[];E.recompute(s);
  const before=snapshot(s);E.paintMissile(s,1,{x:8,y:16},3);
  const tr=new Map();visualChanges(s,before,drainFacts(s),0,false,tr);
  assert.equal(tr.has(E.index(s,{x:1,y:6})),false);
});
test('equal-distance demolished towers share one lightweight crack per update',()=>{
  const played=[],f=new FeedbackDirector({play:e=>played.push(e.type)});
  const towers=[{id:1,pos:{x:5,y:16}},{id:2,pos:{x:11,y:16}}];
  f.submit([{...event,destroyedTowers:towers}],1000);f.update(1500);
  assert.equal(played.filter(t=>t==='ultimateCrack').length,1);
  f.update(1550);assert.equal(played.filter(t=>t==='ultimateCrack').length,1);
});
test('impact preserves chase zoom instead of jumping back to normal scale',()=>{
  const c=new U.UltimateDirector();
  c.startFlight({x:3,y:20},{position:{x:8.5,y:16.5},duration:900,width:18,height:32},0);
  const chase=c.camera(850,{x:8.5,y:16.5});
  c.startImpact(event,860,false);
  assert.equal(c.camera(860).zoom,chase.zoom);
});
