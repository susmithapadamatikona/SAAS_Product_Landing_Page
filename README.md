# Stackly AI — Premium AI SaaS Website

A complete, production-ready AI SaaS product website built with **HTML5, CSS3 and vanilla JavaScript only**.
No React, no Bootstrap, no Tailwind, no jQuery, no build step, no backend.

Open `index.html` in a browser, or serve the folder with any static server.

---

## Pages (25)

**Marketing** — `index.html` · `about.html` · `features.html` · `pricing.html` · `blog.html` ·
`blog-details.html` · `faq.html` · `contact.html` · `privacy-policy.html` · `terms.html` · `404.html`

**Authentication** — `login.html` · `signup.html` · `forgot-password.html` · `verify-email.html`

**Dashboard (protected)** — `dashboard.html` · `analytics.html` · `projects.html` · `calendar.html` ·
`messages.html` · `invoices.html` · `team.html` · `notifications.html` · `profile.html` · `settings.html`

---

## Structure

```
index.html … 404.html          25 static pages
assets/
  css/
    style.css                  design tokens, layout, components, sections
    responsive.css             1440 / 1200 / 1024 / 900 / 768 / 560 / 480 breakpoints
    animations.css             keyframes, scroll-reveal, micro-interactions
    dashboard.css              app shell: sidebar, topbar, widgets, tables
    authentication.css         login / signup / OTP / strength meter
  js/
    theme.js                   dark/light/auto, persisted, loaded before paint
    main.js                    loader, scroll reveal, ripple, parallax, particles,
                               cursor glow, typing, modals, toasts, blog search
    navbar.js                  sticky header, mobile drawer, active link
    validation.js              form rules + localStorage auth + route guards
    dashboard.js               sidebar, dropdowns, tabs, tasks, calendar, settings
    chart.js                   canvas charting engine (area/bar/doughnut/sparkline)
    slider.js                  testimonial carousel + infinite logo marquee
    counter.js                 animated statistics
    accordion.js               single-open FAQ
    pricing.js                 monthly/yearly billing toggle
  images/
    blog/                      10 post covers + a wide article hero (SVG)
    map.svg                    stylised office map
    og-cover.png               1200×630 social share card
  icons/  videos/  fonts/
```

## Imagery

All artwork is **self-contained SVG**, drawn from the same palette as the CSS — no stock photos,
no external CDN, nothing to go stale. Each blog post gets its own cover (a neural graph, a rising
bar chart, a shield, a workflow chain, stacked layers, an orbit) tinted with a different accent,
so the grid reads as an intentional editorial system rather than a row of identical placeholders.
The article hero actually diagrams the piece it illustrates. Every image carries descriptive
`alt` text, explicit `width`/`height` (no layout shift) and `loading="lazy"` below the fold.

Faces are **typographic monograms**, not stock photography or silhouette icons — a deliberate
choice (the pattern Linear, GitHub and Notion use). Each person gets a distinct gradient via
`.av-1`…`.av-8`, so a team grid never looks like eight identical placeholder circles.

## Theming

The palette lives in CSS custom properties at the top of `style.css`. A `[data-theme='light']`
block overrides them, so switching themes re-skins the whole site — charts included, since
`chart.js` reads its colours from the same variables and repaints on `themechange`.

Stackly is **dark-first**: with no stored preference the site uses dark, regardless of the OS
setting. The OS is only followed once a user explicitly picks *System* in Settings → Appearance.

## Charts

The brief asked for Chart.js but also for no libraries, so `assets/js/chart.js` is a small
hand-rolled canvas renderer with a similar shape:

```js
NebulaChart.area(canvas,      { labels, datasets, formatY, formatTip });
NebulaChart.bar(canvas,       { labels, datasets });
NebulaChart.doughnut(canvas,  { segments, centerLabel, centerValue });
NebulaChart.sparkline(canvas, { data, color });
```

HiDPI-aware, animated on first paint, hover tooltips, and redrawn on resize and theme change.

## Authentication (front-end only)

⚠️ **Demo only — not a security control.** Accounts live in `localStorage`, and the "password
hash" in `validation.js` is a non-cryptographic digest used purely so plain-text passwords
aren't sitting in storage. Any real product must authenticate on a server. Do not reuse this.

- **Signup** stores the user, then routes to `verify-email.html` (any 6-digit code verifies).
- **Login** validates against the stored account. *Remember me* uses `localStorage`
  (survives a browser restart); otherwise `sessionStorage` (ends with the tab).
- **Protected pages** carry `<body data-protected>` and bounce to `login.html` when signed out,
  returning you to the page you wanted after sign-in.
- **Auth pages** carry `<body data-guest-only>` and bounce signed-in users to the dashboard.

To try it quickly: on `login.html` click **Fill demo credentials** → `demo@nebula.ai` / `Nebula2026`.

## Accessibility & SEO

Semantic landmarks, skip links, ARIA on every interactive control, visible focus rings,
`prefers-reduced-motion` support, and keyboard operation throughout (the off-canvas menus are
`visibility: hidden` when closed, so they stay out of the tab order). Every page ships a unique
title and meta description, Open Graph and Twitter Card tags, and JSON-LD where it applies
(`SoftwareApplication`, `Product`, `FAQPage`, `BlogPosting`).
