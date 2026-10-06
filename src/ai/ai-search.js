import {AI_CONFIG,MAX_CHAIN,SEARCH_TIMEOUT_MS,TERMINAL} from './ai-config.js';
import {rng,perturb} from './ai-rng.js';
import {analyze} from './ai-analyze.js';
import {strategyFor} from './ai-strategy.js';
import {candidates} from './ai-candidates.js';
import {evaluate} from './ai-evaluate.js';
import {simulate,stateKey} from './ai-simulate.js';
function interleave(list) {
  const actions=list.filter(c=>c.type!=='launch'),move=list.filter(c=>c.kind==='move'),missile=list.filter(c=>c.kind==='missile');
  for(let i=0;i<Math.max(move.length,missile.length);i++){if(missile[i])actions.push(missile[i]);if(move[i])actions.push(move[i]);}
  return actions;
}
export function samplePlan(state,path,random,errorConfig,run) {
  let current=state;
  for(const decision of path) {
    // A missed capture accepts the actual landed state; no future segment is
    // forced onto a world in which its launch is no longer legal.
    if(current.winner||current.current!==state.current)break;
    const d=decision.type==='launch'?perturb(decision,random,errorConfig):decision;
    const next=run(current,d);if(!next)break;current=next;
  }
  return current;
}
export function settleResponse(state,owner,run) {
  if(state.winner||state.current===owner)return state;
  if(state.phase==='IDLE'||state.phase.includes('AIM'))return run(state,{type:'end'});
  return null;
}
export function searchDecision(state,session) {
  const difficulty=AI_CONFIG[session.difficulty]?session.difficulty:'normal',cfg=AI_CONFIG[difficulty],owner=state.current;
  const strategy=strategyFor(analyze(state,owner),difficulty,session.strategy,state.turnIndex);
  const random=rng('search',session.matchSeed,state.turnIndex,session.decisionIndex,difficulty),start=performance.now();
  const stats={nodes:0,maxChain:0,ownLookahead:0,opponentSamples:0,robustnessSamples:0,refinements:0,maxOpponentChain:0,timedOut:false};
  const budget=session.nodeBudget===undefined?cfg.nodes:Math.max(1,Math.min(cfg.nodes,session.nodeBudget));
  let stageLimit=budget;
  const score=s=>evaluate(s,owner,strategy,difficulty).score;
  const run=(s,d)=>{
    if(stats.nodes>=stageLimit)return null;
    if(performance.now()-start>SEARCH_TIMEOUT_MS){stats.timedOut=true;return null;}
    stats.nodes++;return simulate(s,d);
  };
  function atomic(s,config,allocation,opponent=false) {
    const sign=opponent?-1:1;
    const cap=Math.min(budget,stats.nodes+allocation),leaves=[],used=new Set();
    let beam=[{state:s,first:null,depth:0,path:[]}];
    while(beam.length&&stats.nodes<cap&&!stats.timedOut) {
      const next=[];
      for(const branch of beam) {
        const list=interleave(candidates(branch.state,config));
        // Per-branch allowance keeps early relay paths from monopolizing the layer.
        const allowance=Math.max(6,Math.floor((cap-stats.nodes)/Math.max(1,beam.length*(MAX_CHAIN-branch.depth))));
        let explored=0;
        for(const d of list) {
          if(stats.nodes>=cap||explored++>=allowance)break;
          const result=run(branch.state,d);if(!result)continue;
          const first=branch.first||d,value=score(result),depth=branch.depth+1,path=[...branch.path,d];
          if(opponent)stats.maxOpponentChain=Math.max(stats.maxOpponentChain,depth);
          else stats.maxChain=Math.max(stats.maxChain,depth);
          if(value*sign===TERMINAL)return [{state:result,decision:first,score:value,path}];
          const key=stateKey(result);if(used.has(key))continue;used.add(key);
          const relay=result.phase.includes('RELAY_AIM');
          if(relay&&depth<MAX_CHAIN) {
            // Score the legal held-chain end as well; this is an actual End Turn,
            // never an invented stop-without-spending operation.
            const ended=run(result,{type:'end'});
            if(ended)leaves.push({state:ended,decision:first,score:score(ended),path:[...path,{type:'end'}]});
            next.push({state:result,first,depth,path,rank:value*sign+result.charge*.12});
          } else if(!relay)leaves.push({state:result,decision:first,score:value,path});
        }
      }
      next.sort((a,b)=>b.rank-a.rank);beam=next.slice(0,config.beam);
    }
    return leaves.sort((a,b)=>sign*(b.score-a.score));
  }
  const initialAllocation=difficulty==='easy'?budget:Math.floor(budget*.45);
  let ranked=atomic(state,cfg,initialAllocation);
  if(!ranked.length)return {decision:{type:'end'},strategy,stats};
  if(ranked[0].score===TERMINAL)return {decision:ranked[0].decision,strategy,stats};
  const rootKey=d=>JSON.stringify(d),bestByRoot=new Map();
  for(const leaf of ranked)if(!bestByRoot.has(rootKey(leaf.decision)))bestByRoot.set(rootKey(leaf.decision),leaf);
  ranked=[...bestByRoot.values()].sort((a,b)=>b.score-a.score);
  // Local direction/power refinement happens on copied states, before execution error exists.
  if(cfg.refine) {
    for(const leaf of ranked.slice(0,4))if(leaf.decision.type==='launch') {
      const d=leaf.decision,a=Math.atan2(d.direction.y,d.direction.x);
      for(const offset of [-1.5,-.6,.6,1.5])for(const power of [d.power,Math.max(.08,d.power-.03),Math.min(1,d.power+.03)]) {
        const angle=a+offset*Math.PI/180,decision={...d,direction:{x:Math.cos(angle),y:Math.sin(angle)},power};
        const r=run(state,decision);stats.refinements++;if(!r)continue;
        if(!r.phase.includes('RELAY_AIM'))ranked.push({state:r,decision,score:score(r),path:[decision]});
      }
    }
    ranked.sort((a,b)=>b.score-a.score);
  }
  const strategic=[];
  // Preserve both action orders even when every move has zero immediate area
  // gain: its value may be the build/dismantle/reclaim it enables next.
  const firstActions=[];
  if(cfg.ownLookahead) {
    const kinds=['move','missile','discrete'];
    for(const kind of kinds) {
      const group=ranked.filter(x=>kind==='discrete'?x.decision.type!=='launch':x.decision.kind===kind);
      for(const leaf of group.slice(0,Math.max(1,Math.floor(cfg.ownLookahead/3))))firstActions.push(leaf);
    }
    for(const leaf of ranked)if(firstActions.length<cfg.ownLookahead&&!firstActions.includes(leaf))firstActions.push(leaf);
  } else firstActions.push(ranked[0]);
  for(const leaf of firstActions) {
    let value=leaf.score,final=leaf.state,path=[...leaf.path];
    if(cfg.ownLookahead&&final.current===owner&&final.phase==='IDLE'&&!final.winner&&(final.moveAvailable||final.actionAvailable)) {
      const allocation=Math.floor(budget*.27/Math.max(1,cfg.ownLookahead));
      const follow=atomic(final,{...cfg,targets:Math.min(cfg.targets,12),beam:Math.min(cfg.beam,4)},allocation);
      stats.ownLookahead++;
      if(follow.length){final=follow[0].state;value=follow[0].score;path.push(...follow[0].path);}
    }
    if(cfg.ownLookahead&&final.current===owner&&!final.winner) {
      const ended=run(final,{type:'end'});if(ended){final=ended;value=score(ended);path.push({type:'end'});}
    }
    strategic.push({...leaf,path,final,idealScore:value,score:value});
  }
  if(cfg.ownLookahead)ranked=strategic.sort((a,b)=>b.score-a.score);
  if(ranked[0]?.score===TERMINAL)return {decision:ranked[0].decision,strategy,stats};
  // Every final Hard contender must receive the same error/horizon treatment.
  // An unchecked optimistic fifth plan must never beat four assessed plans.
  if(cfg.opponents)ranked=ranked.slice(0,cfg.opponents);
  // The evaluator observes uncertain outcomes. Independent search samples cannot
  // consume, inspect or predict the execution stream's seed.
  if(cfg.robustness)for(const leaf of ranked.slice(0,4))if(leaf.decision.type==='launch') {
    let total=0,minimum=Infinity,count=0;
    for(let i=0;i<cfg.robustness;i++) {
      if(stats.nodes>=budget)break;
      const r=samplePlan(state,leaf.path||[leaf.decision],random,AI_CONFIG[session.errorDifficulty]||cfg,run);
      stats.robustnessSamples++;let value=score(r);
      if(r.phase.includes('RELAY_AIM'))value+=r.charge*.06;
      total+=value;minimum=Math.min(minimum,value);count++;
    }
    if(count) {
      // Compare change from the ideal first segment, keeping strategic follow-up
      // value rather than comparing incomplete samples to completed turns.
      const ideal=score(leaf.final||leaf.state),delta=total/count-ideal;
      leaf.score+=.55*delta+.12*Math.min(0,minimum-ideal);
    }
  }
  ranked.sort((a,b)=>b.score-a.score);
  const responseAllowance=Math.floor((budget-stats.nodes)/Math.max(1,ranked.length));
  if(cfg.opponents)for(const leaf of ranked.slice(0,cfg.opponents)) {
    if(leaf.final.winner)continue;
    stageLimit=Math.min(budget,stats.nodes+responseAllowance);
    let foeState=leaf.final;
    if(foeState.current===owner)foeState=run(foeState,{type:'end'});
    if(!foeState||foeState.current===owner)continue;
    const standPat=settleResponse(foeState,owner,run);
    if(!standPat)continue;
    let worst=score(standPat),opponentPath=[{type:'end'}];
    // Complete opponent atomic chains through their actual relay decision
    // points; then selectively finish their remaining move/action and settle.
    const replyBudget=Math.max(1,stageLimit-stats.nodes);
    const replyCfg={...AI_CONFIG.normal,targets:8,beam:3};
    const replies=atomic(foeState,replyCfg,Math.floor(replyBudget*.65),true);
    stats.opponentSamples+=replies.length;
    for(const reply of replies.slice(0,4)) {
      let r=reply.state,responsePath=[...reply.path];
      if(r.current!==owner&&!r.winner&&r.phase==='IDLE'&&(r.moveAvailable||r.actionAvailable)) {
        const follow=atomic(r,{...replyCfg,targets:6,beam:2},Math.floor(replyBudget*.30/4),true);
        stats.opponentSamples+=follow.length;
        if(follow.length){r=follow[0].state;responsePath.push(...follow[0].path);}
      }
      const complete=settleResponse(r,owner,run);
      if(complete&&score(complete)<worst){worst=score(complete);opponentPath=complete===r?responsePath:[...responsePath,{type:'end'}];}
      if(worst===-TERMINAL)break;
    }
    leaf.opponentScore=worst;leaf.opponentPath=opponentPath;
    leaf.score=(1-cfg.responseWeight)*leaf.score+cfg.responseWeight*worst;
    leaf.assessedResponse=true;
  }
  stageLimit=budget;
  if(cfg.opponents&&ranked.some(x=>x.assessedResponse))ranked=ranked.filter(x=>x.assessedResponse);
  ranked.sort((a,b)=>b.score-a.score);
  let selected=ranked[0];
  if(difficulty==='easy') {
    const good=ranked.slice(0,3).filter(x=>selected.score-x.score<.12);selected=good[Math.floor(random()*good.length)]||selected;
  } else {
    const ties=ranked.filter(x=>Math.abs(x.score-selected.score)<.002);selected=ties[Math.floor(random()*ties.length)]||selected;
  }
  return {decision:selected.decision,strategy,stats,...(session.debug ? {topCandidates:ranked.slice(0,6).map(x=>({decision:x.decision,score:x.score,immediate:score(x.state),opponentScore:x.opponentScore,opponentPath:x.opponentPath,path:x.path,idealScore:x.idealScore??score(x.final||x.state)}))} : {})};
}
