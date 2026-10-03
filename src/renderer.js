import { toView, fromView } from "./view.js";
import { previewImpact } from "./physics.js";
import { legalMoves } from "./engine.js";
export const COLORS = { 0: "#24303b", 1: "#664148", 2: "#304f6a" };
const team = { 1: "#ef9991", 2: "#98c5f2" };
export function render(canvas, s, v) {
  const ctx = canvas.getContext("2d"),
    dpr = canvas.width / canvas.clientWidth,
    W = v.desktop ? 32 : 18,
    H = v.desktop ? 18 : 32,
    tile = canvas.clientWidth / W;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  ctx.scale(tile, tile);
  ctx.translate(W / 2, H / 2);
  ctx.rotate(v.rotation || 0);
  ctx.translate(-W / 2, -H / 2);
  const point = (p) => toView(p, v.desktop, v.owner);
  const circle = (p, r, color, line = false) => {
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
  const locked = new Map();
  for (const t of s.towers) for (const i of t.protected) locked.set(i, t.owner);
  for (let y = 0; y < s.height; y++)
    for (let x = 0; x < s.width; x++) {
      const p = point({ x: x + 0.5, y: y + 0.5 }),
        i = y * s.width + x;
      let fill = COLORS[s.cells[i]];
      const blast = v.effects.find(
        (e) =>
          e.type === "blast" &&
          Math.abs(x + 0.5 - e.x) <= 1 &&
          Math.abs(y + 0.5 - e.y) <= 1 &&
          v.time - e.born < 180,
      );
      if (
        blast &&
        v.time - blast.born <
          Math.hypot(x + 0.5 - blast.x, y + 0.5 - blast.y) * 55
      )
        fill = COLORS[blast.before[i]];
      ctx.fillStyle = fill;
      ctx.fillRect(p.x - 0.48, p.y - 0.48, 0.96, 0.96);
      if (locked.has(i)) {
        ctx.strokeStyle = team[locked.get(i)] + "55";
        ctx.lineWidth = 0.035;
        ctx.strokeRect(p.x - 0.36, p.y - 0.36, 0.72, 0.72);
        ctx.beginPath();
        ctx.moveTo(p.x - 0.3, p.y + 0.3);
        ctx.lineTo(p.x - 0.05, p.y + 0.05);
        ctx.stroke();
      }
    }
  if (s.phase === "ROLE_ACTION" && !v.rotation) {
    const pos = point({
        x: s.players[s.current].pos.x + 0.5,
        y: s.players[s.current].pos.y + 0.5,
      }),
      moves = legalMoves(s),
      ends = new Map();
    for (const p of moves) {
      const a = point({ x: p.x + 0.5, y: p.y + 0.5 });
      const dx = Math.sign(a.x - pos.x),
        dy = Math.sign(a.y - pos.y);
      ends.set(`${dx},${dy}`, a);
    }
    ctx.strokeStyle = team[s.current] + "4d";
    ctx.lineWidth = 0.04;
    ctx.setLineDash([0.09, 0.21]);
    for (const end of ends.values()) {
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    if (v.cursor) {
      const c = point({ x: v.cursor.x + 0.5, y: v.cursor.y + 0.5 });
      ctx.strokeStyle = team[s.current];
      ctx.lineWidth = 0.08;
      ctx.strokeRect(c.x - 0.46, c.y - 0.46, 0.92, 0.92);
      ctx.setLineDash([0.16, 0.15]);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
      ctx.setLineDash([]);
      circle(c, 0.16, team[s.current]);
    }
  }
  for (const t of s.towers) {
    const p = point({ x: t.pos.x + 0.5, y: t.pos.y + 0.5 });
    ctx.fillStyle = "#111e28";
    ctx.fillRect(p.x - 0.36, p.y - 0.36, 0.72, 0.72);
    ctx.strokeStyle = team[t.owner];
    ctx.lineWidth = 0.085;
    ctx.strokeRect(p.x - 0.32, p.y - 0.32, 0.64, 0.64);
    if (t.stage > 0) {
      ctx.lineWidth = 0.035;
      ctx.strokeRect(p.x - 0.42, p.y - 0.42, 0.84, 0.84);
    }
    ctx.fillStyle = team[t.owner];
    ctx.font = "600 .36px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(-(v.rotation || 0));
    ctx.fillText(t.slot, 0, 0.025);
    ctx.restore();
  }
  for (const owner of [1, 2]) {
    const a = s.players[owner],
      p = point({ x: a.pos.x + 0.5, y: a.pos.y + 0.5 });
    if (a.hp <= 0) continue;
    ctx.lineWidth = 0.08;
    circle(p, 0.34, "#111b24");
    circle(p, 0.3, team[owner], true);
    circle(p, 0.23, team[owner] + "33");
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(
      v.desktop
        ? owner === 1
          ? Math.PI / 2
          : -Math.PI / 2
        : owner === v.owner
          ? 0
          : Math.PI,
    );
    ctx.fillStyle = team[owner];
    ctx.beginPath();
    ctx.moveTo(0, -0.19);
    ctx.lineTo(0.13, 0.1);
    ctx.lineTo(-0.13, 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    if (a.mobileShield || a.respawnShield) {
      ctx.lineWidth = 0.035;
      ctx.setLineDash(a.respawnShield ? [] : [0.1, 0.09]);
      circle(p, 0.46, team[owner] + "cc", true);
      ctx.setLineDash([]);
    }
    if (owner === s.current) {
      ctx.lineWidth = 0.025;
      circle(p, 0.54, team[owner] + "66", true);
    }
  }
  if (s.phase === "MISSILE_AIM") {
    const origin = s.relay?.pos || s.players[s.current].pos,
      p = point({ x: origin.x + 0.5, y: origin.y + 0.5 });
    ctx.lineWidth = 0.06;
    circle(
      p,
      0.66 + Math.sin(v.time / 170) * 0.05,
      team[s.current] + "b0",
      true,
    );
    circle(p, 0.09, "#f3f6f8");
    if (v.aim) {
      const zero = fromView({ x: 0, y: 0 }, v.desktop, v.owner),
        dir = fromView({ x: v.aim.dx, y: v.aim.dy }, v.desktop, v.owner),
        hit = previewImpact(
          s,
          { x: dir.x - zero.x, y: dir.y - zero.y },
          1 + v.aim.power * 3,
        );
      if (hit) {
        const marker = point(hit);
        ctx.strokeStyle = hit.type === "capture" ? "#e7edf1" : team[s.current];
        ctx.lineWidth = 0.06;
        ctx.strokeRect(marker.x - 0.2, marker.y - 0.2, 0.4, 0.4);
      }
      const { dx, dy, power } = v.aim,
        len = Math.hypot(dx, dy) || 1,
        ux = dx / len,
        uy = dy / len,
        distance = 1 + power * 3;
      ctx.strokeStyle = team[s.current];
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + ux * distance, p.y + uy * distance);
      ctx.stroke();
      ctx.save();
      ctx.translate(p.x + ux * distance, p.y + uy * distance);
      ctx.rotate(Math.atan2(uy, ux));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-0.3, -0.16);
      ctx.lineTo(-0.3, 0.16);
      ctx.closePath();
      ctx.fillStyle = team[s.current];
      ctx.fill();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(p.x, p.y, 0.88, -Math.PI / 2, -Math.PI / 2 + power * Math.PI * 2);
      ctx.stroke();
    }
  }
  const m = s.activeMissile;
  if (m) {
    m.trail.forEach((a, i) =>
      circle(
        point(a),
        0.045 + i * 0.006,
        team[s.current] +
          Math.round(((255 * (i + 1)) / m.trail.length) * 0.5)
            .toString(16)
            .padStart(2, "0"),
      ),
    );
    const p = point(m);
    circle(p, 0.14, "#eef5f9");
  }
  for (const e of v.effects) {
    const age = v.time - e.born,
      life = e.type === "blast" ? 450 : e.type === "growth" ? 450 : 230;
    if (age > life) continue;
    const p = point(e);
    ctx.globalAlpha = 1 - age / life;
    ctx.lineWidth = 0.07;
    if (e.type === "growth") {
      ctx.strokeStyle = team[e.owner];
      const radius = (e.stage + 0.5) * Math.min(1, age / 240);
      ctx.strokeRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
    } else
      circle(
        p,
        e.type === "blast"
          ? 0.3 + age / 180
          : e.type === "capture"
            ? 0.8 - age / 300
            : 0.1 + age / 500,
        e.type === "blast" ? team[e.owner || s.current] : "#e9f2f6",
        true,
      );
    ctx.globalAlpha = 1;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (v.aim) {
    const power = v.aim.power;
    ctx.fillStyle = "#111d27ef";
    ctx.fillRect(canvas.clientWidth / 2 - 55, 12, 110, 30);
    ctx.fillStyle = "#dfe9f1";
    ctx.font = "600 12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(
      `力度 ${Math.round(power * 100)}%`,
      canvas.clientWidth / 2,
      31,
    );
  }
}
