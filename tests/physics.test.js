import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../src/engine.js";
import * as P from "../src/physics.js";
test("continuous box detects corners and circles return reflection normals", () => {
  assert.deepEqual(
    P.segmentBox(0, 0, 10, 10, { left: 5, right: 6, top: 5, bottom: 6 }),
    { t: 0.5, nx: -1, ny: -1 },
  );
  const c = P.segmentCircle(0, 5, 10, 0, 5, 5, 1);
  assert.equal(c.t, 0.4);
  assert.equal(c.nx, -1);
  assert.equal(P.segmentCircle(0, 0, 10, 0, 5, 5, 1), null);
});
test("exact traversal records tiny diagonal crossings and reverse traversal", () => {
  const s = E.createGame(10);
  assert.deepEqual(
    P.traverseCells(s, { x: 0.1, y: 0.99 }, { x: 2.9, y: 1.01 }),
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
  );
  assert.deepEqual(
    P.traverseCells(s, { x: 2.9, y: 1.01 }, { x: 0.1, y: 0.99 }),
    [
      { x: 2, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 0 },
      { x: 0, y: 0 },
    ],
  );
});
test("aim cancel returns unspent token while relay stop finishes committed projectile", () => {
  const s = E.createGame(10);
  E.chooseAim(s, "missile");
  P.cancelAim(s);
  assert.equal(s.actionAvailable, true);
  E.chooseAim(s, "missile");
  P.launch(s, { x: 1, y: 0 }, 0.5);
  assert.equal(P.cancelAim(s), false);
  while (s.activeBody) P.stepBody(s, 1 / 120);
  assert.equal(s.actionAvailable, false);
});
test("wall reflection remains in bounds and frame sizes produce same result", () => {
  const finals = [];
  for (const dt of [1 / 120, 1 / 60, 1 / 30]) {
    const s = E.createGame(10);
    s.towers = [];
    s.players[1].pos = { x: 1, y: 15 };
    E.chooseAim(s, "move");
    P.launch(s, { x: -1, y: 0.1 }, 1);
    let n = 0;
    while (s.activeBody && n++ < 1000) P.stepBody(s, dt);
    assert.equal(s.phase, "IDLE");
    assert.ok(E.inside(s, s.players[1].pos));
    finals.push(s.players[1].pos);
  }
  assert.deepEqual(finals[0], finals[1]);
  assert.deepEqual(finals[0], finals[2]);
});
test("four relays reach Charge II and departure does not consume origin tower", () => {
  const s = E.createGame(10);
  s.towers = [];
  s.players[1].pos = { x: 2, y: 15 };
  s.players[2].pos = { x: 17, y: 31 };
  for (let n = 0; n < 4; n++)
    s.towers.push({
      id: ++s.nextId,
      owner: 1,
      slot: String(n),
      pos: { x: 4 + n * 2, y: 15 },
      stage: 0,
      protected: [],
      relayUsed: false,
    });
  E.chooseAim(s, "missile");
  P.launch(s, { x: 1, y: 0 }, 1);
  for (let n = 0; n < 4; n++) {
    while (s.activeBody) P.stepBody(s, 1 / 120);
    assert.equal(s.charge, [1, 1, 2, 2][n]);
    if (n < 3) P.launch(s, { x: 1, y: 0 }, 1);
  }
  assert.equal(s.actionAvailable, false);
});
