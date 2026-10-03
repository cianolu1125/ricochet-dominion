import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../src/engine.js";
const fresh = () => E.createGame(10);
const at = (s, x, y) => y * s.width + x;
const tactical = (s) => {
  s.phase = "TACTICAL_CHOICE";
};
test("initial state and phase gates", () => {
  const s = fresh();
  assert.equal(s.cells.length, 576);
  assert.equal(E.counts(s)[1], 72);
  assert.equal(s.players[1].hp, 3);
  assert.equal(E.buildTower(s), false);
  assert.equal(E.endTurn(s), false);
});
test("queen movement ignores friendly towers and is blocked by hostile entities", () => {
  const s = fresh();
  s.players[1].pos = { x: 8, y: 20 };
  s.towers = [
    { owner: 1, pos: { x: 8, y: 18 }, stage: 0, slot: "A", protected: [] },
  ];
  assert.ok(E.moveRole(s, { x: 8, y: 15 }));
  assert.equal(s.players[1].mobileShield, true);
  const a = fresh();
  a.players[1].pos = { x: 8, y: 20 };
  a.towers = [
    { owner: 2, pos: { x: 8, y: 18 }, stage: 0, slot: "A", protected: [] },
  ];
  assert.equal(E.moveRole(a, { x: 8, y: 15 }), false);
  assert.equal(E.moveRole(a, { x: 9, y: 17 }), false);
});
test("ordinary blast paints and protected territory is absolute", () => {
  const s = fresh();
  s.players[1].pos = { x: 8, y: 20 };
  tactical(s);
  E.buildTower(s);
  E.explode(s, 2, { x: 8, y: 20 });
  assert.equal(s.cells[at(s, 8, 20)], 1);
  assert.equal(s.cells[at(s, 9, 20)], 2);
});
test("towers grow 1 to 9 to 25 and cannot steal earlier enemy locks", () => {
  const s = fresh();
  s.players[1].pos = { x: 8, y: 20 };
  tactical(s);
  E.buildTower(s);
  const t = s.towers[0];
  assert.equal(t.protected.length, 1);
  E.growTowers(s, 1);
  assert.equal(t.protected.length, 9);
  E.growTowers(s, 1);
  assert.equal(t.protected.length, 25);
  E.growTowers(s, 1);
  assert.equal(t.stage, 2);
  s.current = 2;
  s.players[2].pos = { x: 11, y: 20 };
  tactical(s);
  E.buildTower(s);
  E.growTowers(s, 2);
  E.growTowers(s, 2);
  assert.equal(s.cells[at(s, 10, 20)], 1);
});
test("three towers redeploy only selected slot; overlap retains locks", () => {
  const s = fresh();
  for (let n = 0; n < 3; n++) {
    s.players[1].pos = { x: 4 + n * 4, y: 20 };
    tactical(s);
    assert.ok(E.buildTower(s));
  }
  s.players[1].pos = { x: 9, y: 25 };
  tactical(s);
  assert.equal(E.buildTower(s), false);
  assert.ok(E.buildTower(s, "A"));
  assert.equal(s.towers.length, 3);
  assert.equal(s.towers.find((t) => t.slot === "A").pos.y, 25);
  assert.equal(s.cells[at(s, 4, 20)], 1);
  assert.equal(E.protectedOwner(s, at(s, 4, 20)), 0);
});
test("growth handles overlaps and deleting one preserves another", () => {
  const s = fresh();
  s.players[1].pos = { x: 8, y: 20 };
  tactical(s);
  E.buildTower(s);
  E.growTowers(s, 1);
  s.players[1].pos = { x: 9, y: 20 };
  tactical(s);
  E.buildTower(s);
  const first = s.towers[0];
  E.removeTower(s, first);
  assert.equal(E.protectedOwner(s, at(s, 9, 20)), 1);
  assert.equal(s.cells[at(s, 8, 20)], 1);
});
test("melee protection and role undo", () => {
  const s = fresh();
  s.players[1].pos = { x: 8, y: 20 };
  s.players[2].pos = { x: 9, y: 20 };
  s.players[2].mobileShield = true;
  assert.equal(E.melee(s), false);
  s.players[2].mobileShield = false;
  assert.ok(E.melee(s));
  assert.equal(s.players[2].hp, 2);
  assert.ok(s.players[2].respawnShield);
  assert.ok(E.undoRole(s));
  assert.equal(s.players[2].hp, 3);
  assert.equal(s.players[2].pos.x, 9);
});
test("respawn protection lasts through own next Turn; mobile protection expires at own start", () => {
  const s = fresh();
  s.players[2].pos = { x: 8, y: 20 };
  E.explode(s, 1, { x: 8, y: 20 });
  assert.ok(s.players[2].respawnShield);
  s.phase = "TURN_END";
  E.endTurn(s);
  assert.ok(s.players[2].respawnShield);
  E.beginTurn(s);
  assert.ok(s.players[2].respawnShield);
  s.phase = "TURN_END";
  E.endTurn(s);
  assert.equal(s.players[2].respawnShield, false);
});
test("missile damage max once a tactic and ignores mobile shield", () => {
  const s = fresh();
  s.players[2].pos = { x: 8, y: 20 };
  s.players[2].mobileShield = true;
  E.explode(s, 1, { x: 8, y: 20 });
  assert.equal(s.players[2].hp, 2);
  s.players[2].respawnShield = false;
  E.explode(s, 1, s.players[2].pos);
  assert.equal(s.players[2].hp, 2);
});
test("HP victory immediate; 80 percent only after complete Round", () => {
  const s = fresh();
  s.players[2].hp = 1;
  s.players[2].pos = { x: 8, y: 20 };
  E.explode(s, 1, { x: 8, y: 20 });
  assert.equal(s.winner.player, 1);
  const a = fresh();
  a.cells.fill(1);
  a.phase = "TURN_END";
  E.endTurn(a);
  assert.equal(a.winner, null);
  E.beginTurn(a);
  a.phase = "TURN_END";
  E.endTurn(a);
  assert.equal(a.winner.reason, "territory");
});
test("equal final score gives one overtime then a draw", () => {
  const s = fresh();
  s.round = 10;
  s.current = 2;
  s.phase = "TURN_END";
  E.endTurn(s);
  assert.equal(s.overtime, true);
  E.beginTurn(s);
  s.phase = "TURN_END";
  E.endTurn(s);
  E.beginTurn(s);
  s.phase = "TURN_END";
  E.endTurn(s);
  assert.equal(s.winner.player, 0);
});
test("same cell build rejected and respawn finds unoccupied cell", () => {
  const s = fresh();
  tactical(s);
  E.buildTower(s);
  tactical(s);
  assert.equal(E.buildTower(s), false);
  s.players[1].pos = { ...s.players[2].spawn };
  s.players[2].pos = { x: 5, y: 15 };
  E.explode(s, 1, { x: 5, y: 15 });
  assert.notDeepEqual(s.players[2].pos, s.players[1].pos);
});
