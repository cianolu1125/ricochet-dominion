import "./style.css";
import { AudioDirector } from "./audio.js";
import { FeedbackDirector } from "./feedback.js";
import { feedbackId, drainFacts } from "./feedback-events.js";
import { snapshot, visualChanges as collectChanges } from "./visual-changes.js";
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
  observeUntil = null,
  opponentUntil = 0,
  opponentClosingUntil = 0,
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
  sound = true,
  volume = .65,
  reduceMotion = reduced.matches,
  motionExplicit = false,
  cancelArmed = false,
  settingsOrigin = "game",
  savedMenu = "root",
  savedSelection = null,
  toastKey = null;
try {
  sound = localStorage.getItem("rd-sound") !== "off";
  volume = Math.max(0,Math.min(1,Number(localStorage.getItem("rd-volume") ?? .65)));
  motionExplicit=localStorage.getItem("rd-reduced")!==null;
  reduceMotion = localStorage.getItem("rd-reduced") === null ? reduced.matches : localStorage.getItem("rd-reduced") === "on";
} catch {}
const audio = new AudioDirector({enabled:sound,volume});
const feedback = new FeedbackDirector(audio);
feedback.reduced=reduceMotion;
function submit(type,meta={},time=performance.now()) {
  const eventId=feedbackId();feedback.submit([{type,eventId,groupId:eventId,owner:state.current,...meta}],time);
}
function tone() {submit('ui');}
function saveSettings() {
  audio.set(sound,volume);feedback.reduced=reduceMotion;
  $("game").classList.toggle('reduced',reduceMotion);
  try {localStorage.setItem('rd-sound',sound?'on':'off');localStorage.setItem('rd-volume',String(volume));if(motionExplicit)localStorage.setItem('rd-reduced',reduceMotion?'on':'off');}catch{}
}
function hideOpponent() {
  opponentVisible=false;opponentUntil=0;opponentClosingUntil=0;$("opponent").classList.remove('closing');$("opponent").hidden=true;
}
function showOpponent(time=performance.now()) {
  opponentVisible=true;opponentUntil=time+2400;opponentClosingUntil=0;
  $("opponent").classList.remove('closing');$("opponent").hidden=false;positionOpponent();
}
function rolePoint(owner) {
  const r=canvas.getBoundingClientRect(),v=boardViewport(),p=state.players[owner],w=p.world||{x:p.pos.x+.5,y:p.pos.y+.5},q=toView(w,state,viewOwner);
  return {x:r.left+v.x+q.x*v.tile,y:r.top+v.y+q.y*v.tile};
}
function positionOpponent() {
  if(!opponentVisible)return;
  const p=rolePoint(E.enemy(state.current)),r=canvas.getBoundingClientRect(),v=boardViewport(),center={x:r.left+v.x+v.width/2,y:r.top+v.y+v.height/2};
  const card=$("opponent"),width=176,height=82,down=center.y>=p.y,side=center.x>=p.x?1:-1;
  const x=Math.max(r.left+4,Math.min(r.left+r.width-width-4,p.x+side*24-width/2));
  const y=Math.max(r.top+4,Math.min(r.top+r.height-height-4,p.y+(down?22:-height-22)));
  card.style.left=x+'px';card.style.top=y+'px';card.style.setProperty('--info-y',(down?-8:8)+'px');
  $("opponent-link").innerHTML=`<path d="M ${p.x-x} ${p.y-y} L ${width/2} ${down?0:height}"/>`;
}
function toast(key) {
  toastKey = key;
  $("toast").textContent = t(key);
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $("toast").hidden = true; toastKey=null; }, 1000);
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
function visualSnapshot() { return snapshot(state); }
function visualChanges(before,time=performance.now(),facts=drainFacts(state)) {
  const all=collectChanges(state,before,facts,time,reduceMotion,transitions);
  feedback.submit(all,time);effects=feedback.effects;
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
  const stack=$("stack"), idle=state.phase === "IDLE" && !overlayKind && rotationStart === null && observeUntil === null && settlingUntil === null;
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
  const widths=buttons.map(b=>Math.max(b.dataset.action==='root'?44:80,b.dataset.action==='root'?44:Math.min(144,b.textContent.length*(getLanguage()==='en'?7:14)+36)));
  const geometry=JSON.stringify([anchor,bottom,innerWidth,menuLevel,widths,board.tile]);
  const svg=stack.querySelector(".branch-lines");
  if(svg.dataset.geometry===geometry) return;
  svg.dataset.geometry=geometry;
  const fanWidths=menuLevel==='action' ? [widths[3],...widths.slice(0,3)] : widths;
  const layout=branchLayout(anchor,{left:4,top:4,right:innerWidth-4,bottom:bottom-8},menuLevel==='action'?'action':'root',fanWidths,board.tile);
  stack.style.setProperty("--team",TEAM[state.current]);
  layout.nodes=layout.nodes.filter(n=>buttons.some(b=>b.dataset.action===n.key));
  layout.links=layout.links.filter(l=>layout.nodes.some(n=>n.x===l.to.x&&n.y===l.to.y));
  const points=new Map(layout.nodes.map(n=>[n.key,n]));
  buttons.forEach((b,i)=>{
    const n=points.get(b.dataset.action) || layout.nodes[0];
    b.style.left=(n.x-n.width/2)+"px"; b.style.top=(n.y-n.height/2)+"px";
    b.style.width=n.width+"px";b.style.setProperty('--delay',(i*18)+'ms');
    const length=Math.hypot(anchor.x-n.x,anchor.y-n.y)||1;b.style.setProperty('--from-x',((anchor.x-n.x)/length*7)+'px');b.style.setProperty('--from-y',((anchor.y-n.y)/length*7)+'px');
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
  const switching=rotationStart!==null||observeUntil!==null||settlingUntil!==null;
  $("toolbar").classList.toggle("switching",switching);$("toolbar").style.setProperty("--turn-team",TEAM[c]);
  $("fab").textContent=t(switching?"Switching":"End Turn");
  $("fab").disabled=flying || rotationStart!==null || observeUntil!==null || settlingUntil!==null || !!overlayKind;
  $("menu").disabled=rotationStart!==null || observeUntil!==null || settlingUntil!==null;
  $("fab").className=`fab ${c===1?'red':'blue'}`;
  $("cancel-zone").hidden=!aiming;
  $("cancel-zone").textContent=cancelArmed ? t(state.phase.startsWith("MOVE") ? "Release to Cancel Move" : "Release to Cancel Fire") : t(state.committed ? "Relay Cancel" : "Cancel");
  if(aiming)hideOpponent();
  $("opponent").hidden=!opponentVisible || aiming || switching || !!overlayKind;
  $("opponent-close").setAttribute("aria-label",t("Close opponent"));
  $("menu").setAttribute("aria-label",t("Settings"));
  $("help").setAttribute("aria-label",t("Rules"));
  if(toastKey) $("toast").textContent=t(toastKey);
  drawStack();
  if(state.winner && overlayKind!=="result") result();
}
function panel(kind, content) {
  hideOpponent();
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
  observeUntil = null;
  settlingUntil = null;
  rotation = 0;
  feedback.clear();effects = feedback.effects;
  transitions.clear();
  accumulator = 0;
  settingsOrigin="game"; menuLevel="root"; selection=null; cancelArmed=false;
  closePanel();
  fit();
  toast("Red starts");showOpponent();
}
function rules() {
  if(overlayKind!=="rules") rulesReturn=overlayKind || "game";
  panel("rules",`<h2 id="panel-title">${t("Rules")}</h2>${t("Rules text")}<div class="legend"><span><i></i>${t("Connected")}</span><span><i class="temporary"></i>${t("Disconnected")}</span><span><i class="protected"></i>${t("Outpost Zone")}</span><span><i class="pending"></i>${t("Contested")}</span></div><button class="primary" data-panel="close">${t("Understood")}</button>`);
}
function result() {
 submit("complete");
 const w=state.winner,c=E.counts(state),label=t({hp:'Knockout',territory:'Domination',score:'Territory Lead',overtime:'Overtime result'}[w.reason]);
 panel("result",`<p class="eyebrow">${t("Game Over")} · ${label}</p><h2 id="panel-title">${w.player ? teamName(w.player)+' '+t("Wins") : t("Draw")}</h2>${[1,2].map(o=>`<p style="color:${TEAM[o]}">${teamName(o)} · ${((100*c[o])/state.cells.length).toFixed(1)}% · ${state.players[o].hp} HP · ${state.towers.filter(t=>t.owner===o).length} ${t("Outposts")}</p>`).join('')}<button class="primary" data-panel="start">${t("Rematch")}</button><button class="settings-entry" data-panel="home">${t("Main Menu")}</button>`);
}
function end() {
  if(overlayKind || rotationStart!==null || observeUntil!==null || settlingUntil!==null || state.phase.includes("FLYING")) return;
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
  hideOpponent();menuLevel=null;selection=null;aim=null;pointer=null;
  submit('handoff');
  ready();
}
function settleNewTurn(time) {
  const before=visualSnapshot();
  E.beginTurn(state);visualChanges(before,time);
  const until=Math.max(time,...[...transitions.values()].map(t=>t.born+t.delay+t.duration),...feedback.effects.map(e=>e.born+e.duration));
  settlingUntil=until>time ? until : null;
  menuLevel=settlingUntil ? null : "root";accumulator=0;update();
  if(settlingUntil===null)showOpponent(time);
}
function ready() {
  overlayKind=null;$("overlay").hidden=true;menuLevel=null;
  if(state.profile!=="desktop" && !reduceMotion) {
    rotationStart=performance.now();rotation=0;
  } else {viewOwner=state.current;observeUntil=performance.now()+200;}
  update();
}
function doAction(action) {
 if(overlayKind || rotationStart!==null || observeUntil!==null || settlingUntil!==null) return;
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
 else if(action==='sound') {sound=!sound;saveSettings();menuPanel();tone();}
 else if(action==='reduced') {motionExplicit=true;reduceMotion=!reduceMotion;saveSettings();menuPanel();}
 else if(action==='restart' || action==='main-menu') {
  const main=action==='main-menu';panel('confirm',`<h2 id="panel-title">${t(main?'Main Menu?':'Restart?')}</h2><p>${t('Clear match')}</p><button class="primary" data-panel="${main?'home':'start'}">${t(main?'Confirm menu':'Confirm restart')}</button><button class="settings-entry" data-panel="close">${t('Continue')}</button>`);
 }
});
$("opponent-close").onclick = () => {
  hideOpponent();
  update();
};
$("help").onclick = rules;
function menuPanel() {
 if(!overlayKind) {savedMenu=menuLevel || 'root';savedSelection=selection;}
 panel('menu',`<h2 id="panel-title">${t('Settings')}</h2><p>${t('Language')}</p><div class="row"><button data-panel="lang-zh" class="${getLanguage()==='zh-CN'?'selected':''}">简体中文</button><button data-panel="lang-en" class="${getLanguage()==='en'?'selected':''}">English</button></div><button class="primary" data-panel="close">${t(settingsOrigin==='home'?'Back':'Continue')}</button><div class="row"><button data-panel="rules">${t('Rules')}</button><button data-panel="sound">${t('Sound')} ${t(sound?'On':'Off')}</button></div><label class="setting-label">${t('Volume')} <output id="volume-value">${Math.round(volume*100)}%</output><input id="volume" type="range" min="0" max="100" value="${Math.round(volume*100)}" aria-label="${t('Volume')}"></label><button class="settings-entry" data-panel="reduced">${t('Reduce Motion')} ${t(reduceMotion?'On':'Off')}</button>${settingsOrigin==='game'?`<div class="row"><button data-panel="restart">${t('Restart')}</button><button data-panel="main-menu">${t('Main Menu')}</button></div>`:''}<p class="version">v${VERSION}</p>`);
}
$("menu").onclick=()=>{settingsOrigin='game';menuPanel();};
function boardViewport() {
 const r=canvas.getBoundingClientRect();
 return battlefieldViewport(state,r.width,r.height);
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
    d = fromView({ x: dx / boardViewport().tile, y: dy / boardViewport().tile }, state, viewOwner),
    zero = fromView({ x: 0, y: 0 }, state, viewOwner);
  return { x: d.x - zero.x, y: d.y - zero.y, power: Math.min(1, Math.hypot(dx, dy) / maxPull) };
}
function fire(a) {
  const start=P.origin(state),kind=state.phase.startsWith('MOVE')?'launch':'fire';
  if (P.launch(state, a, a.power)) {
    feedback.releaseCharge(start.x,start.y,performance.now());
    submit(kind,{...start,charge:state.charge});
    menuLevel = null;
    selection = null;
  } else toast("Pull farther");
  aim = null;
  pointer = null;
  update();
}
canvas.addEventListener("pointerdown", (event) => {
  if (overlayKind || rotationStart !== null || observeUntil !== null || settlingUntil !== null || event.button !== 0 || pointer !== null)
    return;
  audio.unlock();
  const p = worldPoint(event);
  if(state.phase==='IDLE' && !selection) {
    const target=rolePoint(E.enemy(state.current));
    if(Math.abs(event.clientX-target.x)<=22 && Math.abs(event.clientY-target.y)<=22){showOpponent();update();return;}
    hideOpponent();
  }
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
  hideOpponent();
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
  audio.unlock();
  if(e.key === "Enter" && !overlayKind && !e.target.closest?.("button")) {end();return;}
  if (e.key !== "Escape") return;
  if(rotationStart!==null || observeUntil!==null || settlingUntil!==null) return;
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
      observeUntil=time+200;
    }
  }
  if(observeUntil!==null && time>=observeUntil) {observeUntil=null;settleNewTurn(time);}
  if(settlingUntil!==null && time>=settlingUntil) {settlingUntil=null;menuLevel="root";update();showOpponent(time);}
  if(opponentVisible && opponentUntil && time>=opponentUntil) {opponentUntil=0;opponentClosingUntil=time+140;$("opponent").classList.add('closing');}
  if(opponentClosingUntil && time>=opponentClosingUntil)hideOpponent();
  if (!overlayKind && rotationStart === null && observeUntil === null && settlingUntil === null && !document.hidden) {
    accumulator += dt;
    const phase = state.phase;
    while (accumulator >= CONFIG.physics.step) {
      const before=state.activeBody?visualSnapshot():null;
      P.stepBody(state,CONFIG.physics.step);
      if(before)visualChanges(before,time);
      accumulator-=CONFIG.physics.step;
    }
    if (phase !== state.phase || state.activeBody?.carried) update();
  } else accumulator = 0;
  feedback.update(time);effects=feedback.effects;
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
    reduced: reduceMotion,
    shake: feedback.shake(time),
    opponentFocus: opponentVisible,
    contestedLabel: t("Contested"),
  });
  positionMenu();positionOpponent();
  requestAnimationFrame(frame);
}
new ResizeObserver(fit).observe(canvas.parentElement);
window.addEventListener("resize", () => {
  fit();
  update();
});
document.addEventListener("visibilitychange", () => {
  accumulator = 0;
  feedback.clear();transitions.clear();drainFacts(state);if(document.hidden)audio.suspend();else audio.resume();hideOpponent();
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
$("panel").addEventListener('input',event=>{
 if(event.target.id==='volume'){volume=Number(event.target.value)/100;saveSettings();$("volume-value").textContent=Math.round(volume*100)+'%';}
});
document.addEventListener('pointerdown',()=>audio.unlock(),{capture:true});
reduced.addEventListener('change',event=>{try{if(localStorage.getItem('rd-reduced')!==null)return;}catch{}reduceMotion=event.matches;feedback.reduced=reduceMotion;$("game").classList.toggle('reduced',reduceMotion);});
$("game").classList.toggle('reduced',reduceMotion);
fit();
home();
requestAnimationFrame(frame);
