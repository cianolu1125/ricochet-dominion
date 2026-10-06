import test from 'node:test';import assert from 'node:assert/strict';import * as E from '../src/engine.js';import * as P from '../src/physics.js';
import {CONFIG} from '../src/config.js';import {executeDecision} from '../src/ai/ai-executor.js';import {searchDecision} from '../src/ai/ai-search.js';import {simulate} from '../src/ai/ai-simulate.js';import {playMatch} from '../scripts/ai-lab.mjs';
function tower(s,owner,x,y,stage=2,state='normal') {const t={id:++s.nextId,owner,slot:'ABCDE'[s.towers.filter(t=>t.owner===owner).length],pos:{x,y},stage,state,protected:[]};s.towers.push(t);E.expand(s,t);E.recompute(s);return t;}
function empty(){const s=E.createGame(10,'desktop');s.cells.fill(0);s.towers=[];s.players[1].pos={x:2,y:9};s.players[2].pos={x:29,y:9};E.recompute(s);return s;}
function flight(s,d){assert.equal(executeDecision(s,d),true);let ticks=0;while(s.activeBody&&!s.winner&&ticks++<600)P.stepBody(s,CONFIG.physics.step);assert.ok(!s.activeBody||s.winner);}
test('all AI outpost operations preserve replacement, healing and terminal action rules',()=>{
 let s=empty();s.players[1].hp=5;for(let x=2;x<=10;x+=2)tower(s,1,x,3);s.players[1].pos={x:16,y:8};
 const old=s.towers[2];assert.equal(executeDecision(s,{type:'build',replacementId:old.id}),true);assert.equal(s.towers.length,5);assert.equal(s.players[1].hp,6);assert.ok(!s.towers.includes(old));
 s=empty();const enemy=tower(s,2,10,9);s.players[1].pos={x:9,y:9};assert.equal(executeDecision(s,{type:'dismantle',targetId:enemy.id}),true);assert.equal(s.towers.length,0);
 s=empty();const target=tower(s,2,10,9,2,'overloaded');target.overloadExpiresTurn=2;s.players[1].pos={x:9,y:9};E.recompute(s);
 assert.equal(executeDecision(s,{type:'takeover',targetId:target.id}),true);assert.equal(s.phase,'HANDOFF');assert.equal(target.state,'contested');assert.equal(s.moveAvailable,false);
 E.beginTurn(s);s.players[2].pos={x:11,y:9};assert.equal(executeDecision(s,{type:'reclaim',targetId:target.id}),true);assert.equal(s.phase,'HANDOFF');assert.equal(target.state,'normal');assert.equal(s.players[2].hp,10);
});
test('real AI chain reaches Charge I/II/III, shields overlap, and applies ultimate through actual physics',()=>{
 const s=empty();s.players[1].pos={x:1,y:9};const ts=[3,5,7,9,11].map(x=>tower(s,1,x,9));tower(s,2,23,9);s.players[2].pos={x:23,y:9};
 for(let i=0;i<5;i++) {
  flight(s,{type:'launch',kind:'missile',direction:{x:1,y:0},power:1});assert.equal(s.phase,'MISSILE_RELAY_AIM');assert.equal(s.visitedRelayTowerIds.size,i+1);assert.equal(s.charge,i===0||i===1?1:i===2||i===3?2:3);
 }
 const hp=s.players[2].hp;assert.equal(executeDecision(s,{type:'end'}),true);assert.ok(!s.towers.some(t=>t.owner===2));assert.equal(s.players[2].hp,hp-1);
 assert.ok(ts.every(t=>t.state==='normal'));assert.ok(s.feedbackFacts.some(f=>f.type==='charge3Ultimate'));
});
test('Hard identifies five-relay finishing attack without making charge itself a goal',()=>{
 const s=empty();s.players[1].pos={x:1,y:9};const ts=[3,5,7,9,11].map(x=>tower(s,1,x,9));tower(s,2,23,9);s.players[2].pos={x:23,y:9};s.players[2].hp=1;
 s.phase='MISSILE_RELAY_AIM';s.actionAvailable=false;s.committed=true;s.relay={id:ts[3].id,pos:ts[3].pos};s.visitedRelayTowerIds=new Set(ts.slice(0,4).map(t=>t.id));s.charge=2;
 const r=searchDecision(s,{difficulty:'hard',matchSeed:3,decisionIndex:2});assert.equal(r.decision.type,'launch');const next=simulate(s,r.decision);assert.ok(next);if(!next.winner){assert.equal(next.charge,3);assert.equal(simulate(next,{type:'end'}).winner?.player,1);}else assert.equal(next.winner.player,1);
});
test('headless actual execution terminates on all match lengths without illegal resources or stuck phases',()=>{
 for(const rounds of [10,14,18]) {const r=playMatch({rounds,seed:rounds,red:'easy',blue:'normal',nodeBudget:60});assert.ok(r.winner);assert.ok(r.metrics.decisions<360);assert.equal(r.metrics.timedOut,0);}
});
