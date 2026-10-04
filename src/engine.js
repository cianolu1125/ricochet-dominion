import { fact } from "./feedback-events.js";
import { CONFIG, NAMES, PROFILES } from "./config.js";
export const enemy = (p) => 3 - p;
export const same = (a, b) => a.x === b.x && a.y === b.y;
export const inside = (s, p) =>
  Number.isInteger(p.x) &&
  Number.isInteger(p.y) &&
  p.x >= 0 &&
  p.y >= 0 &&
  p.x < s.width &&
  p.y < s.height;
export const index = (s, p) => p.y * s.width + p.x;
export const grid = (s, p) => ({
  x: Math.max(0, Math.min(s.width - 1, Math.floor(p.x))),
  y: Math.max(0, Math.min(s.height - 1, Math.floor(p.y))),
});
export function log(s, text) {
  s.events.push({ id: ++s.eventId, text });
  s.events = s.events.slice(-8);
}
export function createGame(maxRounds = 14, profile = "phone") {
  if (!CONFIG.rounds.includes(maxRounds) || !PROFILES[profile])
    throw Error("Invalid match configuration");
  const [width, height] = PROFILES[profile];
  const s = {
    width,
    height,
    profile,
    cells: Array(width * height).fill(0),
    stability: [],
    protectedBy: [],
    claims: [],
    players: {},
    current: 1,
    round: 1,
    maxRounds,
    turnIndex: 0,
    phase: "IDLE",
    towers: [],
    moveAvailable: true,
    actionAvailable: true,
    activeBody: null,
    relay: null,
    charge: 0,
    moveVisited: [],
    committed: false,
    nextId: 0,
    winner: null,
    overtime: false,
    overtimeStart: null,
    events: [],
    eventId: 0,
  };
  const desktop = profile === "desktop",
    depth = Math.round((desktop ? width : height) * 0.125);
  for (const owner of [1, 2]) {
    const pos = desktop
      ? { x: owner === 1 ? 1 : width - 2, y: Math.floor(height / 2) }
      : { x: Math.floor(width / 2), y: owner === 1 ? height - 2 : 1 };
    s.players[owner] = { hp: 10, pos, turns: owner === 1 ? 1 : 0 };
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        if (
          desktop
            ? owner === 1
              ? x < depth
              : x >= width - depth
            : owner === 1
              ? y >= height - depth
              : y < depth
        )
          s.cells[y * width + x] = owner;
    const t = {
      id: ++s.nextId,
      owner,
      slot: "A",
      pos: { ...pos },
      stage: CONFIG.initialTowerStage,
      protected: [],
      relayUsed: false,
    };
    s.towers.push(t);
    expand(s, t);
  }
  recompute(s);
  log(s, "红方先行 · 移动与行动可自由排序");
  return s;
}
export function counts(s) {
  const a = [0, 0, 0];
  for (const c of s.cells) a[c]++;
  return a;
}
export function protectedOwner(s, i) {
  return s.towers.find((t) => t.protected.includes(i))?.owner || 0;
}
export function recompute(s) {
  s.protectedBy = Array.from({ length: s.cells.length }, () => []);
  for (const t of s.towers)
    for (const i of t.protected) s.protectedBy[i].push(t.id);
  s.stability = s.cells.map((c) => (c ? "temporary" : null));
  for (const owner of [1, 2]) {
    const q = [],
      seen = new Set();
    for (const t of s.towers.filter((t) => t.owner === owner)) {
      const i = index(s, t.pos);
      if (s.cells[i] === owner && !seen.has(i)) {
        seen.add(i);
        q.push(i);
      }
    }
    for (let n = 0; n < q.length; n++) {
      const i = q[n];
      s.stability[i] = "stable";
      for (const j of neighbors(s, i))
        if (s.cells[j] === owner && !seen.has(j)) {
          seen.add(j);
          q.push(j);
        }
    }
  }
  s.claims = s.claims.filter((c) =>
    c.sources.some((id) => s.towers.some((t) => t.id === id)),
  );
}
export function neighbors(s, i) {
  const x = i % s.width,
    y = Math.floor(i / s.width),
    a = [];
  if (x) a.push(i - 1);
  if (x < s.width - 1) a.push(i + 1);
  if (y) a.push(i - s.width);
  if (y < s.height - 1) a.push(i + s.width);
  return a;
}
export function component(s, i) {
  const owner = s.cells[i],
    q = [i],
    seen = new Set(q);
  for (let n = 0; n < q.length; n++)
    for (const j of neighbors(s, q[n]))
      if (s.cells[j] === owner && !seen.has(j)) {
        q.push(j);
        seen.add(j);
      }
  return q;
}
export function expand(s, t) {
  for (let y = t.pos.y - t.stage; y <= t.pos.y + t.stage; y++)
    for (let x = t.pos.x - t.stage; x <= t.pos.x + t.stage; x++) {
      const p = { x, y };
      if (!inside(s, p)) continue;
      const i = index(s, p),
        o = protectedOwner(s, i);
      if (!o || o === t.owner) {
        s.cells[i] = t.owner;
        if (!t.protected.includes(i)) t.protected.push(i);
      }
    }
}
export function removeTower(s, t) {
  s.towers = s.towers.filter((a) => a.id !== t.id);
  recompute(s);
}
export function growTowers(s, owner) {
  for (const t of s.towers.filter((t) => t.owner === owner && t.stage < 2)) {
    t.stage++;
    expand(s, t);
  }
  recompute(s);
}
export const blocked = (s, p, owner) =>
  same(s.players[enemy(owner)].pos, p) ||
  s.towers.some((t) => t.owner !== owner && same(t.pos, p));
