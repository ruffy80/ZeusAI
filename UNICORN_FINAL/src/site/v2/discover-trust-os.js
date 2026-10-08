'use strict';

/**
 * DTO/1.0 — Discover, Trust, Convert.
 *
 * Public pages, first-party experiment counters, and outreach drafts.
 * Does not invent customers, testimonials, a street address, a phone
 * number, or a company registration. Does not send email. Does not load
 * a third-party tracker unless the owner later sets a verification token
 * (Search Console meta only — still no analytics script).
 */

const PROTOCOL = 'DTO/1.0';

const OWNER = {
  name: process.env.OWNER_NAME || 'Vladoi Ionut',
  email: process.env.OWNER_EMAIL || process.env.ADMIN_EMAIL || 'vladoi_ionut@yahoo.com',
  domain: String(process.env.PUBLIC_APP_URL || 'https://zeusai.pro').replace(/\/+$/, ''),
};

const HEADLINES = {
  A: {
    id: 'A',
    h1: 'Send a stronger resume today.',
    lead: 'The $39 Instant Resume + LinkedIn Makeover rewrites your one-page resume and LinkedIn headline for a target role. Pay in Bitcoin, or by PayPal or card when those rails are armed. You receive an Ed25519-signed receipt and the public refund contract.',
    cta: 'Get the $39 resume makeover',
    href: '/checkout/?plan=instant-resume-makeover',
  },
  B: {
    id: 'B',
    h1: 'Pay once. Receive a signed AI deliverable.',
    lead: 'Start with a $39 resume makeover or a $49 website audit. Delivery follows settlement. The public buyer count stays at zero until a payment is confirmed. ZeusAI does not invent customers.',
    cta: 'Start the $39 checkout',
    href: '/checkout/?plan=instant-resume-makeover',
  },
};

const SERVICES = [
  {
    id: 'instant-resume-makeover',
    name: 'Instant Resume + LinkedIn Makeover',
    priceUsd: 39,
    path: '/checkout/?plan=instant-resume-makeover',
    description: 'AI-rewritten one-page resume and matching LinkedIn About and headline for a target role.',
  },
  {
    id: 'instant-website-audit',
    name: 'Instant Website Audit (AI)',
    priceUsd: 49,
    path: '/checkout/?plan=instant-website-audit',
    description: 'SEO, performance, and accessibility audit delivered after settlement.',
  },
  {
    id: 'professional-ai-chatbot',
    name: 'RAG Chatbot Build Engagement',
    priceUsd: 1499,
    path: '/checkout/?plan=professional-ai-chatbot',
    description: 'Reserve unlocks a kickoff pack. The retrieval chatbot engagement is delivered by the operator across the stated window.',
  },
  {
    id: 'professional-ai-marketing',
    name: '90-day Marketing Engine Engagement',
    priceUsd: 1799,
    path: '/checkout/?plan=professional-ai-marketing',
    description: 'Reserve unlocks kickoff materials. Calendar, automation, and the runbook are an engagement, not an instant download.',
  },
];

const PUBLISHED = '2026-10-08';

