/**
 * main.js — Core site behaviour
 * Page loader, scroll reveal, ripple, cursor glow, parallax, particles,
 * back-to-top, typing effect, modals, toasts, smooth scroll.
 *
 * Exposes a small shared API on `window.Nebula` used by the other modules.
 */
(function () {
  'use strict';

  /* ---------------------------------------------------------------
     Shared helpers
     --------------------------------------------------------------- */
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Throttle with requestAnimationFrame — for scroll/mousemove handlers. */
  function rafThrottle(fn) {
    var queued = false;
    return function () {
      var args = arguments, ctx = this;
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () {
        queued = false;
        fn.apply(ctx, args);
      });
    };
  }

  /* ---------------------------------------------------------------
     Toast notifications
     --------------------------------------------------------------- */
  var ICONS = {
    success: '<path d="M20 6 9 17l-5-5"/>',
    error: '<circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'
  };

  /**
   * Show a toast.
   * @param {string} title
   * @param {string} [message]
   * @param {'success'|'error'|'info'} [type='info']
   * @param {number} [duration=4000]
   */
  function toast(title, message, type, duration) {
    type = type || 'info';
    duration = duration || 4000;

    var stack = $('.toasts');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toasts';
      stack.setAttribute('role', 'status');
      stack.setAttribute('aria-live', 'polite');
      document.body.appendChild(stack);
    }

    var el = document.createElement('div');
    el.className = 'toast toast--' + type;
    el.innerHTML =
      '<span class="toast__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
      'stroke-linecap="round" stroke-linejoin="round">' + (ICONS[type] || ICONS.info) + '</svg></span>' +
      '<div><strong></strong>' + (message ? '<p></p>' : '') + '</div>' +
      '<button class="toast__close" aria-label="Dismiss notification">&times;</button>';

    // textContent (not innerHTML) so user-supplied strings can't inject markup.
    $('strong', el).textContent = title;
    if (message) $('p', el).textContent = message;

    stack.appendChild(el);

    var timer = setTimeout(dismiss, duration);
    function dismiss() {
      clearTimeout(timer);
      el.classList.add('is-out');
      setTimeout(function () { el.remove(); }, 400);
    }
    $('.toast__close', el).addEventListener('click', dismiss);
    return dismiss;
  }

  /* ---------------------------------------------------------------
     Brand logos
     --------------------------------------------------------------- */
  function initBrandLogos() {
    $$('a.logo').forEach(function (logo) {
      logo.setAttribute('aria-label', 'Stackly home');

      if (logo.querySelector('.logo__image')) return;

      logo.innerHTML = '<img class="logo__image" src="assets/images/logo%20stackly.webp" alt="Stackly" />';
    });
  }

  /* ---------------------------------------------------------------
     Modals
     --------------------------------------------------------------- */
  function initModals() {
    function open(modal) {
      modal.classList.add('is-open');
      document.body.classList.add('no-scroll');
      var focusable = modal.querySelector('button, [href], input, select, textarea');
      if (focusable) focusable.focus();
    }
    function close(modal) {
      modal.classList.remove('is-open');
      document.body.classList.remove('no-scroll');
    }

    $$('[data-modal-open]').forEach(function (trigger) {
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        var modal = document.getElementById(trigger.getAttribute('data-modal-open'));
        if (modal) open(modal);
      });
    });

    $$('.modal').forEach(function (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal || e.target.closest('[data-modal-close]')) close(modal);
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var open_ = $('.modal.is-open');
      if (open_) close(open_);
    });
  }

  /* ---------------------------------------------------------------
     Page loader
     --------------------------------------------------------------- */
  function initLoader() {
    var loader = $('.loader');
    if (!loader) return;
    var hide = function () {
      setTimeout(function () { loader.classList.add('is-done'); }, 350);
    };
    if (document.readyState === 'complete') hide();
    else window.addEventListener('load', hide);
    // Safety net: never trap the user behind the loader.
    setTimeout(function () { loader.classList.add('is-done'); }, 3500);
  }

  /* ---------------------------------------------------------------
     Scroll reveal (IntersectionObserver)
     --------------------------------------------------------------- */
  function initReveal() {
    var items = $$('[data-reveal]');
    if (!items.length) return;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-revealed'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var delay = el.getAttribute('data-reveal-delay');
        if (delay) el.style.setProperty('--reveal-delay', delay + 'ms');
        el.classList.add('is-revealed');
        observer.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

    items.forEach(function (el) { observer.observe(el); });
  }

  /* ---------------------------------------------------------------
     Ripple effect on buttons
     --------------------------------------------------------------- */
  function initRipple() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.btn, .chip, .social-btn');
      if (!btn || reduceMotion) return;

      var rect = btn.getBoundingClientRect();
      var size = Math.max(rect.width, rect.height);
      var ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
      ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
      btn.appendChild(ripple);
      setTimeout(function () { ripple.remove(); }, 600);
    });
  }

  /* ---------------------------------------------------------------
     Back to top
     --------------------------------------------------------------- */
  function initBackToTop() {
    var btn = $('.back-top');
    if (!btn) return;

    var onScroll = rafThrottle(function () {
      btn.classList.toggle('is-visible', window.scrollY > 500);
    });
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  /* ---------------------------------------------------------------
     Cursor glow (pointer-fine devices only)
     --------------------------------------------------------------- */
  function initCursorGlow() {
    if (reduceMotion || !window.matchMedia('(pointer: fine)').matches) return;

    var glow = document.createElement('div');
    glow.className = 'cursor-glow';
    document.body.appendChild(glow);

    var x = 0, y = 0, cx = 0, cy = 0;
    document.addEventListener('mousemove', function (e) {
      x = e.clientX;
      y = e.clientY;
      glow.classList.add('is-active');
    });
    document.addEventListener('mouseleave', function () { glow.classList.remove('is-active'); });

    (function loop() {
      cx += (x - cx) * 0.12;
      cy += (y - cy) * 0.12;
      glow.style.transform = 'translate(' + cx + 'px,' + cy + 'px)';
      requestAnimationFrame(loop);
    })();
  }

  /* ---------------------------------------------------------------
     Mouse parallax — elements with [data-parallax="<strength>"]
     --------------------------------------------------------------- */
  function initParallax() {
    var layers = $$('[data-parallax]');
    if (!layers.length || reduceMotion || !window.matchMedia('(pointer: fine)').matches) return;

    var onMove = rafThrottle(function (e) {
      var dx = (e.clientX / window.innerWidth - 0.5) * 2;   // -1 … 1
      var dy = (e.clientY / window.innerHeight - 0.5) * 2;

      layers.forEach(function (el) {
        var strength = parseFloat(el.getAttribute('data-parallax')) || 10;
        el.style.transform = 'translate3d(' + (-dx * strength) + 'px,' + (-dy * strength) + 'px,0)';
      });
    });
    window.addEventListener('mousemove', onMove, { passive: true });
  }

  /* ---------------------------------------------------------------
     Card tilt — [data-tilt]
     --------------------------------------------------------------- */
  function initTilt() {
    if (reduceMotion || !window.matchMedia('(pointer: fine)').matches) return;

    $$('[data-tilt]').forEach(function (card) {
      card.classList.add('tilt');
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform =
          'perspective(900px) rotateX(' + (-py * 7) + 'deg) rotateY(' + (px * 7) + 'deg) translateY(-6px)';
      });
      card.addEventListener('mouseleave', function () { card.style.transform = ''; });
    });
  }

  /* ---------------------------------------------------------------
     Hero particles (canvas)
     --------------------------------------------------------------- */
  function initParticles() {
    var canvas = document.getElementById('particles');
    if (!canvas || reduceMotion) return;

    var ctx = canvas.getContext('2d');
    var particles = [];
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = 0, h = 0;

    function resize() {
      var rect = canvas.parentElement.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var count = Math.min(Math.round(w / 14), 90);
      particles = [];
      for (var i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 1.7 + 0.5,
          vx: (Math.random() - 0.5) * 0.28,
          vy: (Math.random() - 0.5) * 0.28,
          a: Math.random() * 0.5 + 0.15
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);

      // Link nearby particles with faint lines.
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(184,167,255,' + p.a + ')';
        ctx.fill();

        for (var j = i + 1; j < particles.length; j++) {
          var q = particles[j];
          var dx = p.x - q.x, dy = p.y - q.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 130) continue;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.strokeStyle = 'rgba(109,93,246,' + (0.13 * (1 - dist / 130)) + ')';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
      requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener('resize', rafThrottle(resize));
  }

  /* ---------------------------------------------------------------
     Falling stars (404 page)
     --------------------------------------------------------------- */
  function initStars() {
    var host = $('.stars');
    if (!host) return;

    var frag = document.createDocumentFragment();
    for (var i = 0; i < 90; i++) {
      var star = document.createElement('span');
      star.className = 'star';
      star.style.left = Math.random() * 100 + '%';
      star.style.top = Math.random() * 100 + '%';
      star.style.animationDelay = (Math.random() * 3).toFixed(2) + 's';
      star.style.opacity = (Math.random() * 0.6 + 0.2).toFixed(2);
      frag.appendChild(star);
    }
    host.appendChild(frag);
  }

  /* ---------------------------------------------------------------
     Smooth scroll for in-page anchors
     --------------------------------------------------------------- */
  function initSmoothScroll() {
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a[href^="#"]');
      if (!link) return;

      var id = link.getAttribute('href');
      if (!id || id === '#' || link.hasAttribute('data-modal-open')) return;

      var target = document.querySelector(id);
      if (!target) return;

      e.preventDefault();
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', id);
    });
  }

  /* ---------------------------------------------------------------
     Newsletter (footer) — front-end only
     --------------------------------------------------------------- */
  function initNewsletter() {
    $$('.newsletter').forEach(function (form) {
      var input = $('.newsletter__input', form);
      var status = $('.newsletter__status', form);
      if (!input) return;

      function setStatus(message, state) {
        form.classList.remove('has-error', 'is-done', 'is-loading');
        if (state) form.classList.add(state);
        if (status) status.textContent = message || '';
      }

      // Clear the error as soon as the user starts fixing it.
      input.addEventListener('input', function () {
        if (form.classList.contains('has-error')) setStatus('');
      });

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var value = (input.value || '').trim();

        if (!value) {
          setStatus('Please enter your email address.', 'has-error');
          input.focus();
          return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value)) {
          setStatus('That does not look like a valid email.', 'has-error');
          input.focus();
          return;
        }

        setStatus('', 'is-loading');

        // Simulated request — this is a static site, so nothing is actually sent.
        setTimeout(function () {
          setStatus('You are subscribed. Check your inbox to confirm.', 'is-done');
          input.value = '';
          input.blur();
          toast('Subscribed!', 'Thanks — product updates are on the way.', 'success');

          // Let the success state settle, then return the form to rest.
          setTimeout(function () { setStatus(''); }, 6000);
        }, 900);
      });
    });
  }

  /* ---------------------------------------------------------------
     Progress bars — <i style="--value:72">
     --------------------------------------------------------------- */
  function initProgress() {
    var bars = $$('.progress i[data-value]');
    if (!bars.length) return;

    if (!('IntersectionObserver' in window)) {
      bars.forEach(function (b) { b.style.width = b.getAttribute('data-value') + '%'; });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.style.width = entry.target.getAttribute('data-value') + '%';
        io.unobserve(entry.target);
      });
    }, { threshold: 0.4 });

    bars.forEach(function (b) { io.observe(b); });
  }

  /* ---------------------------------------------------------------
     Blog — search, category filter, client-side pagination
     --------------------------------------------------------------- */
  function initBlog() {
    var grid = $('#blogGrid');
    if (!grid) return;

    var posts = $$('.post', grid);
    var searchInput = $('#blogSearch');
    var chips = $$('.chip[data-category]');
    var pager = $('#blogPagination');
    var countEl = $('#blogCount');
    var emptyState = $('#blogEmpty');

    var perPage = parseInt(grid.getAttribute('data-per-page'), 10) || 6;
    var page = 1;
    var category = 'all';
    var query = '';

    function matches(post) {
      var postCat = post.getAttribute('data-category');
      if (category !== 'all' && postCat !== category) return false;
      if (!query) return true;

      var haystack = (post.getAttribute('data-tags') + ' ' + post.textContent).toLowerCase();
      return haystack.indexOf(query) > -1;
    }

    function render() {
      var visible = posts.filter(matches);
      var pages = Math.max(Math.ceil(visible.length / perPage), 1);
      page = Math.min(page, pages);

      var start = (page - 1) * perPage;
      var slice = visible.slice(start, start + perPage);

      posts.forEach(function (post) {
        var show = slice.indexOf(post) > -1;
        post.classList.toggle('hidden', !show);
        if (show) {
          post.classList.remove('is-revealed');
          // Re-trigger the reveal transition for the newly shown cards.
          requestAnimationFrame(function () { post.classList.add('is-revealed'); });
        }
      });

      if (countEl) {
        countEl.textContent = visible.length + (visible.length === 1 ? ' article' : ' articles');
      }
      if (emptyState) emptyState.classList.toggle('hidden', visible.length > 0);

      renderPager(pages, visible.length);
    }

    function renderPager(pages, total) {
      if (!pager) return;
      pager.innerHTML = '';
      if (total <= perPage) return;

      var add = function (label, target, opts) {
        opts = opts || {};
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.innerHTML = label;
        if (opts.active) btn.classList.add('is-active');
        if (opts.disabled) btn.disabled = true;
        else btn.addEventListener('click', function () {
          page = target;
          render();
          grid.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        });
        pager.appendChild(btn);
      };

      add('&larr;', page - 1, { disabled: page === 1 });
      for (var i = 1; i <= pages; i++) {
        add(String(i), i, { active: i === page });
      }
      add('&rarr;', page + 1, { disabled: page === pages });
    }

    if (searchInput) {
      var debounce;
      searchInput.addEventListener('input', function () {
        clearTimeout(debounce);
        debounce = setTimeout(function () {
          query = searchInput.value.trim().toLowerCase();
          page = 1;
          render();
        }, 220);
      });
    }

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        chips.forEach(function (c) { c.classList.remove('is-active'); });
        chip.classList.add('is-active');
        category = chip.getAttribute('data-category');
        page = 1;
        render();
      });
    });

    render();
  }

  /* ---------------------------------------------------------------
     Boot
     --------------------------------------------------------------- */
  function init() {
    initBrandLogos();
    initLoader();
    initReveal();
    initRipple();
    initBackToTop();
    initCursorGlow();
    initParallax();
    initTilt();
    initParticles();
    initStars();
    initSmoothScroll();
    initModals();
    initNewsletter();
    initProgress();
    initBlog();

    // Stamp the current year wherever it's needed.
    $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // Shared API for the other modules.
  window.Nebula = {
    $: $,
    $$: $$,
    toast: toast,
    rafThrottle: rafThrottle,
    reduceMotion: reduceMotion
  };
})();
