import { stabilize } from './territory-fixture.js';
import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../src/engine.js";
import * as P from "../src/physics.js";
const setup = () => {
  const s = E.createGame(10);
  s.cells.fill(0);
  s.towers = [];
  s.claims = [];
  s.players[1].pos = { x: 2, y: 10 };
  s.players[2].pos = { x: 12, y: 10 };
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
const fire = (s, kind = "missile", direction = { x: 1, y: 0 }, power = 1) => {
  E.chooseAim(s, kind);
  return P.launch(s, direction, power);
};
const fly = (s) => {
  for (let n = 0; n < 2000 && s.activeBody; n++) P.stepBody(s, 1 / 120);
};
test("one committed missile consumes action but preserves move", () => {
  const s = setup();
  assert.ok(fire(s));
  assert.equal(s.actionAvailable, false);
  assert.equal(s.moveAvailable, true);
  fly(s);
  assert.equal(E.chooseAim(s, "missile"), false);
  assert.ok(E.chooseAim(s, "move"));
});
test("T13/14 ready tower captures once, spent reflects, resets next own turn", () => {
  const s = setup();
  const t = tower(s, 1, 5, 10);
  fire(s);
  fly(s);
  assert.equal(s.phase, "MISSILE_RELAY_AIM");
  assert.equal(s.charge, 1);
  assert.equal(t.relayUsed, true);
  P.launch(s, { x: -1, y: 0 }, 0.1);
  fly(s);
  s.phase = "IDLE";
  E.endTurn(s);
  E.beginTurn(s);
  E.endTurn(s);
  E.beginTurn(s);
  assert.equal(t.relayUsed, false);
});
test("T15/30 role can use newly built tower without missile relay cost", () => {
  const s = setup();
  s.players[1].pos = { x: 5, y: 10 };
  E.buildTower(s);
  const t = s.towers[0];
  s.players[1].pos = { x: 2, y: 10 };
  fire(s, "move");
  fly(s);
  assert.equal(s.phase, "MOVE_RELAY_AIM");
  assert.equal(t.relayUsed, false);
  assert.equal(s.charge, 0);
});
test("T16/17 charge0 impact reads color before carrying", () => {
  for (const c of [0, 1, 2]) {
    const s = setup();
    s.players[2].pos = { x: 5, y: 10 };
    s.cells[E.index(s, s.players[2].pos)] = c;
    if(c===1) stabilize(s,1,[s.players[2].pos]);
    E.recompute(s);
    fire(s);
    for (let n = 0; n < 40 && !s.activeBody?.carried; n++)
      P.stepBody(s, 1 / 120);
    assert.equal(s.players[2].hp, c === 1 ? 9 : 10);
    assert.equal(s.activeBody.carried, 2);
  }
});
test("T18 own protected color does not cause territory damage", () => {
  const s = setup();
  s.players[2].pos = { x: 5, y: 10 };
  tower(s, 2, 5, 10, 2);
  fire(s);
  for (let n = 0; n < 40 && !s.activeBody?.carried; n++) P.stepBody(s, 1 / 120);
  assert.equal(s.players[2].hp, 10);
  assert.equal(s.towers.length, 1);
});
test("T19/20/21/22 swept carried entries apply once per color transition", () => {
  const s = setup();
  s.players[2].pos = { x: 3, y: 10 };
  for (const x of [3, 4, 6, 8]) s.cells[E.index(s, { x, y: 10 })] = 1;
  stabilize(s,1,[3,4,6,8].map(x=>({x,y:10})));
  E.recompute(s);
  E.chooseAim(s, "missile");
  s.charge = 1;
  P.launch(s, { x: 1, y: 0 }, 1);
  P.stepBody(s, 0.4);
  assert.equal(s.players[2].hp, 7);
  assert.ok(s.activeBody?.carried);
});
test("T23 carried role released before hostile relay tower along incoming path", () => {
  const s = setup();
  s.players[2].pos = { x: 3, y: 10 };
  const t = tower(s, 1, 6, 10);
  E.chooseAim(s, "missile");
  s.charge = 1;
  P.launch(s, { x: 1, y: 0 }, 1);
  fly(s);
  assert.equal(s.phase, "MISSILE_RELAY_AIM");
  assert.deepEqual(s.players[2].pos, { x: 5, y: 10 });
  assert.equal(s.charge, 1);
  assert.notDeepEqual(s.players[2].pos, t.pos);
});
test("T24 new trajectory does not automatically recapture released role", () => {
  const s = setup();
  s.players[2].pos = { x: 3, y: 10 };
  tower(s, 1, 6, 10);
  E.chooseAim(s, "missile");
  s.charge = 1;
  P.launch(s, { x: 1, y: 0 }, 1);
  fly(s);
  P.launch(s, { x: 1, y: 0 }, 0.3);
  P.stepBody(s, 1 / 120);
  assert.equal(s.activeBody.carried, null);
});
test("T25 chargeII paints center 3x3 and full row/column", () => {
  const s = setup();
  E.chooseAim(s, "missile");
  s.charge = 2;
  P.launch(s, { x: 1, y: 0 }, 0.1);
  fly(s);
  assert.equal(E.counts(s)[1], 53);
});
test("T26 siege removes tower before blast and respects overlapping protection", () => {
  const s = setup();
  const t = tower(s, 2, 5, 10, 2);
  E.chooseAim(s, "missile");
  s.charge = 3;
  P.launch(s, { x: 1, y: 0 }, 1);
  fly(s);
  assert.equal(s.towers.includes(t), false);
  assert.equal(s.cells[E.index(s, { x: 5, y: 10 })], 1);
});
test("T27 fatal impact aborts explosion immediately", () => {
  const s = setup();
  s.players[2].pos = { x: 5, y: 10 };
  s.players[2].hp = 1;
  s.cells[E.index(s, s.players[2].pos)] = 1;
  stabilize(s,1,[s.players[2].pos]);
  E.recompute(s);
  const before = [...s.cells];
  fire(s);
  fly(s);
  assert.equal(s.winner.player, 1);
  assert.deepEqual(s.cells, before);
  assert.equal(s.activeBody, null);
});
test("T33 role reflects enemy tower and role without HP change", () => {
  for (const obstacle of ["tower", "role"]) {
    const s = setup();
    if (obstacle === "tower") tower(s, 2, 5, 10);
    else s.players[2].pos = { x: 5, y: 10 };
    fire(s, "move");
    for (let n = 0; n < 20; n++) P.stepBody(s, 1 / 120);
    assert.ok(s.activeBody.vx < 0);
    assert.equal(s.players[1].hp, 10);
    assert.equal(s.players[2].hp, 10);
    fly(s);
    assert.notDeepEqual(s.players[1].pos, { x: 5, y: 10 });
  }
});
test("T34 role visited towers and spent missile towers bounce", () => {
  for (const kind of ["move", "missile"]) {
    const s = setup();
    const t = tower(s, 1, 5, 10);
    E.chooseAim(s, kind);
    if (kind === "move") s.moveVisited = [t.id];
    else {
      t.relayUsed = true;
      s.visitedRelayTowerIds.add(t.id);
    }
    P.launch(s, { x: 1, y: 0 }, 1);
    for (let n = 0; n < 20; n++) P.stepBody(s, 1 / 120);
    assert.ok(s.activeBody.vx < 0);
    assert.equal(s.charge, 0);
  }
});

test("shared tower still permits role capture on a short low-speed tick", () => {
  const s = setup();
  s.players[2].pos = { x: 5, y: 5 };
  tower(s, 2, 5, 5);
  s.phase = "MISSILE_FLYING";
  s.activeBody = {
    x: 5.02,
    y: 5.5,
    vx: 2,
    vy: 0,
    kind: "missile",
    charge: 0,
    carried: null,
    trail: [],
  };
  P.stepBody(s, 1 / 120);
  assert.equal(s.players[2].hp, 10);
  assert.equal(s.phase, "MISSILE_FLYING");
  assert.equal(s.activeBody.carried, 2);
});
test("offset diagonal carry release follows actual incoming line, not tower center", () => {
  const s = setup();
  const t = tower(s, 1, 5, 5);
  const m = { x: 5.03, y: 5.4, vx: 1, vy: 1, carried: 2, wasEnemy: false };
  P.releaseBefore(s, m, t);
  assert.deepEqual(s.players[2].pos, { x: 4, y: 5 });
});
test("fatal damage during release stops all subsequent position and carry changes", () => {
  const s = setup();
  const t = tower(s, 1, 5, 5);
  s.players[2].hp = 1;
  s.players[2].pos = { x: 2, y: 2 };
  s.cells[E.index(s, { x: 4, y: 5 })] = 1;
  E.recompute(s);
  const m = { x: 5.03, y: 5.5, vx: 1, vy: 0, carried: 2, wasEnemy: false };
  P.releaseBefore(s, m, t);
  assert.equal(s.winner.player, 1);
  assert.deepEqual(s.players[2].pos, { x: 2, y: 2 });
  assert.equal(m.carried, 2);
});
