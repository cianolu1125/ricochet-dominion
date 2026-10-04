import { chargeSpec, effectDuration } from "./feedback.js";
// One Canvas pass, at most 180 transient particle primitives; no per-particle timers.
export function drawEffects(
  ctx,
  events,
  time,
  pt,
  team,
  reduced,
  rotation = 0,
) {
  let budget = reduced ? 24 : 180;
  const ring = (x, y, r, color, alpha = 1, width = 0.035) => {
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.01, r), 0, Math.PI * 2);
    ctx.stroke();
  };
  const point = (x, y, r, color, alpha) => {
    if (budget-- <= 0) return;
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const e of events) {
    const age = time - e.born,
      duration = e.duration || effectDuration(e),
      q = Math.max(0, Math.min(1, age / duration));
    if (age < 0 || q >= 1) continue;
    const p = pt(e),
      color = team[e.owner] || team[1];
    ctx.save();
    if (e.type === "bounce") {
      for (let n = 0; n < (reduced ? 2 : 3); n++) {
        if (budget-- <= 0) break;
        const a =
            (n * Math.PI * 2) / 3 +
            Number(e.eventId?.split("-").at(-1) || 0) * 0.8,
          d = 0.09 + q * 0.4;
        ctx.globalAlpha = 1 - q;
        ctx.strokeStyle = n === 0 ? "#edf4f8" : color;
        ctx.lineWidth = 0.045;
        ctx.beginPath();
        ctx.moveTo(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
        ctx.lineTo(
          p.x + Math.cos(a) * (d + 0.12 * (1 - q)),
          p.y + Math.sin(a) * (d + 0.12 * (1 - q)),
        );
        ctx.stroke();
      }
    } else if (e.type === "charge") {
      const spec = chargeSpec(e.charge, e.maxed),
        fade = Math.min(1, age / (e.charge === 3 ? 60 : 45));
      const count = reduced ? Math.min(4, spec.count) : spec.count;
      for (let n = 0; n < count; n++) {
        const delay = e.charge >= 2 && n % 2 ? 38 : 0;
        let t = Math.max(
          0,
          Math.min(1, (age - 45 - delay) / (duration - 110 - delay)),
        );
        if (e.releasingAt !== undefined)
          t = Math.max(t, Math.min(1, (time - e.releasingAt) / 80));
        const a = (n / count) * Math.PI * 2 + 0.23 * Math.sin(n * 7) + 0.18 * t,
          radius =
            spec.radius * (spec.layers > 1 && n % 2 ? 0.72 : 1) * (1 - t * t);
        point(
          p.x + Math.cos(a) * radius,
          p.y + Math.sin(a) * radius,
          0.036 + (e.charge || 1) * 0.007,
          color,
          fade * (1 - t * 0.7),
        );
      }
      if (e.charge === 2 && !e.maxed && q > 0.7) {
        ctx.globalAlpha = (1 - q) * 2;
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.025;
        ctx.beginPath();
        ctx.moveTo(p.x - 0.55, p.y);
        ctx.lineTo(p.x + 0.55, p.y);
        ctx.moveTo(p.x, p.y - 0.55);
        ctx.lineTo(p.x, p.y + 0.55);
        ctx.stroke();
      }
      const close = Math.max(0, (q - 0.58) / 0.42);
      if (close > 0)
        for (let n = 0; n < spec.layers; n++)
          ring(
            p.x,
            p.y,
            (0.65 + n * 0.2) * (1 - close) + 0.12,
            color,
            Math.sin(close * Math.PI),
            0.035,
          );
      if (q > 0.78) {
        point(
          p.x,
          p.y,
          0.08 + (e.charge || 1) * 0.025,
          "#eff8ff",
          Math.sin(((q - 0.78) / 0.22) * Math.PI),
        );
        ring(p.x, p.y, 0.22 + (q - 0.78) * 1.8, color, (1 - q) / 0.22, 0.045);
      }
    } else if (e.type === "cross") {
      const travel = Math.min(1, age / 220),
        alpha = Math.max(0, 1 - Math.max(0, age - 170) / 220);
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.045;
      ctx.globalAlpha = alpha * 0.8;
      const ends = [
        { x: 0.0, y: e.y },
        { x: e.width, y: e.y },
        { x: e.x, y: 0 },
        { x: e.x, y: e.height },
      ];
      for (const end of ends) {
        const b = pt({
          x: e.x + (end.x - e.x) * travel,
          y: e.y + (end.y - e.y) * travel,
        });
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      for (const i of e.shielded || []) {
        const cell = {
          x: (i % e.width) + 0.5,
          y: Math.floor(i / e.width) + 0.5,
        };
        const reach = Math.max(e.x, e.width - e.x, e.y, e.height - e.y);
        const delay =
          (Math.max(Math.abs(cell.x - e.x), Math.abs(cell.y - e.y)) / reach) *
          220;
        if (age < delay || age > delay + 90) continue;
        const c = pt(cell);
        ctx.globalAlpha = (1 - (age - delay) / 90) * 0.55;
        ctx.strokeStyle = "#deedf9";
        ctx.lineWidth = 0.025;
        ctx.strokeRect(c.x - 0.4, c.y - 0.4, 0.8, 0.8);
      }
    } else if (e.type === "damage") {
      if (age < 210)
        ring(p.x, p.y, 0.34 + (age / 210) * 0.38, color, 1 - age / 210, 0.05);
      ctx.translate(p.x, p.y);
      ctx.rotate(-rotation);
      ctx.globalAlpha = 1 - q;
      ctx.fillStyle = "#fff0ef";
      ctx.font = "700 .46px system-ui";
      ctx.textAlign = "center";
      const direction = e.drift || 0.3;
      ctx.fillText(
        "−1 HP",
        reduced ? 0.6 : direction * 0.3 + direction * q,
        reduced ? -0.65 : -0.35 - 1.9 * q + 1.5 * q * q,
      );
    } else if (e.type === "destroy" || e.type === "siege") {
      const siege = e.type === "siege",
        hold = 60;
      const target = team[e.targetOwner || e.owner] || color;
      if (age < hold) {
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = "#eef5fa";
        ctx.fillRect(p.x - 0.34, p.y - 0.34, 0.68, 0.68);
        ctx.strokeStyle = target;
        ctx.lineWidth = 0.04;
        ctx.beginPath();
        ctx.moveTo(p.x - 0.3, p.y - 0.1);
        ctx.lineTo(p.x, p.y + 0.06);
        ctx.lineTo(p.x + 0.18, p.y - 0.3);
        ctx.moveTo(p.x + 0.04, p.y + 0.08);
        ctx.lineTo(p.x + 0.2, p.y + 0.3);
        ctx.stroke();
      } else {
        const t = (age - hold) / (duration - hold),
          count = reduced ? 3 : 8;
        for (let n = 0; n < count; n++) {
          if (budget-- <= 0) break;
          const a = (n / count) * Math.PI * 2 + 0.4,
            dx = Math.cos(a) * t * (siege ? 1.3 : 0.95),
            dy = Math.sin(a) * t * 0.65 + 1.5 * t * t - 0.5 * t;
          ctx.save();
          ctx.translate(p.x + dx, p.y + dy);
          ctx.rotate(t * (n % 2 ? 3 : -2));
          ctx.globalAlpha = 1 - t;
          ctx.fillStyle = target;
          if (n % 3 === 0) {
            ctx.beginPath();
            ctx.moveTo(-0.07, 0.07);
            ctx.lineTo(0.09, 0.04);
            ctx.lineTo(0, -0.09);
            ctx.fill();
          } else ctx.fillRect(-0.07, -0.07, 0.14, 0.14);
          ctx.restore();
        }
        if (siege && age < 300)
          ring(
            p.x,
            p.y,
            0.3 + ((age - hold) / 240) * 2,
            color,
            1 - (age - hold) / 240,
            0.065,
          );
      }
    } else if (e.type === "blast") {
      if (age < 65) point(p.x, p.y, 0.16, "#f1f6fa", 1 - age / 65);
      ring(
        p.x,
        p.y,
        0.22 + Math.min(1, q * 1.5) * (e.radius || 1) * 1.15,
        color,
        (1 - q) ** 2,
        0.055,
      );
    } else if (e.type === "build" || e.type === "redeploy") {
      const inward = e.type === "redeploy",
        r = inward ? 0.4 * (1 - q) : 0.85 - 0.48 * Math.min(1, q / 0.7);
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.045;
      ctx.globalAlpha = Math.sin(q * Math.PI);
      for (const [dx, dy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        ctx.beginPath();
        ctx.moveTo(p.x + dx * r, p.y + dy * (r - 0.15));
        ctx.lineTo(p.x + dx * r, p.y + dy * r);
        ctx.lineTo(p.x + dx * (r - 0.15), p.y + dy * r);
        ctx.stroke();
      }
      if (!inward && q > 0.65)
        point(p.x, p.y, 0.14, color, Math.sin(((q - 0.65) / 0.35) * Math.PI));
    } else if (e.type === "capture")
      ring(p.x, p.y, 0.8 * (1 - q) + 0.15, color, 1 - q, 0.04);
    else if (e.type === "carry") {
      ctx.globalAlpha = 1 - q;
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.06;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 0.42 + q * 0.2, -0.8, 1.4);
      ctx.stroke();
    } else if (e.type === "grow") {
      ring(p.x, p.y, 0.3 + q * 0.65, color, (1 - q) * 0.7, 0.04);
    } else if (e.type === "fire" || e.type === "launch" || e.type === "land") {
      const layers = e.type === "fire" && e.charge >= 2 ? 2 : 1;
      for (let n = 0; n < layers; n++)
        ring(
          p.x,
          p.y,
          0.25 + q * (e.type === "launch" ? 0.35 : 0.5) + n * 0.12,
          color,
          (1 - q) * (e.type === "land" ? 0.35 : 0.8),
          0.035,
        );
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
