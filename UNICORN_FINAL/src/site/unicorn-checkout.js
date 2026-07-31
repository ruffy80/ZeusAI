/**
 * unicorn-checkout.js — FAZA 2 / VAL 5
 * Form de plată reutilizabil pentru orice pagină. Apelează API-urile treasury
 * (Stripe + BTC) și ascultă confirmări live prin SSE pe /unicorn-stream.
 *
 * Usage:
 *   <div data-unicorn-checkout
 *        data-service-id="ai-copilot"
 *        data-service-name="AI Copilot"
 *        data-price="99"></div>
 *   <script src="/site/unicorn-checkout.js"></script>
 */
(function () {
  if (typeof window === 'undefined') return;
  if (window.__unicornCheckoutActive) return;
  window.__unicornCheckoutActive = true;

  function escHtml(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (html != null) e.innerHTML = html;
    return e;
  }

  function status(node, msg, kind) {
    var st = node.querySelector('[data-ck-status]');
    if (!st) return;
    st.textContent = msg;
    st.style.color = kind === 'ok' ? '#7cf7c0' : kind === 'err' ? '#ff6b6b' : '#7a8499';
  }

  function setBusy(node, busy) {
    node.__ckBusy = !!busy;
    var buttons = node.querySelectorAll('button[data-ck-btc],button[data-ck-stripe]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].disabled = !!busy;
      buttons[i].style.opacity = busy ? '0.65' : '1';
      buttons[i].style.cursor = busy ? 'not-allowed' : 'pointer';
    }
  }

  function payBtc(node) {
    if (node.__ckBusy) return;
    var sid = node.getAttribute('data-service-id');
    var price = Number.parseFloat(node.getAttribute('data-price') || '0');
    if (!Number.isFinite(price) || price < 0) price = 0;
    setBusy(node, true);
    status(node, 'Creating BTC invoice…');
    // Sovereign money path — never advertise Card via /api/checkout/create.
    fetch('/api/checkout/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceId: sid, qty: 1, currency: 'USD' }),
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); }).then(function (pack) {
      var d = pack.d || {};
      if (pack.ok && (d.orderId || d.checkout_url)) {
        status(node, '✓ Invoice ready' + (d.orderId ? (' · ' + d.orderId) : ''), 'ok');
        var target = d.checkout_url || ('/checkout/' + encodeURIComponent(String(d.orderId)));
        try {
          var u = new URL(target, window.location.origin);
          if (u.origin === window.location.origin) target = u.pathname + u.search;
        } catch (_) {}
        window.location.href = target;
      } else {
        status(node, '✗ ' + (d.error || d.reason || 'Payment failed'), 'err');
      }
    }).catch(function (err) {
      status(node, '✗ ' + (err && err.message || err), 'err');
    }).finally(function () {
      setBusy(node, false);
    });
  }

  function render(node) {
    if (node.__rendered) return;
    node.__rendered = true;
    var name = node.getAttribute('data-service-name') || node.getAttribute('data-service-id') || 'Service';
    var price = node.getAttribute('data-price') || '99';
    var priceNum = Number.parseFloat(price);
    if (!Number.isFinite(priceNum) || priceNum < 0) priceNum = 0;
    var safeName = escHtml(name);
    // Honesty: Card CTA only when Stripe is armed at runtime.
    node.innerHTML = (
      '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:18px;max-width:480px">' +
        '<div style="font-size:16px;font-weight:600;margin-bottom:6px">' + safeName + '</div>' +
        '<div style="font-size:24px;color:#7cf7c0;font-weight:700">$' + priceNum.toFixed(2) + '</div>' +
        '<div style="display:flex;gap:8px;margin-top:14px">' +
          '<button data-ck-btc style="background:#7cf7c0;color:#0a0f1e;border:0;padding:10px 18px;border-radius:8px;font-weight:600;cursor:pointer">Pay with BTC</button>' +
          '<button data-ck-stripe style="display:none;background:transparent;color:#e8eef9;border:1px solid rgba(255,255,255,0.2);padding:10px 18px;border-radius:8px;cursor:pointer">Pay with Card</button>' +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">' +
          '<button data-ck-paypal style="display:none;background:#0070ba;color:#fff;border:0;padding:10px 18px;border-radius:8px;cursor:pointer">PayPal</button>' +
          '<button data-ck-now style="display:none;background:transparent;color:#e8eef9;border:1px solid rgba(255,255,255,0.2);padding:10px 18px;border-radius:8px;cursor:pointer">Card / crypto</button>' +
        '</div>' +
        '<div data-ck-status style="margin-top:10px;font-size:12px;color:#7a8499">Bitcoin checkout is live. PayPal / NOWPayments appear only when armed.</div>' +
        '<div data-ck-rails style="margin-top:8px;font-size:11px;color:#7a8499;line-height:1.5">Armed Rails: BTC armed · PayPal… · NOWPayments…</div>' +
        '<div data-ck-extra></div>' +
      '</div>'
    );
    var btc = node.querySelector('[data-ck-btc]');
    var stripe = node.querySelector('[data-ck-stripe]');
    var paypalBtn = node.querySelector('[data-ck-paypal]');
    var nowBtn = node.querySelector('[data-ck-now]');
    var railsEl = node.querySelector('[data-ck-rails]');
    if (btc) btc.addEventListener('click', function () { payBtc(node); });
    function startAlt(rail) {
      var serviceId = node.getAttribute('data-service') || node.getAttribute('data-service-id') || node.getAttribute('data-plan') || '';
      if (!serviceId) { status(node, 'Missing service id', 'err'); return; }
      status(node, 'Creating invoice…', '');
      fetch('/api/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: serviceId, qty: 1 }),
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok || !(res.j && res.j.orderId && res.j.access_token)) {
            status(node, (res.j && res.j.error) || 'Invoice failed', 'err');
            return;
          }
          var path = rail === 'paypal'
            ? '/api/order/' + encodeURIComponent(res.j.orderId) + '/paypal/create'
            : '/api/order/' + encodeURIComponent(res.j.orderId) + '/nowpayments/create';
          var body = { access_token: res.j.access_token };
          if (rail === 'now') body.payCurrency = 'any';
          return fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
            .then(function (r2) { return r2.json().then(function (j2) { return { ok: r2.ok, j: j2, order: res.j }; }); });
        })
        .then(function (res2) {
          if (!res2) return;
          var href = rail === 'paypal' ? (res2.j && res2.j.approveHref) : (res2.j && res2.j.invoiceUrl);
          if (res2.ok && href) { window.location.href = href; return; }
          status(node, (res2.j && (res2.j.detail || res2.j.error)) || 'Rail unavailable — try BTC', 'err');
          if (res2.order && res2.order.checkout_url) window.location.href = res2.order.checkout_url;
        })
        .catch(function (e) { status(node, String(e && e.message || e), 'err'); });
    }
    fetch('/api/payment/methods').then(function (r) { return r.json(); }).then(function (j) {
      var methods = (j && (j.methods || j.paymentMethods)) || [];
      var stripeOn = methods.some(function (m) {
        var id = String((m && (m.id || m.kind || m.method)) || '').toLowerCase();
        return (id === 'stripe' || id === 'card') && m.active !== false;
      });
      var paypalOn = methods.some(function (m) { return String((m && m.id) || '').toLowerCase() === 'paypal' && m.active !== false; });
      var nowOn = methods.some(function (m) { return String((m && m.id) || '').toLowerCase() === 'nowpayments' && m.active !== false; });
      var emailOn = !!(j && j.emailConfigured);
      if (railsEl) {
        railsEl.textContent = 'Armed Rails Continuum: BTC armed · PayPal ' + (paypalOn ? 'armed' : 'idle')
          + ' · NOWPayments ' + (nowOn ? 'armed' : 'idle')
          + ' · Email ' + (emailOn ? 'armed' : 'idle');
      }
      if (paypalOn && paypalBtn) {
        paypalBtn.style.display = '';
        paypalBtn.addEventListener('click', function () { startAlt('paypal'); });
      }
      if (nowOn && nowBtn) {
        nowBtn.style.display = '';
        nowBtn.addEventListener('click', function () { startAlt('now'); });
      }
      if (stripeOn && stripe) {
        stripe.style.display = '';
        stripe.addEventListener('click', function () {
          status(node, 'Use Card / crypto (NOWPayments) or PayPal when armed — Stripe portal path is separate.', 'err');
        });
      }
    }).catch(function () { /* BTC-only is fine */ });
  }

  function init() {
    var nodes = document.querySelectorAll('[data-unicorn-checkout]');
    for (var i = 0; i < nodes.length; i++) render(nodes[i]);
  }
  window.unicornCheckout = { init: init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
