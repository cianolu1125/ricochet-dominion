import { toView } from "./view.js";
import { origin, previewImpact } from "./physics.js";
export const TEAM = { 1: "#efaaa2", 2: "#9bc7f0" };
const FILL = { 0: "#253542", 1: "#66454e", 2: "#355976" };
const RGB = Object.fromEntries(
  Object.entries(FILL).map(([owner, hex]) => [
    owner,
    [1, 3, 5].map((n) => parseInt(hex.slice(n, n + 2), 16)),
  ]),
);
function blend(from, to, progress) {
  return `rgb(${RGB[from].map((n, i) => Math.round(n + (RGB[to][i] - n) * progress)).join(",")})`;
}
export function render(canvas, s, v) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const width = canvas.clientWidth || parseFloat(canvas.style.width) || 360,
    height = canvas.clientHeight || parseFloat(canvas.style.height) || 640,
    dpr = canvas.width / width,
    tile = width / s.width;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.scale(tile, tile);
  ctx.translate(s.width / 2, s.height / 2);
  ctx.rotate(v.rotation || 0);
  ctx.translate(-s.width / 2, -s.height / 2);
  const pt = (p) => toView(p, s, v.owner),
    circle = (p, r, color, line = false) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      if (line) {
        ctx.strokeStyle = color;
        ctx.stroke();
      } else {
        ctx.fillStyle = color;
        ctx.fill();
      }
    };
  const pending = new Map();
  for (const c of s.claims)
    for (const i of c.cells)
      if (s.cells[i] === c.target && s.stability[i] === "temporary")
        pending.set(i, c.captor);
  for (let y = 0; y < s.height; y++)
    for (let x = 0; x < s.width; x++) {
      const i = y * s.width + x,
        o = s.cells[i],
        p = pt({ x: x + 0.5, y: y + 0.5 });
      const transition = v.transitions?.get(i);
      const progress = transition
        ? Math.max(
            0,
            Math.min(
              1,
              (v.time - transition.born - transition.delay) /
                transition.duration,
            ),
          )
        : 1;
      const targetAlpha = s.stability[i] === "temporary" ? 0.58 : 1;
      const fromAlpha = transition?.fromTemporary ? 0.58 : 1;
      ctx.globalAlpha = fromAlpha + (targetAlpha - fromAlpha) * progress;
      ctx.fillStyle = transition
        ? blend(transition.from, o, progress)
        : FILL[o];
      ctx.fillRect(p.x - 0.484, p.y - 0.484, 0.968, 0.968);
      ctx.globalAlpha = 1;
      if (s.stability[i] === "temporary") {
        ctx.strokeStyle = TEAM[o] + "36";
        ctx.lineWidth = 0.025;
        ctx.beginPath();
        ctx.moveTo(p.x - 0.32, p.y + 0.3);
        ctx.lineTo(p.x + 0.3, p.y - 0.32);
        ctx.moveTo(p.x - 0.4, p.y - 0.03);
        ctx.lineTo(p.x - 0.03, p.y - 0.4);
        ctx.stroke();
      }
      if (s.protectedBy[i]?.length) {
        ctx.strokeStyle = TEAM[o] + "75";
        ctx.lineWidth = 0.035;
        ctx.strokeRect(p.x - 0.38, p.y - 0.38, 0.76, 0.76);
      }
      if (pending.has(i)) {
        ctx.strokeStyle = TEAM[pending.get(i)];
        ctx.globalAlpha = 0.35 + (0.3 * (Math.sin(v.time / 230) + 1)) / 2;
        ctx.lineWidth = 0.07;
        ctx.beginPath();
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = x + dx,
            ny = y + dy,
            j = ny * s.width + nx;
          if (
            nx >= 0 &&
            nx < s.width &&
            ny >= 0 &&
            ny < s.height &&
            pending.get(j) === pending.get(i)
          )
            continue;
          const h = pt({ x: x + 0.5 + dx * 0.47, y: y + 0.5 + dy * 0.47 });
          if (dx) {
            ctx.moveTo(h.x, h.y - 0.47);
            ctx.lineTo(h.x, h.y + 0.47);
          } else {
            ctx.moveTo(h.x - 0.47, h.y);
            ctx.lineTo(h.x + 0.47, h.y);
          }
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  for (const c of s.claims) {
    const id = c.cells.find((i) => pending.has(i));
    if (id === undefined) continue;
    const p = pt({
      x: (id % s.width) + 0.5,
      y: Math.floor(id / s.width) + 0.5,
    });
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(-(v.rotation || 0));
    ctx.fillStyle = TEAM[c.captor];
    ctx.font = "600 .35px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("1 TURN", 0, 0);
    ctx.restore();
  }
  for (const t of s.towers) {
    const p = pt({ x: t.pos.x + 0.5, y: t.pos.y + 0.5 }),
      selected =
        v.select &&
        t.owner === (v.select === "redeploy" ? s.current : 3 - s.current);
    ctx.fillStyle = "#11212f";
    ctx.fillRect(p.x - 0.35, p.y - 0.35, 0.7, 0.7);
    ctx.strokeStyle = TEAM[t.owner];
    ctx.lineWidth = 0.065;
    ctx.setLineDash(t.relayUsed ? [0.12, 0.1] : []);
    ctx.strokeRect(p.x - 0.33, p.y - 0.33, 0.66, 0.66);
    ctx.setLineDash([]);
    if (!t.relayUsed) {
      ctx.fillStyle = TEAM[t.owner] + "77";
      ctx.fillRect(p.x - 0.13, p.y - 0.13, 0.26, 0.26);
    }
    for (let n = 0; n < t.stage; n++) {
      const r = 0.43 + n * 0.11;
      ctx.lineWidth = 0.03;
      for (const [dx, dy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        ctx.beginPath();
        ctx.moveTo(p.x + dx * r, p.y + dy * (r - 0.14));
        ctx.lineTo(p.x + dx * r, p.y + dy * r);
        ctx.lineTo(p.x + dx * (r - 0.14), p.y + dy * r);
        ctx.stroke();
      }
    }
    if (selected) {
      circle(p, 0.76, TEAM[t.owner] + "bb", true);
      ctx.save();
      ctx.translate(p.x, p.y - 0.8);
      ctx.rotate(-(v.rotation || 0));
      ctx.fillStyle = TEAM[t.owner];
      ctx.font = "700 .55px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(t.slot, 0, 0);
      ctx.restore();
    }
  }
  for (const owner of [1, 2]) {
    const role = s.players[owner];
    if (role.hp <= 0) continue;
    const w = role.world || { x: role.pos.x + 0.5, y: role.pos.y + 0.5 },
      p = pt(w);
    if (s.activeBody?.carried === owner) {
      const m = s.activeBody,
        len = Math.hypot(m.vx, m.vy) || 1;
      const offset = pt({
        x: w.x - (m.vx / len) * 0.38,
        y: w.y - (m.vy / len) * 0.38,
      });
      p.x = offset.x;
      p.y = offset.y;
    }
    ctx.lineWidth = 0.08;
    circle(p, 0.34, "#0d1c29");
    circle(p, 0.3, TEAM[owner], true);
    const flashed = v.effects.some(
      (e) => e.type === "damage" && e.owner === owner && v.time - e.born < 180,
    );
    circle(p, 0.21, flashed ? "#edf4f8" : TEAM[owner] + "44");
    ctx.fillStyle = TEAM[owner];
    ctx.beginPath();
    const dir =
      s.profile === "desktop"
        ? owner === 1
          ? 1
          : -1
        : owner === v.owner
          ? -1
          : 1;
    if (s.profile === "desktop") {
      ctx.moveTo(p.x + dir * 0.2, p.y);
      ctx.lineTo(p.x - dir * 0.12, p.y - 0.13);
      ctx.lineTo(p.x - dir * 0.12, p.y + 0.13);
    } else {
      ctx.moveTo(p.x, p.y + dir * 0.2);
      ctx.lineTo(p.x - 0.13, p.y - dir * 0.12);
      ctx.lineTo(p.x + 0.13, p.y - dir * 0.12);
    }
    ctx.fill();
    if (owner === s.current) {
      ctx.lineWidth = 0.025;
      circle(p, 0.53, TEAM[owner] + "66", true);
    }
  }
  if (s.phase.includes("AIM")) {
    const p = pt(origin(s));
    ctx.lineWidth = 0.05;
    circle(
      p,
      0.68 + Math.sin(v.time / 180) * 0.04,
      TEAM[s.current] + "a0",
      true,
    );
    if (v.aim) {
      const aim = v.aim,
        len = Math.hypot(aim.x, aim.y) || 1,
        worldEnd = {
          x: origin(s).x + (aim.x / len) * (1 + aim.power * 4),
          y: origin(s).y + (aim.y / len) * (1 + aim.power * 4),
        },
        end = pt(worldEnd);
      ctx.strokeStyle = TEAM[s.current];
      ctx.lineWidth = 0.075;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.save();
      ctx.translate(end.x, end.y);
      ctx.rotate(Math.atan2(end.y - p.y, end.x - p.x));
      ctx.fillStyle = TEAM[s.current];
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-0.3, -0.16);
      ctx.lineTo(-0.3, 0.16);
      ctx.fill();
      ctx.restore();
      const hit = previewImpact(s, aim, aim.power);
      if (hit) {
        const hp = pt(hit);
        ctx.lineWidth = 0.05;
        circle(hp, 0.22, "#eaf2f6", true);
      }
      ctx.beginPath();
      ctx.arc(
        p.x,
        p.y,
        0.85,
        -Math.PI / 2,
        -Math.PI / 2 + aim.power * 2 * Math.PI,
      );
      ctx.stroke();
    }
  }
  const m = s.activeBody;
  if (m) {
    for (let n = 0; n < m.trail.length; n++)
      circle(pt(m.trail[n]), 0.035 + n * 0.004, TEAM[s.current] + "55");
    if (m.kind === "missile") {
      const p = pt(m),
        f = pt({ x: m.x + m.vx, y: m.y + m.vy });
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(f.y - p.y, f.x - p.x));
      ctx.fillStyle = "#f1f6fa";
      ctx.beginPath();
      ctx.moveTo(0.22, 0);
      ctx.lineTo(-0.16, -0.13);
      ctx.lineTo(-0.16, 0.13);
      ctx.fill();
      ctx.restore();
      if (m.charge === 3) {
        ctx.lineWidth = 0.03;
        circle(p, 0.35, TEAM[s.current] + "a0", true);
      }
      if (m.carried) {
        const p2 = pt({ x: m.x, y: m.y });
        ctx.strokeStyle = TEAM[m.carried] + "88";
        ctx.lineWidth = 0.035;
        circle(p2, 0.5, TEAM[m.carried] + "88", true);
      }
    }
  }
  for (const e of v.effects) {
    const age = v.time - e.born;
    if (age > 480) continue;
    const p = pt(e);
    ctx.globalAlpha = 1 - age / 480;
    ctx.lineWidth = 0.06;
    const r =
      e.type === "capture"
        ? 0.85 - age / 600
        : 0.2 + (age / 250) * (e.radius || 1);
    circle(p, Math.max(0.1, r), TEAM[e.owner || s.current], true);
    if (e.type === "siege") {
      ctx.fillStyle = TEAM[3 - e.owner];
      for (const [dx, dy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ])
        ctx.fillRect(
          p.x + dx * (0.2 + age / 380) - 0.09,
          p.y + dy * (0.2 + age / 380) - 0.09,
          0.18,
          0.18,
        );
    }
    ctx.globalAlpha = 1;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
