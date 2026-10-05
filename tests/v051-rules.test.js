import { stabilize } from './territory-fixture.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine.js';
import * as P from '../src/physics.js';
import { drainFacts } from '../src/feedback-events.js';
import { FeedbackDirector } from '../src/feedback.js';
import { snapshot, visualChanges } from '../src/visual-changes.js';
const fresh = (owner = 1) => {
  const s = E.createGame();
  s.current = owner; s.cells.fill(0); s.towers = []; s.claims = [];
  s.players[owner].pos = {x: 2, y: 10};
  s.players[E.enemy(owner)].pos = {x: 12, y: 10};
  E.recompute(s); return s;
};
const tower = (s, owner, x, y, slot = 'A', stage = 0) => {
  const t = {id: ++s.nextId, owner, pos: {x,y}, slot, stage, protected: [], relayUsed: false};
  s.towers.push(t); E.expand(s,t); E.recompute(s); return t;
};
for (const owner of [1,2]) {
  for (const color of [0,1,2]) for (const status of ['temporary','stable','protected'])
    test(`HP player ${owner}, color ${color}, ${status}: only enemy territory hurts`, () => {
      const s = fresh(owner), p = s.players[owner].pos, i = E.index(s,p);
      s.cells[i] = color;
      if (color && status === 'protected') tower(s,color,p.x,p.y);
      if (color && status === 'stable') tower(s,color,p.x+1,p.y);
      E.recompute(s); drainFacts(s);
      E.hitRole(s,owner);
      assert.equal(s.players[owner].hp, color === E.enemy(owner) && status !== 'temporary' ? 9 : 10);
    });
  for (const color of [0, owner, E.enemy(owner)])
    test(`blast player ${owner}: final paint hurts once from old color ${color}`, () => {
      const s = fresh(E.enemy(owner));
      s.players[owner].pos = {x:8,y:12};
      s.cells[E.index(s,s.players[owner].pos)] = color;
      E.recompute(s); drainFacts(s);
      stabilize(s,E.enemy(owner),[{x:8,y:12}]);
      s.phase = 'MISSILE_FLYING'; s.committed = true; s.actionAvailable = false;
      s.activeBody = {kind:'missile',x:8.5,y:12.5,vx:0,vy:0,charge:0,carried:owner,wasEnemy:color===E.enemy(owner),trail:[]};
      P.stepBody(s,1/120);
      assert.equal(s.cells[E.index(s,s.players[owner].pos)],E.enemy(owner));
      assert.equal(s.players[owner].hp,9);
      assert.equal(drainFacts(s).filter(e=>e.type==='damage').length,1);
      P.stepBody(s,1/120); assert.equal(s.players[owner].hp,9);
    });
  test(`blast player ${owner}: protected own landing survives, no territory damage`, () => {
    const s = fresh(E.enemy(owner)); tower(s,owner,8,12); s.players[owner].pos = {x:8,y:12};
    s.phase='MISSILE_FLYING';
    s.activeBody={kind:'missile',x:8.5,y:12.5,vx:0,vy:0,charge:0,carried:owner,wasEnemy:false,trail:[]};
    P.stepBody(s,1/120); assert.equal(s.players[owner].hp,10);
    assert.equal(s.cells[E.index(s,s.players[owner].pos)],owner);
  });
  test(`deployment player ${owner}: commit heals once and spends action`, () => {
    const s=fresh(owner); s.players[owner].hp=8; const before=snapshot(s);
    assert.equal(E.buildTower(s),true); assert.equal(s.players[owner].hp,9);
    assert.equal(s.actionAvailable,false); assert.equal(s.moveAvailable,true);
    assert.equal(E.buildTower(s),false); assert.equal(s.players[owner].hp,9);
    const facts=drainFacts(s); assert.equal(facts.filter(e=>e.type==='heal').length,1);
    const heard=[], d=new FeedbackDirector({play:e=>heard.push(e.type)});
    const events=visualChanges(s,before,facts,0,false,new Map());
    d.submit(events,0); d.submit(events,20);
    assert.deepEqual(heard,['build']); assert.equal(d.impulses,0);
    assert.equal(d.effects.filter(e=>e.type==='heal').length,1);
    d.update(901); assert.equal(d.effects.length,0);
  });
  test(`redeployment player ${owner}: real replacement heals, preserves old color`, () => {
    const s=fresh(owner); for(let n=0;n<5;n++) tower(s,owner,4+n*2,4,'ABCDE'[n]);
    s.players[owner].hp=9; const old=s.towers[0]; const before=snapshot(s);
    assert.equal(E.buildTower(s,'A'),true); assert.equal(s.players[owner].hp,10);
    assert.ok(!s.towers.includes(old)); assert.equal(s.towers.length,5);
    assert.equal(s.cells[E.index(s,old.pos)],owner); assert.equal(s.actionAvailable,false);
    const heard=[], d=new FeedbackDirector({play:e=>heard.push(e.type)});
    d.submit(visualChanges(s,before,drainFacts(s),0,false,new Map()),0);
    assert.deepEqual(heard,['redeploy']);
  });
  for(const reason of ['full','occupied','enemy-protected','spent','dead','game-over','aim','bad-slot'])
    test(`deployment player ${owner}: ${reason} cannot produce false recovery`,()=>{
      const s=fresh(owner); s.players[owner].hp=reason==='full'?10:8;
      if(reason==='occupied') tower(s,owner,2,10);
      if(reason==='enemy-protected') tower(s,E.enemy(owner),2,10);
      if(reason==='spent') s.actionAvailable=false;
      if(reason==='dead') s.players[owner].hp=0;
      if(reason==='game-over') E.win(s,E.enemy(owner),'hp');
      if(reason==='aim') E.chooseAim(s,'missile');
      if(reason==='bad-slot') for(let n=0;n<5;n++) tower(s,owner,4+n*2,4,'ABCDE'[n]);
      drainFacts(s); const hp=s.players[owner].hp;
      assert.equal(E.buildTower(s,reason==='bad-slot'?'Z':undefined),reason==='full');
      assert.equal(s.players[owner].hp,hp); assert.equal(drainFacts(s).filter(e=>e.type==='heal').length,0);
    });
}
for (const color of [1,2]) for (const level of [2,3])
  test(`cross ${level}: ${color} protection stops one ray, other rays continue`,()=>{
    const s=fresh(); const t=tower(s,color,11,12);
    E.paintMissile(s,1,{x:8.5,y:12.5},level);
    assert.equal(s.cells[E.index(s,{x:10,y:12})],1);
    assert.equal(s.cells[E.index(s,{x:11,y:12})],color);
    assert.equal(s.cells[E.index(s,{x:12,y:12})],0);
    for(const p of [{x:1,y:12},{x:8,y:1},{x:8,y:30}]) assert.equal(s.cells[E.index(s,p)],1);
    assert.ok(s.towers.includes(t));
    const e=drainFacts(s).find(e=>e.type==='cross');
    assert.ok(e.ends.some(p=>p.x===11 && p.y===12.5));
  });
test('fatal final blast commits paint, then ends match without resurrection',()=>{
  const s=fresh(); s.players[2].hp=1; s.players[2].pos={x:8,y:12}; s.cells[E.index(s,s.players[2].pos)]=2;
  stabilize(s,1,[{x:8,y:12}]);
  s.phase='MISSILE_FLYING'; s.activeBody={kind:'missile',x:8.5,y:12.5,vx:0,vy:0,charge:0,carried:2,wasEnemy:false,trail:[]};
  P.stepBody(s,1/120); assert.equal(s.cells[E.index(s,s.players[2].pos)],1);
  assert.equal(s.players[2].hp,0); assert.equal(s.winner?.player,1); assert.equal(s.phase,'GAME_OVER');
  assert.equal(s.activeBody,null); assert.equal(E.buildTower(s),false);
});
