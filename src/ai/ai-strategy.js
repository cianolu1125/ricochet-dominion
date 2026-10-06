export function strategyFor(position,difficulty,previous=null,turnIndex=0) {
  const p=position;
  const raw={expansion:Math.max(.05,.65-p.territory),network:.15+p.temporary,
    disruption:.15+p.foe.stable,siege:.1+p.foe.influence,
    elimination:.12+(1-p.foe.hp)*.5,recovery:.1+(1-p.hp)*.4+p.overload+p.contested,
    takeover:.1+p.foe.overload,endgame:p.pressure**3*.7};
  const entries=Object.entries(raw).sort((a,b)=>b[1]-a[1]);
  if(difficulty==='easy') {
    if(previous&&!p.victoryThreat&&turnIndex-previous.changedAt<4)return previous;
    return {weights:{[entries[0][0]]:1},changedAt:turnIndex};
  }
  const selected=difficulty==='normal'?entries.slice(0,2):entries;
  // Concentrate the blend around the real primary need; a flat eight-way
  // mixture otherwise dilutes expansion/recovery into indecisive behavior.
  const weighted=selected.map(([k,v])=>[k,difficulty==='hard'?v*v:v]);
  const sum=weighted.reduce((a,b)=>a+b[1],0);
  const weights=Object.fromEntries(weighted.map(([k,v])=>[k,v/sum]));
  if(previous&&difficulty==='hard')for(const k of Object.keys(weights))weights[k]=weights[k]*.9+(previous.weights[k]||0)*.1;
  return {weights,changedAt:turnIndex};
}
