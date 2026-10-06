import test from 'node:test';import assert from 'node:assert/strict';
import * as E from '../src/engine.js';import {assertMatch} from '../scripts/ai-lab.mjs';
test('headless verifier rejects repeated relays, inconsistent charge, inactive protection and stale pending',()=>{
 const base=E.createGame(10,'desktop');assert.doesNotThrow(()=>assertMatch(base));
 const duplicate=structuredClone(base);duplicate.moveVisited=[1,1];assert.throws(()=>assertMatch(duplicate),/Relay/);
 const charge=structuredClone(base);charge.phase='MISSILE_RELAY_AIM';charge.visitedRelayTowerIds=new Set([1]);charge.charge=3;assert.throws(()=>assertMatch(charge),/Charge/);
 const overloaded=structuredClone(base);overloaded.towers[0].state='overloaded';assert.throws(()=>assertMatch(overloaded),/Protection/);
 const pending=structuredClone(base);pending.claims=[{captor:1,target:2,sources:[1],cells:[0],resolveTurn:2}];assert.throws(()=>assertMatch(pending),/Pending/);
});

test('balance CLI compares the same seed on both sides and writes reproducible metrics',async()=>{
 const {execFile}=await import('node:child_process');const {promisify}=await import('node:util');const {mkdtemp,readFile,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const dir=await mkdtemp(join(tmpdir(),'ai-paired-'));try {
  const output=join(dir,'paired.json');await promisify(execFile)(process.execPath,['scripts/ai-lab.mjs','easy','normal','1','--paired','--smoke','--equal-error','--output='+output]);
  const matches=JSON.parse(await readFile(output,'utf8'));assert.equal(matches.length,2);assert.equal(matches[0].seed,matches[1].seed);assert.equal(matches[0].rounds,matches[1].rounds);assert.equal(matches[0].red,matches[1].blue);assert.equal(matches[0].blue,matches[1].red);assert.ok(matches.every(m=>m.winner));
 }finally{await rm(dir,{recursive:true,force:true});}
});
