import test from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { RelayHUD } from "../src/relay-hud.js";
import { createGame } from "../src/engine.js";
test("repeated relay HUD activation continues from current brightness", () => {
  const w = new Window();
  const el = w.document.createElement("div");
  el.innerHTML =
    '<div id="relay-track"></div><span id="relay-count"></span><span id="relay-skill"></span>';
  const hud = new RelayHUD(el),
    s = createGame();
  hud.sync(s, 0, "en", { 1: "#fff", 2: "#000" });
  hud.activate(0);
  hud.sync(s, 100, "en", { 1: "#fff", 2: "#000" });
  const before = Number(el.style.getPropertyValue("--relay-focus"));
  hud.activate(100);
  hud.sync(s, 100, "en", { 1: "#fff", 2: "#000" });
  assert.ok(Number(el.style.getPropertyValue("--relay-focus")) >= before);
});

test('new turns wake after handoff; clicks restart 200/2500/800 envelope', () => {
  const w=new Window(), el=w.document.createElement('div');
  el.innerHTML='<div id="relay-track"></div><span id="relay-count"></span><span id="relay-skill"></span>';
  const hud=new RelayHUD(el), s=createGame(), team={1:'#fff',2:'#000'};
  hud.sync(s,0,'en',team); hud.sync(s,200,'en',team); assert.equal(hud.focus(200),1);
  assert.equal(hud.focus(2700),1); assert.equal(hud.focus(3100),0.5); assert.equal(hud.focus(3500),0);
  hud.activate(3100); assert.equal(hud.focus(3100),0.5); assert.equal(hud.focus(3300),1);
  assert.equal(hud.focus(5800),1); assert.equal(hud.focus(6200),0.5);
  s.phase='HANDOFF'; s.current=2; hud.sync(s,7000,'en',team,false);
  s.phase='IDLE'; s.turnIndex++; hud.sync(s,7600,'en',team); hud.sync(s,7800,'en',team);
  assert.equal(hud.focus(7800),1); assert.equal(hud.focus(10300),1);
});
test('completed missile does not truncate the progress display hold',()=>{
  const w=new Window(), el=w.document.createElement('div');
  el.innerHTML='<div id="relay-track"></div><span id="relay-count"></span><span id="relay-skill"></span>';
  const hud=new RelayHUD(el), s=createGame(), team={1:'#fff',2:'#000'};
  hud.sync(s,0,'en',team); s.phase='MISSILE_RELAY_AIM'; s.visitedRelayTowerIds.add(1);
  hud.sync(s,4000,'en',team); s.phase='IDLE'; s.visitedRelayTowerIds.clear();
  hud.sync(s,4200,'en',team); hud.sync(s,5500,'en',team);
  assert.equal(hud.focus(5500),1);
  assert.equal(el.querySelector("#relay-count").textContent,"Relay 1/5");
  assert.equal(el.querySelector("#relay-skill").textContent,"Charge Ⅰ · Expansion");
  hud.sync(s,7500,"en",team);
  assert.equal(el.querySelector("#relay-count").textContent,"Relay 0/5");
});
