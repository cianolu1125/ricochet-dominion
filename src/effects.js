import { chargeSpec, effectDuration } from './feedback.js';
// One Canvas pass, at most 80 transient particle primitives; no per-particle timers.
export function drawEffects(ctx,events,time,pt,team,reduced,rotation=0) {
  let budget=reduced?24:80;
  const ring=(x,y,r,color,alpha=1,width=.035)=>{ctx.globalAlpha=Math.max(0,alpha);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.arc(x,y,Math.max(.01,r),0,Math.PI*2);ctx.stroke();};
  const point=(x,y,r,color,alpha)=>{if(budget--<=0)return;ctx.globalAlpha=Math.max(0,alpha);ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();};
  for(const e of events) {
    const age=time-e.born,duration=e.duration||effectDuration(e),q=Math.max(0,Math.min(1,age/duration));
    if(age<0||q>=1)continue;
    const p=pt(e),color=team[e.owner]||team[1];ctx.save();
    if(e.type==='bounce') {
      for(let n=0;n<(reduced?2:3);n++) {if(budget--<=0)break;const a=n*Math.PI*2/3+Number(e.eventId?.split('-').at(-1)||0)*.8,d=.09+q*.4;ctx.globalAlpha=1-q;ctx.strokeStyle=n===0?'#edf4f8':color;ctx.lineWidth=.045;ctx.beginPath();ctx.moveTo(p.x+Math.cos(a)*d,p.y+Math.sin(a)*d);ctx.lineTo(p.x+Math.cos(a)*(d+.12*(1-q)),p.y+Math.sin(a)*(d+.12*(1-q)));ctx.stroke();}
    } else if(e.type==='charge') {
      const spec=chargeSpec(e.charge,e.maxed),fade=Math.min(1,age/(e.charge===3?60:45));
      const count=reduced?Math.min(4,spec.count):spec.count;
      for(let n=0;n<count;n++) {
        const delay=e.charge>=2&&(n%2)?38:0;
        let t=Math.max(0,Math.min(1,(age-45-delay)/(duration-110-delay)));
        if(e.releasingAt!==undefined)t=Math.max(t,Math.min(1,(time-e.releasingAt)/80));
        const a=n/count*Math.PI*2+.23*Math.sin(n*7)+.18*t, radius=spec.radius*(spec.layers>1 && n%2?.72:1)*(1-t*t);
        point(p.x+Math.cos(a)*radius,p.y+Math.sin(a)*radius,.036+(e.charge||1)*.007,color,fade*(1-t*.7));
      }
      const close=Math.max(0,(q-.58)/.42);
      if(close>0)for(let n=0;n<spec.layers;n++)ring(p.x,p.y,(.65+n*.2)*(1-close)+.12,color,Math.sin(close*Math.PI),.035);
      if(q>.78) {point(p.x,p.y,.08+(e.charge||1)*.025,'#eff8ff',Math.sin((q-.78)/.22*Math.PI));ring(p.x,p.y,.22+(q-.78)*1.8,color,(1-q)/.22,.045);}
    } else if(e.type==='damage') {
      if(age<210)ring(p.x,p.y,.34+age/210*.38,color,1-age/210,.05);
      ctx.translate(p.x,p.y);ctx.rotate(-rotation);ctx.globalAlpha=1-q;ctx.fillStyle='#fff0ef';ctx.font='700 .46px system-ui';ctx.textAlign='center';
      const direction=e.drift||.3;
      ctx.fillText('−1 HP',reduced?.6:direction*.3+direction*q,reduced?-.65:-.35-1.9*q+1.5*q*q);
    } else if(e.type==='destroy'||e.type==='siege') {
      const siege=e.type==='siege',hold=60;
      const target=team[e.targetOwner||e.owner]||color;
      if(age<hold) {
        ctx.globalAlpha=.75;ctx.fillStyle='#eef5fa';ctx.fillRect(p.x-.34,p.y-.34,.68,.68);ctx.strokeStyle=target;ctx.lineWidth=.04;
        ctx.beginPath();ctx.moveTo(p.x-.3,p.y-.1);ctx.lineTo(p.x,p.y+.06);ctx.lineTo(p.x+.18,p.y-.3);ctx.moveTo(p.x+.04,p.y+.08);ctx.lineTo(p.x+.2,p.y+.3);ctx.stroke();
      }else {
        const t=(age-hold)/(duration-hold),count=reduced?3:8;
        for(let n=0;n<count;n++) {
          if(budget--<=0)break;const a=n/count*Math.PI*2+.4,dx=Math.cos(a)*t*(siege?1.3:.95),dy=Math.sin(a)*t*.65+1.5*t*t-.5*t;
          ctx.save();ctx.translate(p.x+dx,p.y+dy);ctx.rotate(t*(n%2?3:-2));ctx.globalAlpha=1-t;ctx.fillStyle=target;
          if(n%3===0){ctx.beginPath();ctx.moveTo(-.07,.07);ctx.lineTo(.09,.04);ctx.lineTo(0,-.09);ctx.fill();}else ctx.fillRect(-.07,-.07,.14,.14);ctx.restore();
        }
        if(siege&&age<300)ring(p.x,p.y,.3+(age-hold)/240*2,color,1-(age-hold)/240,.065);
      }
    } else if(e.type==='blast') {
      if(age<65)point(p.x,p.y,.16,'#f1f6fa',1-age/65);
      ring(p.x,p.y,.22+Math.min(1,q*1.5)*(e.radius||1)*1.15,color,(1-q)**2,.055);
    } else if(e.type==='build'||e.type==='redeploy') {
      const inward=e.type==='redeploy',r=inward?.4*(1-q):.85-.48*Math.min(1,q/.7);
      ctx.strokeStyle=color;ctx.lineWidth=.045;ctx.globalAlpha=Math.sin(q*Math.PI);
      for(const [dx,dy] of [[-1,-1],[1,-1],[-1,1],[1,1]]){ctx.beginPath();ctx.moveTo(p.x+dx*r,p.y+dy*(r-.15));ctx.lineTo(p.x+dx*r,p.y+dy*r);ctx.lineTo(p.x+dx*(r-.15),p.y+dy*r);ctx.stroke();}
      if(!inward&&q>.65)point(p.x,p.y,.14,color,Math.sin((q-.65)/.35*Math.PI));
    } else if(e.type==='capture')ring(p.x,p.y,.8*(1-q)+.15,color,1-q,.04);
    else if(e.type==='carry'){ctx.globalAlpha=1-q;ctx.strokeStyle=color;ctx.lineWidth=.06;ctx.beginPath();ctx.arc(p.x,p.y,.42+q*.2,-.8,1.4);ctx.stroke();}
    else if(e.type==='grow'){ring(p.x,p.y,.3+q*.65,color,(1-q)*.7,.04);}
    else if(e.type==='fire'||e.type==='launch'||e.type==='land') {
      const layers=e.type==='fire'&&e.charge>=2?2:1;
      for(let n=0;n<layers;n++)ring(p.x,p.y,.25+q*(e.type==='launch'?.35:.5)+n*.12,color,(1-q)*(e.type==='land'?.35:.8),.035);
    }
    ctx.restore();
  }
  ctx.globalAlpha=1;
}