const ARTICLES = [
  {
    slug: 'autonomous-ai-commerce',
    title: 'What autonomous AI commerce means when nobody has paid yet',
    description: 'A plain explanation of autonomous AI commerce: catalog, Bitcoin checkout, signed receipts, and why a zero buyer count is a fact.',
    keywords: 'autonomous AI commerce',
    paragraphs: [
      'Autonomous AI commerce is a store that can quote a price, open a checkout, watch a payment, and hand back a signed receipt without a salesperson in the loop. ZeusAI is that kind of store. It lists concrete services — a resume makeover, a website audit, a chatbot engagement, a marketing engagement — and it prices them in US dollars with a Bitcoin checkout.',
      'Autonomy is not the same thing as traction. A machine can be ready to sell and still have zero confirmed buyers. ZeusAI publishes that zero on /origin. The number moves only when a settlement is confirmed. Page views, bot hits, and draft invoices are not customers.',
      'The technical loop is ordinary, on purpose. You pick a service. The server quotes one price. You pay the owner wallet in Bitcoin, or another rail if that rail is actually configured. After settlement, the server issues an Ed25519-signed receipt and a delivery credential. You can verify the receipt with the public key at /api/v50/keys.json.',
      'What the system will not do is invent a crowd. There is no “trusted by thousands” line, because that sentence would be false today. The useful claim is narrower: the catalog, the checkout, the refund contract, and the owner identity are public, and the buyer count is public too.',
      'If you are evaluating the category, read /how for the delivery path and /refund for the money-back terms. Then decide with the ledger in front of you, not with a slogan.',
    ],
  },
  {
    slug: 'ai-resume-service-bitcoin',
    title: 'An AI resume service you can pay for in Bitcoin',
    description: 'How the $39 Instant Resume + LinkedIn Makeover works, what you must send, and what a signed receipt does and does not prove.',
    keywords: 'AI resume service',
    paragraphs: [
      'The Instant Resume + LinkedIn Makeover is a $39 service. You provide your current resume text, a target role, and an email. The deliverable is a rewritten one-page resume plus a LinkedIn headline and About section aimed at that role.',
      'Bitcoin is the primary checkout. Catalog prices already reflect the Bitcoin discount shown on the homepage. PayPal and card appear on the same checkout only when those processors are configured. If a button is missing, that rail is not armed. The page should not pretend it is.',
      'Payment and delivery are separate facts. A signed receipt proves an order was recorded and, once settled, that the payment matched the quote. It does not by itself prove you liked the writing. If the result is wrong, the refund contract at /refund is the remedy, together with a message to the owner.',
      'This is a small, specific product. It is not a career guarantee and it is not a claim that employers prefer AI-edited resumes. It is a paid rewrite with a public price, a public operator, and a public refund page.',
      'Start at /checkout/?plan=instant-resume-makeover. If you want a different deliverable, the website audit is $49 and is listed beside it.',
    ],
  },
  {
    slug: 'bitcoin-checkout-for-ai-services',
    title: 'How Bitcoin checkout works for an AI service',
    description: 'Bitcoin checkout for AI services: quote, owner wallet, confirmation, signed receipt, and what to do if a payment is not matched.',
    keywords: 'Bitcoin AI services',
    paragraphs: [
      'A Bitcoin checkout on ZeusAI is a quote plus an address. The server locks a dollar price, converts it with the spot rate it is using, and shows a BIP-21 payment URI for the owner wallet. You send that amount from your own wallet. No custodian in this flow holds the coins.',
      'The server watches for a matching payment. When it sees settlement, it marks the order paid and issues the signed receipt and the delivery credential. Until that match exists, the order is unpaid. A screenshot of a sent transaction is not the same record as a confirmed match.',
      'If you pay and nothing is delivered, do not argue with a trust-score website first. Open /refund, keep the transaction id, and email the owner at the address on /contact. The refund page is the contract. The owner is a named person, not a ticket queue.',
      'Shared hosting and a privacy-protected WHOIS record do not move coins. The wallet address published on /trust is the destination you can check in a block explorer. Compare it with the address on your invoice before you send funds.',
      'Other rails exist in the codebase as optional adapters. They are live only when their keys are present. The honest checkout is the one that shows the rail you can actually use.',
    ],
  },
  {
    slug: 'how-zeusai-delivery-and-refunds-work',
    title: 'How ZeusAI delivery and refunds work',
    description: 'Delivery times, signed receipts, and the refund contract for ZeusAI instant services and longer engagements.',
    keywords: 'ZeusAI refund delivery',
    paragraphs: [
      'Instant services name a delivery window in minutes. The resume makeover is listed at about 10 minutes. The website audit is listed at about 5 minutes. Those clocks start from settlement, not from the moment you open the page.',
      'Professional services are engagements. The RAG chatbot and the marketing engine take a reserve payment and unlock a kickoff pack. The finished system is delivered across the stated milestone window by the operator. Paying does not download a complete company.',
      'Every paid order is supposed to carry an Ed25519-signed receipt. You can verify it offline with the public key. Verification proves the platform signed the record. It does not replace reading the deliverable.',
      'The refund contract lives at /refund. It includes a 30-day money-back window and a path for a signed refund intent when a service promise is breached. Settlement of that intent is an owner action, not an automatic clawback of Bitcoin. Read that sentence before you pay. Bitcoin payments are hard to reverse, which is why the contract and the owner email are the protection, not a card network.',
      'Cancellation of a subscription intent is /cancel. There is a separate anti-dark-pattern pledge at /pledge. None of these pages invent a satisfaction score. They are the rules.',
    ],
  },
  {
    slug: 'reading-a-low-trust-score',
    title: 'How to read a low trust score on a young Bitcoin checkout',
    description: 'What a low Scamadviser-style score usually measures, and which ZeusAI pages answer those checks without invented reviews.',
    keywords: 'website trust score Bitcoin checkout',
    paragraphs: [
      'A low automated trust score usually means the domain is young, the WHOIS record is private, the IP is shared with other sites, and a complaint exists. Those are real inputs. They are not a proof that a specific unpaid invoice happened, and they are not a proof that it did not.',
      'ZeusAI cannot unmask WHOIS from application code. The operator name and email are public on /about and /contact. A street address, phone number, and company registration number are not published, because they have not been supplied for publication. Inventing them would make the trust problem worse.',
      'The site runs on a single VPS. A shared address with unrelated neighbors is how many small servers look to a reputation feed. The remedy a buyer can use is narrower: check the wallet, the refund page, the owner email, and whether the deliverable is described specifically enough to reject.',
      'A negative review about Bitcoin paid and nothing delivered is a serious claim. This codebase does not contain that review and does not deny it. If you are the person who paid, write to the owner with the transaction id and the order id. If you are a prospect, treat the claim as unresolved until you see a public correction or a refund receipt.',
      'The pages that answer the check are /trust-safety, /refund, /trust, and /origin. The buyer count on /origin is allowed to be zero. A zero you can see is more trustworthy than a testimonial you cannot verify.',
    ],
  },
];

