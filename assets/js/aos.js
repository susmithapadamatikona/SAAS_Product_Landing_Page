/**
 * aos.js — Animate On Scroll
 *
 * A dependency-free AOS engine (the real AOS is a library, and this project is
 * vanilla-only). Drives every scroll animation on the site.
 *
 *   <div data-aos="fade-up">
 *   <div data-aos="flip-left" data-aos-delay="150" data-aos-duration="900">
 *   <div data-aos="zoom-in"  data-aos-once="false">   <!-- replays on re-entry -->
 *   <ul  data-aos-stagger="80">                       <!-- children cascade -->
 *
 * Animations:
 *   fade | fade-up | fade-down | fade-left | fade-right
 *   zoom-in | zoom-out | zoom-in-up
 *   flip-up | flip-down | flip-left | flip-right     (3D)
 *   rotate-in | swing-in                             (3D)
 *   blur-in
 *
 * Options (per element or on <body> as defaults):
 *   data-aos-delay="200"      ms
 *   data-aos-duration="800"   ms
 *   data-aos-offset="80"      px before the element enters
 *   data-aos-once="false"     re-animate every time it scrolls back in
 *   data-aos-anchor="#id"     trigger off another element
 */
(function () {
  'use strict';

  var DEFAULTS = {
    duration: 700,
    delay: 0,
    offset: 60,
    once: true
  };

  function readDefaults() {
    var b = document.body;
    if (!b) return;
    ['duration', 'delay', 'offset'].forEach(function (k) {
      var v = b.getAttribute('data-aos-' + k);
      if (v !== null) DEFAULTS[k] = parseInt(v, 10);
    });
    if (b.getAttribute('data-aos-once') === 'false') DEFAULTS.once = false;
  }

  var AOS = {
    els: [],
    observer: null,

    /** Apply per-element timing as inline custom properties. */
    prime: function (el) {
      var duration = el.getAttribute('data-aos-duration') || DEFAULTS.duration;
      var delay = el.getAttribute('data-aos-delay') || DEFAULTS.delay;

      el.style.setProperty('--aos-duration', duration + 'ms');
      el.style.setProperty('--aos-delay', delay + 'ms');
    },

    /** Cascade a delay across the children of [data-aos-stagger]. */
    stagger: function () {
      Array.prototype.forEach.call(
        document.querySelectorAll('[data-aos-stagger]'),
        function (group) {
          var step = parseInt(group.getAttribute('data-aos-stagger'), 10) || 80;
          var base = parseInt(group.getAttribute('data-aos-delay'), 10) || 0;

          Array.prototype.forEach.call(group.children, function (child, i) {
            if (!child.hasAttribute('data-aos')) return;
            if (child.hasAttribute('data-aos-delay')) return; // explicit wins
            child.setAttribute('data-aos-delay', base + i * step);
          });
        }
      );
    },

    show: function (el) {
      el.classList.add('aos-animate');
    },

    hide: function (el) {
      el.classList.remove('aos-animate');
    },

    refresh: function () {
      var self = this;
      this.els = Array.prototype.slice.call(document.querySelectorAll('[data-aos]'));

      this.els.forEach(function (el) {
        self.prime(el);
        if (self.observer) self.observer.observe(self.anchorFor(el));
      });
    },

    /** data-aos-anchor lets one element trigger on another's position. */
    anchorFor: function (el) {
      var sel = el.getAttribute('data-aos-anchor');
      var anchor = sel && document.querySelector(sel);
      if (anchor) anchor._aosTargets = (anchor._aosTargets || []).concat(el);
      return anchor || el;
    },

    init: function () {
      var self = this;
      readDefaults();
      this.stagger();

      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var els = Array.prototype.slice.call(document.querySelectorAll('[data-aos]'));

      // No motion, no observer: show everything immediately.
      if (reduce || !('IntersectionObserver' in window)) {
        els.forEach(function (el) { el.classList.add('aos-animate', 'aos-init'); });
        document.documentElement.classList.add('aos-ready');
        return;
      }

      els.forEach(function (el) {
        self.prime(el);
        el.classList.add('aos-init');
      });

      this.observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var targets = entry.target._aosTargets || [entry.target];

          targets.forEach(function (el) {
            var once = el.getAttribute('data-aos-once');
            once = once === null ? DEFAULTS.once : once !== 'false';

            if (entry.isIntersecting) {
              self.show(el);
              if (once) self.observer.unobserve(entry.target);
            } else if (!once) {
              self.hide(el);
            }
          });
        });
      }, {
        threshold: 0.01,
        rootMargin: '0px 0px -' + DEFAULTS.offset + 'px 0px'
      });

      this.refresh();
      document.documentElement.classList.add('aos-ready');

      // Content can change height (blog filter, tabs, accordion) — re-measure.
      window.addEventListener('resize', debounce(function () { self.refresh(); }, 200));
      window.addEventListener('load', function () { self.refresh(); });
    }
  };

  function debounce(fn, wait) {
    var t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, wait);
    };
  }

  /** Last resort: never leave content stuck at opacity 0. */
  function revealAll() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-aos]'), function (el) {
      el.classList.add('aos-animate');
    });
  }

  function boot() {
    try {
      AOS.init();
    } catch (err) {
      // An engine bug must not blank the page.
      revealAll();
      if (window.console) console.warn('AOS failed, revealing content:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Anything still hidden a moment after load gets shown regardless.
  window.addEventListener('load', function () {
    setTimeout(function () {
      Array.prototype.forEach.call(document.querySelectorAll('[data-aos]:not(.aos-animate)'), function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('aos-animate');
      });
    }, 1200);
  });

  window.AOS = AOS;
})();
