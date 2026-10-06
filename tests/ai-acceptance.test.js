import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine.js';
import {searchDecision} from '../src/ai/ai-search.js';
import {simulate} from '../src/ai/ai-simulate.js';
import {evaluate} from '../src/ai/ai-evaluate.js';
import {AIController} from '../src/ai/ai-controller.js';
import {executeDecision} from '../src/ai/ai-executor.js';

test('every assessed Hard plan replays its full own turn to the reported ideal state value',()=>{
 const s=E.createGame(10,'phone');
 const result=searchDecision(s,{difficulty:'hard',matchSeed:100,decisionIndex:0,debug:true});
 assert.ok(result.topCandidates.some(c=>c.path?.length>=2),'include a complete two-operation turn');
 for(const candidate of result.topCandidates){
  let actual=s;
  for(const operation of candidate.path){actual=simulate(actual,operation);assert.ok(actual);}
  assert.ok(actual.current!==s.current||actual.winner,'settle the entire own turn');
  assert.equal(evaluate(actual,s.current,result.strategy,'hard').score,candidate.idealScore);
 }
});

test('Hard response search follows full relay chains rather than only two launch segments',()=>{
 const s=E.createGame(10,'desktop');s.cells.fill(0);s.towers=[];s.current=2;
 s.players[1].pos={x:1,y:9};s.players[2].pos={x:30,y:16};
 for(const [owner,x] of [[1,3],[1,5],[1,7],[1,9],[1,11],[2,23],[2,25],[2,27]]){
  const t={id:++s.nextId,owner,slot:'ABCDE'[s.towers.filter(t=>t.owner===owner).length],pos:{x,y:9},stage:2,state:'normal',protected:[]};s.towers.push(t);E.expand(s,t);
 }
 E.recompute(s);s.moveAvailable=false;s.actionAvailable=false;
 const r=searchDecision(s,{difficulty:'hard',matchSeed:3,decisionIndex:0,debug:true});
 assert.ok(r.stats.maxOpponentChain>=5,JSON.stringify(r.stats));
 assert.ok(r.topCandidates.some(c=>c.opponentPath?.length>=6),'recognize complete five-relay response');
 const threat=r.topCandidates.find(c=>c.opponentPath?.length>=6);
 let actual=simulate(s,threat.decision);for(const d of threat.opponentPath)actual=simulate(actual,d);
 assert.equal(actual.towers.filter(t=>t.owner===2).length,0,'predict removal of protected infrastructure');
});

test('Worker timeout safely ends the actual AI turn and rejects a late reply',()=>{
 const s=E.createGame(10,'desktop');s.current=2;let worker,ended=0;
 const a=new AIController({getState:()=>s,isBlocked:()=>false,workerFactory:()=>worker={postMessage(d){this.request=d;},terminate(){this.dead=true;}},execute:d=>{ended++;return executeDecision(s,d);}});
 a.start({mode:'pve',matchSeed:2});a.tick(0);a.tick(11000);
 assert.equal(s.phase,'HANDOFF');assert.equal(ended,1);assert.equal(worker.dead,true);
 worker.onmessage({data:{...worker.request,decision:{type:'build'}}});a.tick(12000);assert.equal(ended,1);
});

test('Normal values a distant uncontested takeover opportunity rather than only its current owner',()=>{
 const s=E.createGame(10,'desktop');s.cells.fill(0);s.towers=[];s.moveAvailable=false;
 s.players[1].pos={x:9,y:9};s.players[2].pos={x:29,y:9};
 const t={id:++s.nextId,owner:2,slot:'A',pos:{x:10,y:9},stage:2,state:'overloaded',protected:[],overloadExpiresTurn:2};
 s.towers.push(t);E.expand(s,t);E.recompute(s);
 const r=searchDecision(s,{difficulty:'normal',matchSeed:2,decisionIndex:0});
 assert.equal(r.decision.type,'takeover');assert.equal(r.decision.targetId,t.id);
 const taken=simulate(s,r.decision);assert.ok(taken.towers.some(t=>t.state==='contested'&&t.contestedBy===1));
});

test('every difficulty recognizes a legal 60-percent end-round win',()=>{
 for(const difficulty of ['easy','normal','hard']){
  const s=E.createGame(10,'desktop');s.current=2;s.cells.fill(2);E.recompute(s);
  s.moveAvailable=false;s.actionAvailable=false;
  const r=searchDecision(s,{difficulty,matchSeed:20,decisionIndex:0});
  assert.equal(simulate(s,r.decision).winner?.player,2);
 }
});

test('Normal search chooses reclaim, redeploy and dismantle when they provide the best real outcome',()=>{
 for(const kind of ['reclaim','redeploy','dismantle']) {
  const s=E.createGame(10,'desktop');s.cells.fill(0);s.towers=[];s.players[1].pos={x:9,y:9};s.players[2].pos={x:29,y:9};s.moveAvailable=false;
  const add=(owner,x,y,state='normal')=>{const t={id:++s.nextId,owner,slot:'ABCDE'[s.towers.filter(t=>t.owner===owner).length],pos:{x,y},stage:2,state,protected:[]};s.towers.push(t);E.expand(s,t);return t;};
  if(kind==='redeploy'){for(let i=0;i<5;i++)add(1,2+i*3,2);s.players[1].hp=2;}
  else {const t=add(kind==='reclaim'?1:2,10,9,kind==='reclaim'?'contested':'normal');if(kind==='reclaim'){t.contestedBy=2;t.contestedResolveTurn=2;}}
  E.recompute(s);const r=searchDecision(s,{difficulty:'normal',matchSeed:2,decisionIndex:0});
  assert.equal(r.decision.type,kind==='redeploy'?'build':kind);assert.ok(simulate(s,r.decision));
 }
});