const OBJECTIONS = [
  {
    q: 'Is this a scam?',
    a: 'You can check the operator, the wallet, and the refund contract before you pay. The operator is Vladoi Ionut, reachable at the email on /contact. The buyer ledger on /origin stays at zero until a payment settles. ZeusAI does not publish invented testimonials. A low automated trust score and any unpaid-delivery complaint are addressed on /trust-safety, not waved away.',
  },
  {
    q: 'How does Bitcoin payment work?',
    a: 'Checkout quotes one dollar price, shows the owner Bitcoin address, and waits for a matching settlement. A signed receipt is issued after that match. Compare the address with /trust before you send coins. PayPal or card is shown only when that rail is configured.',
  },
  {
    q: 'What if I am not satisfied?',
    a: 'Read /refund before you pay. It states a 30-day money-back window and a signed refund intent when a service promise is breached. Email the owner with your order id. Bitcoin is not automatically reversible, so the contract and the named operator are the protection.',
  },
];

const TARGETS = [
  { name: 'r/artificial', url: 'https://www.reddit.com/r/artificial/', audience: 'AI enthusiasts' },
  { name: 'r/MachineLearning', url: 'https://www.reddit.com/r/MachineLearning/', audience: 'ML practitioners' },
  { name: 'r/LocalLLaMA', url: 'https://www.reddit.com/r/LocalLLaMA/', audience: 'developers running local models' },
  { name: 'r/Entrepreneur', url: 'https://www.reddit.com/r/Entrepreneur/', audience: 'small business owners' },
  { name: 'r/smallbusiness', url: 'https://www.reddit.com/r/smallbusiness/', audience: 'small business owners' },
  { name: 'r/resumes', url: 'https://www.reddit.com/r/resumes/', audience: 'resume buyers' },
  { name: 'r/jobs', url: 'https://www.reddit.com/r/jobs/', audience: 'job seekers' },
  { name: 'r/Bitcoin', url: 'https://www.reddit.com/r/Bitcoin/', audience: 'Bitcoin users' },
  { name: 'r/btc', url: 'https://www.reddit.com/r/btc/', audience: 'Bitcoin users' },
  { name: 'r/SideProject', url: 'https://www.reddit.com/r/SideProject/', audience: 'indie developers' },
  { name: 'r/SaaS', url: 'https://www.reddit.com/r/SaaS/', audience: 'SaaS founders' },
  { name: 'r/startups', url: 'https://www.reddit.com/r/startups/', audience: 'startup founders' },
  { name: 'r/webdev', url: 'https://www.reddit.com/r/webdev/', audience: 'web developers' },
  { name: 'r/ChatGPT', url: 'https://www.reddit.com/r/ChatGPT/', audience: 'AI product users' },
  { name: 'r/indiehackers', url: 'https://www.reddit.com/r/indiehackers/', audience: 'indie hackers' },
  { name: 'Indie Hackers', url: 'https://www.indiehackers.com/', audience: 'indie hackers' },
  { name: 'Hacker News Show HN', url: 'https://news.ycombinator.com/show', audience: 'developers' },
  { name: 'Product Hunt', url: 'https://www.producthunt.com/', audience: 'early adopters' },
  { name: 'Hugging Face', url: 'https://huggingface.co/', audience: 'ML developers' },
  { name: 'LinkedIn AI groups search', url: 'https://www.linkedin.com/search/results/groups/?keywords=artificial%20intelligence', audience: 'operators and hiring managers' },
];

