import "./style.css";
import { CONFIG, VERSION } from "./config.js";
import * as E from "./engine.js";
import * as P from "./physics.js";
import { battlefieldViewport, profileFor, toView, fromView } from "./view.js";
import { branchLayout } from "./branches.js";
import { render, TEAM } from "./renderer.js";
import { t, teamName, getLanguage, setLanguage } from "./i18n.js";
const $ = (id) => document.getElementById(id),
  canvas = $("board"),
  reduced = matchMedia("(prefers-reduced-motion: reduce)"),
  touch = () => matchMedia("(pointer: coarse)").matches;
let selectedRounds = 14,
  state = E.createGame(14, profileFor(innerWidth, innerHeight, touch())),
  viewOwner = 1,
  rotation = 0,
  rotationStart = null,
  settlingUntil = null,
  menuLevel = null,
  selection = null,
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
  audio,
  cancelArmed = false,
  settingsOrigin = "game",
  savedMenu = "root",
  savedSelection = null,
  toastKey = null;
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
function toast(key) {
  toastKey = key;
  $("toast").textContent = t(key);
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $("toast").hidden = true; toastKey=null; }, 2300);
}
function fit() {
  const rect = canvas.parentElement.getBoundingClientRect(),
    c = {width:rect.width || innerWidth,height:rect.height || innerHeight},
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
    towers: structuredClone(state.towers),
    claims: structuredClone(state.claims),
  };
}
function visualChanges(before, time = performance.now()) {
  if (!before) return;
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
          : Math.min(220, Math.hypot((i % state.width)-anchor.x, Math.floor(i/state.width)-anchor.y)*8),
        duration: reduced.matches ? 60 : colorChanged ? 180 : 230,
      });
    }
  for (const owner of [1, 2])
    if (state.players[owner].hp < before.hp[owner]) {
      const p = state.players[owner].world || {
        x: state.players[owner].pos.x + 0.5,
        y: state.players[owner].pos.y + 0.5,
      };
      for(let n=0;n<before.hp[owner]-state.players[owner].hp;n++)
        effects.push({ type: "damage", ...p, owner, born: time, drift: (effects.length % 3 - 1)*0.8, reduced: reduced.matches });
    }
  for(const old of before.towers) if(!state.towers.some(t=>t.id===old.id)) effects.push({type:"destroy",x:old.pos.x+0.5,y:old.pos.y+0.5,owner:old.owner,born:time});
  for(const tower of state.towers) {const old=before.towers.find(t=>t.id===tower.id);if(!old || old.stage!==tower.stage) effects.push({type:"grow",x:tower.pos.x+0.5,y:tower.pos.y+0.5,owner:tower.owner,born:time});}
}
function playerHUD(owner) {
  const p = state.players[owner],
    c = E.counts(state),
    n = state.towers.filter((t) => t.owner === owner).length;
  return `<strong>${teamName(owner)} <span>${p.hp}/10 HP</span></strong><div class="hp-bar" aria-hidden="true">${Array.from({ length: 10 }, (_, i) => `<i class="${i < p.hp ? "" : "empty"}"></i>`).join("")}</div><div class="stats">${((100 * c[owner]) / state.cells.length).toFixed(1)}% · □ ${n}/5</div>`;
}
const button = (action, label, reason = "", cls = "") =>
  `<button data-action="${action}" class="${reason ? "unavailable " : ""}${cls}" ${reason ? `aria-disabled="true" data-reason="${reason}"` : ""}>${label}</button>`;
