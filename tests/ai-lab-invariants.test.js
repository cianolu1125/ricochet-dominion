import test from 'node:test';import assert from 'node:assert/strict';
import * as E from '../src/engine.js';import {assertMatch} from '../scripts/ai-lab.mjs';
test('headless verifier rejects repeated relays, inconsistent charge, inactive protection and stale pending',()=>{
 const base=E.createGame(10,'desktop');assert.doesNotThrow(()=>assertMatch(base));
 const duplicate=structuredClone(base);duplicate.moveVisited=[1,1];assert.throws(()=>assertMatch(duplicate),/Relay/);
 const charge=structuredClone(base);charge.phase='MISSILE_RELAY_AIM';charge.visitedRelayTowerIds=new Set([1]);charge.charge=3;assert.throws(()=>assertMatch(charge),/Charge/);
 const overloaded=structuredClone(base);overloaded.towers[0].state='overloaded';assert.throws(()=>assertMatch(overloaded),/Protection/);
 const pending=structuredClone(base);pending.claims=[{captor:1,target:2,sources:[1],cells:[0],resolveTurn:2}];assert.throws(()=>assertMatch(pending),/Pending/);
});
