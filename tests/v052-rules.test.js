import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine.js';
import * as P from '../src/physics.js';
const fill = (s,n) => {s.towers=[]; s.cells.fill(0); s.cells.fill(1,0,n); E.recompute(s);};
for (const n of [345,346]) test(`round boundary uses exact 60%: ${n}/576`,()=>{
 const s=E.createGame(10); fill(s,n); E.endTurn(s); assert.equal(s.winner,null);
 E.beginTurn(s); E.endTurn(s); assert.equal(s.winner?.reason,n===346?'territory':undefined);
});
test('defender can reduce 60% before boundary',()=>{const s=E.createGame(10);fill(s,346);E.endTurn(s);E.beginTurn(s);fill(s,345);E.endTurn(s);assert.equal(s.winner,null);});
test('temporary hit and final disconnected paint are safe',()=>{
 const s=E.createGame(10);s.towers=[];s.cells.fill(1);E.recompute(s);s.players[2].pos={x:8,y:12};
 assert.equal(E.hitRole(s,2),false);assert.equal(s.players[2].hp,10);
 s.phase='MISSILE_FLYING';s.activeBody={kind:'missile',x:8.5,y:12.5,vx:0,vy:0,charge:0,carried:2,wasEnemy:false,trail:[]};
 P.stepBody(s,1/120);assert.equal(s.players[2].hp,10);
});
test('dynamic stable/temporary and protection eligibility',()=>{
 const s=E.createGame(10);s.cells.fill(0);s.towers=[];s.players[2].pos={x:8,y:12};const i=E.index(s,s.players[2].pos);s.cells[i]=1;E.recompute(s);
 assert.equal(E.hitRole(s,2),false);
 const t={id:++s.nextId,owner:1,pos:{x:9,y:12},stage:0,protected:[]};s.towers.push(t);E.expand(s,t);E.recompute(s);
 assert.equal(E.hitRole(s,2),true);E.removeTower(s,t);assert.equal(E.hitRole(s,2),false);
 t.pos={x:8,y:12};s.towers.push(t);E.recompute(s);assert.equal(E.hitRole(s,2),true);
});
test('carry ignores temporary, reenters stable after safe gap',()=>{
 const s=E.createGame(10);s.cells.fill(0);s.towers=[];
 for(const x of [4,6,8])s.cells[E.index(s,{x,y:10})]=1;
 for(const x of [4,8])s.towers.push({id:++s.nextId,owner:1,pos:{x,y:10},stage:0,protected:[]});E.recompute(s);
 const m={carried:2,wasEnemy:false};P.carryAlong(s,m,{x:3.5,y:10.5},{x:8.5,y:10.5});assert.equal(s.players[2].hp,8);
});
for(const kind of ['move','missile']) test(`${kind} relay status from mode entry through cleanup`,()=>{
 const s=E.createGame(10);const t=s.towers[0],foe=s.towers[1];
 assert.equal(E.relayStatus(s,t),'normal');E.chooseAim(s,kind);
 assert.equal(E.relayStatus(s,t),'available');assert.equal(E.relayStatus(s,foe),'normal');
 if(kind==='move')s.moveVisited.push(t.id);else s.visitedRelayTowerIds.add(t.id);
 s.phase=kind==='move'?'MOVE_RELAY_AIM':'MISSILE_RELAY_AIM';assert.equal(E.relayStatus(s,t),'used');
 P.cancelAim(s);assert.equal(E.relayStatus(s,t),'normal');E.chooseAim(s,kind);assert.equal(E.relayStatus(s,t),'available');
 E.win(s,1,'hp');assert.equal(E.relayStatus(s,t),'normal');
});
test('movement and missile histories are independent',()=>{
 const s=E.createGame(10),t=s.towers[0];E.chooseAim(s,'move');s.moveVisited.push(t.id);assert.equal(s.visitedRelayTowerIds.size,0);
 P.cancelAim(s);E.chooseAim(s,'missile');assert.equal(E.relayStatus(s,t),'available');
});
