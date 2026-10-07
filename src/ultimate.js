import {currentTheme} from './themes/theme-manager.js';
import {sigil,towerCore} from './themes/geometry.js';
// Presentation-only coordinates and timing. These functions never settle game rules.
const clamp=n=>Math.max(0,Math.min(1,n));
const ease=n=>{const p=clamp(n);return p*p*(3-2*p);};
const mix=(a,b,p)=>a+(b-a)*p;
export function ultimateTiming(reduced=false) {
  return reduced ? {blast:0,purge:40,purgeDuration:240,damage:310,damageDuration:140,duration:700}
    : {blast:280,purge:300,purgeDuration:620,damage:1020,damageDuration:280,duration:1660};
}
export function waveDelay(e,p,reduced=false,damage=false) {
  const t=ultimateTiming(reduced);
  const distance=Math.max(Math.abs(p.x-e.x),Math.abs(p.y-e.y));
  const reach=Math.max(1,e.x-.5,e.width-e.x-.5,e.y-.5,e.height-e.y-.5);
  return (damage?t.damage:t.purge)+clamp(distance/reach)*(damage?t.damageDuration:t.purgeDuration);
}
export function ultimateCamera(e,time,reduced=false) {
  const identity={zoom:1,focus:null,shake:{x:0,y:0},exposure:0,dim:0};
  if(!e || reduced)return identity;
  const age=time-e.born,t=ultimateTiming();
  if(age<0||age>=t.duration)return identity;
  let zoom;
  if(age<t.blast)zoom=mix(e.entryZoom||1.35,1.68,ease(age/230));
  else if(age<460)zoom=mix(1.68,.94,ease((age-t.blast)/180));
  else if(age<1330)zoom=.94;
  else zoom=mix(.94,1,ease((age-1330)/(t.duration-1330)));
  const focusWeight=age<t.blast?1:1-ease((age-t.blast)/180);
  const center={x:e.width/2,y:e.height/2};
  const focus={x:mix(center.x,e.x,focusWeight),y:mix(center.y,e.y,focusWeight)};
  const shock=clamp(1-(age-t.blast)/160),active=age>=t.blast&&age<t.blast+160;
  return {zoom,focus,dim:age<t.blast?.22*Math.sin(clamp(age/t.blast)*Math.PI):0,
    exposure:age>=t.blast&&age<t.blast+60?.16*(1-(age-t.blast)/60):0,
    shake:active?{x:Math.sin(age*1.37)*3.8*shock*shock,y:Math.cos(age*1.71)*2.3*shock*shock}:identity.shake};
}
export class UltimateDirector {
  constructor(){this.clear();}
  clear(){this.flight=null;this.event=null;this.reduced=false;this.lastCamera=ultimateCamera(null,0);}
  startFlight(body,prediction,time) {
    this.flight={born:time,start:{x:prediction.width/2,y:prediction.height/2},target:prediction.position,duration:prediction.duration};
    this.event=null;
  }
  startImpact(event,time,reduced=false) {
    const entry=this.lastCamera;
    this.event={...event,born:time,entryZoom:entry.zoom};this.flight=null;this.reduced=reduced;
  }
  busy(time){return Boolean(this.event&&time-this.event.born<ultimateTiming(this.reduced).duration);}
  camera(time,body=null,reduced=this.reduced) {
    if(this.event)return ultimateCamera(this.event,time,reduced);
    if(!this.flight||!body||reduced)return ultimateCamera(null,time);
    const f=this.flight,age=time-f.born,progress=clamp(age/Math.max(1,f.duration));
    const follow=ease(age/550),lead=ease((progress-.60)/.32);
    const target={x:mix(body.x,f.target.x,lead),y:mix(body.y,f.target.y,lead)};
    return this.lastCamera={zoom:mix(1,1.35,follow),focus:{x:mix(f.start.x,target.x,follow),y:mix(f.start.y,target.y,follow)},
      shake:{x:0,y:0},exposure:0,dim:0};
  }
  update(time,state) {
    if(this.event&&!this.busy(time)){this.clear();return true;}
    if(this.flight&&!state.activeBody)this.flight=null;
    return false;
  }
}
// One bounded Canvas pass for core, both wave fronts and up to 50 tower fragments.
export function drawUltimate(ctx,e,time,pt,team,reduced=false,rotation=0) {
  const theme=currentTheme(),themed=theme.id!=='original';
  const age=time-e.born,t=ultimateTiming(reduced);
  if(age<0||age>=t.duration)return;
  const center=pt(e),color=team[e.owner],ring=(p,r,alpha,width,c=color)=>{
    ctx.globalAlpha=Math.max(0,alpha);ctx.strokeStyle=c;ctx.lineWidth=width;ctx.beginPath();
    ctx.arc(p.x,p.y,Math.max(.01,r),0,Math.PI*2);ctx.stroke();
  };
  ctx.save();
  if(themed&&age<t.blast){
    const q=clamp(age/230);ctx.globalAlpha=Math.sin(q*Math.PI)*.9;ctx.strokeStyle=theme.colors.accent;ctx.lineWidth=.035;
    sigil(ctx,center.x,center.y,.28+(1-q)*1.2,theme.id,theme.id==='coven'?q*.2:0);
  }
  if(age<t.blast) {
    // The last 50ms are an authored visual hit stop, never a rule delay.
    const q=clamp(age/230);
    ring(center,1.6*(1-q)+.18,.7,.04);
    for(let n=0;n<12;n++){
      const a=n*Math.PI/6+q*.3,r=(1-q)*2.1+.12;
      ctx.globalAlpha=q;ctx.fillStyle=n%3?(themed?theme.colors.flash:'#edf7ff'):color;
      ctx.fillRect(center.x+Math.cos(a)*r-.03,center.y+Math.sin(a)*r-.03,.06,.06);
    }
    ctx.globalAlpha=q;ctx.fillStyle=(themed?theme.colors.flash:'#f1f8fc');
    ctx.beginPath();ctx.arc(center.x,center.y,.08+.12*q,0,Math.PI*2);ctx.fill();
  }
  const boom=(age-t.blast)/210;
  if(boom>=0&&boom<1){
    ring(center,.2+boom*3.3,1-boom,.11,(themed?theme.colors.flash:'#f5fbff'));
    ring(center,.2+boom*2.8,(1-boom)*.8,.16);
    ctx.globalAlpha=(1-boom)*.7;ctx.fillStyle=(themed?theme.colors.flash:'#f4faff');
    ctx.beginPath();ctx.arc(center.x,center.y,.15+(1-boom)*.42,0,Math.PI*2);ctx.fill();
    if(themed){
      ctx.globalAlpha=(1-boom)*.9;ctx.lineWidth=.055;ctx.strokeStyle=theme.colors.accent;
      if(theme.id==='coven'){ctx.fillStyle=theme.colors.bg;ctx.beginPath();ctx.arc(center.x,center.y,.22+boom*.55,0,Math.PI*2);ctx.fill();sigil(ctx,center.x,center.y,.35+boom*.8,'coven');}
      else sigil(ctx,center.x,center.y,.3+boom*1.4,'tang');
    }
  }
  const drawWave=(start,duration,thin)=>{
    const q=(age-start)/duration;if(q<0||q>1.14)return;
    const reach=Math.max(e.x-.5,e.width-e.x-.5,e.y-.5,e.height-e.y-.5);
    const radius=Math.max(0,q)*reach;
    const alpha=q>1?1-(q-1)/.14:1;
    // Only the actual attack mask receives a wave; never imply a circular damage area.
    for(const i of e.attackCells){
      const p={x:i%e.width+.5,y:Math.floor(i/e.width)+.5};
      const d=Math.max(Math.abs(p.x-e.x),Math.abs(p.y-e.y)),tail=radius-d;
      if(tail<-.35||tail>(thin?.7:1.5))continue;
      const a=pt(p);ctx.globalAlpha=alpha*(1-Math.max(0,tail)/(thin?.7:1.5))*(thin?.65:.8);
      ctx.fillStyle=thin?(themed?theme.colors.flash:'#edf7ff'):color;ctx.fillRect(a.x-.46,a.y-.46,.92,.92);
      if(!thin){ctx.strokeStyle=themed?theme.colors.accent:(themed?theme.colors.flash:'#eef8ff');ctx.lineWidth=.035;
        if(themed){sigil(ctx,a.x,a.y,theme.id==='coven'?.23:.30,theme.id);}
        else ctx.strokeRect(a.x-.46,a.y-.46,.92,.92);
      }
    }
  };
  drawWave(t.purge,t.purgeDuration,false);
  drawWave(t.damage,t.damageDuration,true);
  if(!reduced)for(const i of e.brokenProtectedCells||[]) {
    const world={x:i%e.width+.5,y:Math.floor(i/e.width)+.5};
    const local=age-waveDelay(e,world,false),q=local/120;
    if(local<0||q>=1)continue;
    const p=pt(world);ctx.globalAlpha=(1-q)*.7;ctx.strokeStyle=(themed?theme.colors.flash:'#eff8ff');ctx.lineWidth=.035;
    for(const [dx,dy] of [[-1,-1],[1,1]]) {
      const r=.35+q*.15;ctx.beginPath();ctx.moveTo(p.x+dx*(r-.16),p.y+dy*r);
      ctx.lineTo(p.x+dx*r,p.y+dy*r);ctx.lineTo(p.x+dx*r,p.y+dy*(r-.16));ctx.stroke();
    }
  }
  let fragments=50;
  for(const tower of e.destroyedTowers){
    const p={x:tower.pos.x+.5,y:tower.pos.y+.5},a=pt(p),arrival=waveDelay(e,p,reduced),local=age-arrival;
    if(local<0){
      if(themed){towerCore(ctx,a,tower,theme);continue;}
      ctx.globalAlpha=1;ctx.fillStyle='#11212f';ctx.fillRect(a.x-.35,a.y-.35,.7,.7);
      ctx.strokeStyle=team[tower.owner];ctx.lineWidth=.065;ctx.strokeRect(a.x-.33,a.y-.33,.66,.66);
      ctx.fillStyle=team[tower.owner]+'77';ctx.fillRect(a.x-.13,a.y-.13,.26,.26);continue;
    }
    const q=local/(reduced?150:420);if(q>=1)continue;
    ring(a,.25+q*.8,(1-q)*.6,.04);
    for(let n=0;n<(reduced?3:8)&&fragments-->0;n++){
      const angle=n*Math.PI/4,travel=q*.85;
      ctx.globalAlpha=1-q;ctx.fillStyle=local<45?(themed?theme.colors.flash:'#f7fcff'):team[tower.owner];
      ctx.save();ctx.translate(a.x+Math.cos(angle)*travel,a.y+Math.sin(angle)*travel+q*q*.45);
      ctx.rotate(q*3+n);ctx.fillRect(-.06,-.04,.12,.08);ctx.restore();
    }
  }
  if(e.vanguardHit){
    const p={x:e.vanguardPosition.x+.5,y:e.vanguardPosition.y+.5};
    const local=age-waveDelay(e,p,reduced,true),q=local/(reduced?220:350),a=pt(p);
    if(local>=0&&q<1){
      ring(a,.35+q*.72,1-q,.06,(themed?theme.colors.flash:'#eef8ff'));
      ctx.save();ctx.translate(a.x,a.y);ctx.rotate(-rotation);
      ctx.globalAlpha=Math.min(1,local/40)*(1-q);ctx.fillStyle=(themed?theme.colors.flash:'#f5faff');ctx.font='700 .60px system-ui';
      ctx.textAlign='center';ctx.fillText('−1 HP',0,-.7-q*.65);ctx.restore();
    }
  }
  ctx.restore();
}
