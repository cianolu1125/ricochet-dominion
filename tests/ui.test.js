import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Window } from "happy-dom";
import { build } from "esbuild";
import * as E from "../src/engine.js";
import { battlefieldViewport } from "../src/view.js";
async function setup(
  width = 390,
  height = 844,
  touch = true,
  reduceMotion = false,
) {
  const b = await build({
    entryPoints: ["src/main.js"],
    bundle: true,
    write: false,
    format: "iife",
    loader: { ".css": "empty" },
    plugins: [
      {
        name: "fixture",
        setup(builder) {
          builder.onLoad({ filter: /src\/main\.js$/ }, async (args) => ({
            contents:
              (await readFile(args.path, "utf8")) +
              "\nwindow.useFixtureForTest=s=>{state=s;update();};window.freezeForTest=until=>{feedback.freezeUntil=until;};",
            loader: "js",
          }));
        },
      },
    ],
  });
  const w = new Window({
    url: "https://example.test",
    settings: {
      disableCSSFileLoading: true,
      disableJavaScriptFileLoading: true,
    },
  });
  w.document.write(
    (await readFile("index.html", "utf8")).replace(
      /<script[\s\S]*?<\/script>/g,
      "",
    ),
  );
  w.matchMedia = (q) => ({
    matches: q.includes("pointer")
      ? touch
      : q.includes("reduced-motion")
        ? reduceMotion
        : false,
    addEventListener() {},
  });
  Object.defineProperty(w, "innerWidth", { value: width, writable: true });
  Object.defineProperty(w, "innerHeight", { value: height, writable: true });
  w.ResizeObserver = class {
    observe() {}
  };
  w.structuredClone = structuredClone;
  let frames = [],
    time = 0,
    tool;
  w.performance.now = () => time;
  w.requestAnimationFrame = (f) => {
    frames.push(f);
    return 1;
  };
  w.document.modelContext = { registerTool: (t) => (tool = t) };
  const canvas = w.document.getElementById("board");
  canvas.getContext = () =>
    new Proxy({}, { get: (o,key) => key === "measureText" ? text => ({width: text.length * .35}) : key === "createLinearGradient" || key === "createRadialGradient" ? () => ({addColorStop(){}}) : () => {}, set: () => true });
  canvas.parentElement.getBoundingClientRect = () => ({
    width: w.innerWidth,
    height: w.innerHeight,
  });
  Object.defineProperty(canvas, "clientWidth", {
    get: () => parseFloat(canvas.style.width) || 1,
  });
  Object.defineProperty(canvas, "clientHeight", {
    get: () => parseFloat(canvas.style.height) || 1,
  });
  canvas.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: canvas.clientWidth,
    height: canvas.clientHeight,
  });
  canvas.setPointerCapture = () => {};
  canvas.hasPointerCapture = () => false;
  w.eval(b.outputFiles[0].text);
  const click = (sel) => {
    const el = w.document.querySelector(sel);
    assert.ok(el, sel);
    assert.equal(el.disabled, false, sel);
    el.click();
  };
  return {
    w,
    canvas,
    click,
    read: () => tool.execute({}),
    tick(ms) {
      time += ms;
      const q = frames;
      frames = [];
      q.forEach((f) => f(time));
    },
    close: () => w.happyDOM.abort(),
  };
}
for (const [width, height, touch] of [
  [320, 568, true],
  [390, 844, true],
  [768, 1024, true],
  [1024, 768, true],
  [1440, 900, false],
])
  test(`UI ${width}x${height}: free-order menu cancel handoff resize`, async () => {
    const a = await setup(width, height, touch);
    try {
      a.click('[data-panel="start"]');
      assert.equal(a.read().players[1].hp, 14);
      assert.ok(a.w.document.querySelector('[data-action="move"]'));
      assert.ok(a.w.document.querySelector('[data-action="action"]'));
      a.click('[data-action="action"]');
      a.click('[data-action="missile"]');
      assert.equal(a.read().phase, "MISSILE_AIM");
      a.click("#cancel-zone");
      assert.equal(a.read().actionAvailable, true);
      a.click('[data-action="root"]');
      a.click('[data-action="move"]');
      assert.equal(a.read().phase, "MOVE_AIM");
      a.click("#cancel-zone");
      assert.equal(a.read().moveAvailable, true);
      a.click("#fab");
      assert.equal(a.read().phase, "HANDOFF");

      a.tick(400);
      a.tick(200);
      a.tick(650);
      assert.equal(a.read().current, 2);
      const before = a.read();
      a.w.innerWidth = height;
      a.w.innerHeight = width;
      a.w.dispatchEvent(new a.w.Event("resize"));
      assert.deepEqual(a.read().players, before.players);
      assert.equal(a.read().width, before.width);
      a.click("#help");
      a.click('[data-panel="close"]');
      assert.equal(a.read().phase, "IDLE");
    } finally {
      await a.close();
    }
  });

