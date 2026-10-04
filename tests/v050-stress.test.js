import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../src/engine.js";
import * as P from "../src/physics.js";
import { FeedbackDirector } from "../src/feedback.js";
import { drainFacts } from "../src/feedback-events.js";
import { snapshot, visualChanges } from "../src/visual-changes.js";
test("100-round combat/territory transactions keep feedback and map resources bounded", () => {
  const s = E.createGame(100),
    director = new FeedbackDirector({ play() {} }),
    transitions = new Map();
  let time = 0,
    turns = 0,
    relays = 0,
    builds = 0,
    redeploys = 0;
  while (!s.winner && turns < 200) {
    const owner = s.current,
      before = snapshot(s);
    // Controlled legal fixture locations keep both sides below early-win thresholds.
    s.players[owner].pos = {
      x: 2 + ((Math.floor(turns / 2) % 11) % 6) * 2,
      y: (owner === 1 ? 26 : 4) + Math.floor((Math.floor(turns / 2) % 11) / 6),
    };
    if (turns % 3 === 0 && !E.towerReason(s)) {
      const own = s.towers.filter((t) => t.owner === owner),
        oldId = own[0].id;
      if (E.buildTower(s, own.length === 5 ? own[0].slot : undefined)) {
        builds++;
        if (!s.towers.some((t) => t.id === oldId)) redeploys++;
      }
    } else {
      E.chooseAim(s, "missile");
      P.launch(s, { x: 0, y: owner === 1 ? 1 : -1 }, 0.3);
      let guard = 0;
      while (s.activeBody && !s.winner && guard++ < 2000) {
        P.stepBody(s, 1 / 120);
        time += 1000 / 120;
        director.submit(drainFacts(s), time);
        director.update(time);
      }
      assert.ok(guard < 2000);
      if (s.phase.includes("RELAY")) {
        relays++;
        P.cancelAim(s);
      }
    }
    director.submit(
      visualChanges(s, before, drainFacts(s), time, false, transitions),
      time,
    );
    time += 1000;
    director.update(time);
    for (const [i, tr] of transitions)
      if (time >= tr.born + tr.delay + tr.duration) transitions.delete(i);
    assert.ok(director.effects.length < 20);
    assert.ok(s.claims.length <= 10);
    assert.ok(s.towers.length <= 10);
    assert.ok(s.feedbackFacts.length === 0);
    assert.ok(s.cells.every((c) => c === 0 || c === 1 || c === 2));
    assert.ok(E.endTurn(s));
    if (!s.winner) E.beginTurn(s);
    turns++;
  }
  assert.equal(turns, 200);
  assert.equal(s.round, 100);
  assert.ok(s.winner);
  assert.ok(builds > 10);
  assert.ok(redeploys > 5);
  assert.ok(relays > 5);
  director.clear();
  assert.equal(director.effects.length, 0);
  assert.equal(transitions.size, 0);
});