const state = {
  events: {
    impression: { A: 0, B: 0 },
    conversion: { A: 0, B: 0 },
    checkout_start: 0,
    btc_checkout: 0,
    contact_submit: 0,
    signup: 0,
    pageview: 0,
  },
  leads: [],
};

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function ssrVariant() {
  return HEADLINES.A;
}

function pickVariant(seed) {
  const s = String(seed == null ? '' : seed);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 2 === 0 ? HEADLINES.A : HEADLINES.B;
}

function article(slug) {
  const id = String(slug || '').replace(/^\/insights\//, '').replace(/\/+$/, '');
  return ARTICLES.find((a) => a.slug === id) || null;
}

function publicPaths() {
  return ['/trust-safety', '/insights'].concat(ARTICLES.map((a) => '/insights/' + a.slug));
}

function objections() {
  return OBJECTIONS.map((x) => ({ q: x.q, a: x.a }));
}

function outreachTargets() {
  return TARGETS.map((t) => Object.assign({}, t));
}

function _variantId(meta) {
  const v = meta && meta.variant;
  return v === 'A' || v === 'B' ? v : '';
}

function track(event, meta) {
  const name = String(event || '').slice(0, 40);
  const variant = _variantId(meta);
  if (name === 'impression' || name === 'conversion') {
    const bucket = variant || 'A';
    state.events[name][bucket] += 1;
    return { ok: true, protocol: PROTOCOL, event: name, variant: bucket, counts: eventCounts() };
  }
  if (Object.prototype.hasOwnProperty.call(state.events, name) && name !== 'impression' && name !== 'conversion') {
    state.events[name] += 1;
    return { ok: true, protocol: PROTOCOL, event: name, counts: eventCounts() };
  }
  return { ok: false, protocol: PROTOCOL, error: 'unknown_event' };
}

function eventCounts() {
  return {
    impression: Object.assign({}, state.events.impression),
    conversion: Object.assign({}, state.events.conversion),
    checkout_start: state.events.checkout_start,
    btc_checkout: state.events.btc_checkout,
    contact_submit: state.events.contact_submit,
    signup: state.events.signup,
    pageview: state.events.pageview,
  };
}

function addLead(input) {
  const src = input || {};
  const lead = {
    id: 'lead_' + (state.leads.length + 1),
    name: String(src.name || '').trim().slice(0, 80),
    email: String(src.email || '').trim().slice(0, 120),
    channel: String(src.channel || '').trim().slice(0, 80),
    status: ['draft', 'sent', 'replied', 'closed'].includes(src.status) ? src.status : 'draft',
    note: String(src.note || '').trim().slice(0, 280),
    at: new Date().toISOString(),
  };
  if (!lead.name && !lead.channel) return { ok: false, error: 'name_or_channel_required' };
  state.leads.push(lead);
  if (state.leads.length > 100) state.leads.shift();
  return { ok: true, id: lead.id, status: lead.status };
}

function listLeads(token) {
  const expected = String(process.env.DISCOVER_TRUST_DESK_TOKEN || '');
  const unlocked = expected.length >= 8 && token && token === expected;
  const counts = { draft: 0, sent: 0, replied: 0, closed: 0, total: state.leads.length };
  state.leads.forEach((l) => { counts[l.status] += 1; });
  const leads = state.leads.map((l) => ({
    id: l.id,
    name: l.name,
    channel: l.channel,
    status: l.status,
    note: l.note,
    at: l.at,
    email: unlocked ? l.email : (l.email ? 'redacted' : ''),
  }));
  return { ok: true, unlocked, counts, leads };
}

function draftOutreach(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const messages = list.map((row) => {
    const name = String((row && row.name) || '').trim();
    const email = String((row && row.email) || '').trim();
    const company = String((row && row.company) || '').trim();
    const note = String((row && row.note) || '').trim();
    const hello = name ? ('Hi ' + name + ',') : 'Hi,';
    const companyLine = company ? ('I am writing about ' + company + '. ') : '';
    const noteLine = note ? (note + ' ') : '';
    const body = [
      hello,
      '',
      companyLine + noteLine + 'ZeusAI sells a $39 Instant Resume + LinkedIn Makeover and other signed AI services. Bitcoin is the primary checkout. PayPal and card appear only when those rails are armed.',
      'The public ledger currently shows zero paid customers. That number is not invented. Refund terms: ' + OWNER.domain + '/refund',
      'Trust notes: ' + OWNER.domain + '/trust-safety',
      'Operator: ' + OWNER.name + ' <' + OWNER.email + '>',
      '',
      'This draft was generated locally and was not sent.',
    ].join('\n');
    return {
      to: email,
      subject: (name ? name + ', a' : 'A') + ' signed AI deliverable you can verify',
      body,
      sent: false,
    };
  });
  return { ok: true, sent: false, transport: 'none', count: messages.length, messages };
}

function analyticsConfig() {
  const verification = String(process.env.GOOGLE_SITE_VERIFICATION || '').trim();
  const ga = String(process.env.GA_MEASUREMENT_ID || '').trim();
  const plausible = String(process.env.PLAUSIBLE_DOMAIN || '').trim();
  const sentry = String(process.env.SENTRY_DSN || '').trim();
  return {
    searchConsoleMeta: /^[A-Za-z0-9_-]{8,128}$/.test(verification),
    ga4Enabled: false,
    plausibleEnabled: false,
    sentryEnabled: false,
    gaMeasurementPresent: /^G-[A-Z0-9]+$/.test(ga),
    plausibleDomainPresent: plausible.length > 0,
    sentryDsnPresent: sentry.length > 0,
    thirdPartyScriptsInjected: false,
    reason: 'First-party events only. The public pledge refuses ad trackers. GA4, Plausible, and Sentry stay off until the owner approves a pledge exception and supplies the id.',
  };
}

function headExtras() {
  const token = String(process.env.GOOGLE_SITE_VERIFICATION || '').trim();
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(token)) return '';
  return '<meta name="google-site-verification" content="' + token + '"/>';
}

