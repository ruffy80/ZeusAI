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
    h1: 'Hello. What can I do for you?',
    lead: 'Say what you do and what you want. ZeusAI answers from the live shelf: the deliverable, the price, when it arrives, and one next step. It also names a real option you did not ask for.',
    cta: 'Show me the offer',
    href: '#concierge',
  },
  B: {
    id: 'B',
    h1: 'Tell me the work. I will price a real next step.',
    lead: 'The reply uses only offers ZeusAI can deliver. Bitcoin is the live payment. Card and PayPal appear on checkout when they are configured.',
    cta: 'Show me the offer',
    href: '#concierge',
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
      'If you are evaluating the category, read /how for the delivery path and /refund for the refund terms. Then decide with the ledger in front of you, not with a slogan.',
    ],
  },
  {
    slug: 'ai-resume-service-bitcoin',
    title: 'An AI resume service you can pay for in Bitcoin',
    description: 'How a minute-file on the public shelf works, what you must send, and what a signed receipt does and does not prove.',
    keywords: 'AI resume service',
    paragraphs: [
      'Ask ZeusAI what you do and what you want. The reply is one shelf offer with a price and a delivery clock, plus a neighboring offer you did not have to name. A resume rewrite is one minute-file on that shelf. You provide the current text, a target role, and an email. The deliverable is a rewritten one-page resume plus a LinkedIn headline and About section aimed at that role.',
      'Bitcoin is the primary checkout. The card on the shelf shows the live price, including the Bitcoin discount. PayPal and card appear on the same checkout only when those processors are configured. If a button is missing, that rail is not armed. The page should not pretend it is.',
      'Payment and delivery are separate facts. A signed receipt proves an order was recorded and, once settled, that the payment matched the quote. It does not by itself prove you liked the writing. If the result is wrong, the refund contract at /refund is the remedy, together with a message to the owner.',
      'A minute-file is not a career guarantee and it is not a claim that employers prefer AI-edited resumes. It is a paid rewrite with a public price, a public operator, and a public refund page.',
      'Start at the homepage and describe the work. The shelf lists the rewrite beside the website audit and the other minute-files. Pay only the card whose deliverable you actually want.',
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
      'If a payment is not matched to the order, open /refund, keep the transaction id, and email the owner at the address on /contact. The refund page is the contract. The owner is a named person, not a ticket queue.',
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
      'The refund contract lives at /refund. The refund closes once the file, license, or work is issued. An order whose file was never issued can be reported within 30 days. Settlement of that case is an owner action, not an automatic clawback of Bitcoin. Read that sentence before you pay. Bitcoin payments are hard to reverse, which is why the contract and the owner email are the protection, not a card network.',
      'Cancellation of a subscription intent is /cancel. There is a separate anti-dark-pattern pledge at /pledge. None of these pages invent a satisfaction score. They are the rules.',
    ],
  },
  {
    slug: 'reading-a-low-trust-score',
    title: 'How to check ZeusAI before you pay',
    description: 'Operator identity, the Bitcoin wallet, the delivery clock, and the refund contract. No invented reviews.',
    keywords: 'ZeusAI trust transparency support',
    paragraphs: [
      'Check three public facts before you pay. The operator is named on /about and /contact. The Bitcoin address is published on /trust and must match the invoice. The refund contract is at /refund.',
      'ZeusAI does not publish a street address, a phone number, or a company registration number. Those values stay off the site until the owner supplies them for publication. A placeholder would be a false trust signal.',
      'The site runs on a single VPS behind nginx. The check a buyer can do is the wallet, the refund page, the owner email, and whether the shelf card names a deliverable you can reject.',
      'Delivery follows a matched payment. Minute files quote a clock in minutes. Engagements open a kickoff pack, then the operator delivers on the stated window. If the file is missing or wrong, email the owner with the order id and the transaction id and use /refund.',
      'The pages for that check are /trust-safety, /refund, /trust, and /origin. ZeusAI does not publish invented testimonials. Confirmed buyers are counted on /origin.',
    ],
  },
  {
    slug: 'ai-orchestration-on-a-public-shelf',
    title: 'What AI orchestration means when the catalog is public',
    description: 'AI orchestration on ZeusAI is the path from a sentence to one shelf offer, a price, and a checkout. It is not a hidden chain of models.',
    keywords: 'AI orchestration',
    paragraphs: [
      'Orchestration, on this site, means one path: you describe the work, the server matches a public shelf offer, checkout locks a price, and a signed receipt follows a matched payment. That is the loop a person can inspect. It is not a claim that several unnamed models are chained together behind every purchase.',
      'The shelf is the boundary. A minute file names a file you receive. A day engagement names a kickoff, then human delivery on the stated window. A contract figure is a proposal unless the card says the kickoff itself is payable. Orchestration does not turn those clocks into a finished company.',
      'If a sentence does not match an offer ZeusAI can deliver, the reply should say so. Adding a product that is not on the shelf would make the orchestration look larger than the store. The concierge on the homepage is the place to test that limit.',
      'Search engines can read the same offers in /sitemap.xml and on /guides. Those pages are how a stranger finds a specific deliverable. They are not a traffic count.',
      'Start at the homepage, name the work, and compare the button with the card. If the price or the href differs, that is a defect, not a routing feature.',
    ],
  },
  {
    slug: 'model-routing-without-a-hidden-catalog',
    title: 'Model routing without a hidden catalog',
    description: 'ZeusAI does not sell an unnamed model router as a checkout line. The price on a card is the price of a named deliverable.',
    keywords: 'model routing',
    paragraphs: [
      'Model routing usually means software that sends each request to a different model based on cost or quality. That is a real category. It is not a ZeusAI checkout SKU. The public shelf prices a resume, an audit, a logo, a kickoff, and the other named offers. It does not price a router.',
      'The number on the card is the number on checkout. Bitcoin is the live rail. Card and PayPal appear when those processors are configured. None of those rails is a token meter for a model you did not choose.',
      'A later lease of models, if one is published, has to appear as its own offer with its own price. Until that row exists, a landing page about routing must not grow a buy button for a product that is not for sale.',
      'What you can buy today is listed on /services and /guides. Each guide repeats the deliverable, the clock, and the same checkout href. That repetition is the routing a buyer can verify.',
      'If you need a specific file, ask the concierge. The reply should name the shelf id. If it names a router you cannot find on /services, do not pay.',
    ],
  },
  {
    slug: 'what-self-improvement-means-here',
    title: 'What self-improvement means on an autonomous store',
    description: 'Autonomy ticks and proposed changes are not the same thing as an unsupervised rewrite of production. Buyers can read the public receipts.',
    keywords: 'self-improvement AI',
    paragraphs: [
      'Self-improvement, as a slogan, often means a system that rewrites itself. ZeusAI records autonomy ticks and can hold proposals. A proposal is not a production edit. The public place to read what actually ran is /live-actions.',
      'The improvement a buyer can check is narrower. Guide pages and service pages read the live shelf, so a price change shows up on the article without a hand-edited blog post. That is maintenance of the catalog, not a claim that the model invented a new company overnight.',
      'Search Console, social network keys, and a street address are not things the loop can invent. When those are missing, the status pages stay open on purpose. Closing them with a fake token or a fake post would be the opposite of improvement.',
      'If you are paying for a deliverable, self-improvement of the platform is not your deliverable unless the shelf card says so. Read the card. The refund contract at /refund covers a missed promise, not a missed roadmap fantasy.',
      'Operators can inspect the same honesty on /seo. Four of the discovery checks are closed in code. Google indexing, Search Console, and off-site posts stay open until an outside system confirms them.',
    ],
  },
  {
    slug: 'multi-agent-checkout',
    title: 'Multi-agent systems and who is allowed to pay',
    description: 'Software agents can discover a ZeusAI price. An agent is not a customer until a payment settles. The protocol is /agents.',
    keywords: 'multi-agent systems',
    paragraphs: [
      'A multi-agent system is a set of programs that hand work to each other. ZeusAI publishes an agent commerce protocol at /agents and a machine-readable catalog at /agents.json. An agent can request a quote and, if the offer is buyable, open the same checkout a person uses.',
      'Loading a page is not a purchase. A bot, a crawler, and an agent are not added to the buyer ledger because they fetched HTML. The ledger on /origin moves when a settlement is confirmed.',
      'There is no rented swarm of employees on the shelf. If a card says the engagement is a kickoff, paying does not hire a team of agents to run your company. The clock on the card is the contract.',
      'Agent checkout still has to show a real offer id, a price, and a rail that is actually configured. Bitcoin is live. Other rails appear only when their keys exist. An agent that skips that check is not using the protocol.',
      'Read /agents before you connect anything that can spend money. Then read /refund. Autonomous payment does not delete the refund contract or the owner email.',
    ],
  },
  {
    slug: 'public-cost-of-an-ai-service',
    title: 'The public cost of an AI service',
    description: 'ZeusAI prices are on the shelf and on the guide. Pricing experiments belong on /transparency. A lower number is not a profit promise.',
    keywords: 'AI cost optimization',
    paragraphs: [
      'Cost, for a buyer, is the price on the card. That price is repeated on the service page, the guide, and checkout. If those three differ, trust the defect report, not a marketing sentence about optimization.',
      'The site also has a public pricing experiment page at /transparency. Experiments are supposed to show impressions and conversions that actually happened. An empty experiment is not a winner. No page should crown a headline from zero visits.',
      'Bitcoin checkout shows the discount the shelf already includes. It is not a second, secret price. Card and PayPal, when configured, are the same checkout, not a cheaper hidden catalog.',
      'There is no shelf line that promises a percentage cut of your cloud bill. If you want a file, an audit, or a kickoff, pay for that. If you want a cost-cutting retainer, it has to be written as its own offer before it is a cart.',
      'The useful optimization is the one you can recompute: open /guides, read the price, open checkout, and see the same figure. That check does not require an analytics vendor.',
    ],
  },
];

