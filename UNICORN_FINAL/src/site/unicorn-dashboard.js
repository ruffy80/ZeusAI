/**
 * unicorn-dashboard.js — FAZA 2 / VAL 5
 * Standalone client module. Ascultă SSE la /unicorn-stream și actualizează DOM
 * fără refresh. NU interferează cu shell.js. Activare opt-in: orice element cu
 * data-unicorn="<key>" va primi valoarea live din supreme[key].cycles (sau
 * supreme[key].mainCycleCount). Pentru integrare în pagini personalizate.
 *
 *   <span data-unicorn="brain"></span>  →  becomes "57" (live)
 *   <span data-unicorn="economy.pulse"></span>  →  becomes economy pulse score
 */
(function () {
  if (typeof window === 'undefined' || !window.EventSource) return;
  if (window.__unicornDashboardActive) return;
  window.__unicornDashboardActive = true;

  function getNested(obj, dotPath) {
    if (!obj) return null;
    var parts = String(dotPath).split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return null;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function paint(supreme) {
    if (!supreme) return;
    var nodes = document.querySelectorAll('[data-unicorn]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute('data-unicorn');
      var v;
      if (key.indexOf('.') >= 0) {
        v = getNested(supreme, key);
      } else {
        v = supreme[key] && (supreme[key].cycles != null ? supreme[key].cycles : supreme[key].mainCycleCount);
      }
      if (v != null) nodes[i].textContent = String(v);
    }
  }

  function connect() {
    try {
      var es = new EventSource('/unicorn-stream');
      es.addEventListener('cockpit', function (ev) {
        try {
          var data = JSON.parse(ev.data);
          if (data && data.supreme) paint(data.supreme);
          window.__unicornLastUpdate = Date.now();
        } catch (_) {}
      });
      es.onerror = function () {
        try { es.close(); } catch (_) {}
        setTimeout(connect, 5000);
      };
    } catch (_) {
      setTimeout(connect, 8000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', connect);
  } else {
    connect();
  }
})();
