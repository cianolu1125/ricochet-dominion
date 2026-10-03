import test from "node:test";
import assert from "node:assert/strict";
import { createGame, buildTower } from "../src/engine.js";
import {
  launch,
  stepMissile,
  abandon,
  segmentBox,
  previewImpact,
} from "../src/physics.js";
import { toView, fromView } from "../src/view.js";
const aim = () => {
  const s = createGame();
  s.phase = "MISSILE_AIM";
  return s;
};
test("zero/invalid power is rejected without consuming ammo", () => {
  const s = aim();
  assert.equal(launch(s, { x: 1, y: 0 }, 0), false);
  assert.equal(launch(s, { x: NaN, y: 0 }, 1), false);
  assert.equal(s.missilesRemaining, 3);
});
test("wall reflection consumes speed and stays within bounds", () => {
  const s = aim();
  s.players[1].pos = { x: 17, y: 20 };
  launch(s, { x: 1, y: 0 }, 1);
  for (let i = 0; i < 8; i++) stepMissile(s, 1 / 120);
  assert.ok(s.activeMissile.vx < 0);
  assert.ok(s.activeMissile.x < 18);
});
test("own tower captures; relaunches never spend extra ammo and can repeat tower", () => {
  const s = aim();
  s.players[1].pos = { x: 8, y: 25 };
  s.phase = "TACTICAL_CHOICE";
  buildTower(s);
  s.players[1].pos = { x: 8, y: 22 };
  s.phase = "TACTICAL_CHOICE";
  buildTower(s);
  s.players[1].pos = { x: 8, y: 28 };
  s.phase = "MISSILE_AIM";
  launch(s, { x: 0, y: -1 }, 0.5);
  for (let i = 0; i < 600 && s.activeMissile; i++) stepMissile(s, 1 / 120);
  assert.equal(s.relay.slot, "A");
  assert.equal(s.missilesRemaining, 2);
  for (let n = 0; n < 6; n++) {
    assert.ok(launch(s, { x: 0, y: n % 2 ? 1 : -1 }, 0.5));
    assert.equal(s.missilesRemaining, 2);
    for (let i = 0; i < 600 && s.activeMissile; i++) stepMissile(s, 1 / 120);
    assert.equal(s.phase, "MISSILE_AIM");
    assert.equal(s.relay.slot, n % 2 ? "A" : "B");
  }
});
test("enemy tower reflects and does not disappear", () => {
  const s = aim();
  s.towers = [
    { owner: 2, slot: "A", pos: { x: 8, y: 25 }, stage: 0, protected: [] },
  ];
  s.players[1].pos = { x: 8, y: 28 };
  launch(s, { x: 0, y: -1 }, 0.6);
  let reflected = false;
  for (let i = 0; i < 120 && s.activeMissile; i++) {
    stepMissile(s, 1 / 120);
    if (s.activeMissile?.vy > 0) reflected = true;
  }
  assert.ok(reflected);
  assert.equal(s.towers.length, 1);
});
test("launch from tower same cell clears its body and returns may recapture", () => {
  const s = aim();
  s.phase = "TACTICAL_CHOICE";
  buildTower(s);
  s.phase = "MISSILE_AIM";
  assert.ok(launch(s, { x: 0, y: -1 }, 0.5));
  stepMissile(s, 1 / 120);
  assert.equal(s.phase, "MISSILE_FLYING");
  abandon(s);
  assert.equal(s.phase, "MISSILE_AIM");
  assert.equal(s.missilesRemaining, 2);
});
test("missile hitting enemy explodes immediately and damages once", () => {
  const s = aim();
  s.players[1].pos = { x: 8, y: 20 };
  s.players[2].pos = { x: 8, y: 18 };
  launch(s, { x: 0, y: -1 }, 0.5);
  for (let i = 0; i < 120 && s.activeMissile; i++) stepMissile(s, 1 / 120);
  assert.equal(s.players[2].hp, 2);
  assert.equal(s.cells[18 * 18 + 8], 1);
});
test("continuous box hit at high speed has expected normal", () => {
  const h = segmentBox(0, 0, 10, 0, { left: 4, right: 5, top: -1, bottom: 1 });
  assert.equal(h.t, 0.4);
  assert.equal(h.nx, -1);
});
test("portrait 180 and landscape inverse transforms preserve all grid coordinates", () => {
  for (const desktop of [false, true])
    for (const owner of [1, 2])
      for (let y = 0; y < 32; y++)
        for (let x = 0; x < 18; x++) {
          const p = { x: x + 0.5, y: y + 0.5 };
          assert.deepEqual(
            fromView(toView(p, desktop, owner), desktop, owner),
            p,
          );
        }
});
test("short aim guide reports only first collision without mutating state", () => {
  const s = aim();
  s.players[1].pos = { x: 8, y: 20 };
  s.towers = [
    { owner: 1, slot: "A", pos: { x: 8, y: 18 }, stage: 0, protected: [] },
  ];
  const before = structuredClone(s);
  assert.equal(previewImpact(s, { x: 0, y: -1 }, 4).type, "capture");
  assert.equal(previewImpact(s, { x: 1, y: 0 }, 4), null);
  assert.deepEqual(s, before);
});
