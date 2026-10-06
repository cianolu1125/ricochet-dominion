// Development-only headless runner: same rules/executor/physics as the player game.
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import * as E from '../src/engine.js';
import * as P from '../src/physics.js';
import {CONFIG} from '../src/config.js';
import {searchDecision} from '../src/ai/ai-search.js';
import {executeDecision} from '../src/ai/ai-executor.js';
import {aimError} from '../src/ai/ai-rng.js';
import {MAX_TICKS} from '../src/ai/ai-config.js';
import {chargeFromRelays} from '../src/charge.js';
export function assertMatch(s) {
 for(const owner of [1,2]) {
  const towers=s.towers.filter(t=>t.owner===owner);if(towers.length>5)throw Error('Tower cap exceeded');
  if(!E.legalLanding(s,s.players[owner].pos,owner)&&!s.winner)throw Error('Illegal landing');
  if(s.players[owner].hp>s.players[owner].maxHp||s.players[owner].hp<0)throw Error('Illegal HP');
  const ids=towers.map(t=>t.id);if(new Set(ids).size!==ids.length)throw Error('Duplicate tower');
 }
 if(s.round>s.maxRounds||s.charge<0||s.charge>3)throw Error('Round/charge invariant');
 if(new Set(s.moveVisited).size!==s.moveVisited.length||s.moveVisited.length>5||s.visitedRelayTowerIds.size>5)throw Error('Relay uniqueness/cap invariant');
 if(s.phase==='MISSILE_RELAY_AIM'&&s.charge!==chargeFromRelays(s.visitedRelayTowerIds.size))throw Error('Charge/history invariant');
 for(const tower of s.towers)if(!E.activeTower(tower)&&tower.protected.length)throw Error('Protection on inactive outpost');
 for(const claim of s.claims){
  if(new Set(claim.cells).size!==claim.cells.length||!claim.cells.length||!claim.sources.length)throw Error('Pending membership invariant');
  if(claim.cells.some(i=>s.cells[i]!==claim.target||s.stability[i]!=='temporary')||claim.sources.some(id=>!s.towers.some(t=>t.id===id&&t.owner===claim.captor)))throw Error('Pending source/territory invariant');
 }
 const checked=structuredClone(s);E.recompute(checked);
 if(JSON.stringify(checked.protectedBy)!==JSON.stringify(s.protectedBy)||JSON.stringify(checked.stability)!==JSON.stringify(s.stability)||JSON.stringify(checked.claims)!==JSON.stringify(s.claims))throw Error('Derived control/connection invariant');
}
export function playMatch({red='easy',blue='normal',seed=1,rounds=10,profile='phone',equalError=false,nodeBudget,onDecision}={}) {
 const s=E.createGame(rounds,profile),sessions={1:{difficulty:red,matchSeed:seed,decisionIndex:0,segmentIndex:0},2:{difficulty:blue,matchSeed:seed,decisionIndex:0,segmentIndex:0}};
 const metrics={decisions:0,nodes:0,maxDecisionMs:0,charge1:0,charge2:0,charge3:0,overload:0,shielded:0,takeoverStart:0,takeoverComplete:0,reclaim:0,carry:0,build:0,dismantle:0,timedOut:0};
 while(!s.winner&&metrics.decisions<360) {
  if(s.phase==='HANDOFF')E.beginTurn(s);
  const owner=s.current,session=sessions[owner],start=performance.now();
  const result=searchDecision(s,{...session,nodeBudget,errorDifficulty:equalError?'normal':session.difficulty});session.strategy=result.strategy;
  const ms=performance.now()-start;metrics.maxDecisionMs=Math.max(metrics.maxDecisionMs,ms);metrics.nodes+=result.stats.nodes;metrics.timedOut+=Number(result.stats.timedOut);
  let decision=result.decision;
  if(decision.type==='launch')decision=aimError(decision,{...session,matchSeed:seed+'-'+owner,turnIndex:s.turnIndex,difficulty:equalError?'normal':session.difficulty});
  session.decisionIndex++;if(decision.type==='launch')session.segmentIndex++;
  if(!executeDecision(s,decision))throw Error('Illegal AI decision '+JSON.stringify(decision));
  if(decision.type==='build')metrics.build++;if(decision.type==='dismantle')metrics.dismantle++;
  let ticks=0;
  while(s.activeBody&&!s.winner&&ticks++<MAX_TICKS)P.stepBody(s,CONFIG.physics.step);
  if(s.activeBody&&!s.winner)throw Error('Physics tick limit');
  for(const f of s.feedbackFacts||[]) {
    if(f.type==='charge')metrics['charge'+f.charge]++;
    if(f.type in metrics)metrics[f.type]++;
  }
  s.feedbackFacts=[];metrics.decisions++;assertMatch(s);
  onDecision?.({owner,decision,metrics,state:s,ms});
 }
 if(!s.winner)throw Error('Match decision limit');
 return {red,blue,seed,rounds,profile,equalError,winner:s.winner,round:s.round,territory:E.counts(s).slice(1),hp:[s.players[1].hp,s.players[2].hp],outposts:[1,2].map(o=>s.towers.filter(t=>t.owner===o).length),metrics};
}
if(import.meta.url===pathToFileURL(process.argv[1]).href) {
 const args=process.argv.slice(2),red=args[0]||'easy',blue=args[1]||'normal',count=Number(args[2]||2),equalError=args.includes('--equal-error'),quick=args.includes('--smoke');
 const paired=args.includes('--paired'),lengths=args.includes('--lengths'),profile=args.find(a=>a.startsWith('--profile='))?.slice(10)||'phone';
 const results=[];
 for(let i=0;i<count*(paired?2:1);i++) {
  const pair=paired?Math.floor(i/2):i;
  const result=playMatch({red:i%2?blue:red,blue:i%2?red:blue,seed:100+pair,profile,rounds:quick||lengths?[10,14,18][pair%3]:10,equalError,nodeBudget:quick?80:undefined});results.push(result);console.log(JSON.stringify(result));
 }
 const output=args.find(a=>a.startsWith('--output='))?.slice(9);if(output)await writeFile(output,JSON.stringify(results,null,2)+'\n');
}
