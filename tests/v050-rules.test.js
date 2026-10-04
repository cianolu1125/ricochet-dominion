import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../src/engine.js";
import * as P from "../src/physics.js";
const fresh = () => {
  const s = E.createGame();
  s.cells.fill(0);
  s.towers = [];
  s.claims = [];
  s.players[1].pos = { x: 1, y: 10 };
  s.players[2].pos = { x: 16, y: 25 };
  E.recompute(s);
  return s;
};
const tower = (s, owner, x, y, stage = 0) => {
  const t = {
    id: ++s.nextId,
    owner,
    pos: { x, y },
    stage,
    slot: String(s.nextId),
    protected: [],
    relayUsed: false,
  };
  s.towers.push(t);
  E.expand(s, t);
  E.recompute(s);
  return t;
};
const fly = (s) => {
  for (let n = 0; n < 6000 && s.activeBody && !s.winner; n++)
    P.stepBody(s, 1 / 120);
};
const pass = (s) => {
  E.endTurn(s);
  if (!s.winner) E.beginTurn(s);
};
test("custom 1 and 100 rounds finish ties directly at limit", () => {
  for (const n of [1, 100]) {
    const s = E.createGame(n);
    s.round = n;
    pass(s);
    pass(s);
    assert.equal(s.winner?.player, 0);
    assert.equal(s.round, n);
  }
});
test("dynamic claim immediately includes new orthogonal temporary territory and claims it at original deadline", () => {
  const s = fresh();
  for (let x = 3; x <= 6; x++) s.cells[E.index(s, { x, y: 5 })] = 2;
  E.recompute(s);
  s.players[1].pos = { x: 3, y: 5 };
  E.buildTower(s);
  const created = s.claims[0].createdTurn;
  s.cells[E.index(s, { x: 7, y: 5 })] = 2;
  E.recompute(s);
  assert.ok(s.claims[0].cells.includes(E.index(s, { x: 7, y: 5 })));
  assert.equal(s.claims[0].createdTurn, created);
  pass(s);
  pass(s);
  assert.equal(s.cells[E.index(s, { x: 7, y: 5 })], 1);
});
test("rescued claim cancels and does not resurrect on later disconnection", () => {
  const s = fresh();
  for (let x = 3; x <= 6; x++) s.cells[E.index(s, { x, y: 5 })] = 2;
  E.recompute(s);
  s.players[1].pos = { x: 3, y: 5 };
  E.buildTower(s);
  const rescue = tower(s, 2, 6, 5);
  assert.equal(s.claims.length, 0);
  E.removeTower(s, rescue);
  assert.equal(s.claims.length, 0);
  pass(s);
  pass(s);
  assert.equal(s.cells[E.index(s, { x: 5, y: 5 })], 2);
});
test("claim split preserves surviving subregions and excludes diagonal new cells", () => {
  const s = fresh();
  for (let x = 3; x <= 9; x++) s.cells[E.index(s, { x, y: 5 })] = 2;
  E.recompute(s);
  s.players[1].pos = { x: 3, y: 5 };
  E.buildTower(s);
  s.cells[E.index(s, { x: 6, y: 5 })] = 0;
  s.cells[E.index(s, { x: 10, y: 6 })] = 2;
  E.recompute(s);
  const cells = s.claims.flatMap((c) => c.cells);
  assert.ok(cells.includes(E.index(s, { x: 5, y: 5 })));
  assert.ok(cells.includes(E.index(s, { x: 9, y: 5 })));
  assert.ok(!cells.includes(E.index(s, { x: 10, y: 6 })));
  pass(s);
  pass(s);
  assert.equal(s.cells[E.index(s, { x: 9, y: 5 })], 1);
  assert.equal(s.cells[E.index(s, { x: 10, y: 6 })], 2);
});
test("same-side shield overlap survives one tower removal and new owned geometric coverage gets protection", () => {
  const s = fresh();
  const a = tower(s, 1, 5, 5, 1),
    b = tower(s, 1, 7, 5, 1);
  const i = E.index(s, { x: 6, y: 5 });
  assert.deepEqual(new Set(s.protectedBy[i]), new Set([a.id, b.id]));
  E.removeTower(s, a);
  assert.equal(E.protectedOwner(s, i), 1);
  assert.deepEqual(s.protectedBy[i], [b.id]);
  const j = E.index(s, { x: 7, y: 6 });
  s.cells[j] = 0;
  E.recompute(s);
  assert.equal(E.protectedOwner(s, j), 0);
  s.cells[j] = 1;
  E.recompute(s);
  assert.equal(E.protectedOwner(s, j), 1);
});
test("actual capture chain thresholds are 1,1,2,2,3 and used ID bounces", () => {
  const s = fresh();
  const ts = [3, 6, 9, 12, 15].map((x) => tower(s, 1, x, 10));
  E.chooseAim(s, "missile");
  for (let n = 0; n < 5; n++) {
    const t = ts[n];
    P.launch(s, { x: 1, y: 0 }, 0.5);
    Object.assign(s.activeBody, {
      x: t.pos.x - 0.02,
      y: 10.5,
      vx: 8,
      vy: 0,
      ignoreTower: null,
    });
    P.stepBody(s, 1 / 120);
    assert.equal(s.phase, "MISSILE_RELAY_AIM");
    assert.equal(s.charge, [1, 1, 2, 2, 3][n]);
    assert.equal(s.visitedRelayTowerIds.size, n + 1);
  }
  P.launch(s, { x: -1, y: 0 }, 0.5);
  Object.assign(s.activeBody, {
    x: 9.99,
    y: 10.5,
    vx: -8,
    vy: 0,
    ignoreTower: null,
  });
  P.stepBody(s, 1 / 120);
  assert.equal(s.phase, "MISSILE_FLYING");
  assert.ok(s.activeBody.vx > 0);
  assert.equal(s.visitedRelayTowerIds.size, 5);
});
test("Charge zero carries a role instead of ending the projectile at impact", () => {
  const s = fresh();
  s.players[2].pos = { x: 5, y: 10 };
  E.chooseAim(s, "missile");
  P.launch(s, { x: 1, y: 0 }, 1);
  for (let n = 0; n < 40 && !s.activeBody?.carried; n++) P.stepBody(s, 1 / 120);
  assert.equal(s.activeBody?.carried, 2);
  assert.equal(s.charge, 0);
});
for (const [level, total] of [
  [0, 9],
  [1, 25],
  [2, 53],
  [3, 65],
])
  test(`Charge ${level} actual final paint has ${total} center/cross unique cells`, () => {
    const s = fresh();
    E.chooseAim(s, "missile");
    s.charge = level;
    P.launch(s, { x: 1, y: 0 }, 0.1);
    Object.assign(s.activeBody, { x: 8.5, y: 12.5, vx: 0, vy: 0 });
    fly(s);
    assert.equal(E.counts(s)[1], total);
  });
