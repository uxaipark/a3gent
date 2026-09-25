/* a3gent — hero spotlight.
 *
 * A stage light hung above the hero, aimed wherever the pointer is. Three
 * things sell the depth: a perspective floor grid that only shows where the
 * light lands, a soft cone from the lamp down to that spot, and a hotspot
 * ellipse that flattens with distance the way a real pool of light does.
 * The light eases toward the pointer rather than snapping, and with no
 * pointer (touch, idle) it drifts on a slow sweep so the hero never sits
 * dead.
 *
 * Plain 2D canvas, a handful of gradients per frame. Stops when the hero is
 * off screen or the tab is hidden; draws one still frame under reduced
 * motion. Sits under the copy (z-index 0) and takes no pointer events.
 */
(function () {
  var hero = document.querySelector(".hero");
  var canvas = hero && hero.querySelector(".hero-spot");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  var W = 0, H = 0, dpr = 1;
  var horizon = 0.34;             // vanishing line, as a fraction of height
  var lamp = { x: 0.5, y: -0.08 }; // where the beam comes from (fractions)
  var target = { x: 0.68, y: 0.72 }, light = { x: 0.68, y: 0.72 };
  var hasPointer = false, lastMove = 0;

  // The 01/02/03 cards under the copy react to the light: as the pool
  // nears a card it lifts, a highlight lands on its face where the light
  // hits, and it throws a shadow away from the light — all through CSS
  // custom properties set here per frame (see .path a in style.css).
  var cards = [].slice.call(hero.querySelectorAll(".path a")).map(function (el) {
    return { el: el, lit: -1, sx: 0, sy: 0 };
  });
  // The shadow itself is painted on the floor: from each lit card's bottom
  // edge a dark wedge runs forward, widening the way the lamp behind the
  // stage would project it, and dims the grid it falls on.
  function drawCardShadows() {
    var lx = lamp.x * W, ly = lamp.y * H;
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i], lit = c.litNow || 0;
      if (lit < 0.02 || !c.w) continue;
      var y0 = c.top + c.h, len = 50 + 150 * lit;
      var x0 = c.left, x1 = c.left + c.w;
      // Project the two bottom corners forward along rays from the lamp.
      var k = (y0 + len - ly) / (y0 - ly);
      var px0 = lx + (x0 - lx) * k, px1 = lx + (x1 - lx) * k;
      var grad = ctx.createLinearGradient(0, y0, 0, y0 + len);
      grad.addColorStop(0, "rgba(0,0,0," + (0.8 * lit).toFixed(3) + ")");
      grad.addColorStop(0.45, "rgba(0,0,0," + (0.45 * lit).toFixed(3) + ")");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x0 + 2, y0 - 2); ctx.lineTo(x1 - 2, y0 - 2);
      ctx.lineTo(px1, y0 + len); ctx.lineTo(px0, y0 + len);
      ctx.closePath(); ctx.fill();
    }
  }

  function lightCards(cx, cy, reach) {
    var hr = hero.getBoundingClientRect();
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i], r = c.el.getBoundingClientRect();
      var left = r.left - hr.left, top = r.top - hr.top;
      var ccx = left + r.width / 2, ccy = top + r.height / 2;
      c.left = left; c.top = top; c.w = r.width; c.h = r.height;
      var dx = ccx - cx, dy = ccy - cy, dist = Math.hypot(dx, dy) || 1;
      // Falls off from the centre of the pool to about 1.5× its reach.
      var u = Math.max(0, Math.min(1, 1 - dist / (reach * 1.5)));
      var lit = u * u * (3 - 2 * u);
      // The lamp hangs behind and above the stage, so a lit card throws its
      // shadow forward — down the screen, toward the viewer — and slightly
      // outward from the lamp's line, longer the brighter it is lit.
      var sx = (ccx - lamp.x * W) / W * 36 * lit, sy = 8 + 40 * lit;
      c.litNow = lit;
      if (Math.abs(lit - c.lit) < 0.004 && Math.abs(sx - c.sx) < 0.5 && Math.abs(sy - c.sy) < 0.5) continue;
      c.lit = lit; c.sx = sx; c.sy = sy;
      var st = c.el.style;
      st.setProperty("--lit", lit.toFixed(3));
      st.setProperty("--sx", sx.toFixed(1) + "px");
      st.setProperty("--sy", sy.toFixed(1) + "px");
      st.setProperty("--lx", Math.max(-40, Math.min(140, (cx - left) / r.width * 100)).toFixed(1) + "%");
      st.setProperty("--ly", "-30%");   // light strikes the card's top edge
      st.setProperty("--z", lit > 0.05 ? 2 : 1);
    }
  }

  function resize() {
    var r = hero.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    floorDim = floorLit = null; // rebuilt on the next frame at the new size
  }

  // Perspective: how much a floor feature shrinks as it nears the horizon.
  function depthScale(y) { return Math.max(0.12, (y - horizon * H) / (H - horizon * H)); }

  // The floor: a perspective grid that runs edge to edge, from the horizon
  // to the bottom, dense near the horizon. Drawn twice — faint everywhere so
  // the floor is always there, then again brighter inside the pool of light.
  // The floor is a real plane, projected: a camera one unit above it, looking
  // straight ahead, with the horizon at `horizon`. A floor point (x, z) lands
  // at  sx = W/2 + F·x/z,  sy = hy + F/z  — so lines of constant x run to the
  // vanishing point, lines of constant z are full-width horizontals whose
  // spacing shrinks with 1/z.
  //
  // Both families are generated until they merge: horizontals until the next
  // row is under 1.2px closer, constant-x lines until the next one enters the
  // side of the screen under 1.5px nearer the horizon. Out at the sides that
  // takes thousands of lines — a plane really does have that many between
  // you and the horizon — and where they overlap they build up into the haze
  // a distant grid actually has. So the grid is rendered ONCE per size into
  // two offscreen layers (faint everywhere / bright under the light); each
  // frame just composites them. That is what keeps thousands of lines cheap.
  var floorDim = null, floorLit = null;
  function buildFloor() {
    var hy = horizon * H;
    var F = (H + 80) - hy;          // puts z = 1 at the bottom edge (+80 overscan)
    var step = 0.085;               // grid pitch, in floor units
    var minor = [], major = [];

    // constant-x lines, outward from the centre until they merge at the edge
    var edgeDist = function (x0) { return F * (W / 2) / Math.max(1e-6, Math.abs(x0 - W / 2)); };
    for (var k = 0; k < 6000; k++) {
      var x0 = W / 2 + F * k * step;
      if (k > 0 && Math.abs(x0 - W / 2) > W && edgeDist(x0) < 1.5) break;
      var list = (k % 5 === 0 ? major : minor);
      list.push([x0, H + 80, W / 2, hy]);
      if (k) list.push([W - x0, H + 80, W / 2, hy]);
    }
    // constant-z rows, marching away until they merge
    var prev = Infinity;
    for (var m = 0; m < 6000; m++) {
      var z = 1 + m * step, sy = hy + F / z;
      if (prev - sy < 1.2) break;
      prev = sy;
      var y = Math.round(sy) + 0.5;
      (m % 5 === 0 ? major : minor).push([0, y, W, y]);
    }

    function layer(alphaMinor, alphaMajor, fadeTop) {
      var c = document.createElement("canvas");
      c.width = W * dpr; c.height = H * dpr;
      var g = c.getContext("2d");
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.lineWidth = 1;
      g.strokeStyle = "rgba(150, 182, 255, " + alphaMinor + ")"; strokeLines(g, minor);
      g.strokeStyle = "rgba(170, 200, 255, " + alphaMajor + ")"; strokeLines(g, major);
      if (fadeTop) {
        // dissolve into the distance just under the horizon
        var fade = g.createLinearGradient(0, hy, 0, hy + (H - hy) * 0.3);
        fade.addColorStop(0, "rgba(0,0,0,0.15)"); fade.addColorStop(1, "rgba(0,0,0,1)");
        g.globalCompositeOperation = "destination-in";
        g.fillStyle = fade; g.fillRect(0, 0, W, H);
      }
      return c;
    }
    floorDim = layer(0.16, 0.30, true);
    floorLit = layer(0.5, 0.85, false);
    floorDim.hy = hy;
  }
  function strokeLines(g, lines) {
    g.beginPath();
    for (var i = 0; i < lines.length; i++) { var l = lines[i]; g.moveTo(l[0], l[1]); g.lineTo(l[2], l[3]); }
    g.stroke();
  }
  function drawFloor(cx, cy, reach) {
    if (!floorDim) buildFloor();
    ctx.drawImage(floorDim, 0, 0, W, H);
    ctx.save();
    ctx.beginPath(); ctx.ellipse(cx, cy, reach, reach * 0.42, 0, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(floorLit, 0, 0, W, H);
    ctx.restore();
    var hy = Math.round(floorDim.hy) + 0.5;
    ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(W, hy);
    ctx.strokeStyle = "rgba(170, 200, 255, 0.28)"; ctx.lineWidth = 1; ctx.stroke();
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    var lx = lamp.x * W, ly = lamp.y * H;
    var cx = light.x * W, cy = Math.max(horizon * H + 20, light.y * H);
    var s = depthScale(cy);
    var reach = (160 + 200 * s) * (W / 1440 + 0.35);

    // 1. the floor, with the pool lighting part of it
    drawFloor(cx, cy, reach * 1.05);
    lightCards(cx, cy, reach);
    drawCardShadows();

    // 2. the cone: lamp → pool, widening on the way down, soft-edged
    var half = reach * 0.92;
    for (var pass = 0; pass < 3; pass++) {
      var spread = half * (1 + pass * 0.28);
      var g = ctx.createLinearGradient(lx, ly, cx, cy);
      g.addColorStop(0, "rgba(160, 190, 255, " + (0.2 - pass * 0.055) + ")");
      g.addColorStop(0.55, "rgba(140, 175, 255, " + (0.06 - pass * 0.015) + ")");
      g.addColorStop(1, "rgba(120, 160, 255, 0)");
      ctx.beginPath();
      ctx.moveTo(lx - 14, ly);
      ctx.lineTo(cx - spread, cy);
      ctx.lineTo(cx + spread, cy);
      ctx.lineTo(lx + 14, ly);
      ctx.closePath();
      ctx.fillStyle = g;
      ctx.fill();
    }

    // 3. the pool itself: an ellipse flattened by perspective, with a hot core
    var pool = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach);
    pool.addColorStop(0, "rgba(200, 220, 255, 0.46)");
    pool.addColorStop(0.35, "rgba(150, 185, 255, 0.22)");
    pool.addColorStop(1, "rgba(120, 160, 255, 0)");
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(1, 0.42); ctx.translate(-cx, -cy);
    ctx.fillStyle = pool;
    ctx.beginPath(); ctx.arc(cx, cy, reach, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // 4. the lamp: a small glow at the source so the beam has somewhere to come from
    var src = ctx.createRadialGradient(lx, Math.max(ly, 0), 0, lx, Math.max(ly, 0), 90);
    src.addColorStop(0, "rgba(220, 232, 255, 0.28)");
    src.addColorStop(1, "rgba(220, 232, 255, 0)");
    ctx.fillStyle = src;
    ctx.beginPath(); ctx.arc(lx, Math.max(ly, 0), 90, 0, Math.PI * 2); ctx.fill();
  }

  var raf = 0, running = false, t0 = 0;
  function frame(now) {
    if (!t0) t0 = now;
    var t = (now - t0) / 1000;
    // No pointer for a while: drift on a slow figure so the light keeps living.
    if (!hasPointer || now - lastMove > 4000) {
      target.x = 0.62 + 0.22 * Math.sin(t * 0.35);
      target.y = 0.74;
    }
    light.x += (target.x - light.x) * 0.08;
    light.y += (target.y - light.y) * 0.08;
    render();
    raf = requestAnimationFrame(frame);
  }
  function start() { if (running || reduce) return; running = true; raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  if (fine) {
    hero.addEventListener("pointermove", function (e) {
      var r = hero.getBoundingClientRect();
      target.x = (e.clientX - r.left) / r.width;
      target.y = (e.clientY - r.top) / r.height;
      hasPointer = true; lastMove = performance.now();
    }, { passive: true });
    hero.addEventListener("pointerleave", function () { hasPointer = false; });
  }

  resize(); render();
  var visible = true;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; visible && !document.hidden ? start() : stop(); }).observe(hero);
  }
  document.addEventListener("visibilitychange", function () { document.hidden || !visible ? stop() : start(); });
  var rt = 0;
  window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { resize(); render(); }, 120); });
  start();
})();