test("opponent info comes from the enemy and disappears for aim", async () => {
  const a = await setup();
  try {
    a.click('[data-panel="start"]');
    assert.equal(a.w.document.querySelector("#opponent-toggle"), null);
    assert.equal(a.w.document.querySelector("#opponent").hidden, false);
    a.tick(2600);
    a.tick(150);
    assert.equal(a.w.document.querySelector("#opponent").hidden, true);
    const s = a.read(),
      v = battlefieldViewport(s, a.canvas.clientWidth, a.canvas.clientHeight),
      p = s.players[2].pos;
    a.canvas.dispatchEvent(
      new a.w.PointerEvent("pointerdown", {
        button: 0,
        clientX: v.x + (p.x + 0.5) * v.tile,
        clientY: v.y + (p.y + 0.5) * v.tile,
        pointerId: 1,
      }),
    );
    assert.equal(a.w.document.querySelector("#opponent").hidden, false);
    a.click('[data-action="move"]');
    assert.equal(a.w.document.querySelector("#opponent").hidden, true);
  } finally {
    await a.close();
  }
});
for (const kind of ["move", "missile"])
  test(`${kind}: drag starts far from origin; tap spends nothing; release launches`, async () => {
    const a = await setup();
    try {
      a.click('[data-panel="start"]');
      a.click(`[data-action="${kind === "move" ? "move" : "action"}"]`);
      if (kind === "missile") a.click('[data-action="missile"]');
      const event = (name, x, y) =>
        a.canvas.dispatchEvent(
          new a.w.PointerEvent(name, {
            pointerId: 9,
            button: 0,
            clientX: x,
            clientY: y,
            bubbles: true,
          }),
        );
      event("pointerdown", 180, 200);
      event("pointerup", 180, 200);
      assert.equal(
        a.read().phase,
        kind === "move" ? "MOVE_AIM" : "MISSILE_AIM",
      );
      event("pointerdown", 180, 200);
      event("pointermove", 180, 280);
      event("pointerup", 180, 280);
      assert.equal(
        a.read().phase,
        kind === "move" ? "MOVE_FLYING" : "MISSILE_FLYING",
      );
      assert.equal(
        kind === "move" ? a.read().moveAvailable : a.read().actionAvailable,
        false,
      );
    } finally {
      await a.close();
    }
  });

for (const kind of ["move", "missile"])
  test(`${kind}: drop cancellation preserves turn token`, async () => {
    const a = await setup();
    try {
      a.click('[data-panel="start"]');
      a.click(`[data-action="${kind === "move" ? "move" : "action"}"]`);
      if (kind === "missile") a.click('[data-action="missile"]');
      const z = a.w.document.querySelector("#cancel-zone");
      z.getBoundingClientRect = () => ({
        left: 0,
        right: 390,
        top: 780,
        bottom: 844,
      });
      const event = (name, x, y) =>
        a.canvas.dispatchEvent(
          new a.w.PointerEvent(name, {
            pointerId: 5,
            button: 0,
            clientX: x,
            clientY: y,
            bubbles: true,
          }),
        );
      event("pointerdown", 180, 200);
      event("pointermove", 180, 810);
      assert.equal(
        a.w.document.querySelector("#game").classList.contains("cancel-armed"),
        true,
      );
      event("pointerup", 180, 810);
      assert.equal(a.read().phase, "IDLE");
      assert.equal(a.read().moveAvailable, true);
      assert.equal(a.read().actionAvailable, true);
    } finally {
      await a.close();
    }
  });
