/**
 * slider.js — Testimonial carousel + infinite logo marquee.
 *
 * Slider markup:
 *   .slider > .slider__track > .slide…
 *   .slider__nav with [data-slider-prev] / [data-slider-next] / .slider__dots
 *
 * Autoplays, pauses on hover/focus, supports arrows, dots, keyboard and swipe.
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    initSliders();
    initMarquee();
  });

  /* ---------------------------------------------------------------
     Testimonial slider
     --------------------------------------------------------------- */
  function initSliders() {
    Array.prototype.slice.call(document.querySelectorAll('.slider')).forEach(function (root) {
      var track = root.querySelector('.slider__track');
      var slides = Array.prototype.slice.call(root.querySelectorAll('.slide'));
      if (!track || slides.length < 2) return;

      var nav = root.parentElement.querySelector('.slider__nav') || root.querySelector('.slider__nav');
      var prevBtn = nav && nav.querySelector('[data-slider-prev]');
      var nextBtn = nav && nav.querySelector('[data-slider-next]');
      var dotsHost = nav && nav.querySelector('.slider__dots');

      var index = 0;
      var timer = null;
      var interval = parseInt(root.getAttribute('data-autoplay'), 10) || 6000;

      /* Dots */
      var dots = [];
      if (dotsHost) {
        slides.forEach(function (_, i) {
          var dot = document.createElement('button');
          dot.className = 'slider__dot' + (i === 0 ? ' is-active' : '');
          dot.type = 'button';
          dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
          dot.addEventListener('click', function () { go(i); restart(); });
          dotsHost.appendChild(dot);
          dots.push(dot);
        });
      }

      function go(i) {
        index = (i + slides.length) % slides.length;
        track.style.transform = 'translateX(-' + (index * 100) + '%)';
        dots.forEach(function (d, di) { d.classList.toggle('is-active', di === index); });
        slides.forEach(function (s, si) { s.setAttribute('aria-hidden', si === index ? 'false' : 'true'); });
      }

      function next() { go(index + 1); }
      function prev() { go(index - 1); }

      function start() {
        if (timer || root.hasAttribute('data-no-autoplay')) return;
        timer = setInterval(next, interval);
      }
      function stop() { clearInterval(timer); timer = null; }
      function restart() { stop(); start(); }

      if (nextBtn) nextBtn.addEventListener('click', function () { next(); restart(); });
      if (prevBtn) prevBtn.addEventListener('click', function () { prev(); restart(); });

      root.addEventListener('mouseenter', stop);
      root.addEventListener('mouseleave', start);
      root.addEventListener('focusin', stop);
      root.addEventListener('focusout', start);

      // Keyboard
      root.setAttribute('tabindex', '0');
      root.setAttribute('role', 'region');
      root.setAttribute('aria-roledescription', 'carousel');
      root.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') { next(); restart(); }
        if (e.key === 'ArrowLeft') { prev(); restart(); }
      });

      // Touch swipe
      var startX = 0, delta = 0, dragging = false;
      root.addEventListener('touchstart', function (e) {
        startX = e.touches[0].clientX;
        dragging = true;
        stop();
      }, { passive: true });

      root.addEventListener('touchmove', function (e) {
        if (!dragging) return;
        delta = e.touches[0].clientX - startX;
      }, { passive: true });

      root.addEventListener('touchend', function () {
        if (!dragging) return;
        dragging = false;
        if (Math.abs(delta) > 55) (delta < 0 ? next : prev)();
        delta = 0;
        start();
      });

      // Pause when the tab is hidden.
      document.addEventListener('visibilitychange', function () {
        document.hidden ? stop() : start();
      });

      go(0);
      start();
    });
  }

  /* ---------------------------------------------------------------
     Infinite logo marquee — duplicates the track for a seamless loop
     --------------------------------------------------------------- */
  function initMarquee() {
    Array.prototype.slice.call(document.querySelectorAll('.marquee')).forEach(function (marquee) {
      var track = marquee.querySelector('.marquee__track');
      if (!track || track.dataset.cloned === 'true') return;

      // The CSS animation translates by -50%, so the content must be doubled.
      var clone = track.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      Array.prototype.slice.call(clone.children).forEach(function (child) {
        child.setAttribute('aria-hidden', 'true');
      });

      // Merge both copies into one track so the animation stays continuous.
      Array.prototype.slice.call(clone.children).forEach(function (child) {
        track.appendChild(child);
      });
      track.dataset.cloned = 'true';
    });
  }
})();
