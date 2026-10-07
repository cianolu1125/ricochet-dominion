// All coordinates are presentation coordinates; no rule state is written here.
export function sigil(ctx,x,y,r,kind,phase=0){
 ctx.save();ctx.translate(x,y);ctx.rotate(phase);ctx.beginPath();
 if(kind==='coven'){
  ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();for(let n=0;n<3;n++){const a=n*Math.PI*2/3-Math.PI/2;const px=Math.cos(a)*r*.78,py=Math.sin(a)*r*.78;n?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.closePath();ctx.stroke();
  for(let n=0;n<6;n++){const a=n*Math.PI/3;ctx.beginPath();ctx.moveTo(Math.cos(a)*r*.92,Math.sin(a)*r*.92);ctx.lineTo(Math.cos(a)*r*1.09,Math.sin(a)*r*1.09);ctx.stroke()}
 }else{
  ctx.strokeRect(-r,-r,2*r,2*r);ctx.strokeRect(-r*.7,-r*.7,r*1.4,r*1.4);
  ctx.beginPath();ctx.moveTo(-r*.38,-r*.36);ctx.lineTo(r*.38,-r*.36);ctx.moveTo(0,-r*.4);ctx.lineTo(0,r*.42);ctx.moveTo(-r*.3,r*.05);ctx.lineTo(r*.3,r*.05);ctx.stroke();
 }
 ctx.restore();
}
export function protectedTile(ctx,p,theme,tile){
 ctx.lineWidth=Math.max(.025,.8/tile);
 if(theme.id==='coven'){
  ctx.setLineDash([.20,.055]);ctx.strokeRect(p.x-.35,p.y-.35,.7,.7);ctx.setLineDash([]);
  ctx.beginPath();ctx.moveTo(p.x-.055,p.y-.35);ctx.lineTo(p.x,p.y-.28);ctx.lineTo(p.x+.055,p.y-.35);ctx.stroke();
 }else{
  ctx.strokeRect(p.x-.35,p.y-.35,.7,.7);
  for(const [dx,dy] of [[-1,-1],[1,-1],[-1,1],[1,1]])ctx.strokeRect(p.x+dx*.35-.045,p.y+dy*.35-.045,.09,.09);
 }
}
export function towerCore(ctx,p,t,theme){
 const overload=t.state==='overloaded';ctx.save();ctx.translate(p.x,p.y);
 ctx.fillStyle=theme.colors.panel;ctx.fillRect(-.35,-.35,.7,.7);
 ctx.globalAlpha=overload?.55:1;ctx.strokeStyle=theme.team[t.owner];ctx.lineWidth=.048;
 if(overload)ctx.setLineDash([.16,.14]);
 ctx.strokeRect(-.33,-.33,.66,.66);ctx.setLineDash([]);
 ctx.strokeStyle=theme.colors.accent;ctx.lineWidth=.026;
 if(theme.id==='coven'){
  sigil(ctx,0,0,.23,'coven');
  for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){ctx.save();ctx.rotate(a);ctx.beginPath();ctx.moveTo(.27,-.08);ctx.lineTo(.40,0);ctx.lineTo(.27,.08);ctx.stroke();ctx.restore()}
 }else{
  sigil(ctx,0,0,.22,'tang');
  for(const [dx,dy] of [[-1,-1],[1,-1],[-1,1],[1,1]]){ctx.fillStyle=theme.team[t.owner];ctx.fillRect(dx*.33-.065,dy*.33-.065,.13,.13)}
 }
 ctx.restore();
}
export function player(ctx,p,owner,s,v,theme,dir){
 const hurt=v.effects.some(e=>e.type==='damage'&&e.owner===owner&&v.time-e.born<110);
 const healed=v.effects.find(e=>e.type==='heal'&&e.owner===owner&&v.time-e.born<500);
 ctx.save();ctx.translate(p.x,p.y);
 ctx.fillStyle=theme.colors.bg;ctx.beginPath();ctx.arc(0,0,.34,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle=hurt?theme.colors.flash:theme.team[owner];ctx.lineWidth=.065;ctx.stroke();
 ctx.fillStyle=theme.team[owner]+'33';ctx.beginPath();ctx.arc(0,0,.25,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle=theme.colors.text;ctx.lineWidth=.025;sigil(ctx,0,0,.16,theme.id);
 ctx.save();ctx.rotate(s.profile==='desktop'?(dir===1?Math.PI/2:-Math.PI/2):(dir===1?Math.PI:0));
 ctx.fillStyle=theme.team[owner];ctx.beginPath();ctx.moveTo(0,-.31);ctx.lineTo(-.07,-.17);ctx.lineTo(.07,-.17);ctx.fill();ctx.restore();
 if(owner===s.current||v.opponentFocus){ctx.strokeStyle=theme.team[owner]+'99';ctx.lineWidth=.025;ctx.beginPath();ctx.arc(0,0,.51,0,Math.PI*2);ctx.stroke();
  if(owner===s.current){ctx.strokeStyle=theme.colors.accent+'a0';for(let n=0;n<4;n++){const a=n*Math.PI/2;ctx.beginPath();ctx.arc(0,0,.56,a+.25,a+.55);ctx.stroke()}}}
 if(healed){ctx.globalAlpha=Math.max(0,1-(v.time-healed.born)/500);ctx.strokeStyle='#a1ebbd';ctx.lineWidth=.045;ctx.beginPath();ctx.arc(0,0,.42,0,Math.PI*2);ctx.stroke()}
 ctx.restore();
}
export function projectile(ctx,p,angle,charge,theme){
 ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);ctx.fillStyle=theme.colors.flash;ctx.strokeStyle=theme.colors.accent;ctx.lineWidth=.035;
 if(theme.id==='coven'){
  ctx.beginPath();ctx.arc(0,0,.12,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(0,0,.25,.16,0,0,Math.PI*2);ctx.stroke();
 }else{
  ctx.beginPath();ctx.moveTo(.24,0);ctx.lineTo(-.18,-.1);ctx.lineTo(-.09,0);ctx.lineTo(-.18,.1);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(-.12,0);ctx.lineTo(-.4,0);ctx.stroke();
 }
 if(charge===3){ctx.strokeStyle=theme.colors.accent+'a0';sigil(ctx,0,0,.32,theme.id)}ctx.restore();
}
