const priority = {
  siege: 100,
  complete: 110,
  convert: 90,
  destroy: 80,
  blast: 75,
  damage: 85,
  redeploy: 60,
  build: 55,
  cross: 72,
  charge: 50,
  capture: 45,
  fire: 40,
  launch: 40,
  grow: 35,
  disconnect: 30,
  reconnect: 30,
  carry: 25,
  land: 20,
  bounce: 15,
  handoff: 10,
  ui: 5,
};
export function chargeSpec(level, maxed = false) {
  if (maxed) return { count: 4, radius: 0.7, duration: 120, layers: 1 };
  return [
    { count: 6, radius: 0.95, duration: 190, layers: 1 },
    { count: 10, radius: 1.25, duration: 250, layers: 2 },
    { count: 16, radius: 1.8, duration: 330, layers: 2 },
  ][Math.max(0, Math.min(2, level - 1))];
}
export function effectDuration(e) {
  return e.type === "damage"
    ? 560
    : e.type === "charge"
      ? chargeSpec(e.charge, e.maxed).duration
      : e.type === "bounce"
        ? 120
        : e.type === "cross"
          ? 440
          : e.type === "siege"
            ? 520
            : e.type === "destroy"
              ? 480
              : e.type === "build"
                ? 260
                : e.type === "redeploy"
                  ? 420
                  : e.type === "grow"
                    ? 320
                    : e.type === "fire" || e.type === "launch"
                      ? 160
                      : e.type === "capture"
                        ? 130
                        : 350;
}
export function tilePresentation(tr, time, reduced = false) {
  const p = Math.max(0, Math.min(1, (time - tr.born - tr.delay) / tr.duration));
  // First rise, then fall. Color commits visually at landing, never on ascent.
  const lift =
    reduced || !tr.wave
      ? 0
      : p < 0.3
        ? Math.sin(((p / 0.3) * Math.PI) / 2)
        : p < 0.7
          ? Math.cos((((p - 0.3) / 0.4) * Math.PI) / 2)
          : 0;
  return {
    progress: p,
    owner: p < 0.7 ? tr.from : tr.to,
    lift,
    scale: 1 + lift * (tr.soft ? 0.025 : 0.05),
  };
}
export class FeedbackDirector {
  constructor(audio) {
    this.audio = audio;
    this.effects = [];
    this.seen = new Set();
    this.impulses = 0;
    this.reduced = false;
    this.envelope = null;
    this.damageCount = 0;
    this.freezeUntil = 0;
  }
  submit(events, time) {
    const groups = new Map();
    for (const e of events) {
      if (this.seen.has(e.eventId)) continue;
      this.seen.add(e.eventId);
      const f = { ...e, born: time, duration: effectDuration(e) };
      if (e.type === "damage")
        f.drift = [0.9, -0.9, 0.3, -0.4][this.damageCount++ % 4];
      if (
        ![
          "ui",
          "handoff",
          "complete",
          "disconnect",
          "reconnect",
          "convert",
        ].includes(e.type)
      )
        this.effects.push(f);
      const g = groups.get(e.groupId) || [];
      g.push(f);
      groups.set(e.groupId, g);
    }
    for (const group of groups.values()) {
      const lead = group.reduce((a, b) =>
        (priority[b.type] || 0) > (priority[a.type] || 0) ? b : a,
      );
      this.audio?.play(lead);
      const hitStop = Math.max(
        ...group.map((e) =>
          e.type === "siege" ? 40 : e.type === "damage" ? 20 : 0,
        ),
      );
      if (hitStop && !this.reduced && time >= this.freezeUntil)
        this.freezeUntil = time + hitStop;
      const amplitude = Math.max(
        ...group.map((e) =>
          e.type === "siege"
            ? 3
            : e.type === "destroy"
              ? 1.8
              : e.type === "blast"
                ? e.radius === 2
                  ? 1.6
                  : 1
                : e.type === "damage"
                  ? 1
                  : 0,
        ),
      );
      if (amplitude && !this.reduced) {
        const previous = this.envelope,
          remaining = previous
            ? Math.max(0, 1 - (time - previous.born) / previous.duration)
            : 0;
        const energy = Math.max(
          amplitude,
          previous ? previous.amplitude * remaining * remaining : 0,
        );
        this.envelope = {
          born: time,
          amplitude: Math.min(3, energy),
          duration: Math.max(
            amplitude >= 2 ? 150 : amplitude > 1 ? 120 : 95,
            previous ? previous.duration - (time - previous.born) : 0,
          ),
        };
        this.impulses++;
      }
    }
    // Keep only recent identities: producer IDs are monotonic, no delayed queues.
    if (this.seen.size > 2048) this.seen = new Set([...this.seen].slice(-1024));
  }
  update(time) {
    this.effects = this.effects.filter((e) => time - e.born < e.duration);
  }
  shake(time) {
    const e = this.envelope;
    if (this.reduced || !e) return { x: 0, y: 0 };
    const age = time - e.born,
      p = Math.max(0, 1 - age / e.duration),
      a = Math.min(3, e.amplitude) * p * p;
    return { x: Math.sin(age * 1.37) * a, y: Math.cos(age * 1.71) * a * 0.65 };
  }
  releaseCharge(x, y, time) {
    for (const e of this.effects)
      if (e.type === "charge" && e.x === x && e.y === y) {
        e.duration = Math.min(e.duration, time - e.born + 80);
        e.releasingAt = time;
      }
  }
  frozen(time) {
    return !this.reduced && time < this.freezeUntil;
  }
  clear() {
    this.effects = [];
    this.envelope = null;
    this.freezeUntil = 0;
    this.seen.clear();
  }
}
