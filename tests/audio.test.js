import test from 'node:test';import assert from 'node:assert/strict';import {AudioDirector} from '../src/audio.js';
function harness() {
 let contexts=0;const sources=[];
 const parameter=()=>({value:0,setValueAtTime(){},setTargetAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}});
 const node=()=>({gain:parameter(),frequency:parameter(),threshold:parameter(),knee:parameter(),ratio:parameter(),attack:parameter(),release:parameter(),connect(){},disconnect(){}});
 class Context {constructor(){contexts++;this.currentTime=0;this.sampleRate=8000;this.destination={};this.state='running';}
 createGain(){return node();}createDynamicsCompressor(){return node();}createWaveShaper(){return node();}createBiquadFilter(){return node();}
 createBuffer(c,n){return {getChannelData:()=>new Float32Array(n)};}
 createOscillator(){const s={...node(),start(){this.started=true;},stop(at){this.stopAt=at??0;}};sources.push(s);return s;}
 createBufferSource(){return this.createOscillator();}resume(){return Promise.resolve().then(()=>this.state='running');}suspend(){this.state='suspended';return Promise.resolve();}
 }
 globalThis.AudioContext=Context;return {sources,get contexts(){return contexts;},cleanup(){delete globalThis.AudioContext;}};
}
test('SFX mute creates no voices; singleton context and master volume are respected',()=>{
 const h=harness();try {const a=new AudioDirector({enabled:false});a.play({type:'siege'});assert.equal(h.contexts,0);
 a.set(true,.25);a.play({type:'bounce'});a.play({type:'damage'});assert.equal(h.contexts,1);assert.equal(a.master.gain.value,.25);
 const n=h.sources.length;a.set(false,.9);a.play({type:'siege'});assert.equal(h.sources.length,n);
 }finally{h.cleanup();}
});
test('background cancels active sources rather than preserving audible backlog',()=>{
 const h=harness();try {const a=new AudioDirector();a.play({type:'siege'});assert.ok(h.sources.some(s=>s.stopAt>0));a.suspend();assert.ok(h.sources.every(s=>s.stopAt===0));}finally{h.cleanup();}
});
test('first resumed event is retained; pending voice cannot survive a later background',async()=>{
 const h=harness();try {const a=new AudioDirector();a.unlock();a.context.state='suspended';a.play({type:'bounce'});await new Promise(resolve=>setImmediate(resolve));assert.equal(h.sources.length,1);
 a.context.state='suspended';a.play({type:'damage'});a.suspend();await new Promise(resolve=>setImmediate(resolve));assert.equal(h.sources.length,1);
 }finally{h.cleanup();}
});
