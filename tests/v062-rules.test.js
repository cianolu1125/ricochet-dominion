import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine.js';
import * as P from '../src/physics.js';
import {paintTargets} from '../src/charge.js';
import {drainFacts} from '../src/feedback-events.js';
const cell=(s,x,y)=>E.index(s,{x,y});
function arena(width=18,height=32) {
  const s=E.createGame();s.width=width;s.height=height;
  s.cells=Array(width*height).fill(0);s.towers=[];s.claims=[];
  s.players[1].pos={x:1,y:height-2};s.players[2].pos={x:width-2,y:1};
  E.recompute(s);drainFacts(s);return s;
}
function tower(s,owner,x,y,stage=2,state='normal') {
  const t={id:++s.nextId,owner,pos:{x,y},stage,state,slot:'A',protected:[]};
  s.towers.push(t);E.expand(s,t);E.recompute(s);return t;
}
const ultimate=s=>drainFacts(s).find(e=>e.type==='charge3Ultimate');

test('01 centered full union has 65 unique cells on an 18 by 32 board',()=>{
  const s=arena();const mask=paintTargets(s,{x:8,y:16},3);
  assert.equal(mask.size,65);assert.ok(mask.has(cell(s,0,16)));assert.ok(mask.has(cell(s,8,31)));
});
test('02 corner mask is clipped to 53 unique cells',()=>{
  const s=arena();assert.equal(paintTargets(s,{x:0,y:0},3).size,53);
});
for(const [n,state] of ['normal','overloaded','contested'].entries())
  test('03-07 full rays ignore towers and consecutive protection '+state,()=>{
    const s=arena();tower(s,2,8,7,2,state);tower(s,2,3,16,2,state);
    const mask=paintTargets(s,{x:8,y:16},3);
    assert.equal(mask.size,65);assert.ok(mask.has(cell(s,8,0)));assert.ok(mask.has(cell(s,0,16)));
  });
for(const [name,status] of [['08 stable','normal'],['09 protected','normal'],['10 overlap','normal'],['11 temporary','overloaded'],['12 contested','contested']])
  test(name+' force paint removes enemy protection',()=>{
    const s=arena();const t=tower(s,2,6,12,2,status);
    if(name.includes('overlap'))tower(s,2,5,12);
    E.paintMissile(s,1,{x:8,y:20},3);
    const i=cell(s,8,12);assert.equal(s.cells[i],1);assert.equal(E.protectedOwner(s,i),0);
    assert.ok(!t.influence.includes(i));assert.equal(t.stage,2);
  });
test('13-14 friendly and neutral cells paint without corrupting friendly influence',()=>{
  const s=arena(),t=tower(s,1,8,16);const before=[...t.influence];
  E.paintMissile(s,1,{x:8,y:16},3);
  assert.deepEqual(t.influence,before);assert.equal(s.cells[cell(s,8,31)],1);
});
for(const count of [1,2,3])test('15-18 removes all '+count+' overlapping enemy influence claims',()=>{
  const s=arena();const towers=Array.from({length:count},(_,n)=>tower(s,2,6,12+n));
  E.paintMissile(s,1,{x:8,y:20},3);
  const i=cell(s,8,13);for(const t of towers){assert.ok(!t.influence.includes(i));assert.equal(t.stage,2);}
});
test('19-22 recompute keeps irregular mask and recovery grows only a frozen frontier',()=>{
  const s=arena(),t=tower(s,2,6,12);const original=[...t.influence];
  E.paintMissile(s,1,{x:8,y:20},3);const i=cell(s,8,12);
  E.recompute(s);assert.ok(!t.influence.includes(i));assert.equal(s.cells[i],1);
  // Create a three-cell-deep hole that a mature tower must recover in steps.
  t.influence=[cell(s,4,10)];E.recompute(s);
  E.growTowers(s,2);assert.equal(t.stage,2);assert.equal(t.influence.length,3);
  assert.ok(!t.influence.includes(cell(s,6,12)));E.growTowers(s,2);
  assert.ok(t.influence.length>3 && t.influence.length<original.length);
});
for(const [name,pos] of [['23 core',[7,15]],['24 distant row',[1,16]],['25 distant column',[8,2]],['26 protected',[8,29]],['27 overlapping',[8,14]]])
  test(name+' tower center is destroyed',()=>{
    const s=arena(),t=tower(s,2,...pos);if(name.startsWith('27'))tower(s,2,9,14);
    E.paintMissile(s,1,{x:8,y:16},3);assert.ok(!s.towers.includes(t));
  });
