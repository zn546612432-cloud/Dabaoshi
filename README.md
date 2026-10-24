# 万圣宝石夜 · Dabaoshi

无需安装依赖。用浏览器打开 `index.html` 即可游玩。

- 玩家控制狼人高家声：鼠标移动或手指拖动瞄准，点击或松开投放；键盘 ← / → 瞄准，空格投放。
- 吸血鬼 Jimmy 在较宽的范围内自动飞行并寻找落点；两名角色相碰会弹开并闪出火花。第一关双方都可能投放 1–6 级宝石，后续关卡投放更频繁，等级范围也逐渐扩大。
- 11 级透明万圣节宝石依次是糖果、南瓜、幽灵、蝙蝠、女巫月亮、魔药、血月、夜星、南瓜王、女巫王冠与幻影王冠。同级碰撞合成并计分。
- 宝石跟随角色手部动作，并从当时的手部位置沿弧线飞出；落入坩埚后受重力、倾斜内壁与弧形盆底约束。
- 1 级合成 2 级得 10 分，2 级合成 3 级得 20 分，之后每级翻倍。第一关需要累计 5,000 分；进度满后坩埚与锅内宝石轻晃、宝石消除，再进入更难的下一关。
- 坩埚的虚线标出满载高度，快满时会亮起并播放柔和的双拍心跳声。宝石碰到锅底或其他宝石后，轮廓一旦越过虚线就立即结束。点击右上角重开；最高分保存在浏览器中。

画面使用独立背景、无圈口的坩埚内胆与透明开口的前沿图片。两个角色各有 8 帧空手透明动画，手边的宝石由游戏实时绘制；宝石碰撞多边形从对应素材的透明轮廓生成。全部玩法运行在原生 Canvas 中。浏览器会在首次触摸或点击后播放环境音，右上角音符可静音。投掷和落地保持安静，合成与清关使用录制音效。

音频素材均为 CC0：[循环鬼屋环境音](https://opengameart.org/content/dark-cavern-ambient)（Paul Wortmann）、[短促合成音](https://opengameart.org/content/pop-effect-sounds)（trezegames）、[清关音效](https://opengameart.org/content/magic-spell-sfx)（JaggedStone）、[柔和心跳](https://opengameart.org/content/heartbeat-sounds)（bart）。

精灵图处理使用仓库内的 [sprite-pipeline 技能](.agents/skills/sprite-pipeline/SKILL.md)（来源：[openai/plugins](https://github.com/openai/plugins)），并用 `tools/extract_sprite_components.py` 按透明连通区域提取完整角色，避免固定网格裁掉耳朵、翅膀或手臂。运行 `node smoke.cjs` 可验证投放、合成、计分、AI 和重开。
