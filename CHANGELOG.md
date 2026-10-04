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