function serviceListJsonLd(base) {
  const origin = String(base || OWNER.domain).replace(/\/+$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'ZeusAI services',
    itemListElement: SERVICES.map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Service',
        name: s.name,
        serviceType: s.name,
        description: s.description,
        url: origin + s.path,
        provider: { '@type': 'Organization', name: 'ZeusAI', email: OWNER.email },
        offers: {
          '@type': 'Offer',
          price: s.priceUsd,
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          url: origin + s.path,
        },
      },
    })),
  };
}

function articleJsonLd(route, base) {
  const found = article(route);
  if (!found) return null;
  const origin = String(base || OWNER.domain).replace(/\/+$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: found.title,
    description: found.description,
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
    author: { '@type': 'Person', name: OWNER.name },
    publisher: { '@type': 'Organization', name: 'ZeusAI', email: OWNER.email },
    mainEntityOfPage: origin + '/insights/' + found.slug,
  };
}

function status() {
  const cfg = analyticsConfig();
  return {
    ok: true,
    protocol: PROTOCOL,
    inventsTestimonials: false,
    inventsAddress: false,
    inventsReviews: false,
    inventsVisitors: false,
    inventsCustomers: false,
    btcWalletPublished: true,
    btcGatewayProbe: 'not_run_in_process',
    externalApiProbe: 'not_run_in_process',
    healthEndpoints: ['/health', '/api/health', '/api/discover-trust'],
    analytics: {
      searchConsoleMeta: cfg.searchConsoleMeta,
      thirdPartyScriptsInjected: false,
      ga4Enabled: false,
      plausibleEnabled: false,
      sentryEnabled: false,
    },
    events: eventCounts(),
    leads: listLeads('').counts,
    articles: ARTICLES.length,
    targets: TARGETS.length,
  };
}

