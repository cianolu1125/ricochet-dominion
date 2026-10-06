import test from 'node:test';import assert from 'node:assert/strict';
import * as E from '../src/engine.js';
import {searchDecision} from '../src/ai/ai-search.js';
import {analyze} from '../src/ai/ai-analyze.js';
import {evaluate} from '../src/ai/ai-evaluate.js';
import {candidates} from '../src/ai/ai-candidates.js';
import {simulate} from '../src/ai/ai-simulate.js';
import {AI_CONFIG,TERMINAL} from '../src/ai/ai-config.js';
const session={difficulty:'normal',matchSeed:15,decisionIndex:0};
test('analysis/evaluation are pure and terminal outcomes dominate every feature',()=>{
 const s=E.createGame(),before=structuredClone(s);const f=analyze(s,1);assert.ok(f.territory>=0&&f.stable>=0);evaluate(s,1);assert.deepEqual(s,before);
 E.win(s,1,'hp');assert.equal(evaluate(s,1).score,TERMINAL);assert.equal(evaluate(s,2).score,-TERMINAL);
});
test('all tiers prioritize a discovered kill using the real carry and blast rules',()=>{
 for(const difficulty of ['easy','normal','hard']) {
  const s=E.createGame(10,'desktop');s.cells.fill(1);s.towers=[];s.players[1].pos={x:8,y:8};s.players[2].pos={x:11,y:8};s.players[2].hp=1;
  s.towers=[{id:1,owner:1,slot:'A',pos:{x:5,y:8},stage:2,state:'normal',protected:[]}];E.recompute(s);
  const before=structuredClone(s);const r=searchDecision(s,{...session,difficulty});assert.ok(r.stats.nodes<=AI_CONFIG[difficulty].nodes);assert.deepEqual(s,before);
  const result=simulate(s,r.decision);assert.equal(result?.winner?.player,1,difficulty+JSON.stringify(r.decision));
 }
});
test('search is seeded and has strictly bounded, distinct strategy/search capacity',()=>{
 const s=E.createGame(10,'desktop');const a=searchDecision(s,{...session,difficulty:'easy'});const b=searchDecision(s,{...session,difficulty:'easy'});assert.deepEqual(a.decision,b.decision);assert.equal(a.stats.nodes,b.stats.nodes);assert.ok(a.stats.nodes>0);
 assert.ok(AI_CONFIG.hard.nodes>AI_CONFIG.normal.nodes&&AI_CONFIG.normal.nodes>AI_CONFIG.easy.nodes);assert.ok(AI_CONFIG.hard.opponents>0&&AI_CONFIG.normal.ownLookahead>0);
 const r=simulate(s,a.decision);assert.ok(r);assert.ok(['IDLE','MOVE_RELAY_AIM','MISSILE_RELAY_AIM'].includes(r.phase)||r.winner);
});
test('held relay always has legal release and end candidates, never revisits consumed towers',()=>{
 const s=E.createGame();s.phase='MISSILE_RELAY_AIM';s.committed=true;s.actionAvailable=false;s.relay={id:1,pos:s.towers[0].pos};s.visitedRelayTowerIds.add(1);
 const cs=candidates(s,AI_CONFIG.hard);assert.ok(cs.some(c=>c.type==='end'));assert.ok(cs.some(c=>c.type==='launch'));
 const r=searchDecision(s,{...session,difficulty:'easy'});assert.ok(simulate(s,r.decision));assert.ok(r.stats.maxChain<=6);
});
test('risk sampling follows the whole relay plan and stops on actual missed capture',async()=>{
 const {samplePlan}=await import('../src/ai/ai-search.js');const s=E.createGame(10,'desktop');s.cells.fill(0);s.towers=[];s.players[1].pos={x:1,y:8};s.players[2].pos={x:30,y:8};
 const t={id:9,owner:1,slot:'A',pos:{x:4,y:8},stage:2,state:'normal',protected:[]};s.towers.push(t);E.expand(s,t);E.recompute(s);
 const plan=[{type:'launch',kind:'missile',direction:{x:1,y:0},power:.5},{type:'launch',kind:'missile',direction:{x:0,y:1},power:.3},{type:'end'}];
 let calls=0;const run=(state,d)=>{calls++;return simulate(state,d);};
 const result=samplePlan(s,plan,()=>.5,{angle:0,power:0},run);assert.equal(calls,3);assert.equal(result.current,2);assert.equal(result.phase,'IDLE');
 calls=0;const missed=samplePlan(s,plan,()=>.5,{angle:70,power:0},run);assert.ok(missed);assert.ok(calls<=2);
});
test('Hard never lets an unchecked optimistic candidate outrank assessed turn plans',()=>{
 const s=E.createGame(10,'phone');s.current=2;
 const r=searchDecision(s,{difficulty:'hard',matchSeed:100,decisionIndex:0,errorDifficulty:'normal',debug:true});
 assert.ok(r.topCandidates.length<=4);assert.ok(r.topCandidates.every(x=>Number.isFinite(x.opponentScore)));assert.ok(r.stats.opponentSamples>0);
});
test('move ranking recognizes safe new outpost space instead of treating every neutral landing as equal',()=>{
 const safe=E.createGame(10,'desktop');safe.moveAvailable=false;safe.players[1].pos={x:9,y:7};
 const crowded=structuredClone(safe);crowded.players[1].pos={...crowded.towers.find(t=>t.owner===1).pos};
 const exposed=structuredClone(safe);exposed.players[1].pos={x:26,y:8};
 assert.ok(evaluate(safe,1).score>evaluate(crowded,1).score);assert.ok(evaluate(safe,1).score>evaluate(exposed,1).score);
});
test('opponent response horizon completes the turn and includes AI next-turn outpost growth',async()=>{
 const {settleResponse}=await import('../src/ai/ai-search.js');const s=E.createGame(10,'desktop');s.players[1].pos={x:12,y:8};E.buildTower(s);const fresh=s.towers.at(-1);
 const foe=simulate(s,{type:'end'});assert.equal(foe.current,2);assert.equal(foe.towers.find(t=>t.id===fresh.id).stage,0);
 const response=settleResponse(foe,1,(state,d)=>simulate(state,d));assert.equal(response.current,1);assert.equal(response.towers.find(t=>t.id===fresh.id).stage,1);assert.equal(response.phase,'IDLE');
});
test('Hard mixed strategy retains a decisive expansion priority and switches for recovery',async()=>{
 const {strategyFor}=await import('../src/ai/ai-strategy.js');const s=E.createGame(10,'phone');const opening=strategyFor(analyze(s,1),'hard');
 assert.ok(opening.weights.expansion>.55);assert.ok(Object.keys(opening.weights).length===8);
 s.players[1].hp=1;for(const t of s.towers.filter(t=>t.owner===1))t.state='contested';E.recompute(s);
 const emergency=strategyFor(analyze(s,1),'hard',opening,2);assert.ok(emergency.weights.recovery>opening.weights.recovery);
});
test('Hard expansion values future outpost growth while avoiding late-game infrastructure overinvestment',()=>{
 const base=E.createGame(10,'desktop');base.players[1].pos={x:12,y:8};
 const built=structuredClone(base);assert.ok(E.buildTower(built));
 const strategy={weights:{expansion:1}};
 const gain=(difficulty)=>evaluate(built,1,strategy,difficulty).score-evaluate(base,1,strategy,difficulty).score;
 assert.ok(gain('hard')>gain('normal')+.1);
 base.round=10;built.round=10;
 const aged=structuredClone(built);aged.towers.at(-1).stage=2;
 assert.equal(evaluate(aged,1,strategy,'hard').score,evaluate(built,1,strategy,'hard').score,'closing score ignores maturity when area, HP and tower count are unchanged');
});
test('Hard values recoverable opening HP less than endangered HP',()=>{
 const full=E.createGame(10,'desktop'),hurt=structuredClone(full);hurt.players[2].hp--;
 const damageGain=()=>evaluate(hurt,1,{weights:{}},'hard').score-evaluate(full,1,{weights:{}},'hard').score;
 const opening=damageGain();full.players[2].hp=2;hurt.players[2].hp=1;assert.ok(damageGain()>opening*1.5);
});
test('Hard projects fresh outpost maturation without multiplying the value of already mature structures',()=>{
 const fresh=E.createGame(10,'desktop');fresh.players[1].pos={x:12,y:8};assert.ok(E.buildTower(fresh));
 const mature=structuredClone(fresh);mature.towers.at(-1).stage=2;
 const strategy={weights:{expansion:1}};
 const gap=tier=>evaluate(mature,1,strategy,tier).score-evaluate(fresh,1,strategy,tier).score;
 assert.ok(gap('hard')<=gap('normal')+.001,'future capacity belongs to fresh structures, not a multiplier on old maturity');
});