test("language switches instantly without resetting match; future modes disabled", async () => {
  const a = await setup();
  try {
    assert.equal(
      a.w.document.querySelector('[data-panel="tutorial"]').disabled,
      true,
    );
    assert.equal(
      a.w.document.querySelector('[data-panel="computer"]').disabled,
      true,
    );
    a.click('[data-panel="start"]');
    const before = a.read();
    a.click("#menu");
    a.click('[data-panel="lang-en"]');
    assert.match(a.w.document.querySelector("#panel").textContent, /Settings/);
    assert.equal(a.w.localStorage.getItem("ricochet.language"), "en");
    a.click('[data-panel="close"]');
    assert.equal(
      a.w.document.querySelector('[data-action="move"]').textContent,
      "Move",
    );
    assert.deepEqual(a.read().players, before.players);
  } finally {
    await a.close();
  }
});
test("End Turn remains usable from uncommitted aim", async () => {
  const a = await setup();
  try {
    a.click('[data-panel="start"]');
    a.click('[data-action="move"]');
    a.click("#fab");
    assert.equal(a.read().phase, "HANDOFF");
  } finally {
    await a.close();
  }
});
for (const kind of ["move", "missile"])
  test(`${kind}: committed relay cancel retains origin and charge`, async () => {
    const a = await setup();
    try {
      a.click('[data-panel="start"]');
      a.click(`[data-action="${kind === "move" ? "move" : "action"}"]`);
      if (kind === "missile") a.click('[data-action="missile"]');
      const event = (name, x, y) =>
        a.canvas.dispatchEvent(
          new a.w.PointerEvent(name, {
            pointerId: 8,
            button: 0,
            clientX: x,
            clientY: y,
            bubbles: true,
          }),
        );
      // Shoot toward the near wall. Its reflection returns to the starting friendly outpost.
      event("pointerdown", 180, 300);
      event("pointerup", 180, 220);
      for (let i = 0; i < 1600 && a.read().phase.includes("FLYING"); i++)
        a.tick(16);
      assert.equal(
        a.read().phase,
        kind === "move" ? "MOVE_RELAY_AIM" : "MISSILE_RELAY_AIM",
      );
      const before = a.read();
      a.click("#cancel-zone");
      const after = a.read();
      assert.equal(after.phase, before.phase);
      assert.deepEqual(after.towers, before.towers);
      assert.equal(after.charge, before.charge);
      assert.deepEqual(after.players, before.players);
    } finally {
      await a.close();
    }
  });
