import test from 'node:test';
import assert from 'node:assert/strict';
import {regionEdges,regionContours} from '../src/region-outline.js';
const s={width:5,height:5};
test('outline removes shared edges and follows a concave mask exactly',()=>{
  const edges=regionEdges(s,[6,7,11,11,-1,99]);
  assert.equal(edges.length,8);
  assert.ok(!edges.some(([a,b])=>a.x===2&&b.x===2&&a.y===1&&b.y===2));
  const loops=regionContours(s,[6,7,11]);assert.equal(loops.length,1);
  assert.deepEqual(loops[0][0],loops[0].at(-1));
});
test('holes and diagonal touching islands have separate closed contours',()=>{
  const ring=[6,7,8,11,13,16,17,18];
  const loops=regionContours(s,ring);assert.equal(loops.length,2);
  for(const loop of loops)assert.deepEqual(loop[0],loop.at(-1));
  const diagonal=regionContours(s,[6,12]);assert.equal(diagonal.length,2);
  assert.ok(diagonal.every(p=>p.length===5));
});
test('edge mask perimeter remains inside the map',()=>{
  const loops=regionContours(s,[0,1,5]);assert.equal(loops.length,1);
  assert.ok(loops.flat().every(p=>p.x>=0&&p.y>=0&&p.x<=5&&p.y<=5));
});
