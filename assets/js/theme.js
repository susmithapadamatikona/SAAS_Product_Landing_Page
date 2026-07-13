/**
 * theme.js — Dark / Light theme switching
 * Loaded before paint (in <head>) to avoid a flash of the wrong theme.
 * Persists the choice in localStorage under `nebula:theme`.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'nebula:theme';
  var root = document.documentElement;

  /**
   * Resolve the theme to apply.
   * Nebula is a dark-first product, so with no stored choice we use dark —
   * we only follow the OS when the user has explicitly opted into 'auto'.
   */
  function resolve() {
    var stored = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) { /* private mode */ }

    if (stored === 'light' || stored === 'dark') return stored;
    if (stored === 'auto') {
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    return 'dark';
  }

  /** Apply a theme to <html> and sync the browser chrome colour. */
  function apply(theme) {
    root.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f6f6fb' : '#09090c');
  }

  /** Persist + apply. `mode` may be 'dark' | 'light' | 'auto'. */
  function set(mode) {
    try { localStorage.setItem(STORAGE_KEY, mode); } catch (e) { /* ignore */ }
    apply(mode === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : mode);
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: root.getAttribute('data-theme') } }));
  }

  // Apply immediately — before first paint.
  apply(resolve());

  // Public API used by the toggle button and the settings page.
  window.NebulaTheme = {
    set: set,
    get: function () { return root.getAttribute('data-theme'); },
    stored: function () {
      try { return localStorage.getItem(STORAGE_KEY) || 'dark'; } catch (e) { return 'dark'; }
    },
    toggle: function () { set(root.getAttribute('data-theme') === 'light' ? 'dark' : 'light'); }
  };

  // Follow the OS when the user hasn't made an explicit choice.
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function () {
    if (window.NebulaTheme.stored() === 'auto') apply(resolve());
  });

  // Wire up any theme toggle buttons once the DOM is ready.
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () { window.NebulaTheme.toggle(); });
    });
  });
})();
