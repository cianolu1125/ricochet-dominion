// Exposed, clockwise grid edges from the authoritative cell mask. Shared
// edges are omitted, including in concave shapes and masks containing holes.
export function regionEdges(s,cells) {
  const mask=new Set(cells.filter(i=>Number.isInteger(i)&&i>=0&&i<s.width*s.height));
  const edges=[];
  for(const i of mask) {
    const x=i%s.width,y=Math.floor(i/s.width);
    if(y===0||!mask.has(i-s.width))edges.push([{x,y},{x:x+1,y}]);
    if(x===s.width-1||!mask.has(i+1))edges.push([{x:x+1,y},{x:x+1,y:y+1}]);
    if(y===s.height-1||!mask.has(i+s.width))edges.push([{x:x+1,y:y+1},{x,y:y+1}]);
    if(x===0||!mask.has(i-1))edges.push([{x,y:y+1},{x,y}]);
  }
  return edges;
}
export function regionContours(s,cells) {
  const edges=regionEdges(s,cells),remaining=new Set(edges.map((_,i)=>i)),outgoing=new Map();
  const key=p=>p.x+','+p.y;
  edges.forEach(([a],i)=>{const k=key(a);if(!outgoing.has(k))outgoing.set(k,[]);outgoing.get(k).push(i);});
  const loops=[];
  while(remaining.size) {
    let i=remaining.values().next().value;
    const start=edges[i][0],points=[start];
    while(remaining.has(i)) {
      remaining.delete(i);
      const [a,b]=edges[i];points.push(b);
      if(key(b)===key(start))break;
      const next=(outgoing.get(key(b))||[]).filter(n=>remaining.has(n));
      // At a diagonal touch choose the right turn so the two contours stay separate.
      next.sort((n,m)=>{
        const rank=j=>{const c=edges[j][1],dx=b.x-a.x,dy=b.y-a.y;
          return dx*(c.y-b.y)-dy*(c.x-b.x)>0?0:1;};
        return rank(n)-rank(m);
      });
      if(!next.length)break;i=next[0];
    }
    loops.push(points);
  }
  return loops;
}
