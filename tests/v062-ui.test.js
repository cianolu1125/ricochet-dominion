import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './browser-fixture.js';
import * as E from '../src/engine.js';
function shot(current=1,fatal=false) {
  const s=E.createGame();s.current=current;s.cells.fill(0);s.towers=[];
  const owner=E.enemy(current);s.players[owner].pos={x:8,y:16};s.players[owner].hp=fatal?1:14;
  s.phase='MISSILE_FLYING';s.actionAvailable=false;s.charge=3;
  s.activeBody={kind:'missile',x:8.5,y:16.5,vx:0,vy:0,charge:3,carried:null,trail:[]};
  E.recompute(s);return s;
}
for(const reduced of [false,true])test('fatal ultimate defers result until presentation is complete '+reduced,async()=>{
  const a=await setup(390,844,true,reduced);
  try {
    a.click('[data-panel="start"]');a.w.useFixtureForTest(shot(1,true));
    a.tick(16);assert.equal(a.read().winner?.reason,'hp');
    assert.equal(a.w.document.querySelector('#overlay').hidden,true);
    assert.equal(a.w.document.querySelector('#fab').disabled,true);
    a.tick(1800);assert.equal(a.w.document.querySelector('#overlay').hidden,false);
    assert.match(a.w.document.querySelector('#panel').textContent,/获胜/);
  }finally{await a.close();}
});
for(const owner of [1,2])test('ultimate prevents repeated turn/action input and restores controls '+owner,async()=>{
  const a=await setup();
  try {
    a.click('[data-panel="start"]');a.w.useFixtureForTest(shot(owner));
    a.tick(16);const before=a.read();
    assert.equal(a.w.document.querySelector('#fab').disabled,true);
    assert.equal(a.w.document.querySelector('#stack').hidden,true);
    a.w.document.querySelector('#fab').click();a.canvas.dispatchEvent(new a.w.PointerEvent('pointerdown',{button:0,clientX:120,clientY:300}));
    assert.deepEqual(a.read(),before);
    a.w.innerWidth=844;a.w.innerHeight=390;a.w.dispatchEvent(new a.w.Event('resize'));
    a.tick(1800);assert.equal(a.w.document.querySelector('#fab').disabled,false);
    assert.equal(a.read().players[E.enemy(owner)].hp,13);
    a.click('#fab');assert.equal(a.read().current,E.enemy(owner));
  }finally{await a.close();}
});
test('background interruption clears cinematic without replaying damage or leaving controls locked',async()=>{
  const a=await setup();
  try {
    a.click('[data-panel="start"]');a.w.useFixtureForTest(shot());
    a.tick(16);assert.equal(a.w.document.querySelector('#fab').disabled,true);
    a.w.document.dispatchEvent(new a.w.Event('visibilitychange'));
    assert.equal(a.w.document.querySelector('#fab').disabled,false);
    const hp=a.read().players[2].hp;a.tick(2000);assert.equal(a.read().players[2].hp,hp);
  }finally{await a.close();}
});
