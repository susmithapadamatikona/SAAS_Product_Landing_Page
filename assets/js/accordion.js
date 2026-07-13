/**
 * accordion.js — FAQ accordion with a single open item per group.
 * Animates max-height from the panel's real scrollHeight so the
 * transition works with variable content length.
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var accordions = Array.prototype.slice.call(document.querySelectorAll('.accordion'));
    if (!accordions.length) return;

    accordions.forEach(function (group) {
      var items = Array.prototype.slice.call(group.querySelectorAll('.accordion__item'));

      function close(item) {
        var panel = item.querySelector('.accordion__panel');
        var trigger = item.querySelector('.accordion__trigger');
        item.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
        panel.style.maxHeight = '';
      }

      function open(item) {
        var panel = item.querySelector('.accordion__panel');
        var trigger = item.querySelector('.accordion__trigger');
        item.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
        panel.style.maxHeight = panel.scrollHeight + 'px';
      }

      items.forEach(function (item) {
        var trigger = item.querySelector('.accordion__trigger');
        if (!trigger) return;

        trigger.addEventListener('click', function () {
          var isOpen = item.classList.contains('is-open');
          items.forEach(close);            // single-open behaviour
          if (!isOpen) open(item);
        });

        // Restore height on resize while open (text reflows).
        window.addEventListener('resize', function () {
          if (item.classList.contains('is-open')) {
            item.querySelector('.accordion__panel').style.maxHeight =
              item.querySelector('.accordion__panel').scrollHeight + 'px';
          }
        });
      });

      // Open whichever item is marked as the default.
      var initial = group.querySelector('.accordion__item.is-open');
      if (initial) open(initial);
    });
  });
})();
