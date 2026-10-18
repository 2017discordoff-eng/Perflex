/* Perflex – comportements de la page (hors scène 3D) */
(function () {
  'use strict';

  /* fiches des pièces affichées au zoom */
  var PARTS = {
    cpu:  { t: 'Processeur',      d: 'Il exécute chaque instruction du système. Quand des programmes tournent en fond, il perd du temps pour votre jeu.',
            s: 'Modèle et charge en temps réel.',
            o: 'Priorité au premier plan, plan Performances ultimes, applications en arrière-plan coupées.' },
    mobo: { t: 'Carte mère',      d: 'Elle relie tout le reste. Son BIOS fixe le comportement de base de la machine.',
            s: 'Modèle de la carte et version du BIOS.',
            o: 'Rien à régler ici : Perflex se contente de l’afficher.' },
    ram:  { t: 'Mémoire vive',    d: 'La mémoire de travail. Quand elle sature, Windows ralentit tout le reste.',
            s: 'Chaque barrette, l’usage en temps réel et les programmes les plus gourmands.',
            o: 'Libère la mémoire inactive sans fermer aucun programme. Fermeture au choix, les processus Windows restent protégés.' },
    gpu:  { t: 'Carte graphique', d: 'Elle calcule l’image. Ce sont les jeux qui lui en demandent le plus.',
            s: 'Modèle et charge en temps réel.',
            o: 'Vide le cache de shaders (NVIDIA / AMD / DirectX), active le mode jeu Windows, coupe la capture Game DVR.' },
    ssd:  { t: 'Stockage',        d: 'Windows, vos jeux et tous les caches y vivent. Un disque encombré, c’est un démarrage plus lent.',
            s: 'Chaque disque, avec son état SMART.',
            o: 'Nettoie les temporaires, le cache Windows Update, les miniatures, les navigateurs, Discord. Trie les programmes au démarrage.' },
    psu:  { t: 'Alimentation',    d: 'Elle donne aux composants ce qu’ils réclament. Windows, lui, peut les brider pour économiser.',
            s: 'Rien : le matériel n’expose pas cette donnée.',
            o: 'Le plan Performances ultimes empêche le PC de se brider pour économiser de l’énergie.' }
  };

  var root = document.documentElement;
  var panel = document.getElementById('partpanel');

  window.PerflexPanel = {
    show: function (id, order) {
      var p = PARTS[id]; if (!p || !panel) return;
      var i = order.indexOf(id);
      panel.querySelector('[data-f="idx"]').textContent = '0' + (i + 1);
      panel.querySelector('[data-f="tot"]').textContent = '0' + order.length;
      panel.querySelector('[data-f="title"]').textContent = p.t;
      panel.querySelector('[data-f="desc"]').textContent = p.d;
      panel.querySelector('[data-f="shows"]').textContent = p.s;
      panel.querySelector('[data-f="does"]').textContent = p.o;
      panel.setAttribute('aria-hidden', 'false');
      if (window.innerWidth < 900) {
        var st = document.getElementById('stage');
        if (st) st.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    },
    hide: function () { if (panel) panel.setAttribute('aria-hidden', 'true'); }
  };

  function step(dir) {
    var S = window.PerflexScene; if (!S) return;
    var cur = document.querySelector('.parts-nav .on');
    var id = cur ? cur.dataset.pick : S.order[0];
    var i = S.order.indexOf(id) + dir;
    S.focus(S.order[(i + S.order.length) % S.order.length]);
  }
  var back = document.querySelector('[data-back]');
  if (back) back.addEventListener('click', function () { window.PerflexScene && window.PerflexScene.release(); });
  var prev = document.querySelector('[data-prev]'), next = document.querySelector('[data-next]');
  if (prev) prev.addEventListener('click', function () { step(-1); });
  if (next) next.addEventListener('click', function () { step(1); });

  /* adresse de téléchargement unique (définie dans index.html) */
  if (window.DOWNLOAD_URL) {
    document.querySelectorAll('[data-download]').forEach(function (a) { a.setAttribute('href', window.DOWNLOAD_URL); });
  }

  /* barre de navigation */
  var nav = document.querySelector('.nav');
  function onScroll() { nav.classList.toggle('scrolled', window.scrollY > 24); }
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });

  /* apparition au défilement */
  var rv = document.querySelectorAll('.rv');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    rv.forEach(function (el) { io.observe(el); });
  } else { rv.forEach(function (el) { el.classList.add('in'); }); }

  /* copie de l'empreinte */
  var btn = document.getElementById('copy-sha');
  if (btn) btn.addEventListener('click', function () {
    var txt = document.getElementById('sha').textContent.trim();
    function done() { btn.textContent = 'Copié'; btn.classList.add('ok'); setTimeout(function () { btn.textContent = 'Copier'; btn.classList.remove('ok'); }, 1600); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, done);
    else { var r = document.createRange(); r.selectNodeContents(document.getElementById('sha')); var s = getSelection(); s.removeAllRanges(); s.addRange(r); try { document.execCommand('copy'); } catch (e) {} done(); }
  });
})();
