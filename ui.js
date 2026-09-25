/* a3gent — interactions. No libraries; everything is short and fast.
 *
 *  - reveal:   elements with [data-reveal] slide up as they enter the viewport
 *  - spotlight: cards light up under the cursor (CSS vars --mx/--my)
 *  - hero:     the background gradient leans toward the pointer
 *  - counters: [data-count] numbers count up once, when seen
 *  - header:   scroll progress bar + compact header after scrolling
 *  - tilt:     solution screenshots tilt slightly toward the cursor
 *
 * All motion is off under prefers-reduced-motion, and every handler is
 * passive or rAF-throttled so scrolling never waits on script.
 */
(function () {
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var doc = document.documentElement;
  var fine = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* reveal ------------------------------------------------------------ */
  var items = document.querySelectorAll("[data-reveal]");
  if (reduce || !("IntersectionObserver" in window)) {
    items.forEach(function (el) { el.classList.add("in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
  }

  /* counters ---------------------------------------------------------- */
  var counters = document.querySelectorAll("[data-count]");
  function runCount(el) {
    var target = parseInt(el.getAttribute("data-count"), 10) || 0;
    if (reduce) { el.textContent = target; return; }
    var t0 = performance.now(), dur = 700;
    (function tick(now) {
      var p = Math.min(1, (now - t0) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * e);
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }
  if ("IntersectionObserver" in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        runCount(e.target); cio.unobserve(e.target);
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { cio.observe(el); });
  } else {
    counters.forEach(runCount);
  }

  /* header progress + compact --------------------------------------- */
  var bar = document.querySelector(".progress");
  var header = document.querySelector(".site-header");
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var max = doc.scrollHeight - window.innerHeight;
      if (bar) bar.style.transform = "scaleX(" + (max > 0 ? window.scrollY / max : 0) + ")";
      if (header) header.classList.toggle("compact", window.scrollY > 24);
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (reduce || !fine) return;

  /* spotlight cards ---------------------------------------------------- */
  document.querySelectorAll(".spot").forEach(function (card) {
    card.addEventListener("pointermove", function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty("--mx", (e.clientX - r.left) + "px");
      card.style.setProperty("--my", (e.clientY - r.top) + "px");
    }, { passive: true });
  });

  /* tilt on the solution screenshots ---------------------------------- */
  document.querySelectorAll(".shot").forEach(function (shot) {
    var frame = shot.closest(".solution") || shot;
    frame.addEventListener("pointermove", function (e) {
      var r = frame.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      shot.style.transform = "perspective(900px) rotateX(" + (-y * 5).toFixed(2) + "deg) rotateY(" + (x * 7).toFixed(2) + "deg) translateY(-4px)";
    }, { passive: true });
    frame.addEventListener("pointerleave", function () { shot.style.transform = ""; });
  });
})();

/* card slideshows --------------------------------------------------- */
(function () {
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll("[data-slides]").forEach(function (box) {
    var slides = box.querySelectorAll(".slide"), dots = box.querySelectorAll(".dot");
    if (slides.length < 2) return;
    var i = 0, timer = 0;
    function show(n) {
      slides[i].classList.remove("is-on"); dots[i].classList.remove("is-on");
      i = (n + slides.length) % slides.length;
      slides[i].classList.add("is-on"); dots[i].classList.add("is-on");
    }
    function start() { if (reduce || timer) return; timer = setInterval(function () { show(i + 1); }, 3200); }
    function stop() { clearInterval(timer); timer = 0; }
    dots.forEach(function (d, n) { d.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); show(n); stop(); start(); }); });
    box.addEventListener("pointerenter", stop);
    box.addEventListener("pointerleave", start);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) { es[0].isIntersecting ? start() : stop(); }, { threshold: 0.2 }).observe(box);
    } else start();
  });
})();

/* inquiry modal ---------------------------------------------------------
 * <dialog> does the focus trap and Esc; this wires the openers, posts the
 * form as JSON, and swaps in the "received" panel. The API path follows the
 * page: /api/inquiry on a3gent.com, /a3gent/api/inquiry on the interim
 * mohazi.com path — Caddy proxies both to the same route.
 */
