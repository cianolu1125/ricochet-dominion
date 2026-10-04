const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Choose an inward-facing fan, keeping independent touch targets inside the viewport.
export function branchLayout(anchor, bounds, level = 'root', widths = [], tile = 30) {
  let best;
  const action = level === 'action';
  for (let step = 0; step < 24; step++) {
    const angle = step * Math.PI / 12;
    for (const spread of [0.9, 1.1, 1.3]) {
      const hub = action ? {x:anchor.x+Math.cos(angle)*38,y:anchor.y+Math.sin(angle)*38} : anchor;
      const specs = action
        ? [{key:'root',angle,radius:0,width:widths[0]||44}, ...['missile','tower','dismantle'].map((key,i)=>({key,angle:angle+(i-1)*spread,radius:Math.max(104,Math.min(132,tile*2)),width:widths[i+1] || 116}))]
        : ['move','action'].map((key,i)=>({key,angle:angle+(i-.5)*spread,radius:Math.max(68,Math.min(96,tile*2)),width:widths[i] || 80}));
      let score = 0;
      const nodes = specs.map(n=>{
        const raw={x:hub.x+Math.cos(n.angle)*n.radius,y:hub.y+Math.sin(n.angle)*n.radius};
        const width=n.width,height=44;
        const x=clamp(raw.x,bounds.left+width/2,bounds.right-width/2),y=clamp(raw.y,bounds.top+height/2,bounds.bottom-height/2);
        score+=Math.hypot(x-raw.x,y-raw.y);
        // Keep the vanguard visible even when a corner forces the arc to bend.
        if(Math.abs(x-anchor.x)<width/2+12 && Math.abs(y-anchor.y)<height/2+12) score+=5000;
        return {key:n.key,x,y,width,height};
      });
      for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
        const a=nodes[i],b=nodes[j];
        if(Math.abs(a.x-b.x)<(a.width+b.width)/2+4 && Math.abs(a.y-b.y)<48) score+=10000;
      }
      if(!best || score<best.score){
        const junction=action?nodes[0]:anchor;
        best={score,nodes,links:action?[{from:anchor,to:junction},...nodes.slice(1).map(to=>({from:junction,to}))]:nodes.map(to=>({from:anchor,to}))};
      }
    }
  }
  return best;
}
