import test from 'node:test';
import assert from 'node:assert/strict';
import {render} from '../src/renderer.js';
import {drawEffects} from '../src/effects.js';
import {themeManager} from '../src/themes/theme-manager.js';
import {themes,visualEvents,audioEvents,audioRecipe,visualRecipe} from '../src/themes/theme-registry.js';
import * as E from '../src/engine.js';
function recording(){
 const calls=[],ctx=new Proxy({},{get(o,k){if(k==='measureText')return t=>({width:t.length*.3});return (...a)=>{assert.ok(a.every(x=>typeof x!=='number'||Number.isFinite(x)),k+': invalid coordinate');calls.push([k,...a]);};},set(o,k,v){calls.push(['set',k,v]);return true}});
 return {ctx,calls,canvas:{width:390,clientWidth:390,clientHeight:694,getContext:()=>ctx}};
}
test('every skin renders complex board and event frames without writing rule state',()=>{
 const s=E.createGame(14,'phone');s.towers[0].state='overloaded';s.towers[1].state='contested';E.recompute(s);
 const before=structuredClone(s),signatures=[];
 try{for(const id of Object.keys(themes)){
  themeManager.request(id);const c=recording();
  for(const reduced of [false,true])for(const time of [40,160,300,600,1100,1550]){
   const effects=visualEvents.map((type,i)=>({type,eventId:'theme-'+i,owner:1,targetOwner:2,born:0,duration:1700,x:8.5,y:16.5,charge:3,width:s.width,height:s.height,radius:2,stage:2,ends:[{x:1.5,y:16.5},{x:16.5,y:16.5}],attackCells:[296,297,298,314],brokenProtectedCells:[296],destroyedTowers:[structuredClone(s.towers[1])],vanguardHit:true,vanguardPosition:{x:8,y:16}}));
   render(c.canvas,s,{time,owner:1,effects,transitions:new Map(),reduced,labels:{overload:'过载',takeoverStart:'争夺中'}});
  }
  assert.deepEqual(s,before);signatures.push(JSON.stringify(c.calls));
 }
 assert.equal(new Set(signatures).size,3);
 }finally{themeManager.request('original')}
});
test('authored build, charge and ultimate use different geometry, not just colors',()=>{
 const signatures=[];
 try{for(const id of Object.keys(themes)){
  themeManager.request(id);const c=recording();
  drawEffects(c.ctx,[{type:'build',owner:1,x:2,y:3,born:0,duration:400}],160,p=>p,themes[id].team,false);
  signatures.push(JSON.stringify(c.calls.filter(c=>c[0]!=='set')));
 }
 assert.equal(new Set(signatures).size,3);
 }finally{themeManager.request('original')}
});
test('unknown event fallback is safe and all audio durations retain baseline pacing',()=>{
 for(const theme of Object.values(themes)){
  assert.equal(audioRecipe(theme,'unrecognized'),null);assert.equal(visualRecipe(theme,'unrecognized'),null);
  for(const name of audioEvents){const r=audioRecipe(theme,name);assert.equal(r.voice[2],themes.original.audio[name].voice[2]);assert.ok(r.voice.every(Number.isFinite));}
 }
});
test('reduced strategic effects have fixed geometry across animation frames',()=>{
 try{for(const id of ['coven','tang'])for(const type of ['takeoverComplete','restore','reclaim','reconnect']){
  themeManager.request(id);
  const frames=[60,160].map(time=>{const c=recording();drawEffects(c.ctx,[{type,owner:1,targetOwner:2,x:3,y:5,born:0,duration:700}],time,p=>p,themes[id].team,true);return c.calls.filter(c=>c[0]!=='set')});
  assert.deepEqual(frames[0],frames[1],id+':'+type);
 }}finally{themeManager.request('original')}
});
