/**
 * chart.js — Lightweight canvas charting engine (zero dependencies).
 *
 * The brief calls for "Chart.js graphs" but also for no frameworks/libraries,
 * so this is a hand-rolled, API-compatible-ish renderer covering the chart
 * types the dashboard needs: area/line, bar, doughnut and sparkline.
 *
 *   NebulaChart.area(canvas, { labels, datasets, ... })
 *   NebulaChart.bar(canvas, { labels, datasets, ... })
 *   NebulaChart.doughnut(canvas, { segments, ... })
 *   NebulaChart.sparkline(canvas, { data, color })
 *
 * Charts are HiDPI-aware, animate in on first paint, redraw on resize,
 * follow theme changes, and expose hover tooltips.
 */
(function () {
  'use strict';

  var instances = [];

  /* ---------------------------------------------------------------
     Canvas helpers
     --------------------------------------------------------------- */
  function palette() {
    var css = getComputedStyle(document.documentElement);
    var get = function (name, fallback) {
      return (css.getPropertyValue(name) || '').trim() || fallback;
    };
    return {
      purple: get('--purple', '#6d5df6'),
      purpleLight: get('--purple-neon', '#b8a7ff'),
      grid: get('--divider', '#232236'),
      text: get('--text-muted', '#74748e'),
      success: get('--success', '#35d39a'),
      info: get('--info', '#56b6ff'),
      warning: get('--warning', '#f7b955'),
      surface: get('--card-bg', '#1a1a2b')
    };
  }

  /** Size the backing store for the device pixel ratio. Returns {w,h}. */
  function fit(canvas, height) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var width = canvas.parentElement.clientWidth || canvas.clientWidth || 300;
    var h = height || parseInt(canvas.getAttribute('data-height'), 10) || 260;

    canvas.width = width * dpr;
    canvas.height = h * dpr;
    canvas.style.width = '100%';
    canvas.style.height = h + 'px';

    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: width, h: h };
  }

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  /** Run an animation from 0→1 over `duration` ms, calling draw(progress). */
  function animate(duration, draw) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      draw(1);
      return;
    }
    var start = performance.now();
    (function frame(now) {
      var p = Math.min((now - start) / duration, 1);
      draw(easeOutCubic(p));
      if (p < 1) requestAnimationFrame(frame);
    })(start);
  }

  function niceMax(value) {
    if (value <= 0) return 10;
    var pow = Math.pow(10, Math.floor(Math.log10(value)));
    return Math.ceil(value / pow * 2) / 2 * pow;
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---------------------------------------------------------------
     Tooltip
     --------------------------------------------------------------- */
  function tooltipFor(canvas) {
    var box = canvas.parentElement;
    var tip = box.querySelector('.chart-tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'chart-tooltip';
      box.appendChild(tip);
    }
    return {
      show: function (x, y, html) {
        tip.innerHTML = html;
        tip.style.left = x + 'px';
        tip.style.top = y + 'px';
        tip.classList.add('is-visible');
      },
      hide: function () { tip.classList.remove('is-visible'); }
    };
  }

  /* ---------------------------------------------------------------
     Axis / grid
     --------------------------------------------------------------- */
  function drawGrid(ctx, box, max, colors, opts) {
    var steps = opts.steps || 4;
    ctx.font = '500 11px Poppins, sans-serif';
    ctx.fillStyle = colors.text;
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;

    for (var i = 0; i <= steps; i++) {
      var y = box.top + (box.height / steps) * i;
      ctx.beginPath();
      ctx.moveTo(box.left, y);
      ctx.lineTo(box.left + box.width, y);
      ctx.stroke();

      var value = max - (max / steps) * i;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(opts.formatY ? opts.formatY(value) : Math.round(value), box.left - 10, y);
    }
  }

  function drawXLabels(ctx, box, labels, colors) {
    ctx.font = '500 11px Poppins, sans-serif';
    ctx.fillStyle = colors.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    var step = box.width / labels.length;
    var skip = Math.ceil(labels.length / Math.max(Math.floor(box.width / 52), 1));

    labels.forEach(function (label, i) {
      if (i % skip !== 0) return;
      ctx.fillText(label, box.left + step * i + step / 2, box.top + box.height + 12);
    });
  }

  /* ---------------------------------------------------------------
     Area / line chart
     --------------------------------------------------------------- */
  function area(canvas, config) {
    var tip = tooltipFor(canvas);
    var hover = -1;

    function render(progress) {
      var colors = palette();
      var f = fit(canvas, config.height);
      var ctx = f.ctx;
      ctx.clearRect(0, 0, f.w, f.h);

      var box = {
        left: 48,
        top: 14,
        width: f.w - 62,
        height: f.h - 46
      };

      var all = config.datasets.reduce(function (acc, d) { return acc.concat(d.data); }, []);
      var max = niceMax(Math.max.apply(null, all) * 1.12);

      drawGrid(ctx, box, max, colors, config);
      drawXLabels(ctx, box, config.labels, colors);

      var stepX = box.width / (config.labels.length - 1 || 1);

      config.datasets.forEach(function (set) {
        var color = set.color || colors.purple;
        var points = set.data.map(function (value, i) {
          return {
            x: box.left + stepX * i,
            y: box.top + box.height - (value / max) * box.height * progress,
            v: value
          };
        });

        // Fill
        if (set.fill !== false) {
          var gradient = ctx.createLinearGradient(0, box.top, 0, box.top + box.height);
          gradient.addColorStop(0, hexToRgba(color, 0.34));
          gradient.addColorStop(1, hexToRgba(color, 0));

          ctx.beginPath();
          ctx.moveTo(points[0].x, box.top + box.height);
          points.forEach(function (p) { ctx.lineTo(p.x, p.y); });
          ctx.lineTo(points[points.length - 1].x, box.top + box.height);
          ctx.closePath();
          ctx.fillStyle = gradient;
          ctx.fill();
        }

        // Line
        ctx.beginPath();
        points.forEach(function (p, i) { i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.shadowColor = hexToRgba(color, 0.5);
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Points
        points.forEach(function (p, i) {
          var active = i === hover;
          if (!active && !set.showPoints) return;
          ctx.beginPath();
          ctx.arc(p.x, p.y, active ? 6 : 3.5, 0, Math.PI * 2);
          ctx.fillStyle = active ? color : colors.surface;
          ctx.strokeStyle = color;
          ctx.lineWidth = 2.5;
          ctx.fill();
          ctx.stroke();
        });

        set._points = points;
      });

      // Hover guide line
      if (hover > -1 && config.datasets[0]._points[hover]) {
        var hx = config.datasets[0]._points[hover].x;
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.moveTo(hx, box.top);
        ctx.lineTo(hx, box.top + box.height);
        ctx.strokeStyle = hexToRgba(colors.purpleLight, 0.4);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      canvas._box = box;
      canvas._stepX = stepX;
    }

    canvas.addEventListener('mousemove', function (e) {
      if (!canvas._box) return;
      var rect = canvas.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var index = Math.round((x - canvas._box.left) / canvas._stepX);

      if (index < 0 || index >= config.labels.length) {
        hover = -1;
        tip.hide();
        render(1);
        return;
      }

      hover = index;
      render(1);

      var point = config.datasets[0]._points[index];
      var rows = config.datasets.map(function (set) {
        var value = config.formatTip ? config.formatTip(set.data[index]) : set.data[index];
        return set.label + ': <b>' + value + '</b>';
      }).join('<br>');
      tip.show(point.x, point.y, '<span>' + config.labels[index] + '</span><br>' + rows);
    });

    canvas.addEventListener('mouseleave', function () {
      hover = -1;
      tip.hide();
      render(1);
    });

    animate(1100, render);
    return { redraw: function () { render(1); } };
  }

  /* ---------------------------------------------------------------
     Bar chart (grouped)
     --------------------------------------------------------------- */
  function bar(canvas, config) {
    var tip = tooltipFor(canvas);
    var hover = -1;

    function render(progress) {
      var colors = palette();
      var f = fit(canvas, config.height);
      var ctx = f.ctx;
      ctx.clearRect(0, 0, f.w, f.h);

      var box = { left: 48, top: 14, width: f.w - 62, height: f.h - 46 };
      var all = config.datasets.reduce(function (acc, d) { return acc.concat(d.data); }, []);
      var max = niceMax(Math.max.apply(null, all) * 1.15);

      drawGrid(ctx, box, max, colors, config);
      drawXLabels(ctx, box, config.labels, colors);

      var groupWidth = box.width / config.labels.length;
      var count = config.datasets.length;
      var barWidth = Math.min((groupWidth * 0.62) / count, 26);
      var gap = 5;

      config.datasets.forEach(function (set, si) {
        var color = set.color || (si === 0 ? colors.purple : colors.purpleLight);

        set.data.forEach(function (value, i) {
          var total = count * barWidth + (count - 1) * gap;
          var x = box.left + groupWidth * i + (groupWidth - total) / 2 + si * (barWidth + gap);
          var h = (value / max) * box.height * progress;
          var y = box.top + box.height - h;

          var gradient = ctx.createLinearGradient(0, y, 0, box.top + box.height);
          gradient.addColorStop(0, color);
          gradient.addColorStop(1, hexToRgba(color, 0.25));

          ctx.fillStyle = gradient;
          if (i === hover) {
            ctx.shadowColor = hexToRgba(color, 0.65);
            ctx.shadowBlur = 16;
          }
          roundRect(ctx, x, y, barWidth, h, 6);
          ctx.fill();
          ctx.shadowBlur = 0;
        });
      });

      canvas._box = box;
      canvas._groupWidth = groupWidth;
    }

    canvas.addEventListener('mousemove', function (e) {
      if (!canvas._box) return;
      var rect = canvas.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var index = Math.floor((x - canvas._box.left) / canvas._groupWidth);

      if (index < 0 || index >= config.labels.length) {
        hover = -1;
        tip.hide();
        render(1);
        return;
      }

      hover = index;
      render(1);

      var rows = config.datasets.map(function (set) {
        var value = config.formatTip ? config.formatTip(set.data[index]) : set.data[index];
        return set.label + ': <b>' + value + '</b>';
      }).join('<br>');

      tip.show(
        canvas._box.left + canvas._groupWidth * index + canvas._groupWidth / 2,
        canvas._box.top + 30,
        '<span>' + config.labels[index] + '</span><br>' + rows
      );
    });

    canvas.addEventListener('mouseleave', function () {
      hover = -1;
      tip.hide();
      render(1);
    });

    animate(1000, render);
    return { redraw: function () { render(1); } };
  }

  /* ---------------------------------------------------------------
     Doughnut chart
     --------------------------------------------------------------- */
  function doughnut(canvas, config) {
    var tip = tooltipFor(canvas);
    var hover = -1;

    function render(progress) {
      var colors = palette();
      var f = fit(canvas, config.height);
      var ctx = f.ctx;
      ctx.clearRect(0, 0, f.w, f.h);

      var cx = f.w / 2;
      var cy = f.h / 2;
      var radius = Math.min(cx, cy) - 12;
      var inner = radius * 0.66;
      var total = config.segments.reduce(function (n, s) { return n + s.value; }, 0) || 1;

      var start = -Math.PI / 2;
      config.segments.forEach(function (segment, i) {
        var angle = (segment.value / total) * Math.PI * 2 * progress;
        var grow = i === hover ? 5 : 0;

        ctx.beginPath();
        ctx.arc(cx, cy, radius + grow, start, start + angle);
        ctx.arc(cx, cy, inner, start + angle, start, true);
        ctx.closePath();
        ctx.fillStyle = segment.color;
        if (i === hover) {
          ctx.shadowColor = hexToRgba(segment.color, 0.7);
          ctx.shadowBlur = 18;
        }
        ctx.fill();
        ctx.shadowBlur = 0;

        segment._start = start;
        segment._end = start + angle;
        start += angle;
      });

      // Centre label
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = colors.text;
      ctx.font = '500 11px Poppins, sans-serif';
      ctx.fillText(config.centerLabel || 'Total', cx, cy + 13);

      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#fff';
      ctx.font = '700 22px Poppins, sans-serif';
      ctx.fillText(config.centerValue || String(total), cx, cy - 8);

      canvas._geo = { cx: cx, cy: cy, radius: radius, inner: inner, total: total };
    }

    canvas.addEventListener('mousemove', function (e) {
      var geo = canvas._geo;
      if (!geo) return;

      var rect = canvas.getBoundingClientRect();
      var x = e.clientX - rect.left - geo.cx;
      var y = e.clientY - rect.top - geo.cy;
      var dist = Math.sqrt(x * x + y * y);

      if (dist < geo.inner || dist > geo.radius + 6) {
        if (hover !== -1) { hover = -1; render(1); }
        tip.hide();
        return;
      }

      var angle = Math.atan2(y, x);
      if (angle < -Math.PI / 2) angle += Math.PI * 2;

      var found = config.segments.findIndex(function (s) {
        return angle >= s._start && angle <= s._end;
      });

      if (found === -1) { tip.hide(); return; }
      if (found !== hover) { hover = found; render(1); }

      var segment = config.segments[found];
      var pct = Math.round((segment.value / geo.total) * 100);
      tip.show(e.clientX - rect.left, e.clientY - rect.top, segment.label + ': <b>' + pct + '%</b>');
    });

    canvas.addEventListener('mouseleave', function () {
      hover = -1;
      tip.hide();
      render(1);
    });

    animate(1100, render);
    return { redraw: function () { render(1); } };
  }

  /* ---------------------------------------------------------------
     Sparkline
     --------------------------------------------------------------- */
  function sparkline(canvas, config) {
    function render(progress) {
      var colors = palette();
      var f = fit(canvas, config.height || 46);
      var ctx = f.ctx;
      ctx.clearRect(0, 0, f.w, f.h);

      var data = config.data;
      var max = Math.max.apply(null, data);
      var min = Math.min.apply(null, data);
      var range = (max - min) || 1;
      var color = config.color || colors.purple;
      var stepX = f.w / (data.length - 1 || 1);

      var points = data.map(function (v, i) {
        return {
          x: i * stepX,
          y: f.h - 4 - ((v - min) / range) * (f.h - 10) * progress
        };
      });

      var gradient = ctx.createLinearGradient(0, 0, 0, f.h);
      gradient.addColorStop(0, hexToRgba(color, 0.28));
      gradient.addColorStop(1, hexToRgba(color, 0));

      ctx.beginPath();
      ctx.moveTo(0, f.h);
      points.forEach(function (p) { ctx.lineTo(p.x, p.y); });
      ctx.lineTo(f.w, f.h);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.beginPath();
      points.forEach(function (p, i) { i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    animate(900, render);
    return { redraw: function () { render(1); } };
  }

  /* ---------------------------------------------------------------
     Utils
     --------------------------------------------------------------- */
  function hexToRgba(hex, alpha) {
    hex = (hex || '').trim();
    if (hex.indexOf('rgb') === 0) return hex;

    var clean = hex.replace('#', '');
    if (clean.length === 3) {
      clean = clean.split('').map(function (c) { return c + c; }).join('');
    }
    var n = parseInt(clean, 16);
    if (isNaN(n)) return 'rgba(109,93,246,' + alpha + ')';

    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
  }

  /** Wrap a factory so every chart is tracked for resize/theme redraws. */
  function track(factory) {
    return function (canvas, config) {
      if (!canvas) return null;
      var instance = factory(canvas, config || {});
      instances.push(instance);
      return instance;
    };
  }

  var redrawAll = function () {
    instances.forEach(function (chart) { if (chart && chart.redraw) chart.redraw(); });
  };

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(redrawAll, 150);
  });
  document.addEventListener('themechange', function () { setTimeout(redrawAll, 60); });

  window.NebulaChart = {
    area: track(area),
    bar: track(bar),
    doughnut: track(doughnut),
    sparkline: track(sparkline),
    redrawAll: redrawAll
  };
})();
