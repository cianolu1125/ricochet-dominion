import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../src/engine.js";
const t = (s, owner, x, y, stage = 2) => {
  const t = {
    id: ++s.nextId,
    owner,
    pos: { x, y },
    slot: "A",
    stage,
    protected: [],
    relayUsed: false,
  };
  s.towers.push(t);
  E.expand(s, t);
  E.recompute(s);
  return t;
};
test("earlier hostile protection wins later growth and overlap survives single removal", () => {
  const s = E.createGame(10);
  s.cells.fill(0);
  s.towers = [];
  const a = t(s, 1, 5, 5),
    b = t(s, 2, 7, 5);
  assert.equal(s.cells[E.index(s, { x: 6, y: 5 })], 1);
  assert.equal(b.protected.includes(E.index(s, { x: 6, y: 5 })), false);
  const c = t(s, 1, 4, 5);
  E.removeTower(s, a);
  assert.equal(E.protectedOwner(s, E.index(s, { x: 5, y: 5 })), 1);
  E.removeTower(s, c);
  assert.equal(E.protectedOwner(s, E.index(s, { x: 5, y: 5 })), 0);
});
test("siege blast cannot steal overlapping protection of another surviving tower", () => {
  const s = E.createGame(10);
  s.cells.fill(0);
  s.towers = [];
  const a = t(s, 2, 5, 5),
    b = t(s, 2, 7, 5);
  E.siege(s, a, a.pos);
  assert.equal(s.cells[E.index(s, { x: 5, y: 5 })], 2);
  assert.equal(s.cells[E.index(s, { x: 3, y: 5 })], 1);
  assert.equal(s.towers.includes(b), true);
});
test("invalid commands reject without spending resources", () => {
  const s = E.createGame(10);
  assert.equal(E.buildTower(s), false);
  assert.equal(E.dismantle(s, 999), false);
  assert.equal(s.actionAvailable, true);
  E.chooseAim(s, "move");
  assert.equal(E.buildTower(s), false);
  assert.equal(E.endTurn(s), false);
  assert.equal(E.skip(s, "action"), false);
});
test("claims never annex restored stable portion after splitting original snapshot", () => {
  const s = E.createGame(10);
  s.cells.fill(0);
  s.towers = [];
  s.claims = [];
  for (let x = 3; x < 10; x++) s.cells[E.index(s, { x, y: 10 })] = 2;
  E.recompute(s);
  s.players[1].pos = { x: 3, y: 10 };
  E.buildTower(s);
  E.endTurn(s);
  E.beginTurn(s);
  s.cells[E.index(s, { x: 6, y: 10 })] = 0;
  t(s, 2, 9, 10, 0);
  E.endTurn(s);
  E.beginTurn(s);
  assert.equal(s.cells[E.index(s, { x: 5, y: 10 })], 1);
  assert.equal(s.cells[E.index(s, { x: 7, y: 10 })], 2);
  assert.equal(s.cells[E.index(s, { x: 6, y: 10 })], 0);
});
