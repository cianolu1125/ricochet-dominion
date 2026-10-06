import * as E from '../engine.js';
import * as P from '../physics.js';
import {CONFIG} from '../config.js';
function targets(s,kind,limit) {
  const o=P.origin(s),foe=s.players[E.enemy(s.current)].pos,list=[];
  const add=(p,value)=>{if(Math.hypot(p.x+.5-o.x,p.y+.5-o.y)>.4)list.push({x:p.x+.5,y:p.y+.5,value});};
  add(foe,20);
  for(const t of s.towers) {
    if(t.owner===s.current&&E.activeTower(t)&&!(kind==='move'?s.moveVisited.includes(t.id):s.visitedRelayTowerIds.has(t.id)))add(t.pos,18+t.stage);
    if(t.owner!==s.current) {
      add(t.pos,16);
      if(kind==='move')for(const [dx,dy]of[[t.stage,0],[-t.stage,0],[0,t.stage],[0,-t.stage]]){
        const p={x:t.pos.x+dx,y:t.pos.y+dy};if(E.inside(s,p)&&E.legalLanding(s,p,s.current))add(p,t.state==='overloaded'?19:13);
      }
    }
  }
  const spacing=kind==='move'?3:4;
  for(let y=1;y<s.height;y+=spacing)for(let x=1;x<s.width;x+=spacing) {
    const p={x,y},i=E.index(s,p),dist=Math.hypot(x+.5-o.x,y+.5-o.y);
    if(kind==='move') {
      if(!E.legalLanding(s,p,s.current)||E.protectedOwner(s,i)===E.enemy(s.current))continue;
      const adjacent=E.neighbors(s,i).filter(j=>s.cells[j]===s.current).length;
      const away=Math.min(8,...s.towers.filter(t=>t.owner===s.current).map(t=>Math.hypot(x-t.pos.x,y-t.pos.y)));
      add(p,(s.cells[i]===0?7:s.stability[i]==='temporary'?9:3)+away*.65+adjacent*.25-dist*.08);
    } else {
      const enemyCells=E.neighbors(s,i).filter(j=>s.cells[j]===E.enemy(s.current)).length;
      const cut=s.cells[i]===E.enemy(s.current)&&s.stability[i]==='stable'&&enemyCells<=2;
      add(p,(s.cells[i]===E.enemy(s.current)?9:4)+enemyCells*.7+(cut?3:0)-dist*.025);
    }
  }
  // Charge III row/column alignment through multiple enemy infrastructure targets.
  if(kind==='missile'&&s.charge===3)for(const a of s.towers.filter(t=>t.owner!==s.current))for(const b of s.towers.filter(t=>t.owner!==s.current))add({x:a.pos.x,y:b.pos.y},22);
  list.sort((a,b)=>b.value-a.value||a.y-b.y||a.x-b.x);
  const selected=[],seen=new Set();
  for(const p of list){const key=p.x+','+p.y;if(seen.has(key))continue;seen.add(key);selected.push(p);if(selected.length>=limit)break;}
  return selected;
}
export function candidates(s,cfg) {
  if(s.winner)return [];
  const out=[],seen=new Set();
  const push=d=>{const key=JSON.stringify(d);if(!seen.has(key)){seen.add(key);out.push(d);}};
  if(s.phase==='IDLE'&&s.actionAvailable) {
    const action=E.outpostAction(s);
    if(!action.reason) {
      if(action.kind==='deploy')push({type:'build'});
      else if(action.kind==='redeploy')for(const t of action.targets)push({type:'build',replacementId:t.id});
      else for(const t of action.targets) {
        if(action.kind==='takeover'&&s.towers.filter(t=>t.owner===s.current).length>=5)for(const replacement of E.getRedeployableOwnedTowers(s))push({type:'takeover',targetId:t.id,replacementId:replacement.id});
        else push({type:action.kind==='takeover'?'takeover':'reclaim',targetId:t.id});
      }
    }
    for(const t of E.nearbyTowers(s))push({type:'dismantle',targetId:t.id});
  }
  const kinds=s.phase.includes('AIM')?[s.phase.startsWith('MOVE')?'move':'missile']:s.phase==='IDLE'?['missile','move'].filter(k=>k==='move'?s.moveAvailable:s.actionAvailable):[];
  for(const kind of kinds) {
    const o=P.origin(s),r=kind==='move'?.31:.12;
    const aimed=(p,mult=1)=>{
      const dx=p.x-o.x,dy=p.y-o.y,d=Math.hypot(dx,dy);if(d<.01)return;
      const power=Math.min(1,Math.max(.08,Math.sqrt(2*CONFIG.physics.friction*(d+.07))/CONFIG.physics.maxSpeed*mult));
      push({type:'launch',kind,direction:{x:dx/d,y:dy/d},power});
    };
    const points=targets(s,kind,cfg.targets);
    for(const p of points){aimed(p);aimed(p,1.08);if(kind==='missile')aimed(p,.92);}
    for(const p of points.slice(0,Math.max(3,Math.floor(cfg.targets/2)))) {
      for(const q of [{x:2*r-p.x,y:p.y},{x:2*(s.width-r)-p.x,y:p.y},{x:p.x,y:2*r-p.y},{x:p.x,y:2*(s.height-r)-p.y}])aimed(q,1.1);
      if(cfg.bounces>1)for(const q of [{x:2*r-p.x,y:2*r-p.y},{x:2*(s.width-r)-p.x,y:2*(s.height-r)-p.y},{x:p.x+2*(s.width-2*r),y:p.y},{x:p.x,y:p.y-2*(s.height-2*r)}])aimed(q,1.22);
    }
    // Broad compass coverage retains reachable neutral moves when strategic targets are obstructed.
    for(let i=0;i<8;i++)for(const power of [.35,.65,1])push({type:'launch',kind,direction:{x:Math.cos(i*Math.PI/4),y:Math.sin(i*Math.PI/4)},power});
  }
  push({type:'end'});return out;
}