function discovery() {
  return Object.assign(status(), {
    paths: publicPaths(),
    services: SERVICES.map((s) => ({ id: s.id, name: s.name, priceUsd: s.priceUsd, path: s.path })),
    headlines: ['A', 'B'],
  });
}

function pageTrustSafety() {
  return `<section style="padding-top:140px;max-width:980px">
  <span class="kicker">Trust and safety · DTO/1.0</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 14px">What a buyer can <span class="grad">check before paying.</span></h1>
  <p style="color:var(--ink-dim);font-size:16px;line-height:1.7;max-width:760px">This page answers the checks that automated trust scores raise. It does not invent a street address, a phone number, a company registration, or customer reviews.</p>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-top:22px">
    <div class="card"><span class="tag">Operator</span><h3 style="margin:8px 0">Named person</h3><p style="color:var(--ink-dim);font-size:14.5px;line-height:1.65;margin:0">${esc(OWNER.name)} operates ZeusAI. Email <a href="mailto:${esc(OWNER.email)}">${esc(OWNER.email)}</a>. The same identity is on <a href="/about" data-link>/about</a> and <a href="/contact" data-link>/contact</a>.</p></div>
    <div class="card"><span class="tag">WHOIS</span><h3 style="margin:8px 0">Privacy is still on</h3><p style="color:var(--ink-dim);font-size:14.5px;line-height:1.65;margin:0">Application code cannot make a registrar publish WHOIS. Until the owner turns privacy off at the registrar, the public identity is the name and email above.</p></div>
    <div class="card"><span class="tag">Address and phone</span><h3 style="margin:8px 0">Not published</h3><p style="color:var(--ink-dim);font-size:14.5px;line-height:1.65;margin:0">No street address, phone number, or registration number is printed here. Those values are omitted until the owner supplies them. A placeholder would be a false trust signal.</p></div>
    <div class="card"><span class="tag">Server</span><h3 style="margin:8px 0">One VPS</h3><p style="color:var(--ink-dim);font-size:14.5px;line-height:1.65;margin:0">zeusai.pro is a single VPS behind nginx, with the site and API managed by PM2. A shared IP can sit next to unrelated sites. That is a property of the host, not a claim about those neighbors.</p></div>
    <div class="card"><span class="tag">Low score and reviews</span><h3 style="margin:8px 0">Not denied</h3><p style="color:var(--ink-dim);font-size:14.5px;line-height:1.65;margin:0">A score near zero usually flags hidden WHOIS, a young domain, a shared address, and a complaint. A report of Bitcoin paid with no delivery is a serious claim. This site does not contain that review and does not call it false. If you paid, email the owner with the transaction id and use <a href="/refund" data-link>/refund</a>.</p></div>
    <div class="card"><span class="tag">Payment</span><h3 style="margin:8px 0">Settlement, then delivery</h3><p style="color:var(--ink-dim);font-size:14.5px;line-height:1.65;margin:0">Bitcoin is paid to the owner wallet published on <a href="/trust" data-link>/trust</a>. Match that address to the invoice before you send. A signed receipt follows a matched settlement. The refund contract is <a href="/refund" data-link>/refund</a>.</p></div>
    <div class="card"><span class="tag">Data</span><h3 style="margin:8px 0">No training on your text</h3><p style="color:var(--ink-dim);font-size:14.5px;line-height:1.65;margin:0">Order email, the brief you submit, and the receipt are the data. The privacy policy and DPA forbid resale and model training on personal data. See <a href="/privacy" data-link>/privacy</a> and <a href="/dpa" data-link>/dpa</a>.</p></div>
    <div class="card"><span class="tag">Buyers</span><h3 style="margin:8px 0">Counted in public</h3><p style="color:var(--ink-dim);font-size:14.5px;line-height:1.65;margin:0">paidHumans moves only after a confirmed settlement. The homepage no longer leads with a giant zero, and the number remains on <a href="/origin" data-link>/origin</a>.</p></div>
  </div>
  <p style="margin-top:22px"><a class="btn btn-primary" href="/refund" data-link>Read the refund contract</a> <a class="btn" href="/contact" data-link>Contact the operator</a></p>
</section>`;
}

