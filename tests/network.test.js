import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../src/engine.js";
const fresh = () => {
  const s = E.createGame(10);
  s.cells.fill(0);
  s.towers = [];
  s.claims = [];
  return s;
};
const tower = (s, owner, x, y, stage = 0, slot = "A") => {
  const t = {
    id: ++s.nextId,
    owner,
    pos: { x, y },
    stage,
    slot,
    protected: [],
    relayUsed: false,
  };
  s.towers.push(t);
  E.expand(s, t);
  E.recompute(s);
  return t;
};
test("v0.2 starts with 10 HP, one stage-2 tower per side and free tokens", () => {
  const s = E.createGame(10);
  assert.equal(s.players[1].hp, 10);
  assert.equal(s.towers.length, 2);
  assert.equal(s.towers[0].stage, 2);
  assert.equal(s.moveAvailable, true);
  assert.equal(s.actionAvailable, true);
});
test("T01/02 diagonal is temporary, four-neighbor connection stable", () => {
  const s = fresh();
  tower(s, 1, 2, 2);
  s.cells[E.index(s, { x: 3, y: 3 })] = 1;
  E.recompute(s);
  assert.equal(s.stability[E.index(s, { x: 3, y: 3 })], "temporary");
  s.cells[E.index(s, { x: 3, y: 2 })] = 1;
  E.recompute(s);
  assert.equal(s.stability[E.index(s, { x: 3, y: 3 })], "stable");
});
test("T03/04 removing only supply leaves color temporary indefinitely", () => {
  const s = fresh();
  const t = tower(s, 1, 2, 2);
  s.cells[E.index(s, { x: 3, y: 2 })] = 1;
  E.removeTower(s, t);
  assert.equal(s.cells[E.index(s, { x: 3, y: 2 })], 1);
  assert.equal(s.stability[E.index(s, { x: 3, y: 2 })], "temporary");
  E.endTurn(s);
  E.beginTurn(s);
  assert.equal(s.cells[E.index(s, { x: 3, y: 2 })], 1);
});
test("T05/08 claim follows the current connected temporary region", () => {
  const s = fresh();
  for (let x = 3; x < 7; x++) s.cells[E.index(s, { x, y: 5 })] = 2;
  E.recompute(s);
  s.players[1].pos = { x: 3, y: 5 };
  assert.ok(E.buildTower(s));
  assert.equal(s.claims[0].cells.length, 3);
  s.cells[E.index(s, { x: 7, y: 5 })] = 2;
  E.endTurn(s);
  E.beginTurn(s);
  E.endTurn(s);
  E.beginTurn(s);
  assert.equal(s.cells[E.index(s, { x: 6, y: 5 })], 1);
  assert.equal(s.cells[E.index(s, { x: 7, y: 5 })], 1);
});
test("T06 rescued cells remain target color when claim settles", () => {
  const s = fresh();
  for (let x = 3; x < 7; x++) s.cells[E.index(s, { x, y: 5 })] = 2;
  E.recompute(s);
  s.players[1].pos = { x: 3, y: 5 };
  E.buildTower(s);
  tower(s, 2, 6, 5);
  E.endTurn(s);
  E.beginTurn(s);
  E.endTurn(s);
  E.beginTurn(s);
  assert.equal(s.cells[E.index(s, { x: 5, y: 5 })], 2);
});
test("T07 destroyed claim source cancels annexation", () => {
  const s = fresh();
  s.cells[E.index(s, { x: 3, y: 5 })] = 2;
  s.cells[E.index(s, { x: 4, y: 5 })] = 2;
  E.recompute(s);
  s.players[1].pos = { x: 3, y: 5 };
  E.buildTower(s);
  E.removeTower(s, s.towers[0]);
  E.endTurn(s);
  E.beginTurn(s);
  E.endTurn(s);
  E.beginTurn(s);
  assert.equal(s.cells[E.index(s, { x: 4, y: 5 })], 2);
  assert.equal(s.claims.length, 0);
});
test("T09/10 towers include birth and grow each owner turn", () => {
  const s = E.createGame(10);
  s.players[1].pos = { x: 8, y: 15 };
  E.buildTower(s);
  const t = s.towers.at(-1);
  assert.equal(t.stage, 0);
  E.endTurn(s);
  E.beginTurn(s);
  E.endTurn(s);
  E.beginTurn(s);
  assert.equal(t.stage, 1);
  E.endTurn(s);
  E.beginTurn(s);
  E.endTurn(s);
  E.beginTurn(s);
  assert.equal(t.stage, 2);
});
test("T11 explosions respect enemy protection, do not cause area damage", () => {
  const s = fresh();
  const t = tower(s, 2, 8, 8, 2);
  s.players[2].pos = { x: 8, y: 8 };
  E.explode(s, 1, { x: 8, y: 8 }, 2);
  assert.equal(s.cells[E.index(s, t.pos)], 2);
  assert.equal(s.players[2].hp, 10);
});
test("T12 redeploy leaves old colors and removes exclusive protection", () => {
  const s = fresh();
  for (let k = 0; k < 5; k++) tower(s, 1, 2 + k * 2, 2, 0, "ABCDE"[k]);
  s.players[1].pos = { x: 12, y: 12 };
  assert.equal(E.buildTower(s), false);
  assert.ok(E.buildTower(s, "A"));
  assert.equal(s.towers.length, 5);
  assert.equal(s.cells[E.index(s, { x: 2, y: 2 })], 1);
  assert.equal(E.protectedOwner(s, E.index(s, { x: 2, y: 2 })), 0);
  assert.equal(s.stability[E.index(s, { x: 2, y: 2 })], "temporary");
});
test("T28/29 free-order tokens and duplicate action rejection", () => {
  for (const first of ["move", "action"]) {
    const s = E.createGame(10);
    E.skip(s, first);
    assert.equal(first === "move" ? s.actionAvailable : s.moveAvailable, true);
    E.skip(s, first === "move" ? "action" : "move");
    assert.equal(s.moveAvailable, false);
    assert.equal(s.actionAvailable, false);
    assert.equal(E.buildTower(s), false);
  }
});
test("T31/32 dismantle from actual control range consumes action only", () => {
  const s = fresh();
  const t = tower(s, 2, 8, 8, 2);
  s.players[1].pos = { x: 6, y: 6 };
  assert.equal(E.nearbyTowers(s).length, 1);
  assert.ok(E.dismantle(s, t.id));
  assert.equal(s.moveAvailable, true);
  assert.equal(s.actionAvailable, false);
});
test("HP death preserves position and aborts painting", () => {
  const s = E.createGame(10);
  s.players[2].hp = 1;
  const p = { ...s.players[2].pos };
  const before = [...s.cells];
  E.damage(s, 2);
  E.explode(s, 1, p, 2);
  assert.equal(s.winner.player, 1);
  assert.deepEqual(s.players[2].pos, p);
  assert.deepEqual(s.cells, before);
});
test("profiles lock board dimensions at creation", () => {
  for (const [profile, w, h] of [
    ["phone", 18, 32],
    ["tablet", 24, 32],
    ["touch-landscape", 32, 24],
    ["desktop", 32, 18],
  ]) {
    const s = E.createGame(14, profile);
    assert.equal(s.width, w);
    assert.equal(s.height, h);
  }
});
