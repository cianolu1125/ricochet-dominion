import * as E from '../engine.js';
import * as P from '../physics.js';
import {CONFIG} from '../config.js';
import {MAX_TICKS} from './ai-config.js';
import {executeDecision} from './ai-executor.js';
export function simulate(state,decision) {
  const s=structuredClone(state);s.feedbackFacts=[];
  if(!executeDecision(s,decision))return null;
  let ticks=0;
  while(s.activeBody&&!s.winner&&ticks++<MAX_TICKS){P.stepBody(s,CONFIG.physics.step);s.feedbackFacts=[];}
  if(s.activeBody&&!s.winner)return null;
  if(s.phase==='HANDOFF')E.beginTurn(s);
  s.feedbackFacts=[];s.events=[];return s;
}
export function stateKey(s) {
  // Exact state equivalence, including timers/claims/resources and relay history.
  return JSON.stringify([s.current,s.round,s.turnIndex,s.phase,s.cells,s.stability,
    [1,2].map(o=>[s.players[o].pos,s.players[o].hp,s.players[o].turns]),
    s.towers.map(t=>[t.id,t.owner,t.pos,t.stage,t.state,t.influence,t.overloadExpiresTurn,t.contestedBy,t.contestedResolveTurn,t.activationTurn,t.skipGrowthTurn]),
    s.claims,s.moveAvailable,s.actionAvailable,s.charge,s.relay,[...s.visitedRelayTowerIds],s.moveVisited,s.committed,s.winner]);
}
