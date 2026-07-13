/**
 * pricing.js — Monthly / yearly billing toggle.
 *
 * Each price element carries both figures:
 *   <span class="price-card__amount" data-monthly="29" data-yearly="23">29</span>
 * Yearly prices are the effective monthly rate when billed annually.
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var toggle = document.querySelector('.switch[data-pricing-toggle]');
    if (!toggle) return;

    var amounts = Array.prototype.slice.call(document.querySelectorAll('[data-monthly]'));
    var billedNotes = Array.prototype.slice.call(document.querySelectorAll('[data-billed]'));
    var labelMonthly = document.querySelector('[data-label-monthly]');
    var labelYearly = document.querySelector('[data-label-yearly]');

    /** Count from the current value to the target so the switch feels alive. */
    function animateTo(el, target) {
      var from = parseFloat(el.textContent.replace(/[^\d.]/g, '')) || 0;
      if (from === target) return;

      var start = performance.now();
      var duration = 420;

      (function frame(now) {
        var progress = Math.min((now - start) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(from + (target - from) * eased).toString();
        if (progress < 1) requestAnimationFrame(frame);
      })(start);
    }

    function render(yearly) {
      amounts.forEach(function (el) {
        var value = parseFloat(el.getAttribute(yearly ? 'data-yearly' : 'data-monthly'));
        if (isNaN(value)) return;
        animateTo(el, value);
      });

      billedNotes.forEach(function (el) {
        var monthly = el.getAttribute('data-billed-monthly') || '';
        var annual = el.getAttribute('data-billed-yearly') || '';
        el.textContent = yearly ? annual : monthly;
      });

      if (labelMonthly) labelMonthly.classList.toggle('is-active', !yearly);
      if (labelYearly) labelYearly.classList.toggle('is-active', yearly);

      toggle.setAttribute('aria-checked', yearly ? 'true' : 'false');
    }

    toggle.addEventListener('click', function () {
      render(toggle.getAttribute('aria-checked') !== 'true');
    });

    toggle.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggle.click();
      }
    });

    // Clicking the labels flips the switch too.
    if (labelMonthly) labelMonthly.addEventListener('click', function () { render(false); });
    if (labelYearly) labelYearly.addEventListener('click', function () { render(true); });

    render(false);
  });
})();
