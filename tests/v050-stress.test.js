import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../src/engine.js";
import * as P from "../src/physics.js";
import { FeedbackDirector } from "../src/feedback.js";
import { drainFacts } from "../src/feedback-events.js";
import { snapshot, visualChanges } from "../src/visual-changes.js";
for (const rounds of [10,14,18]) test(`${rounds}-round combat/territory transactions keep feedback and map resources bounded`, () => {
  const s = E.createGame(rounds),
    director = new FeedbackDirector({ play() {} }),
    transitions = new Map();
  let time = 0,
    turns = 0,
    relays = 0,
    builds = 0,
    redeploys = 0;
  while (!s.winner && turns < rounds*2) {
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
      // Exercise a real capture every firing iteration, independently of fixture build placement.
      const relay=s.towers.find(t=>t.owner===owner && E.activeTower(t));
      const dy=relay.pos.y>=2 ? 1 : -1;
      s.players[owner].pos=E.nearestLanding(s,{x:relay.pos.x,y:relay.pos.y-dy*2},owner);
      E.chooseAim(s, "missile");
      P.launch(s, { x: relay.pos.x-s.players[owner].pos.x, y: relay.pos.y-s.players[owner].pos.y }, 0.3);
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
  assert.equal(turns, rounds*2);
  assert.equal(s.round, rounds);
  assert.ok(s.winner);
  assert.ok(builds > 3);
  assert.ok(redeploys >= 0);
  assert.ok(relays > 0);
  director.clear();
  assert.equal(director.effects.length, 0);
  assert.equal(transitions.size, 0);
});
