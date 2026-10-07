import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './browser-fixture.js';
test('theme picker works in home and settings, persists and preserves match',async()=>{
 const f=await setup();try{
 f.click('[data-panel="themes"]');f.click('[data-panel="theme-coven"]');
 assert.equal(f.w.document.documentElement.dataset.theme,'coven');
 assert.equal(f.w.localStorage.getItem('ricochet-theme'),'coven');
 f.click('[data-panel="theme-back"]');f.click('[data-panel="start"]');
 const before=await f.read();f.click('#menu');f.click('[data-panel="themes"]');
 f.click('[data-panel="theme-tang"]');f.click('[data-panel="theme-back"]');
 assert.equal(f.w.document.querySelector('#panel-title').textContent,'设置');
 f.click('[data-panel="close"]');f.tick(16);
 assert.equal(f.w.document.documentElement.dataset.theme,'tang');
 const after=await f.read();assert.deepEqual(after,before);
 }finally{await f.close()}
});
for(const theme of ['original','coven','tang'])for(const difficulty of ['easy','normal','hard'])test(`${theme} preserves ${difficulty} PVE configuration and settings navigation`,async()=>{
 const f=await setup(390,844,true,true);try{
 f.click('[data-panel="themes"]');f.click(`[data-panel="theme-${theme}"]`);f.click('[data-panel="theme-back"]');
 f.click('[data-panel="computer"]');f.click(`[data-panel="difficulty-${difficulty}"]`);f.click('[data-panel="start-computer"]');
 const before=f.read();assert.equal(before.mode,'pve');assert.equal(before.difficulty,difficulty);
 f.click('#menu');f.click('[data-panel="themes"]');f.click('[data-panel="theme-back"]');f.click('[data-panel="close"]');
 assert.deepEqual(f.read(),before);f.tick(16);assert.equal(f.w.document.documentElement.dataset.theme,theme);
 }finally{await f.close()}
});
test('theme switch waits for active non-cinematic feedback before replacing its skin',async()=>{
 const f=await setup();try{
 f.click('[data-panel="start"]');f.w.presentForTest({type:'build',x:4.5,y:20.5});
 f.click('#menu');f.click('[data-panel="themes"]');f.click('[data-panel="theme-coven"]');
 assert.equal(f.w.document.documentElement.dataset.theme,'original');
 f.tick(1000);assert.equal(f.w.document.documentElement.dataset.theme,'coven');
 }finally{await f.close()}
});
