import "./style.css";
import { CONFIG, VERSION, NAMES } from "./config.js";
import * as E from "./engine.js";
import * as P from "./physics.js";
import { camera, profileFor, toView, fromView } from "./view.js";
import { render, TEAM } from "./renderer.js";
const $ = (id) => document.getElementById(id),
  canvas = $("board"),
  reduced = matchMedia("(prefers-reduced-motion: reduce)"),
  touch = () => matchMedia("(pointer: coarse)").matches;
let selectedRounds = 14,
  state = E.createGame(14, profileFor(innerWidth, innerHeight, touch())),
  viewOwner = 1,
  rotation = 0,
  rotationStart = null,
  menuLevel = null,
  selection = null,
  chosenTower = null,
  aim = null,
  pointer = null,
  dragStart = null,
  opponentVisible = false,
  effects = [],
  transitions = new Map(),
  last = 0,
  accumulator = 0,
  overlayKind = "home",
  rulesReturn = "home",
  toastTimer,
  sound = false,
  audio;
try {
  sound = localStorage.getItem("rd-sound") === "on";
} catch {}
function tone(freq = 450) {
  if (!sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(),
      g = audio.createGain();
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.025, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.08);
    o.connect(g);
    g.connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + 0.08);
  } catch {}
}
function toast(text) {
  $("toast").textContent = text;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").hidden = true), 2300);
}
function fit() {
  const rect = canvas.parentElement.getBoundingClientRect(),
    c = camera(state, rect.width || innerWidth, rect.height || innerHeight),
    dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.style.width = c.width + "px";
  canvas.style.height = c.height + "px";
  canvas.width = Math.round(c.width * dpr);
  canvas.height = Math.round(c.height * dpr);
  $("game").classList.toggle(
    "compact",
    Math.min(innerWidth, innerHeight) < 340,
  );
}
// Rendering transitions never delay or mutate authoritative rule settlement.
function visualSnapshot() {
  return {
    cells: [...state.cells],
    stability: [...state.stability],
    hp: [0, state.players[1].hp, state.players[2].hp],
    towerIds: state.towers.map((t) => t.id),
    claims: structuredClone(state.claims),
  };
}
function visualChanges(before, time = performance.now()) {
  if (!before || reduced.matches) return;
  const newTower = state.towers.find((t) => !before.towerIds.includes(t.id));
  const claimTower = before.claims
    .filter((c) => c.captor === state.current)
    .flatMap((c) => c.sources)
    .map((id) => state.towers.find((t) => t.id === id))
    .find(Boolean);
  const impact = [...effects]
    .reverse()
    .find((e) => ["blast", "siege"].includes(e.type));
  const anchor =
    newTower?.pos ||
    claimTower?.pos ||
    impact ||
    state.players[state.current].pos;
  for (let i = 0; i < state.cells.length; i++)
    if (
      before.cells[i] !== state.cells[i] ||
      before.stability[i] !== state.stability[i]
    ) {
      const colorChanged = before.cells[i] !== state.cells[i];
      transitions.set(i, {
        from: before.cells[i],
        fromTemporary: before.stability[i] === "temporary",
        born: time,
        delay: colorChanged
          ? Math.min(
              160,
              Math.hypot(
                (i % state.width) - anchor.x,
                Math.floor(i / state.width) - anchor.y,
              ) * 9,
            )
          : 0,
        duration: colorChanged ? 250 : 200,
      });
    }
  for (const owner of [1, 2])
    if (state.players[owner].hp < before.hp[owner]) {
      const p = state.players[owner].world || {
        x: state.players[owner].pos.x + 0.5,
        y: state.players[owner].pos.y + 0.5,
      };
      effects.push({ type: "damage", ...p, owner, born: time });
    }
}
function playerHUD(owner) {
  const p = state.players[owner],
    c = E.counts(state),
    n = state.towers.filter((t) => t.owner === owner).length;
  return `<strong>${NAMES[owner]} <span>${p.hp}/10 HP</span></strong><div class="hp-bar" aria-hidden="true">${Array.from({ length: 10 }, (_, i) => `<i class="${i < p.hp ? "" : "empty"}"></i>`).join("")}</div><div class="stats">${((100 * c[owner]) / state.cells.length).toFixed(1)}% · □ ${n}/5</div>`;
}
const button = (action, label, reason = "", cls = "") =>
  `<button data-action="${action}" class="${reason ? "unavailable " : ""}${cls}" ${reason ? `aria-disabled="true" data-reason="${reason}"` : ""}>${label}</button>`;
