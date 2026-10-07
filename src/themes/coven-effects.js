import {sigil} from './geometry.js';
const TAU=Math.PI*2,clamp=n=>Math.max(0,Math.min(1,n));
// All marks use the existing event lifetime and primitive budget. No rule writes.
export function drawCovenEvent(ctx,e,p,q,age,theme,reduced,spend,pt){
 const color=theme.team[e.owner]||theme.team[1],bone=theme.colors.text,gold=theme.colors.accent,fade=clamp(1-q);
 const ring=(r,c=bone,a=fade,w=.026)=>{if(!spend())return;ctx.globalAlpha=clamp(a);ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();ctx.arc(p.x,p.y,Math.max(.01,r),0,TAU);ctx.stroke();};
 const seal=(r,c=gold,a=fade,phase=0,at=p)=>{if(!spend())return false;ctx.globalAlpha=clamp(a);ctx.strokeStyle=c;ctx.lineWidth=.024;sigil(ctx,at.x,at.y,Math.max(.01,r),'coven',phase);return true;};
 const cross=(r,c=gold,a=fade)=>{if(!spend())return;ctx.globalAlpha=clamp(a);ctx.strokeStyle=c;ctx.lineWidth=.022;ctx.beginPath();ctx.moveTo(p.x-r,p.y);ctx.lineTo(p.x+r,p.y);ctx.moveTo(p.x,p.y-r);ctx.lineTo(p.x,p.y+r);ctx.stroke();};
 const fragments=(n,weight=1)=>{for(let i=0;i<n&&spend();i++){const a=i/n*TAU,travel=reduced?.28:q*.8*weight;ctx.globalAlpha=fade;ctx.fillStyle=i%3?color:theme.colors.deep;ctx.save();ctx.translate(p.x+Math.cos(a)*travel,p.y+Math.sin(a)*travel+(reduced?0:q*q*.5));ctx.rotate(reduced?a:a+q*2);ctx.fillRect(-.045,-.025,.09,.05);ctx.restore();}};
 if(reduced&&['disconnect','reconnect','restore','reclaim','takeoverStart','takeoverComplete','overload','shielded'].includes(e.type)){
  seal(.38,e.type==='takeoverComplete'&&q<.35?(theme.team[e.targetOwner]||color):color,fade);return true;
 }
 if(e.type==='charge'){
  const level=Math.max(1,Math.min(3,e.charge||1)),n=reduced?[0,4,6,9][level]:[0,12,18,26][level],close=clamp((q-.1)/.76);
  for(let i=0;i<n&&spend();i++){
   const outer=level>1&&i%2===0,a=i/n*TAU+(reduced?0:close*(outer?.18:-.24));
   const r=(outer?2:1.5)*(1-close**(outer?1.7:2.4));ctx.globalAlpha=Math.sin(q*Math.PI);ctx.fillStyle=i%4===0?gold:i%3===0?color:bone;
   ctx.save();ctx.translate(p.x+Math.cos(a)*r,p.y+Math.sin(a)*r);ctx.rotate(Math.PI/4);ctx.fillRect(-.026,-.048,.052,.096);ctx.restore();
  }
  if(q>.48){seal(reduced?.28:.18+(1-close)*.9,bone,Math.sin(q*Math.PI),reduced?0:-close*.35);
   if(level>=2)cross(reduced?.5:.5*(1-close)+.25,color,Math.sin(q*Math.PI));
   if(level===3){seal(reduced?.4:.3+(1-close)*1.15,color,Math.sin(q*Math.PI),reduced?0:close*.4);ctx.globalAlpha=Math.sin(q*Math.PI);ctx.fillStyle=theme.colors.bg;ctx.beginPath();ctx.arc(p.x,p.y,.24,0,TAU);ctx.fill();ring(.24,bone,.8*fade);ctx.fillStyle=bone;ctx.beginPath();ctx.arc(p.x,p.y,.07,0,TAU);ctx.fill();}
  }return true;
 }
 if(e.type==='blast'){
  const size=(e.radius||1)*(e.charge===1?1.3:1),expand=reduced?.7:clamp(age/110),r=.18+expand*.68*size;
  if(age<70){ctx.globalAlpha=1-age/70;ctx.fillStyle=bone;ctx.beginPath();ctx.arc(p.x,p.y,.10,0,TAU);ctx.fill();}
  seal(r,bone,fade**2,reduced?0:q*.12);ring(r*.62,bone,fade*.65);ring(r*1.32,color,fade*.88,.047);
  if(age>=80&&age<250)cross(r*1.55,gold,clamp((250-age)/150)*.65);
  if(!reduced&&age>100)fragments(6,.55);return true;
 }
 if(['launch','fire','bounce','capture','carry','land'].includes(e.type)){
  if(e.type==='bounce'){const f=clamp(1-age/120);seal(reduced?.2:.13+age/120*.15,bone,f);if(!reduced)fragments(4,.35);}
  else if(e.type==='capture'){seal(reduced?.42:.8*(1-q*q)+.12,bone,fade,reduced?0:-q*.4);ring(reduced?.52:.6*(1-q)+.12,color,fade);}
  else if(e.type==='carry'){seal(.39,color,fade,reduced?0:q*.3);ring(.46,bone,fade*.5);}
  else if(e.type==='land'){ring(reduced?.38:.26+q*.45,color,fade,.037);}
  else{seal(reduced?.32:.16+q*.48,bone,fade);ring(reduced?.44:.14+q*.65,color,fade*.65);}
  return true;
 }
 if(['build','redeploy','grow','restore','reclaim','reconnect'].includes(e.type)){
  const inward=e.type==='redeploy',r=reduced?.42:inward?.72*(1-q)+.13:e.type==='grow'?.3+q*((e.stage||1)+.5):.35+.3*clamp(q/.45);
  seal(r,color,Math.sin(q*Math.PI),reduced?0:(1-q)*.20);
  if(e.type==='build'&&q<.7){ctx.globalAlpha=Math.sin(q*Math.PI);ctx.fillStyle=theme.colors.deep;const lift=reduced?0:-.12*(1-q);ctx.fillRect(p.x-.2,p.y-.2+lift,.4,.4);seal(.24,bone,fade);}
  else if(e.type==='restore'||e.type==='reclaim')ring(reduced?.5:.3+q*.5,bone,fade*.45);
  return true;
 }
 if(['destroy','siege'].includes(e.type)){
  const heavy=e.type==='siege';ring(reduced?.7:.28+q*(heavy?1.4:.9),color,fade*.65,.042);
  seal(reduced?.42:.3+q*.7,gold,fade*.55);fragments(reduced?3:heavy?14:8,heavy?1.35:1);return true;
 }
 if(['disconnect','overload'].includes(e.type)){
  ctx.setLineDash([.08,.18]);seal(reduced?.5:.4+q*.5,color,fade*.55);ctx.setLineDash([]);
  for(const i of (e.cells||[])){if(!spend())break;const at=pt({x:i%e.width+.5,y:Math.floor(i/e.width)+.5});ctx.globalAlpha=fade*.3;ctx.strokeStyle=bone;ctx.beginPath();ctx.moveTo(at.x-.2,at.y-.2);ctx.lineTo(at.x-.05,at.y);ctx.lineTo(at.x+.1,at.y+.13);ctx.stroke();}return true;
 }
 if(e.type==='convert'){
  // Shared territory transitions already raise/recolor only the real changed cells.
  const cells=e.cells||[];if(!cells.length)seal(reduced?.45:.3+q*.9,color,fade*.5);
  for(let n=0;n<cells.length;n++){const i=cells[n],delay=n*12,local=age-delay;if(local<0||local>160)continue;const at=pt({x:i%e.width+.5,y:Math.floor(i/e.width)+.5});if(!seal(.28,color,(1-local/160)*.4,0,at))break;}return true;
 }
 if(['takeoverStart','takeoverComplete'].includes(e.type)){
  const other=theme.team[e.targetOwner]||theme.team[e.owner===1?2:1];
  if(e.type==='takeoverStart'){seal(.68,color,Math.sin(q*Math.PI)*.7,reduced?0:q*.4);seal(.49,other,Math.sin(q*Math.PI)*.7,reduced?0:-q*.4);}
  else{if(q<.35){seal(.55*(1-q/.35),other,fade);fragments(reduced?2:6,.65);}else{seal(reduced?.4:.25+clamp((q-.35)/.3)*.3,color,fade);ring(.68,bone,fade*.55);}}
  return true;
 }
 if(e.type==='shielded'){seal(.35,bone,Math.sin(q*Math.PI)*.8);return true;}
 if(e.type==='cross'){
  const travel=reduced?1:Math.min(1,age/220),alpha=clamp(1-Math.max(0,age-170)/220);
  // Preserve protection first; sample all four real arms fairly in reduced motion.
  for(const i of e.shielded||[]){const at=pt({x:i%e.width+.5,y:Math.floor(i/e.width)+.5});if(!seal(.35,bone,alpha*.7,0,at))break;}
  for(const end of e.ends||[]){
   const dx=end.x-e.x,dy=end.y-e.y,d=Math.hypot(dx,dy);if(!d)continue;
   const count=reduced?Math.min(3,Math.ceil(d)):Math.floor(d*travel);
   for(let n=1;n<=count;n++){
    const distance=reduced?d*n/count:n,at=pt({x:e.x+dx*distance/d,y:e.y+dy*distance/d});
    if(!seal(.13,color,alpha*.7,0,at))break;
   }
  }return true;
 }
 return false; // Upright HP labels and common HUD/turn cues retain their semantic renderer.
}
export function drawBlackMoon(ctx,p,age,theme,reduced,blast){
 const bone=theme.colors.text,gold=theme.colors.accent,TAU=Math.PI*2;
 ctx.save();ctx.lineWidth=.025;
 if(age<blast){
  const q=clamp(age/230),r=.22+(1-q)*1.8;ctx.globalAlpha=Math.sin(q*Math.PI)*.7;ctx.strokeStyle=bone;sigil(ctx,p.x,p.y,r,'coven',-q*.3);ctx.strokeStyle=gold;sigil(ctx,p.x,p.y,r*.72,'coven',q*.3);
  ctx.globalAlpha=q*.95;ctx.fillStyle=theme.colors.bg;ctx.beginPath();ctx.arc(p.x,p.y,.26,0,TAU);ctx.fill();ctx.strokeStyle=bone;ctx.stroke();ctx.fillStyle=bone;ctx.beginPath();ctx.arc(p.x,p.y,.07,0,TAU);ctx.fill();
 }else{
  const q=(age-blast)/480;if(q<1){ctx.globalAlpha=(1-q)**2;ctx.strokeStyle=bone;sigil(ctx,p.x,p.y,reduced?.75:.5+clamp(q*2)*1.05,'coven',reduced?0:q*.13);ctx.strokeStyle=gold;sigil(ctx,p.x,p.y,reduced?.48:.32+clamp(q*2)*.7,'coven',reduced?0:-q*.15);
   ctx.fillStyle=theme.colors.bg;ctx.beginPath();ctx.arc(p.x,p.y,.24,0,TAU);ctx.fill();ctx.strokeStyle=bone;ctx.stroke();}
  const after=(age-blast-370)/160;if(after>=0&&after<1){ctx.globalAlpha=(1-after)*.18;ctx.strokeStyle=bone;ctx.beginPath();ctx.arc(p.x,p.y,reduced?1.2:1.2+after*.7,0,TAU);ctx.stroke();}
 }ctx.restore();
}
