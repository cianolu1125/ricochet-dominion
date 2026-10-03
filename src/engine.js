import { CONFIG, NAMES } from "./config.js";
export const enemy = (p) => 3 - p;
export const same = (a, b) => a.x === b.x && a.y === b.y;
export const adjacent = (a, b) =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) === 1;
export const inside = (s, p) =>
  Number.isInteger(p.x) &&
  Number.isInteger(p.y) &&
  p.x >= 0 &&
  p.x < s.width &&
  p.y >= 0 &&
  p.y < s.height;
export const index = (s, p) => p.y * s.width + p.x;
export function log(s, text) {
  s.events.push({ id: ++s.eventId, text });
  s.events = s.events.slice(-8);
}
export function createGame(maxRounds = 14) {
  if (!CONFIG.rounds.includes(maxRounds))
    throw new Error("Invalid round count");
  const s = {
    width: CONFIG.width,
    height: CONFIG.height,
    cells: Array(CONFIG.width * CONFIG.height).fill(0),
    players: {},
    current: 1,
    round: 1,
    maxRounds,
    phase: "ROLE_ACTION",
    towers: [],
    missilesRemaining: 3,
    activeMissile: null,
    relay: null,
    shotOpen: false,
    missileHit: false,
    undo: null,
    winner: null,
    overtime: false,
    overtimeStart: null,
    events: [],
    eventId: 0,
  };
  for (const p of [1, 2]) {
    const spawn = { x: 8, y: p === 1 ? 30 : 1 };
    s.players[p] = {
      hp: CONFIG.hp,
      spawn,
      pos: { ...spawn },
      mobileShield: false,
      respawnShield: false,
      shieldExpires: 0,
      turns: p === 1 ? 1 : 0,
    };
  }
  for (let y = 0; y < s.height; y++)
    for (let x = 0; x < s.width; x++)
      s.cells[y * s.width + x] =
        y < CONFIG.depth ? 2 : y >= s.height - CONFIG.depth ? 1 : 0;
  log(s, "红方先行 · 选择角色行动");
  return s;
}
export function counts(s) {
  const n = [0, 0, 0];
  for (const p of s.cells) n[p]++;
  return n;
}
export function protectedOwner(s, i) {
  return s.towers.find((t) => t.protected.includes(i))?.owner || 0;
}
export function blocked(s, p, owner) {
  return (
    same(s.players[enemy(owner)].pos, p) ||
    s.towers.some((t) => t.owner !== owner && same(t.pos, p))
  );
}
export function legalMoves(s, owner = s.current) {
  const out = [];
  const p = s.players[owner].pos;
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ])
    for (let n = 1; n < Math.max(s.width, s.height); n++) {
      const t = { x: p.x + dx * n, y: p.y + dy * n };
      if (!inside(s, t) || blocked(s, t, owner)) break;
      out.push(t);
    }
  return out;
}
function snapshot(s) {
  const a = { ...s, undo: null };
  s.undo = structuredClone(a);
}
function roleDone(s, text) {
  s.phase = s.winner ? "GAME_OVER" : "TACTICAL_CHOICE";
  log(s, text);
  return true;
}
export function moveRole(s, p) {
  if (
    s.phase !== "ROLE_ACTION" ||
    !inside(s, p) ||
    !legalMoves(s).some((a) => same(a, p))
  )
    return false;
  snapshot(s);
  s.players[s.current].pos = { ...p };
  s.players[s.current].mobileShield = true;
  return roleDone(s, "移动完成 · 机动保护生效");
}
export function stay(s) {
  if (s.phase !== "ROLE_ACTION") return false;
  snapshot(s);
  return roleDone(s, "角色留在原位");
}
export function canMelee(s) {
  const a = s.players[s.current],
    b = s.players[enemy(s.current)];
  return (
    s.phase === "ROLE_ACTION" &&
    adjacent(a.pos, b.pos) &&
    !b.mobileShield &&
    !b.respawnShield
  );
}
export function melee(s) {
  if (!canMelee(s)) return false;
  snapshot(s);
  s.players[s.current].respawnShield = false;
  damage(s, enemy(s.current));
  return roleDone(s, "近战命中 · 对方失去 1 HP");
}
export function nearbyTowers(s) {
  return s.towers.filter(
    (t) => t.owner !== s.current && adjacent(s.players[s.current].pos, t.pos),
  );
}
export function dismantle(s, slot) {
  if (s.phase !== "ROLE_ACTION") return false;
  const t = nearbyTowers(s).find((t) => t.slot === slot);
  if (!t) return false;
  snapshot(s);
  s.players[s.current].respawnShield = false;
  removeTower(s, t);
  return roleDone(s, `拆除敌方塔 ${slot} · 原领地已解除保护`);
}
export function undoRole(s) {
  if (
    !s.undo ||
    !["TACTICAL_CHOICE", "MISSILE_AIM", "TOWER_REDEPLOY"].includes(s.phase) ||
    s.shotOpen
  )
    return false;
  const restored = s.undo;
  Object.assign(s, restored);
  s.undo = null;
  log(s, "已撤销角色行动");
  return true;
}
function win(s, player, reason) {
  s.winner = { player, reason };
  s.phase = "GAME_OVER";
  s.activeMissile = null;
  s.relay = null;
  s.undo = null;
  log(s, player ? `${NAMES[player]}获胜` : "双方平局");
}
export function damage(s, p) {
  const player = s.players[p];
  if (s.winner || player.respawnShield) return false;
  player.hp--;
  if (player.hp <= 0) {
    win(s, enemy(p), "hp");
    return true;
  }
  const candidates = [];
  for (let y = 0; y < s.height; y++)
    for (let x = 0; x < s.width; x++) {
      const pos = { x, y };
      if (!blocked(s, pos, p)) candidates.push(pos);
    }
  candidates.sort(
    (a, b) =>
      Math.abs(a.x - player.spawn.x) +
        Math.abs(a.y - player.spawn.y) -
        (Math.abs(b.x - player.spawn.x) + Math.abs(b.y - player.spawn.y)) ||
      a.y - b.y ||
      a.x - b.x,
  );
  player.pos = { ...candidates[0] };
  player.respawnShield = true;
  player.shieldExpires = player.turns + 1;
  player.mobileShield = false;
  return true;
}
export function explode(s, owner, p) {
  if (s.winner) return;
  const center = {
    x: Math.max(0, Math.min(s.width - 1, Math.floor(p.x))),
    y: Math.max(0, Math.min(s.height - 1, Math.floor(p.y))),
  };
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const a = { x: center.x + dx, y: center.y + dy };
      if (inside(s, a)) {
        const i = index(s, a);
        if (!protectedOwner(s, i) || protectedOwner(s, i) === owner)
          s.cells[i] = owner;
      }
    }
  const target = s.players[enemy(owner)];
  if (
    !s.missileHit &&
    Math.abs(target.pos.x - center.x) <= 1 &&
    Math.abs(target.pos.y - center.y) <= 1 &&
    damage(s, enemy(owner))
  )
    s.missileHit = true;
}
export function removeTower(s, t) {
  s.towers = s.towers.filter((a) => a !== t);
}
function expand(s, t) {
  const radius = t.stage;
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++) {
      const p = { x: t.pos.x + dx, y: t.pos.y + dy };
      if (inside(s, p)) {
        const i = index(s, p),
          o = protectedOwner(s, i);
        if (!o || o === t.owner) {
          s.cells[i] = t.owner;
          if (!t.protected.includes(i)) t.protected.push(i);
        }
      }
    }
}
export function growTowers(s, owner) {
  for (const t of s.towers.filter((t) => t.owner === owner && t.stage < 2)) {
    t.stage++;
    expand(s, t);
    log(
      s,
      `${NAMES[owner]}塔 ${t.slot} 扩张至 ${t.stage * 2 + 1}×${t.stage * 2 + 1}`,
    );
  }
}
export function towerReason(s) {
  const p = s.players[s.current].pos;
  if (s.towers.some((t) => same(t.pos, p))) return "脚下已有防御塔";
  if (protectedOwner(s, index(s, p)) === enemy(s.current))
    return "敌方塔保护区内无法建塔";
  return "";
}
export function buildTower(s, slot) {
  if (
    !["TACTICAL_CHOICE", "MISSILE_AIM", "TOWER_REDEPLOY"].includes(s.phase) ||
    s.shotOpen ||
    s.missilesRemaining !== 3 ||
    towerReason(s)
  )
    return false;
  const own = s.towers.filter((t) => t.owner === s.current);
  if (own.length === CONFIG.maxTowers) {
    const old = own.find((t) => t.slot === slot);
    if (!old) return false;
    removeTower(s, old);
  } else slot = ["A", "B", "C"].find((a) => !own.some((t) => t.slot === a));
  const t = {
    owner: s.current,
    pos: { ...s.players[s.current].pos },
    slot,
    stage: 0,
    protected: [],
  };
  s.towers.push(t);
  expand(s, t);
  s.undo = null;
  s.phase = "TURN_END";
  s.relay = null;
  log(s, `塔 ${slot} 已部署 · 脚下格永久保护`);
  return true;
}
export function chooseMissiles(s) {
  if (s.phase !== "TACTICAL_CHOICE") return false;
  s.phase = "MISSILE_AIM";
  return true;
}
export function finishTactic(s) {
  if (!["TACTICAL_CHOICE", "MISSILE_AIM"].includes(s.phase) || s.shotOpen)
    return false;
  s.undo = null;
  s.relay = null;
  s.phase = "TURN_END";
  return true;
}
function settleRound(s) {
  const c = counts(s);
  for (const p of [1, 2])
    if (c[p] / s.cells.length >= CONFIG.threshold) {
      win(s, p, "territory");
      return;
    }
  if (s.overtime) {
    const delta = [c[1] - s.overtimeStart[1], c[2] - s.overtimeStart[2]];
    win(s, delta[0] === delta[1] ? 0 : delta[0] > delta[1] ? 1 : 2, "overtime");
    return;
  }
  if (s.round < s.maxRounds) return;
  const hp = s.players[1].hp - s.players[2].hp,
    towers =
      s.towers.filter((t) => t.owner === 1).length -
      s.towers.filter((t) => t.owner === 2).length;
  const difference = c[1] - c[2] || hp || towers;
  if (difference) {
    win(s, difference > 0 ? 1 : 2, "score");
    return;
  }
  s.overtime = true;
  s.overtimeStart = c;
  log(s, "完全同分 · 进入一轮加时");
}
export function endTurn(s) {
  if (s.phase !== "TURN_END") return false;
  const p = s.players[s.current];
  if (p.respawnShield && p.turns >= p.shieldExpires) p.respawnShield = false;
  if (s.current === 2) {
    settleRound(s);
    if (s.winner) return true;
    s.round++;
  }
  s.current = enemy(s.current);
  s.phase = "HANDOFF";
  s.undo = null;
  s.activeMissile = null;
  s.relay = null;
  s.shotOpen = false;
  return true;
}
export function beginTurn(s) {
  if (s.phase !== "HANDOFF") return false;
  const p = s.players[s.current];
  p.turns++;
  p.mobileShield = false;
  s.missilesRemaining = 3;
  s.missileHit = false;
  s.shotOpen = false;
  growTowers(s, s.current);
  s.phase = "ROLE_ACTION";
  log(s, `${NAMES[s.current]}回合 · 选择角色行动`);
  return true;
}
