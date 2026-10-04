import test from "node:test";
import assert from "node:assert/strict";
import * as V from "../src/view.js";
import { createGame } from "../src/engine.js";
test("all profile view transforms invert and desktop never rotates owners", () => {
  for (const profile of ["phone", "tablet", "touch-landscape", "desktop"]) {
    const s = createGame(14, profile),
      p = { x: 2.3, y: 4.1 };
    for (const owner of [1, 2]) {
      const v = V.toView(p, s, owner);
      const q = V.fromView(v, s, owner);
      assert.ok(Math.hypot(q.x - p.x, q.y - p.y) < 1e-9);
      if (profile === "desktop") assert.deepEqual(v, p);
      else if (owner === 2) assert.equal(v.y, s.height - p.y);
    }
  }
});
test("camera is aspect-fit on small phone tablet and desktop sizes", () => {
  for (const [w, h] of [
    [320, 568],
    [390, 844],
    [768, 1024],
    [1024, 768],
    [1440, 900],
  ]) {
    const s = createGame();
    const c = V.camera(s, w, h);
    assert.ok(c.tile > 0);
    assert.ok(c.width <= w && c.height <= h);
    assert.equal(c.width / s.width, c.height / s.height);
  }
});
test("full canvas camera keeps every map edge visible at 320x568", async () => {
  const { battlefieldViewport } = await import("../src/view.js");
  const s = createGame(14, "phone");
  const v = battlefieldViewport(s, 320, 568, 64);
  assert.ok(v.y + v.height <= 564);
  assert.ok(v.x + v.width <= 316);
  assert.ok(v.x >= 0 && v.y >= 0);
});

test("phone camera uses the full width with only a four pixel rim", () => {
  const s = createGame(14, "phone"),
    v = V.battlefieldViewport(s, 390, 844, 64);
  assert.equal(v.x, 4);
  assert.equal(v.width, 382);
  assert.ok(v.y + v.height <= 840);
});
