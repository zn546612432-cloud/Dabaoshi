(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  const ui = {
    score: document.querySelector("#score"),
    best: document.querySelector("#best"),
    overlay: document.querySelector("#overlay"),
    final: document.querySelector("#final-score")
  };
  const W = 440, H = 780, STEP = 1 / 120, GRAVITY = 1130;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * pixelRatio);
  canvas.height = Math.round(H * pixelRatio);
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  const DROP_Y = 348, DANGER_Y = 383;
  const GEM_FILES = [
    "gem-1-candy.png", "gem-2-pumpkin.png", "gem-3-ghost.png", "gem-4-bat.png",
    "gem-5-witch-moon.png", "gem-6-potion.png", "gem-7-blood-moon.png", "gem-8-star.png",
    "gem-9-skull-diamond.png", "gem-10-crown.png", "gem-11-jack-o-lantern.png"
  ];
  const GEM_RADII = [18, 24, 29, 36, 44, 53, 63, 76, 88, 101, 114];
  const GEM_COLORS = ["#ffba64", "#ff9346", "#a4eaff", "#c18aff", "#d8abff", "#77ffd0", "#ff647d", "#7ab9ff", "#d9a5ff", "#ff72c5", "#ffad42"];
  const image = file => {
    const art = new Image();
    art.src = `assets/${file}`;
    return art;
  };
  const art = {
    background: image("halloween-background.png"),
    back: image("cauldron-inner.png"),
    front: image("cauldron-rim.png"),
    gems: GEM_FILES.map(image),
    wolf: Array.from({length: 8}, (_, i) => image(`sprites/wolf/${String(i + 1).padStart(2, "0")}.png`)),
    jimmy: Array.from({length: 8}, (_, i) => image(`sprites/jimmy/${String(i + 1).padStart(2, "0")}.png`))
  };
  const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
  const randomSmall = () => { const n = Math.random(); return n < .36 ? 0 : n < .66 ? 1 : n < .88 ? 2 : 3; };
  const loaded = a => a && a.complete && a.naturalWidth > 0;
  const hulls = typeof GEM_HULLS !== "undefined" ? GEM_HULLS : [];

  // These points follow the visible inner lip and the curved basin of the painted cauldron.
  // The wall functions interpolate by height; the floor interpolates by horizontal position.
  const LEFT_WALL = [[333, 102], [372, 83], [425, 61], [488, 45], [546, 48], [591, 66], [630, 101], [657, 141], [676, 184]];
  const FLOOR = [[82, 607], [103, 626], [141, 645], [184, 656], [220, 660], [256, 656], [299, 645], [337, 626], [358, 607]];
  function interpolate(points, value, xIndex, yIndex) {
    if (value <= points[0][xIndex]) return points[0][yIndex];
    for (let i = 1; i < points.length; i++) {
      if (value <= points[i][xIndex]) {
        const a = points[i - 1], b = points[i];
        return a[yIndex] + (b[yIndex] - a[yIndex]) * (value - a[xIndex]) / (b[xIndex] - a[xIndex]);
      }
    }
    return points[points.length - 1][yIndex];
  }
  const leftWall = y => interpolate(LEFT_WALL, y, 0, 1);
  const floorY = x => interpolate(FLOOR, clamp(x, 82, 358), 0, 1);

  let gems, launches, particles, rings, score, best, nextPlayer, nextAi, aim, wolfX;
  let jimmyX, aiTarget, aiTimer, cooldown, elapsed, dangerClock, over, idCounter, shake;
  let lastMerge, combo, pointerActive, warnLevel = 0, warnBeep = 0, accumulator = 0, lastFrame = performance.now();
  try { best = Number(localStorage.getItem("dabaoshi-best")) || 0; } catch { best = 0; }

  // ---- Audio: everything is synthesized live, no files, no buttons ----
  let audio = null, sfxGain, musicGain, _noise = null;
  function ensureAudio() {
    if (audio) { if (audio.state === "suspended") audio.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audio = new AC();
    const master = audio.createGain(); master.gain.value = .8; master.connect(audio.destination);
    sfxGain = audio.createGain(); sfxGain.gain.value = .55; sfxGain.connect(master);
    musicGain = audio.createGain(); musicGain.gain.value = .15; musicGain.connect(master);
    startMusic();
  }
  function noiseBuf() {
    if (_noise) return _noise;
    const len = Math.floor(audio.sampleRate * .3);
    _noise = audio.createBuffer(1, len, audio.sampleRate);
    const d = _noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return _noise;
  }
  function tone(freq, time, dur, type, vol, dest, slideTo) {
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, time);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, time + dur);
    g.gain.setValueAtTime(.0001, time);
    g.gain.linearRampToValueAtTime(vol, time + .012);
    g.gain.exponentialRampToValueAtTime(.0001, time + dur);
    o.connect(g); g.connect(dest || sfxGain);
    o.start(time); o.stop(time + dur + .05);
  }
  function sfxThrow() {
    if (!audio) return;
    const t = audio.currentTime;
    const src = audio.createBufferSource(); src.buffer = noiseBuf();
    const f = audio.createBiquadFilter();
    f.type = "bandpass"; f.Q.value = 1.2;
    f.frequency.setValueAtTime(480, t);
    f.frequency.exponentialRampToValueAtTime(1700, t + .18);
    const g = audio.createGain();
    g.gain.setValueAtTime(.0001, t);
    g.gain.linearRampToValueAtTime(.15, t + .03);
    g.gain.exponentialRampToValueAtTime(.0001, t + .22);
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t); src.stop(t + .25);
  }
  function sfxLand() { if (audio) tone(150, audio.currentTime, .09, "sine", .18, sfxGain, 70); }
  function sfxMerge(level) {
    if (!audio) return;
    const t = audio.currentTime, f = 340 * 2 ** (level / 8);
    tone(f, t, .22, "triangle", .28, sfxGain);
    tone(f * 1.5, t + .06, .3, "triangle", .18, sfxGain);
  }
  function sfxWarn(level) {
    if (!audio) return;
    const t = audio.currentTime, v = .08 + level * .05;
    tone(72, t, .1, "sine", v, sfxGain, 44);
    tone(60, t + .16, .13, "sine", v * .75, sfxGain, 40);
  }
  function sfxOver() {
    if (!audio) return;
    const t = audio.currentTime;
    tone(420, t, .8, "sawtooth", .2, sfxGain, 70);
    tone(210, t + .1, .9, "triangle", .16, sfxGain, 55);
  }
  const midi = m => 440 * 2 ** ((m - 69) / 12);
  const PROG = [
    {bass: 38, arp: [62, 65, 69, 74]},
    {bass: 38, arp: [62, 65, 69, 74]},
    {bass: 34, arp: [65, 70, 74, 77]},
    {bass: 33, arp: [64, 69, 73, 76]}
  ];
  const ARP_PATTERN = [0, 1, 2, 3, 2, 1, 2, 3];
  function scheduleStep(step, t) {
    const chord = PROG[Math.floor(step / 8) % PROG.length], s = step % 8;
    if (s === 0 || s === 4) tone(midi(chord.bass), t, .5, "sine", .5, musicGain);
    tone(midi(chord.arp[ARP_PATTERN[s]]), t, .24, "triangle", .16, musicGain);
    if (s % 2 === 1) {
      const src = audio.createBufferSource(); src.buffer = noiseBuf();
      const f = audio.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 6500;
      const g = audio.createGain();
      g.gain.setValueAtTime(.05, t);
      g.gain.exponentialRampToValueAtTime(.0001, t + .06);
      src.connect(f); f.connect(g); g.connect(musicGain);
      src.start(t); src.stop(t + .08);
    }
    if (step % 32 === 30) tone(midi(86), t, 1.1, "sine", .08, musicGain);
  }
  function startMusic() {
    let step = 0, next = audio.currentTime + .1;
    setInterval(() => {
      while (next < audio.currentTime + .35) { scheduleStep(step, next); step++; next += 60 / 96 / 2; }
    }, 90);
  }

  function vertices(g) {
    const source = hulls[g.level] || [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const c = Math.cos(g.angle), s = Math.sin(g.angle);
    return source.map(([x, y]) => ({x: g.x + (x * c - y * s) * g.r, y: g.y + (x * s + y * c) * g.r}));
  }
  function project(points, nx, ny) {
    let low = Infinity, high = -Infinity;
    for (const p of points) { const d = p.x * nx + p.y * ny; low = Math.min(low, d); high = Math.max(high, d); }
    return [low, high];
  }
  function collision(a, b) {
    if (Math.hypot(a.x - b.x, a.y - b.y) > a.r + b.r + 2) return null;
    const av = vertices(a), bv = vertices(b);
    let depth = Infinity, nx = 0, ny = 0;
    for (const polygon of [av, bv]) for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i], q = polygon[(i + 1) % polygon.length];
      const ex = q.x - p.x, ey = q.y - p.y, length = Math.hypot(ex, ey);
      if (length < .001) continue;
      const ax = -ey / length, ay = ex / length;
      const [al, ah] = project(av, ax, ay), [bl, bh] = project(bv, ax, ay);
      const overlap = Math.min(ah, bh) - Math.max(al, bl);
      if (overlap <= 0) return null;
      if (overlap < depth) { depth = overlap; nx = ax; ny = ay; }
    }
    if ((b.x - a.x) * nx + (b.y - a.y) * ny < 0) { nx = -nx; ny = -ny; }
    return {depth, nx, ny};
  }
  function makeGem(level, x, y, owner) {
    return {id: ++idCounter, level, x, y, r: GEM_RADII[level], angle: (Math.random() - .5) * .12,
      vx: 0, vy: 0, omega: (Math.random() - .5) * .45, age: 0, owner, impactReady: true};
  }
  function updateScore() {
    ui.score.textContent = score.toLocaleString("zh-CN");
    ui.best.textContent = best.toLocaleString("zh-CN");
  }
  function endGame() {
    if (over) return;
    over = true;
    sfxOver();
    ui.final.textContent = `得分 ${score.toLocaleString("zh-CN")}`;
    ui.overlay.hidden = false;
  }
  function reset() {
    gems = []; launches = []; particles = []; rings = [];
    score = 0; nextPlayer = randomSmall(); nextAi = randomSmall();
    aim = 180; wolfX = 166; jimmyX = 350; aiTarget = 300; aiTimer = 3.1;
    cooldown = 0; elapsed = 0; dangerClock = 0; over = false; idCounter = 0;
    shake = 0; lastMerge = -10; combo = 0; pointerActive = false; accumulator = 0;
    ui.overlay.hidden = true; updateScore();
  }
  function emit(x, y, color, count, force) {
    for (let i = 0; i < count; i++) {
      const a = Math.PI * 2 * i / count + Math.random() * .3;
      const v = force * (.55 + Math.random() * .75);
      particles.push({x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 28,
        life: .4 + Math.random() * .35, max: .75, radius: 1.5 + Math.random() * 2.7, color});
    }
  }
  function landing(g, speed) {
    if (!g.impactReady || speed < 115) return;
    emit(g.x, Math.min(g.y + g.r * .6, 685), GEM_COLORS[g.level], 5, 48);
    rings.push({x: g.x, y: Math.min(g.y + g.r * .5, 685), age: 0, radius: g.r * .65, color: GEM_COLORS[g.level]});
    sfxLand();
    g.impactReady = false;
  }
  function spawn(level, x, owner) {
    const g = makeGem(level, clamp(x, 112, 328), DROP_Y, owner);
    if (gems.some(other => collision(g, other))) { endGame(); return; }
    g.vy = 100;
    gems.push(g);
  }
  function launch(owner, level, x0, y0, x1, duration) {
    sfxThrow();
    launches.push({owner, level, x0, y0, x1: clamp(x1, 112, 328), y1: DROP_Y,
      t: 0, duration, arc: owner === "ai" ? -72 : -68, rx: x0, ry: y0, released: false});
  }
  function playerDrop() {
    if (over || cooldown > 0) return;
    launch("player", nextPlayer, wolfX + 13, 258, aim, .52);
    nextPlayer = randomSmall(); cooldown = .57;
  }
  function chooseAiTarget() {
    let winner = 220, bestValue = -Infinity;
    for (let x = 116; x <= 324; x += 16) {
      let value = 0;
      for (const g of gems) {
        const dx = Math.abs(g.x - x);
        if (g.level === nextAi) value += Math.max(0, 125 - dx) * .1;
        if (g.y - g.r < DANGER_Y + 95) value -= Math.max(0, 85 - dx) * .2;
      }
      value -= Math.abs(x - jimmyX) * .008;
      value += (Math.random() - .5) * .4;
      if (value > bestValue) { bestValue = value; winner = x; }
    }
    return winner;
  }
  // Per-frame palm anchors, measured on the new empty-hand sprites. The gem
  // follows the same frame changes as the arm, including the raised release pose.
  const HAND_FRAMES = {
    player: [
      {x: 17, y: 9}, {x: 17, y: 9}, {x: 21, y: 8}, {x: 35, y: 10},
      {x: 37, y: -7}, {x: 37, y: -6}, {x: 36, y: -3}, {x: 17, y: 9}
    ],
    ai: [
      {x: -20, y: 23}, {x: -24, y: 24}, {x: -23, y: 27}, {x: -19, y: 23},
      {x: -32, y: 20}, {x: -51, y: 22}, {x: -50, y: 24}, {x: -19, y: 23}
    ]
  };
  const WINDUPP = .32;
  function actorCenter(owner) {
    return owner === "player"
      ? {x: wolfX, y: 225 + Math.sin(elapsed * 3) * 1.8}
      : {x: jimmyX, y: 213 + Math.sin(elapsed * 7) * 4};
  }
  function throwHandOffset(owner, progress) {
    const frames = HAND_FRAMES[owner], phase = clamp(progress, 0, 1) * 4;
    if (phase >= 3) return frames[6];
    const segment = Math.floor(phase), f = phase - segment, ease = f * f * (3 - 2 * f);
    const a = frames[3 + segment], b = frames[4 + segment];
    return {x: a.x + (b.x - a.x) * ease, y: a.y + (b.y - a.y) * ease};
  }
  function handPos(owner) {
    const c = actorCenter(owner), active = launches.find(l => l.owner === owner);
    const o = active
      ? (active.t < WINDUPP ? throwHandOffset(owner, active.t / WINDUPP) : HAND_FRAMES[owner][6])
      : HAND_FRAMES[owner][actorFrame(owner)];
    return {x: c.x + o.x, y: c.y + o.y};
  }
  function launchPosition(l, t = l.t) {
    if (t < WINDUPP) {
      const c = actorCenter(l.owner), o = throwHandOffset(l.owner, t / WINDUPP);
      return {x: c.x + o.x, y: c.y + o.y};
    }
    const u = clamp((t - WINDUPP) / (1 - WINDUPP), 0, 1);
    return {x: l.rx + (l.x1 - l.rx) * u,
      y: l.ry + (l.y1 - l.ry) * u + l.arc * 4 * u * (1 - u)};
  }
  function merge(a, b) {
    const level = a.level + 1, x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
    sfxMerge(level);
    combo = elapsed - lastMerge < 1.8 ? combo + 1 : 1; lastMerge = elapsed;
    score += Math.round(20 * 2 ** level * Math.min(combo, 4));
    if (score > best) {
      best = score;
      try { localStorage.setItem("dabaoshi-best", String(best)); } catch {}
    }
    updateScore();
    const color = GEM_COLORS[Math.min(level, GEM_RADII.length - 1)];
    emit(x, y, color, 13 + Math.min(level, GEM_RADII.length - 1) * 3, 95 + level * 13);
    rings.push({x, y, age: 0, radius: GEM_RADII[Math.min(level, GEM_RADII.length - 1)] * .8, color});
    shake = Math.min(.9, shake + .15 + level * .035);
    if (level >= GEM_RADII.length) return null;
    const child = makeGem(level, x, y, a.owner);
    child.vx = (a.vx + b.vx) * .23; child.vy = -130;
    child.omega = (a.omega + b.omega) * .2;
    return child;
  }
  function constrain(g) {
    // The boundary is deliberately allowed to be nonconvex: narrow opening, wide belly,
    // then a rising rounded floor. Check every rotated hull vertex against the local edge.
    for (let pass = 0; pass < 3; pass++) {
      let left = 0, right = 0, bottom = 0, leftY = 0, rightY = 0, bottomX = 220;
      for (const p of vertices(g)) {
        if (p.y >= 333) {
          const lp = leftWall(p.y) - p.x, rp = p.x - (W - leftWall(p.y));
          if (lp > left) { left = lp; leftY = p.y; }
          if (rp > right) { right = rp; rightY = p.y; }
        }
        if (p.y >= 595) {
          const bp = p.y - floorY(p.x);
          if (bp > bottom) { bottom = bp; bottomX = p.x; }
        }
      }
      if (left > 0) {
        const slope = (leftWall(leftY + 1) - leftWall(leftY - 1)) / 2;
        g.x += left / (1 + slope * slope);
        g.y -= slope * left / (1 + slope * slope);
        const length = Math.hypot(1, slope), nx = -1 / length, ny = slope / length;
        const speed = g.vx * nx + g.vy * ny;
        if (speed > 0) { g.vx -= 1.18 * speed * nx; g.vy -= 1.18 * speed * ny; }
        g.omega *= .8;
      }
      if (right > 0) {
        const slope = (leftWall(rightY + 1) - leftWall(rightY - 1)) / 2;
        g.x -= right / (1 + slope * slope);
        g.y -= slope * right / (1 + slope * slope);
        const length = Math.hypot(1, slope), nx = 1 / length, ny = slope / length;
        const speed = g.vx * nx + g.vy * ny;
        if (speed > 0) { g.vx -= 1.18 * speed * nx; g.vy -= 1.18 * speed * ny; }
        g.omega *= .8;
      }
      if (bottom > 0) {
        const slope = (floorY(bottomX + 1) - floorY(bottomX - 1)) / 2;
        g.x += slope * bottom / (1 + slope * slope);
        g.y -= bottom / (1 + slope * slope);
        const length = Math.hypot(1, slope), nx = -slope / length, ny = 1 / length;
        const speed = Math.max(0, g.vx * nx + g.vy * ny);
        const bounce = speed > 35 ? .17 : 0;
        g.vx -= (1 + bounce) * speed * nx;
        g.vy -= (1 + bounce) * speed * ny;
        g.vx *= .94; g.omega *= .84;
        landing(g, speed);
      }
      if (!(left > .01 || right > .01 || bottom > .01)) break;
    }
  }
  function physics(dt) {
    elapsed += dt; cooldown = Math.max(0, cooldown - dt);
    wolfX += ((aim - 13) - wolfX) * Math.min(1, dt * 11);
    aiTimer -= dt;
    if (aiTimer < 1.1 && aiTimer + dt >= 1.1) aiTarget = chooseAiTarget();
    jimmyX += (clamp(aiTarget + 43, 295, 385) - jimmyX) * Math.min(1, dt * 1.5);
    if (aiTimer <= 0) {
      launch("ai", nextAi, jimmyX - 21, 238 + Math.sin(elapsed * 5) * 4, aiTarget, .62);
      nextAi = randomSmall(); aiTimer = 3.7 + Math.random() * .9;
    }
    for (const l of launches) {
      l.t += dt / l.duration;
      if (!l.released && l.t >= WINDUPP) {
        const c = actorCenter(l.owner), o = HAND_FRAMES[l.owner][6];
        l.rx = c.x + o.x; l.ry = c.y + o.y; l.released = true;
      }
    }
    const finished = launches.filter(l => l.t >= 1);
    launches = launches.filter(l => l.t < 1);
    for (const l of finished) if (!over) spawn(l.level, l.x1, l.owner);
    for (const g of gems) {
      g.age += dt; g.vy += GRAVITY * dt;
      g.vx *= .998; g.omega *= .997;
      g.x += g.vx * dt; g.y += g.vy * dt; g.angle += g.omega * dt;
      if (g.vy < -60) g.impactReady = true;
      constrain(g);
    }
    const removed = new Set(), added = [];
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < gems.length; i++) {
        const a = gems[i]; if (removed.has(a.id)) continue;
        for (let j = i + 1; j < gems.length; j++) {
          const b = gems[j]; if (removed.has(b.id)) continue;
          const hit = collision(a, b); if (!hit) continue;
          if (a.level === b.level) {
            removed.add(a.id); removed.add(b.id);
            const child = merge(a, b); if (child) added.push(child);
            break;
          }
          const ma = a.r * a.r, mb = b.r * b.r, total = ma + mb;
          a.x -= hit.nx * hit.depth * mb / total; a.y -= hit.ny * hit.depth * mb / total;
          b.x += hit.nx * hit.depth * ma / total; b.y += hit.ny * hit.depth * ma / total;
          const speed = (b.vx - a.vx) * hit.nx + (b.vy - a.vy) * hit.ny;
          if (speed < 0) {
            const impulse = -1.12 * speed / (1 / ma + 1 / mb);
            a.vx -= impulse * hit.nx / ma; a.vy -= impulse * hit.ny / ma;
            b.vx += impulse * hit.nx / mb; b.vy += impulse * hit.ny / mb;
            landing(a, Math.abs(speed)); landing(b, Math.abs(speed));
          }
        }
      }
      for (const g of gems) if (!removed.has(g.id)) constrain(g);
    }
    if (removed.size) gems = gems.filter(g => !removed.has(g.id)).concat(added);
    for (const p of particles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt; p.life -= dt;
    }
    particles = particles.filter(p => p.life > 0);
    for (const r of rings) r.age += dt;
    rings = rings.filter(r => r.age < .42);
    shake = Math.max(0, shake - dt * 1.5);
    // Only a falling/newly merged gem is briefly exempt. Once an older gem is
    // held above the visible warning line, the cauldron is full immediately.
    const crowded = gems.some(g => g.age > .75 && vertices(g).some(p => p.y < DANGER_Y));
    dangerClock = crowded ? 2.4 : 0;
    if (crowded) endGame();
    // Infrared warning: how close the tallest settled stack is to the rim line.
    let warnTarget = dangerClock > 0 ? 1 : 0;
    for (const g of gems) {
      if (g.age < .6) continue;
      let top = Infinity;
      for (const p of vertices(g)) top = Math.min(top, p.y);
      const near = clamp((DANGER_Y + 95 - top) / 95, 0, 1);
      if (near > warnTarget) warnTarget = near;
    }
    warnLevel += (warnTarget - warnLevel) * Math.min(1, dt * (warnTarget > warnLevel ? 6 : 2.5));
    if (warnLevel > .3) {
      warnBeep -= dt;
      if (warnBeep <= 0) { sfxWarn(warnLevel); warnBeep = 1.05 - warnLevel * .25; }
    } else warnBeep = 0;
  }
  function drawImageOr(artImage, x, y, w, h, color) {
    if (loaded(artImage)) ctx.drawImage(artImage, x, y, w, h);
    else { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
  }
  function drawGem(level, x, y, radius, angle = 0, alpha = 1) {
    const imageAsset = art.gems[level];
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.translate(x, y); ctx.rotate(angle);
    if (loaded(imageAsset)) {
      ctx.shadowColor = GEM_COLORS[level]; ctx.shadowBlur = level >= 4 ? 14 : 7;
      ctx.drawImage(imageAsset, -radius, -radius, radius * 2, radius * 2);
    } else {
      ctx.fillStyle = GEM_COLORS[level]; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  function drawActor(frames, index, x, y, w, h) {
    const frame = frames[index];
    if (loaded(frame)) ctx.drawImage(frame, x - w / 2, y - h / 2, w, h);
  }
  function actorFrame(owner) {
    const active = launches.find(l => l.owner === owner);
    if (active) return Math.min(7, 4 + Math.floor(Math.min(1, active.t / WINDUPP) * 4));
    if (owner === "ai") return Math.floor(elapsed * 7) % 4;
    return pointerActive || Math.abs(aim - wolfX - 13) > 3
      ? 2 + Math.floor(elapsed * 5) % 2 : Math.floor(elapsed * 2.5) % 2;
  }
  function render() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (shake > 0) ctx.translate(Math.sin(elapsed * 36) * shake * 4, Math.cos(elapsed * 31) * shake * 3);
    drawImageOr(art.background, -40, 0, 520, 780, "#27182d");
    // The interior image paints the recessed bowl; the back and front are separate layers.
    drawImageOr(art.back, 15, 316, 410, 429, "#29152d");
    if (!over) {
      ctx.save();
      ctx.setLineDash([3, 8]); ctx.strokeStyle = "#ffe1a47a"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(aim, DROP_Y + 16); ctx.lineTo(aim, Math.min(floorY(aim) - 12, 625)); ctx.stroke();
      ctx.restore();
    }
    for (const g of gems) drawGem(g.level, g.x, g.y, g.r, g.angle);
    for (const r of rings) {
      ctx.save(); ctx.globalAlpha = 1 - r.age / .42; ctx.strokeStyle = r.color;
      ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(r.x, r.y, r.radius + r.age * 74, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    for (const p of particles) {
      ctx.save(); ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if (dangerClock > 0) {
      ctx.fillStyle = "#ffad85aa"; ctx.fillRect(102, 365, 236 * clamp(dangerClock / 2.4, 0, 1), 3);
    }
    if (warnLevel > .02) {
      const pulse = .5 + .5 * Math.sin(elapsed * 9);
      const y = DANGER_Y, x0 = 106, x1 = 334;
      ctx.save();
      ctx.globalAlpha = warnLevel * (.3 + .6 * pulse);
      const beam = ctx.createLinearGradient(0, y - 9, 0, y + 9);
      beam.addColorStop(0, "rgba(255,60,80,0)");
      beam.addColorStop(.5, "rgba(255,60,80,.5)");
      beam.addColorStop(1, "rgba(255,60,80,0)");
      ctx.fillStyle = beam; ctx.fillRect(x0, y - 9, x1 - x0, 18);
      ctx.strokeStyle = "#ff3c50"; ctx.lineWidth = 2;
      ctx.setLineDash([7, 6]); ctx.lineDashOffset = -elapsed * 46;
      ctx.shadowColor = "#ff3c50"; ctx.shadowBlur = 13;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      ctx.setLineDash([]); ctx.shadowBlur = 8;
      for (const ex of [x0, x1]) {
        ctx.fillStyle = "#ff3c50";
        ctx.beginPath(); ctx.arc(ex, y, 3 + pulse * 1.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    drawImageOr(art.front, 15, 316, 410, 429, "#7a522d33");
    const flying = Math.sin(elapsed * 7) * 4;
    drawActor(art.wolf, actorFrame("player"), wolfX, 225 + Math.sin(elapsed * 3) * 1.8, 134, 134);
    drawActor(art.jimmy, actorFrame("ai"), jimmyX, 213 + flying, 153, 153);
    const hp = handPos("player"), ha = handPos("ai");
    if (!over) drawGem(nextPlayer, hp.x, hp.y, 12, elapsed * .2);
    if (!over) drawGem(nextAi, ha.x, ha.y, 11, -elapsed * .25);
    for (const l of launches) {
      const pos = launchPosition(l);
      const heldSize = l.owner === "player" ? 13 : 12;
      ctx.save(); ctx.lineCap = "round";
      if (l.t >= WINDUPP) for (let k = 4; k >= 1; k--) {
        const tail = launchPosition(l, Math.max(l.t - k * .035, WINDUPP));
        ctx.globalAlpha = .12 + (5 - k) * .09;
        ctx.strokeStyle = GEM_COLORS[l.level]; ctx.lineWidth = 2 + (5 - k) * 1.4;
        ctx.beginPath(); ctx.moveTo(tail.x, tail.y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
      }
      ctx.restore();
      // Hand-sized while reaching out, then grows to full size in flight. Drawn
      // last so the flying gem always sits on top of the one waiting in the hand.
      const u = clamp((l.t - WINDUPP) / (1 - WINDUPP), 0, 1);
      const flightRadius = l.t < WINDUPP ? heldSize : heldSize + (GEM_RADII[l.level] - heldSize) * u * u;
      drawGem(l.level, pos.x, pos.y, flightRadius, l.t * 1.8);
    }
    ctx.restore();
  }
  function frame(now) {
    accumulator += Math.min((now - lastFrame) / 1000, .05); lastFrame = now;
    let steps = 0;
    while (accumulator >= STEP && steps++ < 6) { if (!over) physics(STEP); accumulator -= STEP; }
    render(); requestAnimationFrame(frame);
  }
  function pointerX(event) {
    const rect = canvas.getBoundingClientRect();
    return clamp((event.clientX - rect.left) * W / rect.width, 112, 328);
  }
  canvas.addEventListener("pointerdown", event => {
    event.preventDefault(); ensureAudio(); pointerActive = true; aim = pointerX(event);
    if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", event => { if (event.pointerType === "mouse" || pointerActive) aim = pointerX(event); });
  canvas.addEventListener("pointerup", event => {
    event.preventDefault(); if (!pointerActive) return;
    pointerActive = false; aim = pointerX(event); playerDrop();
  });
  canvas.addEventListener("pointercancel", () => { pointerActive = false; });
  window.addEventListener("keydown", event => {
    ensureAudio();
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault(); aim = clamp(aim + (event.key === "ArrowLeft" ? -22 : 22), 112, 328);
    } else if (event.code === "Space") { event.preventDefault(); playerDrop(); }
    else if (event.key.toLowerCase() === "r") reset();
  });
  document.querySelector("#restart").addEventListener("click", () => { ensureAudio(); reset(); });
  document.querySelector("#again").addEventListener("click", () => { ensureAudio(); reset(); });
  if (new URLSearchParams(location.search).has("debug")) {
    window.__dabaoshi = {snapshot: () => ({
      gems: gems.map(g => ({x: g.x, y: g.y, r: g.r, level: g.level, owner: g.owner})),
      launches: launches.map(l => ({owner: l.owner, level: l.level, t: l.t})),
      score, best, over, aiTimer, dangerClock
    })};
  }
  reset(); requestAnimationFrame(frame);
})();
