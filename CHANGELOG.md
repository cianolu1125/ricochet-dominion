# v0.7.0 — 2026-10-07

- Added offline VS Computer with Easy / Normal / Hard; shared V0.6.2 rules, physics, actions, HP and match lengths. Local PvP is preserved.
- Hard closing evaluation follows actual area, HP and outpost-count score order; nonfatal HP advantages cannot outweigh territory. Direct kill and 60% terminal victories keep highest priority.
- Isolated Worker search, seeded decision variation and independent nonzero execution aim/power error. Real launch outcomes and relay captures trigger dynamic replanning.
- Semantic targets, wall reflections, bounded relay beam search, move/action order evaluation, dynamic strategy and normalized infrastructure/territory/safety/pending scoring. Hard adds local refinement, whole-chain robustness and selective opponent replies with comparable per-plan budgets.
- Human Red fixed PvE view, lightweight computer status and input lock, actual-direction cue, settings/background pause, full cue on resume, fresh rematch seed and generation/request/state guards.
- Shared engine execution retains all build/redeploy/dismantle/takeover/reclaim, carry, overload/shielding and ultimate feedback.
- Added RNG/distribution, simulator, strategy/search, controller, real Worker, UI, tactical chain and full-match tests, plus paired-seed headless balance lab and complete control/connection invariants.
- Completed own-turn uncertainty paths and full opponent relay response search, disabled stopped AI sessions, valued contested ownership prospects, and replaced blanket mature-tower bonuses with bounded unused growth capacity.

# v0.6.2 — 2026-10-06

- Charge III uses an independent 5×5 + full-row + full-column mask. All enemy influence claims in range are removed, protected cells force-painted, all enemy outpost centers demolished and the enemy vanguard hit once for −1 HP. Independent damage sources still stack.
- Surviving outposts retain structure stage and recover lost control through normal growth; recomputation never refills damage. Charge II keeps its protected-stop behavior.
- Added chase/lead/lock camera, short compression hold, primary detonation, spatial purge and tower fragments, separate damage wave, bounded Canvas effects and grouped Web Audio.
- Hold input and victory overlays through the cinematic, restore exact viewport, and clean up on interruption. Reduce Motion preserves all rules.
- Updated bilingual in-game rules, authoritative specification and behavioral regression tests.

## v0.6.1 · 2026-10-06

- Separate structural stage from per-cell actual influence. Overloaded outposts retain a residual mask; enemy stable/protected conquest persistently erodes it.
- Restore retained enemy temporary cells immediately; preserve enemy stable/protected losses. Restore and takeover activation skip same-settlement growth.
- Mature outposts recover one frozen four-neighbor frontier per owner turn inside 5×5, respecting enemy protection. Empty masks seed only the unprotected center before expanding.
- Flux A: static pure-color Stable/Protected/Unstable tiles; inset protection lines and near-black drawn unstable corners; no perpetual tile gradients/scanning.
- Actual concave residual contours, unified red/blue contested region lines, borderless upright labels, slow opposite relay/contested arcs and overload broken rings. Reduced motion freezes persistent motion.
- Structural and mature frontier growth share a 100ms actual-cell outline preview and grouped wave feedback. Preserve existing hit stop, sound/particle caps, physics and HP rules.

## v0.6.0 · 2026-10-05

- Quick／Standard／Long 固定 10／14／18 Round 与等值 HP；移除 Custom。
- 飞弹中继 Overload B：暂停保护、稳定根与中继，友塔中心保护可免疫；对手完整一 Turn 利用，原主下回合恢复。
- 成熟据点 Take Over／Contested／Reclaim；接管和收复均占用行动并结束 Turn。满塔正常己塔原子替换，Contested 不可拆。保留五塔上限、等级、无额外回血。
- 回合开始统一接管到期、局部激活染色、动态 Pending、过载恢复和成长；接管当 Turn 跳过成长，剩余当前敌色失稳连通块延迟争夺。
- 保护开放内角／光膜／共享扫描、Unstable 漂移阴影、Pending 细边界流、中继不闭合轨道、Overload 断环、Contested 双方弧；统一关键动效与合成音，减少动效保持形状辨识。
- 保留 60% 整 Round 胜利、Unstable 面积与伤害豁免、Protected 十字阻断、同塔单飞弹一次中继、部署回血及既有物理。

## v0.5.2 · 2026-10-05

- 领土胜利阈值改为 60%，保持整 Round 结束检查。
- Temporary 保留所有权、面积和争夺规则，统一取消所有 Territory HP 伤害资格；Stable / Protected 继续判伤。
- 点击移动／飞弹即显示可用据点能量细环；本链使用后显示淡断环，状态与碰撞资格共用规则入口。
- 保留部署 +1 HP、物理、Charge、音效和顶部进度轨。186 项回归测试通过。

# v0.5.1 — 2026-10-05

- Enemy-color-only territory damage at impact, carried entry and relay release; neutral/friendly tiles are safe regardless of stability or protection.
- Carried explosion/siege commits landing and paint before one final HP check. Fatal final damage preserves completed paint; earlier fatal hits still stop immediately.
- Successful new/redeployed outposts restore 1 HP, capped at 10, once per action. Green +1 HP (900ms) and role highlight (500ms); no recovery sound/shake, no false full-HP prompt.
- All protected tiles stop each crosscut ray independently. Beam endpoints match blocking edges; square blast rules remain unchanged.
- Independent corner lock frames per protected tile replace merged area outlines.
- Turn/click/progress wakes the relay HUD: 200ms enter, 2500ms hold, 800ms fade. Completed relay results remain through their display envelope; triggers restart smoothly.
- 175 automated rule, UI, full-match, audio and stress checks, syntax validation, production build and native Canvas inspections. Real-device performance/audio and live browser QA remain unverified.