function drawStack() {
  const stack = $("stack");
  stack.hidden = !menuLevel;
  if (!menuLevel) return;
  if (menuLevel === "root")
    stack.innerHTML =
      button(
        "move",
        state.moveAvailable ? "移动" : "移动 · 已完成",
        state.moveAvailable ? "" : "本回合移动已用完",
      ) +
      button(
        "action",
        state.actionAvailable ? "行动" : "行动 · 已完成",
        state.actionAvailable ? "" : "本回合行动已用完",
      ) +
      button("end", "结束回合") +
      button("close-stack", "收起", "", "back");
  else if (menuLevel === "move")
    stack.innerHTML =
      button("move-aim", "弹射移动") +
      button("skip-move", "原地不动") +
      button("root", "返回", "", "back");
  else if (menuLevel === "action")
    stack.innerHTML =
      button("missile", "发射飞弹") +
      button(
        "tower",
        state.towers.filter((t) => t.owner === state.current).length === 5
          ? "重部署防御塔"
          : "建立防御塔",
        E.towerReason(state),
      ) +
      button(
        "dismantle",
        "拆除防御塔",
        E.nearbyTowers(state).length ? "" : "需要位于敌方防御塔控制区",
      ) +
      button("skip-action", "跳过行动") +
      button("root", "返回", "", "back");
  else if (menuLevel === "confirm-build")
    stack.innerHTML =
      "<p>在当前位置建立防御塔？</p>" +
      button("confirm-build", "确认建立") +
      button("action", "返回", "", "back");
  else if (menuLevel === "redeploy" || menuLevel === "dismantle-select")
    stack.innerHTML =
      "<p>点击战场上标记的防御塔</p>" + button("action", "返回", "", "back");
  else if (
    menuLevel === "confirm-redeploy" ||
    menuLevel === "confirm-dismantle"
  )
    stack.innerHTML =
      `<p>${menuLevel === "confirm-redeploy" ? "重新部署" : "拆除"} ${chosenTower?.slot} 塔？</p>` +
      button(
        menuLevel === "confirm-redeploy"
          ? "confirm-redeploy"
          : "confirm-dismantle",
        "确认",
      ) +
      button(
        menuLevel === "confirm-redeploy" ? "redeploy" : "dismantle-select",
        "返回",
        "",
        "back",
      );
}
function update() {
  const c = state.current,
    aiming = state.phase.includes("AIM"),
    flying = state.phase.includes("FLYING");
  $("game").classList.toggle("aiming", aiming);
  $("game").classList.toggle("flying", flying);
  $("round").textContent =
    `${state.overtime ? "加时" : "ROUND " + state.round + "/" + state.maxRounds}`;
  for (const [id, owner] of [
    ["current", c],
    ["opponent", E.enemy(c)],
  ]) {
    $(id === "opponent" ? "opponent-info" : id).innerHTML = playerHUD(owner);
    $(id).style.setProperty("--team", TEAM[owner]);
  }
  $("charge").hidden = !state.phase.startsWith("MISSILE");
  $("charge").textContent =
    `${"◆".repeat(state.charge)}${"◇".repeat(3 - state.charge)}  ${["0", "I", "II", "III"][state.charge]}`;
  let hint = selection
    ? "点击战场上的塔"
    : aiming
      ? `${state.phase.includes("RELAY") ? "中继 · " : ""}战场任意处向后拖拽${aim ? " · " + Math.round(aim.power * 100) + "%" : ""}`
      : flying
        ? ""
        : !state.moveAvailable && !state.actionAvailable
          ? "本回合已完成"
          : "";
  $("hint").textContent = hint;
  const fab = $("fab");
  fab.textContent = aiming
    ? state.committed
      ? "停止"
      : "取消"
    : flying
      ? "飞行中"
      : !state.moveAvailable && !state.actionAvailable
        ? "结束回合"
        : "操作";
  fab.disabled = flying || rotationStart !== null || !!overlayKind;
  fab.className = `fab ${c === 1 ? "red" : "blue"} ${flying ? "busy" : ""}`;
  $("opponent").hidden = !opponentVisible;
  $("opponent-toggle").setAttribute("aria-expanded", String(opponentVisible));
  drawStack();
  if (state.winner && overlayKind !== "result") result();
}
function panel(kind, content) {
  overlayKind = kind;
  $("overlay").hidden = false;
  $("panel").innerHTML = content;
  menuLevel = null;
  selection = null;
  pointer = null;
  aim = null;
  update();
  const first = $("panel").querySelector("button");
  first?.focus();
}
function closePanel() {
  overlayKind = null;
  $("overlay").hidden = true;
  update();
}
function home() {
  panel(
    "home",
    `<div class="team-shapes" aria-hidden="true"><span></span><span></span><span></span></div><p class="eyebrow">RICOCHET DOMINION</p><h1 id="panel-title">弹射领地战争</h1><p>两个人，一台设备。弹射抢地，连塔蓄能，切断对方的补给。</p><div class="row">${[10, 14, 18].map((n) => `<button data-panel="round-${n}" class="${n === selectedRounds ? "selected" : ""}">${{ 10: "快速", 14: "标准", 18: "长局" }[n]}<br>${n} 轮</button>`).join("")}</div><button class="primary" data-panel="start">开始双人对局</button><div class="row"><button data-panel="rules">玩法规则</button><button data-panel="sound">声音 ${sound ? "开" : "关"}</button></div><p class="version">v${VERSION} · 本地双人 PvP</p>`,
  );
}
function start() {
  state = E.createGame(
    selectedRounds,
    profileFor(innerWidth, innerHeight, touch()),
  );
  viewOwner = 1;
  rotationStart = null;
  rotation = 0;
  effects = [];
  transitions.clear();
  accumulator = 0;
  closePanel();
  fit();
  toast("红方先行 · 移动与行动可自由排序");
}
function rules() {
  rulesReturn = overlayKind || "game";
  panel(
    "rules",
    `<p class="eyebrow">HOW TO PLAY</p><h2 id="panel-title">先接通，再扩张</h2><p><b>每回合：</b>1 次移动 + 1 次行动，顺序自由。行动可选择飞弹、建塔／重部署、拆塔。可跳过或直接结束回合。</p><p><b>弹射：</b>在战场任意位置向后拖拽，松手发射。碰墙、敌塔和敌人反弹；己塔可捕获后重新瞄准。移动不染色、不扣血。</p><p><b>领地：</b>颜色通过上下左右接到己塔才稳定；断粮变为临时领地，颜色保留。在敌方临时领地建塔后，对方有完整一回合抢救，下一次你的回合开始时吞并仍未接通的原区域。</p><p><b>五塔网络：</b>出生塔计入 5 座上限。新塔每次自己的回合开始成长：1×1 → 3×3 → 5×5。保护地不能被普通飞弹染色。进入敌塔实际控制区即可用行动拆塔。</p><p><b>飞弹蓄能：</b>同一座己塔每回合仅捕获飞弹一次，已用塔只反弹。I 携带敌人；II 爆炸 5×5；III 击毁敌塔。普通爆炸为 3×3。角色中继与飞弹中继独立。</p><p><b>HP：</b>10 点。飞弹碰人瞬间，目标脚下为其自己颜色才扣 1 点。携带时每次从其他颜色重新进入目标颜色再扣 1 点；同一连续色区不重复扣。塔只保护地，不保护人。</p><p><b>胜负：</b>HP 归零立即结束；整轮结束占地达到 80% 获胜；最后一轮比较领地、HP、塔数。完全同分加时一轮，比净领地变化，再相同为平局。</p><p>发射后不可撤销。中继时「停止」会在当前塔位置结束移动／引爆飞弹。触屏换回合旋转战场，电脑红左蓝右。</p><div class="legend"><span><i></i>稳定</span><span><i class="temporary"></i>临时</span><span><i class="protected"></i>保护</span><span><i class="pending"></i>待吞并</span></div><button class="primary" data-panel="close">明白了</button>`,
  );
}
function result() {
  const w = state.winner,
    c = E.counts(state),
    label = {
      hp: "HP 胜利",
      territory: "80% 领地胜利",
      score: "终局计分",
      overtime: "加时结果",
    }[w.reason];
  panel(
    "result",
    `<p class="eyebrow">${label}</p><h2 id="panel-title">${w.player ? NAMES[w.player] + "获胜" : "双方平局"}</h2>${[1, 2].map((o) => `<p style="color:${TEAM[o]}">${NAMES[o]} · ${((100 * c[o]) / state.cells.length).toFixed(1)}% · ${state.players[o].hp} HP · ${state.towers.filter((t) => t.owner === o).length} 塔</p>`).join("")}<button class="primary" data-panel="start">再来一局</button><div class="row"><button data-panel="home">返回首页</button></div>`,
  );
}
function end() {
  if (!E.endTurn(state)) return;
  if (state.winner) {
    update();
    return;
  }
  panel(
    "handoff",
    `<p class="eyebrow">PASS DEVICE</p><h2 id="panel-title" style="color:${TEAM[state.current]}">交给 ${state.current === 1 ? "RED" : "BLUE"}</h2><p>准备好后开始你的回合。</p><button class="primary" data-panel="ready">READY · 准备好了</button>`,
  );
}
function ready() {
  const before = visualSnapshot();
  E.beginTurn(state);
  visualChanges(before);
  closePanel();
  if (state.profile !== "desktop" && !reduced.matches) {
    rotationStart = performance.now();
    rotation = 0;
  } else viewOwner = state.current;
  update();
}
function doAction(action) {
  if (overlayKind || rotationStart !== null) return;
  const before = visualSnapshot();
  selection = null;
  chosenTower = action.startsWith("confirm-") ? chosenTower : null;
  aim = null;
  pointer = null;
  if (["root", "move", "action"].includes(action)) {
    menuLevel = action === "root" ? "root" : action;
  } else if (action === "close-stack") menuLevel = null;
  else if (action === "move-aim" || action === "missile") {
    E.chooseAim(state, action === "move-aim" ? "move" : "missile");
    menuLevel = null;
  } else if (action === "skip-move" || action === "skip-action") {
    E.skip(state, action === "skip-move" ? "move" : "action");
    menuLevel = null;
  } else if (action === "end") {
    menuLevel = null;
    end();
  } else if (action === "tower") {
    if (E.towerReason(state)) {
      toast(E.towerReason(state));
      return;
    }
    if (state.towers.filter((t) => t.owner === state.current).length === 5) {
      menuLevel = "redeploy";
      selection = "redeploy";
    } else menuLevel = "confirm-build";
  } else if (action === "redeploy" || action === "dismantle-select") {
    menuLevel = action;
    selection = action === "redeploy" ? "redeploy" : "dismantle";
  } else if (action === "dismantle") {
    menuLevel = "dismantle-select";
    selection = "dismantle";
  } else if (action === "confirm-build") {
    E.buildTower(state);
    menuLevel = null;
  } else if (action === "confirm-redeploy") {
    E.buildTower(state, chosenTower?.slot);
    menuLevel = null;
  } else if (action === "confirm-dismantle") {
    E.dismantle(state, chosenTower?.id);
    menuLevel = null;
  }
  visualChanges(before);
  tone();
  update();
}
$("stack").addEventListener("click", (event) => {
  const b = event.target.closest("[data-action]");
  if (!b) return;
  if (b.dataset.reason) {
    toast(b.dataset.reason);
    return;
  }
  doAction(b.dataset.action);
});
$("fab").onclick = () => {
  if (state.phase.includes("AIM")) {
    const before = visualSnapshot();
    P.cancelAim(state);
    visualChanges(before);
    aim = null;
    pointer = null;
    menuLevel = null;
  } else if (state.phase === "IDLE") {
    if (!state.moveAvailable && !state.actionAvailable) {
      end();
      return;
    }
    menuLevel = menuLevel ? null : "root";
    selection = null;
  }
  update();
};
$("panel").addEventListener("click", (event) => {
  const b = event.target.closest("[data-panel]");
  if (!b) return;
  const action = b.dataset.panel;
  if (action === "start") start();
  else if (action === "home") home();
  else if (action === "rules") rules();
  else if (action === "ready") ready();
  else if (action === "close") {
    if (rulesReturn === "home") home();
    else closePanel();
  } else if (action.startsWith("round-")) {
    selectedRounds = Number(action.slice(6));
    home();
  } else if (action === "sound") {
    sound = !sound;
    try {
      localStorage.setItem("rd-sound", sound ? "on" : "off");
    } catch {}
    if (overlayKind === "home") home();
    else menuPanel();
    tone();
  } else if (action === "restart")
    panel(
      "confirm",
      `<h2 id="panel-title">重新开始？</h2><p>当前对局将清空。</p><button class="primary" data-panel="start">确认重新开始</button><div class="row"><button data-panel="close">继续对局</button></div>`,
    );
});
$("opponent-toggle").onclick = () => {
  opponentVisible = !opponentVisible;
  update();
};
$("opponent-close").onclick = () => {
  opponentVisible = false;
  update();
};
$("help").onclick = rules;
function menuPanel() {
  rulesReturn = "game";
  panel(
    "menu",
    `<h2 id="panel-title">对局设置</h2><p>第 ${state.round} 轮 · ${NAMES[state.current]}</p><button class="primary" data-panel="close">继续对局</button><div class="row"><button data-panel="rules">玩法规则</button><button data-panel="sound">声音 ${sound ? "开" : "关"}</button><button data-panel="restart">重新开始</button></div><p class="version">v${VERSION}</p>`,
  );
}
$("menu").onclick = menuPanel;
function worldPoint(event) {
  const r = canvas.getBoundingClientRect();
  return fromView(
    {
      x: ((event.clientX - r.left) / r.width) * state.width,
      y: ((event.clientY - r.top) / r.height) * state.height,
    },
    state,
    viewOwner,
  );
}
function pointerAim(event) {
  const rect = canvas.getBoundingClientRect(),
    maxPull = Math.min(130, rect.width * 0.35),
    dx = dragStart.x - event.clientX,
    dy = dragStart.y - event.clientY,
    d = fromView({ x: dx / rect.width * state.width, y: dy / rect.height * state.height }, state, viewOwner),
    zero = fromView({ x: 0, y: 0 }, state, viewOwner);
  return { x: d.x - zero.x, y: d.y - zero.y, power: Math.min(1, Math.hypot(dx, dy) / maxPull) };
}
function fire(a) {
  if (P.launch(state, a, a.power)) {
    tone(650);
    menuLevel = null;
    selection = null;
  } else toast("向后拉远一点再松手");
  aim = null;
  pointer = null;
  update();
}
canvas.addEventListener("pointerdown", (event) => {
  if (overlayKind || rotationStart !== null || event.button !== 0 || pointer)
    return;
  const p = worldPoint(event);
  if (selection) {
    const valid =
      selection === "redeploy"
        ? state.towers.filter((t) => t.owner === state.current)
        : E.nearbyTowers(state);
    const t = valid.find(
      (t) =>
        (Math.hypot(t.pos.x + 0.5 - p.x, t.pos.y + 0.5 - p.y) *
          canvas.clientWidth) /
          state.width <
        Math.max(22, (canvas.clientWidth / state.width) * 0.8),
    );
    if (t) {
      chosenTower = t;
      menuLevel =
        selection === "redeploy" ? "confirm-redeploy" : "confirm-dismantle";
      selection = null;
      update();
    }
    return;
  }
  if (!state.phase.includes("AIM")) return;
  // Relative drag: no need to touch the character or relay tower precisely.
  dragStart = { x: event.clientX, y: event.clientY };
  pointer = event.pointerId;
  aim = pointerAim(event);
  canvas.setPointerCapture(event.pointerId);
  event.preventDefault();
  update();
});
canvas.addEventListener("pointermove", (event) => {
  if (pointer !== event.pointerId) return;
  aim = pointerAim(event);
  update();
});
canvas.addEventListener("pointerup", (event) => {
  if (pointer !== event.pointerId) return;
  const a = pointerAim(event);
  pointer = null;
  if (canvas.hasPointerCapture(event.pointerId))
    canvas.releasePointerCapture(event.pointerId);
  if (!overlayKind && rotationStart === null && a) fire(a);
});
for (const name of ["pointercancel", "lostpointercapture"])
  canvas.addEventListener(name, () => {
    pointer = null;
    aim = null;
    update();
  });
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (overlayKind === "rules") {
    if (rulesReturn === "home") home();
    else closePanel();
  } else if (
    overlayKind &&
    !["home", "handoff", "result"].includes(overlayKind)
  )
    closePanel();
  else if (!overlayKind) {
    if (state.phase.includes("AIM")) P.cancelAim(state);
    menuLevel = null;
    selection = null;
    aim = null;
    pointer = null;
    update();
  }
});
function frame(time) {
  const dt = Math.min(0.05, Math.max(0, (time - last) / 1000 || 0));
  last = time;
  if (rotationStart !== null) {
    const t = Math.min(
      1,
      Math.max(0, (time - rotationStart) / CONFIG.rotationMs),
    );
    rotation = Math.PI * t * t * (3 - 2 * t);
    if (t >= 1) {
      rotationStart = null;
      rotation = 0;
      viewOwner = state.current;
      update();
    }
  }
  if (!overlayKind && rotationStart === null && !document.hidden) {
    accumulator += dt;
    const phase = state.phase;
    const before = state.activeBody ? visualSnapshot() : null;
    while (accumulator >= CONFIG.physics.step) {
      const e = P.stepBody(state, CONFIG.physics.step);
      if (e.length)
        effects.push(
          ...e.map((a) => ({ ...a, owner: state.current, born: time })),
        );
      accumulator -= CONFIG.physics.step;
    }
    visualChanges(before, time);
    if (phase !== state.phase || state.activeBody?.carried) update();
  } else accumulator = 0;
  effects = effects.filter((e) => time - e.born < 480);
  for (const [i, t] of transitions)
    if (time - t.born > t.delay + t.duration) transitions.delete(i);
  render(canvas, state, {
    owner: viewOwner,
    rotation,
    aim,
    select: selection,
    effects,
    transitions,
    time,
  });
  requestAnimationFrame(frame);
}
new ResizeObserver(fit).observe(canvas.parentElement);
window.addEventListener("resize", () => {
  fit();
  update();
});
document.addEventListener("visibilitychange", () => {
  accumulator = 0;
  last = performance.now();
  pointer = null;
  aim = null;
});
if (document.modelContext?.registerTool)
  try {
    Promise.resolve(
      document.modelContext.registerTool({
        name: "read_match_state",
        title: "Read current match",
        description:
          "Read the visible local PvP match state without changing it.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute(input) {
          if (
            !input ||
            typeof input !== "object" ||
            Array.isArray(input) ||
            Object.keys(input).length
          )
            throw Error("Expected empty object");
          return {
            version: VERSION,
            width: state.width,
            height: state.height,
            profile: state.profile,
            round: state.round,
            current: state.current,
            phase: state.phase,
            moveAvailable: state.moveAvailable,
            actionAvailable: state.actionAvailable,
            charge: state.charge,
            players: structuredClone(state.players),
            territory: E.counts(state),
            towers: structuredClone(state.towers),
            claims: structuredClone(state.claims),
            winner: state.winner,
          };
        },
      }),
    ).catch(() => {});
  } catch {}
fit();
home();
requestAnimationFrame(frame);
