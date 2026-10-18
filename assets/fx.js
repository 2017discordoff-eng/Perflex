/* Perflex – effets de la page (ajout : n'altère ni site.js ni la scène 3D) */
(function () {
  'use strict';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches;
  var $ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* titre : chaque mot monte depuis un masque */
  $('[data-split]').forEach(function (h) {
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (t) {
            if (!t) return;
            if (/^\s+$/.test(t)) { frag.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span'); w.className = 'w';
            var s = document.createElement('i'); s.textContent = t; s.style.setProperty('--i', i++);
            w.appendChild(s); frag.appendChild(w);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') { walk(n); }
      });
    })(h);
  });

  /* décalage automatique des apparitions voisines */
  $('.rows, .facts, .stats, .faq-grid > div:last-child').forEach(function (g) {
    Array.prototype.slice.call(g.children).forEach(function (el, k) { el.style.setProperty('--d', (k * 0.07).toFixed(2) + 's'); });
  });
  $('.stat').forEach(function (el, k) { el.style.setProperty('--d', (k * 0.09).toFixed(2) + 's'); });

  /* la barre « kicker » et le journal ont leur propre déclencheur */
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (en) {
    en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.25 }) : null;
  $('.kicker, .log').forEach(function (el) { if (io) io.observe(el); else el.classList.add('in'); });

  /* compteurs animés */
  function count(el) {
    var to = parseFloat(el.dataset.count), suf = el.dataset.suffix || '';
    if (reduce || !to) { el.textContent = to + suf; return; }
    var t0 = performance.now(), dur = 1400;
    (function tick(t) {
      var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4);
      el.textContent = Math.round(to * e) + suf;
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }
  var cio = 'IntersectionObserver' in window ? new IntersectionObserver(function (en) {
    en.forEach(function (e) { if (e.isIntersecting) { count(e.target); cio.unobserve(e.target); } });
  }, { threshold: 0.6 }) : null;
  $('[data-count]').forEach(function (el) { if (cio) cio.observe(el); });

  /* progression de lecture + lien de navigation actif */
  var bar = document.getElementById('progress');
  var links = $('.nav-links a');
  var targets = links.map(function (a) { return document.querySelector(a.getAttribute('href')); });
  var ticking = false;
  function onScroll() {
    var h = document.documentElement.scrollHeight - innerHeight;
    if (bar) bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, scrollY / h) : 0) + ')';
    var cur = -1;
    targets.forEach(function (t, i) { if (t && t.getBoundingClientRect().top < innerHeight * 0.4) cur = i; });
    links.forEach(function (a, i) { a.classList.toggle('act', i === cur); });
    ticking = false;
  }
  addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  if (reduce || !fine) return;

  /* halo qui suit le curseur */
  var glow = document.getElementById('cursor-glow'), gx = 0, gy = 0, tx = 0, ty = 0, run = false;
  addEventListener('mousemove', function (e) {
    tx = e.clientX; ty = e.clientY; glow.classList.add('on');
    if (!run) { run = true; requestAnimationFrame(loop); }
  }, { passive: true });
  document.addEventListener('mouseleave', function () { glow.classList.remove('on'); });
  function loop() {
    gx += (tx - gx) * 0.12; gy += (ty - gy) * 0.12;
    glow.style.transform = 'translate(' + gx.toFixed(1) + 'px,' + gy.toFixed(1) + 'px)';
    if (Math.abs(tx - gx) + Math.abs(ty - gy) > 0.5) requestAnimationFrame(loop); else run = false;
  }

  /* projecteur sur les cartes */
  $('[data-spot]').forEach(function (el) {
    el.addEventListener('mousemove', function (e) {
      var r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      el.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  /* boutons magnétiques */
  $('[data-magnet]').forEach(function (b) {
    b.addEventListener('mousemove', function (e) {
      var r = b.getBoundingClientRect();
      var x = (e.clientX - (r.left + r.width / 2)) * 0.18, y = (e.clientY - (r.top + r.height / 2)) * 0.28;
      b.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
    });
    b.addEventListener('mouseleave', function () { b.style.transform = ''; });
  });

  /* inclinaison 3D de la capture */
  $('[data-tilt]').forEach(function (box) {
    var fig = box.querySelector('figure');
    box.addEventListener('mousemove', function (e) {
      var r = fig.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
      box.classList.add('tilting');
      fig.style.transform = 'rotateY(' + (px * 9).toFixed(2) + 'deg) rotateX(' + (-py * 7).toFixed(2) + 'deg) scale(1.015)';
      fig.style.setProperty('--sx', (px * 80).toFixed(0) + '%');
    });
    box.addEventListener('mouseleave', function () { box.classList.remove('tilting'); fig.style.transform = ''; fig.style.setProperty('--sx', '-30%'); });
  });
})();
