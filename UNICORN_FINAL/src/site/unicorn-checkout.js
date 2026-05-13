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

  function pay(node, method) {
    var sid = node.getAttribute('data-service-id');
    var price = parseFloat(node.getAttribute('data-price') || '0');
    status(node, 'Processing ' + method.toUpperCase() + '…');
    fetch('/api/checkout/' + method, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceId: sid, amount: price }),
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (d && d.ok !== false) {
        status(node, '✓ ' + (d.message || 'Order created') + (d.orderId ? (' · ' + d.orderId) : ''), 'ok');
        if (d.btcAddress) {
          var p = node.querySelector('[data-ck-extra]');
          if (p) p.innerHTML = '<div style="font-size:12px;margin-top:8px">BTC: <code>' + d.btcAddress + '</code></div>';
        }
        try {
          // Subscribe to confirmation events
          if (window.EventSource) {
            var es = new EventSource('/unicorn-stream');
            es.addEventListener('payment', function (ev) {
              try {
                var msg = JSON.parse(ev.data);
                if (msg && msg.orderId === d.orderId) {
                  status(node, '✓✓ Payment confirmed', 'ok');
                  es.close();
                }
              } catch (_) {}
            });
            setTimeout(function () { try { es.close(); } catch (_) {} }, 10 * 60 * 1000);
          }
        } catch (_) {}
      } else {
        status(node, '✗ ' + (d && d.error || 'Payment failed'), 'err');
      }
    }).catch(function (err) {
      status(node, '✗ ' + (err && err.message || err), 'err');
    });
  }

  function render(node) {
    if (node.__rendered) return;
    node.__rendered = true;
    var name = node.getAttribute('data-service-name') || node.getAttribute('data-service-id') || 'Service';
    var price = node.getAttribute('data-price') || '99';
    node.innerHTML = (
      '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:18px;max-width:480px">' +
        '<div style="font-size:16px;font-weight:600;margin-bottom:6px">' + name + '</div>' +
        '<div style="font-size:24px;color:#7cf7c0;font-weight:700">$' + parseFloat(price).toFixed(2) + '</div>' +
        '<div style="display:flex;gap:8px;margin-top:14px">' +
          '<button data-ck-btc style="background:#7cf7c0;color:#0a0f1e;border:0;padding:10px 18px;border-radius:8px;font-weight:600;cursor:pointer">Pay with BTC</button>' +
          '<button data-ck-stripe style="background:transparent;color:#e8eef9;border:1px solid rgba(255,255,255,0.2);padding:10px 18px;border-radius:8px;cursor:pointer">Pay with Card</button>' +
        '</div>' +
        '<div data-ck-status style="margin-top:10px;font-size:12px;color:#7a8499"></div>' +
        '<div data-ck-extra></div>' +
      '</div>'
    );
    var btc = node.querySelector('[data-ck-btc]');
    var stripe = node.querySelector('[data-ck-stripe]');
    if (btc) btc.addEventListener('click', function () { pay(node, 'btc'); });
    if (stripe) stripe.addEventListener('click', function () { pay(node, 'create'); });
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
