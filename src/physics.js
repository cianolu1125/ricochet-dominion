import { fact, feedbackId } from "./feedback-events.js";
import { CONFIG } from "./config.js";
import * as E from "./engine.js";
const AIM = ["MOVE_AIM", "MOVE_RELAY_AIM", "MISSILE_AIM", "MISSILE_RELAY_AIM"];
export function origin(s) {
  const p = s.relay?.pos || s.players[s.current].pos;
  return { x: p.x + 0.5, y: p.y + 0.5 };
}
export function launch(s, direction, power) {
  const len = Math.hypot(direction.x, direction.y);
  if (
    !AIM.includes(s.phase) ||
    !Number.isFinite(len) ||
    !Number.isFinite(power) ||
    len < 0.001 ||
    power < CONFIG.physics.minPower
  )
    return false;
  const kind = s.phase.startsWith("MOVE") ? "move" : "missile";
  if (!s.committed) {
    if (kind === "move" ? !s.moveAvailable : !s.actionAvailable) return false;
    if (kind === "move") s.moveAvailable = false;
    else s.actionAvailable = false;
    s.committed = true;
  }
  const p = origin(s),
    speed = CONFIG.physics.maxSpeed * Math.min(1, power),
    t = s.towers.find((t) => E.same(t.pos, E.grid(s, p)));
  s.activeBody = {
    ...p,
    vx: (direction.x / len) * speed,
    vy: (direction.y / len) * speed,
    kind,
    charge: s.charge,
    carried: null,
    wasOwn: false,
    ignoreTower: t?.id || null,
    trail: [],
  };
  s.relay = null;
  s.phase = kind === "move" ? "MOVE_FLYING" : "MISSILE_FLYING";
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
export function segmentCircle(x, y, dx, dy, cx, cy, r) {
  const px = x - cx,
    py = y - cy,
    a = dx * dx + dy * dy,
    b = 2 * (px * dx + py * dy),
    c = px * px + py * py - r * r;
  let t = 0;
  if (c > 0) {
    if (!a) return null;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    t = (-b - Math.sqrt(disc)) / (2 * a);
    if (t < 0 || t > 1) return null;
  }
  const hx = x + dx * t - cx,
    hy = y + dy * t - cy,
    len = Math.hypot(hx, hy) || 1;
  return { t, nx: hx / len, ny: hy / len };
}
function collision(s, m, dx, dy) {
  const r =
    m.kind === "move" ? CONFIG.physics.roleRadius : CONFIG.physics.radius;
  let hit = null;
  const add = (h) => {
    if (h && h.t >= 0 && h.t <= 1 && (!hit || h.t < hit.t - 1e-8)) hit = h;
  };
  const foe = s.players[E.enemy(s.current)].pos;
  const role = !m.carried
    ? segmentCircle(m.x, m.y, dx, dy, foe.x + 0.5, foe.y + 0.5, 0.31 + r)
    : null;
  if (role) add({ ...role, type: "role" });
  for (const t of s.towers) {
    if (t.id === m.ignoreTower) continue;
    const extent = 0.35 + r;
    const h = segmentBox(m.x, m.y, dx, dy, {
      left: t.pos.x + 0.5 - extent,
      right: t.pos.x + 0.5 + extent,
      top: t.pos.y + 0.5 - extent,
      bottom: t.pos.y + 0.5 + extent,
    });
    if (!h) continue;
    // Shared-cell priority must not depend on this tick reaching the circle.
    // Look through the tower along the incoming ray; corner-only tower hits
    // still bounce when that ray would miss the role.
    const length = Math.hypot(dx, dy);
    const rayRole =
      !m.carried && length > 0
        ? segmentCircle(
            m.x,
            m.y,
            (dx / length) * (length + 2 * extent),
            (dy / length) * (length + 2 * extent),
            foe.x + 0.5,
            foe.y + 0.5,
            0.31 + r,
          )
        : null;
    if (
      m.kind === "missile" &&
      rayRole &&
      t.owner !== s.current &&
      E.same(t.pos, foe)
    ) {
      add({ ...h, type: "role", priorityTower: t });
      continue;
    }
    add({ ...h, type: "tower", tower: t });
  }
  if (dx > 0) add({ t: (s.width - r - m.x) / dx, nx: -1, ny: 0, type: "wall" });
  if (dx < 0) add({ t: (r - m.x) / dx, nx: 1, ny: 0, type: "wall" });
  if (dy > 0)
    add({ t: (s.height - r - m.y) / dy, nx: 0, ny: -1, type: "wall" });
  if (dy < 0) add({ t: (r - m.y) / dy, nx: 0, ny: 1, type: "wall" });
  return hit;
}
// Exact grid-boundary samples prevent high-speed carry from skipping thin territory crossings.
export function traverseCells(s, a, b) {
  const times = [0, 1],
    dx = b.x - a.x,
    dy = b.y - a.y;
  for (const [p, d] of [
    [a.x, dx],
    [a.y, dy],
  ])
    if (Math.abs(d) > 1e-10)
      for (
        let n = Math.floor(Math.min(p, p + d)) + 1;
        n <= Math.floor(Math.max(p, p + d));
        n++
      ) {
        const t = (n - p) / d;
        if (t > 0 && t < 1) times.push(t);
      }
  times.sort((a, b) => a - b);
  const out = [];
  for (let n = 0; n < times.length - 1; n++) {
    const t = (times[n] + times[n + 1]) / 2,
      p = E.grid(s, { x: a.x + dx * t, y: a.y + dy * t });
    if (!out.length || !E.same(out.at(-1), p)) out.push(p);
  }
  const end = E.grid(s, b);
  if (!out.length || !E.same(out.at(-1), end)) out.push(end);
  return out;
}
export function carryAlong(s, m, a, b) {
  if (!m.carried) return;
  const owner = m.carried;
  for (const p of traverseCells(s, a, b)) {
    s.players[owner].pos = p;
    const own = s.cells[E.index(s, p)] === owner;
    if (!m.wasOwn && own) { const previous=s.feedbackGroup;s.feedbackGroup=null;s.feedbackPosition={x:p.x+.5,y:p.y+.5};E.damage(s, owner);s.feedbackPosition=null;s.feedbackGroup=previous; }
    if (s.winner) return;
    m.wasOwn = own;
  }
  s.players[owner].world = { ...b };
}
function advance(s, m, dx, dy) {
  const a = { x: m.x, y: m.y };
  m.x += dx;
  m.y += dy;
  carryAlong(s, m, a, m);
  if (m.kind === "move") {
    s.players[s.current].world = { x: m.x, y: m.y };
    s.players[s.current].pos = E.grid(s, m);
  }
}
export function releaseBefore(s, m, t) {
  const speed = Math.hypot(m.vx, m.vy) || 1;
  const distance = Math.hypot(s.width, s.height) + 2;
  const end = {
    x: m.x - (m.vx / speed) * distance,
    y: m.y - (m.vy / speed) * distance,
  };
  const owner = m.carried;
  // Use the real impact offset, never the tower-center ray. Exact crossings
  // also preserve a legal cell even when the ray only clips its corner.
  const cells = traverseCells(s, m, end);
  const p =
    cells.find((p) => !E.same(p, t.pos) && E.legalLanding(s, p, owner)) ||
    E.nearestLanding(s, E.grid(s, m), owner);
  const own = s.cells[E.index(s, p)] === owner;
  if (!m.wasOwn && own) {s.feedbackPosition={x:p.x+.5,y:p.y+.5};E.damage(s, owner);s.feedbackPosition=null;}
  if (s.winner) return;
  s.players[owner].pos = p;
  delete s.players[owner].world;
  m.carried = null;
}
function finish(s, m, blast = true, center = null) {
  if (s.winner) return;
  const p = center || E.grid(s, m);
  if (m.kind === "move") {
    s.players[s.current].pos = E.nearestLanding(s, p, s.current);
    delete s.players[s.current].world;
  }
  if (m.carried) {
    const owner = m.carried,
      landing = E.nearestLanding(s, p, owner),
      own = s.cells[E.index(s, landing)] === owner;
    if (!m.wasOwn && own) {s.feedbackPosition={x:landing.x+.5,y:landing.y+.5};E.damage(s, owner);s.feedbackPosition=null;}
    if (s.winner) return;
    s.players[owner].pos = landing;
    delete s.players[owner].world;
    if (s.winner) return;
    m.carried = null;
  }
  if (m.kind === "missile" && blast)
    E.explode(s, s.current, p, m.charge >= 2 ? 2 : 1);
  s.activeBody = null;
  s.relay = null;
  s.phase = "IDLE";
  s.committed = false;
}
export function cancelAim(s) {
  if (!AIM.includes(s.phase)) return false;
  if (s.committed) {
    const p = origin(s),
      m = {
        ...p,
        kind: s.phase.startsWith("MOVE") ? "move" : "missile",
        charge: s.charge,
        carried: null,
      };
    s.feedbackGroup=feedbackId();
    finish(s, m, true);
    fact(s,{type:m.kind==='missile'?'blast':'land',...p,radius:m.charge>=2?2:1});
    s.feedbackGroup=null;
  } else {
    s.phase = "IDLE";
    s.relay = null;
  }
  return true;
}
export function stepBody(s, dt) {
  if (!s.activeBody || s.winner) return [];
  const events = [],
    steps = Math.max(1, Math.ceil(dt / CONFIG.physics.step));
  for (let n = 0; n < steps && s.activeBody && !s.winner; n++)
    tick(s, dt / steps, events);
  s.feedbackGroup=null;
  return events;
}
function tick(s, dt, events) {
  const emit=(event)=>{const f=fact(s,event);events.push(f);};
  const m = s.activeBody,
    speed = Math.hypot(m.vx, m.vy),
    next = Math.max(0, speed - CONFIG.physics.friction * dt),
    ratio = speed ? next / speed : 0;
  m.vx *= ratio;
  m.vy *= ratio;
  let left = dt;
  for (let iter = 0; iter < 12 && left > 1e-8 && !s.winner; iter++) {
    const r = m.kind === "move" ? 0.31 : 0.12,
      ignored = s.towers.find((t) => t.id === m.ignoreTower);
    if (
      ignored &&
      (Math.abs(m.x - ignored.pos.x - 0.5) > 0.35 + r + 0.01 ||
        Math.abs(m.y - ignored.pos.y - 0.5) > 0.35 + r + 0.01)
    )
      m.ignoreTower = null;
    const dx = m.vx * left,
      dy = m.vy * left,
      hit = collision(s, m, dx, dy);
    if (!hit) {
      s.feedbackGroup=null;
      advance(s, m, dx, dy);
      break;
    }
    s.feedbackGroup=null;
    advance(s, m, dx * hit.t, dy * hit.t);
    s.feedbackGroup=feedbackId();
    if (s.winner) return;
    left *= 1 - hit.t;
    if (hit.type === "role" && m.kind === "missile") {
      const target = E.enemy(s.current),
        foe = { ...s.players[target].pos },
        own = E.hitRole(s, target);
      if (s.winner) return;
      if (m.charge === 0) {
        finish(s, m, true, foe);
        emit({
          type: "blast",
          x: foe.x + 0.5,
          y: foe.y + 0.5,
          radius: 1,
        });
        return;
      }
      m.carried = target;
      m.wasOwn = own;
      emit({ type: "carry", x: m.x, y: m.y });
      if (hit.priorityTower) {
        hit.type = "tower";
        hit.tower = hit.priorityTower;
      } else continue;
    }
    if (hit.type === "tower") {
      const t = hit.tower,
        ready =
          t.owner === s.current &&
          (m.kind === "move" ? !s.moveVisited.includes(t.id) : !t.relayUsed);
      if (ready) {
        if (m.carried) releaseBefore(s, m, t);
        if (s.winner) return;
        if (m.kind === "move") {
          s.moveVisited.push(t.id);
          s.players[s.current].pos = { ...t.pos };
          delete s.players[s.current].world;
        } else {
          t.relayUsed = true;
          s.charge = Math.min(3, m.charge + 1);
        }
        s.activeBody = null;
        s.relay = { pos: { ...t.pos }, id: t.id };
        s.phase = m.kind === "move" ? "MOVE_RELAY_AIM" : "MISSILE_RELAY_AIM";
        emit({ type: m.kind === "move" ? "capture" : "charge", charge:s.charge,maxed:m.charge===3, x: t.pos.x + 0.5, y: t.pos.y + 0.5 });
        E.log(
          s,
          `${m.kind === "move" ? "移动" : "飞弹"}中继 · 塔 ${t.slot}${m.kind === "missile" ? " · Charge " + s.charge : ""}`,
        );
        return;
      }
      if (t.owner !== s.current && m.kind === "missile" && m.charge === 3) {
        const p = { ...t.pos };
        E.siege(s, t, p);
        finish(s, m, false, p);
        emit({ type: "siege", targetOwner:t.owner, x: p.x + 0.5, y: p.y + 0.5, radius: 2 });
        return;
      }
    }
    let nx = hit.nx,
      ny = hit.ny,
      len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    const dot = m.vx * nx + m.vy * ny;
    m.vx = (m.vx - 2 * dot * nx) * CONFIG.physics.restitution;
    m.vy = (m.vy - 2 * dot * ny) * CONFIG.physics.restitution;
    m.x += nx * 0.001;
    m.y += ny * 0.001;
    emit({ type: "bounce", x: m.x, y: m.y });
  }
  if (s.winner) return;
  m.trail.push({ x: m.x, y: m.y });
  m.trail = m.trail.slice(-18);
  if (Math.hypot(m.vx, m.vy) < CONFIG.physics.stopSpeed) {
    const p = E.grid(s, m);
    s.feedbackGroup=feedbackId();
    finish(s, m);
    if (s.winner) return;
    emit({
      type: m.kind === "move" ? "land" : "blast",
      x: p.x + 0.5,
      y: p.y + 0.5,
      radius: m.charge >= 2 ? 2 : 1,
    });
  }
}
export function previewImpact(s, direction, power = 1) {
  const o = origin(s),
    len = Math.hypot(direction.x, direction.y);
  if (!len) return null;
  const kind = s.phase.startsWith("MOVE") ? "move" : "missile",
    distance = Math.max(
      2,
      (CONFIG.physics.maxSpeed ** 2 * power ** 2) /
        (2 * CONFIG.physics.friction),
    );
  const m = {
    ...o,
    kind,
    carried: null,
    ignoreTower: s.towers.find((t) => E.same(t.pos, E.grid(s, o)))?.id,
  };
  const dx = (direction.x / len) * distance,
    dy = (direction.y / len) * distance,
    h = collision(s, m, dx, dy);
  return h ? { x: o.x + dx * h.t, y: o.y + dy * h.t, type: h.type } : null;
}
