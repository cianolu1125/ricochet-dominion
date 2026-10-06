# 弹射战线 · RICOCHET FRONT

**v0.7.0** · 本地双人 PvP ＋ 简单／普通／困难 PvE。手机本地双人热座旋转；人机固定玩家红方视角；桌面固定视角。权威开发规格：[v0.6.2 完整更新规格](docs/v0.6.2-spec.txt)。历史版本规则见 CHANGELOG。

## 人机对战

主菜单选择「人机对战」→ 难度 → 开始。玩家红方先行，电脑蓝方。快速／标准／长局与原版共用规则；重开和再来一局保留模式、难度及局长，生成新种子。

- 简单：基础局面评价、小束搜索、明显操作误差。
- 普通：完整局面特征、动态战略、中继搜索、移动／行动顺序比较。
- 困难：更宽搜索、局部方向／力度优化、独立误差采样及选择性对手回应；保留真实非零操作误差。
- 电脑每次真实落地或中继后重新规划。搜索只在独立 Web Worker 复制局面上运行；主线程通过原规则／物理引擎执行，所有飞行、携带、蓄能和攻城动画正常播放。
- 电脑回合关闭玩家行动输入，可观看战场并打开设置。设置／后台暂停新的操作，返回后完整重播 260ms 实际方向提示；重开／返回主菜单清理旧 Worker 和待执行动作。
- `engine.js`、`physics.js`、`outposts.js`、`claims.js`、`charge.js` 未作规则改动。设计边界见 [PvE 规格](docs/v0.7.0-spec.md)，验证见 [执行记录](docs/v0.7.0-progress.md)。

验收记录见 [V0.7.0 验收矩阵](docs/v0.7.0-acceptance.md)。难度校准使用相同种子、双方换边、统一普通档操作误差和完整搜索预算，覆盖快速／标准／长局；原始数据与样本范围见执行记录。有限样本不代表所有局面下的难度优劣。

开发工具：`npm run ai:lab -- easy normal 3 --equal-error --paired --lengths`；`npm run ai:lab -- normal hard 3 --equal-error --paired --lengths`。每个种子双方换边，三个局长采用完整难度预算，真实执行误差与搜索流独立。仅供开发，不增加玩家 AI vs AI 模式。

## 当前玩法

- 每回合「移动」「行动」各一次，顺序自由。行动为飞弹、建立／重新部署据点或摧毁据点。五据点上限包含出生据点。
- 在战场任意位置向后拖拽、松手弹射。真实撞到己方据点实体才捕获、重新瞄准发射；出生据点参与中继，源据点发射不计中继。先锋与飞弹的中继记录独立。同一飞弹每个据点 ID 只捕获一次，之后反弹。
- 飞弹捕获不同据点 1／3／5 次达到 Charge Ⅰ／Ⅱ／Ⅲ。基础与全部等级均可携带先锋。基础落点 3×3；Ⅰ 扩张 5×5；Ⅱ 切割 3×3＋整行整列；Ⅱ十字遇保护格中断该方向；Ⅲ贯穿攻城为完整 5×5＋整行整列，无视保护强制染色并清除所有敌方 Influence Claim，范围敌塔全部拆除，敌先锋额外 −1 HP。独立携带／落点伤害仍可叠加。
- 快速／标准／长局固定 10／14／18 轮，双方初始和最大 HP 等于轮数；移除自定义模式。直接碰撞和携带进入敌方稳定／保护领土才 −1；临时／中立／己色安全。连续有效伤害区域不重复。最终携带爆炸先落地、染色，完成地图更新再按最终脚下稳定／保护资格判伤一次；如果最终判伤致命，已经提交的爆炸染色保留。途中致命伤仍立即结束。
- 己塔捕获时仍沿实际入射线释放并判断进入敌方稳定／保护领土；攻城先确定合法释放位置，再移除敌塔、完成染色并判伤。成功建立／重新部署据点恢复 1 HP，保持原行动成本，上限为模式最大 HP；失败／取消／满血／死亡不产生回血提示。直接命中共享据点格的先锋先处理先锋碰撞，存活才继续攻城。
- 己色四连通至己塔为稳定领地；断联颜色为临时领地。面积包括两者。敌方临时区域内建塔启动争夺，对手有一完整回合抢救。新接入临时格立即纳入争夺，建塔方下一回合开始按当时整个临时连通块结算；分裂继承原截止时间，恢复稳定部分退出，所有来源消失则取消。
- 新生据点按己方回合开始成长 1×1→3×3→5×5。先结算争夺再成长。成长仅染色未受保护格；同色多据点保护区取并集，拆掉一个后仍被其他据点覆盖的格继续受保护。重新部署移除旧塔、保留旧颜色，新塔从 1×1 起步。
- 取消中继瞄准保留已提交链；主动结束回合在捕获点按当前等级结算。完整轮末达到 60% 获胜；10／14／18 轮后依次比较面积、HP、塔数，同分直接平局。

