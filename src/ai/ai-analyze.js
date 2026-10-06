import * as E from '../engine.js';
export function analyze(s,perspective) {
  const n=s.cells.length;
  const owners={};
  for(const owner of [1,2]) {
    let territory=0,stable=0,temporary=0,influence=0;
    for(let i=0;i<n;i++)if(s.cells[i]===owner){territory++;if(s.stability[i]==='stable')stable++;else temporary++;if(s.protectedBy[i]?.length)influence++;}
    const own=s.towers.filter(t=>t.owner===owner),active=own.filter(E.activeTower),foe=E.enemy(owner),p=s.players[owner];
    const strength=own.reduce((v,t)=>v+(E.activeTower(t)?1+t.stage*.35+(t.influence?.length||0)/25*.25:t.state==='contested'?.1:.3),0)/10;
    const relayPairs=active.reduce((v,t)=>v+active.filter(a=>a.id!==t.id&&Math.hypot(a.pos.x-t.pos.x,a.pos.y-t.pos.y)<18).length,0)/20;
    let pending=s.claims.reduce((v,c)=>v+(c.captor===owner?1:-1)*c.cells.length/n,0);
    // Contested structures still belong to their old owner in real state.
    // Credit the pending ownership transfer, discounted by reclaim proximity.
    for(const tower of s.towers.filter(t=>t.state==='contested'&&t.contestedBy)) {
      const defender=s.players[tower.owner].pos;
      const safety=Math.min(1,Math.hypot(defender.x-tower.pos.x,defender.y-tower.pos.y)/18);
      const value=(1+tower.stage*.35+(tower.influence?.length||0)/25*.25)/10*(.4+.6*safety);
      pending+=(tower.contestedBy===owner?1:tower.owner===owner?-1:0)*value;
    }
    const contested=own.filter(t=>t.state==='contested').length/5;
    const danger=E.isDamagingEnemyTerritory(s,owner)?1:0;
    owners[owner]={territory:territory/n,stable:stable/n,temporary:temporary/n,hp:p.hp/p.maxHp,
      outpost:strength,influence:influence/n,pending,relay:Math.min(1,relayPairs),
      safety:1-danger-.25*Math.max(0,1-Math.hypot(p.pos.x-s.players[foe].pos.x,p.pos.y-s.players[foe].pos.y)/6),
      overload:own.filter(t=>t.state==='overloaded').length/5+contested,
      contested,canReclaim:owner===s.current?E.getReclaimCandidates(s,owner).length:0};
  }
  const own=owners[perspective],foe=owners[E.enemy(perspective)];
  return {...own,owners,foe,roundsRemaining:s.maxRounds-s.round,pressure:s.round/s.maxRounds,
    victoryThreat:own.territory>=.55||foe.territory>=.55||s.players[perspective].hp<=2||s.players[E.enemy(perspective)].hp<=2};
}
