import { CONFIG } from './config.js';
import { fact } from './feedback-events.js';
import * as E from './engine.js';

export const activeTower = t => !t.state || t.state === 'normal';
const inRange = (t,p) => Math.abs(t.pos.x-p.x)<=t.stage && Math.abs(t.pos.y-p.y)<=t.stage;
const owned = (s,owner) => s.towers.filter(t=>t.owner===owner);
const reserved = (s,owner) => s.towers.filter(t=>t.state==='contested' && t.contestedBy===owner).length;
export function getRedeployableOwnedTowers(s,owner=s.current) {
  return owned(s,owner).filter(activeTower);
}
export function hasExternalFriendlyProtection(s,tower) {
  const i=E.index(s,tower.pos);
  return s.cells[i]===tower.owner && s.towers.some(t=>
    t.id!==tower.id && t.owner===tower.owner && activeTower(t) && inRange(t,tower.pos));
}
export function applyRelayOverload(s,tower) {
  if(s.winner || !s.towers.includes(tower) || tower.owner!==s.current || !activeTower(tower)) return false;
  const source=s.towers.find(t=>t.id!==tower.id && t.owner===tower.owner && activeTower(t) && t.protected.includes(E.index(s,tower.pos)));
  const meta={owner:tower.owner,towerId:tower.id,x:tower.pos.x+.5,y:tower.pos.y+.5};
  if(hasExternalFriendlyProtection(s,tower)) {
    s.relayFeedback={type:"shielded",towerId:tower.id,turn:s.turnIndex,count:s.visitedRelayTowerIds.size};
    fact(s,{type:'shielded',...meta,source:source ? {x:source.pos.x+.5,y:source.pos.y+.5}:null});
    return false;
  }
  tower.state='overloaded';
  tower.overloadStartedTurn=s.turnIndex;
  tower.overloadExpiresTurn=s.turnIndex+2;
  E.recompute(s);
  s.relayFeedback={type:'overload',towerId:tower.id,turn:s.turnIndex,count:s.visitedRelayTowerIds.size};
  fact(s,{type:'overload',...meta});
  return true;
}
export function recoverExpiredOverloads(s,owner) {
  for(const t of owned(s,owner)) if(t.state==='overloaded' && t.overloadExpiresTurn<=s.turnIndex) {
    t.state='normal';
    delete t.overloadExpiresTurn;
    fact(s,{type:'restore',owner,towerId:t.id,stage:t.stage,x:t.pos.x+.5,y:t.pos.y+.5});
  }
  E.recompute(s);
}
function usablePosition(s,owner) {
  const p=s.players[owner].pos;
  return E.legalLanding(s,p,owner) && E.protectedOwner(s,E.index(s,p))!==E.enemy(owner);
}
export function getTakeoverCandidates(s,owner=s.current) {
  if(s.winner || owner!==s.current || s.phase!=='IDLE' || !s.actionAvailable || !usablePosition(s,owner))return [];
  const p=s.players[owner].pos;
  return s.towers.filter(t=>t.owner!==owner && t.state==='overloaded' && t.stage>0 &&
    t.overloadExpiresTurn>s.turnIndex && inRange(t,p) && !hasExternalFriendlyProtection(s,t));
}
export function getReclaimCandidates(s,owner=s.current) {
  if(s.winner || owner!==s.current || s.phase!=='IDLE' || !s.actionAvailable || !usablePosition(s,owner))return [];
  return owned(s,owner).filter(t=>t.state==='contested' && inRange(t,s.players[owner].pos));
}
export function outpostAction(s) {
  const reclaim=getReclaimCandidates(s);
  if(reclaim.length)return {kind:'reclaim',targets:reclaim,reason:''};
  const takeover=getTakeoverCandidates(s);
  if(takeover.length)return {kind:'takeover',targets:takeover,reason:''};
  const reason=E.towerReason(s);
  const replace=owned(s,s.current).length+reserved(s,s.current)>=CONFIG.maxTowers;
  return {kind:replace?'redeploy':'deploy',targets:getRedeployableOwnedTowers(s),
    reason:reason || (replace && !getRedeployableOwnedTowers(s).length ? 'No replaceable outpost' : '')};
}
function terminal(s) {
  s.terminalActionCommitted=true;
  s.actionAvailable=false;
  s.moveAvailable=false;
  E.endTurn(s);
}
export function startTakeover(s,id,replacementId=null) {
  const t=getTakeoverCandidates(s).find(t=>t.id===id);
  if(!t)return false;
  const owner=s.current, full=owned(s,owner).length+reserved(s,owner)>=CONFIG.maxTowers;
  const replacement=full ? getRedeployableOwnedTowers(s,owner).find(t=>t.id===replacementId):null;
  if(full && !replacement)return false;
  // All guards precede the single commit: no preview or cancellation mutates rules.
  if(replacement)s.towers=s.towers.filter(a=>a.id!==replacement.id);
  t.state='contested';
  t.contestedBy=owner;
  t.contestedStartedTurn=s.turnIndex;
  t.contestedResolveTurn=s.turnIndex+2;
  E.recompute(s);
  fact(s,{type:'takeoverStart',owner,targetOwner:t.owner,towerId:t.id,x:t.pos.x+.5,y:t.pos.y+.5});
  E.log(s,'据点接管中');
  terminal(s);
  return true;
}
export function reclaimTower(s,id) {
  const t=getReclaimCandidates(s).find(t=>t.id===id);
  if(!t)return false;
  t.state='normal';
  delete t.contestedBy;
  delete t.contestedResolveTurn;
  delete t.overloadExpiresTurn;
  E.recompute(s);
  fact(s,{type:'reclaim',owner:t.owner,towerId:t.id,stage:t.stage,x:t.pos.x+.5,y:t.pos.y+.5});
  E.log(s,'据点已收复');
  terminal(s);
  return true;
}
function unstableRegions(s,target) {
  const seen=new Set(),regions=[];
  for(let i=0;i<s.cells.length;i++) {
    if(seen.has(i)||s.cells[i]!==target||s.stability[i]!=='temporary')continue;
    const cells=[i];seen.add(i);
    for(let n=0;n<cells.length;n++)for(const j of E.neighbors(s,cells[n]))
      if(!seen.has(j)&&s.cells[j]===target&&s.stability[j]==='temporary'){seen.add(j);cells.push(j);}
    regions.push(cells);
  }
  return regions;
}
export function resolveDueTakeovers(s,owner) {
  const due=s.towers.filter(t=>t.state==='contested' && t.contestedBy===owner && t.contestedResolveTurn<=s.turnIndex);
  for(const t of due) {
    // Match invariants reserve a slot at start; retain the contest if corrupted capacity would exceed five.
    if(owned(s,owner).length>=CONFIG.maxTowers)continue;
    const target=t.owner, center=E.index(s,t.pos);
    // These are seed coordinates only. Pending membership is created from the NEW map below.
    const insertionSeeds=s.cells[center]===target && s.stability[center]==='temporary'
      ? new Set(E.component(s,center)):new Set();
    t.owner=owner;t.state='normal';t.activationTurn=s.turnIndex;
    t.slot='ABCDE'.split('').find(slot=>!s.towers.some(a=>a.id!==t.id&&a.owner===owner&&a.slot===slot));
    delete t.contestedBy;delete t.contestedResolveTurn;delete t.overloadExpiresTurn;
    E.recompute(s);
    E.expand(s,t);
    E.recompute(s);
    const regions=unstableRegions(s,target).filter(cells=>cells.some(i=>insertionSeeds.has(i)));
    for(const cells of regions)s.claims.push({id:++s.nextId,captor:owner,target,cells,sources:[t.id],
      createdTurn:s.turnIndex,dueTurn:s.turnIndex+2});
    E.recompute(s);
    fact(s,{type:'takeoverComplete',owner,targetOwner:target,towerId:t.id,stage:t.stage,x:t.pos.x+.5,y:t.pos.y+.5});
    E.log(s,'据点接管完成');
  }
}
