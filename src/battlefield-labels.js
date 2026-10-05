// Transform the anchor first, then constrain upright text in screen coordinates.
// Text width is measured in the renderer's tile-space font, not guessed pixels.
export function layoutBattlefieldLabel(s,p,rotation,width,font,placed=[]) {
  const cx=s.width/2,cy=s.height/2,dx=p.x-cx,dy=p.y-cy;
  const cos=Math.cos(rotation),sin=Math.sin(rotation);
  const w=Math.min(width,s.width-.6);
  const x=Math.max(.3,Math.min(s.width-w-.3,cx+dx*cos-dy*sin));
  let y=Math.max(font,Math.min(s.height-.3,cy+dx*sin+dy*cos));
  for(let n=0;n<4 && placed.some(a=>Math.abs(a.y-y)<font*1.3 && x<a.x+a.w && x+w>a.x);n++) {
    const down=y+font*1.4;
    y=down<=s.height-.3?down:Math.max(font,y-font*1.4);
  }
  return {x,y,w};
}
