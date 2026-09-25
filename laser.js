/* a3gent — laser transition for the inquiry dialog.
 *
 * On "문의 남기기" a beam shoots from the button to the nearest corner of
 * where the dialog will open, traces its rounded outline, hops to each
 * input field in turn and sketches it, then the interior fills with a
 * sweep of light; the dialog fades in over the finished drawing. ~1.6s.
 *
 * Entirely optional: ui.js calls window.a3Laser when it exists and opens
 * the dialog directly when it doesn't — to remove the effect, delete this
 * file's <script> tag. Off under prefers-reduced-motion.
 */
(function () {
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function easeIn(t) { return t * t * t; }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  // A rounded rectangle as a dense closed polyline starting at the point
  // nearest `from`, with cumulative lengths so it can be drawn up to any
  // distance along it.
  function outline(rect, radius, from) {
    var r = Math.min(radius, rect.w / 2, rect.h / 2), pts = [];
    function arc(cx, cy, a0, a1) {
      var n = 8;
      for (var i = 0; i <= n; i++) { var a = a0 + (a1 - a0) * i / n; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    }
    var x = rect.x, y = rect.y, w = rect.w, h = rect.h, PI = Math.PI;
    arc(x + w - r, y + r, -PI / 2, 0);
    arc(x + w - r, y + h - r, 0, PI / 2);
    arc(x + r, y + h - r, PI / 2, PI);
    arc(x + r, y + r, PI, PI * 1.5);
    var best = 0, bd = Infinity;
    for (var i = 0; i < pts.length; i++) {
      var d = Math.hypot(pts[i][0] - from[0], pts[i][1] - from[1]);
      if (d < bd) { bd = d; best = i; }
    }
    var rot = pts.slice(best).concat(pts.slice(0, best));
    rot.push(rot[0]);
    var len = [0];
    for (var k = 1; k < rot.length; k++) len.push(len[k - 1] + Math.hypot(rot[k][0] - rot[k - 1][0], rot[k][1] - rot[k - 1][1]));
    return { pts: rot, len: len, total: len[len.length - 1] };
  }

  function at(path, s) {
    var L = path.len, P = path.pts;
    if (s <= 0) return P[0];
    if (s >= path.total) return P[P.length - 1];
    var lo = 0, hi = L.length - 1;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (L[mid] <= s) lo = mid; else hi = mid; }
    var f = (s - L[lo]) / (L[hi] - L[lo] || 1);
    return [P[lo][0] + (P[hi][0] - P[lo][0]) * f, P[lo][1] + (P[hi][1] - P[lo][1]) * f];
  }

  function tracePath(g, path, s1) {
    g.beginPath(); g.moveTo(path.pts[0][0], path.pts[0][1]);
    for (var i = 1; i < path.pts.length; i++) {
      if (path.len[i] >= s1) break;
      g.lineTo(path.pts[i][0], path.pts[i][1]);
    }
    var b = at(path, s1);
    g.lineTo(b[0], b[1]);
  }

  function roundRect(g, r) {
    var rad = Math.min(r.r, r.w / 2, r.h / 2);
    g.beginPath();
    g.moveTo(r.x + rad, r.y);
    g.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, rad);
    g.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, rad);
    g.arcTo(r.x, r.y + r.h, r.x, r.y, rad);
    g.arcTo(r.x, r.y, r.x + r.w, r.y, rad);
    g.closePath();
  }

  /**
   * from:   element the beam leaves (the button)
   * target: {x, y, w, h, fields: [{x, y, w, h, r}]} in viewport px
   * done:   called when the sketch is complete; open the dialog here
   */
  window.a3Laser = function (from, target, done) {
    if (reduce || !from || !target) { done(); return; }

    var W = window.innerWidth, H = window.innerHeight;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var cv = document.createElement("canvas");
    cv.className = "fx-overlay";
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + "px"; cv.style.height = H + "px";
    document.body.appendChild(cv);
    var g = cv.getContext("2d");
    g.scale(dpr, dpr);

    var b = from.getBoundingClientRect();
    var src = [b.left + b.width / 2, b.top + b.height / 2];
    var rect = { x: target.x, y: target.y, w: target.w, h: target.h, r: 14 };

    /* the route: beam → outline → hop → field → hop → field … --------- */
    // Every segment is either a persistent trace (a rounded rect drawn
    // from its nearest point) or a hop (a flying streak between shapes).
    // One head travels the whole route at a constant speed, so the timing
    // follows naturally from the geometry.
    var segs = [], cursor = src;
    function addTrace(shape, radius) {
      var path = outline(shape, radius, cursor);
      var hopLen = Math.hypot(path.pts[0][0] - cursor[0], path.pts[0][1] - cursor[1]);
      segs.push({ hop: true, a: cursor, b: path.pts[0], len: hopLen });
      segs.push({ hop: false, path: path, len: path.total });
      cursor = path.pts[path.pts.length - 1];
    }
    addTrace(rect, rect.r);
    (target.fields || []).forEach(function (f) { addTrace(f, f.r || 10); });
    // Hops are short in distance but should read as instant jumps: the
    // head's speed along a hop is much higher than along a trace.
    var HOP_SPEED = 3.5, route = 0;
    segs.forEach(function (s) { s.start = route; s.span = s.hop ? s.len / HOP_SPEED : s.len; route += s.span; });

    var GLOW = "47,107,255", CORE = "255,255,255";

    // Timeline as fractions of DUR: the head runs the route, then the fill.
    var DUR = (window.A3_FX_DUR || 1600) / 1000;
    var RUN = [0, 0.8], FILL = [0.76, 0.96];
    var manual = !!window.A3_FX_STEP;
    var t0 = manual ? 0 : performance.now(), finished = false;
    var sparks = [], lastHead = null;

    function phase(t, span) { return clamp((t - span[0]) / (span[1] - span[0]), 0, 1); }

    function streak(x0, y0, x1, y1, width, alpha) {
      g.lineCap = "round";
      g.strokeStyle = "rgba(" + GLOW + "," + (alpha * 0.5).toFixed(3) + ")"; g.lineWidth = width * 4;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.strokeStyle = "rgba(" + GLOW + "," + alpha.toFixed(3) + ")"; g.lineWidth = width * 1.6;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.strokeStyle = "rgba(" + CORE + "," + alpha.toFixed(3) + ")"; g.lineWidth = width * 0.6;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    }

    function head(x, y, size, alpha) {
      var grad = g.createRadialGradient(x, y, 0, x, y, size);
      grad.addColorStop(0, "rgba(" + CORE + "," + alpha + ")");
      grad.addColorStop(0.25, "rgba(" + GLOW + "," + (alpha * 0.8).toFixed(3) + ")");
      grad.addColorStop(1, "rgba(" + GLOW + ",0)");
      g.fillStyle = grad;
      g.beginPath(); g.arc(x, y, size, 0, Math.PI * 2); g.fill();
    }

    // A traced shape: wide glow, blue line, white core — drawn up to s.
    function drawTrace(path, s, alpha) {
      g.lineCap = "round"; g.lineJoin = "round";
      g.strokeStyle = "rgba(" + GLOW + "," + (0.32 * alpha).toFixed(3) + ")"; g.lineWidth = 9; tracePath(g, path, s); g.stroke();
      g.strokeStyle = "rgba(" + GLOW + "," + (0.9 * alpha).toFixed(3) + ")"; g.lineWidth = 2.6; tracePath(g, path, s); g.stroke();
      g.strokeStyle = "rgba(" + CORE + "," + (0.95 * alpha).toFixed(3) + ")"; g.lineWidth = 1.1; tracePath(g, path, s); g.stroke();
    }

    function frame(now) {
      if (finished) return;
      var t = Math.min(1, (now - t0) / 1000 / DUR);
      g.clearRect(0, 0, W, H);

      // Page dims to the level of the dialog's backdrop, so the hand-over
      // to the real backdrop is invisible.
      g.fillStyle = "rgba(11,18,32," + (0.55 * Math.min(1, t / 0.25)).toFixed(3) + ")";
      g.fillRect(0, 0, W, H);

      var pf = phase(t, FILL);
      var settle = 1 - pf * 0.45;        // the sketch dims a little as the fill comes

      /* fill: a sweep of light across the interior, under the sketch */
      if (pf > 0) {
        g.save();
        roundRect(g, rect); g.clip();
        var e = easeInOut(pf), diag = rect.w + rect.h, edge = (rect.x + rect.y) + diag * e;
        g.fillStyle = "rgba(255,255,255," + (0.97 * Math.min(1, pf * 1.5)).toFixed(3) + ")";
        g.beginPath(); g.moveTo(rect.x - 1, rect.y - 1);
        g.lineTo(edge - rect.y, rect.y - 1); g.lineTo(rect.x - 1, edge - rect.x); g.closePath(); g.fill();
        if (pf < 1) {
          var lg = g.createLinearGradient(edge - rect.y - 60, rect.y - 60, edge - rect.y, rect.y);
          lg.addColorStop(0, "rgba(" + GLOW + ",0)");
          lg.addColorStop(0.7, "rgba(" + GLOW + ",0.55)");
          lg.addColorStop(1, "rgba(" + CORE + ",0.95)");
          g.strokeStyle = lg; g.lineWidth = 6;
          g.beginPath(); g.moveTo(edge - rect.y, rect.y - 1); g.lineTo(rect.x - 1, edge - rect.x); g.stroke();
        }
        g.restore();
      }

      /* the head runs the route; traces persist, hops are streaks */
      var pos = route * easeInOut(phase(t, RUN));
      var headXY = null;
      for (var i = 0; i < segs.length; i++) {
        var s = segs[i];
        if (pos <= s.start) break;
        var local = Math.min(1, (pos - s.start) / s.span);
        if (s.hop) {
          if (local < 1) {
            var hx = s.a[0] + (s.b[0] - s.a[0]) * local, hy = s.a[1] + (s.b[1] - s.a[1]) * local;
            var tail = Math.max(0, local - 0.5);
            streak(s.a[0] + (s.b[0] - s.a[0]) * tail, s.a[1] + (s.b[1] - s.a[1]) * tail, hx, hy, 2.2, 1);
            headXY = [hx, hy];
          } else if (i === 0 && pos - s.start < s.span * 3) {
            // The launch streak lingers a moment after landing.
            var linger = 1 - (pos - s.start - s.span) / (s.span * 2);
            streak(s.a[0] + (s.b[0] - s.a[0]) * 0.5, s.a[1] + (s.b[1] - s.a[1]) * 0.5, s.b[0], s.b[1], 2.2, Math.max(0, linger));
          }
        } else {
          var drawn = s.len * local;
          drawTrace(s.path, drawn, settle);
          if (local < 1) {
            var hot = at(s.path, drawn), back = at(s.path, Math.max(0, drawn - 50));
            streak(back[0], back[1], hot[0], hot[1], 2.4, 1);
            headXY = hot;
          }
        }
      }
      if (headXY) {
        head(headXY[0], headXY[1], 15, 1);
        // Sparks fly off the head as it cuts.
        if (sparks.length < 70 && Math.random() < 0.7) {
          var a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 160;
          sparks.push({ x: headXY[0], y: headXY[1], vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, born: t });
        }
        lastHead = headXY;
      }
      // The launch point glows and fades as the beam leaves.
      var launch = 1 - clamp(pos / (segs[0].span * 1.5), 0, 1);
      if (launch > 0) head(src[0], src[1], 14 * launch, launch);

      for (var k = sparks.length - 1; k >= 0; k--) {
        var sk = sparks[k], age = (t - sk.born) * DUR;
        var life = 1 - age / 0.35;
        if (life <= 0) { sparks.splice(k, 1); continue; }
        g.fillStyle = "rgba(" + CORE + "," + (life * 0.9).toFixed(3) + ")";
        g.beginPath(); g.arc(sk.x + sk.vx * age, sk.y + sk.vy * age + 120 * age * age, 1.4, 0, Math.PI * 2); g.fill();
      }

      if (t < 1) { if (!manual) requestAnimationFrame(frame); return; }
      finished = true;
      done();
      cv.classList.add("out");
      setTimeout(function () { cv.remove(); }, 320);
    }

    if (manual) window.a3FxStep = frame;
    else requestAnimationFrame(frame);
  };
})();