function pageInsightsIndex() {
  const cards = ARTICLES.map((a) => `<a class="card" href="/insights/${esc(a.slug)}" data-link style="padding:20px;text-decoration:none;display:block"><span class="tag">${esc(a.keywords)}</span><h3 style="margin:12px 0 8px;font-size:17px;color:#fff">${esc(a.title)}</h3><p style="color:var(--ink-dim);font-size:13.5px;line-height:1.6;margin:0">${esc(a.description)}</p><span style="display:inline-block;margin-top:12px;color:var(--blue2);font-size:13px">Read article →</span></a>`).join('');
  return `<section style="padding-top:140px;max-width:1080px">
  <span class="kicker">Insights · owner written</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 14px">Five notes on <span class="grad">buying from this system.</span></h1>
  <p style="color:var(--ink-dim);max-width:680px">Written by ${esc(OWNER.name)}. No guest customers, no invented case studies. Each note describes a page you can open.</p>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:14px;margin-top:26px">${cards}</div>
</section>`;
}

function pageArticle(slug) {
  const found = article(slug);
  if (!found) {
    return `<section style="padding-top:140px;max-width:760px"><h1>Article not found</h1><p><a href="/insights" data-link>All insights</a></p></section>`;
  }
  const body = found.paragraphs.map((p) => `<p style="color:var(--ink-dim);font-size:16.5px;line-height:1.75">${esc(p)}</p>`).join('');
  return `<article style="padding-top:140px;max-width:760px">
  <span class="kicker">${esc(found.keywords)}</span>
  <h1 style="font-size:clamp(32px,4vw,52px);margin:10px 0 12px">${esc(found.title)}</h1>
  <p style="color:var(--ink-dim);font-size:14px">By ${esc(OWNER.name)} · ${PUBLISHED} · <a href="/insights" data-link>All insights</a></p>
  ${body}
  <p style="margin-top:22px"><a class="btn btn-primary" href="/checkout/?plan=instant-resume-makeover" data-link>See the $39 checkout</a> <a class="btn" href="/trust-safety" data-link>Trust and safety</a></p>
</article>`;
}

function pageDesk() {
  const counts = listLeads('').counts;
  return `<section style="padding-top:140px;max-width:880px">
  <span class="kicker">Internal · not for crawlers</span>
  <h1 style="font-size:clamp(32px,4vw,48px);margin:10px 0 12px">Outreach desk</h1>
  <p style="color:var(--ink-dim);line-height:1.65">Drafts are generated by <code class="inline">scripts/outreach-draft.js</code> and are never sent by this server. Leads you type here stay in process memory. Emails are redacted unless <code class="inline">DISCOVER_TRUST_DESK_TOKEN</code> is set and you unlock the list.</p>
  <p style="font-family:var(--mono);font-size:13px">draft ${counts.draft} · sent ${counts.sent} · replied ${counts.replied} · closed ${counts.closed} · total ${counts.total}</p>
  <form id="dtDeskForm" class="card" style="padding:18px;display:grid;gap:10px;margin-top:12px">
    <input name="name" placeholder="Prospect name" aria-label="Prospect name" style="padding:10px;border-radius:8px;border:1px solid var(--stroke);background:#0b0f17;color:inherit"/>
    <input name="channel" placeholder="Community or channel" aria-label="Channel" style="padding:10px;border-radius:8px;border:1px solid var(--stroke);background:#0b0f17;color:inherit"/>
    <input name="email" type="email" placeholder="Email (optional, stored redacted)" aria-label="Email" style="padding:10px;border-radius:8px;border:1px solid var(--stroke);background:#0b0f17;color:inherit"/>
    <select name="status" aria-label="Status" style="padding:10px;border-radius:8px;border:1px solid var(--stroke);background:#0b0f17;color:inherit"><option value="draft">draft</option><option value="sent">sent</option><option value="replied">replied</option><option value="closed">closed</option></select>
    <textarea name="note" rows="3" placeholder="Note" aria-label="Note" style="padding:10px;border-radius:8px;border:1px solid var(--stroke);background:#0b0f17;color:inherit"></textarea>
    <button class="btn btn-primary" type="submit">Save lead locally</button>
    <span id="dtDeskMsg" style="font-size:13px;color:var(--ink-dim)"></span>
  </form>
  <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
    <input id="dtDeskToken" type="password" placeholder="Desk token" aria-label="Desk token" style="padding:10px;border-radius:8px;border:1px solid var(--stroke);background:#0b0f17;color:inherit"/>
    <button class="btn" type="button" id="dtDeskRefresh">Refresh list</button>
  </div>
  <pre class="code" id="dtDeskList" style="margin-top:12px">No leads loaded.</pre>
</section>`;
}