# v0.5.0 — 2026-10-04

- Confirmed 1/3/5 real tower-capture thresholds, base carry, graded area/cross paint and direct-hit-only siege.
- Dynamic contested components include new connections immediately, preserve deadlines across splits/merges and cancel rescued or source-less claims.
- Geometry-derived same-color protection unions, claim-before-growth settlement and fatal prepaint release abort.
- Actual-capacity frameless relay HUD, localized skills, shared gestures, single-column tactical menu and Custom 1–100 round limits with direct draws.
- Cross propagation and shield pass-through, bounded 20/40ms Hit Stop with no thaw catch-up, causal sound/shake grouping and eight-voice audio limit.
- Repair result-to-menu loop, stale match effects/audio, interrupted/closed audio recovery and preference independence.
- Review corrections: prevent HUD Enter from ending turns; discard frozen wall-clock overlap; retain valid Custom input on invalid edit; smooth repeated HUD activation.
- 122 tests, all-source syntax checks, production build and native Canvas render inspection. Real-device audio/performance/live browser QA remains unverified.

# v0.4.0 — 2026-10-04

- Separate HUD/battlefield layout, short anchored branch menu, enemy role info card and direct End Turn.
- Explicit rotation → 200ms pause → rule settlement → presentation → input sequence.
- Causal feedback director preserves independent real bounces and damage, merges simultaneous impact layers and clamps camera shake.
- Single-context synthetic WebAudio, compressor/soft limiter, priority ducking, persistent SFX/volume/reduced-motion settings.
- Three progressive capture charges, sparks, rings, short trails, independent HP numbers, tower fragments, retrieval/deployment and siege.
- Landing-color tile waves, growth, signal loss/recovery and normalized territory conversion; no rule changes or outpost takeover.
- Rule/UI regressions, feedback/visual behavior and real Canvas rendering verified; live browser/device QA unavailable.

## v0.3.1-ui-refinement

- Replace floating menu panel with vanguard-anchored branching nodes and adaptive inward fans.
- Maximize board camera with a four-pixel rim; keep the HUD as a canvas overlay.
- Defer turn-start settlement until hot-seat rotation finishes, then lock input through explanatory effects.
- Unify home, settings, HUD and aiming cancellation with the battlefield technology theme.
- Preserve engine and physics rules; add edge-layout and settlement-order regression coverage.

# v0.3.0-ui-theme · 2026-10-04

UI / 主题更新，未改 v0.2.x 规则与数值，engine.js / physics.js 无改动。

- 先锋旁自动移动／行动菜单，直接建立／单目标摧毁，边缘自动定位。
- 全战场相对拖拽；取消区点击返回与拖入松手取消；中继取消保留已提交状态。
- 全屏 Canvas、镜头输入坐标统一、紧凑底部 HUD、对手浮窗、永久结束回合。
- 弹射战线 / RICOCHET FRONT、先锋／据点／断联区／争夺中／蓄能主题，完整中英切换与持久化。
- 独立 −1 HP 抛物线、原地受击、格子波、成长／摧毁／中继效果与减少动效。
- Tutorial / vs Computer 禁用 Coming Soon。
- 修复中继结束回合、首页 Esc、设置返回据点选择状态。
- 65 项测试、语法检查、生产构建通过；真机／真实浏览器布局 QA 未运行。

# v0.2.1-drag-ui

- 常驻状态与操作移入战场外底部小菜单栏，战场四周保留安全间距。
- 对手血量浮窗默认关闭，可通过「对手」切换，也可单独关闭。
- 删除角度/力度精确瞄准；四种发射统一在战场任意处开始相对拖拽。
- 只保留短方向/力度箭头；碰撞点超出箭头长度时不显示。
- 保持 v0.2.0 规则、回合自由顺序与触屏热座旋转。

# Changelog

## v0.2.0-territory-network · 2026-10-04

- 将回合改为移动／行动各一次且顺序自由，飞弹减少为一发；HP 升至 10。
- 新增四连通稳定／临时领地、补给断粮、入侵塔延迟吞并快照与抢救窗口。
- 每方五塔，出生塔计入上限；成长、保护重叠、拆塔、重部署均立即重算连通。
- 角色弹射与独立塔中继；飞弹每塔每回合仅一次中继。
- Charge I 携带、II 5×5 爆炸、III 攻城；碰撞瞬间脚下颜色判伤、携带跨色多段伤害及沿入射路径合法释放。
- 删除重生、保护、近战、皇后移动、固定顺序、三发飞弹和撤销。
- 全屏等比战场、浮动 HUD、右下分层操作、地图选塔、safe-area、手机／平板热座和桌面固定视角。
- 以新版规则替换旧测试，加入整局、相机和多视口交互回归测试。

## v0.1.0-prototype · 2026-10-03

首次发布：本地双人 PvP、三发飞弹、皇后移动、塔成长、手机热座和桌面横向战场。
