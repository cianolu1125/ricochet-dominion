import {sigil} from './geometry.js';
// A shared primitive budget is passed by the existing feedback renderer.
// True means this skin completely authored the event, false uses shared semantic feedback.
export function drawThemeEvent(ctx,e,p,q,age,theme,reduced,spend,pt){
 const kind=theme.id,color=theme.team[e.owner]||theme.team[1],accent=theme.colors.accent;
 const mark=(x,y,r,alpha=1,phase=0)=>{ctx.globalAlpha=Math.max(0,alpha);ctx.strokeStyle=accent;ctx.lineWidth=.027;sigil(ctx,x,y,r,kind,phase)};
 const line=(a,b,c=color,alpha=1,width=.04)=>{ctx.globalAlpha=alpha;ctx.strokeStyle=c;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()};
 if(reduced&&['overload','shielded','takeoverStart','takeoverComplete','reclaim','restore','disconnect','reconnect'].includes(e.type)){ctx.globalAlpha=1-q;ctx.strokeStyle=e.type==='takeoverComplete'&&q<.35?(theme.team[e.targetOwner]||color):color;ctx.lineWidth=.035;sigil(ctx,p.x,p.y,.38,kind);return true;}
 if(e.type==='charge'){
  const level=e.charge||1,n=reduced?4:[0,6,12,18][level],close=Math.max(0,(q-.12)/.78);
  if(level===3&&q>.58){ctx.globalAlpha=Math.sin((q-.58)/.42*Math.PI)*.7;ctx.fillStyle=theme.colors.bg;ctx.beginPath();ctx.arc(p.x,p.y,.36,0,Math.PI*2);ctx.fill()}
  for(let i=0;i<n&&spend();i++){
   const a=i/n*Math.PI*2+(kind==='coven'?.2*close:0),r=(.85+level*.25)*(1-close*close)*(i%2&&level>1?.7:1);
   const x=p.x+Math.cos(a)*r,y=p.y+Math.sin(a)*r;ctx.globalAlpha=Math.sin(q*Math.PI);ctx.fillStyle=i%3?color:accent;
   ctx.save();ctx.translate(x,y);ctx.rotate(kind==='coven'?Math.PI/4:a);ctx.fillRect(-.035,-.065,.07,.13);ctx.restore();
  }
  if(q>.48)mark(p.x,p.y,.16+(1-close)*.7,Math.sin((q-.48)/.52*Math.PI),kind==='coven'&&!reduced?close*.3:0);
  if(level>=2&&q>.6){line({x:p.x-.55,y:p.y},{x:p.x+.55,y:p.y},color,(1-q)*2,.022);line({x:p.x,y:p.y-.55},{x:p.x,y:p.y+.55},color,(1-q)*2,.022)}
  if(q>.8){ctx.globalAlpha=(1-q)*5;ctx.fillStyle=theme.colors.flash;ctx.beginPath();ctx.arc(p.x,p.y,.10,0,Math.PI*2);ctx.fill()}
  return true;
 }
 if(['build','redeploy','grow','restore','reclaim','reconnect'].includes(e.type)){
  const inward=e.type==='redeploy',r=reduced?.42:inward?.7*(1-q)+.12:.85-.5*Math.min(1,q/.55);
  if(kind==='coven')mark(p.x,p.y,r,Math.sin(q*Math.PI),reduced?0:(1-q)*.45);
  else{
   const fall=reduced?0:-.24*(1-Math.min(1,q/.38));mark(p.x,p.y+fall,r,Math.sin(q*Math.PI));
   if(q>.35){const sweep=(q-.35)/.65;ctx.strokeStyle=color;ctx.globalAlpha=(1-sweep)*.55;ctx.lineWidth=.028;ctx.strokeRect(p.x-.4-sweep*.5,p.y-.4-sweep*.5,.8+sweep,.8+sweep)}
  }
  return true;
 }
 if(e.type==='blast'){
  const r=.18+Math.min(1,q*1.8)*(e.radius||1)*1.1;
  mark(p.x,p.y,r,(1-q)**2,kind==='coven'&&!reduced?q*.2:0);
  if(kind==='coven'&&q<.45){ctx.globalAlpha=(1-q/.45)*.8;ctx.fillStyle=theme.colors.bg;ctx.beginPath();ctx.arc(p.x,p.y,.24+.2*q,0,Math.PI*2);ctx.fill()}
  if(age<65){ctx.globalAlpha=1-age/65;ctx.fillStyle=theme.colors.flash;ctx.fillRect(p.x-.07,p.y-.07,.14,.14)}
  return true;
 }
 if(e.type==='cross'){
  const travel=Math.min(1,age/220),alpha=Math.max(0,1-Math.max(0,age-170)/220);
  for(const end of e.ends||[]){
   const dx=end.x-e.x,dy=end.y-e.y,d=Math.hypot(dx,dy),steps=Math.floor(d*travel);
   if(kind==='tang')line(p,pt({x:e.x+dx*travel,y:e.y+dy*travel}),accent,alpha*.8,.035);
   for(let n=1;n<=steps;n++){if(!spend())break;const at=pt({x:e.x+dx*n/d,y:e.y+dy*n/d});mark(at.x,at.y,kind==='coven'?.13:.10,alpha*.65)}
  }
  for(const i of e.shielded||[]){const at=pt({x:i%e.width+.5,y:Math.floor(i/e.width)+.5});ctx.strokeStyle=theme.colors.flash;ctx.globalAlpha=alpha*.6;ctx.lineWidth=.04;ctx.strokeRect(at.x-.35,at.y-.35,.7,.7)}
  return true;
 }
 if(e.type==='capture'){
  mark(p.x,p.y,reduced?.48:.8*(1-q)+.15,1-q,kind==='coven'&&!reduced?q*.5:0);return true;
 }
 if(['disconnect','overload'].includes(e.type)){
  ctx.setLineDash(kind==='coven'?[.09,.19]:[.20,.13]);mark(p.x,p.y,reduced?.52:.42+q*.7,(1-q)*.6);ctx.setLineDash([]);return true;
 }
 if(['takeoverStart','takeoverComplete'].includes(e.type)){
  const old=theme.team[e.targetOwner]||theme.team[e.owner===1?2:1];
  ctx.globalAlpha=Math.sin(q*Math.PI)*.75;ctx.lineWidth=.033;
  if(e.type==='takeoverStart'){
   for(const [c,r,dir] of [[old,.55,1],[color,.7,-1]]){ctx.strokeStyle=c;sigil(ctx,p.x,p.y,r,kind,reduced?0:dir*q*.5)}
  }else{
   ctx.strokeStyle=q<.32?old:color;sigil(ctx,p.x,p.y,q<.32?.5*(1-q/.32):.25+.5*(q-.32),kind,0);
   if(q>.32&&q<.65)mark(p.x,p.y,.42,Math.sin((q-.32)/.33*Math.PI));
  }return true;
 }
 if(e.type==='shielded'){
  ctx.strokeStyle=theme.colors.flash;ctx.lineWidth=.04;ctx.globalAlpha=Math.sin(q*Math.PI)*.8;sigil(ctx,p.x,p.y,.38,kind);return true;
 }
 return false;
}
