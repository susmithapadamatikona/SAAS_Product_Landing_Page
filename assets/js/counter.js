/**
 * counter.js — Animated statistic counters.
 *
 * Usage: <span data-counter="500" data-suffix="K+" data-decimals="0">0</span>
 * Counts up with an ease-out curve the first time it scrolls into view.
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var counters = Array.prototype.slice.call(document.querySelectorAll('[data-counter]'));
    if (!counters.length) return;

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /** Format with the element's decimal precision + thousands separators. */
    function format(value, decimals) {
      return value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    function run(el) {
      var target = parseFloat(el.getAttribute('data-counter')) || 0;
      var decimals = parseInt(el.getAttribute('data-decimals'), 10) || 0;
      var prefix = el.getAttribute('data-prefix') || '';
      var suffix = el.getAttribute('data-suffix') || '';
      var duration = parseInt(el.getAttribute('data-duration'), 10) || 2000;

      if (reduceMotion) {
        el.textContent = prefix + format(target, decimals) + suffix;
        return;
      }

      var start = performance.now();

      (function frame(now) {
        var progress = Math.min((now - start) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
        el.textContent = prefix + format(target * eased, decimals) + suffix;
        if (progress < 1) requestAnimationFrame(frame);
      })(start);
    }

    if (!('IntersectionObserver' in window)) {
      counters.forEach(run);
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        run(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.5 });

    counters.forEach(function (el) { observer.observe(el); });
  });
})();
