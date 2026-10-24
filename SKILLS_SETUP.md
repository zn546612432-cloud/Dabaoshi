# Dabaoshi · 项目级 Codex Skills

技术栈：**HTML5 Canvas**（不使用 Phaser）。安装时间：2026-10-24。

## 已复制到项目

| 技能 | 路径 | 用途 |
|---|---|---|
| create-game-assets | `.agents/skills/create-game-assets/` | 宝石、UI、精灵图的素材规划与验证 |
| game-feel | `.agents/skills/game-feel/` | 合成回弹、缓动、粒子、音画反馈 |
| game-ui-ux | `.agents/skills/game-ui-ux/` | 手机触控、适配、HUD |
| performance-optimization | `.agents/skills/performance-optimization/` | 帧率、资源和内存优化 |
| prototype-fast | `.agents/skills/prototype-fast/` | 验证核心玩法原型 |
| frontend-testing-debugging | `.agents/skills/frontend-testing-debugging/` | 交互、控制台、移动端视觉 QA |

所有文件保存在项目中，不修改全局 Codex 设置。**文件已安装到 GitHub 仓库，但尚未在 Codex 运行环境做技能发现与运行测试。**

## 安全与来源

查看 [来源、固定版本、审查与限制](.agents/skills/SOURCES.md)。

- 游戏技能来源：`gamedev-skills/awesome-gamedev-agent-skills`，固定在 `7eb1b53305fab881f4758e2eff2e371cd7869221`，Apache-2.0。
- 测试技能来源：`openai/plugins`，固定在 `0722921d5542fc593105c27bd52630babd8b8c2a`，其插件清单声明 MIT。
- 已检查两个 Python 美术脚本，未执行；Pillow 尚未安装。
- 未安装旧版需要 `--sandbox danger-full-access` 的 Playwright Interactive Skill。
- 未运行网络脚本、未关闭沙箱、未访问密钥或改动游戏代码。

## 下一步

1. 在 Codex 打开 `Dabaoshi` 仓库，开启新会话以重新发现项目 Skills。
2. 先用 `game-feel` 设计一个纯 Canvas 的宝石合成弹跳动画，再实现核心玩法。
3. 引入自动化测试前按需确认 Playwright 与浏览器运行环境，测试触控、画面、计分、合成规则。
4. 对第三方依赖和具体执行命令仍应逐项确认，初筛不代表绝对安全。
