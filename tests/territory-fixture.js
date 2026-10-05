import * as E from '../src/engine.js';
// Real off-trajectory roots connect damage tiles without adding obstacles on the flight row.
export function stabilize(s, owner, points) {
 for (const p of points) {
  const y=p.y+1;
  for(let x=0;x<=p.x;x++)s.cells[E.index(s,{x,y})]=owner;
  s.towers.push({id:++s.nextId,owner,pos:{x:0,y},stage:0,protected:[]});
 }
 E.recompute(s);
}
