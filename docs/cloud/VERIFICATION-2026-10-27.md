# 云端开发与发布验证 · 2026-10-27

## 已取得的证据

- 环境 Node v24.19.0、npm 11.9.0；现有 Vite 7.3.6。
- `npm test`：38 个测试文件通过，0 失败、0 跳过，139486ms。日志见 evidence/test.log；这是当前 Node runner 的文件级统计，不把历史 386 用例数冒充本次结果。
- `npm run check`、`npm run build`、`git fsck --full`、`git diff --check` 通过。
- 隔离目录 `npm ci --offline --cache /workspace/.npm-cache` 成功安装 24 个包。首次默认沙箱拦截 esbuild 子进程（EPERM），经受支持的执行权限重试成功。原项目依赖目录未被重装。
- 默认命令沙箱的 Git／curl 请求因无法连接 proxy:8080 失败；使用 `with_additional_permissions` 的 `network.enabled=true` 后，GitHub `ls-remote` 和 fetch 成功，npm registry 返回 HTTP 200。因此不能把最初错误归结为代理服务故障。后续网络命令必须请求受支持的网络权限，保留代理与 TLS 校验。
- GitHub main 仍为 c26c2047929bdf164ce96b8b0d3c87f504369d07。真实分支 `cloud-readiness-20261027` 已推送成功，文档基线提交 ae8c0cc；最终补记保存在该分支后续提交。
- Sites 源码经短期凭据和获准网络权限成功克隆，HEAD 为 95d603d186984938a5d8cdb9a3d93f386e916d18。当前 GitHub 工作区与该 Sites 基线的 src、package.json、锁文件、index.html、hosting.json 共 45 文件逐字节一致。
- 已将保存的第17版重新部署，部署 appgdep_6ae07bbbc5a081918c47fb1dd97757b3 返回 succeeded，线上 URL 为 https://ricochet-dominion.cianolu.chatgpt.site 。

## 本次交接与发布范围

本次新增 docs/cloud 文档及测试证据，保持游戏版本 v0.7.2。源码上传和新版本发布使用独立于 GitHub 的 Sites 源码历史。

完整链路已实测通过：Sites 新文档源码提交 `f345da3c69ca00f6467df3140528cc92e5eb53cf` 推送 main → 在该 checkout 运行生产构建 → 打包 manifest 与 dist → save_site_version 保存第18版 → deploy_site_version 成功。

- 第18版 ID：`appgprj_6ac110b4c20881918a5d97f4403b3f15~appgver_80edc2b3fbe081918554cbe5da80cdca`。
- 部署 ID：`appgdep_6ae07cf96ca48191a9c566944efa737f`，状态 `succeeded`。
- 成功时间：2026-10-27 18:29:27 北京时间。
- 归档：SHA256 `ad1076a89f2f53e53aadda49d561b242e3529de21ab489c867c618e2f0d3124e`，215040 bytes，5 文件。
- 线上地址：https://ricochet-dominion.cianolu.chatgpt.site 。

Sites 第18版包含发布前交接文本；本节发布后补记提交到 GitHub 文档分支，避免为记录发布结果而无限重复发布。两端运行代码不变，最终补记差异仅在文档。

前一聊天新增的 AGENTS.md、docs/cloud、备份包未出现在本次初始工作区。无法据此断言所有云端临时文件能跨聊天保留。本次交接文件应提交到远程源码，后续从远程或已保存版本恢复；未读取到的原始附件和账户记忆仍不声称已迁移。

## 验证限度

本次未做真实浏览器／iPhone／Android 触控、FPS、GPU 或音色测试。DOM 与录制 Canvas 回归不能替代真机验证。Sites 归档下载接口未能授权解析第17版归档，故源码一致性使用实际 Git 克隆比对，不声称下载核对旧归档成功。

环境状态接口未配置云服务凭据、VPN 或运行时密钥；这不妨碍使用 Sites 临时源码凭据和 GitHub 的受支持连接。不要打印或持久化凭据，也不要把默认沙箱请求失败作为移除代理的理由。
