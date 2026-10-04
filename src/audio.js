// Short authored composites share one limited bus; there is no playback backlog.
const voices = {
  ui: [660, 480, 0.055, 0.022],
  launch: [420, 140, 0.14, 0.055],
  fire: [720, 210, 0.16, 0.06],
  bounce: [480, 330, 0.075, 0.04],
  capture: [240, 520, 0.13, 0.04],
  carry: [720, 340, 0.09, 0.04],
  land: [180, 110, 0.1, 0.03],
  damage: [155, 65, 0.16, 0.095],
  blast: [125, 42, 0.28, 0.12],
  destroy: [205, 45, 0.34, 0.13],
  siege: [180, 34, 0.46, 0.17],
  build: [280, 600, 0.26, 0.055],
  grow: [180, 340, 0.28, 0.04],
  disconnect: [390, 170, 0.18, 0.035],
  reconnect: [190, 480, 0.18, 0.04],
  convert: [180, 650, 0.48, 0.075],
  redeploy: [510, 190, 0.4, 0.06],
  handoff: [360, 480, 0.13, 0.03],
  complete: [320, 640, 0.68, 0.06],
  charge: [180, 700, 0.19, 0.055],
  cross: [260, 100, 0.32, 0.055],
};
export class AudioDirector {
  constructor({ enabled = true, volume = 0.65 } = {}) {
    this.enabled = enabled;
    this.volume = volume;
    this.context = null;
    this.duckUntil = 0;
    this.active = [];
    this.generation = 0;
    this.onStateChange = null;
  }
  status() {
    return !this.enabled
      ? "off"
      : this.context?.state === "running"
        ? "ready"
        : "waiting";
  }
  unlock() {
    if (!this.enabled) return;
    try {
      if (this.context?.state === "closed") {
        this.stop();
        this.context = null;
      }
      if (!this.context) {
        const Context =
          globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!Context) return;
        const c = (this.context = new Context());
        this.bus = c.createGain();
        this.master = c.createGain();
        const limiter = c.createDynamicsCompressor();
        limiter.threshold.value = -12;
        limiter.knee.value = 5;
        limiter.ratio.value = 12;
        limiter.attack.value = 0.003;
        limiter.release.value = 0.09;
        this.bus.connect(limiter);
        limiter.connect(this.master);
        this.master.connect(c.destination);
        this.master.gain.value = this.volume;
        this.noise = c.createBuffer(
          1,
          Math.ceil(c.sampleRate * 0.5),
          c.sampleRate,
        );
        const samples = this.noise.getChannelData(0);
        for (let i = 0; i < samples.length; i++)
          samples[i] = Math.random() * 2 - 1;
        c.onstatechange = () => this.onStateChange?.(this.status());
      }
      if (["suspended", "interrupted"].includes(this.context.state))
        this.context
          .resume()
          .then(() => this.onStateChange?.(this.status()))
          .catch(() => {});
    } catch {}
  }
  set(enabled, volume) {
    this.enabled = enabled;
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.master && this.context?.state !== "closed")
      this.master.gain.setTargetAtTime(
        enabled ? this.volume : 0,
        this.context.currentTime,
        0.01,
      );
    if (enabled) this.unlock();
    else this.stop();
    this.onStateChange?.(this.status());
  }
  releaseVoice(voice) {
    for (const source of voice.sources) {
      try {
        source.stop();
        source.disconnect();
      } catch {}
    }
    voice.gain.disconnect();
  }
  play(event) {
    if (!this.enabled || !this.volume || globalThis.document?.hidden) return;
    this.unlock();
    const c = this.context;
    if (!c) return;
    if (["suspended", "interrupted"].includes(c.state)) {
      const generation = this.generation,
        started = performance.now();
      c.resume()
        .then(() => {
          if (
            generation === this.generation &&
            performance.now() - started < 120 &&
            !globalThis.document?.hidden
          )
            this.play(event);
        })
        .catch(() => {});
      return;
    }
    if (c.state !== "running") return;
    try {
      const recipe = voices[event.type];
      if (!recipe) return;
      let [start, end, duration, level] = recipe;
      if (event.type === "charge") {
        const n = event.charge || 1;
        start += n * 45;
        end += n * 120;
        duration = event.maxed ? 0.12 : [0.19, 0.25, 0.33][n - 1];
        level = event.maxed ? 0.028 : 0.04 + n * 0.012;
      }
      if (event.type === "blast" && event.radius === 2) {
        duration = 0.36;
        level = 0.135;
      }
      const now = c.currentTime,
        heavy = ["siege", "blast", "destroy", "damage"].includes(event.type),
        major = ["siege", "convert", "complete"].includes(event.type);
      this.active = this.active.filter((voice) => {
        if (voice.until > now) return true;
        voice.gain.disconnect();
        return false;
      });
      if (this.active.length >= 8) {
        const index = this.active.findIndex((voice) => voice.low);
        this.releaseVoice(this.active.splice(index < 0 ? 0 : index, 1)[0]);
      }
      if (major) {
        this.duckUntil = now + 0.4;
        for (const voice of this.active)
          if (voice.low) {
            voice.gain.gain.cancelScheduledValues(now);
            voice.gain.gain.setTargetAtTime(0.5, now, 0.008);
            voice.gain.gain.setTargetAtTime(1, now + 0.4, 0.05);
          }
      }
      const low = !heavy && !major,
        voice = c.createGain();
      voice.gain.value =
        (low && now < this.duckUntil ? 0.5 : 1) /
        Math.sqrt(1 + this.active.length * 0.14);
      voice.connect(this.bus);
      const active = {
        gain: voice,
        until: now + duration + 0.04,
        low,
        sources: [],
        parts: 0,
      };
      this.active.push(active);
      const variation = 1 + (Math.random() - 0.5) * 0.025;
      const ended = () => {
        if (--active.parts === 0) {
          voice.disconnect();
          this.active = this.active.filter((v) => v !== active);
        }
      };
      const tone = (a, b, at, length, gain, type = "sine") => {
        const oscillator = c.createOscillator(),
          envelope = c.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(a * variation, at);
        oscillator.frequency.exponentialRampToValueAtTime(
          Math.max(20, b * variation),
          at + length,
        );
        envelope.gain.setValueAtTime(0.0001, at);
        envelope.gain.exponentialRampToValueAtTime(gain, at + 0.008);
        envelope.gain.exponentialRampToValueAtTime(0.0001, at + length);
        oscillator.connect(envelope);
        envelope.connect(voice);
        active.sources.push(oscillator);
        active.parts++;
        oscillator.onended = () => {
          oscillator.disconnect();
          envelope.disconnect();
          ended();
        };
        oscillator.start(at);
        oscillator.stop(at + length + 0.015);
      };
      tone(start, end, now, duration, level, heavy ? "sine" : "triangle");
      if (heavy) {
        const noise = c.createBufferSource(),
          filter = c.createBiquadFilter(),
          envelope = c.createGain();
        noise.buffer = this.noise;
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(
          event.type === "siege" ? 2000 : 1200,
          now,
        );
        filter.frequency.exponentialRampToValueAtTime(100, now + duration);
        envelope.gain.setValueAtTime(level * 0.55, now);
        envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        noise.connect(filter);
        filter.connect(envelope);
        envelope.connect(voice);
        active.sources.push(noise);
        active.parts++;
        noise.onended = () => {
          noise.disconnect();
          filter.disconnect();
          envelope.disconnect();
          ended();
        };
        noise.start(now);
        noise.stop(now + duration);
      } else if (
        event.type === "charge" ||
        ["build", "redeploy", "convert"].includes(event.type)
      )
        tone(end, end, now + duration * 0.68, duration * 0.3, level * 0.4);
      else if (event.type === "complete") {
        tone(480, 480, now + 0.2, 0.18, 0.045);
        tone(640, 640, now + 0.4, 0.26, 0.045);
      }
      if (event.type === "blast" && event.charge >= 2)
        tone(280, 110, now + 0.06, 0.24, 0.025);
    } catch {}
  }
  stop() {
    this.generation++;
    for (const voice of this.active) this.releaseVoice(voice);
    this.active = [];
    this.duckUntil = 0;
  }
  suspend() {
    this.stop();
    if (this.context?.state === "running")
      this.context.suspend().catch(() => {});
  }
  resume() {
    if (this.enabled) this.unlock();
  }
}
