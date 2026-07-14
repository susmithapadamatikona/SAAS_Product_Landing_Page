/**
 * validation.js — Form validation + front-end-only authentication.
 *
 * NOTE ON SECURITY
 * This is a static, front-end-only demo. Accounts live in localStorage and the
 * "password hash" below is a non-cryptographic digest used purely so plain-text
 * passwords are not sitting in storage. It is NOT a security control — any real
 * product must authenticate on a server. Nothing here should be reused as-is.
 */
(function () {
  'use strict';

  var USERS_KEY = 'nebula:users';
  var SESSION_KEY = 'nebula:session';

  var toast = function () {
    return (window.Nebula && window.Nebula.toast)
      ? window.Nebula.toast.apply(null, arguments)
      : undefined;
  };

  /* ===============================================================
     Validators
     =============================================================== */
  var Validate = {
    required: function (v) { return v.trim().length > 0; },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.trim()); },
    phone: function (v) { return /^[+]?[\d\s()-]{7,18}$/.test(v.trim()); },
    minLength: function (v, n) { return v.length >= n; },
    password: function (v) { return v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v); },
    name: function (v) { return v.trim().length >= 2 && /^[a-zÀ-ɏ\s'.-]+$/i.test(v.trim()); }
  };

  /* ===============================================================
     Auth store
     =============================================================== */
  function readUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
    catch (e) { return []; }
  }

  function writeUsers(users) {
    try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch (e) { /* quota */ }
  }

  /** Non-cryptographic digest (djb2). Demo obfuscation only — see file header. */
  function digest(str) {
    var hash = 5381;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
    }
    return 'd' + (hash >>> 0).toString(36);
  }

  function readSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY));
    } catch (e) { return null; }
  }

  /** "ada.lovelace@corp.com" -> "Ada Lovelace", so a guest session still has a name. */
  function nameFromEmail(email) {
    return String(email).split('@')[0]
      .split(/[._-]+/)
      .filter(Boolean)
      .map(function (part) { return part.charAt(0).toUpperCase() + part.slice(1); })
      .join(' ') || 'There';
  }

  var Auth = {
    /** @returns {{ok:boolean, error?:string, user?:object}} */
    signup: function (data) {
      var users = readUsers();
      if (users.some(function (u) { return u.email.toLowerCase() === data.email.toLowerCase(); })) {
        return { ok: false, error: 'An account with this email already exists.' };
      }

      var user = {
        id: 'u_' + Date.now().toString(36),
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        phone: (data.phone || '').trim(),
        company: (data.company || '').trim(),
        role: (data.role || 'Team Member').trim(),
        password: digest(data.password),
        plan: 'Professional',
        createdAt: new Date().toISOString()
      };

      users.push(user);
      writeUsers(users);
      return { ok: true, user: user };
    },

    /**
     * Sign in.
     *
     * This is a front-end demo, so signing in does NOT require a prior signup:
     * if the email has no account we mint a guest session on the spot and let
     * the user straight through to the dashboard. An email that *does* have an
     * account still has its password checked, so the registered flow keeps
     * working as you'd expect.
     */
    login: function (email, password, remember, role) {
      var clean = email.trim().toLowerCase();
      var user = readUsers().filter(function (u) {
        return u.email.toLowerCase() === clean;
      })[0];

      if (user) {
        if (user.password !== digest(password)) {
          return { ok: false, error: 'Incorrect password. Please try again.' };
        }
        // Honour the role picked on the sign-in form for this session.
        if (role) user.role = role;
        this.startSession(user, remember);
        return { ok: true, user: user, guest: false };
      }

      // No account: create a guest session from what was typed.
      var guest = {
        id: 'g_' + Date.now().toString(36),
        name: nameFromEmail(clean),
        email: clean,
        role: role || 'Team Member',
        plan: 'Professional',
        guest: true
      };
      this.startSession(guest, remember);
      return { ok: true, user: guest, guest: true };
    },

    startSession: function (user, remember) {
      var session = JSON.stringify({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role || 'Team Member',
        plan: user.plan,
        guest: !!user.guest,
        at: Date.now()
      });
      try {
        // "Remember me" survives a browser restart; otherwise the session ends with the tab.
        (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, session);
        (remember ? sessionStorage : localStorage).removeItem(SESSION_KEY);
      } catch (e) { /* storage unavailable */ }
    },

    /**
     * The signed-in user, hydrated from the stored account.
     * The session itself only holds identity (id/name/email/plan), so we merge
     * in the full record — otherwise fields like phone and company would be
     * invisible to the profile page.
     */
    current: function () {
      var session = readSession();
      if (!session) return null;

      var user = readUsers().filter(function (u) { return u.id === session.id; })[0];
      if (!user) return session; // account was deleted; session is all we have

      var merged = Object.assign({}, user, { at: session.at });
      delete merged.password;
      return merged;
    },

    update: function (patch) {
      var session = readSession();
      if (!session) return null;

      var users = readUsers();
      var index = users.findIndex(function (u) { return u.id === session.id; });
      if (index > -1) {
        users[index] = Object.assign({}, users[index], patch);
        writeUsers(users);
      }

      var merged = Object.assign({}, session, patch);
      delete merged.password;
      var store = localStorage.getItem(SESSION_KEY) ? localStorage : sessionStorage;
      try { store.setItem(SESSION_KEY, JSON.stringify(merged)); } catch (e) { /* ignore */ }
      return merged;
    },

    changePassword: function (currentPw, nextPw) {
      var session = readSession();
      if (!session) return { ok: false, error: 'You are not signed in.' };

      var users = readUsers();
      var index = users.findIndex(function (u) { return u.id === session.id; });
      if (index < 0) return { ok: false, error: 'Account not found.' };
      if (users[index].password !== digest(currentPw)) {
        return { ok: false, error: 'Your current password is incorrect.' };
      }

      users[index].password = digest(nextPw);
      writeUsers(users);
      return { ok: true };
    },

    logout: function () {
      try {
        localStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(SESSION_KEY);
      } catch (e) { /* ignore */ }
      window.location.href = 'login.html';
    },

    deleteAccount: function () {
      var session = readSession();
      if (session) {
        writeUsers(readUsers().filter(function (u) { return u.id !== session.id; }));
      }
      this.logout();
    }
  };

  window.NebulaAuth = Auth;

  /* ===============================================================
     Route guards — run immediately, before the page renders content
     =============================================================== */
  (function guard() {
    var body = document.body;
    if (!body) return;

    // Dashboard pages: bounce to login when there is no session.
    if (body.hasAttribute('data-protected') && !Auth.current()) {
      sessionStorage.setItem('nebula:redirect', window.location.pathname.split('/').pop());
      window.location.replace('login.html');
      return;
    }

    // Auth pages: an already-signed-in user goes straight to the dashboard.
    if (body.hasAttribute('data-guest-only') && Auth.current()) {
      window.location.replace('dashboard.html');
    }
  })();

  /* ===============================================================
     Field-level helpers
     =============================================================== */
  function fieldOf(input) { return input.closest('.field') || input.parentElement; }

  function setError(input, message) {
    var field = fieldOf(input);
    field.classList.add('has-error');
    field.classList.remove('is-valid');

    var msg = field.querySelector('.error-msg');
    if (!msg) {
      msg = document.createElement('span');
      msg.className = 'error-msg';
      field.appendChild(msg);
    }
    msg.textContent = message;
    input.setAttribute('aria-invalid', 'true');
  }

  function clearError(input, markValid) {
    var field = fieldOf(input);
    field.classList.remove('has-error');
    field.classList.toggle('is-valid', !!markValid);
    input.removeAttribute('aria-invalid');
  }

  /**
   * Validate one input from its data-* rules.
   * Supported: data-rule="required|email|phone|password|name"
   *            data-min="8", data-match="#otherInputId"
   */
  function checkInput(input) {
    var value = input.value || '';
    var rules = (input.getAttribute('data-rule') || '').split('|').filter(Boolean);
    var label = input.getAttribute('data-label') || 'This field';

    for (var i = 0; i < rules.length; i++) {
      var rule = rules[i];

      if (rule === 'required' && !Validate.required(value)) {
        setError(input, label + ' is required.');
        return false;
      }
      if (!value.trim() && rule !== 'required') continue; // only 'required' cares about empties

      if (rule === 'email' && !Validate.email(value)) {
        setError(input, 'Enter a valid email address.');
        return false;
      }
      if (rule === 'phone' && !Validate.phone(value)) {
        setError(input, 'Enter a valid phone number.');
        return false;
      }
      if (rule === 'name' && !Validate.name(value)) {
        setError(input, 'Enter your full name (letters only).');
        return false;
      }
      if (rule === 'password' && !Validate.password(value)) {
        setError(input, 'Use at least 8 characters with a letter and a number.');
        return false;
      }
      if (rule === 'min') {
        var min = parseInt(input.getAttribute('data-min'), 10) || 3;
        if (!Validate.minLength(value.trim(), min)) {
          setError(input, label + ' must be at least ' + min + ' characters.');
          return false;
        }
      }
      if (rule === 'match') {
        var other = document.querySelector(input.getAttribute('data-match'));
        if (other && other.value !== value) {
          setError(input, 'Passwords do not match.');
          return false;
        }
      }
    }

    // Checkboxes flagged as required (terms).
    if (input.type === 'checkbox' && input.hasAttribute('data-require-checked') && !input.checked) {
      setError(input, 'You must accept the terms to continue.');
      return false;
    }

    clearError(input, value.trim().length > 0);
    return true;
  }

  function validateForm(form) {
    var inputs = Array.prototype.slice.call(form.querySelectorAll('[data-rule], [data-require-checked]'));
    var valid = true;
    var firstBad = null;

    inputs.forEach(function (input) {
      if (!checkInput(input)) {
        valid = false;
        if (!firstBad) firstBad = input;
      }
    });

    if (firstBad) firstBad.focus();
    return valid;
  }

  /** Live validation: validate on blur, and clear errors as the user fixes them. */
  function wireLiveValidation(form) {
    form.querySelectorAll('[data-rule], [data-require-checked]').forEach(function (input) {
      input.addEventListener('blur', function () { checkInput(input); });
      input.addEventListener('input', function () {
        if (fieldOf(input).classList.contains('has-error')) checkInput(input);
      });
      if (input.type === 'checkbox') {
        input.addEventListener('change', function () { checkInput(input); });
      }
    });
  }

  /** Put a button into its loading state and return a reset function. */
  function loading(btn) {
    btn.classList.add('is-loading');
    return function () { btn.classList.remove('is-loading'); };
  }

  /* ===============================================================
     Show / hide password
     =============================================================== */
  function initPasswordToggles() {
    document.querySelectorAll('[data-toggle-password]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var input = document.querySelector(btn.getAttribute('data-toggle-password'));
        if (!input) return;

        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.classList.toggle('is-visible', show);
        btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      });
    });
  }

  /* ===============================================================
     Password strength meter
     =============================================================== */
  var STRENGTH_LABELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];

  function scorePassword(value) {
    var checks = {
      length: value.length >= 8,
      case: /[a-z]/.test(value) && /[A-Z]/.test(value),
      number: /\d/.test(value),
      symbol: /[^A-Za-z0-9]/.test(value)
    };
    var score = Object.keys(checks).reduce(function (n, k) { return n + (checks[k] ? 1 : 0); }, 0);
    if (value.length >= 14 && score >= 3) score = 4;
    return { score: value ? score : 0, checks: checks };
  }

  function initStrengthMeter() {
    var meter = document.querySelector('.strength');
    if (!meter) return;

    var input = document.querySelector(meter.getAttribute('data-for'));
    if (!input) return;

    var labelEl = meter.querySelector('b');
    var hints = Array.prototype.slice.call(document.querySelectorAll('.password-hints li'));

    input.addEventListener('input', function () {
      var result = scorePassword(input.value);
      meter.setAttribute('data-level', result.score);
      if (labelEl) labelEl.textContent = STRENGTH_LABELS[result.score];

      hints.forEach(function (hint) {
        var key = hint.getAttribute('data-check');
        hint.classList.toggle('is-met', !!result.checks[key]);
      });
    });
  }

  /* ===============================================================
     Login
     =============================================================== */
  function initLogin() {
    var form = document.getElementById('loginForm');
    if (!form) return;

    wireLiveValidation(form);

    // Arriving straight from signup: prefill the email they just registered
    // and put the cursor in the password field.
    try {
      var justSignedUp = sessionStorage.getItem('nebula:pending');
      if (justSignedUp) {
        form.email.value = justSignedUp;
        sessionStorage.removeItem('nebula:pending');
        if (form.password) form.password.focus();
      }
    } catch (err) { /* storage unavailable */ }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validateForm(form)) return;

      var btn = form.querySelector('button[type="submit"]');
      var done = loading(btn);

      // Simulated network latency so the loading state is visible.
      setTimeout(function () {
        var result = Auth.login(
          form.email.value,
          form.password.value,
          form.remember && form.remember.checked,
          form.role ? form.role.value : ''
        );
        done();

        if (!result.ok) {
          toast('Sign in failed', result.error, 'error');
          return;
        }

        toast(
          result.guest ? 'Signed in' : 'Welcome back!',
          result.guest
            ? 'Exploring as ' + result.user.role + ' — taking you to the dashboard…'
            : 'Redirecting you to your dashboard…',
          'success',
          2000
        );
        var back = sessionStorage.getItem('nebula:redirect');
        sessionStorage.removeItem('nebula:redirect');
        setTimeout(function () {
          window.location.href = back || 'dashboard.html';
        }, 900);
      }, 850);
    });

    // Demo account helper.
    var demo = document.getElementById('demoFill');
    if (demo) {
      demo.addEventListener('click', function (e) {
        e.preventDefault();
        var users = readUsers();
        if (!users.some(function (u) { return u.email === 'demo@nebula.ai'; })) {
          Auth.signup({ name: 'Demo User', email: 'demo@nebula.ai', password: 'Nebula2026', company: 'Nebula AI' });
        }
        form.email.value = 'demo@nebula.ai';
        form.password.value = 'Nebula2026';
        toast('Demo credentials filled', 'Press "Sign in" to continue.', 'info');
      });
    }
  }

  /* ===============================================================
     Signup
     =============================================================== */
  function initSignup() {
    var form = document.getElementById('signupForm');
    if (!form) return;

    wireLiveValidation(form);
    initStrengthMeter();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validateForm(form)) return;

      var btn = form.querySelector('button[type="submit"]');
      var done = loading(btn);

      setTimeout(function () {
        var result = Auth.signup({
          name: form.fullName.value,
          email: form.email.value,
          phone: form.phone.value,
          company: form.company.value,
          role: form.role ? form.role.value : '',
          password: form.password.value
        });
        done();

        if (!result.ok) {
          toast('Could not create account', result.error, 'error');
          return;
        }

        // Carry the address over so the login form can prefill it.
        try { sessionStorage.setItem('nebula:pending', result.user.email); } catch (err) { /* ignore */ }

        toast('Account created!', 'Sign in with your new account to continue.', 'success', 2500);
        setTimeout(function () { window.location.href = 'login.html'; }, 1100);
      }, 950);
    });
  }

  /* ===============================================================
     Forgot password
     =============================================================== */
  function initForgot() {
    var form = document.getElementById('forgotForm');
    if (!form) return;

    wireLiveValidation(form);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validateForm(form)) return;

      var btn = form.querySelector('button[type="submit"]');
      var done = loading(btn);

      setTimeout(function () {
        done();
        var sent = document.getElementById('forgotSent');
        var target = document.getElementById('sentTo');
        if (target) target.textContent = form.email.value.trim();

        if (sent) {
          form.closest('.auth-card__inner').classList.add('hidden');
          sent.classList.remove('hidden');
        }
        toast('Reset link sent', 'Check your inbox for the reset instructions.', 'success');
      }, 900);
    });
  }

  /* ===============================================================
     Verify email — OTP boxes + resend countdown
     =============================================================== */
  function initOtp() {
    var otp = document.querySelector('.otp');
    if (!otp) return;

    var inputs = Array.prototype.slice.call(otp.querySelectorAll('input'));
    var form = document.getElementById('otpForm');
    var emailOut = document.getElementById('otpEmail');

    if (emailOut) {
      var pending = sessionStorage.getItem('nebula:pending');
      if (pending) emailOut.textContent = pending;
    }

    inputs.forEach(function (input, i) {
      input.addEventListener('input', function () {
        // Keep a single digit per box; overflow moves forward.
        var digits = input.value.replace(/\D/g, '');
        input.value = digits.slice(0, 1);
        input.classList.toggle('is-filled', !!input.value);
        otp.classList.remove('has-error');

        if (input.value && i < inputs.length - 1) inputs[i + 1].focus();
        if (inputs.every(function (el) { return el.value; })) {
          if (form) form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true }));
        }
      });

      input.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !input.value && i > 0) inputs[i - 1].focus();
        if (e.key === 'ArrowLeft' && i > 0) inputs[i - 1].focus();
        if (e.key === 'ArrowRight' && i < inputs.length - 1) inputs[i + 1].focus();
      });

      input.addEventListener('paste', function (e) {
        e.preventDefault();
        var text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
        inputs.forEach(function (el, index) {
          el.value = text[index] || '';
          el.classList.toggle('is-filled', !!el.value);
        });
        (inputs[Math.min(text.length, inputs.length - 1)] || input).focus();
      });
    });

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var code = inputs.map(function (el) { return el.value; }).join('');

        if (code.length < inputs.length) {
          otp.classList.add('has-error');
          toast('Incomplete code', 'Enter all 6 digits to continue.', 'error');
          return;
        }

        var btn = form.querySelector('button[type="submit"]');
        var done = loading(btn);

        // Demo: any 6-digit code verifies. A real flow checks this server-side.
        setTimeout(function () {
          done();
          var pending = sessionStorage.getItem('nebula:pending');
          var user = readUsers().filter(function (u) { return u.email === pending; })[0];

          if (user) Auth.startSession(user, false);
          sessionStorage.removeItem('nebula:pending');

          var card = document.getElementById('otpCard');
          var success = document.getElementById('otpSuccess');
          if (card && success) {
            card.classList.add('hidden');
            success.classList.remove('hidden');
          }
          toast('Email verified!', 'Your account is ready to go.', 'success');
          setTimeout(function () {
            window.location.href = user ? 'dashboard.html' : 'login.html';
          }, 1800);
        }, 900);
      });
    }

    /* Resend countdown */
    var countdownEl = document.querySelector('.countdown');
    var resendBtn = document.getElementById('resendOtp');
    if (!countdownEl || !resendBtn) return;

    var timer = null;

    function startCountdown(seconds) {
      resendBtn.disabled = true;
      var remaining = seconds;

      function tick() {
        var m = String(Math.floor(remaining / 60)).padStart(2, '0');
        var s = String(remaining % 60).padStart(2, '0');
        countdownEl.textContent = m + ':' + s;

        if (remaining <= 0) {
          clearInterval(timer);
          resendBtn.disabled = false;
          countdownEl.textContent = '00:00';
          return;
        }
        remaining--;
      }

      tick();
      clearInterval(timer);
      timer = setInterval(tick, 1000);
    }

    resendBtn.addEventListener('click', function () {
      startCountdown(60);
      inputs.forEach(function (el) { el.value = ''; el.classList.remove('is-filled'); });
      inputs[0].focus();
      toast('Code resent', 'A new 6-digit code is on its way.', 'info');
    });

    startCountdown(60);
    inputs[0].focus();
  }

  /* ===============================================================
     Contact form
     =============================================================== */
  function initContact() {
    var form = document.getElementById('contactForm');
    if (!form) return;

    wireLiveValidation(form);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validateForm(form)) return;

      var btn = form.querySelector('button[type="submit"]');
      var done = loading(btn);

      setTimeout(function () {
        done();
        form.reset();
        form.querySelectorAll('.field').forEach(function (f) { f.classList.remove('is-valid', 'has-error'); });
        toast('Message sent!', 'Our team replies within one business day.', 'success', 5000);
      }, 1000);
    });
  }

  /* ===============================================================
     Logout buttons (dashboard shell)
     =============================================================== */
  function initLogout() {
    document.querySelectorAll('[data-logout]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        toast('Signed out', 'See you soon!', 'info', 1500);
        setTimeout(function () { Auth.logout(); }, 700);
      });
    });
  }

  /* ===============================================================
     Boot
     =============================================================== */
  document.addEventListener('DOMContentLoaded', function () {
    initPasswordToggles();
    initLogin();
    initSignup();
    initForgot();
    initOtp();
    initContact();
    initLogout();

    // Any other form marked [data-validate] gets generic handling.
    document.querySelectorAll('form[data-validate]').forEach(function (form) {
      if (form.id) return; // already handled above
      wireLiveValidation(form);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!validateForm(form)) return;
        toast('Saved', 'Your changes have been applied.', 'success');
      });
    });
  });

  // Expose validators for reuse (settings/profile pages).
  window.NebulaValidate = {
    rules: Validate,
    validateForm: validateForm,
    wire: wireLiveValidation,
    loading: loading,
    setError: setError,
    clearError: clearError
  };
})();
