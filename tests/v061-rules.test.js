import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine.js';
import {recoverExpiredOverloads} from '../src/outposts.js';

function arena() {
  const s=E.createGame(); s.cells.fill(0); s.towers=[]; s.claims=[];
  s.players[1].pos={x:2,y:25};s.players[2].pos={x:15,y:5};
  E.recompute(s); return s;
}
function tower(s,owner,x,y,stage=2) {
  const t={id:++s.nextId,owner,pos:{x,y},stage,state:'normal',slot:'ABCDE'[s.towers.filter(t=>t.owner===owner).length],protected:[]};
  s.towers.push(t);E.expand(s,t);E.recompute(s);return t;
}
const cell=(s,x,y)=>E.index(s,{x,y});
function overload(s,t) {s.current=t.owner;assert.ok(E.applyRelayOverload(s,t));return [...t.influence];}
function advance(s) {assert.ok(E.endTurn(s));assert.ok(E.beginTurn(s));}

test('overload preserves the actual 25-cell mask and stage, suspends protection',()=>{
  const s=arena(),t=tower(s,1,8,12);const old=[...t.influence];
  overload(s,t);assert.deepEqual(t.influence,old);assert.equal(t.stage,2);assert.equal(t.protected.length,0);
});
test('enemy missile temporary paint stays residual then restores immediately',()=>{
  const s=arena(),t=tower(s,1,8,12);overload(s,t);
  E.paintMissile(s,2,{x:10,y:12},0);const i=cell(s,10,12);
  assert.equal(s.stability[i],'temporary');assert.ok(t.influence.includes(i));
  advance(s);advance(s);assert.equal(s.cells[i],1);assert.ok(t.protected.includes(i));assert.equal(t.influence.length,25);
});
test('enemy stable loss is permanent in residual even if later disconnected',()=>{
  const s=arena(),t=tower(s,1,8,12);overload(s,t);
  const root=tower(s,2,13,12,0);
  for(let x=10;x<=13;x++)s.cells[cell(s,x,12)]=2;
  E.recompute(s);const i=cell(s,10,12);
  assert.equal(s.stability[i],'stable');assert.ok(!t.influence.includes(i));
  E.removeTower(s,root);assert.equal(s.stability[i],'temporary');assert.ok(!t.influence.includes(i));
  advance(s);advance(s);assert.equal(s.cells[i],2);assert.ok(!t.protected.includes(i));
  advance(s);advance(s);assert.equal(s.cells[i],1);assert.ok(t.influence.includes(i));
});
test('stable lost column is not repainted by restore but next own growth recovers it',()=>{
  const s=arena(),t=tower(s,1,8,12);overload(s,t);tower(s,2,14,12,0);
  for(let y=10;y<=14;y++)s.cells[cell(s,10,y)]=2;
  for(let x=10;x<=14;x++)s.cells[cell(s,x,12)]=2;
  E.recompute(s);advance(s);advance(s);
  for(let y=10;y<=14;y++)assert.equal(s.cells[cell(s,10,y)],2);
  advance(s);advance(s);
  for(let y=10;y<=14;y++)assert.equal(s.cells[cell(s,10,y)],1);
});
test('enemy structural growth erodes overload mask; locked tiles cannot restore or regrow',()=>{
  const s=arena(),t=tower(s,1,8,12),b=tower(s,2,12,12,1);overload(s,t);
  const n=t.influence.length;advance(s);
  assert.equal(b.stage,2);assert.ok(t.influence.length<n);
  const i=cell(s,10,12);assert.ok(b.protected.includes(i));assert.ok(!t.influence.includes(i));
  advance(s);assert.equal(s.cells[i],2);advance(s);advance(s);assert.equal(s.cells[i],2);
  E.removeTower(s,b);advance(s);advance(s);assert.equal(s.cells[i],1);
});
for(const stage of [0,1])test('restore stage '+stage+' skips same beginTurn growth',()=>{
  const s=arena(),t=tower(s,1,8,12,stage);overload(s,t);advance(s);advance(s);
  assert.equal(t.stage,stage);advance(s);advance(s);assert.equal(t.stage,stage+1);
});
test('mature regrowth uses a frozen one-layer frontier, no jump through missing layers',()=>{
  const s=arena(),t=tower(s,1,8,12);t.influence=[cell(s,8,12)];s.cells.fill(0);s.cells[cell(s,8,12)]=1;E.recompute(s);
  E.growTowers(s,1);assert.equal(t.influence.length,5);assert.equal(s.cells[cell(s,10,12)],0);
  E.growTowers(s,1);assert.equal(t.influence.length,13);assert.equal(s.cells[cell(s,10,12)],1);
});
test('empty mature influence restarts from unprotected center, not full square',()=>{
  const s=arena(),t=tower(s,1,8,12);t.influence=[];s.cells.fill(0);E.recompute(s);
  E.growTowers(s,1);assert.deepEqual(t.influence,[cell(s,8,12)]);
  E.growTowers(s,1);assert.equal(t.influence.length,5);
});
test('overlapping friendly masks protect union while one source is overloaded',()=>{
  const s=arena(),a=tower(s,1,8,12),b=tower(s,1,10,12);
  a.state='overloaded';a.overloadExpiresTurn=2;E.recompute(s);
  const i=cell(s,9,12);assert.ok(s.protectedBy[i].includes(b.id));assert.ok(!s.protectedBy[i].includes(a.id));
  E.paintMissile(s,2,{x:9,y:12},0);assert.equal(s.cells[i],1);
});
test('external friendly protection follows actual mask rather than stage rectangle',()=>{
  const s=arena(),a=tower(s,1,8,12),b=tower(s,1,9,12);
  b.influence=b.influence.filter(i=>i!==cell(s,8,12));E.recompute(s);
  assert.equal(E.hasExternalFriendlyProtection(s,a),false);assert.ok(E.applyRelayOverload(s,a));
});
test('edge masks are unique, clipped and never expand past stage',()=>{
  const s=arena(),t=tower(s,1,0,0,0);assert.deepEqual(t.influence,[0]);
  E.growTowers(s,1);assert.equal(t.stage,1);assert.equal(t.influence.length,4);
  E.growTowers(s,1);assert.equal(t.influence.length,9);
  assert.equal(new Set(t.influence).size,9);assert.ok(t.influence.every(i=>i>=0&&i<s.cells.length));
});
for(const stage of [1,2])test('takeover '+stage+' initializes new mask and defers extra growth',()=>{
  const s=arena(),t=tower(s,2,8,12,stage);t.state='overloaded';t.overloadExpiresTurn=1;E.recompute(s);
  s.players[1].pos={x:7,y:12};assert.ok(E.startTakeover(s,t.id));E.beginTurn(s);advance(s);
  assert.equal(t.owner,1);assert.equal(t.stage,stage);assert.equal(t.influence.length,(stage*2+1)**2);
  assert.equal(t.activationTurn,s.turnIndex);assert.equal(t.protected.length,t.influence.length);
  const hp=s.players[1].hp;advance(s);advance(s);assert.equal(t.stage,2);assert.equal(s.players[1].hp,hp);
});
test('restoration decides all cells before re-enabling roots',()=>{
  const s=arena(),t=tower(s,1,8,12);overload(s,t);
  const red=tower(s,2,11,12,0),i=cell(s,10,12);s.cells[i]=2;E.recompute(s);
  assert.ok(!t.influence.includes(i));s.turnIndex=2;recoverExpiredOverloads(s,1);
  assert.equal(s.cells[i],2);assert.equal(t.state,'normal');assert.equal(t.skipGrowthTurn,2);assert.ok(red.protected.length);
});
test('reclaim does not repaint, then mature tower regrows enemy temporary gaps',()=>{
  const s=arena(),t=tower(s,1,8,12);overload(s,t);
  const i=cell(s,9,12);s.cells[i]=2;E.recompute(s);assert.ok(t.influence.includes(i));
  t.state='contested';t.contestedBy=2;t.contestedResolveTurn=2;E.recompute(s);
  s.players[1].pos={x:7,y:12};const hp=s.players[1].hp,before=[...s.cells];
  assert.ok(E.reclaimTower(s,t.id));assert.deepEqual(s.cells,before);assert.equal(s.players[1].hp,hp);
  assert.ok(E.beginTurn(s));advance(s);
  assert.equal(s.cells[i],1);assert.ok(t.protected.includes(i));
});
