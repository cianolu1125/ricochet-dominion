import { CONFIG } from "./config.js";
import { enemy, same, explode, log } from "./engine.js";
const key = (t) => `${t.owner}-${t.slot}`;
export function launch(s, direction, power) {
  const len = Math.hypot(direction.x, direction.y);
  if (
    s.phase !== "MISSILE_AIM" ||
    !Number.isFinite(len) ||
    !Number.isFinite(power) ||
    len < 0.001 ||
    power < CONFIG.physics.minPower ||
    (!s.shotOpen && s.missilesRemaining <= 0)
  )
    return false;
  const origin = s.relay?.pos || s.players[s.current].pos;
  const tower = s.towers.find(
    (t) => t.owner === s.current && same(t.pos, origin),
  );
  if (!s.shotOpen) {
    s.missilesRemaining--;
    s.shotOpen = true;
  }
  s.undo = null;
  const speed = CONFIG.physics.maxSpeed * Math.min(1, power);
  s.activeMissile = {
    x: origin.x + 0.5,
    y: origin.y + 0.5,
    vx: (direction.x / len) * speed,
    vy: (direction.y / len) * speed,
    ignoreTower: tower ? key(tower) : null,
    trail: [],
  };
  s.relay = null;
  s.phase = "MISSILE_FLYING";
  return true;
}
export function segmentBox(x, y, dx, dy, b) {
  let near = -Infinity,
    far = Infinity,
    nx = 0,
    ny = 0;
  for (const [p, d, lo, hi, axis] of [
    [x, dx, b.left, b.right, 0],
    [y, dy, b.top, b.bottom, 1],
  ]) {
    if (Math.abs(d) < 1e-10) {
      if (p < lo || p > hi) return null;
      continue;
    }
    const a = (lo - p) / d,
      c = (hi - p) / d,
      entry = Math.min(a, c),
      exit = Math.max(a, c),
      sign = d > 0 ? -1 : 1;
    if (entry > near + 1e-9) {
      near = entry;
      nx = axis === 0 ? sign : 0;
      ny = axis === 1 ? sign : 0;
    } else if (Math.abs(entry - near) < 1e-9) {
      if (axis === 0) nx = sign;
      else ny = sign;
    }
    far = Math.min(far, exit);
    if (near > far) return null;
  }
  return near >= -1e-8 && near <= 1 && far >= 0
    ? { t: Math.max(0, near), nx, ny }
    : null;
}
function segmentCircle(x, y, dx, dy, cx, cy, r) {
  const px = x - cx,
    py = y - cy,
    a = dx * dx + dy * dy,
    b = 2 * (px * dx + py * dy),
    c = px * px + py * py - r * r;
  if (c <= 0) return { t: 0 };
  if (!a) return null;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? { t } : null;
}
export function previewImpact(s, direction, distance = 4) {
  const origin = s.relay?.pos || s.players[s.current].pos,
    x = origin.x + 0.5,
    y = origin.y + 0.5,
    len = Math.hypot(direction.x, direction.y);
  if (!len) return null;
  const dx = (direction.x / len) * distance,
    dy = (direction.y / len) * distance,
    r = CONFIG.physics.radius;
  let hit = null;
  const add = (h) => {
    if (h && h.t >= 0 && h.t <= 1 && (!hit || h.t < hit.t)) hit = h;
  };
  for (const tower of s.towers) {
    if (tower.owner === s.current && same(tower.pos, origin)) continue;
    const e = 0.35 + r,
      h = segmentBox(x, y, dx, dy, {
        left: tower.pos.x + 0.5 - e,
        right: tower.pos.x + 0.5 + e,
        top: tower.pos.y + 0.5 - e,
        bottom: tower.pos.y + 0.5 + e,
      });
    if (h)
      add({ ...h, type: tower.owner === s.current ? "capture" : "bounce" });
  }
  const foe = s.players[enemy(s.current)].pos,
    role = segmentCircle(x, y, dx, dy, foe.x + 0.5, foe.y + 0.5, 0.31 + r);
  if (role) add({ ...role, type: "role" });
  if (dx > 0) add({ t: (s.width - r - x) / dx, type: "bounce" });
  if (dx < 0) add({ t: (r - x) / dx, type: "bounce" });
  if (dy > 0) add({ t: (s.height - r - y) / dy, type: "bounce" });
  if (dy < 0) add({ t: (r - y) / dy, type: "bounce" });
  return hit ? { x: x + dx * hit.t, y: y + dy * hit.t, type: hit.type } : null;
}
function finish(s) {
  s.activeMissile = null;
  s.relay = null;
  s.shotOpen = false;
  if (!s.winner) s.phase = s.missilesRemaining ? "MISSILE_AIM" : "TURN_END";
}
export function abandon(s) {
  if (!s.shotOpen || !["MISSILE_AIM", "MISSILE_FLYING"].includes(s.phase))
    return false;
  finish(s);
  log(s, "已放弃本弹 · 不发生爆炸");
  return true;
}
export function stepMissile(s, dt) {
  const m = s.activeMissile;
  if (!m || s.phase !== "MISSILE_FLYING") return [];
  const events = [];
  const r = CONFIG.physics.radius;
  const speed = Math.hypot(m.vx, m.vy),
    nextSpeed = Math.max(0, speed - CONFIG.physics.friction * dt),
    ratio = speed ? nextSpeed / speed : 0;
  m.vx *= ratio;
  m.vy *= ratio;
  let left = dt;
  for (let iteration = 0; iteration < 8 && left > 1e-8; iteration++) {
    const ignored = s.towers.find((t) => key(t) === m.ignoreTower);
    if (
      ignored &&
      (Math.abs(m.x - ignored.pos.x - 0.5) > 0.49 ||
        Math.abs(m.y - ignored.pos.y - 0.5) > 0.49)
    )
      m.ignoreTower = null;
    const dx = m.vx * left,
      dy = m.vy * left;
    let hit = null;
    const candidate = (h) => {
      if (h && h.t >= 0 && h.t <= 1 && (!hit || h.t < hit.t - 1e-8)) hit = h;
    };
    for (const t of s.towers) {
      if (key(t) === m.ignoreTower) continue;
      const extent = 0.35 + r;
      const h = segmentBox(m.x, m.y, dx, dy, {
        left: t.pos.x + 0.5 - extent,
        right: t.pos.x + 0.5 + extent,
        top: t.pos.y + 0.5 - extent,
        bottom: t.pos.y + 0.5 + extent,
      });
      if (h)
        candidate({
          ...h,
          type: t.owner === s.current ? "capture" : "tower",
          tower: t,
        });
    }
    const foe = s.players[enemy(s.current)].pos;
    const role = segmentCircle(
      m.x,
      m.y,
      dx,
      dy,
      foe.x + 0.5,
      foe.y + 0.5,
      0.31 + r,
    );
    if (role) candidate({ ...role, type: "role" });
    if (dx > 0)
      candidate({ t: (s.width - r - m.x) / dx, nx: -1, ny: 0, type: "wall" });
    if (dx < 0) candidate({ t: (r - m.x) / dx, nx: 1, ny: 0, type: "wall" });
    if (dy > 0)
      candidate({ t: (s.height - r - m.y) / dy, nx: 0, ny: -1, type: "wall" });
    if (dy < 0) candidate({ t: (r - m.y) / dy, nx: 0, ny: 1, type: "wall" });
    if (!hit) {
      m.x += dx;
      m.y += dy;
      break;
    }
    m.x += dx * hit.t;
    m.y += dy * hit.t;
    left *= 1 - hit.t;
    if (hit.type === "capture") {
      s.relay = { slot: hit.tower.slot, pos: { ...hit.tower.pos } };
      s.activeMissile = null;
      s.phase = "MISSILE_AIM";
      log(s, `塔 ${hit.tower.slot} 捕获 · 继续这一发`);
      return [
        { type: "capture", x: hit.tower.pos.x + 0.5, y: hit.tower.pos.y + 0.5 },
      ];
    }
    if (hit.type === "role") {
      const p = { x: foe.x, y: foe.y };
      explode(s, s.current, p);
      finish(s);
      log(s, "飞弹命中 · 3×3 染色");
      return [{ type: "blast", x: p.x + 0.5, y: p.y + 0.5 }];
    }
    if (hit.nx) m.vx = -m.vx * CONFIG.physics.restitution;
    if (hit.ny) m.vy = -m.vy * CONFIG.physics.restitution;
    m.x += hit.nx * 0.001;
    m.y += hit.ny * 0.001;
    events.push({ type: "bounce", x: m.x, y: m.y });
  }
  m.trail.push({ x: m.x, y: m.y });
  m.trail = m.trail.slice(-12);
  if (Math.hypot(m.vx, m.vy) < CONFIG.physics.stopSpeed) {
    const p = { x: Math.floor(m.x), y: Math.floor(m.y) };
    explode(s, s.current, p);
    finish(s);
    log(s, "飞弹落地 · 3×3 染色");
    events.push({ type: "blast", x: p.x + 0.5, y: p.y + 0.5 });
  }
  return events;
}