export function legalLanding(s, p, owner) {
  return inside(s, p) && !blocked(s, p, owner);
}
export function nearestLanding(s, p, owner) {
  const a = [];
  for (let y = 0; y < s.height; y++)
    for (let x = 0; x < s.width; x++)
      if (legalLanding(s, { x, y }, owner)) a.push({ x, y });
  a.sort(
    (a, b) =>
      Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y) ||
      a.y - b.y ||
      a.x - b.x,
  );
  return a[0];
}
export function towerReason(s) {
  const p = s.players[s.current].pos;
  if (s.towers.some((t) => same(t.pos, p))) return "脚下已有防御塔";
  if (protectedOwner(s, index(s, p)) === enemy(s.current))
    return "敌方保护区内无法建塔";
  return "";
}
export function buildTower(s, slot) {
  if (s.phase !== "IDLE" || !s.actionAvailable || towerReason(s)) return false;
  const own = s.towers.filter((t) => t.owner === s.current);
  if (own.length === 5 && !own.some((t) => t.slot === slot)) return false;
  const i = index(s, s.players[s.current].pos),
    target = s.cells[i];
  const claimed =
    target === enemy(s.current) && s.stability[i] === "temporary"
      ? component(s, i)
      : null;
  if (own.length === 5)
    removeTower(
      s,
      own.find((t) => t.slot === slot),
    );
  else slot = "ABCDE".split("").find((a) => !own.some((t) => t.slot === a));
  const t = {
    id: ++s.nextId,
    owner: s.current,
    slot,
    pos: { ...s.players[s.current].pos },
    stage: 0,
    protected: [],
    relayUsed: false,
  };
  s.towers.push(t);
  expand(s, t);
  recompute(s);
  if (claimed) {
    const existing = s.claims.find(
      (c) =>
        c.captor === s.current &&
        c.target === target &&
        c.cells.some((i) => claimed.includes(i)),
    );
    if (existing) {
      existing.cells = [...new Set([...existing.cells, ...claimed])];
      existing.sources.push(t.id);
    } else
      s.claims.push({
        id: ++s.nextId,
        captor: s.current,
        target,
        cells: claimed,
        sources: [t.id],
        createdTurn: s.turnIndex,
      });
  }
  s.actionAvailable = false;
  log(s, `防御塔 ${slot} 已部署${claimed ? " · 断粮区域待吞并" : ""}`);
  return true;
}
export function nearbyTowers(s) {
  const i = index(s, s.players[s.current].pos);
  return s.towers.filter(
    (t) => t.owner !== s.current && t.protected.includes(i),
  );
}
export function dismantle(s, id) {
  if (s.phase !== "IDLE" || !s.actionAvailable) return false;
  const t = nearbyTowers(s).find((t) => t.id === id);
  if (!t) return false;
  removeTower(s, t);
  s.actionAvailable = false;
  log(s, `拆除敌塔 ${t.slot}`);
  return true;
}
export function chooseAim(s, kind) {
  if (
    s.phase !== "IDLE" ||
    (kind === "move" ? !s.moveAvailable : !s.actionAvailable)
  )
    return false;
  s.phase = kind === "move" ? "MOVE_AIM" : "MISSILE_AIM";
  s.charge = 0;
  s.relay = null;
  s.committed = false;
  s.moveVisited = [];
  return true;
}
export function skip(s, kind) {
  if (s.phase !== "IDLE") return false;
  const token = kind === "move" ? "moveAvailable" : "actionAvailable";
  if (!s[token]) return false;
  s[token] = false;
  return true;
}
export function win(s, player, reason) {
  s.winner = { player, reason };
  s.phase = "GAME_OVER";
  s.activeBody = null;
  s.relay = null;
  log(s, player ? `${NAMES[player]}获胜` : "双方平局");
}
export function damage(s, owner) {
  if (s.winner) return false;
  s.players[owner].hp--;
  const p=s.players[owner];
  fact(s,{type:"damage",owner,...(s.feedbackPosition || p.world || {x:p.pos.x+.5,y:p.pos.y+.5})});
  log(s, `${NAMES[owner]} -1 HP`);
  if (s.players[owner].hp <= 0) win(s, enemy(owner), "hp");
  return true;
}
export function hitRole(s, owner) {
  const p = s.players[owner];
  const own = s.cells[index(s, p.pos)] === owner;
  if (own) damage(s, owner);
  return own;
}
export function explode(s, owner, p, radius = 1) {
  if (s.winner) return;
  const c = grid(s, p);
  for (let y = c.y - radius; y <= c.y + radius; y++)
    for (let x = c.x - radius; x <= c.x + radius; x++) {
      if (!inside(s, { x, y })) continue;
      const i = index(s, { x, y }),
        o = protectedOwner(s, i);
      if (!o || o === owner) s.cells[i] = owner;
    }
  recompute(s);
}
export function siege(s, t, p) {
  if (s.winner) return;
  removeTower(s, t);
  explode(s, s.current, p, 2);
}
function settleRound(s) {
  const c = counts(s);
  for (const p of [1, 2])
    if (c[p] / s.cells.length >= CONFIG.threshold) {
      win(s, p, "territory");
      return;
    }
  if (s.overtime) {
    const d = c[1] - s.overtimeStart[1] - (c[2] - s.overtimeStart[2]);
    win(s, d === 0 ? 0 : d > 0 ? 1 : 2, "overtime");
    return;
  }
  if (s.round < s.maxRounds) return;
  const d =
    c[1] - c[2] ||
    s.players[1].hp - s.players[2].hp ||
    s.towers.filter((t) => t.owner === 1).length -
      s.towers.filter((t) => t.owner === 2).length;
  if (d) win(s, d > 0 ? 1 : 2, "score");
  else {
    s.overtime = true;
    s.overtimeStart = c;
    log(s, "完全同分 · 加时一轮");
  }
}
export function endTurn(s) {
  if (s.phase !== "IDLE") return false;
  if (s.current === 2) {
    settleRound(s);
    if (s.winner) return true;
    s.round++;
  }
  s.current = enemy(s.current);
  s.phase = "HANDOFF";
  s.relay = null;
  s.charge = 0;
  return true;
}
export function beginTurn(s) {
  if (s.phase !== "HANDOFF") return false;
  s.turnIndex++;
  s.players[s.current].turns++;
  recompute(s);
  for (const c of s.claims.filter((c) => c.captor === s.current)) {
    for (const i of c.cells)
      if (s.cells[i] === c.target && s.stability[i] === "temporary")
        s.cells[i] = c.captor;
    recompute(s);
  }
  s.claims = s.claims.filter((c) => c.captor !== s.current);
  growTowers(s, s.current);
  recompute(s);
  for (const t of s.towers.filter((t) => t.owner === s.current))
    t.relayUsed = false;
  s.moveAvailable = true;
  s.actionAvailable = true;
  s.committed = false;
  s.phase = "IDLE";
  log(s, `${NAMES[s.current]}回合`);
  return true;
}
