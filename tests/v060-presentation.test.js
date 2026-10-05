import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine.js';
import {snapshot,visualChanges} from '../src/visual-changes.js';
import {FeedbackDirector,effectDuration} from '../src/feedback.js';
import {drainFacts} from '../src/feedback-events.js';
import {render} from '../src/renderer.js';
import {drawEffects} from '../src/effects.js';
function context(){const calls=[];const ctx=new Proxy({}, {get:(o,k)=>k==='createLinearGradient'||k==='createRadialGradient'?()=>({addColorStop(){}}):(...a)=>calls.push([k,...a]),set:(o,k,v)=>(o[k]=v,true)});return {calls,canvas:{width:390,clientWidth:390,clientHeight:694,getContext:()=>ctx}};}
function state(){const s=E.createGame(14);s.towers=[];s.cells.fill(0);s.cells[100]=1;E.recompute(s);return s;}
function view(extra={}){return {owner:1,time:1000,effects:[],transitions:new Map(),reduced:false,...extra};}
test('overload redraw contains broken outer arcs instead of ordinary tower frame',()=>{const s=state(),t={id:++s.nextId,owner:1,pos:{x:8,y:10},stage:1,state:'overloaded',overloadExpiresTurn:2,protected:[]};s.towers.push(t);E.recompute(s);const a=context();render(a.canvas,s,view());assert.ok(a.calls.filter(c=>c[0]==='arc'&&c[3]>.5&&c[5]-c[4]<Math.PI*1.5).length>=3);});
test('contested tower renders both opposing arcs',()=>{const s=state();s.towers.push({id:++s.nextId,owner:1,pos:{x:8,y:10},stage:1,state:'contested',contestedBy:2,protected:[]});const a=context();render(a.canvas,s,view({reduced:true}));assert.ok(a.calls.filter(c=>c[0]==='arc'&&c[3]>.6&&c[5]-c[4]<Math.PI*1.4).length>=2);});
test('available relay uses rotating open orbit',()=>{const s=E.createGame(14);E.chooseAim(s,'move');const a=context();render(a.canvas,s,view());assert.ok(a.calls.some(c=>c[0]==='arc'&&c[3]===.57&&c[5]-c[4]<Math.PI*1.6));});
test('protected tiles have open corners, no complete inner box',()=>{const s=E.createGame(14),a=context();render(a.canvas,s,view());assert.equal(a.calls.filter(c=>c[0]==='strokeRect'&&Math.abs(c[3]-.86)<.001).length,0);assert.ok(a.calls.filter(c=>c[0]==='lineTo').length>80);});
test('state-only transitions never lift or flip tiles',()=>{const s=E.createGame(14),before=snapshot(s),tr=new Map();s.towers[0].state='overloaded';E.recompute(s);visualChanges(s,before,drainFacts(s),1000,false,tr);assert.ok(tr.size>0);assert.ok([...tr.values()].every(t=>!t.wave&&t.from===t.to));});
test('takeover main sound absorbs conversion and reconnection feedback',()=>{const s=E.createGame(14),before=snapshot(s),t=s.towers[0];t.owner=2;E.recompute(s);const events=[{type:'takeoverComplete',owner:2,x:t.pos.x+.5,y:t.pos.y+.5,eventId:'take',groupId:'take'}];const all=visualChanges(s,before,events,1000,false,new Map());const played=[];new FeedbackDirector({play:e=>played.push(e.type)}).submit(all,1000);assert.deepEqual(played,['takeoverComplete']);});
test('new strategic effect durations match specification',()=>{assert.equal(effectDuration({type:'takeoverComplete'}),750);assert.equal(effectDuration({type:'overload'}),700);assert.equal(effectDuration({type:'shielded'}),600);assert.equal(effectDuration({type:'reclaim',stage:2}),320);});
test('reduced strategic effects use a brief fixed core and no expanding wave',()=>{
  for(const type of ['takeoverComplete','overload','shielded','reclaim','restore','disconnect','reconnect']) {
    const a=context(),ctx=a.canvas.getContext();
    const event={type,born:0,owner:2,targetOwner:1,stage:2};
    drawEffects(ctx,[event],100,e=>({x:8,y:10}),{1:'red',2:'blue'},true);
    assert.ok(a.calls.some(c=>c[0]==='strokeRect'),type);
    assert.equal(a.calls.filter(c=>c[0]==='arc').length,0,type);
    a.calls.length=0;
    drawEffects(ctx,[event],400,e=>({x:8,y:10}),{1:'red',2:'blue'},true);
    assert.equal(a.calls.length,0,type);
  }
});
