import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../src/engine.js";
import * as P from "../src/physics.js";
function pass(s) {
  assert.ok(E.endTurn(s));
  if (!s.winner) assert.ok(E.beginTurn(s));
}
test("80 percent counted including temporary only at complete round end", () => {
  const s = E.createGame();
  s.cells.fill(1);
  E.recompute(s);
  assert.equal(s.winner, null);
  pass(s);
  assert.equal(s.winner, null);
  pass(s);
  assert.equal(s.winner.player, 1);
  assert.equal(s.winner.reason, "territory");
});
test("last-round area then HP then tower count then a direct draw", () => {
  for (const tie of ["area", "hp", "tower", "all"]) {
    const s = E.createGame(10);
    s.round = 10;
    if (tie === "area") s.cells[100] = 1;
    if (tie === "hp") s.players[2].hp = 9;
    if (tie === "tower")
      E.removeTower(
        s,
        s.towers.find((t) => t.owner === 2),
      );
    pass(s);
    pass(s);
    if (tie === "all") {
      assert.equal(s.round, 10);
      assert.equal(s.winner.player, 0);
    } else assert.equal(s.winner.player, 1);
  }
});
for (const profile of ["phone", "tablet", "touch-landscape", "desktop"])
  test(`full local match ${profile} finishes with legal entities and independent resources`, () => {
    const s = E.createGame(10, profile);
    let turns = 0;
    while (!s.winner && turns++ < 30) {
      for (const kind of turns % 2
        ? ["move", "missile"]
        : ["missile", "move"]) {
        if (s.winner) break;
        assert.ok(E.chooseAim(s, kind));
        P.launch(
          s,
          { x: Math.sin(turns * 2.1), y: Math.cos(turns * 2.1) },
          0.75,
        );
        let guard = 0;
        while (
          !s.winner &&
          (s.activeBody || s.phase.includes("RELAY")) &&
          guard++ < 10000
        ) {
          if (s.activeBody) P.stepBody(s, 1 / 120);
          else P.launch(s, { x: Math.sin(guard), y: Math.cos(guard) }, 0.6);
        }
        assert.ok(guard < 10000);
        if (!s.winner) assert.equal(s.phase, "IDLE");
      }
      if (!s.winner) {
        assert.equal(s.moveAvailable, false);
        assert.equal(s.actionAvailable, false);
        for (const owner of [1, 2])
          assert.ok(E.legalLanding(s, s.players[owner].pos, owner));
        pass(s);
      }
    }
    assert.ok(s.winner);
    assert.ok(turns <= 22);
    assert.equal(s.activeBody, null);
  });
