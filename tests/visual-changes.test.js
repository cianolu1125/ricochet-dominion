import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../src/engine.js";
import { snapshot, visualChanges } from "../src/visual-changes.js";
import { tilePresentation, FeedbackDirector } from "../src/feedback.js";
test("large conversion lands within 650ms and only rule-approved cells change", () => {
  const s = E.createGame(10),
    source = s.towers.find((t) => t.owner === 1),
    cells = Array.from({ length: 200 }, (_, i) => i + 100);
  for (const i of cells) {
    s.cells[i] = 2;
    s.stability[i] = "temporary";
  }
  s.claims = [{ id: 999, captor: 1, target: 2, cells, sources: [source.id] }];
  const b = snapshot(s);
  s.claims = [];
  for (const i of cells) s.cells[i] = 1;
  const tr = new Map();
  const events = visualChanges(s, b, [], 0, false, tr);
  assert.equal(events.filter((e) => e.type === "convert").length, 1);
  assert.equal(tr.size, 200);
  for (const [i, t] of tr) {
    assert.ok(cells.includes(i));
    assert.ok(t.delay + t.duration <= 650);
    assert.equal(tilePresentation(t, t.delay + 50).owner, 2);
    assert.equal(tilePresentation(t, 650).owner, 1);
  }
});
test("siege plays one main sound and only one set of tower fragments", () => {
  const s = E.createGame(10),
    tower = s.towers.find((t) => t.owner === 2),
    b = snapshot(s);
  E.siege(s, tower, tower.pos);
  const ev = visualChanges(
    s,
    b,
    [
      {
        type: "siege",
        eventId: "siege",
        groupId: "impact",
        owner: 1,
        x: tower.pos.x + 0.5,
        y: tower.pos.y + 0.5,
        radius: 2,
        targetOwner: 2,
      },
    ],
    0,
    false,
    new Map(),
  );
  const heard = [],
    d = new FeedbackDirector({ play: (e) => heard.push(e.type) });
  d.submit(ev, 0);
  assert.deepEqual(heard, ["siege"]);
  assert.equal(d.effects.filter((e) => e.type === "destroy").length, 0);
  assert.equal(d.impulses, 1);
});
test("redeployment retracts old tower, plays build visually, one composite sound", () => {
  const s = E.createGame(10);
  for (const x of [2, 4, 6, 8])
    s.towers.push({
      id: ++s.nextId,
      slot: String(x),
      pos: { x, y: 28 },
      owner: 1,
      stage: 0,
      protected: [],
      relayUsed: false,
    });
  E.recompute(s);
  s.players[1].pos = { x: 8, y: 25 };
  const b = snapshot(s);
  assert.ok(E.buildTower(s, "A"));
  const ev = visualChanges(s, b, [], 0, false, new Map()),
    heard = [],
    d = new FeedbackDirector({ play: (e) => heard.push(e.type) });
  d.submit(ev, 0);
  assert.ok(ev.some((e) => e.type === "redeploy"));
  assert.ok(ev.some((e) => e.type === "build"));
  assert.deepEqual(heard, ["redeploy"]);
  assert.equal(d.impulses, 0);
});
test("cross tile travel is bounded across full map and conversion facts are not duplicated", () => {
  const s = E.createGame(10),
    b = snapshot(s);
  s.cells.fill(1);
  const tr = new Map(),
    ev = visualChanges(
      s,
      b,
      [
        {
          type: "blast",
          eventId: "xb",
          groupId: "x",
          owner: 1,
          x: 8.5,
          y: 12.5,
          radius: 2,
          charge: 3,
        },
        {
          type: "cross",
          eventId: "xc",
          groupId: "x",
          owner: 1,
          x: 8.5,
          y: 12.5,
          width: 18,
          height: 32,
          charge: 2,
          shielded: [],
        },
      ],
      0,
      false,
      tr,
    );
  assert.ok([...tr.values()].every((t) => t.delay <= 240));
  const c = visualChanges(
    s,
    b,
    [{ type: "convert", eventId: "cv", groupId: "c", cells: [1, 2] }],
    0,
    false,
    new Map(),
  );
  assert.equal(c.filter((e) => e.type === "convert").length, 1);
});
