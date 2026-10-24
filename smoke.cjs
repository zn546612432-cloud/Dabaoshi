const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const elements = new Map(), events = {}, frames = [], storage = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    hidden: false, textContent: "", listeners: {}, style: {}, attributes: {},
    addEventListener(name, fn) { this.listeners[name] = fn; },
    setAttribute(name, value) { this.attributes[name] = value; },
    getBoundingClientRect() { return {left: 0, width: 440}; },
    setPointerCapture() {}
  });
  return elements.get(id);
}
const ctx = new Proxy({}, {get(target, key) { return target[key] || (() => {}); }});
element("#game").getContext = () => ctx;
let now = 0;
const scope = {
  document: {querySelector: element},
  window: {addEventListener(name, fn) { events[name] = fn; }},
  location: {search: "?debug"},
  URLSearchParams,
  Image: class {constructor() { this.complete = false; this.naturalWidth = 0; }},
  performance: {now: () => now},
  requestAnimationFrame: fn => frames.push(fn),
  localStorage: {getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value)},
  Math: Object.assign(Object.create(Math), {random: () => 0}),
  Set, Map, Number, String
};
vm.runInNewContext(fs.readFileSync("gem-hulls.js", "utf8"), scope);
vm.runInNewContext(fs.readFileSync("game.js", "utf8"), scope);
const snapshot = () => scope.window.__dabaoshi.snapshot();
function advance(ms) {
  for (let elapsed = 0; elapsed < ms; elapsed += 16) {
    now += 16;
    const callback = frames.shift();
    assert.ok(callback, "animation loop stays alive");
    callback(now);
  }
}
function drop(x) {
  const event = {clientX: x, pointerId: 1, pointerType: "mouse", preventDefault() {}};
  element("#game").listeners.pointerdown(event);
  element("#game").listeners.pointerup(event);
}

assert.equal(scope.window.__dabaoshi.snapshot().score, 0);
assert.equal(snapshot().gemCount, 11, "all eleven Halloween gem levels are available");
drop(220);
assert.equal(snapshot().launches.length, 1, "player gem has flight animation");
advance(1400);
drop(220);
advance(1600);
assert.equal(snapshot().score, 10, "first merge awards exactly ten points");
assert.equal(snapshot().levelProgress, 10, "merge reward advances the level bar");
assert.equal(snapshot().levelTarget, 5000, "first level requires five thousand points");
assert.ok(Number(element("#best").textContent) > 0, "best score updates");
advance(4500);
assert.ok(snapshot().aiTimer > 0, "Jimmy's automatic throw timer resets");
assert.ok(snapshot().gems.some(g => g.owner === "ai"), "Jimmy contributes gems");
element("#restart").listeners.click();
assert.equal(snapshot().score, 0, "restart clears score");
assert.ok(Number(element("#best").textContent) > 0, "best score survives restart");
events.keydown({key: "ArrowLeft", code: "ArrowLeft", preventDefault() {}});
events.keydown({key: " ", code: "Space", preventDefault() {}});
assert.equal(snapshot().launches.length, 1, "keyboard launches gem");
element("#restart").listeners.click();
scope.window.__dabaoshi.setProgressForTest(4990);
drop(220); advance(1400); drop(220); advance(1600);
assert.ok(snapshot().levelTransition > 0 || snapshot().level >= 2, "threshold starts cauldron clear");
advance(1800);
assert.equal(snapshot().level, 2, "clear advances to next level");
for (const [roll, tier] of [[.1, 0], [.4, 1], [.7, 2], [.95, 3], [.995, 4], [.9995, 5]]) {
  scope.Math.random = () => roll;
  element("#restart").listeners.click();
  drop(220);
  assert.equal(snapshot().launches[0].level, tier, `roll ${roll} selects tier ${tier + 1}`);
}
console.log("PASS 11 silhouettes, weighted 1–6 drops, 10-point merge, 5000-point level, clear, AI, restart, keyboard");