const OBJECTIONS = [
  {
    q: 'Who operates ZeusAI, and how does support work?',
    a: 'Vladoi Ionut operates ZeusAI. Email the address on /contact. Before you pay, compare the Bitcoin address with /trust and read the deliverable on the shelf card. Delivery follows a matched payment. The refund at /refund closes once the file is issued. An unissued order can be reported within 30 days.',
  },
  {
    q: 'How does the refund work?',
    a: 'Read /refund before you pay. The refund closes once the file, license, or work is issued. An order whose file was never issued can be reported within 30 days. Email the owner with your order id. Bitcoin is not automatically reversible, so the contract and the named operator are the protection.',
  },
  {
    q: 'Do I need to pay with Bitcoin?',
    a: 'Bitcoin is the payment method that is live today. Card and PayPal show on the same checkout when those processors are configured. If a button is missing, that method is not available yet. Compare the Bitcoin address with /trust before you send coins.',
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

const LANDINGS = [
  {
    slug: 'model-routing',
    title: 'Model routing is not a hidden checkout',
    description: 'ZeusAI does not sell an unnamed model router. The public shelf prices named deliverables, and checkout uses that same price.',
    h1: 'There is no secret model-routing product.',
    sub: 'The card, the guide, and the checkout name one offer. A router that is not on /services is not for sale.',
    cta: 'Ask for a real offer',
    href: '/#concierge',
    article: '/insights/model-routing-without-a-hidden-catalog',
  },
  {
    slug: 'self-improvement',
    title: 'Self-improvement without an unsupervised rewrite',
    description: 'Autonomy receipts are public. A proposal is not a production edit, and a missing Search Console token stays missing.',
    h1: 'Self-improvement stops where the proof stops.',
    sub: 'Read /live-actions for what ran. The shelf price updates on the guide. The loop does not invent customers or a street address.',
    cta: 'Read the public receipts',
    href: '/live-actions',
    article: '/insights/what-self-improvement-means-here',
  },
  {
    slug: 'multi-agent',
    title: 'Multi-agent checkout that still requires a payment',
    description: 'Agents can discover a ZeusAI price at /agents. A page load is not a customer. The buyer ledger moves on settlement.',
    h1: 'Agents can quote. Only settlement counts.',
    sub: 'The protocol is /agents. There is no rented swarm on the shelf. A kickoff is a kickoff.',
    cta: 'Read the agent protocol',
    href: '/agents',
    article: '/insights/multi-agent-checkout',
  },
  {
    slug: 'experiment-engine',
    title: 'Experiments stay unpublished until the counts are real',
    description: 'Headline and price experiments are recorded in public. Zero impressions do not produce a winner.',
    h1: 'An empty experiment is not a winner.',
    sub: 'Impressions and conversions on /transparency are counts that happened. The homepage does not swap its headline from a zero sample.',
    cta: 'Open the experiment record',
    href: '/transparency',
    article: '/insights/public-cost-of-an-ai-service',
  },
];

const SOCIAL_DRAFTS = [
  { channel: 'linkedin', text: 'ZeusAI prices a named deliverable on a public shelf. The guide, the card, and checkout use the same number. Bitcoin is live. Buyer count is on /origin. https://zeusai.pro/guides' },
  { channel: 'linkedin', text: 'I wrote a plain note on what AI orchestration means here: one sentence in, one shelf offer out. No hidden router. https://zeusai.pro/insights/ai-orchestration-on-a-public-shelf' },
  { channel: 'x', text: 'Public shelf. Same price on the guide and at checkout. Bitcoin is the live rail. The buyer ledger is on /origin. https://zeusai.pro/buy' },
  { channel: 'reddit', text: 'Showing the work, not a launch thread with fake users. ZeusAI is an owner-operated checkout for named AI deliverables. Refund contract: https://zeusai.pro/refund — questions go to the owner email on /contact.' },
  { channel: 'reddit', text: 'If you want the long version of how a Bitcoin checkout is supposed to match the card, this note stays specific: https://zeusai.pro/insights/bitcoin-checkout-for-ai-services' },
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
  const id = String(slug || '').replace(/^\/(?:insights|blog)\//, '').replace(/\/+$/, '');
  return ARTICLES.find((a) => a.slug === id) || null;
}

function publicPaths() {
  return ['/trust-safety', '/insights']
    .concat(ARTICLES.map((a) => '/insights/' + a.slug))
    .concat(LANDINGS.map((l) => '/' + l.slug));
}

function landing(slug) {
  const id = String(slug || '').replace(/^\//, '').replace(/\/+$/, '');
  return LANDINGS.find((l) => l.slug === id) || null;
}

function socialDrafts() {
  return SOCIAL_DRAFTS.map((d) => Object.assign({ sent: false, inventsReach: false }, d));
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
      companyLine + noteLine + 'ZeusAI answers from a public shelf: say what you do and what you want, and the reply is a real offer with a price, a delivery clock, and one next step. Bitcoin is the live checkout. Card and PayPal appear on the same checkout when they are configured.',
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

function _liveService(id, fallbackPrice, fallbackPath) {
  try {
    const shelf = require('../../commerce/public-shelf');
    const item = shelf && typeof shelf.byId === 'function' ? shelf.byId(id) : null;
    if (item && item.ctaHref && Number(item.priceUsd) > 0) {
      return { price: Number(item.priceUsd), path: item.ctaHref, deliveryDays: item.deliveryDays };
    }
  } catch (_) { /* seed figures */ }
  return { price: fallbackPrice, path: fallbackPath };
}

function serviceListJsonLd(base) {
  const origin = String(base || OWNER.domain).replace(/\/+$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'ZeusAI services',
    itemListElement: SERVICES.map((s, i) => {
      const live = _liveService(s.id, s.priceUsd, s.path);
      const href = String(live.path || s.path);
      const abs = /^https?:/i.test(href) ? href : origin + href;
      return {
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Service',
          name: s.name,
          serviceType: s.name,
          description: s.description,
          url: abs,
          provider: { '@type': 'Organization', name: 'ZeusAI', email: OWNER.email },
          offers: Object.assign({
            '@type': 'Offer',
            price: Number(live.price).toFixed(2),
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock',
            url: abs,
          }, (() => {
            try { return require('../../seo/merchant-offer').offerFields({ deliveryDays: live.deliveryDays }, origin); }
            catch (_) { return {}; }
          })()),
        },
      };
    }),
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
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 14px">Trust, Transparency <span class="grad">&amp; Support.</span></h1>
  <p style="color:var(--ink-dim);font-size:16px;line-height:1.7;max-width:760px">ZeusAI sells the offers on the public shelf. You can check the operator, the wallet, the delivery clock, and the refund contract before you pay. This page does not invent a street address, a phone number, a company registration, or customer reviews.</p>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-top:22px">
    <div class="card"><span class="tag">Operator</span><h3 style="margin:8px 0">Named person</h3><p style="color:var(--ink-dim);font-size:14.5px;line-height:1.65;margin:0">${esc(OWNER.name)} operates ZeusAI. Email <a href="mailto:${esc(OWNER.email)}">${esc(OWNER.email)}</a>. The same identity is on <a href="/about" data-link>/about</a> and <a href="/contact" data-link>/contact</a>.</p></div>
    <div class="card"><span class="tag">WHOIS</span><h3 style="margin:8px 0">Privacy is still on</h3><p style="color:var(--ink-dim);font-size:14.5px;line-height:1.65;margin:0">Application code cannot make a registrar publish WHOIS. Until the owner turns privacy off at the registrar, the public identity is the name and email above.</p></div>
    <div class="card"><span class="tag">Address and phone</span><h3 style="margin:8px 0">Not published</h3><p style="color:var(--ink-dim);font-size:14.5px;line-height:1.65;margin:0">No street address, phone number, or registration number is printed here. Those values are omitted until the owner supplies them. A placeholder would be a false trust signal.</p></div>
    <div class="card"><span class="tag">Server</span><h3 style="margin:8px 0">One VPS</h3><p style="color:var(--ink-dim);font-size:14.5px;line-height:1.65;margin:0">zeusai.pro is a single VPS behind nginx, with the site and API managed by PM2. A shared IP can sit next to unrelated sites. That is a property of the host, not a claim about those neighbors.</p></div>
    <div class="card"><span class="tag">Support</span><h3 style="margin:8px 0">Delivery and contact</h3><p style="color:var(--ink-dim);font-size:14.5px;line-height:1.65;margin:0">Minute files quote a delivery clock that starts at settlement. Engagements open a kickoff, then the operator delivers on the stated window. Email <a href="mailto:${esc(OWNER.email)}">${esc(OWNER.email)}</a> or use <a href="/contact" data-link>/contact</a>. The refund contract is <a href="/refund" data-link>/refund</a>.</p></div>
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
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 14px">${ARTICLES.length} notes on <span class="grad">buying from this system.</span></h1>
  <p style="color:var(--ink-dim);max-width:680px">Written by ${esc(OWNER.name)}. No guest customers, no invented case studies. Each note describes a page you can open.</p>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:14px;margin-top:26px">${cards}</div>
</section>`;
}

function pageLanding(slug) {
  const found = landing(slug);
  if (!found) {
    return `<section style="padding-top:140px;max-width:760px"><h1>Page not found</h1><p><a href="/guides" data-link>Offer guides</a></p></section>`;
  }
  return `<section style="padding-top:140px;max-width:820px" id="topicLanding" data-landing="${esc(found.slug)}">
  <span class="kicker">Topic · not a new SKU</span>
  <h1 style="font-size:clamp(32px,4.2vw,52px);margin:10px 0 12px">${esc(found.h1)}</h1>
  <p style="color:var(--ink-dim);font-size:18px;line-height:1.6;max-width:40rem">${esc(found.sub)}</p>
  <p style="margin-top:18px"><a class="btn btn-primary" href="${esc(found.href)}" data-link>${esc(found.cta)}</a> <a class="btn btn-ghost" href="${esc(found.article)}" data-link>Read the article</a></p>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:22px">
    <a class="card" href="/refund" data-link style="padding:16px;text-decoration:none"><b>Refund guarantee</b><p style="color:var(--ink-dim);margin:8px 0 0">The contract is public. Bitcoin is not auto-reversed.</p></a>
    <a class="card" href="/origin" data-link style="padding:16px;text-decoration:none"><b>Buyer ledger</b><p style="color:var(--ink-dim);margin:8px 0 0">Confirmed payments are counted on /origin.</p></a>
    <a class="card" href="/trust-safety" data-link style="padding:16px;text-decoration:none"><b>Operator</b><p style="color:var(--ink-dim);margin:8px 0 0">${esc(OWNER.name)} · ${esc(OWNER.email)}. Address and phone are not published.</p></a>
  </div>
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
  <p style="margin-top:22px"><a class="btn btn-primary" href="/#concierge" data-link>Ask ZeusAI</a> <a class="btn" href="/trust-safety" data-link>Trust and safety</a></p>
  ${require('../../commerce/share-surface').pageShareHtml({ path: '/insights/' + found.slug, title: found.title, text: found.description })}
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
    <div class="card"><span class="tag">1 · Choose</span><p style="color:var(--ink-dim);line-height:1.65">Say what you do, or pick a named shelf item. Minute files are paid now, including the listing desk, frontier tool packs, and industry architecture packs. Day engagements reserve a kickoff. Enterprise figures buy the engagement pack. None of them is a finished company in a download.</p></div>
    <div class="card"><span class="tag">2 · Quote</span><p style="color:var(--ink-dim);line-height:1.65">Checkout locks one dollar price. Bitcoin is the primary rail and shows the owner wallet. Other rails appear only when configured.</p></div>
    <div class="card"><span class="tag">3 · Settle</span><p style="color:var(--ink-dim);line-height:1.65">Delivery follows a matched payment. Instant SKUs quote minutes (resume about 10, website audit about 5). Engagements quote days. A signed receipt is the record.</p></div>
    <div class="card"><span class="tag">4 · Refund</span><p style="color:var(--ink-dim);line-height:1.65">The refund closes once the file is issued. If the file was never issued, use <a href="/refund" data-link>/refund</a> within 30 days and email ${esc(OWNER.email)}. Bitcoin is not auto-reversed. Operator, wallet, and delivery notes are on <a href="/trust-safety" data-link>/trust-safety</a>.</p></div>
  </div>
</section>`;
}

function homeLandingHtml() {
  return `<section id="homeTrust" class="home-trust" aria-label="Trust and safety">
  <a class="trust-badge" href="/trust" data-link><b>Secure payment</b><span>Bitcoin to the published wallet. Card and PayPal when that checkout is live.</span></a>
  <a class="trust-badge" href="/refund" data-link><b>Refund guarantee</b><span>Closed once the file is issued. Unissued orders can be reported within 30 days.</span></a>
  <a class="trust-badge" href="/privacy" data-link><b>Privacy and GDPR rights</b><span>Export and delete from your account. No resale of your brief.</span></a>
</section>
<section id="howItWorks">
  <div class="section-title"><div><span class="kicker">How it works</span><h2>Three steps. <span class="grad">Then one real offer.</span></h2></div>
  <p>The reply is a shelf item. It is not a promise of customers, interviews, or a finished company in a download.</p></div>
  <div class="grid how-steps">
    <article class="card glass-card"><span class="tag">1 · Say the work</span><h3>What you do, and what you want</h3><p>Write it in the box above. Romanian or English. The match uses the public shelf, not a hidden catalog.</p></article>
    <article class="card glass-card"><span class="tag">2 · Read the price</span><h3>One offer, plus one you did not ask for</h3><p>Each answer names the deliverable, the price, and when it arrives. A second card is an adjacent shelf item, labeled as something you did not request.</p></article>
    <article class="card glass-card"><span class="tag">3 · Pay or ask</span><h3>Bitcoin is live</h3><p>Minute files, the listing desk, frontier tool packs, industry architecture packs, and day-clock reserves open checkout. Enterprise figures buy the engagement pack. Card and PayPal show when they are configured.</p></article>
  </div>
</section>
<section id="earlyAccess" class="card glass-card">
  <span class="kicker">Early access</span>
  <h2 style="margin:8px 0">No published buyer quotes yet.</h2>
  <p style="margin:0;color:var(--ink-dim);line-height:1.65;max-width:68ch">ZeusAI does not publish invented testimonials. A quote will appear here only after a real customer agrees to be named. Until then, use the refund contract and /trust-safety.</p>
</section>
${objectionHtml()}`;
}

function objectionHtml() {
  const rows = OBJECTIONS.map((f) => `<details class="card" style="padding:14px 16px"><summary style="cursor:pointer;font-weight:650">${esc(f.q)}</summary><p style="color:var(--ink-dim);font-size:14.5px;line-height:1.65;margin:10px 0 0">${esc(f.a)}</p></details>`).join('');
  return `<section id="homeObjections" style="margin:28px 0 0" aria-label="Trust, Transparency and Support">
  <div class="section-title"><div><span class="kicker">Trust, Transparency &amp; Support</span><h2>Who operates it, <span class="grad">how delivery works, how to get help.</span></h2></div></div>
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
  LANDINGS,
  landing,
  socialDrafts,
  pageInsightsIndex,
  pageLanding,
  pageArticle,
  pageDesk,
  howBuyerHtml,
  homeLandingHtml,
  objectionHtml,
  blogCards,
  resetForTests,
};