test("End Turn settles a committed relay using existing stop rules", async () => {
  const a = await setup();
  try {
    a.click('[data-panel="start"]');
    a.click('[data-action="action"]');
    a.click('[data-action="missile"]');
    const event = (name, x, y) =>
      a.canvas.dispatchEvent(
        new a.w.PointerEvent(name, {
          pointerId: 8,
          button: 0,
          clientX: x,
          clientY: y,
          bubbles: true,
        }),
      );
    event("pointerdown", 180, 300);
    event("pointerup", 180, 220);
    for (let i = 0; i < 1600 && a.read().phase.includes("FLYING"); i++)
      a.tick(16);
    assert.equal(a.read().phase, "MISSILE_RELAY_AIM");
    a.click("#fab");
    assert.equal(a.read().phase, "HANDOFF");
  } finally {
    await a.close();
  }
});
test("Escape from home settings returns home rather than starting a match", async () => {
  const a = await setup();
  try {
    a.click('[data-panel="settings"]');
    a.w.document.dispatchEvent(
      new a.w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    assert.ok(a.w.document.querySelector('[data-panel="start"]'));
    assert.equal(a.w.document.querySelector("#overlay").hidden, false);
  } finally {
    await a.close();
  }
});

test("redeploy selection survives Settings and language switching", async () => {
  const a = await setup();
  try {
    a.click('[data-panel="start"]');
    const s = E.createGame();
    s.players[1].pos = { x: 8, y: 25 };
    for (const x of [2, 4, 6, 8]) {
      s.towers.push({
        id: ++s.nextId,
        owner: 1,
        pos: { x, y: 28 },
        stage: 0,
        slot: String(s.nextId),
        protected: [],
        relayUsed: false,
      });
    }
    E.recompute(s);
    a.w.useFixtureForTest(s);
    a.click('[data-action="action"]');
    a.click('[data-action="tower"]');
    a.click("#menu");
    a.click('[data-panel="lang-en"]');
    a.click('[data-panel="close"]');
    const r = a.canvas.getBoundingClientRect(),
      view = battlefieldViewport(s, r.width, r.height, 64),
      target = s.towers.find((t) => t.owner === 1);
    a.canvas.dispatchEvent(
      new a.w.PointerEvent("pointerdown", {
        pointerId: 4,
        button: 0,
        clientX: view.x + (target.pos.x + 0.5) * view.tile,
        clientY: view.y + (target.pos.y + 0.5) * view.tile,
        bubbles: true,
      }),
    );
    assert.equal(a.read().actionAvailable, false);
    assert.ok(
      a
        .read()
        .towers.some((t) => t.owner === 1 && t.pos.x === 8 && t.pos.y === 25),
    );
  } finally {
    await a.close();
  }
});

test("new turn settlement waits for rotation and controls wait for effects", async () => {
  const a = await setup();
  try {
    a.click('[data-panel="start"]');
    const s = E.createGame();
    const blue = s.towers.find((t) => t.owner === 2);
    blue.stage = 0;
    a.w.useFixtureForTest(s);
    a.click("#fab");
    const before = a.read();

    assert.equal(a.read().phase, "HANDOFF");
    assert.deepEqual(a.read().towers, before.towers);
    a.tick(200);
    assert.equal(a.read().phase, "HANDOFF");
    assert.deepEqual(a.read().towers, before.towers);
    a.tick(200);
    assert.equal(a.read().phase, "HANDOFF");
    assert.deepEqual(a.read().towers, before.towers);
    a.tick(199);
    assert.equal(a.read().phase, "HANDOFF");
    a.tick(1);
    assert.equal(a.read().phase, "IDLE");
    assert.ok(a.read().towers.find((t) => t.owner === 2).stage > 0);
    assert.equal(a.w.document.querySelector("#stack").hidden, true);
    assert.equal(a.w.document.querySelector("#fab").disabled, true);
    a.tick(600);
    assert.equal(a.w.document.querySelector("#stack").hidden, false);
    assert.equal(a.w.document.querySelector("#fab").disabled, false);
  } finally {
    await a.close();
  }
});

// Disabling camera rotation must not bypass the outpost growth presentation lock.
test("reduced motion still waits for outpost growth effects before input", async () => {
  const a = await setup(390, 844, true, true);
  try {
    a.click('[data-panel="start"]');
    const s = E.createGame();
    s.towers.find((t) => t.owner === 2).stage = 0;
    a.w.useFixtureForTest(s);
    a.click("#fab");
    assert.equal(a.read().phase, "HANDOFF");
    a.tick(200);
    assert.equal(a.read().phase, "IDLE");
    a.tick(30);
    assert.equal(a.w.document.querySelector("#fab").disabled, true);
    assert.equal(a.w.document.querySelector("#stack").hidden, true);
    a.tick(400);
    assert.equal(a.w.document.querySelector("#fab").disabled, false);
    assert.equal(a.w.document.querySelector("#stack").hidden, false);
  } finally {
    await a.close();
  }
});

test("HUD occupies its own layout row rather than overlaying the map", async () => {
  const css = await readFile("src/style.css", "utf8");
  assert.match(css, /#game[^}]*display:\s*(flex|grid)/);
  assert.match(css, /#battlefield[^}]*position:\s*relative/);
  assert.match(css, /#toolbar[^}]*position:\s*relative/);
});

test("sound, volume and reduced motion persist without changing match state", async () => {
  const a = await setup();
  try {
    a.click('[data-panel="start"]');
    const before = a.read();
    a.click("#menu");
    a.click('[data-panel="sound"]');
    assert.equal(a.w.localStorage.getItem("rd-sound"), "off");
    const input = a.w.document.querySelector("#volume");
    input.value = "25";
    input.dispatchEvent(new a.w.Event("input", { bubbles: true }));
    assert.equal(a.w.localStorage.getItem("rd-volume"), "0.25");
    a.click('[data-panel="reduced"]');
    assert.equal(a.w.localStorage.getItem("rd-reduced"), "on");
    a.click('[data-panel="close"]');
    assert.deepEqual(a.read().players, before.players);
    assert.equal(
      a.w.document.querySelector("#game").classList.contains("reduced"),
      true,
    );
  } finally {
    await a.close();
  }
});
test("consumed move removes the node and its connector on the next idle menu", async () => {
  const a = await setup();
  try {
    a.click('[data-panel="start"]');
    const s = E.createGame();
    s.moveAvailable = false;
    a.w.useFixtureForTest(s);
    assert.equal(a.w.document.querySelector('[data-action="move"]'), null);
    assert.equal(a.w.document.querySelectorAll(".branch-lines path").length, 1);
    assert.ok(a.w.document.querySelector('[data-action="action"]'));
  } finally {
    await a.close();
  }
});
test("audio preference changes do not turn system reduced-motion into an explicit override", async () => {
  const a = await setup();
  try {
    a.click('[data-panel="settings"]');
    a.click('[data-panel="sound"]');
    assert.equal(a.w.localStorage.getItem("rd-reduced"), null);
  } finally {
    await a.close();
  }
});
test("outpost selection shows only the actual return-node connector", async () => {
  const a = await setup();
  try {
    a.click('[data-panel="start"]');
    const s = E.createGame();
    s.players[1].pos = { x: 8, y: 25 };
    for (const x of [2, 4, 6, 8])
      s.towers.push({
        id: ++s.nextId,
        owner: 1,
        pos: { x, y: 28 },
        stage: 0,
        slot: String(x),
        protected: [],
        relayUsed: false,
      });
    E.recompute(s);
    a.w.useFixtureForTest(s);
    a.click('[data-action="action"]');
    a.click('[data-action="tower"]');
    assert.equal(a.w.document.querySelectorAll("#stack button").length, 1);
    assert.equal(a.w.document.querySelectorAll(".branch-lines path").length, 1);
  } finally {
    await a.close();
  }
});

for (const result of [
  { player: 1, reason: "hp" },
  { player: 2, reason: "score" },
  { player: 0, reason: "draw" },
])
  test(`result ${result.player}: menu exit cannot be reopened by old winner`, async () => {
    const a = await setup();
    try {
      a.click('[data-panel="start"]');
      const s = E.createGame();
      s.winner = result;
      s.phase = "GAME_OVER";
      a.w.useFixtureForTest(s);
      a.click('[data-panel="home"]');
      assert.ok(a.w.document.querySelector('[data-panel="start"]'));
      assert.equal(a.w.document.querySelector('[data-panel="home"]'), null);
      a.tick(1000);
      assert.ok(a.w.document.querySelector('[data-panel="start"]'));
      a.click('[data-panel="start"]');
      assert.equal(a.read().winner, null);
    } finally {
      await a.close();
    }
  });
for(const rounds of [10,14,18]) test(`fixed mode ${rounds} exposes correct HP in menu and HUD`, async()=>{
 const a=await setup();try{
  assert.equal(a.w.document.querySelector('[data-panel="custom"]'),null);
  a.click(`[data-panel="round-${rounds}"]`);
  const card=a.w.document.querySelector(`[data-panel="round-${rounds}"]`);
  assert.ok(card.textContent.includes(`${rounds} HP`));
  a.click('[data-panel="start"]');
  assert.equal(a.read().maxRounds,rounds);assert.equal(a.read().players[1].maxHp,rounds);
  assert.ok(a.w.document.querySelector('#current').textContent.includes(`${rounds}/${rounds} HP`));
  assert.equal(a.w.document.querySelectorAll('#current .hp-bar i').length,rounds);
 }finally{await a.close();}
});
test("relay HUD has actual capacity nodes and localized frameless skill, then clears on new turn", async () => {
  const a = await setup();
  try {
    a.click('[data-panel="start"]');
    const s = E.createGame();
    for (const x of [2, 4]) {
      s.towers.push({
        id: ++s.nextId,
        owner: 1,
        pos: { x, y: 28 },
        stage: 0,
        slot: String(x),
        protected: [],
      });
    }
    s.phase = "MISSILE_RELAY_AIM";
    s.committed = true;
    s.charge = 2;
    s.visitedRelayTowerIds = new Set(
      s.towers.filter((t) => t.owner === 1).map((t) => t.id),
    );
    s.relay = { pos: { x: 4, y: 28 } };
    a.w.useFixtureForTest(s);
    assert.equal(a.w.document.querySelectorAll(".relay-node").length, 5);
    assert.match(
      a.w.document.querySelector("#relay-skill").textContent,
      /Charge Ⅱ · 切割/,
    );
    assert.match(
      a.w.document.querySelector("#relay-count").textContent,
      /3\/5/,
    );
    a.click("#menu");
    a.click('[data-panel="lang-en"]');
    a.click('[data-panel="close"]');
    assert.equal(
      a.w.document.querySelector("#relay-skill").textContent,
      "Charge Ⅱ · Crosscut",
    );
    a.click("#fab");
    a.tick(400);
    a.tick(200);
    a.tick(650);
    assert.equal(a.w.document.querySelectorAll(".relay-node").length, 5);
    assert.equal(a.w.document.querySelector("#relay-skill").textContent, "");
  } finally {
    await a.close();
  }
});
test("drag beginning on relay HUD reaches battlefield aim without consuming a tap", async () => {
  const a = await setup();
  try {
    a.click('[data-panel="start"]');
    a.click('[data-action="action"]');
    a.click('[data-action="missile"]');
    const hit = a.w.document.querySelector("#relay-track");
    const ev = (name, y) =>
      hit.dispatchEvent(
        new a.w.PointerEvent(name, {
          button: 0,
          pointerId: 7,
          clientX: 180,
          clientY: y,
          bubbles: true,
        }),
      );
    ev("pointerdown", 40);
    ev("pointermove", 120);
    ev("pointerup", 120);
    assert.equal(a.read().phase, "MISSILE_FLYING");
  } finally {
    await a.close();
  }
});

test("HUD keyboard activation never invokes the document End Turn shortcut", async () => {
  const a = await setup();
  try {
    a.click('[data-panel="start"]');
    for (const key of ["Enter", " "]) {
      const before = a.read();
      a.w.document
        .querySelector("#relay-track")
        .dispatchEvent(
          new a.w.KeyboardEvent("keydown", { key, bubbles: true }),
        );
      assert.deepEqual(a.read(), before);
    }
  } finally {
    await a.close();
  }
});
test("thaw frames discard frozen elapsed time even when RAF jumps over the stop", async () => {
  for (const intermediate of [false, true]) {
    const a = await setup();
    try {
      a.click('[data-panel="start"]');
      const s = E.createGame();
      E.chooseAim(s, "MOVE");
      s.phase = "MOVE_FLYING";
      s.activeBody = {
        kind: "role",
        owner: 1,
        x: 8,
        y: 15,
        vx: 10,
        vy: 0,
        visited: new Set(),
        ignoreTower: null,
        elapsed: 0,
        trail: [],
      };
      a.w.useFixtureForTest(s);
      a.w.freezeForTest(40);
      if (intermediate) {
        a.tick(20);
        assert.equal(s.activeBody.x, 8);
        a.tick(30);
      } else a.tick(50);
      assert.ok(
        s.activeBody.x - 8 <= 0.101,
        `frozen displacement ${s.activeBody.x - 8}`,
      );
    } finally {
      await a.close();
    }
  }
});
for (const kind of ['move','missile']) test(`v052 ${kind}: button entry exposes relay before any drag`, async()=>{
 const a=await setup();try{
  a.click('[data-panel="start"]');
  const s=E.createGame();a.w.useFixtureForTest(s);
  if(kind==='missile'){a.click('[data-action="action"]');a.click('[data-action="missile"]');}
  else a.click('[data-action="move"]');
  assert.equal(s.phase,kind==='move'?'MOVE_AIM':'MISSILE_AIM');
  assert.equal(E.relayStatus(s,s.towers[0]),'available');
 }finally{await a.close();}
});
function takeoverFixture(a,count=0) {
 const s=E.createGame();s.cells.fill(0);s.towers=[];s.players[1].pos={x:7,y:10};s.players[2].pos={x:12,y:18};
 const target={id:++s.nextId,owner:2,pos:{x:8,y:10},stage:1,state:'overloaded',overloadExpiresTurn:1,slot:'A',protected:[]};s.towers.push(target);E.expand(s,target);
 for(let i=0;i<count;i++){const t={id:++s.nextId,owner:1,pos:{x:2+i*2,y:4},stage:0,state:'normal',slot:'ABCDE'[i],protected:[]};s.towers.push(t);E.expand(s,t);}
 E.recompute(s);a.w.useFixtureForTest(s);return {s,target};
}
function tapTower(a,s,t) {const v=battlefieldViewport(s,a.canvas.clientWidth,a.canvas.clientHeight);a.canvas.dispatchEvent(new a.w.PointerEvent('pointerdown',{button:0,pointerId:77,clientX:v.x+(t.pos.x+.5)*v.tile,clientY:v.y+(t.pos.y+.5)*v.tile,bubbles:true}));}
test('contextual takeover submits without extra end-turn click',async()=>{const a=await setup();try{a.click('[data-panel="start"]');const {s,target}=takeoverFixture(a);a.click('[data-action="action"]');assert.equal(a.w.document.querySelector('[data-action="tower"]').textContent,'接管');a.click('[data-action="tower"]');assert.equal(target.state,'contested');assert.equal(s.phase,'HANDOFF');a.tick(400);a.tick(200);a.tick(1500);assert.equal(s.phase,'IDLE');assert.equal(s.current,2);}finally{await a.close();}});
test('five-tower takeover cancels safely then replaces selected normal tower',async()=>{const a=await setup();try{a.click('[data-panel="start"]');const {s,target}=takeoverFixture(a,5);a.click('[data-action="action"]');a.click('[data-action="tower"]');assert.equal(target.state,'overloaded');assert.ok(a.w.document.querySelector('#stack').textContent.includes('选择撤除据点'));a.click('[data-action="action"]');assert.equal(s.towers.length,6);a.click('[data-action="tower"]');const old=s.towers.find(t=>t.owner===1);tapTower(a,s,old);assert.equal(target.state,'contested');assert.equal(s.towers.length,5);assert.equal(s.phase,'HANDOFF');}finally{await a.close();}});
test('contextual reclaim restores and triggers handoff',async()=>{const a=await setup();try{a.click('[data-panel="start"]');const {s,target}=takeoverFixture(a);target.owner=1;target.state='contested';target.contestedBy=2;target.contestedResolveTurn=2;E.recompute(s);a.w.useFixtureForTest(s);a.click('[data-action="action"]');assert.equal(a.w.document.querySelector('[data-action="tower"]').textContent,'收复');a.click('[data-action="tower"]');assert.equal(target.state,'normal');assert.equal(s.phase,'HANDOFF');}finally{await a.close();}});