function howBuyerHtml() {
  return `<section id="howBuyerPath">
  <div class="section-title"><div><span class="kicker">For buyers</span><h2>What happens after you <span class="grad">click pay.</span></h2></div>
  <p>The architecture above is the machine. This is the contract a person can use.</p></div>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px">
    <div class="card"><span class="tag">1 · Choose</span><p style="color:var(--ink-dim);line-height:1.65">Pick a named service. The $39 resume makeover and the $49 website audit are instant SKUs. The chatbot and marketing engine are engagements with a kickoff pack, not a finished company in a download.</p></div>
    <div class="card"><span class="tag">2 · Quote</span><p style="color:var(--ink-dim);line-height:1.65">Checkout locks one dollar price. Bitcoin is the primary rail and shows the owner wallet. Other rails appear only when configured.</p></div>
    <div class="card"><span class="tag">3 · Settle</span><p style="color:var(--ink-dim);line-height:1.65">Delivery follows a matched payment. Instant SKUs quote minutes (resume about 10, website audit about 5). Engagements quote days. A signed receipt is the record.</p></div>
    <div class="card"><span class="tag">4 · Refund</span><p style="color:var(--ink-dim);line-height:1.65">If the deliverable is missing or wrong, use <a href="/refund" data-link>/refund</a> and email ${esc(OWNER.email)}. Bitcoin is not auto-reversed. The 30-day window and the breach path are written on that page. Questions about the trust score are on <a href="/trust-safety" data-link>/trust-safety</a>.</p></div>
  </div>
</section>`;
}

function objectionHtml() {
  const rows = OBJECTIONS.map((f) => `<details class="card" style="padding:14px 16px"><summary style="cursor:pointer;font-weight:650">${esc(f.q)}</summary><p style="color:var(--ink-dim);font-size:14.5px;line-height:1.65;margin:10px 0 0">${esc(f.a)}</p></details>`).join('');
  return `<section id="homeObjections" style="margin:28px 0 0">
  <div class="section-title"><div><span class="kicker">Before you pay</span><h2>Three questions, <span class="grad">answered in public.</span></h2></div></div>
  <div style="display:grid;gap:10px">${rows}</div>
  <p style="margin-top:12px"><a href="/faq" data-link>Full FAQ</a> · <a href="/trust-safety" data-link>Trust and safety</a> · <a href="/refund" data-link>Refund contract</a></p>
</section>`;
}

function blogCards() {
  return ARTICLES.map((a) => ({
    href: '/insights/' + a.slug,
    tag: 'Article',
    title: a.title,
    sub: a.description,
  }));
}

function resetForTests() {
  state.events.impression.A = 0;
  state.events.impression.B = 0;
  state.events.conversion.A = 0;
  state.events.conversion.B = 0;
  state.events.checkout_start = 0;
  state.events.btc_checkout = 0;
  state.events.contact_submit = 0;
  state.events.signup = 0;
  state.events.pageview = 0;
  state.leads.length = 0;
}

module.exports = {
  PROTOCOL,
  OWNER,
  HEADLINES,
  SERVICES,
  ARTICLES,
  ssrVariant,
  pickVariant,
  article,
  publicPaths,
  objections,
  outreachTargets,
  track,
  eventCounts,
  addLead,
  listLeads,
  draftOutreach,
  analyticsConfig,
  headExtras,
  serviceListJsonLd,
  articleJsonLd,
  status,
  discovery,
  pageTrustSafety,
  pageInsightsIndex,
  pageArticle,
  pageDesk,
  howBuyerHtml,
  objectionHtml,
  blogCards,
  resetForTests,
};