- 飞弹中继会让无其他有效友塔中心保护的塔进入 Overload：实体与等级保留，暂停稳定连接、保护和中继资格。对手获得完整一 Turn 利用窗口，原主下一 Turn 开始恢复；先锋移动中继不触发过载。
- 在成熟（3×3／5×5）过载敌塔范围内的合法无敌方保护格，可接管；占用行动并立即结束 Turn。塔在一 Turn 内保持原主归属、进入 Contested；原主可进入范围收复，收复也结束 Turn。Contested 不成长／保护／中继，不能重部署撤除。
- 满五塔接管先选一座正常己塔撤除，预览／取消不改规则；全条件校验后原子提交。到发起方下一 Turn 开始完成接管，保留等级，跳过本次成长，执行一次成熟范围合法染色；再从染色后的当前敌色四连通断联块建立 Pending，延迟至再下一己方 Turn 结算。接管与收复不回血。

## 界面与反馈

点击移动或飞弹模式后立即亮起己方可用据点不闭合轨道弧；成功中继后显示过载断环或友塔保护脉冲。移动与飞弹记录独立，仅本连续行动有效，退出模式后隐藏。

顶部五节点进度轨表示当前飞弹已获得的中继历史，实际中继读数始终 R/5；据点过载或进入争夺不撤销历史点亮，飞弹结束后保留至淡出。1／3／5 为菱形，2／4 为圆形；无框技能名随进度轨淡入淡出。每次回合切换完成、点击或获得进度，200ms 显现、2500ms 清晰保持、800ms 淡出；重触发平滑续接。轨道与战场共享拖拽输入。先锋旁使用单列等宽行动按钮、单根连接线及 44px 返回节点。

保留简洁深色科技风，逐格开放内角与中心光膜、共享低频保护扫描、明确失稳渐变阴影、入侵方流动细边界。真实反弹各有短火花和音效；伤害 20ms、攻城 40ms 打击停顿，不叠加、不补算物理时间。因果同组只播放一次主声音／主抖动，独立真实事件保留。Web Audio 使用短柔和合成音、压缩、最多 8 个活跃音效；后台与退出清理，恢复／中断／关闭音频上下文独立处理。音量、音效和减少动效偏好独立持久化。

## 开发与验证

Node 20.19+ 或 22.12+。`npm ci`、`npm run dev`。检查：`npm test`、`npm run check`、`npm run build`；静态产物 `dist/`。

- `engine.js`：领地、成长、保护并集、回合结算；`outposts.js`：过载、接管、收复、容量事务；`claims.js`：动态争夺成员；`charge.js`：等级与染色目标。
- `physics.js`：连续碰撞、中继、逐格携带判伤和释放；`view.js`：四种固定地图配置及可逆视角。
- `main.js`：输入、菜单、对局生命周期；`relay-hud.js`：只读取规则状态的进度展示。
- `renderer.js`／`effects.js`／`visual-changes.js`：Canvas 与真实规则结果动效；`feedback.js`／`audio.js`：因果反馈和音频生命周期。

自动测试覆盖四种配置整局、五种视口 DOM 操作、动态争夺增补／分裂／抢救、保护重叠、所有等级真实落点、致命中止、中继菜单与键盘、低帧率停顿恢复、音频资源上限，以及三种固定模式的受控压力局。v0.6.0 另测动态 HP、过载免疫和恢复、终止型接管／收复、五塔原子替换、成熟范围激活、当前连通块争夺及静态视觉结构。原生 Canvas 检查覆盖 Stable／Unstable／Protected／Pending 和 Normal／Overload／Contested 与减少动效。V0.7.0 完整自动套件 355 项通过，包括真实 Worker 桥接的三种局长整局、结果与再来一局；另外完成 18 场布局／难度／局长流程矩阵。真实 Chrome 已核对电脑飞行、建设、输入锁定和回合交还；iOS／Android 真机触控、帧率与音色仍未验证。

## 发布

- [在线游戏](https://ricochet-dominion.cianolu.chatgpt.site)
- [GitHub](https://github.com/cianolu1125/ricochet-dominion)：公开仓库、`main`。
- Sites 与 GitHub 同版源码，分别保留各自提交历史。GitHub 提交不会自动发布 Sites。
- [v0.6.0 执行记录](docs/v0.6.0-progress.md)。


v0.6.1: authoritative per-outpost influence masks; overload erosion, temporary restoration, deferred growth and mature frontier recovery. Flux A pure-color static tiles, quiet inner protection frames, dark drawn unstable cues, slow relay/contested/overload rings and accurate irregular region outlines. See [execution record](docs/v0.6.1-progress.md).


v0.6.2: independent breakthrough mask, atomic force-paint/influence removal/multi-outpost demolition and fixed range damage. Presentation follows the missile, leads toward impact, locks, detonates, pulls to a full-board purge wave, then gives a distinct damage wave. Input/result gating, reduced motion, resize and interruption cleanup are covered by regression tests. See [execution record](docs/v0.6.2-progress.md).
