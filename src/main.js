import "./style.css";
import * as E from "./engine.js";
import { launch, stepMissile, abandon } from "./physics.js";
import { CONFIG, NAMES, VERSION } from "./config.js";
import { toView, fromView } from "./view.js";
import { render } from "./renderer.js";

const $ = (id) => document.getElementById(id),
  canvas = $("board"),
  modal = $("modal");
let state = E.createGame(),
  desktop = matchMedia("(min-width:900px)").matches,
  viewOwner = 1,
  rotation = 0,
  rotationStart = 0,
  rotating = false,
  selectedRounds = 14,
  aim = null,
  cursor = null,
  pointer = null,
  effects = [],
  toastTimer,
  accumulator = 0,
  last = 0,
  audioContext;
const reduced = matchMedia("(prefers-reduced-motion:reduce)");
let resultShown = false,
  rulesReturn = "close";
let sound = false;
try {
  sound = localStorage.getItem("rd-sound") === "on";
} catch {}
function tone(freq = 440, duration = 0.07) {
  if (!sound) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume();
    const o = audioContext.createOscillator(),
      g = audioContext.createGain();
    o.connect(g);
    g.connect(audioContext.destination);
    o.frequency.value = freq;
    o.type = "sine";
    g.gain.setValueAtTime(0.04, audioContext.currentTime);
    g.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + duration,
    );
    o.start();
    o.stop(audioContext.currentTime + duration);
  } catch {}
}
function syncSound() {
  $("sound").setAttribute("aria-pressed", String(sound));
  $("sound").setAttribute("aria-label", sound ? "关闭音效" : "开启音效");
  $("sound").style.color = sound ? "#e7edf1" : "#708391";
}
function toast(text) {
  $("toast").textContent = text;
  $("toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("visible"), 1800);
}
function fit() {
  desktop = matchMedia("(min-width:900px)").matches;
  const shell = canvas.parentElement,
    box = shell.getBoundingClientRect(),
    W = desktop ? 32 : 18,
    H = desktop ? 18 : 32,
    tile = Math.max(1, Math.min(box.width / W, (box.height - 2) / H)),
    width = tile * W,
    height = tile * H,
    dpr = Math.min(3, devicePixelRatio || 1);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  $("board-label").textContent = `${W} × ${H}`;
  aim = null;
  pointer = null;
  cursor = null;
}
function button(label, action, options = {}) {
  return `<button data-action="${action}" class="${options.primary ? "primary " : ""}${options.quiet ? "quiet secondary" : ""}" ${options.disabled ? "disabled" : ""}>${label}</button>`;
}
function card(owner) {
  const p = state.players[owner],
    n = E.counts(state),
    t = state.towers.filter((a) => a.owner === owner),
    active = state.current === owner;
  return `<div class="player-name"><span class="player-token"></span>${NAMES[owner]}${active ? " · 行动" : ""}</div><div class="hp" aria-label="生命 ${p.hp}">${"●".repeat(p.hp)}${"○".repeat(3 - p.hp)}</div><div class="area"><strong>${((n[owner] / 576) * 100).toFixed(1)}<span style="font-size:.55em">%</span></strong><small>${n[owner]} 格领地 / 576</small></div><div class="tower-stats">${[
    "A",
    "B",
    "C",
  ]
    .map((slot) => {
      const tower = t.find((a) => a.slot === slot);
      return `<span><span class="tower-chip" style="opacity:${tower ? 1 : 0.35}">${slot}</span><span>${tower ? `${tower.stage * 2 + 1}×${tower.stage * 2 + 1} 保护` : "未部署"}</span></span>`;
    })
    .join(
      "",
    )}</div><span class="shield-label">${p.respawnShield ? "◇ 重生保护" : p.mobileShield ? "◌ 机动保护" : ""}</span>`;
}
function update() {
  document.documentElement.style.setProperty(
    "--accent",
    state.current === 1 ? "var(--red)" : "var(--blue)",
  );
  for (const owner of [1, 2]) {
    const node = $(owner === 1 ? "red-card" : "blue-card");
    node.innerHTML = card(owner);
    node.classList.toggle("active", owner === state.current);
    node.classList.toggle("mine", owner === state.current);
    node.classList.toggle("theirs", owner !== state.current);
  }
  const n = E.counts(state);
  for (const [id, owner] of [
    ["red-meter", 1],
    ["neutral-meter", 0],
    ["blue-meter", 2],
  ])
    $(id).style.width = `${(n[owner] / 576) * 100}%`;
  $("round").textContent = state.overtime
    ? "加时 · 1 轮"
    : `ROUND ${String(state.round).padStart(2, "0")} / ${state.maxRounds}`;
  $("mode").textContent =
    state.maxRounds === 10
      ? "快速对局"
      : state.maxRounds === 18
        ? "长局"
        : "标准对局";
  $("turn-badge").textContent = NAMES[state.current];
  $("latest-event").textContent = state.events.at(-1)?.text || "";
  let title = "",
    hint = "",
    actions = "";
  const phase = state.phase;
  $("ammo").innerHTML = ["MISSILE_AIM", "MISSILE_FLYING"].includes(phase)
    ? `<span aria-label="剩余 ${state.missilesRemaining} 发">${Array.from({ length: 3 }, (_, i) => `<i class="ammo-dot ${i >= state.missilesRemaining ? "spent" : ""}"></i>`).join("")}</span>`
    : "";
  $("fine-aim").hidden = phase !== "MISSILE_AIM";
  if (phase === "ROLE_ACTION") {
    title = "① 角色行动";
    hint = "点击或拖至横、竖、斜线目标格；每回合一次行动";
    actions = button("留在原位", "stay", { primary: true });
    const foe = state.players[E.enemy(state.current)];
    if (E.adjacent(state.players[state.current].pos, foe.pos))
      actions += button(
        foe.respawnShield || foe.mobileShield ? "对方受保护" : "近战 −1 HP",
        "melee",
        { disabled: !E.canMelee(state) },
      );
    for (const t of E.nearbyTowers(state))
      actions += button(`拆塔 ${t.slot}`, `dismantle-${t.slot}`);
  }
  if (phase === "TACTICAL_CHOICE") {
    title = "② 战术选择";
    hint = "选择飞弹或脚下建塔；本回合只能使用其中一种";
    actions =
      button("飞弹 ×3", "missiles", { primary: true }) +
      button("脚下建塔", "tower", { disabled: !!E.towerReason(state) });
    if (state.undo) actions += button("撤销角色行动", "undo", { quiet: true });
    if (E.towerReason(state)) hint = E.towerReason(state) + " · 可选择飞弹";
  }
  if (phase === "MISSILE_AIM") {
    title = state.relay ? `塔 ${state.relay.slot} · 中继发射` : "② 飞弹瞄准";
    hint = state.relay
      ? "继续同一发 · 从塔中心向后拉，再次松手发射"
      : "按住发射点反向拖拽，松开发射；也可展开精细瞄准";
    if (state.shotOpen)
      actions = button("放弃本弹", "abandon", { quiet: true });
    else {
      actions = button(
        state.missilesRemaining === 3 ? "跳过战术" : "结束战术",
        "finish",
        { primary: true },
      );
      if (state.missilesRemaining === 3)
        actions += button("改为建塔", "tower", {
          disabled: !!E.towerReason(state),
        });
      if (state.undo)
        actions += button("撤销角色行动", "undo", { quiet: true });
    }
  }
  if (phase === "MISSILE_FLYING") {
    title = "飞弹飞行中";
    hint = "墙和敌塔反弹 · 己塔捕获 · 落地染色 3×3";
    actions = button("飞行中…", "none", { disabled: true });
  }
  if (phase === "TURN_END") {
    title = "本回合完成";
    hint = desktop
      ? "结束回合后切换另一方"
      : "结束回合后交接设备，战场将旋转 180°";
    actions = button("结束回合", "end", { primary: true });
  }
  if (phase === "HANDOFF") {
    title = "交接回合";
    hint = "等待下一位玩家开始";
    actions = button("等待交接", "none", { disabled: true });
  }
  if (phase === "GAME_OVER") {
    title = "对局结束";
    hint = "领地、生命与防御塔已完成结算";
    actions =
      button("再来一局", "rematch", { primary: true }) +
      button("返回首页", "home");
  }
  $("phase-title").textContent = title;
  $("instruction").textContent = hint;
  $("actions").innerHTML = actions;
  if (phase === "GAME_OVER" && !resultShown) {
    resultShown = true;
    result();
  }
}
function openModal(kind, html) {
  pointer = null;
  aim = null;
  modal.dataset.kind = kind;
  $("modal-content").innerHTML = html;
  if (!modal.open) modal.showModal();
}
function closeModal() {
  modal.close();
  modal.dataset.kind = "";
  last = performance.now();
  accumulator = 0;
  canvas.focus({ preventScroll: true });
}
function start() {
  resultShown = false;
  state = E.createGame(selectedRounds);
  viewOwner = 1;
  rotation = 0;
  rotating = false;
  aim = null;
  cursor = null;
  effects = [];
  closeModal();
  update();
  requestAnimationFrame(fit);
}
function home() {
  openModal(
    "home",
    `<div class="start-symbols" aria-hidden="true"><span class="symbol-role"></span><span class="symbol-projectile"></span><span class="symbol-tower"></span></div><span class="eyebrow">LOCAL TWO-PLAYER · 本地双人</span><h1>弹射领地战争</h1><p>移动角色，建立三座中继塔。<br>让每一发反弹，成为你的领地。</p><div class="mode-options">${[10, 14, 18].map((n, i) => `<button data-modal="round-${n}" class="${selectedRounds === n ? "selected" : ""}">${["快速", "标准", "长局"][i]}<small>${n} 轮</small></button>`).join("")}</div><button class="primary full" data-modal="start">开始双人对局</button><button class="secondary full" data-modal="rules">先看规则</button><p style="font-size:12px;text-align:center">两人共用同一台设备 · 红方先手<br>${VERSION}</p>`,
  );
}
function rules() {
  const back = modal.dataset.kind === "home" ? "home" : "close";
  rulesReturn = back;
  openModal(
    "rules",
    `<span class="eyebrow">HOW TO PLAY</span><h2>两分钟，开始第一局</h2><div class="rule-list"><div><strong>1 · 先行动角色，再选择战术</strong><p>角色沿横、竖、斜线移动，距离不限。点击目标或拖动角色；也可以留在原位。</p></div><div><strong>2 · 飞弹：反向拖拽，松开发射</strong><p>每回合最多三发，落点染色 3×3。墙与敌塔会反弹；己塔捕获后可重新瞄准，无限中继仍算同一发。精细瞄准可用方向、力度滑块。</p></div><div><strong>3 · 防御塔：只建在脚下</strong><p>选择建塔就不发飞弹。塔在自己下两次回合开始时从 1×1 长到 3×3、5×5。最多三座，可以选择旧塔重部署。保护区无法被敌方染色，颜色在拆塔后保留。</p></div><div><strong>4 · 角色负责近战与拆塔</strong><p>回合开始就在相邻八格，才能近战或拆塔。己塔可穿过，敌塔会挡路。移动后获得近战保护，仍可被飞弹伤害。主动近战或拆塔会解除自己的重生保护。</p></div><div><strong>5 · 每人三点生命</strong><p>近战或飞弹命中扣 1 HP，重生保护持续到自己下回合结束。每个敌方战术阶段最多受到一次飞弹伤害。敌角色本体碰到飞弹也会触发爆炸。</p></div><div><strong>6 · 三条胜利路线</strong><p>对方生命归零立即获胜；完整一轮后控制 80% 领地获胜；最终按领地、生命、塔数量依次比较。同分加时一轮，再相同则平局。</p></div><div><strong>手机交接 / 电脑横屏</strong><p>手机换回合时交接设备并旋转战场；电脑红左蓝右固定。布局切换保留对局。角色移动后可以撤销，发弹或建塔后锁定。</p></div><div><strong>键盘辅助</strong><p>聚焦战场后用方向键调整目标、Enter 移动；Q/W/E/A/D/Z/X/C 对应八方向。Esc 取消瞄准。所有操作均可触控完成。</p></div></div><button class="primary full" data-modal="${back}">知道了</button>`,
  );
}
function result() {
  const w = state.winner,
    c = E.counts(state),
    reason = {
      hp: "对方生命归零",
      territory: "领地达到 80%",
      score: "最终回合结算",
      overtime: w.player ? "加时领地增量领先" : "加时后仍同分",
    };
  openModal(
    "result",
    `<span class="eyebrow">MATCH COMPLETE</span><h1 style="color:${w.player === 1 ? "var(--red)" : w.player === 2 ? "var(--blue)" : "#e7edf1"}">${w.player ? NAMES[w.player] + "获胜" : "势均力敌 · 平局"}</h1><p>${reason[w.reason]}</p><div class="result-scores">${[1, 2].map((p) => `<div><span style="color:${p === 1 ? "var(--red)" : "var(--blue)"}">${NAMES[p]}</span><strong>${((c[p] / 576) * 100).toFixed(1)}%</strong><span>${c[p]} 格 · ${state.players[p].hp} HP · ${state.towers.filter((t) => t.owner === p).length} 塔</span></div>`).join("")}</div><div class="modal-actions"><button class="primary" data-modal="start">再来一局</button><button data-modal="home">返回首页</button></div>`,
  );
}
function redeploy(selected = null) {
  const own = state.towers.filter((t) => t.owner === state.current);
  openModal(
    "redeploy",
    `<span class="eyebrow">REDEPLOY TOWER</span><h2>将哪一座塔移到脚下？</h2><p>旧塔区域保留颜色、解除保护；新塔从 1×1 重新成长。</p><div class="redeploy-grid">${own.map((t) => `<button data-modal="select-${t.slot}" class="${selected === t.slot ? "selected" : ""}"><span>塔 ${t.slot} · ${t.stage * 2 + 1}×${t.stage * 2 + 1}</span><span>${t.protected.length} 格保护</span></button>`).join("")}</div><div class="modal-actions"><button data-modal="close">取消</button><button class="primary" data-modal="deploy-${selected || ""}" ${selected ? "" : "disabled"}>确认重部署</button></div>`,
  );
}
function tower() {
  if (E.towerReason(state)) {
    toast(E.towerReason(state));
    return;
  }
  if (state.towers.filter((t) => t.owner === state.current).length === 3)
    redeploy();
  else E.buildTower(state);
}
function changeTurn() {
  if (!E.endTurn(state)) return;
  if (state.winner) {
    update();
    return;
  }
  if (desktop) {
    beginWithGrowth();
    viewOwner = state.current;
    update();
    return;
  }
  openModal(
    "handoff",
    `<div class="handoff"><div class="disc"></div><span class="eyebrow">PASS THE DEVICE</span><h1>交给${NAMES[state.current]}</h1><p>双方每次行动后交接，按钮保持正向。<br>战场将在开始后旋转 180°。</p><button class="primary full" data-modal="ready">开始我的回合</button></div>`,
  );
  update();
}
function beginWithGrowth() {
  const stages = new Map(
    state.towers.map((t) => [`${t.owner}-${t.slot}`, t.stage]),
  );
  E.beginTurn(state);
  for (const t of state.towers)
    if (t.stage !== stages.get(`${t.owner}-${t.slot}`))
      effects.push({
        type: "growth",
        x: t.pos.x + 0.5,
        y: t.pos.y + 0.5,
        owner: t.owner,
        stage: t.stage,
        born: performance.now(),
      });
}
function ready() {
  closeModal();
  beginWithGrowth();
  if (desktop || reduced.matches) {
    viewOwner = state.current;
    rotating = false;
  } else {
    rotating = true;
    rotationStart = performance.now();
    rotation = 0;
  }
  update();
}
function doAction(action) {
  if (modal.open || rotating || document.hidden) return;
  cursor = null;
  aim = null;
  pointer = null;
  if (action === "stay") E.stay(state);
  else if (action === "melee") E.melee(state);
  else if (action.startsWith("dismantle-"))
    E.dismantle(state, action.slice(-1));
  else if (action === "missiles") E.chooseMissiles(state);
  else if (action === "tower") tower();
  else if (action === "undo") E.undoRole(state);
  else if (action === "finish") E.finishTactic(state);
  else if (action === "abandon") abandon(state);
  else if (action === "end") changeTurn();
  else if (action === "rematch") start();
  else if (action === "home") home();
  tone(340);
  update();
}
$("actions").addEventListener("click", (e) => {
  const b = e.target.closest("[data-action]");
  if (b && !b.disabled) doAction(b.dataset.action);
});
$("modal-content").addEventListener("click", (e) => {
  const b = e.target.closest("[data-modal]");
  if (!b || b.disabled) return;
  const action = b.dataset.modal;
  if (action === "start") start();
  else if (action === "home") home();
  else if (action === "rules") rules();
  else if (action === "close") closeModal();
  else if (action === "ready") ready();
  else if (action === "restart-confirm")
    openModal(
      "confirm",
      `<h2>重新开始这局？</h2><p>当前对局进度将清空。</p><div class="modal-actions"><button data-modal="close">继续对局</button><button class="primary" data-modal="start">重新开始</button></div>`,
    );
  else if (action.startsWith("round-")) {
    selectedRounds = Number(action.split("-")[1]);
    home();
  } else if (action.startsWith("select-")) redeploy(action.slice(-1));
  else if (action.startsWith("deploy-")) {
    E.buildTower(state, action.slice(-1));
    closeModal();
    update();
  }
});
modal.addEventListener("cancel", (e) => {
  if (["home", "handoff", "result"].includes(modal.dataset.kind)) {
    e.preventDefault();
    return;
  }
  e.preventDefault();
  if (modal.dataset.kind === "rules" && rulesReturn === "home") home();
  else closeModal();
});
$("help").onclick = rules;
$("menu").onclick = () =>
  openModal(
    "menu",
    `<h2>对局菜单</h2><p>${NAMES[state.current]}行动 · 第 ${state.round} 轮</p><button class="primary full" data-modal="close">继续对局</button><button class="full" data-modal="restart-confirm">重新开始</button><button class="secondary full" data-modal="rules">查看规则</button>`,
  );
$("sound").onclick = () => {
  sound = !sound;
  try {
    localStorage.setItem("rd-sound", sound ? "on" : "off");
  } catch {}
  syncSound();
  tone(520);
};
function viewPoint(event) {
  const rect = canvas.getBoundingClientRect(),
    W = desktop ? 32 : 18;
  return {
    x: ((event.clientX - rect.left) / rect.width) * W,
    y: ((event.clientY - rect.top) / rect.width) * W,
  };
}
function launchPoint() {
  const p = state.relay?.pos || state.players[state.current].pos;
  return toView({ x: p.x + 0.5, y: p.y + 0.5 }, desktop, viewOwner);
}
function snapTarget(v) {
  const p = fromView(v, desktop, viewOwner),
    moves = E.legalMoves(state);
  let best = null,
    d = 0.95;
  for (const a of moves) {
    const distance = Math.hypot(p.x - a.x - 0.5, p.y - a.y - 0.5);
    if (distance < d) {
      best = a;
      d = distance;
    }
  }
  return best;
}
function aimFromPointer(v) {
  const origin = launchPoint(),
    dx = origin.x - v.x,
    dy = origin.y - v.y,
    tile = canvas.clientWidth / (desktop ? 32 : 18),
    maxPull = Math.min(130, canvas.clientWidth * 0.35),
    power = Math.min(1, (Math.hypot(dx, dy) * tile) / maxPull);
  return { dx, dy, power };
}
function fire(a) {
  const zero = fromView({ x: 0, y: 0 }, desktop, viewOwner),
    d = fromView({ x: a.dx, y: a.dy }, desktop, viewOwner),
    ok = launch(state, { x: d.x - zero.x, y: d.y - zero.y }, a.power);
  if (ok) {
    tone(650, 0.12);
    navigator.vibrate?.(12);
  } else toast("向后拉远一点再松手");
  aim = null;
  update();
}
canvas.addEventListener("pointerdown", (e) => {
  if (
    modal.open ||
    rotating ||
    !["ROLE_ACTION", "MISSILE_AIM"].includes(state.phase) ||
    e.button !== 0 ||
    pointer
  )
    return;
  const v = viewPoint(e);
  if (state.phase === "MISSILE_AIM") {
    const o = launchPoint(),
      tile = canvas.clientWidth / (desktop ? 32 : 18);
    if (Math.hypot(v.x - o.x, v.y - o.y) * tile > Math.max(22, tile * 0.85)) {
      toast("从发光的角色或塔中心向后拉");
      return;
    }
    pointer = { id: e.pointerId, type: "aim" };
    aim = aimFromPointer(v);
  } else {
    pointer = { id: e.pointerId, type: "move" };
    cursor = snapTarget(v);
  }
  canvas.setPointerCapture(e.pointerId);
  e.preventDefault();
});
canvas.addEventListener("pointermove", (e) => {
  if (!pointer || pointer.id !== e.pointerId) return;
  const v = viewPoint(e);
  if (pointer.type === "aim") aim = aimFromPointer(v);
  else cursor = snapTarget(v);
});
canvas.addEventListener("pointerup", (e) => {
  if (!pointer || pointer.id !== e.pointerId) return;
  const type = pointer.type;
  pointer = null;
  if (canvas.hasPointerCapture(e.pointerId))
    canvas.releasePointerCapture(e.pointerId);
  if (modal.open || rotating) {
    aim = null;
    cursor = null;
    return;
  }
  if (type === "aim" && aim) fire(aim);
  else if (cursor) {
    E.moveRole(state, cursor);
    cursor = null;
    tone(300);
    update();
  } else {
    const p = fromView(viewPoint(e), desktop, viewOwner),
      own = state.players[state.current].pos;
    if (Math.hypot(p.x - own.x - 0.5, p.y - own.y - 0.5) > 0.7) {
      toast("只能沿横、竖或斜线移动，不能穿过敌人");
      navigator.vibrate?.(15);
    }
  }
});
canvas.addEventListener("pointercancel", () => {
  pointer = null;
  aim = null;
  cursor = null;
});
canvas.addEventListener("lostpointercapture", () => {
  pointer = null;
  aim = null;
});
canvas.addEventListener("keydown", (e) => {
  if (modal.open || rotating || state.phase !== "ROLE_ACTION") return;
  if (e.key === "Enter" && cursor) {
    E.moveRole(state, cursor);
    cursor = null;
    update();
    e.preventDefault();
    return;
  }
  const dirs = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      q: [-1, -1],
      w: [0, -1],
      e: [1, -1],
      a: [-1, 0],
      d: [1, 0],
      z: [-1, 1],
      x: [0, 1],
      c: [1, 1],
    },
    dir = dirs[e.key];
  if (!dir) return;
  e.preventDefault();
  const p = cursor || state.players[state.current].pos,
    v = toView({ x: p.x + 0.5, y: p.y + 0.5 }, desktop, viewOwner),
    n = fromView({ x: v.x + dir[0], y: v.y + dir[1] }, desktop, viewOwner),
    target = { x: Math.floor(n.x), y: Math.floor(n.y) };
  if (E.legalMoves(state).some((a) => E.same(a, target))) cursor = target;
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.open) {
    pointer = null;
    aim = null;
    cursor = null;
  }
});
function fineAim() {
  const angle = (Number($("angle").value) * Math.PI) / 180,
    power = Number($("power").value) / 100;
  aim = { dx: Math.sin(angle), dy: -Math.cos(angle), power };
  $("angle-value").textContent = `${$("angle").value}°`;
  $("power-value").textContent = `${$("power").value}%`;
}
$("angle").oninput = fineAim;
$("power").oninput = fineAim;
$("precise-fire").onclick = () => {
  if (modal.open || rotating) return;
  fineAim();
  fire(aim);
};
$("fine-aim").addEventListener("toggle", () => requestAnimationFrame(fit));
function frame(time) {
  const elapsed = Math.min(0.05, (time - last) / 1000 || 0);
  last = time;
  if (rotating) {
    const t = Math.min(1, (time - rotationStart) / CONFIG.rotationMs);
    rotation = Math.PI * (t * t * (3 - 2 * t));
    if (t >= 1 || desktop) {
      rotation = 0;
      rotating = false;
      viewOwner = state.current;
    }
  }
  if (!document.hidden && !modal.open && !rotating) {
    accumulator += elapsed;
    const phase = state.phase;
    while (accumulator >= CONFIG.physics.step) {
      const before = [...state.cells];
      const events = stepMissile(state, CONFIG.physics.step);
      for (const e of events) {
        effects.push({ ...e, born: time, before, owner: state.current });
        tone(
          e.type === "bounce" ? 210 : e.type === "capture" ? 540 : 130,
          0.06,
        );
      }
      accumulator -= CONFIG.physics.step;
    }
    if (phase !== state.phase) update();
  } else accumulator = 0;
  effects = effects.filter((e) => time - e.born < 500);
  render(canvas, state, {
    desktop,
    owner: viewOwner,
    rotation,
    aim,
    cursor,
    effects,
    time,
  });
  requestAnimationFrame(frame);
}
document.addEventListener("visibilitychange", () => {
  last = performance.now();
  accumulator = 0;
  pointer = null;
  aim = null;
});
new ResizeObserver(() => {
  fit();
}).observe(canvas.parentElement);
window.addEventListener("resize", () => {
  fit();
  update();
});
// Read-only WebMCP uses the same state shown on the board; unsupported browsers simply skip it.
if (document.modelContext?.registerTool) {
  try {
    Promise.resolve(
      document.modelContext.registerTool({
        name: "read_match_state",
        title: "Read current match",
        description:
          "Read the current local two-player match without making a move.",
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
            throw new Error("Expected an empty object");
          return {
            version: VERSION,
            round: state.round,
            current: NAMES[state.current],
            phase: state.phase,
            territory: E.counts(state),
            players: structuredClone(state.players),
            towers: state.towers.map(({ owner, slot, pos, stage }) => ({
              owner,
              slot,
              pos,
              stage,
            })),
            winner: state.winner,
          };
        },
      }),
    ).catch(() => {});
  } catch {}
}
syncSound();
update();
fit();
home();
requestAnimationFrame(frame);