test("cross skips enemy shield, reaches beyond it and cannot destroy remote tower", () => {
  const s = fresh();
  const t = tower(s, 2, 11, 12, 1);
  E.chooseAim(s, "missile");
  s.charge = 3;
  P.launch(s, { x: 1, y: 0 }, 0.1);
  Object.assign(s.activeBody, { x: 8.5, y: 12.5, vx: 0, vy: 0 });
  fly(s);
  assert.ok(s.towers.includes(t));
  assert.equal(s.cells[E.index(s, { x: 11, y: 12 })], 2);
  assert.equal(s.cells[E.index(s, { x: 15, y: 12 })], 1);
});
test("fatal carried release at siege aborts tower removal and every paint operation", () => {
  const s = fresh();
  const t = tower(s, 2, 5, 10, 0);
  s.players[2].hp = 1;
  s.cells[E.index(s, { x: 4, y: 10 })] = 2;
  E.recompute(s);
  const before = [...s.cells];
  s.phase = "MISSILE_FLYING";
  s.charge = 3;
  s.activeBody = {
    x: 5.02,
    y: 10.5,
    vx: 8,
    vy: 0,
    kind: "missile",
    charge: 3,
    carried: 2,
    wasOwn: false,
    trail: [],
  };
  P.stepBody(s, 1 / 120);
  assert.equal(s.winner?.player, 1);
  assert.ok(s.towers.includes(t));
  assert.deepEqual(s.cells, before);
});