function drawStack() {
  const stack=$("stack"), idle=state.phase === "IDLE" && !overlayKind && rotationStart === null && settlingUntil === null;
  if (idle && !selection && !menuLevel) menuLevel="root";
  stack.hidden=!idle || !menuLevel || (menuLevel === "root" && !state.moveAvailable && !state.actionAvailable);
  if(stack.hidden) return;
  if(menuLevel === "root") stack.innerHTML=
    (state.moveAvailable ? button("move",t("Move")) : "")+
    (state.actionAvailable ? button("action",t("Action")) : "");
  else if(menuLevel === "action") stack.innerHTML=
    button("missile",t("Fire"), state.actionAvailable ? "" : t("Action used"))+
    button("tower",t(state.towers.filter(t=>t.owner===state.current).length===5 ? "Redeploy Outpost" : "Build Outpost"),towerReason())+
    button("dismantle",t("Destroy Outpost"), E.nearbyTowers(state).length ? "" : t("Not nearby"))+
    button("root",t("Back"),"","back");
  else stack.innerHTML=`<p>${t("Select Outpost")}</p>`+button("action",t("Back"),"","back");
  stack.insertAdjacentHTML('afterbegin','<svg class="branch-lines" aria-hidden="true"></svg>');
  positionMenu();
}
function towerReason() { const reason=E.towerReason(state); return reason ? t(reason.includes("脚下") ? "Occupied" : "Protected") : ""; }
function positionMenu() {
  const stack=$("stack"); if(stack.hidden) return;
  const r=canvas.getBoundingClientRect(), player=state.players[state.current], w=player.world || {x:player.pos.x+0.5,y:player.pos.y+0.5}, p=toView(w,state,viewOwner);
  const board=boardViewport();
  const anchor={x:r.left+board.x+p.x*board.tile,y:r.top+board.y+p.y*board.tile};
  const bottom=$("toolbar").getBoundingClientRect().top || innerHeight-64;
  const buttons=[...stack.querySelectorAll('button')];
  const widths=buttons.map(b=>Math.max(b.dataset.action==='root'?60:80,Math.min(140,b.textContent.length*(getLanguage()==='en'?7:14)+24)));
  const geometry=JSON.stringify([anchor,bottom,innerWidth,menuLevel,widths]);
  const svg=stack.querySelector(".branch-lines");
  if(svg.dataset.geometry===geometry) return;
  svg.dataset.geometry=geometry;
  const fanWidths=menuLevel==='action' ? [widths[3],...widths.slice(0,3)] : widths;
  const layout=branchLayout(anchor,{left:4,top:4,right:innerWidth-4,bottom:bottom-8},menuLevel==='action'?'action':'root',fanWidths);
  stack.style.setProperty("--team",TEAM[state.current]);
  const points=new Map(layout.nodes.map(n=>[n.key,n]));
  buttons.forEach((b,i)=>{
    const n=points.get(b.dataset.action) || layout.nodes[0];
    b.style.left=(n.x-n.width/2)+"px"; b.style.top=(n.y-n.height/2)+"px";
    b.style.width=n.width+"px";b.style.setProperty('--delay',(i*35+70)+'ms');
    b.style.setProperty('--from-x',(anchor.x-n.x)+'px');b.style.setProperty('--from-y',(anchor.y-n.y)+'px');
  });
  stack.querySelector('.branch-lines').innerHTML=layout.links.map(l=>`<path d="M ${l.from.x} ${l.from.y} L ${l.to.x} ${l.to.y}"/>`).join('');
  const label=stack.querySelector('p');if(label){label.style.left=Math.max(4,Math.min(innerWidth-180,anchor.x-90))+'px';label.style.top=Math.max(4,anchor.y-92)+'px';}
}
function cancelCurrentAim() {
  if(!state.phase.includes("AIM")) return;
  const missile=state.phase.startsWith("MISSILE"), relay=state.committed;
  // A relay is already committed; cancellation never calls the legacy stop/explode API.
  if(!relay) P.cancelAim(state);
  aim=null; pointer=null; dragStart=null; cancelArmed=false;
  menuLevel=relay ? null : missile ? "action" : "root";
  update();
}
function inCancel(event) {
 const r=$("cancel-zone").getBoundingClientRect();
 return event.clientX>=r.left && event.clientX<=r.right && event.clientY>=r.top && event.clientY<=r.bottom;
}
function update() {
  const c=state.current, aiming=state.phase.includes("AIM"),flying=state.phase.includes("FLYING");
  document.documentElement.lang=getLanguage(); document.title=t("Title")+" · v"+VERSION;
  canvas.setAttribute("aria-label",t("Board"));
  $("game").classList.toggle("aiming",aiming); $("game").classList.toggle("flying",flying);
  $("game").classList.toggle("cancel-armed",cancelArmed);
  $("round").textContent=state.overtime ? t("Overtime") : (innerWidth<380 ? "R" : t("Round")+" ")+state.round+"/"+state.maxRounds;
  for(const [id,owner] of [["current",c],["opponent",E.enemy(c)]]) { $(id==='opponent'?'opponent-info':id).innerHTML=playerHUD(owner); $(id).style.setProperty("--team",TEAM[owner]); }
  $("charge").hidden=!state.phase.startsWith("MISSILE");
  $("charge").textContent=t("Charge")+" "+["0","Ⅰ","Ⅱ","Ⅲ"][state.charge];
  $("hint").textContent=selection ? t("Select Outpost") : "";
  $("fab").textContent=t("End Turn");
  $("fab").disabled=flying || rotationStart!==null || settlingUntil!==null || !!overlayKind;
  $("menu").disabled=rotationStart!==null || settlingUntil!==null;
  $("opponent-toggle").disabled=rotationStart!==null || settlingUntil!==null;
  $("fab").className=`fab ${c===1?'red':'blue'}`;
  $("cancel-zone").hidden=!aiming;
  $("cancel-zone").textContent=cancelArmed ? t(state.phase.startsWith("MOVE") ? "Release to Cancel Move" : "Release to Cancel Fire") : t(state.committed ? "Relay Cancel" : "Cancel");
  $("opponent").hidden=!opponentVisible || aiming;
  $("opponent-toggle").textContent=t("Opponent");
  $("opponent-toggle").setAttribute("aria-label",t("Opponent"));
  $("opponent-close").setAttribute("aria-label",t("Close opponent"));
  $("menu").setAttribute("aria-label",t("Settings"));
  $("help").setAttribute("aria-label",t("Rules"));
  $("opponent-toggle").setAttribute("aria-expanded",String(opponentVisible));
  if(toastKey) $("toast").textContent=t(toastKey);
  drawStack();
  if(state.winner && overlayKind!=="result") result();
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
 panel("home",`<div class="team-shapes" aria-hidden="true"><span></span><span></span><span></span></div><p class="eyebrow">${t("Subtitle")}</p><h1 id="panel-title">${t("Title")}</h1><div class="row">${[10,14,18].map(n=>`<button data-panel="round-${n}" class="${n===selectedRounds?'selected':''}">${t({10:'Quick',14:'Standard',18:'Long'}[n])}<br>${n} ${t("Rounds")}</button>`).join('')}</div><button class="primary" data-panel="start">${t("Local PvP")}</button><div class="future-modes"><button data-panel="tutorial" disabled>${t("Tutorial")}<small>${t("Coming Soon")}</small></button><button data-panel="computer" disabled>${t("vs Computer")}<small>${t("Coming Soon")}</small></button></div><button class="settings-entry" data-panel="settings">${t("Settings")}</button><p class="version">v${VERSION}</p>`);
}
function start() {
  state = E.createGame(
    selectedRounds,
    profileFor(innerWidth, innerHeight, touch()),
  );
  viewOwner = 1;
  rotationStart = null;
  settlingUntil = null;
  rotation = 0;
  effects = [];
  transitions.clear();
  accumulator = 0;
  settingsOrigin="game"; menuLevel="root"; selection=null; cancelArmed=false;
  closePanel();
  fit();
  toast("Red starts");
}
function rules() {
  if(overlayKind!=="rules") rulesReturn=overlayKind || "game";
  panel("rules",`<h2 id="panel-title">${t("Rules")}</h2>${t("Rules text")}<div class="legend"><span><i></i>${t("Connected")}</span><span><i class="temporary"></i>${t("Disconnected")}</span><span><i class="protected"></i>${t("Outpost Zone")}</span><span><i class="pending"></i>${t("Contested")}</span></div><button class="primary" data-panel="close">${t("Understood")}</button>`);
}
function result() {
 const w=state.winner,c=E.counts(state),label=t({hp:'Knockout',territory:'Domination',score:'Territory Lead',overtime:'Overtime result'}[w.reason]);
 panel("result",`<p class="eyebrow">${t("Game Over")} · ${label}</p><h2 id="panel-title">${w.player ? teamName(w.player)+' '+t("Wins") : t("Draw")}</h2>${[1,2].map(o=>`<p style="color:${TEAM[o]}">${teamName(o)} · ${((100*c[o])/state.cells.length).toFixed(1)}% · ${state.players[o].hp} HP · ${state.towers.filter(t=>t.owner===o).length} ${t("Outposts")}</p>`).join('')}<button class="primary" data-panel="start">${t("Rematch")}</button><button class="settings-entry" data-panel="home">${t("Main Menu")}</button>`);
}
function end() {
  if(overlayKind || rotationStart!==null || settlingUntil!==null || state.phase.includes("FLYING")) return;
  if(state.phase.includes("AIM")) {
    const before=visualSnapshot();
    // End Turn explicitly settles a held projectile/move using the existing stop rules.
    // Cancel remains separate and never settles a committed relay.
    P.cancelAim(state); visualChanges(before);aim=null;pointer=null;cancelArmed=false;
  }
  if (!E.endTurn(state)) return;
  if (state.winner) {
    update();
    return;
  }
  panel(
    "handoff",
    `<p class="eyebrow">${t("Pass device")}</p><h2 id="panel-title" style="color:${TEAM[state.current]}">${teamName(state.current)}</h2><p>${t("Prepare")}</p><button class="primary" data-panel="ready">${t("Ready")}</button>`,
  );
}
function settleNewTurn(time) {
  const before=visualSnapshot();
  E.beginTurn(state);
  visualChanges(before,time);
  // Finish the longest explanatory wave before the new player can act.
  settlingUntil=Math.max(
    time+(reduced.matches ? 100 : 520),
    ...[...transitions.values()].map(t=>t.born+t.delay+t.duration),
    ...effects.map(e=>e.born+(e.type==='damage'?650:480)),
  );
  menuLevel=null;
  accumulator=0;
  update();
}
function ready() {
  // Keep HANDOFF authoritative throughout the camera transition.
  overlayKind=null; $("overlay").hidden=true; menuLevel=null;
  if(state.profile!=="desktop" && !reduced.matches) {
    rotationStart=performance.now();rotation=0;update();
  } else {viewOwner=state.current;settleNewTurn(performance.now());}
}
function doAction(action) {
 if(overlayKind || rotationStart!==null || settlingUntil!==null) return;
 const before=visualSnapshot(); selection=null; aim=null;pointer=null;
 if(action==='root' || action==='action') menuLevel=action;
 else if(action==='move' || action==='missile') {E.chooseAim(state,action==='move'?'move':'missile'); menuLevel=null;}
 else if(action==='tower') {
  if(towerReason()) {toast(E.towerReason(state).includes("脚下") ? 'Occupied':'Protected');return;}
  if(state.towers.filter(t=>t.owner===state.current).length===5) {selection='redeploy';menuLevel='redeploy';}
  else {E.buildTower(state);menuLevel='root';}
 } else if(action==='dismantle') {
  const towers=E.nearbyTowers(state);
  if(towers.length===1) {E.dismantle(state,towers[0].id);menuLevel='root';}
  else if(towers.length>1) {selection='dismantle';menuLevel='dismantle-select';}
 }
 visualChanges(before);tone();update();
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
$("fab").onclick=end;
$("cancel-zone").onclick=()=>{if(pointer===null) cancelCurrentAim();};
$("panel").addEventListener("click",event=>{
 const b=event.target.closest('[data-panel]'); if(!b || b.disabled) return;
 const action=b.dataset.panel;
 if(action==='start') start();
 else if(action==='home') home();
 else if(action==='settings') {settingsOrigin='home';menuPanel();}
 else if(action==='rules') rules();
 else if(action==='ready') ready();
 else if(action==='close') {
  if(overlayKind==='rules' && rulesReturn==='menu') menuPanel();
  else if(settingsOrigin==='home' || rulesReturn==='home' && overlayKind==='rules') home();
  else {menuLevel=savedMenu;selection=savedSelection;closePanel();}
 } else if(action.startsWith('round-')) {selectedRounds=Number(action.slice(6));home();}
 else if(action.startsWith('lang-')) {setLanguage(action==='lang-en'?'en':'zh-CN');menuPanel();}
 else if(action==='sound') {sound=!sound;try{localStorage.setItem('rd-sound',sound?'on':'off');}catch{}menuPanel();tone();}
 else if(action==='restart' || action==='main-menu') {
  const main=action==='main-menu';panel('confirm',`<h2 id="panel-title">${t(main?'Main Menu?':'Restart?')}</h2><p>${t('Clear match')}</p><button class="primary" data-panel="${main?'home':'start'}">${t(main?'Confirm menu':'Confirm restart')}</button><button class="settings-entry" data-panel="close">${t('Continue')}</button>`);
 }
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
 if(!overlayKind) {savedMenu=menuLevel || 'root';savedSelection=selection;}
 panel('menu',`<h2 id="panel-title">${t('Settings')}</h2><p>${t('Language')}</p><div class="row"><button data-panel="lang-zh" class="${getLanguage()==='zh-CN'?'selected':''}">简体中文</button><button data-panel="lang-en" class="${getLanguage()==='en'?'selected':''}">English</button></div><button class="primary" data-panel="close">${t(settingsOrigin==='home'?'Back':'Continue')}</button><div class="row"><button data-panel="rules">${t('Rules')}</button><button data-panel="sound">${t('Sound')} ${t(sound?'On':'Off')}</button></div>${settingsOrigin==='game'?`<div class="row"><button data-panel="restart">${t('Restart')}</button><button data-panel="main-menu">${t('Main Menu')}</button></div>`:''}<p class="version">v${VERSION}</p>`);
}
$("menu").onclick=()=>{settingsOrigin='game';menuPanel();};
function boardViewport() {
 const r=canvas.getBoundingClientRect(),toolbar=$("toolbar").getBoundingClientRect();
 return battlefieldViewport(state,r.width,r.height,toolbar.height || 64);
}
function worldPoint(event) {
  const r = canvas.getBoundingClientRect(),board=boardViewport();
  return fromView(
    {
      x: (event.clientX-r.left-board.x)/board.tile,
      y: (event.clientY-r.top-board.y)/board.tile,
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
  } else toast("Pull farther");
  aim = null;
  pointer = null;
  update();
}
canvas.addEventListener("pointerdown", (event) => {
  if (overlayKind || rotationStart !== null || settlingUntil !== null || event.button !== 0 || pointer !== null)
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
      const before=visualSnapshot();
      if(selection === "redeploy") E.buildTower(state,t.slot); else E.dismantle(state,t.id);
      menuLevel="root"; selection=null;
      visualChanges(before);update();
    }
    return;
  }
  if (!state.phase.includes("AIM")) return;
  if(event.clientX<4 || event.clientX>innerWidth-4 || event.clientY<4 || event.clientY>innerHeight-4) return;
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
  cancelArmed=inCancel(event);
  update();
});
canvas.addEventListener("pointerup", (event) => {
  if (pointer !== event.pointerId) return;
  const a = pointerAim(event);
  pointer = null;
  if (canvas.hasPointerCapture(event.pointerId))
    canvas.releasePointerCapture(event.pointerId);
  if(inCancel(event)) {cancelCurrentAim();return;}
  cancelArmed=false;
  if (!overlayKind && rotationStart === null && a && Math.hypot(event.clientX-dragStart.x,event.clientY-dragStart.y)>=10) fire(a);
  else {aim=null;update();}
});
for (const name of ["pointercancel", "lostpointercapture"])
  canvas.addEventListener(name, () => {
    pointer = null;
    aim = null;
    cancelArmed=false;
    update();
  });
document.addEventListener("keydown", (e) => {
  if(e.key === "Enter" && !overlayKind && !e.target.closest?.("button")) {end();return;}
  if (e.key !== "Escape") return;
  if(rotationStart!==null || settlingUntil!==null) return;
  if (overlayKind === "rules") {
    if (rulesReturn === "home") home();
    else if(rulesReturn === "menu") menuPanel();
    else closePanel();
  } else if (
    overlayKind &&
    !["home", "handoff", "result"].includes(overlayKind)
  ) {
    if(settingsOrigin === "home") home();
    else {menuLevel=savedMenu;selection=savedSelection;closePanel();}
  }
  else if (!overlayKind) {
    if (state.phase.includes("AIM")) {cancelCurrentAim();return;}
    menuLevel = "root";
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
      settleNewTurn(time);
    }
  }
  if(settlingUntil!==null && time>=settlingUntil) {settlingUntil=null;menuLevel="root";update();}
  if (!overlayKind && rotationStart === null && settlingUntil === null && !document.hidden) {
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
  effects = effects.filter((e) => time - e.born < (e.type === "damage" ? 650 : 480)).slice(-80);
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
    cancelArmed,
    viewport: boardViewport(),
    reduced: reduced.matches,
    contestedLabel: t("Contested"),
  });
  positionMenu();
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
