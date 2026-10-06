import * as E from '../engine.js';
import * as P from '../physics.js';
// Returns legality only. Rules, resources and mutation belong exclusively to engine/physics.
export function executeDecision(s,d) {
  if(!d||s.winner)return false;
  if(d.type==='wait')return Boolean(s.activeBody);
  if(d.type==='launch') {
    if(!['move','missile'].includes(d.kind)||!d.direction||!Number.isFinite(d.direction.x)||!Number.isFinite(d.direction.y)||!Number.isFinite(d.power)||d.power<.08||d.power>1||Math.hypot(d.direction.x,d.direction.y)<.001)return false;
    if(s.phase==='IDLE'&&!E.chooseAim(s,d.kind))return false;
    if(!s.phase.includes('AIM')||s.phase.startsWith('MOVE')!==(d.kind==='move'))return false;
    return P.launch(s,d.direction,d.power);
  }
  if(d.type==='end') {
    if(s.phase.includes('AIM')&&!P.cancelAim(s))return false;
    return s.winner?true:E.endTurn(s);
  }
  if(s.phase!=='IDLE'||!s.actionAvailable)return false;
  if(d.type==='build') {
    const operation=E.outpostAction(s);
    if(!['deploy','redeploy'].includes(operation.kind)||operation.reason)return false;
    const tower=operation.kind==='redeploy'?operation.targets.find(t=>t.id===d.replacementId):null;
    if(operation.kind==='redeploy'&&!tower)return false;
    return E.buildTower(s,tower?.slot);
  }
  if(d.type==='dismantle')return E.dismantle(s,d.targetId);
  if(d.type==='takeover')return E.outpostAction(s).kind==='takeover'&&E.startTakeover(s,d.targetId,d.replacementId);
  if(d.type==='reclaim')return E.outpostAction(s).kind==='reclaim'&&E.reclaimTower(s,d.targetId);
  return false;
}
