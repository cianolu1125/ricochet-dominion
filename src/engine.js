import { activeTower, recoverExpiredOverloads, resolveDueTakeovers, reconcileTowerInfluence } from "./outposts.js";
export { reconcileTowerInfluence, activeTower, applyRelayOverload, hasExternalFriendlyProtection, getTakeoverCandidates, getReclaimCandidates, getRedeployableOwnedTowers, outpostAction, startTakeover, reclaimTower } from "./outposts.js";
import { refreshClaims } from "./claims.js";
import { paintTargets, crossTrace, charge3AttackMask } from "./charge.js";
import { fact, feedbackId } from "./feedback-events.js";
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
  if (
    !Number.isInteger(maxRounds) ||
    !CONFIG.rounds.includes(maxRounds) ||
    !PROFILES[profile]
  )
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
    visitedRelayTowerIds: new Set(),
    moveVisited: [],
    committed: false,
    nextId: 0,
    winner: null,
    events: [],
    eventId: 0,
  };
  const desktop = profile === "desktop",
    depth = Math.round((desktop ? width : height) * 0.125);
  for (const owner of [1, 2]) {
    const pos = desktop
      ? { x: owner === 1 ? 1 : width - 2, y: Math.floor(height / 2) }
      : { x: Math.floor(width / 2), y: owner === 1 ? height - 2 : 1 };
    s.players[owner] = { hp: maxRounds, maxHp: maxRounds, pos, turns: owner === 1 ? 1 : 0 };
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
      state: "normal",
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
  return (
    s.towers.find((t) => activeTower(t) && s.cells[i] === t.owner && t.protected.includes(i))
      ?.owner || 0
  );
}
export function recompute(s) {
  s.protectedBy = Array.from({ length: s.cells.length }, () => []);
  for (const t of s.towers) {
    t.protected = [];
    towerInfluence(s,t);
    if (!activeTower(t)) continue;
    for (const i of towerInfluence(s,t)) {
      if (s.cells[i] === t.owner) {
        t.protected.push(i);
        s.protectedBy[i].push(t.id);
      }
    }
  }
  s.stability = s.cells.map((c) => (c ? "temporary" : null));
  for (const owner of [1, 2]) {
    const q = [],
      seen = new Set();
    for (const t of s.towers.filter((t) => t.owner === owner && activeTower(t))) {
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
  reconcileTowerInfluence(s);
  refreshClaims(s, neighbors);
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
// Structure radius and current influence are deliberately separate.
export function potentialRange(s,t) {
  const cells=[];
  for(let y=t.pos.y-t.stage;y<=t.pos.y+t.stage;y++)
    for(let x=t.pos.x-t.stage;x<=t.pos.x+t.stage;x++)
      if(inside(s,{x,y}))cells.push(index(s,{x,y}));
  return cells;
}
export function towerInfluence(s,t) {
  const allowed=new Set(potentialRange(s,t));
  // Compatibility for existing fixtures/legacy entities; initialize once only.
  if(!Array.isArray(t.influence))t.influence=[...allowed].filter(i=>s.cells[i]===t.owner);
  else t.influence=[...new Set(t.influence)].filter(i=>allowed.has(i));
  return t.influence;
}
export function expand(s,t) {
  const influence=new Set(towerInfluence(s,t));
  for(const i of potentialRange(s,t)) {
    const protector=protectedOwner(s,i);
    if(protector && protector!==t.owner)continue;
    s.cells[i]=t.owner;influence.add(i);
    if(!t.protected.includes(i))t.protected.push(i);
  }
  t.influence=[...influence];
}
export function removeTower(s,t) {
  s.towers=s.towers.filter(a=>a.id!==t.id);
  recompute(s);
}
export function growTowers(s,owner) {
  for(const t of s.towers.filter(t=>t.owner===owner && activeTower(t) &&
    t.activationTurn!==s.turnIndex && t.skipGrowthTurn!==s.turnIndex).sort((a,b)=>a.id-b.id)) {
    const before=new Set(towerInfluence(s,t));
    if(t.stage<2) {
      t.stage++;expand(s,t);
    } else {
      // Freeze the frontier before painting, so this phase advances only one layer.
      const frontier=potentialRange(s,t).filter(i=>!before.has(i) &&
        protectedOwner(s,i)!==enemy(owner) &&
        (before.size ? neighbors(s,i).some(j=>before.has(j)) : i===index(s,t.pos)));
      for(const i of frontier){s.cells[i]=owner;before.add(i);}
      t.influence=[...before];
    }
    // Keep protection and residual masks current between overlapping tower growths.
    recompute(s);
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
  if (s.winner || s.players[s.current].hp <= 0 || s.phase !== "IDLE" || !s.actionAvailable || towerReason(s)) return false;
  const own = s.towers.filter((t) => t.owner === s.current);
  if (own.length === 5 && !own.some((t) => t.slot === slot && activeTower(t))) return false;
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
      state: "normal",
  };
  s.towers.push(t);
  expand(s, t);
  recompute(s);
  if (claimed) {
    s.claims.push({
      id: ++s.nextId,
      captor: s.current,
      target,
      cells: claimed,
      sources: [t.id],
      createdTurn: s.turnIndex,
      dueTurn: s.turnIndex + 2,
    });
  }
  recompute(s);
  s.actionAvailable = false;
  healPlayerFromDeployment(s, s.current);
  log(s, `防御塔 ${slot} 已部署${claimed ? " · 断粮区域待吞并" : ""}`);
  return true;
}
export function nearbyTowers(s) {
  const i = index(s, s.players[s.current].pos);
  return s.towers.filter(
    (t) => t.owner !== s.current && activeTower(t) && t.protected.includes(i),
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
  s.visitedRelayTowerIds = new Set();
  for (const t of s.towers) t.relayUsed = false;
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
  s.visitedRelayTowerIds.clear();
  s.moveVisited = [];
  for (const t of s.towers) t.relayUsed = false;
  log(s, player ? `${NAMES[player]}获胜` : "双方平局");
}
export function damage(s, owner, source = "territory") {
  if (s.winner) return false;
  s.players[owner].hp--;
  const p = s.players[owner];
  fact(s, {
    type: "damage",
    source,
    owner,
    ...(s.feedbackPosition ||
      p.world || { x: p.pos.x + 0.5, y: p.pos.y + 0.5 }),
  });
  log(s, `${NAMES[owner]} -1 HP`);
  if (s.players[owner].hp <= 0) win(s, enemy(owner), "hp");
  return true;
}
// Territory status never changes ownership: neutral is not enemy land.
export function isEnemyTerritory(s, owner, position = s.players[owner].pos) {
  return s.cells[index(s, position)] === enemy(owner);
}
export function isDamagingEnemyTerritory(s, owner, position = s.players[owner].pos) {
  const i = index(s, position);
  return isEnemyTerritory(s, owner, position) &&
    (s.stability[i] === "stable" || protectedOwner(s, i) === enemy(owner));
}
// Action-scoped state shared by collision rules and presentation.
export function relayStatus(s, tower, kind = null) {
  if (s.winner || !activeTower(tower) || !s.towers.includes(tower) || tower.owner !== s.current) return "normal";
  if (!kind) kind = s.phase.startsWith("MOVE_") ? "move" :
    s.phase.startsWith("MISSILE_") ? "missile" : null;
  if (!kind) return "normal";
  const used = kind === "move" ? s.moveVisited.includes(tower.id) :
    s.visitedRelayTowerIds.has(tower.id);
  return used ? "used" : "available";
}
export function hitRole(s, owner) {
  const hostile = isDamagingEnemyTerritory(s, owner);
  if (hostile) damage(s, owner);
  return hostile;
}
function healPlayerFromDeployment(s, owner) {
  const player = s.players[owner];
  if (s.winner || player.hp <= 0) return;
  const before = player.hp;
  player.hp = Math.min(player.maxHp, before + CONFIG.deployHeal);
  if (player.hp === before) return;
  fact(s, {type: "heal", owner, amount: player.hp - before,
    x: player.pos.x + 0.5, y: player.pos.y + 0.5});
  log(s, `${NAMES[owner]} +1 HP`);
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
export function paintMissile(s, owner, position, level) {
  if (s.winner) return;
  if (level === 3) return resolveCharge3(s, owner, position);
  const cross = level >= 2 ? crossTrace(s, position) : null;
  const targets = paintTargets(s, position, level),
    shielded = cross ? [...cross.shielded] : [];
  for (const i of targets) {
    const protector = protectedOwner(s, i);
    if (protector && protector !== owner) shielded.push(i);
    else s.cells[i] = owner;
  }
  recompute(s);
  if (level >= 2) {
    const c = grid(s, position);
    fact(s, {
      type: "cross",
      owner,
      x: c.x + 0.5,
      y: c.y + 0.5,
      width: s.width,
      height: s.height,
      shielded,
      ends: cross.ends,
      charge: level,
    });
  }
}
// One immutable attack mask and one causal event. Visual order never affects rules.
function resolveCharge3(s, owner, position) {
  const center = grid(s, position), mask = charge3AttackMask(s, position);
  const attackCells = [...mask], paintedCells = attackCells.filter(i => s.cells[i] !== owner);
  const brokenProtectedCells=attackCells.filter(i=>protectedOwner(s,i)===enemy(owner));
  const targets = s.towers.filter(t => t.owner !== owner && mask.has(index(s, t.pos)));
  const destroyedTowers = structuredClone(targets);
  const targetOwner = enemy(owner), vanguardPosition = {...s.players[targetOwner].pos};
  const vanguardHit = mask.has(index(s, vanguardPosition));
  const brokenInfluenceCells = new Set();
  for (const t of s.towers.filter(t => t.owner !== owner)) {
    const before = towerInfluence(s,t);
    for (const i of before) if (mask.has(i)) brokenInfluenceCells.add(i);
    t.influence = before.filter(i => !mask.has(i));
  }
  for (const i of attackCells) s.cells[i] = owner;
  const removedIds = new Set(targets.map(t => t.id));
  s.towers = s.towers.filter(t => !removedIds.has(t.id));
  // Derive a complete new map before damage can put the match into GAME_OVER.
  recompute(s);
  const event = fact(s, {type:"charge3Ultimate", owner, x:center.x+.5, y:center.y+.5,
    width:s.width, height:s.height, attackCells, paintedCells,
    brokenInfluenceCells:[...brokenInfluenceCells], brokenProtectedCells, destroyedTowers,
    destroyedTowerIds:[...removedIds], vanguardHit, vanguardPosition, targetOwner});
  if (vanguardHit) {
    const previous = s.feedbackGroup;
    s.feedbackGroup = event.groupId;
    damage(s, targetOwner, "charge3");
    s.feedbackGroup = previous;
  }
  return event;
}
export function siege(s, t, p) {
  if (s.winner) return;
  paintMissile(s, s.current, p, 3);
}
function settleRound(s) {
  const c = counts(s);
  for (const p of [1, 2])
    if (c[p] / s.cells.length >= CONFIG.threshold) {
      win(s, p, "territory");
      return;
    }
  if (s.round < s.maxRounds) return;
  const d =
    c[1] - c[2] ||
    s.players[1].hp - s.players[2].hp ||
    s.towers.filter((t) => t.owner === 1).length -
      s.towers.filter((t) => t.owner === 2).length;
  win(s, d === 0 ? 0 : d > 0 ? 1 : 2, d ? "score" : "draw");
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
  s.visitedRelayTowerIds.clear();
  s.moveVisited = [];
  for (const t of s.towers) t.relayUsed = false;
  return true;
}
export function beginTurn(s) {
  if (s.phase !== "HANDOFF") return false;
  s.feedbackGroup = feedbackId();
  s.turnIndex++;
  s.players[s.current].turns++;
  recompute(s);
  resolveDueTakeovers(s, s.current);
  recompute(s);
  const due = s.claims.filter(
    (c) =>
      c.captor === s.current && (c.dueTurn ?? c.createdTurn + 2) <= s.turnIndex,
  );
  const converted = [];
  for (const c of due)
    for (const i of c.cells)
      if (
        s.cells[i] === c.target &&
        s.stability[i] === "temporary" &&
        protectedOwner(s, i) !== c.target
      ) {
        s.cells[i] = c.captor;
        converted.push(i);
      }
  if (converted.length)
    fact(s, {
      type: "convert",
      cells: converted,
      size: converted.length,
      x: s.players[s.current].pos.x + 0.5,
      y: s.players[s.current].pos.y + 0.5,
    });
  s.claims = s.claims.filter((c) => !due.includes(c));
  recompute(s);
  recoverExpiredOverloads(s, s.current);
  growTowers(s, s.current);
  recompute(s);
  for (const t of s.towers.filter((t) => t.owner === s.current))
    t.relayUsed = false;
  s.moveAvailable = true;
  s.actionAvailable = true;
  s.committed = false;
  s.terminalActionCommitted = false;
  s.phase = "IDLE";
  s.feedbackGroup = null;
  log(s, `${NAMES[s.current]}回合`);
  return true;
}
