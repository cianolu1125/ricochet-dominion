import test from 'node:test';
import assert from 'node:assert/strict';
import {ThemeManager} from '../src/themes/theme-manager.js';
import {themes, visualEvents, audioEvents} from '../src/themes/theme-registry.js';
import {createGame} from '../src/engine.js';
test('theme defaults, persists, rejects unknown ids and tolerates denied storage',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 const m=new ThemeManager(storage);assert.equal(m.current.id,'original');
 m.request('coven');assert.equal(new ThemeManager(storage).current.id,'coven');
 m.request('unknown');assert.equal(m.current.id,'original');
 const denied=new ThemeManager({getItem(){throw Error()},setItem(){throw Error()}});
 denied.request('tang');assert.equal(denied.current.id,'tang');
});
test('unsafe switch queues latest preference without changing a running match',()=>{
 const state=createGame(14,'phone'),before=structuredClone(state),m=new ThemeManager(null);
 m.request('coven',false);assert.equal(m.current.id,'original');
 m.request('tang',false);assert.equal(m.flush(false),false);
 assert.equal(m.flush(true),true);assert.equal(m.current.id,'tang');
 assert.equal(m.pending,null);assert.deepEqual(state,before);
});
test('all required events have explicit recipes and unknown events fall back safely',()=>{
 assert.equal(audioEvents.length,33);assert.equal(visualEvents.length,29);
 for(const theme of Object.values(themes)){
  for(const e of visualEvents) assert.ok(theme.vfx[e],theme.id+':'+e);
  for(const e of audioEvents) assert.ok(theme.audio[e],theme.id+':'+e);
 }
});
