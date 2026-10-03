import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../src/engine.js";
import { launch, stepMissile, abandon } from "../src/physics.js";
for (const rounds of [10, 14, 18])
  test(`complete ${rounds}-Round draw match reaches result without deadlock`, () => {
    const s = E.createGame(rounds);
    let turns = 0;
    while (!s.winner && turns < 50) {
      assert.ok(E.stay(s));
      assert.ok(E.finishTactic(s));
      assert.ok(E.endTurn(s));
      if (!s.winner) assert.ok(E.beginTurn(s));
      turns++;
    }
    assert.equal(s.winner.player, 0);
    assert.equal(turns, (rounds + 1) * 2);
  });
test("complete moving, tower-building, firing match ends with a valid winner", () => {
  const s = E.createGame(10);
  let turns = 0;
  while (!s.winner && turns < 24) {
    const moves = E.legalMoves(s);
    if (moves.length) E.moveRole(s, moves[(turns * 37) % moves.length]);
    else E.stay(s);
    if (turns % 3 === 0 && !E.towerReason(s)) {
      const own = s.towers.filter((t) => t.owner === s.current);
      assert.ok(E.buildTower(s, own.length === 3 ? own[0].slot : undefined));
    } else {
      E.chooseMissiles(s);
      while (!s.winner && s.missilesRemaining > 0) {
        assert.ok(
          launch(s, { x: Math.sin(turns + 1), y: Math.cos(turns + 1) }, 0.7),
        );
        for (let n = 0; n < 1000 && s.activeMissile; n++)
          stepMissile(s, 1 / 120);
        assert.equal(s.activeMissile, null);
        if (s.shotOpen) abandon(s);
      }
      if (!s.winner && s.phase !== "TURN_END") E.finishTactic(s);
    }
    if (!s.winner) {
      assert.ok(E.endTurn(s));
      if (!s.winner) E.beginTurn(s);
    }
    turns++;
    assert.ok(s.towers.filter((t) => t.owner === 1).length <= 3);
    assert.ok(s.towers.filter((t) => t.owner === 2).length <= 3);
    for (const t of s.towers)
      for (const i of t.protected) assert.equal(s.cells[i], t.owner);
  }
  assert.ok(s.winner);
  assert.equal(s.phase, "GAME_OVER");
});
test("dismantle removes tower locks and consumes role action", () => {
  const s = E.createGame();
  s.current = 2;
  s.players[2].pos = { x: 8, y: 10 };
  s.phase = "TACTICAL_CHOICE";
  E.buildTower(s);
  E.growTowers(s, 2);
  s.current = 1;
  s.phase = "ROLE_ACTION";
  s.players[1].pos = { x: 7, y: 10 };
  assert.ok(E.dismantle(s, "A"));
  assert.equal(s.phase, "TACTICAL_CHOICE");
  assert.equal(s.towers.length, 0);
  assert.equal(E.protectedOwner(s, 10 * 18 + 8), 0);
  assert.equal(s.cells[10 * 18 + 8], 2);
});
test("invalid redeploy never deletes old tower", () => {
  const s = E.createGame();
  for (let n = 0; n < 3; n++) {
    s.players[1].pos = { x: 4 + n * 4, y: 20 };
    s.phase = "TACTICAL_CHOICE";
    E.buildTower(s);
  }
  s.players[1].pos = { x: 5, y: 10 };
  s.towers.push({
    owner: 2,
    slot: "A",
    stage: 0,
    pos: { x: 5, y: 10 },
    protected: [185],
  });
  s.phase = "TACTICAL_CHOICE";
  const before = structuredClone(s.towers);
  assert.equal(E.buildTower(s, "A"), false);
  assert.deepEqual(s.towers, before);
});
