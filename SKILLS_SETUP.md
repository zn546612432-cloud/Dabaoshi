# Dabaoshi · Codex Skills 安装准备清单

> 2026-10-24 初筛。此文件是审核与安装计划，**不是已安装的 Skill**。当前不自动执行任何第三方脚本。
>
> 项目目标：手机优先的 HTML5「合成大宝石」游戏；先确定使用原生 Canvas 还是 Phaser，再选引擎技能。

## 推荐清单

来源：`gamedev-skills/awesome-gamedev-agent-skills`（第三方，Apache-2.0）
https://github.com/gamedev-skills/awesome-gamedev-agent-skills

| 方向 | Skill | 原始路径 | 用途 | 初筛 |
|---|---|---|---|---|
| 游戏开发 | `phaser-core` | `skills/web-engines/phaser-core` | Phaser 场景、资源加载、摄像机；仅在使用 Phaser 时启用 | SKILL.md 已检查 |
| 游戏美术 | `create-game-assets` | `skills/disciplines/create-game-assets` | 统一宝石、按钮、图标、粒子风格及素材验证 | SKILL.md 已检查；依赖脚本仍需逐项复核 |
| 动画反馈 | `game-feel` | `skills/disciplines/game-feel` | 合成弹跳、缓动、闪光、震动、粒子反馈 | SKILL.md 已检查 |
| 手机界面 | `game-ui-ux` | `skills/disciplines/game-ui-ux` | 安全区、适配、HUD、菜单与触控布局 | SKILL.md 已检查 |
| 优化 | `performance-optimization` | `skills/disciplines/performance-optimization` | 帧率测量、粒子对象池、资源预算 | SKILL.md 已检查 |
| 快速原型 | `prototype-fast` | `skills/workflows/prototype-fast` | 首先验证核心合成循环可玩性 | SKILL.md 已检查 |

这里“已检查”仅指初步阅读元信息、内容与明显高危执行模式，**不代表完整供应链安全审计**。

## 测试方案（暂不安装不安全 Skill）

推荐以 Playwright 的普通开发依赖、测试代码和 CI 进行：
- 合成两颗同级宝石后只生成一颗高一级宝石；
- 连锁合成、计分、游戏结束和重新开始；
- 390×844 等手机视口，触控拖放、横竖屏和不溢出；
- 资源加载失败、快速连点、暂停／恢复；
- 每次主要 UI 改动进行截图比对。

已查看 OpenAI 旧目录中的 `playwright-interactive`，其说明要求 `--sandbox danger-full-access`；不采用这条路径。
https://github.com/openai/skills/blob/main/skills/.curated/playwright-interactive/SKILL.md

## 官方补充

- OpenAI 新插件示例库： https://github.com/openai/plugins
- `build-web-apps` 插件：前端资源、浏览器测试与 UI 工作流；后续可通过受支持的插件界面独立安装。
- 旧 `openai/skills` 仓库 README 已明确标记 deprecated，不作为新项目的主要安装来源。

## 安装前检查与步骤

1. 确定技术栈：若采用原生 Canvas，先**不装** `phaser-core`；若采用 Phaser，再启用它。
2. 固定上游 commit SHA，避免每次从 `main` 下载未经审核的新版本。
3. 对每个所选 Skill 检查完整文件树、链接、脚本、依赖、许可证、可执行命令及是否读取敏感数据。
4. 仅将通过检查的 Skill 文件夹复制到本仓库 `.agents/skills/<name>/`，保留原作者与 Apache-2.0 许可证信息。
5. 不运行远程一键脚本、不自动执行 `curl | sh`、不关闭沙箱、不授予额外凭据；依赖安装需另行审查。
6. 从项目目录启动新 Codex 会话，确认可发现技能，再在隔离环境测试技能实际效果。
7. 优先安装 `game-feel`、`game-ui-ux`、`prototype-fast`，美术脚本与 Phaser 视技术栈决定。

## 当前状态

- [x] 确认 GitHub 账户与 `zn546612432-cloud/Dabaoshi` 仓库可访问
- [x] 搜索并初筛官方与第三方来源
- [x] 核查候选 SKILL.md 与主要安全风险
- [ ] 决定原生 Canvas / Phaser
- [ ] 固定版本并审核完整资源树
- [ ] 将 Skill 文件复制到 `.agents/skills/`
- [ ] 在 Codex 环境验证安装

> 这份计划本身不会修改游戏代码，也不会执行任何安装命令。
