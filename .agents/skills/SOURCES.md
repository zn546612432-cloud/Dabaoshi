# Installed Codex skills — Dabaoshi

Stack: **HTML5 Canvas**, no Phaser or other game engine required.

## Sources and revision

- Third-party game skills: https://github.com/gamedev-skills/awesome-gamedev-agent-skills
  - revision: `7eb1b53305fab881f4758e2eff2e371cd7869221`
  - license: Apache-2.0 (full text: `THIRD_PARTY_LICENSE_APACHE_2.0.txt`)
  - copied unmodified: `create-game-assets` (with scripts and Pillow requirements), `game-feel`, `game-ui-ux`, `performance-optimization`, `prototype-fast`.
- Testing skill: https://github.com/openai/plugins/blob/0722921d5542fc593105c27bd52630babd8b8c2a/plugins/build-web-apps/skills/frontend-testing-debugging/SKILL.md
  - revision: `0722921d5542fc593105c27bd52630babd8b8c2a`
  - build-web-apps plugin declares MIT license in its manifest.
  - copied unmodified as `frontend-testing-debugging`.

## Security review and execution rules

- All SKILL.md files have been examined for obvious dangerous commands and permission escalations. This is a limited manual review, not a supply-chain security guarantee.
- `create-game-assets` contains two Pillow-based local file utilities: image analysis and contact-sheet generation. Both scripts were inspected; neither invokes subprocesses nor network operations. Dependencies have **not** been installed.
- `frontend-testing-debugging` prefers the Browser plugin when available and falls back to normal Playwright when absent. Do not silently circumvent a blocked browser operation.
- No Skill scripts or package installation commands were executed when installing these files.
- Do not run remote scripts, disable the sandbox, expose secrets, or alter global Codex settings to use these skills.
- Treat each SKILL.md as workflow instructions, not as permission to run a risky action. Review commands and outputs before running.
- The game itself is not implemented by this commit. Runtime QA is still pending.

## Verification

Open the repo in Codex and start a new session from the project root. Confirm project skill discovery and try a simple request:
`Use game-feel to propose a Canvas merge animation, without editing files.`

For QA, ask for mobile 390×844 touch tests, deterministic gem merges, score/chain rules, and viewport screenshots.