for(const count of [2,3,5])test('28-31 destroys all '+count+' targets but no friendly tower',()=>{
  const s=arena();const enemyTowers=Array.from({length:count},(_,n)=>tower(s,2,8,2+n*6,0));
  const friend=tower(s,1,8,16,0);E.paintMissile(s,1,{x:8,y:16},3);
  assert.ok(s.towers.includes(friend));for(const t of enemyTowers)assert.ok(!s.towers.includes(t));
  assert.equal(ultimate(s).destroyedTowers.length,count);
});
for(const [name,p] of [['32 core',{x:7,y:15}],['33 protected',{x:8,y:2}],['34 triple overlap',{x:8,y:16}]])
  test(name+' pioneer receives exactly one independent range damage',()=>{
    const s=arena();s.players[2].pos=p;tower(s,2,p.x,p.y);const hp=s.players[2].hp;
    E.paintMissile(s,1,{x:8,y:16},3);
    assert.equal(s.players[2].hp,hp-1);const facts=drainFacts(s);
    assert.equal(facts.filter(e=>e.type==='damage'&&e.source==='charge3').length,1);
  });
test('35 outside mask receives no range damage',()=>{
  const s=arena();s.players[2].pos={x:4,y:10};const hp=s.players[2].hp;
  E.paintMissile(s,1,{x:8,y:16},3);assert.equal(s.players[2].hp,hp);
});
test('36-38 traversal, blast and final territory damage have independent accounting',()=>{
  const s=arena();tower(s,1,2,16,0);s.cells[cell(s,3,16)]=1;E.recompute(s);
  const hp=s.players[2].hp,m={carried:2,wasEnemy:false};
  P.carryAlong(s,m,{x:3.5,y:15.5},{x:3.5,y:16.5});
  assert.equal(s.players[2].hp,hp-1);
  E.paintMissile(s,1,{x:8,y:16},3);assert.equal(s.players[2].hp,hp-2);
  E.hitRole(s,2);assert.equal(s.players[2].hp,hp-3);
});
test('39 all roots overloaded disable traversal but range damage still applies',()=>{
  const s=arena();tower(s,1,3,16,0,'overloaded');E.recompute(s);
  const hp=s.players[2].hp,m={carried:2,wasEnemy:false};
  P.carryAlong(s,m,{x:3.5,y:15.5},{x:3.5,y:16.5});assert.equal(s.players[2].hp,hp);
  E.paintMissile(s,1,{x:8,y:16},3);assert.equal(s.players[2].hp,hp-1);
  E.hitRole(s,2);assert.equal(s.players[2].hp,hp-1);
});
test('40 territory checks retain existing round-boundary semantics',()=>{
  const s=arena(8,8);s.cells.fill(1);s.current=2;
  E.paintMissile(s,1,{x:4,y:4},3);E.endTurn(s);assert.equal(s.winner.reason,'territory');
});
test('41-43 fatal range damage completes all structure changes before HP victory',()=>{
  const s=arena();s.players[2].pos={x:8,y:16};s.players[2].hp=1;
  const targets=[tower(s,2,8,2),tower(s,2,2,16),tower(s,2,8,29)];
  E.paintMissile(s,1,{x:8,y:16},3);
  assert.equal(s.winner?.reason,'hp');assert.equal(s.winner.player,1);
  for(const t of targets)assert.ok(!s.towers.includes(t));
  assert.equal(s.cells[cell(s,8,31)],1);assert.ok(ultimate(s));
});
test('regression Charge II still stops at a protected ray and cannot repaint it',()=>{
  const s=arena();tower(s,2,8,7);
  E.paintMissile(s,1,{x:8,y:16},2);
  assert.equal(s.cells[cell(s,8,9)],2);assert.equal(s.cells[cell(s,8,0)],0);
});
test('pending claims are rebuilt after full mask changes their old membership',()=>{
  const s=arena();tower(s,2,6,12,0);const i=cell(s,8,12);s.cells[i]=2;
  s.claims.push({id:30,captor:1,target:2,cells:[i],sources:[30],createdTurn:0,dueTurn:2});
  E.recompute(s);E.paintMissile(s,1,{x:8,y:20},3);
  assert.equal(s.cells[i],1);assert.ok(!s.claims.some(c=>c.cells.includes(i)));
});
test('ultimate records actual broken protected cells for presentation without renderer inference',()=>{
  const s=arena();tower(s,2,6,12);const i=cell(s,8,12);
  E.paintMissile(s,1,{x:8,y:20},3);
  assert.ok(ultimate(s)?.brokenProtectedCells?.includes(i));
});
