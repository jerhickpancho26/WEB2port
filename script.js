/* ==========================================================================
   Portfolio interactions (vanilla JS, no dependencies)
   Every effect is an enhancement: with JS or animation off, all content
   and controls remain available.
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  var mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var mqFine = window.matchMedia("(hover: hover) and (pointer: fine)");
  var motionOK = function () { return !mqReduce.matches; };

  /* ------------------------------------------------------------------
     1. Loading screen (short; never blocks longer than ~2s)
     ------------------------------------------------------------------ */
  (function loader() {
    var el = $("#loader");
    if (!el) return;
    var bar = $("#loaderBar"), pct = $("#loaderPct");
    var start = performance.now(), DURATION = 800, loaded = false, done = false, raf;

    function hide() {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      el.classList.add("is-hidden");
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 500);
    }
    function step(now) {
      var p = Math.min(1, (now - start) / DURATION);
      var shown = loaded ? p : Math.min(p, 0.95);
      bar.style.transform = "scaleX(" + shown + ")";
      pct.textContent = Math.round(shown * 100) + "%";
      if (loaded && p >= 1) { hide(); return; }
      raf = requestAnimationFrame(step);
    }

    if (!motionOK()) { hide(); return; } // simpler experience: no loading animation
    raf = requestAnimationFrame(step);
    if (document.readyState === "complete") { loaded = true; }
    else { window.addEventListener("load", function () { loaded = true; }); }

    setTimeout(hide, 2000); // safety net
    ["keydown", "pointerdown"].forEach(function (t) { window.addEventListener(t, hide, { once: true }); });
  })();

  /* ------------------------------------------------------------------
     2. Theme toggle (remembers choice; defaults to OS preference)
     ------------------------------------------------------------------ */
  var themeBtn = $("#themeToggle"), themeIcon = $("#themeIcon"), themeLabel = $("#themeLabel");
  var onThemeChange = [];

  function syncThemeUI() {
    var isDark = root.getAttribute("data-theme") !== "light";
    // The button describes the action it will perform.
    themeBtn.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
    themeLabel.textContent = isDark ? "Light" : "Dark";
    themeIcon.className = "fa-solid " + (isDark ? "fa-sun" : "fa-moon");
  }
  if (themeBtn) {
    syncThemeUI();
    themeBtn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
      syncThemeUI();
      onThemeChange.forEach(function (fn) { fn(); });
    });
  }

  /* ------------------------------------------------------------------
     3. Header state, scroll progress, back-to-top (one throttled handler)
     ------------------------------------------------------------------ */
  var header = $("#siteHeader"), progress = $("#scrollProgress"), backTop = $("#backToTop");
  var ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.scrollY || root.scrollTop;
      var max = root.scrollHeight - window.innerHeight;
      header.classList.toggle("is-scrolled", y > 24);
      progress.style.transform = "scaleX(" + (max > 0 ? Math.min(1, y / max) : 0) + ")";
      backTop.classList.toggle("is-visible", y > 520);
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();

  backTop.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: motionOK() ? "smooth" : "auto" });
    // Move focus somewhere visible so keyboard users are not left on a hidden button
    var brand = $("#brandLink");
    if (brand) brand.focus({ preventScroll: true });
  });

  /* ------------------------------------------------------------------
     4. Mobile navigation
     ------------------------------------------------------------------ */
  var navToggle = $("#navToggle"), nav = $("#primaryNav");
  function closeNav(returnFocus) {
    nav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
    if (returnFocus) navToggle.focus();
  }
  navToggle.addEventListener("click", function () {
    var open = nav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(open));
  });
  $$(".nav-link", nav).forEach(function (a) { a.addEventListener("click", function () { closeNav(false); }); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && nav.classList.contains("is-open")) closeNav(true);
  });

  /* ------------------------------------------------------------------
     5. Active section in the navigation
     ------------------------------------------------------------------ */
  var navLinks = $$(".nav-link");
  if ("IntersectionObserver" in window) {
    var navIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = entry.target.id;
        navLinks.forEach(function (link) {
          var match = link.getAttribute("href") === "#" + id;
          link.classList.toggle("is-active", match);
          if (match) link.setAttribute("aria-current", "true"); else link.removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    $$("main > section[id]").filter(function (s) { return $('.nav-link[href="#' + s.id + '"]'); }).forEach(function (s) { navIO.observe(s); });
  }

  /* ------------------------------------------------------------------
     6. Scroll reveal + timeline line (IntersectionObserver)
     ------------------------------------------------------------------ */
  var revealTargets = $$("[data-reveal], #timeline");
  if ("IntersectionObserver" in window) {
    var revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-inview");
          revealIO.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    revealTargets.forEach(function (el) { revealIO.observe(el); });
  } else {
    revealTargets.forEach(function (el) { el.classList.add("is-inview"); });
  }

  /* ------------------------------------------------------------------
     7. Animated hero text: typing effect (static text is the default)
     ------------------------------------------------------------------ */
  (function typed() {
    var el = $("#typed");
    if (!el) return;
    var roles = ["BACHELOR OF SCIENCE", "IN COMPUTER SCIENCE", "3rd YEAR STUDENT"];
    var staticText = roles.join(" · ");
    var ri = 0, ci = 0, deleting = false, timer = null;

    function tick() {
      if (!motionOK()) { el.textContent = staticText; return; }
      var word = roles[ri];
      if (!deleting) {
        ci++; el.textContent = word.slice(0, ci);
        if (ci === word.length) { deleting = true; timer = setTimeout(tick, 1700); return; }
        timer = setTimeout(tick, 70);
      } else {
        ci--; el.textContent = word.slice(0, ci);
        if (ci === 0) { deleting = false; ri = (ri + 1) % roles.length; timer = setTimeout(tick, 350); return; }
        timer = setTimeout(tick, 35);
      }
    }
    function begin() {
      clearTimeout(timer);
      if (motionOK()) { ri = 0; ci = 0; deleting = false; el.textContent = ""; timer = setTimeout(tick, 900); }
      else { el.textContent = staticText; }
    }
    begin();
    mqReduce.addEventListener ? mqReduce.addEventListener("change", begin) : mqReduce.addListener(begin);
  })();

  /* ------------------------------------------------------------------
     8. Page-wide background: particles, connecting lines, cursor glow,
        parallax. One fixed layer shared by every section.
        - one requestAnimationFrame loop
        - paused when the tab is hidden
        - completely static when reduced motion is requested
     ------------------------------------------------------------------ */
  (function siteBackground() {
    var layer = $("#siteBg"), canvas = $("#heroCanvas"), hero = $("#home");
    if (!layer || !canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d");
    var shapes = $$(".shape", layer), grid = $(".hero-grid", layer);
    var w = 0, h = 0, particles = [], rgb = "90,220,210", raf = 0;
    var mouse = { x: 0, y: 0, active: false };
    var target = { x: 0.5, y: 0.4 }, smooth = { x: 0.5, y: 0.4 };

    function readColor() {
      var v = getComputedStyle(root).getPropertyValue("--particle").trim();
      if (v) rgb = v;
    }
    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var count = Math.round(Math.min(85, Math.max(24, (w * h) / 17000)));
      particles = [];
      for (var i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w, y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.28, vy: (Math.random() - 0.5) * 0.28,
          r: Math.random() * 1.5 + 0.7
        });
      }
      readColor();
      draw(false);
    }

    function draw(animate) {
      ctx.clearRect(0, 0, w, h);
      var i, j, p, q, dx, dy, d;
      for (i = 0; i < particles.length; i++) {
        p = particles[i];
        if (animate) {
          p.x += p.vx; p.y += p.vy;
          if (p.x < -10) p.x = w + 10; else if (p.x > w + 10) p.x = -10;
          if (p.y < -10) p.y = h + 10; else if (p.y > h + 10) p.y = -10;
          if (mouse.active) { // gently drift toward the cursor
            dx = mouse.x - p.x; dy = mouse.y - p.y; d = Math.sqrt(dx * dx + dy * dy);
            if (d < 200 && d > 50) { p.x += (dx / d) * (1 - d / 200) * 0.45; p.y += (dy / d) * (1 - d / 200) * 0.45; }
          }
        }
        ctx.fillStyle = "rgba(" + rgb + ",0.75)";
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
      }
      ctx.lineWidth = 1;
      for (i = 0; i < particles.length; i++) {
        p = particles[i];
        for (j = i + 1; j < particles.length; j++) {
          q = particles[j]; dx = p.x - q.x; dy = p.y - q.y;
          if (dx > 120 || dx < -120 || dy > 120 || dy < -120) continue;
          d = Math.sqrt(dx * dx + dy * dy);
          if (d < 120) {
            ctx.strokeStyle = "rgba(" + rgb + "," + ((1 - d / 120) * 0.28).toFixed(3) + ")";
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
        if (animate && mouse.active) {
          dx = p.x - mouse.x; dy = p.y - mouse.y; d = Math.sqrt(dx * dx + dy * dy);
          if (d < 150) {
            ctx.strokeStyle = "rgba(" + rgb + "," + ((1 - d / 150) * 0.5).toFixed(3) + ")";
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
          }
        }
      }
    }

    function frame() {
      raf = requestAnimationFrame(frame);
      smooth.x += (target.x - smooth.x) * 0.06; // ease pointer for smooth glow/parallax
      smooth.y += (target.y - smooth.y) * 0.06;
      layer.style.setProperty("--gx", (smooth.x * 100).toFixed(1) + "%");
      layer.style.setProperty("--gy", (smooth.y * 100).toFixed(1) + "%");
      var sy = window.scrollY || 0;
      for (var i = 0; i < shapes.length; i++) {
        var depth = parseFloat(shapes[i].getAttribute("data-depth")) || 0;
        shapes[i].style.transform = "translate3d(" + ((smooth.x - 0.5) * depth).toFixed(1) + "px," + (((smooth.y - 0.5) * depth) - sy * depth * 0.004).toFixed(1) + "px,0)";
      }
      if (grid) grid.style.transform = "translate3d(0," + (-((sy * 0.2) % 56)).toFixed(1) + "px,0)"; // grid drifts as you scroll
      draw(true);
    }

    function update() {
      var run = motionOK() && !document.hidden;
      if (run && !raf) raf = requestAnimationFrame(frame);
      else if (!run && raf) { cancelAnimationFrame(raf); raf = 0; }
      if (!motionOK()) {
        shapes.forEach(function (s) { s.style.transform = ""; });
        if (grid) grid.style.transform = "";
        draw(false);
      }
    }

    window.addEventListener("pointermove", function (e) {
      if (e.pointerType === "touch" || !motionOK()) return;
      mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true;
      target.x = e.clientX / w; target.y = e.clientY / h;
    });
    document.addEventListener("pointerleave", function () { mouse.active = false; });

    // Full strength while the hero is visible, softer behind reading areas
    if ("IntersectionObserver" in window && hero) {
      new IntersectionObserver(function (entries) {
        document.body.classList.toggle("on-hero", entries[0].isIntersecting);
      }, { threshold: 0.35 }).observe(hero);
    } else { document.body.classList.add("on-hero"); }

    document.addEventListener("visibilitychange", update);
    mqReduce.addEventListener ? mqReduce.addEventListener("change", update) : mqReduce.addListener(update);
    onThemeChange.push(function () { readColor(); draw(false); });

    var rt, lastW = window.innerWidth, lastH = window.innerHeight;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () { // ignore small height changes (mobile address bar)
        if (window.innerWidth !== lastW || Math.abs(window.innerHeight - lastH) > 150) {
          lastW = window.innerWidth; lastH = window.innerHeight; resize();
        }
      }, 200);
    });
    resize();
    update();
  })();

  /* ------------------------------------------------------------------
     9. Animated statistics (final value is already in the HTML)
     ------------------------------------------------------------------ */
  (function stats() {
    var nums = $$("[data-count]");
    if (!nums.length || !("IntersectionObserver" in window) || !motionOK()) return;
    nums.forEach(function (n) { n.textContent = "0" + (n.getAttribute("data-suffix") || ""); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        var el = entry.target, end = parseInt(el.getAttribute("data-count"), 10), suffix = el.getAttribute("data-suffix") || "";
        var t0 = performance.now(), dur = 1400;
        (function run(now) {
          var p = Math.min(1, (now - t0) / dur), eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(end * eased) + suffix;
          if (p < 1) requestAnimationFrame(run);
        })(t0);
      });
    }, { threshold: 0.6 });
    nums.forEach(function (n) { io.observe(n); });
  })();

  /* ------------------------------------------------------------------
     10. Portfolio filtering
     ------------------------------------------------------------------ */
  (function filters() {
    var buttons = $$(".filter-btn"), items = $$(".project-item"), status = $("#filter-status");
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var f = btn.getAttribute("data-filter"), count = 0;
        buttons.forEach(function (b) { b.classList.remove("is-active"); b.setAttribute("aria-pressed", "false"); });
        btn.classList.add("is-active"); btn.setAttribute("aria-pressed", "true");
        items.forEach(function (item) {
          var show = f === "all" || item.getAttribute("data-category").split(" ").indexOf(f) !== -1;
          item.hidden = !show;
          item.classList.remove("is-entering");
          if (show) {
            count++;
            item.classList.add("is-inview"); // ensure filtered-in items are never left hidden
            if (motionOK()) { void item.offsetWidth; item.classList.add("is-entering"); }
          }
        });
        status.textContent = count + (count === 1 ? " project" : " projects") + " shown for " + btn.textContent.trim() + ".";
      });
    });
  })();

  /* ------------------------------------------------------------------
     11. Project details dialog (native <dialog>)
     ------------------------------------------------------------------ */
  (function dialog() {
    var dlg = $("#projectDialog");
    if (!dlg) return;
    var title = $("#dialogTitle"), cat = $("#dialogCat"), text = $("#dialogText"), tags = $("#dialogTags");

    $$("[data-open-details]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var card = btn.closest(".project-card");
        title.textContent = $("h3", card).textContent;
        cat.textContent = $(".project-cat", card).textContent;
        text.textContent = btn.getAttribute("data-details");
        tags.innerHTML = "";
        $$(".tags li", card).forEach(function (li) {
          var n = document.createElement("li"); n.textContent = li.textContent; tags.appendChild(n);
        });
        if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
      });
    });
    function close() { if (typeof dlg.close === "function") dlg.close(); else dlg.removeAttribute("open"); }
    $("#dialogClose").addEventListener("click", close);
    dlg.addEventListener("click", function (e) { if (e.target === dlg) close(); }); // click on backdrop
  })();

  /* ------------------------------------------------------------------
     12. 3D tilt on project cards (mouse only, small angles, no reduced motion)
     ------------------------------------------------------------------ */
  (function tilt() {
    var MAX = 5; // degrees
    $$(".tilt").forEach(function (card) {
      card.addEventListener("pointermove", function (e) {
        if (e.pointerType !== "mouse" || !motionOK() || !mqFine.matches) return;
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        card.style.setProperty("--ry", ((px - 0.5) * 2 * MAX).toFixed(2) + "deg");
        card.style.setProperty("--rx", ((0.5 - py) * 2 * MAX).toFixed(2) + "deg");
        card.style.setProperty("--mx", (px * 100).toFixed(1) + "%");
        card.style.setProperty("--my", (py * 100).toFixed(1) + "%");
        card.classList.add("is-tilting");
      });
      card.addEventListener("pointerleave", function () {
        card.classList.remove("is-tilting");
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
      });
    });
  })();

  /* ------------------------------------------------------------------
     13. Magnetic buttons (small pull, so buttons stay easy to click)
     ------------------------------------------------------------------ */
  (function magnetic() {
    if (!mqFine.matches) return;
    var els = $$(".magnetic"), pending = null, queued = false, MAX = 8;
    els.forEach(function (el) { el._ox = 0; el._oy = 0; });

    function apply() {
      queued = false;
      if (!pending) return;
      var e = pending;
      els.forEach(function (el) {
        var r = el.getBoundingClientRect();
        var cx = r.left - el._ox + r.width / 2, cy = r.top - el._oy + r.height / 2; // undo current offset
        var dx = e.clientX - cx, dy = e.clientY - cy, dist = Math.sqrt(dx * dx + dy * dy);
        var reach = Math.max(r.width, r.height) / 2 + 70;
        var ox = 0, oy = 0, scale = 1;
        if (dist < reach && motionOK()) {
          var pull = 1 - dist / reach;
          ox = Math.max(-MAX, Math.min(MAX, dx * 0.22 * pull * 2));
          oy = Math.max(-MAX, Math.min(MAX, dy * 0.22 * pull * 2));
          scale = 1.04;
        }
        el._ox = ox; el._oy = oy;
        el.style.transform = ox || oy ? "translate(" + ox.toFixed(1) + "px," + oy.toFixed(1) + "px) scale(" + scale + ")" : "";
      });
    }
    document.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse") return;
      pending = e;
      if (!queued) { queued = true; requestAnimationFrame(apply); }
    });
    document.addEventListener("pointerleave", function () {
      els.forEach(function (el) { el._ox = el._oy = 0; el.style.transform = ""; });
    });
  })();

  /* ------------------------------------------------------------------
     14. Custom cursor (desktop only; the native cursor stays visible)
     ------------------------------------------------------------------ */
  (function cursor() {
    if (!mqFine.matches || !motionOK()) return;
    var dot = document.createElement("div"), ring = document.createElement("div");
    dot.className = "cursor-dot"; ring.className = "cursor-ring";
    dot.setAttribute("aria-hidden", "true"); ring.setAttribute("aria-hidden", "true");
    document.body.appendChild(dot); document.body.appendChild(ring);

    var x = 0, y = 0, rx = 0, ry = 0, raf = 0, seen = false;

    function loop() {
      rx += (x - rx) * 0.18; ry += (y - ry) * 0.18; // trailing effect
      ring.style.transform = "translate3d(" + rx.toFixed(1) + "px," + ry.toFixed(1) + "px,0)";
      if (Math.abs(x - rx) > 0.1 || Math.abs(y - ry) > 0.1) raf = requestAnimationFrame(loop); else raf = 0;
    }
    function remove() {
      cancelAnimationFrame(raf);
      root.classList.remove("has-cursor");
      if (dot.parentNode) dot.parentNode.removeChild(dot);
      if (ring.parentNode) ring.parentNode.removeChild(ring);
      document.removeEventListener("pointermove", move);
    }
    function move(e) {
      if (e.pointerType !== "mouse") return;
      x = e.clientX; y = e.clientY;
      if (!seen) { seen = true; rx = x; ry = y; root.classList.add("has-cursor"); }
      dot.style.transform = "translate3d(" + x + "px," + y + "px,0)";
      if (!raf) raf = requestAnimationFrame(loop);
      var t = e.target.closest ? e.target.closest("a, button, input, textarea, label") : null;
      var isButton = t && (t.matches("button, .btn, .filter-btn"));
      ring.classList.toggle("is-button", !!isButton);
      ring.classList.toggle("is-link", !!t && !isButton);
    }
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerleave", function () { dot.classList.add("is-hidden"); ring.classList.add("is-hidden"); });
    document.addEventListener("pointerenter", function () { dot.classList.remove("is-hidden"); ring.classList.remove("is-hidden"); });
    mqReduce.addEventListener ? mqReduce.addEventListener("change", function () { if (mqReduce.matches) remove(); }) : null;
  })();

  /* ------------------------------------------------------------------
     15. Contact form (front-end only: validate, then open the email app)
     ------------------------------------------------------------------ */
  (function contactForm() {
    var form = $("#contactForm"), ok = $("#formSuccess");
    if (!form) return;
    var RECIPIENT = "hello@jordanreyes.example"; // <- replace with your email

    function setError(id, msg) {
      var field = document.getElementById(id), err = document.getElementById(id + "Error");
      err.textContent = msg;
      field.classList.toggle("is-invalid", !!msg);
      if (msg) field.setAttribute("aria-invalid", "true"); else field.removeAttribute("aria-invalid");
    }
    function validate(id) {
      var v = document.getElementById(id).value.trim();
      var msg = "";
      if (!v) {
        msg = { fullName: "Please enter your full name.", email: "Please enter your email address.", subject: "Please enter a subject.", message: "Please enter a message." }[id];
      } else if (id === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        msg = "Please enter a valid email address, like name@example.com.";
      }
      setError(id, msg);
      return !msg;
    }
    ["fullName", "email", "subject", "message"].forEach(function (id) {
      document.getElementById(id).addEventListener("blur", function () { if (this.value) validate(id); });
      document.getElementById(id).addEventListener("input", function () { if (this.classList.contains("is-invalid")) validate(id); });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      ok.textContent = "";
      var valid = ["fullName", "email", "subject", "message"].map(validate).every(Boolean);
      if (!valid) { var first = form.querySelector(".is-invalid"); if (first) first.focus(); return; }

      var name = $("#fullName").value.trim(), email = $("#email").value.trim();
      var subject = $("#subject").value.trim(), message = $("#message").value.trim();
      var body = "Name: " + name + "\nEmail: " + email + "\n\n" + message;
      window.location.href = "mailto:" + RECIPIENT + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);

      ok.textContent = "Thank you! Your message has been prepared in your email app.";
      form.reset();
    });
  })();
})();
