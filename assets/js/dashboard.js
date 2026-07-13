/**
 * dashboard.js — App shell behaviour.
 * Sidebar collapse/drawer, dropdowns, notifications, tabs, tasks,
 * calendar widget, session binding and chart bootstrapping.
 */
(function () {
  'use strict';

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var toast = function () {
    return window.Nebula ? window.Nebula.toast.apply(null, arguments) : undefined;
  };

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.querySelector('.app')) return;

    bindSession();
    initSidebar();
    initDropdowns();
    initTabs();
    initTasks();
    initCalendar();
    initCharts();
    initSettings();
    initProfile();
  });

  /* ---------------------------------------------------------------
     Session → UI
     --------------------------------------------------------------- */
  function bindSession() {
    var user = window.NebulaAuth && window.NebulaAuth.current();
    if (!user) return;

    var initials = user.name.split(/\s+/).map(function (w) { return w[0]; })
      .slice(0, 2).join('').toUpperCase();

    $$('[data-user-name]').forEach(function (el) { el.textContent = user.name; });
    $$('[data-user-email]').forEach(function (el) { el.textContent = user.email; });
    $$('[data-user-plan]').forEach(function (el) { el.textContent = user.plan || 'Professional'; });
    $$('[data-user-initials]').forEach(function (el) { el.textContent = initials; });
    $$('[data-user-first]').forEach(function (el) { el.textContent = user.name.split(' ')[0]; });
  }

  /* ---------------------------------------------------------------
     Sidebar
     --------------------------------------------------------------- */
  function initSidebar() {
    var app = $('.app');
    var sidebar = $('.sidebar');
    var collapseBtn = $('.sidebar__collapse');
    var mobileToggle = $('.topbar__toggle');
    var overlay = $('.overlay');

    // Restore the collapsed preference.
    try {
      if (localStorage.getItem('nebula:sidebar') === 'collapsed') app.classList.add('is-collapsed');
    } catch (e) { /* ignore */ }

    if (collapseBtn) {
      collapseBtn.addEventListener('click', function () {
        app.classList.toggle('is-collapsed');
        try {
          localStorage.setItem('nebula:sidebar', app.classList.contains('is-collapsed') ? 'collapsed' : 'expanded');
        } catch (e) { /* ignore */ }
        setTimeout(function () {
          if (window.NebulaChart) window.NebulaChart.redrawAll();
        }, 320);
      });
    }

    function closeMobile() {
      sidebar.classList.remove('is-open');
      if (overlay) overlay.classList.remove('is-open');
      document.body.classList.remove('no-scroll');
    }

    if (mobileToggle) {
      mobileToggle.addEventListener('click', function () {
        var open = sidebar.classList.toggle('is-open');
        if (overlay) overlay.classList.toggle('is-open', open);
        document.body.classList.toggle('no-scroll', open);
      });
    }

    if (overlay) overlay.addEventListener('click', closeMobile);
    sidebar.addEventListener('click', function (e) {
      if (e.target.closest('a') && window.innerWidth <= 1024) closeMobile();
    });

    // Highlight the current page.
    var page = window.location.pathname.split('/').pop() || 'dashboard.html';
    $$('.side-link').forEach(function (link) {
      var href = (link.getAttribute('href') || '').split('/').pop();
      link.classList.toggle('is-active', href === page);
    });
  }

  /* ---------------------------------------------------------------
     Dropdowns (notifications + profile)
     --------------------------------------------------------------- */
  function initDropdowns() {
    var dropdowns = $$('.dropdown');

    dropdowns.forEach(function (dropdown) {
      var trigger = dropdown.querySelector('[data-dropdown-trigger]');
      if (!trigger) return;

      trigger.setAttribute('aria-haspopup', 'true');
      trigger.setAttribute('aria-expanded', 'false');

      trigger.addEventListener('click', function (e) {
        e.stopPropagation();
        var willOpen = !dropdown.classList.contains('is-open');
        dropdowns.forEach(function (d) {
          d.classList.remove('is-open');
          var t = d.querySelector('[data-dropdown-trigger]');
          if (t) t.setAttribute('aria-expanded', 'false');
        });
        dropdown.classList.toggle('is-open', willOpen);
        trigger.setAttribute('aria-expanded', String(willOpen));
      });

      dropdown.addEventListener('click', function (e) { e.stopPropagation(); });
    });

    document.addEventListener('click', function () {
      dropdowns.forEach(function (d) {
        d.classList.remove('is-open');
        var t = d.querySelector('[data-dropdown-trigger]');
        if (t) t.setAttribute('aria-expanded', 'false');
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') dropdowns.forEach(function (d) { d.classList.remove('is-open'); });
    });

    // Mark all notifications as read.
    var markAll = $('[data-mark-read]');
    if (markAll) {
      markAll.addEventListener('click', function () {
        $$('.notif-unread').forEach(function (n) { n.classList.remove('notif-unread'); });
        var dot = $('.icon-btn__dot');
        if (dot) dot.remove();
        toast('All caught up', 'Notifications marked as read.', 'success');
      });
    }
  }

  /* ---------------------------------------------------------------
     Tabs
     --------------------------------------------------------------- */
  function initTabs() {
    $$('.tabs').forEach(function (group) {
      var tabs = $$('.tab', group);

      tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
          var target = tab.getAttribute('data-tab');

          tabs.forEach(function (t) {
            t.classList.toggle('is-active', t === tab);
            t.setAttribute('aria-selected', String(t === tab));
          });

          $$('.tab-panel').forEach(function (panel) {
            panel.classList.toggle('is-active', panel.id === target);
          });

          if (window.NebulaChart) setTimeout(window.NebulaChart.redrawAll, 60);
        });
      });
    });
  }

  /* ---------------------------------------------------------------
     Task list
     --------------------------------------------------------------- */
  function initTasks() {
    $$('.task input[type="checkbox"]').forEach(function (box) {
      box.addEventListener('change', function () {
        var task = box.closest('.task');
        task.classList.toggle('is-done', box.checked);
        if (box.checked) toast('Task completed', task.querySelector('.task__text').textContent, 'success', 2200);
      });
    });
  }

  /* ---------------------------------------------------------------
     Calendar widget
     --------------------------------------------------------------- */
  function initCalendar() {
    var calendar = $('.calendar');
    if (!calendar) return;

    var grid = $('.calendar__grid', calendar);
    var monthLabel = $('.calendar__month', calendar);
    var prev = $('[data-cal-prev]', calendar);
    var next = $('[data-cal-next]', calendar);

    var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    var DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    var today = new Date();
    var view = new Date(today.getFullYear(), today.getMonth(), 1);

    // A few demo events, keyed by day-of-month.
    var events = [4, 9, 12, 18, 23, 27];

    function render() {
      grid.innerHTML = '';
      monthLabel.textContent = MONTHS[view.getMonth()] + ' ' + view.getFullYear();

      DOW.forEach(function (d) {
        var cell = document.createElement('span');
        cell.className = 'calendar__dow';
        cell.textContent = d;
        grid.appendChild(cell);
      });

      var firstDay = new Date(view.getFullYear(), view.getMonth(), 1).getDay();
      var daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
      var daysInPrev = new Date(view.getFullYear(), view.getMonth(), 0).getDate();

      // Leading days from the previous month.
      for (var i = firstDay - 1; i >= 0; i--) {
        addDay(daysInPrev - i, true);
      }

      var isCurrentMonth =
        view.getMonth() === today.getMonth() && view.getFullYear() === today.getFullYear();

      for (var d = 1; d <= daysInMonth; d++) {
        var cell = addDay(d, false);
        if (isCurrentMonth && d === today.getDate()) cell.classList.add('is-today');
        if (events.indexOf(d) > -1) cell.classList.add('has-event');
      }

      // Trailing days to complete the last week.
      var used = firstDay + daysInMonth;
      var trailing = (7 - (used % 7)) % 7;
      for (var t = 1; t <= trailing; t++) addDay(t, true);
    }

    function addDay(number, muted) {
      var cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'calendar__day' + (muted ? ' is-empty' : '');
      cell.textContent = number;
      if (!muted) {
        cell.addEventListener('click', function () {
          $$('.calendar__day', calendar).forEach(function (d) {
            if (!d.classList.contains('is-today')) d.style.background = '';
          });
          cell.style.background = 'rgba(109,93,246,.2)';
        });
      }
      grid.appendChild(cell);
      return cell;
    }

    if (prev) prev.addEventListener('click', function () {
      view.setMonth(view.getMonth() - 1);
      render();
    });
    if (next) next.addEventListener('click', function () {
      view.setMonth(view.getMonth() + 1);
      render();
    });

    render();
  }

  /* ---------------------------------------------------------------
     Charts
     --------------------------------------------------------------- */
  function initCharts() {
    if (!window.NebulaChart) return;

    var css = getComputedStyle(document.documentElement);
    var purple = css.getPropertyValue('--purple').trim() || '#6d5df6';
    var neon = css.getPropertyValue('--purple-neon').trim() || '#b8a7ff';
    var success = css.getPropertyValue('--success').trim() || '#35d39a';
    var info = css.getPropertyValue('--info').trim() || '#56b6ff';
    var warning = css.getPropertyValue('--warning').trim() || '#f7b955';

    /* Revenue area chart */
    var revenue = document.getElementById('revenueChart');
    if (revenue) {
      var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      var data2026 = [42, 51, 48, 64, 72, 69, 85, 94, 88, 104, 118, 132];
      var data2025 = [28, 33, 31, 42, 47, 44, 55, 61, 58, 67, 74, 82];

      var chart = window.NebulaChart.area(revenue, {
        labels: months,
        height: 300,
        formatY: function (v) { return '$' + Math.round(v) + 'k'; },
        formatTip: function (v) { return '$' + v + 'k'; },
        datasets: [
          { label: 'This year', data: data2026, color: purple },
          { label: 'Last year', data: data2025, color: neon, fill: false }
        ]
      });

      // Range segmented control re-slices the same series.
      $$('[data-range]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          $$('[data-range]').forEach(function (b) { b.classList.remove('is-active'); });
          btn.classList.add('is-active');

          var range = parseInt(btn.getAttribute('data-range'), 10);
          var slice = function (arr) { return arr.slice(-range); };

          chart = window.NebulaChart.area(revenue, {
            labels: slice(months),
            height: 300,
            formatY: function (v) { return '$' + Math.round(v) + 'k'; },
            formatTip: function (v) { return '$' + v + 'k'; },
            datasets: [
              { label: 'This year', data: slice(data2026), color: purple },
              { label: 'Last year', data: slice(data2025), color: neon, fill: false }
            ]
          });
        });
      });
    }

    /* Traffic bar chart */
    window.NebulaChart.bar(document.getElementById('trafficChart'), {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      height: 260,
      formatY: function (v) { return Math.round(v) + 'k'; },
      datasets: [
        { label: 'Sessions', data: [18, 24, 21, 32, 28, 14, 11], color: purple },
        { label: 'Conversions', data: [7, 11, 9, 15, 13, 6, 4], color: neon }
      ]
    });

    /* Channel doughnut */
    window.NebulaChart.doughnut(document.getElementById('channelChart'), {
      height: 260,
      centerLabel: 'Sources',
      centerValue: '4',
      segments: [
        { label: 'Organic', value: 42, color: purple },
        { label: 'Direct', value: 26, color: neon },
        { label: 'Referral', value: 19, color: info },
        { label: 'Social', value: 13, color: success }
      ]
    });

    /* Analytics page charts */
    window.NebulaChart.area(document.getElementById('usersChart'), {
      labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'],
      height: 280,
      datasets: [
        { label: 'Active users', data: [1200, 1480, 1390, 1720, 1950, 2100, 2380, 2610], color: purple, showPoints: true }
      ]
    });

    window.NebulaChart.bar(document.getElementById('retentionChart'), {
      labels: ['D1', 'D3', 'D7', 'D14', 'D30', 'D60', 'D90'],
      height: 280,
      formatY: function (v) { return Math.round(v) + '%'; },
      datasets: [
        { label: 'Retention', data: [92, 78, 64, 55, 47, 41, 38], color: success }
      ]
    });

    window.NebulaChart.doughnut(document.getElementById('deviceChart'), {
      height: 280,
      centerLabel: 'Devices',
      centerValue: '3',
      segments: [
        { label: 'Desktop', value: 58, color: purple },
        { label: 'Mobile', value: 33, color: neon },
        { label: 'Tablet', value: 9, color: warning }
      ]
    });

    /* KPI sparklines */
    var sparks = {
      sparkRevenue: { data: [12, 18, 15, 22, 28, 25, 34, 39], color: purple },
      sparkUsers: { data: [8, 11, 10, 16, 14, 21, 24, 29], color: success },
      sparkSales: { data: [20, 17, 24, 21, 28, 26, 31, 36], color: info },
      sparkGrowth: { data: [5, 9, 7, 13, 16, 14, 19, 24], color: warning }
    };
    Object.keys(sparks).forEach(function (id) {
      window.NebulaChart.sparkline(document.getElementById(id), sparks[id]);
    });
  }

  /* ---------------------------------------------------------------
     Settings page
     --------------------------------------------------------------- */
  function initSettings() {
    // Theme picker.
    var options = $$('.theme-option');
    if (options.length && window.NebulaTheme) {
      var stored = window.NebulaTheme.stored();
      options.forEach(function (option) {
        option.classList.toggle('is-active', option.getAttribute('data-theme-value') === stored);
        option.addEventListener('click', function () {
          options.forEach(function (o) { o.classList.remove('is-active'); });
          option.classList.add('is-active');
          window.NebulaTheme.set(option.getAttribute('data-theme-value'));
          toast('Appearance updated', 'Theme set to ' + option.getAttribute('data-theme-value') + '.', 'success');
        });
      });
    }

    // Preference toggles persist locally.
    $$('.toggle input[data-pref]').forEach(function (input) {
      var key = 'nebula:pref:' + input.getAttribute('data-pref');
      try {
        var saved = localStorage.getItem(key);
        if (saved !== null) input.checked = saved === 'true';
      } catch (e) { /* ignore */ }

      input.addEventListener('change', function () {
        try { localStorage.setItem(key, String(input.checked)); } catch (e) { /* ignore */ }
        toast('Preferences saved', null, 'success', 1800);
      });
    });

    // Change password.
    var pwForm = document.getElementById('passwordForm');
    if (pwForm && window.NebulaValidate) {
      window.NebulaValidate.wire(pwForm);
      pwForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!window.NebulaValidate.validateForm(pwForm)) return;

        var result = window.NebulaAuth.changePassword(
          pwForm.currentPassword.value,
          pwForm.newPassword.value
        );

        if (!result.ok) {
          toast('Could not update password', result.error, 'error');
          return;
        }
        pwForm.reset();
        toast('Password updated', 'Use your new password next time you sign in.', 'success');
      });
    }

    // Delete account.
    var deleteBtn = $('[data-delete-account]');
    var deleteModal = document.getElementById('deleteModal');
    if (deleteBtn && deleteModal) {
      $('[data-confirm-delete]', deleteModal).addEventListener('click', function () {
        toast('Account deleted', 'We are sorry to see you go.', 'info', 1800);
        setTimeout(function () { window.NebulaAuth.deleteAccount(); }, 900);
      });
    }
  }

  /* ---------------------------------------------------------------
     Profile page
     --------------------------------------------------------------- */
  function initProfile() {
    var form = document.getElementById('profileForm');
    var user = window.NebulaAuth && window.NebulaAuth.current();

    if (form && user) {
      // Prefill from the stored account.
      if (form.fullName) form.fullName.value = user.name || '';
      if (form.email) form.email.value = user.email || '';
      if (form.phone) form.phone.value = user.phone || '';
      if (form.company) form.company.value = user.company || '';
      if (form.bio) form.bio.value = user.bio || '';

      window.NebulaValidate.wire(form);

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!window.NebulaValidate.validateForm(form)) return;

        window.NebulaAuth.update({
          name: form.fullName.value.trim(),
          phone: form.phone.value.trim(),
          company: form.company.value.trim(),
          bio: form.bio ? form.bio.value.trim() : ''
        });

        bindSession();
        toast('Profile updated', 'Your changes have been saved.', 'success');
      });
    }

    // Avatar upload — preview only (no backend).
    var upload = document.getElementById('avatarUpload');
    if (upload) {
      upload.addEventListener('change', function () {
        var file = upload.files && upload.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
          toast('Unsupported file', 'Choose a PNG or JPG image.', 'error');
          return;
        }
        if (file.size > 2 * 1024 * 1024) {
          toast('File too large', 'Avatars must be under 2 MB.', 'error');
          return;
        }

        var reader = new FileReader();
        reader.onload = function (e) {
          var avatar = $('.profile-avatar');
          avatar.style.backgroundImage = 'url(' + e.target.result + ')';
          avatar.style.backgroundSize = 'cover';
          avatar.style.backgroundPosition = 'center';
          avatar.style.color = 'transparent';
          toast('Avatar updated', 'Looking good!', 'success');
        };
        reader.readAsDataURL(file);
      });
    }
  }
})();