(function () {
  var dlg = document.getElementById("inquiry");
  if (!dlg || typeof dlg.showModal !== "function") return;
  var form = dlg.querySelector("form");
  var done = dlg.querySelector(".inquiry-done");
  var status = form.querySelector(".inquiry-status");
  var submit = form.querySelector('button[type="submit"]');
  var lang = form.getAttribute("data-lang") || "ko";
  var MIN = 200;
  var T = {
    ko: { sending: "보내는 중…", invalid: "필수 항목을 확인해 주세요.", short: "문의 내용을 200자 이상 작성해 주세요.", rejected: "문의 내용을 접수할 수 없습니다. 구체적인 과제와 시스템 내용을 담아 다시 작성해 주세요.", rate: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.", error: "전송에 실패했습니다. 잠시 후 다시 시도해 주세요." },
    en: { sending: "Sending…", invalid: "Please check the required fields.", short: "Please write at least 200 characters.", rejected: "This inquiry could not be accepted. Please describe your actual problem and systems.", rate: "Too many requests. Please try again shortly.", error: "Could not send. Please try again shortly." }
  }[lang];

  // Live character count on the message; the send button stays off until
  // the minimum is met (the server enforces the same minimum).
  var msg = form.elements.message, counter = form.querySelector(".inquiry-count"), countNum = counter && counter.querySelector("b");
  function updateCount() {
    var n = msg.value.trim().length;
    if (countNum) countNum.textContent = n;
    if (counter) { counter.classList.toggle("ok", n >= MIN); counter.classList.toggle("short", n > 0 && n < MIN); }
    submit.disabled = n < MIN;
  }
  msg.addEventListener("input", updateCount);
  updateCount();
  var API = (location.pathname.indexOf("/a3gent/") === 0 ? "/a3gent" : "") + "/api/inquiry";

  var opening = false;
  function reveal() {
    opening = false;
    dlg.showModal();
    var first = form.querySelector('input[name="name"]');
    if (first) first.focus();
  }
  // Where the dialog will land, measured before it opens: lay it out
  // hidden (display overrides the UA's display:none for a closed dialog —
  // show() would move focus and scroll the page) to read its size, then
  // centre that in the viewport, which is where showModal() puts it.
  function landing() {
    dlg.style.cssText = "visibility:hidden;display:block;position:fixed;inset:0;margin:auto";
    var r = dlg.getBoundingClientRect();
    var w = r.width, h = Math.min(r.height, window.innerHeight - 32);
    var box = { x: (window.innerWidth - w) / 2, y: (window.innerHeight - h) / 2, w: w, h: h, fields: [] };
    // The fields too, in the order they will be sketched, shifted from
    // the hidden layout to where the open dialog will be.
    var dx = box.x - r.left, dy = box.y - r.top;
    form.querySelectorAll('input:not([type="checkbox"]):not([name="website"]), textarea, .inquiry-actions .btn').forEach(function (el) {
      var f = el.getBoundingClientRect();
      if (!f.width) return;
      box.fields.push({ x: f.left + dx, y: f.top + dy, w: f.width, h: f.height, r: el.classList.contains("btn") ? f.height / 2 : 10 });
    });
    dlg.style.cssText = "";
    return box;
  }
  function open(src) {
    if (opening || dlg.open) return;
    form.hidden = false; done.hidden = true;
    status.textContent = ""; status.classList.remove("is-error");
    // laser.js, when loaded, sketches the dialog with a beam first (see there).
    if (window.a3Laser && src) { opening = true; window.a3Laser(src, landing(), reveal); }
    else reveal();
  }
  document.querySelectorAll("[data-inquiry]").forEach(function (el) {
    el.addEventListener("click", function (e) { e.preventDefault(); open(el); });
  });
  dlg.querySelectorAll("[data-inquiry-close]").forEach(function (el) {
    el.addEventListener("click", function () { dlg.close(); });
  });
  // A click on the backdrop lands on the dialog element itself; anything
  // inside lands on the form or the done panel.
  dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (msg.value.trim().length < MIN) {
      status.textContent = T.short; status.classList.add("is-error"); msg.focus();
      return;
    }
    if (!form.checkValidity()) {
      form.reportValidity();
      status.textContent = T.invalid; status.classList.add("is-error");
      return;
    }
    var f = form.elements;
    var data = {
      name: f.name.value, company: f.company.value, email: f.email.value, phone: f.phone.value,
      message: f.message.value, website: f.website.value, consent: f.consent.checked, lang: lang
    };
    submit.disabled = true;
    status.textContent = T.sending; status.classList.remove("is-error");
    fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
      .then(function (res) {
        if (res.status === 429) throw new Error("rate");
        if (res.status === 400) return res.json().then(function (j) { throw new Error(j && j.error === "message_short" ? "short" : "rejected"); });
        if (!res.ok) throw new Error("bad");
        form.reset(); status.textContent = ""; updateCount();
        form.hidden = true; done.hidden = false;
        var close = done.querySelector("button"); if (close) close.focus();
      })
      .catch(function (err) {
        var m = err && err.message;
        status.textContent = m === "rate" ? T.rate : m === "short" ? T.short : m === "rejected" ? T.rejected : T.error;
        status.classList.add("is-error");
      })
      .then(function () { submit.disabled = false; });
  });
})();
