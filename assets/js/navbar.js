/**
 * navbar.js — Sticky header, mobile drawer, active-link highlighting.
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var navbar = document.querySelector('.navbar');
    var hamburger = document.querySelector('.hamburger');
    var drawer = document.querySelector('.drawer');
    var overlay = document.querySelector('.overlay');

    /* ---------- Sticky / scrolled state ---------- */
    if (navbar) {
      var onScroll = function () {
        navbar.classList.toggle('is-scrolled', window.scrollY > 24);
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    /* ---------- Mobile drawer ---------- */
    function openDrawer() {
      drawer.classList.add('is-open');
      overlay.classList.add('is-open');
      hamburger.classList.add('is-open');
      hamburger.setAttribute('aria-expanded', 'true');
      document.body.classList.add('no-scroll');

      // Stagger the links in.
      drawer.querySelectorAll('.drawer__link').forEach(function (link, i) {
        link.style.transitionDelay = (80 + i * 55) + 'ms';
      });
    }

    function closeDrawer() {
      drawer.classList.remove('is-open');
      overlay.classList.remove('is-open');
      hamburger.classList.remove('is-open');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('no-scroll');
      drawer.querySelectorAll('.drawer__link').forEach(function (link) {
        link.style.transitionDelay = '0ms';
      });
    }

    if (hamburger && drawer && overlay) {
      hamburger.addEventListener('click', function () {
        drawer.classList.contains('is-open') ? closeDrawer() : openDrawer();
      });
      overlay.addEventListener('click', closeDrawer);

      drawer.addEventListener('click', function (e) {
        if (e.target.closest('a, [data-drawer-close]')) closeDrawer();
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && drawer.classList.contains('is-open')) closeDrawer();
      });

      // Reset when resizing back up to desktop.
      window.addEventListener('resize', function () {
        if (window.innerWidth > 1024 && drawer.classList.contains('is-open')) closeDrawer();
      });
    }

    /* ---------- Active link ---------- */
    var page = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-menu a, .drawer__link').forEach(function (link) {
      var href = link.getAttribute('href');
      if (!href) return;
      var file = href.split('#')[0].split('/').pop();
      if (file && file === page) link.classList.add('is-active');
    });
  });
})();
