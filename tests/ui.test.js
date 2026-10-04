import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Window } from "happy-dom";
import { build } from "esbuild";
import * as E from "../src/engine.js";
import { battlefieldViewport } from "../src/view.js";
async function setup(width = 390, height = 844, touch = true, reduceMotion = false) {
  const b = await build({
    entryPoints: ["src/main.js"],
    bundle: true,
    write: false,
    format: "iife",
    loader: { ".css": "empty" },
    plugins: [{name:"fixture",setup(builder){builder.onLoad({filter:/src\/main\.js$/},async(args)=>({contents:(await readFile(args.path,"utf8"))+"\nwindow.useFixtureForTest=s=>{state=s;update();};",loader:"js"}));}}],
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
    matches: q.includes("pointer") ? touch : q.includes("reduced-motion") ? reduceMotion : false,
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
    new Proxy({}, { get: () => () => {}, set: () => true });
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
      assert.equal(a.read().players[1].hp, 10);
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
      a.click('[data-panel="ready"]');
      a.tick(450);
      a.tick(600);
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

test('opponent HP is optional and precision controls are removed', async () => {
  const a = await setup();
  try {
    a.click('[data-panel="start"]');
    assert.equal(a.w.document.querySelector('#opponent').hidden, true);
    a.click('#opponent-toggle');
    assert.equal(a.w.document.querySelector('#opponent').hidden, false);
    assert.match(a.w.document.querySelector('#opponent-info').textContent, /10\/10 HP/);
    a.click('#opponent-close');
    assert.equal(a.w.document.querySelector('#opponent').hidden, true);
    assert.equal(a.w.document.querySelector('#precision'), null);
    assert.equal(a.w.document.querySelector('#fab').closest('footer').id, 'toolbar');
  } finally { await a.close(); }
});
for (const kind of ['move', 'missile'])
  test(`${kind}: drag starts far from origin; tap spends nothing; release launches`, async () => {
    const a = await setup();
    try {
      a.click('[data-panel="start"]');
      a.click(`[data-action="${kind === 'move' ? 'move' : 'action'}"]`);
      if (kind === "missile") a.click('[data-action="missile"]');
      const event = (name, x, y) => a.canvas.dispatchEvent(new a.w.PointerEvent(name, { pointerId: 9, button: 0, clientX: x, clientY: y, bubbles: true }));
      event('pointerdown', 180, 200);
      event('pointerup', 180, 200);
      assert.equal(a.read().phase, kind === 'move' ? 'MOVE_AIM' : 'MISSILE_AIM');
      event('pointerdown', 180, 200);
      event('pointermove', 180, 280);
      event('pointerup', 180, 280);
      assert.equal(a.read().phase, kind === 'move' ? 'MOVE_FLYING' : 'MISSILE_FLYING');
      assert.equal(kind === 'move' ? a.read().moveAvailable : a.read().actionAvailable, false);
    } finally { await a.close(); }
  });

for (const kind of ['move', 'missile']) test(`${kind}: drop cancellation preserves turn token`, async () => {
 const a = await setup();
 try {
 a.click('[data-panel="start"]');
 a.click(`[data-action="${kind === 'move' ? 'move' : 'action'}"]`);
 if(kind==='missile') a.click('[data-action="missile"]');
 const z=a.w.document.querySelector('#cancel-zone');
 z.getBoundingClientRect=()=>({left:0,right:390,top:780,bottom:844});
 const event=(name,x,y)=>a.canvas.dispatchEvent(new a.w.PointerEvent(name,{pointerId:5,button:0,clientX:x,clientY:y,bubbles:true}));
 event('pointerdown',180,200);event('pointermove',180,810);
 assert.equal(a.w.document.querySelector('#game').classList.contains('cancel-armed'),true);
 event('pointerup',180,810);
 assert.equal(a.read().phase,'IDLE');
 assert.equal(a.read().moveAvailable,true);assert.equal(a.read().actionAvailable,true);
 }finally{await a.close();}
});
test('language switches instantly without resetting match; future modes disabled',async()=>{
 const a=await setup();try{
 assert.equal(a.w.document.querySelector('[data-panel="tutorial"]').disabled,true);
 assert.equal(a.w.document.querySelector('[data-panel="computer"]').disabled,true);
 a.click('[data-panel="start"]');const before=a.read();a.click('#menu');a.click('[data-panel="lang-en"]');
 assert.match(a.w.document.querySelector('#panel').textContent,/Settings/);
 assert.equal(a.w.localStorage.getItem('ricochet.language'),'en');
 a.click('[data-panel="close"]');assert.equal(a.w.document.querySelector('[data-action="move"]').textContent,'Move');
 assert.deepEqual(a.read().players,before.players);
 }finally{await a.close();}
});
test('End Turn remains usable from uncommitted aim',async()=>{
 const a=await setup();try{a.click('[data-panel="start"]');a.click('[data-action="move"]');a.click('#fab');assert.equal(a.read().phase,'HANDOFF');}finally{await a.close();}
});
for(const kind of ['move','missile']) test(`${kind}: committed relay cancel retains origin and charge`,async()=>{
 const a=await setup();try{
 a.click('[data-panel="start"]');a.click(`[data-action="${kind==='move'?'move':'action'}"]`);if(kind==='missile')a.click('[data-action="missile"]');
 const event=(name,x,y)=>a.canvas.dispatchEvent(new a.w.PointerEvent(name,{pointerId:8,button:0,clientX:x,clientY:y,bubbles:true}));
 // Shoot toward the near wall. Its reflection returns to the starting friendly outpost.
 event('pointerdown',180,300);event('pointerup',180,220);
 for(let i=0;i<1600 && a.read().phase.includes('FLYING');i++) a.tick(16);
 assert.equal(a.read().phase,kind==='move'?'MOVE_RELAY_AIM':'MISSILE_RELAY_AIM');
 const before=a.read();a.click('#cancel-zone');const after=a.read();
 assert.equal(after.phase,before.phase);assert.deepEqual(after.towers,before.towers);assert.equal(after.charge,before.charge);assert.deepEqual(after.players,before.players);
 }finally{await a.close();}
});
test('End Turn settles a committed relay using existing stop rules',async()=>{
 const a=await setup();try{
 a.click('[data-panel="start"]');a.click('[data-action="action"]');a.click('[data-action="missile"]');
 const event=(name,x,y)=>a.canvas.dispatchEvent(new a.w.PointerEvent(name,{pointerId:8,button:0,clientX:x,clientY:y,bubbles:true}));
 event('pointerdown',180,300);event('pointerup',180,220);
 for(let i=0;i<1600 && a.read().phase.includes('FLYING');i++)a.tick(16);
 assert.equal(a.read().phase,'MISSILE_RELAY_AIM');a.click('#fab');assert.equal(a.read().phase,'HANDOFF');
 }finally{await a.close();}
});
test('Escape from home settings returns home rather than starting a match',async()=>{
 const a=await setup();try{a.click('[data-panel="settings"]');a.w.document.dispatchEvent(new a.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.ok(a.w.document.querySelector('[data-panel="start"]'));assert.equal(a.w.document.querySelector('#overlay').hidden,false);}finally{await a.close();}
});

test('redeploy selection survives Settings and language switching',async()=>{
 const a=await setup();try{
 a.click('[data-panel="start"]');const s=E.createGame();s.players[1].pos={x:8,y:25};
 for(const x of [2,4,6,8]) {s.towers.push({id:++s.nextId,owner:1,pos:{x,y:28},stage:0,slot:String(s.nextId),protected:[],relayUsed:false});}
 E.recompute(s);a.w.useFixtureForTest(s);
 a.click('[data-action="action"]');a.click('[data-action="tower"]');
 a.click('#menu');a.click('[data-panel="lang-en"]');a.click('[data-panel="close"]');
 const r=a.canvas.getBoundingClientRect(),view=battlefieldViewport(s,r.width,r.height,64),target=s.towers.find(t=>t.owner===1);
 a.canvas.dispatchEvent(new a.w.PointerEvent('pointerdown',{pointerId:4,button:0,clientX:view.x+(target.pos.x+.5)*view.tile,clientY:view.y+(target.pos.y+.5)*view.tile,bubbles:true}));
 assert.equal(a.read().actionAvailable,false);assert.ok(a.read().towers.some(t=>t.owner===1 && t.pos.x===8 && t.pos.y===25));
 }finally{await a.close();}
});

test('new turn settlement waits for rotation and controls wait for effects',async()=>{
 const a=await setup();try{
 a.click('[data-panel="start"]');const s=E.createGame();
 const blue=s.towers.find(t=>t.owner===2);blue.stage=0;
 a.w.useFixtureForTest(s);a.click('#fab');const before=a.read();
 a.click('[data-panel="ready"]');
 assert.equal(a.read().phase,'HANDOFF');assert.deepEqual(a.read().towers,before.towers);
 a.tick(200);assert.equal(a.read().phase,'HANDOFF');assert.deepEqual(a.read().towers,before.towers);
 a.tick(450);assert.equal(a.read().phase,'IDLE');assert.ok(a.read().towers.find(t=>t.owner===2).stage>0);
 assert.equal(a.w.document.querySelector('#stack').hidden,true);
 assert.equal(a.w.document.querySelector('#fab').disabled,true);
 a.tick(600);assert.equal(a.w.document.querySelector('#stack').hidden,false);assert.equal(a.w.document.querySelector('#fab').disabled,false);
 }finally{await a.close();}
});

// Disabling camera rotation must not bypass the outpost growth presentation lock.
test('reduced motion still waits for outpost growth effects before input',async()=>{
 const a=await setup(390,844,true,true);try{
 a.click('[data-panel="start"]');const s=E.createGame();s.towers.find(t=>t.owner===2).stage=0;a.w.useFixtureForTest(s);
 a.click('#fab');a.click('[data-panel="ready"]');assert.equal(a.read().phase,'IDLE');
 a.tick(150);assert.equal(a.w.document.querySelector('#fab').disabled,true);assert.equal(a.w.document.querySelector('#stack').hidden,true);
 a.tick(400);assert.equal(a.w.document.querySelector('#fab').disabled,false);assert.equal(a.w.document.querySelector('#stack').hidden,false);
 }finally{await a.close();}
});
