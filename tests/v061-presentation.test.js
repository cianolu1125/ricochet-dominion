import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine.js';
import {render} from '../src/renderer.js';
import {snapshot,visualChanges} from '../src/visual-changes.js';
import {drainFacts} from '../src/feedback-events.js';
import {drawEffects} from '../src/effects.js';
import {layoutBattlefieldLabel} from '../src/battlefield-labels.js';

function context() {
  const calls=[],ctx=new Proxy({},{
    get:(o,k)=> typeof o[k]==='function'?o[k]: (...a)=>{calls.push([k,...a]);return {addColorStop(){}};},
    set:(o,k,v)=>{calls.push(['set',k,v]);o[k]=v;return true;}
  });
  return {calls,ctx,canvas:{width:390,clientWidth:390,clientHeight:694,getContext:()=>ctx}};
}
const view=(extra={})=>({owner:1,time:1000,effects:[],transitions:new Map(),reduced:false,labels:{overload:'过载'},contestedLabel:'争夺中',...extra});
function arena() {const s=E.createGame();s.cells.fill(0);s.towers=[];E.recompute(s);return s;}
function tower(s,owner,x,y,stage=2){const t={id:++s.nextId,owner,pos:{x,y},stage,state:'normal',protected:[],slot:'A'};s.towers.push(t);E.expand(s,t);E.recompute(s);return t;}
test('base tiles have no gradient or time-dependent drawing',()=>{
  const s=arena();s.cells[100]=1;s.cells[101]=2;tower(s,1,8,12);E.recompute(s);
  const a=context(),b=context();render(a.canvas,s,view({time:0}));render(b.canvas,s,view({time:3500}));
  assert.ok(!a.calls.some(c=>String(c[0]).includes('Gradient')));
  assert.deepEqual(a.calls,b.calls);
  assert.ok(a.calls.some(c=>c[0]==='set'&&c[1]==='strokeStyle'&&c[2]==='#05080ba6'));
  assert.ok(a.calls.some(c=>c[0]==='strokeRect'&&Math.abs(c[3]-.70)<.001));
});
test('available relay uses two opposite slow arcs, reduced mode freezes them',()=>{
  const s=arena();tower(s,1,8,12);E.chooseAim(s,'move');
  const a=context(),b=context();render(a.canvas,s,view({time:0}));render(b.canvas,s,view({time:1200}));
  const arcs=x=>x.calls.filter(c=>c[0]==='arc'&&[.57,.69].includes(c[3]));
  assert.equal(arcs(a).length,2);assert.ok(arcs(b)[0][4]>arcs(a)[0][4]);assert.ok(arcs(b)[1][4]<arcs(a)[1][4]);
  const c=context(),d=context();render(c.canvas,s,view({time:0,reduced:true}));render(d.canvas,s,view({time:3000,reduced:true}));
  assert.deepEqual(c.calls,d.calls);
});
test('overload and contested show permanent plain readable labels and masked range',()=>{
  const s=arena(),a=tower(s,1,8,12),b=tower(s,2,12,20,1);
  a.state='overloaded';a.overloadExpiresTurn=2;a.influence=a.influence.filter(i=>i%s.width<10);
  b.state='contested';b.contestedBy=1;E.recompute(s);
  const c=context();render(c.canvas,s,view({rotation:Math.PI,owner:2}));
  assert.ok(c.calls.some(x=>x[0]==='fillText'&&x[1]==='过载'));
  assert.ok(c.calls.some(x=>x[0]==='fillText'&&x[1]==='争夺中'));
  assert.ok(c.calls.some(x=>x[0]==='rotate'&&x[1]===-Math.PI));
  assert.ok(c.calls.some(x=>x[0]==='setLineDash'&&x[1].length));
});
test('mature frontier growth emits a real cell outline event and tile wave',()=>{
  const s=arena(),t=tower(s,1,8,12);t.influence=[E.index(s,t.pos)];s.cells.fill(0);s.cells[E.index(s,t.pos)]=1;E.recompute(s);
  const before=snapshot(s),tr=new Map();E.growTowers(s,1);
  const events=visualChanges(s,before,drainFacts(s),1000,false,tr),grown=events.find(e=>e.type==='grow');
  assert.ok(grown);assert.equal(grown.cells.length,4);assert.equal(grown.width,s.width);
  assert.ok([...tr.values()].some(t=>t.wave&&t.delay>=100));
  const c=context();drawEffects(c.ctx,[{...grown,born:0}],60,p=>p,{1:'red',2:'blue'});
  assert.ok(c.calls.some(x=>x[0]==='lineTo'));
});
test('edge status text stays inside screen bounds through both handoff directions',()=>{
  const s={width:18,height:32};
  for(const angle of [0,.4,Math.PI/2,Math.PI-.01,Math.PI])
    for(const p of [{x:1.15,y:1.36},{x:17.8,y:31.8},{x:.1,y:31.7},{x:17.9,y:.2}]) {
      const q=layoutBattlefieldLabel(s,p,angle,4,.5,[]);
      assert.ok(q.x>=.3 && q.x+4<=17.7);
      assert.ok(q.y>=.5 && q.y<=31.7);
    }
});
