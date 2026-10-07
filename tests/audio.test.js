import test from "node:test";
import assert from "node:assert/strict";
import { AudioDirector } from "../src/audio.js";
function harness() {
  let contexts = 0;
  const sources = [];
  const parameter = () => ({
    value: 0,
    setValueAtTime() {},
    setTargetAtTime() {},
    exponentialRampToValueAtTime() {},
    cancelScheduledValues() {},
  });
  const node = () => ({
    gain: parameter(),
    frequency: parameter(),
    threshold: parameter(),
    knee: parameter(),
    ratio: parameter(),
    attack: parameter(),
    release: parameter(),
    connect() {},
    disconnect() {},
  });
  class Context {
    constructor() {
      contexts++;
      this.currentTime = 0;
      this.sampleRate = 8000;
      this.destination = {};
      this.state = "running";
    }
    createGain() {
      return node();
    }
    createDynamicsCompressor() {
      return node();
    }
    createWaveShaper() {
      return node();
    }
    createBiquadFilter() {
      return node();
    }
    createBuffer(c, n) {
      return { getChannelData: () => new Float32Array(n) };
    }
    createOscillator() {
      const s = {
        ...node(),
        start() {
          this.started = true;
        },
        stop(at) {
          this.stopAt = at ?? 0;
        },
      };
      sources.push(s);
      return s;
    }
    createBufferSource() {
      return this.createOscillator();
    }
    resume() {
      return Promise.resolve().then(() => (this.state = "running"));
    }
    suspend() {
      this.state = "suspended";
      return Promise.resolve();
    }
  }
  globalThis.AudioContext = Context;
  return {
    sources,
    get contexts() {
      return contexts;
    },
    cleanup() {
      delete globalThis.AudioContext;
    },
  };
}
test("SFX mute creates no voices; singleton context and master volume are respected", () => {
  const h = harness();
  try {
    const a = new AudioDirector({ enabled: false });
    a.play({ type: "siege" });
    assert.equal(h.contexts, 0);
    a.set(true, 0.25);
    a.play({ type: "bounce" });
    a.play({ type: "damage" });
    assert.equal(h.contexts, 1);
    assert.equal(a.master.gain.value, 0.25);
    const n = h.sources.length;
    a.set(false, 0.9);
    a.play({ type: "siege" });
    assert.equal(h.sources.length, n);
  } finally {
    h.cleanup();
  }
});
test("background cancels active sources rather than preserving audible backlog", () => {
  const h = harness();
  try {
    const a = new AudioDirector();
    a.play({ type: "siege" });
    assert.ok(h.sources.some((s) => s.stopAt > 0));
    a.suspend();
    assert.ok(h.sources.every((s) => s.stopAt === 0));
  } finally {
    h.cleanup();
  }
});
test("first resumed event is retained; pending voice cannot survive a later background", async () => {
  const h = harness();
  try {
    const a = new AudioDirector();
    a.unlock();
    a.context.state = "suspended";
    a.play({ type: "bounce" });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(h.sources.length, 1);
    a.context.state = "suspended";
    a.play({ type: "damage" });
    a.suspend();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(h.sources.length, 1);
  } finally {
    h.cleanup();
  }
});
test("closed contexts rebuild and interrupted contexts resume, sound status remains honest", async () => {
  const h = harness();
  try {
    const a = new AudioDirector();
    a.unlock();
    a.context.state = "closed";
    a.unlock();
    assert.equal(h.contexts, 2);
    a.context.state = "interrupted";
    assert.equal(a.status(), "waiting");
    a.unlock();
    await new Promise((r) => setImmediate(r));
    assert.equal(a.status(), "ready");
    a.set(false, 0.5);
    assert.equal(a.status(), "off");
  } finally {
    h.cleanup();
  }
});
test("rapid genuine impacts have bounded live audio voices and expired voices are not queued", () => {
  const h = harness();
  try {
    const a = new AudioDirector();
    for (let n = 0; n < 40; n++) a.play({ type: n % 2 ? "damage" : "bounce" });
    assert.ok(a.active.length <= 8);
    assert.equal(h.sources.filter((s) => s.started).length >= 40, true);
    a.stop();
    assert.equal(a.active.length, 0);
  } finally {
    h.cleanup();
  }
});

test('all themed sound recipes produce voices, share one context and cleanly stop',async()=>{
 const {themeManager}=await import('../src/themes/theme-manager.js');
 const {audioEvents}=await import('../src/themes/theme-registry.js');
 const h=harness();try{
  const a=new AudioDirector();
  for(const id of ['original','coven','tang']){
   themeManager.request(id);
   for(const type of audioEvents){const n=h.sources.length;a.play({type,charge:3});assert.ok(h.sources.length>n,id+':'+type);assert.ok(a.active.length<=8)}
   a.stop();assert.equal(a.active.length,0);
  }
  assert.equal(h.contexts,1);
 }finally{themeManager.request('original');h.cleanup()}
});
