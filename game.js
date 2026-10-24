(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  const ui = {
    score: document.querySelector("#score"),
    best: document.querySelector("#best"),
    level: document.querySelector("#level-label"),
    progress: document.querySelector("#level-progress"),
    progressFill: document.querySelector("#progress-fill"),
    overlay: document.querySelector("#overlay"),
    final: document.querySelector("#final-score")
  };
  const W = 440, H = 780, STEP = 1 / 120, GRAVITY = 1130;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * pixelRatio);
  canvas.height = Math.round(H * pixelRatio);
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  const DROP_Y = 348, DANGER_Y = 383, WARNING_Y = 436;
  const GEM_FILES = [
    "gem-1-candy.png", "gem-2-pumpkin.png", "gem-3-ghost.png", "gem-4-bat.png",
    "gem-5-witch-moon.png", "gem-6-potion.png", "gem-7-blood-moon.png", "gem-8-star.png",
    "gem-9-jack-o-lantern.png", "gem-10-witch-crown.png", "gem-11-phantom-crown.png"
  ];
  const GEM_RADII = [21, 27, 34, 41, 50, 61, 72, 86, 96, 106, 116];
  const GEM_COLORS = ["#ffba64", "#ff9346", "#a4eaff", "#c18aff", "#d8abff", "#77ffd0", "#ff647d", "#7ab9ff", "#ffa32b", "#ec75ff", "#c8a5ff"];
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
    wolf: Array.from({length: 8}, (_, i) => image(`sprites/wolf-empty/${String(i + 1).padStart(2, "0")}.png`)),
    jimmy: Array.from({length: 8}, (_, i) => image(`sprites/jimmy-empty/${String(i + 1).padStart(2, "0")}.png`))
  };
  const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
  const RARE_DROP_CHANCE = .01; // 1%; change this to .005 for 0.5% or .02 for 2%.
  const randomSmall = () => {
    const high = Math.min(8, 5 + Math.floor((level - 1) / 2));
    const n = Math.random();
    if (n < 1 - RARE_DROP_CHANCE) return Math.floor(n / (1 - RARE_DROP_CHANCE) * 5);
    return 5 + Math.floor(Math.random() * (high - 4));
  };
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
  let jimmyX, aiTarget, aiTimer, cooldown, elapsed, warningLevel, over, idCounter, shake;
  let lastActorBump, actorBumpFlash;
  let level, levelProgress, levelTarget, levelTransition, clearBurstClock;
  let pointerActive, accumulator = 0, lastFrame = performance.now();
  try { best = Number(localStorage.getItem("dabaoshi-best")) || 0; } catch { best = 0; }
  const audio = window.GameAudio;

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
      vx: 0, vy: 0, omega: (Math.random() - .5) * .45, age: 0, owner, impactReady: true, touched: false};
  }
  function updateScore() {
    ui.score.textContent = score.toLocaleString("zh-CN");
    ui.best.textContent = best.toLocaleString("zh-CN");
  }
  function updateLevelUI() {
    const percent = clamp(levelProgress / levelTarget, 0, 1) * 100;
    ui.level.textContent = `第 ${level} 关`;
    ui.progressFill.style.width = `${percent}%`;
    ui.progress.setAttribute("aria-valuenow", String(Math.round(percent)));
  }
  function beginLevelClear() {
    if (levelTransition > 0 || over) return;
    levelTransition = 1.55; clearBurstClock = 0;
    cooldown = 1.55; launches = [];
    audio?.setWarning(false); audio?.effect("clear");
    for (const g of gems) emit(g.x, g.y, GEM_COLORS[g.level], 8, 130);
    rings.push({x: 220, y: 520, age: 0, radius: 58, color: "#ffe19a"});
  }
  function endGame() {
    if (over) return;
    over = true;
    audio?.effect("lose"); audio?.setWarning(false);
    ui.final.textContent = `得分 ${score.toLocaleString("zh-CN")}`;
    ui.overlay.hidden = false;
  }
  function reset() {
    gems = []; launches = []; particles = []; rings = [];
    level = 1; levelProgress = 0; levelTarget = 5000; levelTransition = 0; clearBurstClock = 0;
    score = 0; nextPlayer = randomSmall(); nextAi = randomSmall();
    aim = 180; wolfX = 166; jimmyX = 350; aiTarget = 300; aiTimer = 5;
    cooldown = 0; elapsed = 0; warningLevel = 0; over = false; idCounter = 0;
    lastActorBump = -10; actorBumpFlash = 0;
    shake = 0; pointerActive = false; accumulator = 0;
    ui.overlay.hidden = true; updateScore(); updateLevelUI(); audio?.setWarning(false);
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
    g.impactReady = false;
    audio?.effect("land", Math.min(1, speed / 450));
  }
  function spawn(level, x, owner) {
    const g = makeGem(level, clamp(x, 112, 328), DROP_Y, owner);
    // Let a crowded opening displace a newly dropped gem before checking the settled pile.
    for (let attempt = 0; attempt < 5 && gems.some(other => collision(g, other)); attempt++)
      g.y -= g.r * .7;
    g.vy = 100;
    gems.push(g);
  }
  function launch(owner, level, x0, y0, x1, duration) {
    launches.push({owner, level, x0, y0, x1: clamp(x1, 112, 328), y1: DROP_Y,
      t: 0, duration, arc: owner === "ai" ? -40 : -20});
  }
  const WOLF_HAND = [[13, 32], [14, 32], [39, 18], [41, 18], [43, 22], [46, 22], [46, 22], [13, 32]];
  const JIMMY_HAND = [[-21, 25], [-21, 25], [-20, 26], [-20, 26], [-33, 20], [-45, 20], [-46, 20], [-21, 25]];
  function handPoint(owner, frame, x, y) {
    const [dx, dy] = (owner === "player" ? WOLF_HAND : JIMMY_HAND)[frame];
    return {x: x + dx, y: y + dy};
  }
  function playerDrop(releaseFrame = actorFrame("player")) {
    if (over || levelTransition > 0 || cooldown > 0) return;
    const hand = handPoint("player", releaseFrame, wolfX, 225 + Math.sin(elapsed * 3) * 1.8);
    launch("player", nextPlayer, hand.x, hand.y, aim, .41);
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
  function launchPosition(l, t = l.t) {
    const u = clamp(t, 0, 1), ease = 1 - (1 - u) ** 3;
    return {x: l.x0 + (l.x1 - l.x0) * ease,
      y: l.y0 + (l.y1 - l.y0) * u * u + l.arc * Math.sin(Math.PI * u)};
  }
  function merge(a, b) {
    const level = a.level + 1, x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
    const reward = 10 * 2 ** (level - 1);
    score += reward; levelProgress += reward;
    if (score > best) {
      best = score;
      try { localStorage.setItem("dabaoshi-best", String(best)); } catch {}
    }
    updateScore(); updateLevelUI();
    const color = GEM_COLORS[Math.min(level, GEM_COLORS.length - 1)];
    emit(x, y, color, 13 + Math.min(level, 10) * 3, 95 + level * 13);
    rings.push({x, y, age: 0, radius: GEM_RADII[Math.min(level, 10)] * .8, color});
    audio?.effect("merge", level);
    if (levelProgress >= levelTarget) beginLevelClear();
    shake = Math.min(.9, shake + .15 + level * .035);
    if (level >= GEM_RADII.length) return null;
    const child = makeGem(level, x, y, a.owner);
    child.touched = true;
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
        g.touched = true;
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
  function advanceEffects(dt) {
    for (const p of particles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt; p.life -= dt;
    }
    particles = particles.filter(p => p.life > 0);
    for (const r of rings) r.age += dt;
    rings = rings.filter(r => r.age < .42);
  }
  function physics(dt) {
    elapsed += dt; cooldown = Math.max(0, cooldown - dt);
    if (levelTransition > 0) {
      levelTransition -= dt; clearBurstClock += dt;
      shake = Math.max(shake, 1.6 + levelTransition * .9);
      for (const g of gems) {
        g.x += Math.sin(elapsed * 28 + g.id * 2) * dt * 32;
        g.y -= dt * 42;
        g.angle += dt * (g.id % 2 ? 2.8 : -2.8);
        g.clearAlpha = clamp(levelTransition / 1.55, 0, 1);
      }
      if (clearBurstClock > .13 && gems.length) {
        clearBurstClock = 0;
        const g = gems[Math.floor(Math.random() * gems.length)];
        emit(g.x, g.y, GEM_COLORS[g.level], 9, 165);
      }
      advanceEffects(dt);
      if (levelTransition <= 0) {
        const overflow = Math.max(0, levelProgress - levelTarget);
        level++; levelTarget = Math.round(5000 * 1.45 ** (level - 1));
        levelProgress = Math.min(overflow, levelTarget * .75);
        gems = []; launches = []; nextPlayer = randomSmall(); nextAi = randomSmall();
        aiTimer = Math.max(2.2, 4.8 - (level - 1) * .35);
        cooldown = .25; warningLevel = 0;
        updateLevelUI();
      }
      return;
    }
    wolfX += (clamp(aim - 13, 112, 235) - wolfX) * Math.min(1, dt * 11);
    aiTimer -= dt;
    if (aiTimer < 1.1 && aiTimer + dt >= 1.1) aiTarget = chooseAiTarget();
    jimmyX += (clamp(aiTarget + 43, 275, 405) - jimmyX) * Math.min(1, dt * 1.5);
    const actorOverlap = 112 - (jimmyX - wolfX);
    if (actorOverlap > 0) {
      wolfX = Math.max(85, wolfX - actorOverlap * .45);
      jimmyX = Math.min(405, jimmyX + actorOverlap * .55);
      if (elapsed - lastActorBump > .55) {
        lastActorBump = elapsed; actorBumpFlash = .22;
        emit((wolfX + jimmyX) / 2, 224, "#ffe7bc", 7, 65);
      }
    }
    actorBumpFlash = Math.max(0, actorBumpFlash - dt);
    if (aiTimer <= 0) {
      const hand = handPoint("ai", actorFrame("ai"), jimmyX, 213 + Math.sin(elapsed * 7) * 4);
      launch("ai", nextAi, hand.x, hand.y, aiTarget, .52);
      nextAi = randomSmall(); aiTimer = Math.max(2.2, 5.1 - (level - 1) * .35) + Math.random() * .6;
    }
    for (const l of launches) l.t += dt / l.duration;
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
          a.touched = true; b.touched = true;
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
    advanceEffects(dt);
    shake = Math.max(0, shake - dt * 1.5);
    const inPot = gems.filter(g => g.touched);
    const top = inPot.length ? Math.min(...inPot.flatMap(g => vertices(g).map(p => p.y))) : Infinity;
    const nearFull = top < WARNING_Y;
    warningLevel += ((nearFull ? 1 : 0) - warningLevel) * Math.min(1, dt * 3);
    audio?.setWarning(nearFull && levelTransition <= 0);
    if (levelTransition <= 0 && top < DANGER_Y) endGame();
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
    if (active) return Math.min(7, 4 + Math.floor(active.t * 4));
    if (owner === "ai") return Math.floor(elapsed * 7) % 4;
    return pointerActive || Math.abs(aim - wolfX - 13) > 3
      ? 2 + Math.floor(elapsed * 5) % 2 : Math.floor(elapsed * 2.5) % 2;
  }
  function render() {
    ctx.clearRect(0, 0, W, H);
    drawImageOr(art.background, -40, 0, 520, 780, "#27182d");
    ctx.save();
    if (shake > 0) ctx.translate(Math.sin(elapsed * 26) * shake * 1.5, Math.cos(elapsed * 23) * shake);
    // The interior image paints the recessed bowl; the back and front are separate layers.
    drawImageOr(art.back, 15, 316, 410, 429, "#29152d");
    if (!over && levelTransition <= 0) {
      ctx.save();
      ctx.setLineDash([3, 8]); ctx.strokeStyle = "#ffe1a47a"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(aim, DROP_Y + 16); ctx.lineTo(aim, Math.min(floorY(aim) - 12, 625)); ctx.stroke();
      ctx.restore();
    }
    for (const g of gems) drawGem(g.level, g.x, g.y, g.r, g.angle, g.clearAlpha ?? 1);
    for (const r of rings) {
      ctx.save(); ctx.globalAlpha = 1 - r.age / .42; ctx.strokeStyle = r.color;
      ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(r.x, r.y, r.radius + r.age * 74, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    for (const p of particles) {
      ctx.save(); ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    drawImageOr(art.front, 15, 316, 410, 429, "#7a522d33");
    // Draw above the front rim so the fill limit remains visible through the opening.
    ctx.save();
    const pulse = .5 + .5 * Math.sin(elapsed * 8);
    ctx.setLineDash([8, 6]); ctx.lineDashOffset = -elapsed * (warningLevel > .2 ? 12 : 3);
    ctx.strokeStyle = warningLevel > .2 ? `rgba(255,130,96,${.63 + pulse * warningLevel * .34})` : "rgba(255,220,163,.65)";
    ctx.lineWidth = warningLevel > .2 ? 2.5 + warningLevel * 1.5 : 1.8;
    ctx.shadowColor = "#ff6b65"; ctx.shadowBlur = warningLevel * (8 + pulse * 14);
    ctx.beginPath(); ctx.moveTo(leftWall(DANGER_Y) + 7, DANGER_Y);
    ctx.lineTo(W - leftWall(DANGER_Y) - 7, DANGER_Y); ctx.stroke();
    ctx.restore();
    if (warningLevel > .05) {
      ctx.save(); ctx.globalAlpha = warningLevel * (.15 + pulse * .22);
      ctx.fillStyle = "#ff6355"; ctx.fillRect(88, DANGER_Y - 9, 264, 18);
      ctx.restore();
    }
    ctx.restore();
    const flying = Math.sin(elapsed * 7) * 4;
    const wolfY = 225 + Math.sin(elapsed * 3) * 1.8, jimmyY = 213 + flying;
    const wolfFrame = actorFrame("player"), jimmyFrame = actorFrame("ai");
    drawActor(art.wolf, wolfFrame, wolfX, wolfY, 134, 134);
    drawActor(art.jimmy, jimmyFrame, jimmyX, jimmyY, 153, 153);
    if (actorBumpFlash > 0) {
      ctx.save();
      ctx.globalAlpha = actorBumpFlash / .22;
      ctx.strokeStyle = "#ffe7bc"; ctx.lineWidth = 2;
      ctx.shadowColor = "#fff1cc"; ctx.shadowBlur = 12;
      const mid = (wolfX + jimmyX) / 2;
      ctx.beginPath();
      ctx.moveTo(mid - 12, 224); ctx.lineTo(mid + 12, 224);
      ctx.moveTo(mid, 212); ctx.lineTo(mid, 236);
      ctx.moveTo(mid - 7, 217); ctx.lineTo(mid + 7, 231);
      ctx.moveTo(mid + 7, 217); ctx.lineTo(mid - 7, 231);
      ctx.stroke(); ctx.restore();
    }
    if (!over && levelTransition <= 0 && !launches.some(l => l.owner === "player")) {
      const hand = handPoint("player", wolfFrame, wolfX, wolfY);
      drawGem(nextPlayer, hand.x, hand.y, 14, elapsed * .2);
    }
    if (!over && levelTransition <= 0 && !launches.some(l => l.owner === "ai")) {
      const hand = handPoint("ai", jimmyFrame, jimmyX, jimmyY);
      drawGem(nextAi, hand.x, hand.y, 13, -elapsed * .25);
    }
    for (const l of launches) {
      const pos = launchPosition(l);
      ctx.save(); ctx.lineCap = "round";
      for (let k = 4; k >= 1; k--) {
        const tail = launchPosition(l, l.t - k * .035);
        ctx.globalAlpha = .12 + (5 - k) * .09;
        ctx.strokeStyle = GEM_COLORS[l.level]; ctx.lineWidth = 2 + (5 - k) * 1.4;
        ctx.beginPath(); ctx.moveTo(tail.x, tail.y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
      }
      ctx.restore();
      drawGem(l.level, pos.x, pos.y, GEM_RADII[l.level] * (.68 + l.t * .32), l.t * 1.8);
    }
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
    event.preventDefault(); audio?.start(); pointerActive = true; aim = pointerX(event);
    if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", event => { if (event.pointerType === "mouse" || pointerActive) aim = pointerX(event); });
  canvas.addEventListener("pointerup", event => {
    event.preventDefault(); if (!pointerActive) return;
    const releaseFrame = actorFrame("player");
    pointerActive = false; aim = pointerX(event); playerDrop(releaseFrame);
  });
  canvas.addEventListener("pointercancel", () => { pointerActive = false; });
  window.addEventListener("keydown", event => {
    if (event.code === "Space" || event.key === "ArrowLeft" || event.key === "ArrowRight") audio?.start();
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault(); aim = clamp(aim + (event.key === "ArrowLeft" ? -22 : 22), 112, 328);
    } else if (event.code === "Space") { event.preventDefault(); playerDrop(); }
    else if (event.key.toLowerCase() === "r") reset();
  });
  document.querySelector("#restart").addEventListener("click", reset);
  document.querySelector("#again").addEventListener("click", reset);
  const soundButton = document.querySelector("#sound");
  function updateSoundButton() {
    if (!soundButton || !audio) return;
    soundButton.textContent = audio.enabled ? "♫" : "♪";
    soundButton.setAttribute("aria-label", audio.enabled ? "关闭声音" : "开启声音");
    soundButton.setAttribute("title", audio.enabled ? "关闭声音" : "开启声音");
    soundButton.setAttribute("aria-pressed", String(audio.enabled));
  }
  soundButton?.addEventListener("click", () => { audio?.toggle(); updateSoundButton(); });
  updateSoundButton();
  if (new URLSearchParams(location.search).has("debug")) {
    window.__dabaoshi = {setProgressForTest(value) {
      levelProgress = clamp(value, 0, levelTarget); updateLevelUI();
    }, setActorsForTest(playerX, aiX) {
      wolfX = playerX; aim = playerX + 13;
      jimmyX = aiX; aiTarget = aiX - 43;
    }, seedDangerGemForTest() {
      const g = makeGem(0, 220, 400, "test");
      g.touched = true; gems.push(g);
    }, snapshot: () => ({
      gems: gems.map(g => ({x: g.x, y: g.y, r: g.r, level: g.level, owner: g.owner})),
      launches: launches.map(l => ({owner: l.owner, level: l.level, t: l.t})),
      score, best, over, aiTimer, warningLevel, gemCount: GEM_FILES.length,
      level, levelProgress, levelTarget, levelTransition, wolfX, jimmyX, actorBumpFlash
    })};
  }
  reset(); requestAnimationFrame(frame);
})();
