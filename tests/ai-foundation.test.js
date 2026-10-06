import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine.js';
import {aimError, rng} from '../src/ai/ai-rng.js';
import {executeDecision} from '../src/ai/ai-executor.js';
import {simulate, stateKey} from '../src/ai/ai-simulate.js';

test('seeded execution error is reproducible, centered, legal and nonzero in all tiers',()=>{
  const variance=[];
  for(const difficulty of ['easy','normal','hard']) {
    let total=0,squares=0,powers=0;
    for(let i=0;i<4000;i++) {
      const input={type:'launch',kind:'move',direction:{x:1,y:0},power:.6};
      const a=aimError(input,{matchSeed:73,turnIndex:2,decisionIndex:i,segmentIndex:0,difficulty});
      assert.deepEqual(a,aimError(input,{matchSeed:73,turnIndex:2,decisionIndex:i,segmentIndex:0,difficulty}));
      const angle=Math.atan2(a.direction.y,a.direction.x);total+=angle;squares+=angle*angle;powers+=(a.power-.6)**2;
      assert.ok(a.power>=.08&&a.power<=1);
    }
    assert.ok(Math.abs(total/4000)<.004);assert.ok(powers>0);variance.push(squares/4000);
  }
  assert.ok(variance[0]>variance[1]&&variance[1]>variance[2]&&variance[2]>0);
  const a=rng('search',73);for(let i=0;i<10000;i++)a();
  assert.deepEqual(aimError({direction:{x:1,y:0},power:.6},{matchSeed:73,difficulty:'hard'}),aimError({direction:{x:1,y:0},power:.6},{matchSeed:73,difficulty:'hard'}));
});
test('simulator uses actual physics while preserving every byte of the live snapshot',()=>{
  const s=E.createGame();const before=structuredClone(s);
  const decision={type:'launch',kind:'missile',direction:{x:0,y:-1},power:.6};
  const result=simulate(s,decision);
  assert.ok(result);assert.notEqual(stateKey(result),stateKey(s));assert.deepEqual(s,before);
  const real=structuredClone(s);assert.ok(executeDecision(real,decision));
  while(real.activeBody){const r=simulate(real,{type:'wait'});assert.ok(r);Object.assign(real,r);}
  assert.deepEqual(real.cells,result.cells);assert.deepEqual(real.players,result.players);
});
test('executor validates build context and rejects illegal operations without mutation',()=>{
  const s=E.createGame();const before=structuredClone(s);
  assert.equal(executeDecision(s,{type:'build'}),false);assert.deepEqual(s,before);
  s.players[1].pos={x:4,y:20};assert.equal(executeDecision(s,{type:'build'}),true);
  assert.equal(s.actionAvailable,false);assert.equal(s.towers.length,3);
  assert.equal(executeDecision(s,{type:'launch',kind:'missile',direction:{x:1,y:0},power:.4}),false);
});
test('simulation end settles held relay, then uses authoritative turn settlement',()=>{
  const s=E.createGame();E.chooseAim(s,'missile');s.committed=true;s.actionAvailable=false;s.phase='MISSILE_RELAY_AIM';s.relay={pos:{x:4,y:15},id:1};s.charge=2;
  const r=simulate(s,{type:'end'});assert.equal(r.current,2);assert.equal(r.phase,'IDLE');assert.ok(E.counts(r)[1]>E.counts(s)[1]);
});
