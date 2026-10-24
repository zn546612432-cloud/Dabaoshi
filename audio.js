(() => {
  "use strict";
  let started = false, warning = false, enabled = true, lastMerge = 0;
  try { enabled = localStorage.getItem("dabaoshi-sound") !== "off"; } catch {}
  const ambience = new Audio("assets/audio/haunted-ambience.ogg");
  const heartbeat = new Audio("assets/audio/warning-heartbeat.wav");
  ambience.loop = true; ambience.volume = .24; ambience.preload = "auto";
  heartbeat.loop = true; heartbeat.volume = .13; heartbeat.preload = "auto";
  const effects = new Set();
  function safePlay(clip) {
    const result = clip.play();
    if (result && result.catch) result.catch(() => {});
  }
  function start() {
    started = true;
    if (!enabled) return;
    safePlay(ambience);
    if (warning) safePlay(heartbeat);
  }
  function effect(name) {
    if (!started || !enabled || (name !== "merge" && name !== "clear")) return;
    const now = performance.now();
    if (name === "merge" && now - lastMerge < 180) return;
    if (name === "merge") lastMerge = now;
    const clip = new Audio(name === "clear" ? "assets/audio/level-clear.ogg" : "assets/audio/gem-merge.ogg");
    clip.volume = name === "clear" ? .48 : .12;
    effects.add(clip);
    clip.addEventListener("ended", () => effects.delete(clip), {once: true});
    const result = clip.play();
    if (result && result.catch) result.catch(() => effects.delete(clip));
  }
  function setWarning(value) {
    if (warning === value) return;
    warning = value;
    if (warning && started && enabled) safePlay(heartbeat);
    else { heartbeat.pause(); heartbeat.currentTime = 0; }
  }
  function toggle() {
    enabled = !enabled;
    try { localStorage.setItem("dabaoshi-sound", enabled ? "on" : "off"); } catch {}
    if (enabled) start();
    else {
      ambience.pause(); heartbeat.pause();
      for (const clip of effects) clip.pause();
      effects.clear();
    }
    return enabled;
  }
  window.GameAudio = {start, effect, setWarning, toggle,
    get enabled() { return enabled; }, get started() { return started; }};
})();
