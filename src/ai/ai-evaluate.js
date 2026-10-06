import * as E from '../engine.js';
import {analyze} from './ai-analyze.js';
import {WEIGHTS,TERMINAL} from './ai-config.js';
export function evaluate(s,perspective,strategy={weights:{}},difficulty='normal') {
  if(s.winner)return {score:s.winner.player===perspective?TERMINAL:s.winner.player? -TERMINAL:0,breakdown:{terminal:true}};
  const p=analyze(s,perspective),w={...WEIGHTS},z=strategy.weights;
  w.territory*=1+(z.expansion||0)+p.pressure**3;
  w.stable*=1+(z.network||0)+(z.disruption||0)+(z.recovery||0);
  w.hp*=1+2*(z.elimination||0)+(z.recovery||0);
  w.outpost*=1+(z.siege||0)+(z.takeover||0);
  // Project unused maturation capacity. A multiplier on present strength
  // overvalues old roots and discourages beneficial redeployment.
  const futureOutpost=owner=>{
    let bonus=0;const turns=Math.min(2,p.roundsRemaining);
    for(const tower of s.towers.filter(t=>t.owner===owner&&E.activeTower(t))) {
      let stage=tower.stage,mask=new Set(tower.influence||tower.protected);
      const initialSize=mask.size;
      for(let turn=0;turn<turns;turn++) {
        const next=new Set(mask);
        if(stage<2) {
          stage++;for(let y=tower.pos.y-stage;y<=tower.pos.y+stage;y++)for(let x=tower.pos.x-stage;x<=tower.pos.x+stage;x++){
            const pos={x,y};if(E.inside(s,pos)&&E.protectedOwner(s,E.index(s,pos))!==E.enemy(owner))next.add(E.index(s,pos));
          }
        } else for(const i of mask)for(const j of E.neighbors(s,i)) {
          const x=j%s.width,y=Math.floor(j/s.width);
          if(Math.abs(x-tower.pos.x)<=2&&Math.abs(y-tower.pos.y)<=2&&E.protectedOwner(s,j)!==E.enemy(owner))next.add(j);
        }
        mask=next;
      }
      bonus+=(.35*(stage-tower.stage)+.25*(mask.size-initialSize)/25)/10;
    }
    return bonus;
  };
  const future=difficulty==='hard'?futureOutpost(perspective)-futureOutpost(E.enemy(perspective)):0;
  // Early chip damage is recoverable by normal deployment. Preserve the full
  // HP priority near elimination and the score tiebreak at the round limit.
  if(difficulty==='hard')w.hp*=.55+.45*Math.max(p.pressure,1-p.hp,1-p.foe.hp);
  w.pending*=1+(z.takeover||0);w.overload*=1+(z.recovery||0);w.safety*=1+(z.recovery||0);
  const breakdown={};let score=0;
  const features=difficulty==='easy'?['territory','hp','outpost']:Object.keys(w);
  for(const k of features){const value=w[k]*(p[k]-p.foe[k]+(k==='outpost'?future:0));breakdown[k]=value;score+=value;}
  // Immediate threshold threats are recognized by every tier; actual wins only come from engine settlement.
  // A move has no immediate territory gain. Rank its legal deployment
  // opportunity before shortlisting second actions, so useful safe positions
  // are not discarded in favor of arbitrary first-generated neutral cells.
  if(s.current===perspective&&!s.moveAvailable&&s.actionAvailable&&s.phase==='IDLE'&&
    ['deploy','redeploy'].includes(E.outpostAction(s).kind)&&!E.outpostAction(s).reason) {
    const pos=s.players[perspective].pos,foe=s.players[E.enemy(perspective)].pos;
    let newCells=0;
    for(let y=pos.y-2;y<=pos.y+2;y++)for(let x=pos.x-2;x<=pos.x+2;x++) {
      if(!E.inside(s,{x,y}))continue;const i=E.index(s,{x,y});
      if(s.cells[i]!==perspective&&E.protectedOwner(s,i)!==E.enemy(perspective))newCells++;
    }
    const foeDistance=Math.hypot(pos.x-foe.x,pos.y-foe.y);
    const safety=Math.min(1,foeDistance/12);
    const owned=s.towers.filter(t=>t.owner===perspective&&E.activeTower(t));
    const separation=Math.min(1,Math.min(8,...owned.map(t=>Math.hypot(pos.x-t.pos.x,pos.y-t.pos.y)))/8);
    const opportunity=.07*newCells/25*safety*separation*(1-p.pressure*.65);
    breakdown.deploymentOpportunity=opportunity;score+=opportunity;
  }
  const thresholdBonus=x=>x>=.6?25:x>=.55?3:0;
  score+=thresholdBonus(p.territory)-thresholdBonus(p.foe.territory);
  // In the final two rounds, the score rule is lexicographic: one cell
  // outweighs every nonfatal HP/tower advantage. Keep kill/loss terminals
  // above this bounded utility and let response search recognize lethal risk.
  if(difficulty==='hard'&&p.roundsRemaining<=1) {
    const foe=E.enemy(perspective),hpRange=2*Math.max(s.players[1].maxHp,s.players[2].maxHp)+1;
    const counts=E.counts(s),area=counts[perspective]-counts[foe];
    const hp=s.players[perspective].hp-s.players[foe].hp;
    const towers=s.towers.filter(t=>t.owner===perspective).length-s.towers.filter(t=>t.owner===foe).length;
    score=50*(area+hp/hpRange+towers/(hpRange*11))/s.cells.length;
    breakdown.closingScore=score;
  }
  return {score,breakdown,analysis:p};
}
