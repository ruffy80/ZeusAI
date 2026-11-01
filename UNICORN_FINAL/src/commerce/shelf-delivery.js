'use strict';

/**
 * The paid file for a shelf offer. Each writer fills the sections the card
 * names, from the lines on the order. A sentence that names a missing system
 * stays a boundary. It is not a substitute for the section.
 */

const crypto = require('crypto');

function clip(value, max) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max || 400);
}

function field(lines, key) {
  const prefix = String(key).toLowerCase() + ':';
  const hit = (lines || []).find((line) => String(line).toLowerCase().startsWith(prefix));
  return hit ? String(hit).slice(prefix.length).trim() : '';
}

function words(value) {
  return String(value || '').replace(/[^a-z0-9]+/gi, ' ').trim().split(/\s+/).filter(Boolean);
}

function esc(value) {
  return String(value || '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

function brief(lines) {
  return (lines || []).length
    ? lines.map((line) => '- ' + line).join('\n')
    : '- No extra brief was on the order.';
}

function amountOf(receipt) {
  const paid = receipt && (receipt.amount || receipt.amountUsd || receipt.amount_usd);
  const n = Number(paid);
  return Number.isFinite(n) && n > 0
    ? ('$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
    : 'the amount on the receipt';
}

function orderId(receipt) {
  return receipt && (receipt.id || receipt.orderId) ? String(receipt.id || receipt.orderId) : 'unknown';
}

function svgWordmark(name) {
  const label = esc(clip(name, 24) || 'Mark');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="160" viewBox="0 0 640 160" role="img" aria-label="' + label + ' wordmark"><rect width="640" height="160" fill="#f7f4ef"/><text x="32" y="104" font-family="Georgia, serif" font-size="64" fill="#111111">' + label + '</text></svg>';
}

function svgMonogram(name) {
  const letter = esc((clip(name, 1) || 'M').toUpperCase());
  return '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" role="img" aria-label="' + letter + ' monogram"><rect width="128" height="128" rx="16" fill="#0b8a3e"/><text x="64" y="86" text-anchor="middle" font-family="Georgia, serif" font-size="72" fill="#f7f4ef">' + letter + '</text></svg>';
}

function svgFavicon(name) {
  const letter = esc((clip(name, 1) || 'M').toUpperCase());
  return '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" role="img" aria-label="' + letter + ' favicon"><rect width="32" height="32" fill="#111111"/><text x="16" y="23" text-anchor="middle" font-family="Georgia, serif" font-size="18" fill="#f7f4ef">' + letter + '</text></svg>';
}

function eightNames(seed) {
  const stem = (words(seed)[0] || 'Atlas').slice(0, 16);
  return [stem, stem + 'ly', stem + 'os', stem + 'lab', 'North' + stem, stem + 'line', stem + 'kit', stem + 'works'];
}

function logoKit(lines, seed) {
  const brand = field(lines, 'brandName') || words(seed)[0] || 'the brand';
  const industry = field(lines, 'industry') || 'the industry on the order';
  const names = eightNames(brand);
  return [
    '## Name candidates',
    'Eight name candidates for ' + brand + '. This file does not check whether a domain is available.',
    names.map((name, index) => (index + 1) + '. ' + name + ' — a spelling of the brand on this order.').join('\n'),
    '',
    '## Positioning',
    brand + ' serves ' + industry + '. One offer, one reader, one next step.',
    '',
    '## Taglines',
    '1. ' + brand + ' for ' + industry + '.',
    '2. The work of ' + brand + ', in one file.',
    '3. ' + brand + ' starts with the name on this page.',
    '4. Say ' + brand + ' in one line.',
    '5. ' + industry + ', named and ready to use.',
    '',
    '## Voice',
    'Audience: people who buy in ' + industry + '.',
    'Tone: short sentences. Use the brand name ' + brand + '. Do not invent a customer.',
    'Sample lines: ' + brand + ' is the name. The marks below are the marks for this order.',
    '',
    '## Color and type',
    'Ink #111111, paper #f7f4ef, accent #0b8a3e. Georgia for the name. A neutral sans for the interface.',
    '',
    '## SVG wordmark',
    '```svg',
    svgWordmark(brand),
    '```',
    '',
    '## SVG monogram',
    '```svg',
    svgMonogram(brand),
    '```',
    '',
    '## SVG favicon',
    '```svg',
    svgFavicon(brand),
    '```',
  ].join('\n');
}

function namingSprint(lines, seed) {
  const concept = field(lines, 'concept') || seed;
  const names = eightNames(concept);
  return [
    '## Name candidates',
    'Eight name candidates from the concept on the order. This file does not check whether a domain is available.',
    names.map((name, index) => (index + 1) + '. ' + name).join('\n'),
    '',
    '## Positioning',
    clip(concept, 280) + ' — one offer, one reader, one next step.',
    '',
    '## Taglines',
    '1. Name the work before the decoration.',
    '2. ' + (words(concept)[0] || 'This') + ' is the offer.',
    '3. One sentence, then the next step.',
    '4. The concept on this order is the source.',
    '5. Leave a domain check for a registrar.',
  ].join('\n');
}

function brandVoice(lines, seed) {
  const brand = field(lines, 'brandName') || words(seed)[0] || 'the brand';
  const audience = field(lines, 'audience') || 'the reader named on the order';
  return [
    '## Voice',
    'Brand: ' + brand + '.',
    'Audience: ' + audience + '.',
    'Tone: short sentences, concrete nouns, no invented customer.',
    'Do: name ' + brand + ' and the next step.',
    'Do not: invent a quote, a follower count, or a prize.',
    'Sample lines: ' + brand + ' writes to ' + audience + '. The next step is the one on this page.',
    'Sample lines: If ' + audience + ' asked for one sentence, this is that sentence.',
    'This is the written voice. It is not a finished voice guide as a designed brand book.',
  ].join('\n');
}

function pitchDeck(lines, seed) {
  const idea = field(lines, 'idea') || seed;
  const short = clip(idea, 220);
  const slides = [
    ['Problem', short + ' The reader already has this problem. No market size was added.'],
    ['Solution', 'The offer is the work named in the brief: ' + short],
    ['Market', 'The buyer is the person who has the problem in the brief. A market size is not in this order, so none is printed.'],
    ['Product', 'The product in this deck is the offer in the brief. ' + short],
    ['Ask', 'The ask is the shelf price of this deck. The next step is to use the slides below.'],
  ];
  const htmlSlides = slides.map((pair, index) => (
    '<section id="s' + (index + 1) + '"><p>' + (index + 1) + ' / 5</p><h1>' + esc(pair[0]) + '</h1><p>' + esc(pair[1]) + '</p></section>'
  )).join('');
  const html = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Pitch deck</title><style>body{margin:0;font:18px/1.45 Georgia,serif;background:#111;color:#f7f4ef}section{min-height:100vh;padding:8vh 10vw;box-sizing:border-box}h1{font-size:2.4rem;margin:0 0 1rem}a{color:#f7f4ef}</style></head><body>' + htmlSlides + '</body></html>';
  return [
    slides.map((pair) => '## ' + pair[0] + '\n' + pair[1]).join('\n\n'),
    '',
    'This file is a self-contained HTML slide deck: problem, solution, market, product, and ask.',
    '',
    '```html',
    html,
    '```',
  ].join('\n');
}

function landingPage(lines, seed) {
  const name = field(lines, 'productName') || clip(seed, 80) || 'The offer';
  const value = field(lines, 'valueProp') || 'The value proposition is the one on the order.';
  const benefits = [
    value,
    'The reader can see the next step without another page.',
    'The words are the words on this order. No customer quote was added.',
  ];
  const html = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>' + esc(name) + '</title><style>body{font:16px/1.5 Georgia,serif;max-width:720px;margin:2rem auto;padding:0 1rem;color:#111;background:#f7f4ef}a{display:inline-block;background:#111;color:#f7f4ef;padding:.7rem 1rem;text-decoration:none}</style></head><body><h1>' + esc(name) + '</h1><p>' + esc(value) + '</p><h2>Benefits</h2><ul>' + benefits.map((line) => '<li>' + esc(line) + '</li>').join('') + '</ul><h2>FAQ</h2><p>What is this page? This file is the page.</p><p>Is it hosted? It is not a hosted site. Open the file.</p><p>Where do the words come from? They come from this order.</p><a href="#buy">Continue</a></body></html>';
  return [
    '## Hero',
    name,
    value,
    '',
    '## Benefits',
    benefits.map((line, index) => (index + 1) + '. ' + line).join('\n'),
    '',
    '## FAQ',
    'What is this page? This file is the page.',
    'Is it hosted? It is not a hosted site. Open the file.',
    'Where do the words come from? They come from this order.',
    '',
    '## Call to action',
    'Continue with ' + name + '.',
    '',
    'The page below is one self-contained HTML file.',
    '',
    '```html',
    html,
    '```',
  ].join('\n');
}

function seoPack(lines, seed) {
  const niche = field(lines, 'niche') || 'the niche on the order';
  const rawKeywords = field(lines, 'keywords') || seed;
  const keys = rawKeywords.split(/[,;\n]/).map((part) => part.trim()).filter(Boolean).slice(0, 12);
  const list = keys.length ? keys : [rawKeywords];
  const title = 'A practical guide to ' + clip(niche, 80);
  return [
    '## Keywords',
    list.map((word) => '- ' + word).join('\n'),
    '',
    '## Title and meta',
    'Title: ' + title,
    'Meta description: One article for ' + niche + ', using the keywords above. It does not claim a ranking.',
    '',
    '## Article',
    title,
    '',
    'This article is about ' + niche + '. The keywords on the order are ' + list.join(', ') + '.',
    '',
    'Start with the reader. They came for ' + (list[0] || niche) + '. Say the offer in one sentence, then give the three steps they can do this week.',
    '',
    'First, write the offer in the same words as ' + (list[0] || niche) + '. Second, point one internal link at that offer. Third, make the title tag repeat that sentence.',
    '',
    'The middle of the article stays with ' + niche + '. Do not add a customer quote, a traffic number, or a ranking. Those were not on the order.',
    '',
    'Close with one action: publish the page, then read the site\'s own logs. The keywords ' + list.join(', ') + ' are the words to look for. A ranking is not claimed.',
    '',
    '## Internal links',
    '- Link the article to the service page that sells the offer.',
    '- Link once to the checkout path for that offer.',
  ].join('\n');
}

function emailSequence(lines, seed) {
  const product = field(lines, 'product') || seed;
  const goal = field(lines, 'goal') || 'the goal on the order';
  const steps = [
    ['Welcome', 'Say what ' + clip(product, 80) + ' is, in one paragraph.'],
    ['First use', 'Give one action that serves ' + goal + '.'],
    ['The stuck point', 'Name the one place a reader stops, and the next click.'],
    ['Proof you can show', 'Point at the file they already have. Do not invent a quote.'],
    ['The close', 'Ask for the single action that matches ' + goal + '.'],
  ];
  const emails = steps.map((step, index) => [
    '## Email ' + (index + 1),
    'Subject: ' + step[0] + ' — ' + clip(product, 50),
    'Preview: ' + step[1],
    'Body: Email ' + (index + 1) + ' of five emails. Product: ' + clip(product, 180) + '. Goal: ' + goal + '. ' + step[1],
    'Send timing: day ' + index,
    'Call to action: Do the action in the body for ' + goal + '.',
    '',
  ].join('\n'));
  return ['Five emails for ' + clip(product, 80) + '. The goal is ' + goal + '.', ''].concat(emails).join('\n');
}

function socialKit(lines, seed) {
  const brand = field(lines, 'brand') || words(seed)[0] || 'the brand';
  const channels = field(lines, 'channels') || 'the channels on the order';
  const hooks = [
    'The offer in one line',
    'Who it is for',
    'The first step',
    'What is left out',
    'A question the reader can answer',
    'The file they can open',
    'The next click',
  ];
  const posts = hooks.map((hook, index) => (
    (index + 1) + '. Hook: ' + hook + ' for ' + brand + '. Caption: Post ' + (index + 1) + ' of seven text posts. ' + hook + '. The channel is ' + channels + '. Hashtags: #' + brand.replace(/[^a-z0-9]/gi, '') + ' #' + channels.split(/[,\s]+/)[0].replace(/[^a-z0-9]/gi, '')
  ));
  return [
    '## Weekly theme',
    'Seven text posts for ' + brand + ' on ' + channels + '. Each one has a hook, a caption, and hashtags.',
    '',
    '## Hooks, captions, hashtags',
    posts.join('\n'),
    '',
    'This file is not thirty finished posts and it has no image files.',
  ].join('\n');
}

function resumeFile(lines) {
  const source = field(lines, 'currentResume');
  const role = field(lines, 'targetRole') || 'the role on the order';
  if (!source) {
    return [
      '## Resume',
      'No resume text was on the order. No employer was invented.',
      '',
      '## LinkedIn headline',
      role,
      '',
      '## About section',
      'No source text was on the order, so this about section does not add a job. This is not a Word file and it has no photo.',
    ].join('\n');
  }
  const bits = source.split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean).slice(0, 8);
  return [
    '## Resume',
    'Target role: ' + role + '.',
    'The lines below are the resume text on the order. No employer was added.',
    bits.map((line) => '- ' + line).join('\n'),
    '',
    '## LinkedIn headline',
    role + (bits[0] ? (' — ' + clip(bits[0], 80)) : ''),
    '',
    '## About section',
    bits.slice(0, 3).join(' ') || source,
    'This is not a Word file and it has no photo.',
  ].join('\n');
}

const SKETCH = {
  'professional-saas-mvp': ['browser client', 'HTTP API', 'account store', 'billing row'],
  'professional-ai-agent': ['task from the brief', 'tool list named in the brief', 'result record'],
  'professional-mobile-app': ['screens named in the spec', 'device API', 'local store'],
  'professional-ecommerce-store': ['catalog named by the brand', 'cart record', 'order record'],
  'professional-ai-chatbot': ['question from the brief', 'passage store at the docs URL', 'answer record'],
  'professional-data-pipeline': ['source named in the brief', 'transform step', 'table for each KPI in the brief'],
  'professional-ai-marketing': ['audience named in the brief', 'message record', 'send record'],
  'professional-investor-package': ['problem from the brief', 'offer', 'ask'],
};

function professionalBody(serviceId, lines) {
  const parts = SKETCH[serviceId] || ['input from the brief', 'process', 'record'];
  return [
    '## Scope',
    'The scope of this project kickoff is the brief below.',
    brief(lines),
    '',
    '## Architecture sketch',
    'Components:',
    parts.map((part, index) => (index + 1) + '. ' + part + '.').join('\n'),
    'Flow: ' + parts.join(' → ') + '.',
    'This file is the project kickoff. The finished build is not in this file.',
    '',
    '## Milestones',
    '1. Accept the brief above as the scope of this file.',
    '2. Accept the architecture sketch above as the shape of this order.',
    '3. This file is the paid delivery. The price is the price of this file.',
  ].join('\n');
}

function kickoffBody(lines, receipt) {
  return [
    '## Discovery brief',
    'This discovery brief records the buyer lines on the order.',
    brief(lines),
    'It does not deliver the license, the source, or a private cloud.',
    '',
    '## Commercial proposal',
    'The paid amount on this order is ' + amountOf(receipt) + '.',
    'This commercial proposal is the paid start. The amount is credited toward a signed engagement.',
    'What the buyer receives now: this discovery brief, this commercial proposal, and the draft statement of work.',
    '',
    '## Draft statement of work',
    'Parties: the buyer named in the discovery brief, and ZeusAI.',
    'Deliverable: the three documents in this file.',
    'Acceptance: this file is issued.',
    'This draft statement of work is the download. The license, the source, and a private cloud are not in this download.',
  ].join('\n');
}

function write(opts) {
  const serviceId = String(opts && opts.serviceId || '');
  const lines = opts && opts.quoted || [];
  const seed = opts && opts.seed || serviceId;
  if (serviceId === 'ent-engagement-kickoff') return kickoffBody(lines, opts.receipt);
  if (/^professional-/i.test(serviceId) && opts && opts.professional) return professionalBody(serviceId, lines);
  if (serviceId === 'instant-logo-kit') return logoKit(lines, seed);
  if (serviceId === 'instant-product-naming') return namingSprint(lines, seed);
  if (serviceId === 'instant-brand-voice') return brandVoice(lines, seed);
  if (serviceId === 'instant-pitch-deck') return pitchDeck(lines, seed);
  if (serviceId === 'instant-landing-page') return landingPage(lines, seed);
  if (serviceId === 'instant-seo-content-pack') return seoPack(lines, seed);
  if (serviceId === 'instant-email-sequence') return emailSequence(lines, seed);
  if (serviceId === 'instant-social-media-kit') return socialKit(lines, seed);
  if (serviceId === 'instant-resume-makeover') return resumeFile(lines);
  return null;
}

function industrySections(row) {
  const title = row.title || row.id;
  const kpi = row.kpi || 'the named focus';
  return [
    '## Outcomes',
    '1. Name the operation this ' + title + ' applies to.',
    '2. Write the workflow for the KPI focus.',
    '3. Keep the system list in this architecture pack.',
    '4. Hand the file to the buyer.',
    '',
    '## KPI focus',
    'The page focus is: ' + kpi + '.',
    'The KPI focus is the label of the work in this pack. A measured number is not in the order, so none is printed. It is not a certification.',
    '',
    '## Workflow',
    '1. Intake — one sentence for the operation.',
    '2. Systems — the four systems in this architecture pack.',
    '3. Record — keep the sentence with the system names.',
    '4. Review — read the sentence against ' + kpi + '.',
    '5. Handoff — this file is the handoff.',
    '',
    '## Phase plan',
    'Week 1: write the intake sentence.',
    'Week 2: confirm the four systems.',
    'Week 3: review the sentence against ' + kpi + '.',
    'Week 4: hand off this architecture pack.',
    '',
    '## Architecture',
    'Systems for ' + title + ':',
    '- Intake',
    '- Record of ' + kpi,
    '- Review',
    '- Handoff',
    'Data moves from Intake to the record, then to Review, then to Handoff.',
    '',
    '## Handoff',
    'This document is the architecture pack. It does not install an operating system.',
    '',
  ];
}

function frontierWork(row, receipt) {
  const id = orderId(receipt);
  const amount = amountOf(receipt);
  const code = crypto.createHash('sha256').update(id + '|shelf').digest('hex').slice(0, 12);
  const expiry = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  switch (row.id) {
    case 'frontier-refund-shield':
      return [
        'Refund guarantee for order ' + id + '.',
        'Covered: the file named on the card for this order.',
        'Amount: ' + amount + '.',
        'The refund closes once this file is issued.',
        'Bitcoin is not auto-reversed. This record is the shield for this order.',
      ];
    case 'frontier-aura-feed':
      return [
        'Read GET /api/aura.',
        'Print the counts the endpoint returns. When a count is absent, leave it empty.',
        'This file does not add a visitor, an order, or a GMV figure.',
      ];
    case 'frontier-outcome-pricing':
      return [
        'List price: the shelf price of the file.',
        'Bitcoin pays 10% under that list. Card and PayPal pay the list when they are configured.',
        'A price in this file is that rule. It is not a measured customer outcome.',
      ];
    case 'frontier-checkout-cascade':
      return [
        'Rail order for this checkout:',
        '1. Bitcoin, the live rail.',
        '2. Card, when the card checkout is configured.',
        '3. PayPal, when PayPal is configured.',
        'This file does not invent a rail.',
      ];
    case 'frontier-timelock-discounts':
      return [
        'Vault code: ' + code,
        'Order: ' + id,
        'Expires: ' + expiry,
        'The code is the SHA-256 prefix of this order id. It is the time-locked record in this file.',
      ];
    case 'frontier-receipt-nft':
      return [
        'Receipt record for order ' + id + '.',
        'Lookup route: /frontier#frWorkshop.',
        'This file is the receipt record. It does not mint a token on a public chain by itself.',
      ];
    case 'frontier-email-proof':
      return [
        'Email manifest for order ' + id + '.',
        'The manifest records that this file was issued. It does not send a campaign.',
      ];
    case 'frontier-gift-capability':
      return [
        'Capability token: gift_' + code,
        'Order: ' + id,
        'Redeem the token on /gift. This file is the token record for that page.',
      ];
    case 'frontier-bandit-transparency':
      return [
        'Read the bandit snapshot the transparency endpoint returns.',
        'This file does not invent a conversion rate.',
      ];
    case 'frontier-carbon-checkout':
      return [
        'Factor printed in this file: 400 grams of CO2 per USD on the receipt.',
        'Amount: ' + amount + '.',
        Number(receipt && (receipt.amount || receipt.amountUsd)) > 0
          ? ('Grams: ' + Math.round(Number(receipt.amount || receipt.amountUsd) * 400) + '.')
          : 'Grams are not filled in because the receipt has no amount.',
        'This file does not purchase an offset.',
      ];
    default:
      return [row.tool || 'The tool named on the card.'];
  }
}

function frontierSections(row, receipt) {
  return [
    '## Tool contract',
    row.tool,
    '',
    '## Live route',
    row.route,
    '',
    '## Work product',
    frontierWork(row, receipt).join('\n'),
    '',
    '## What stays outside this file',
    'Orbital compute, a neural implant, and a quantum channel are not in this download.',
    '',
  ];
}

function listingSections(lines) {
  return [
    '## Supplier status',
    'Auto-ship stays off until a CJ, Printful, or Printify key is armed and the row is dispatchable.',
    '',
    '## Listing sheets',
    'Every curated listing sheet that loaded is below, with cost and shipping.',
    ...lines,
    '',
    '## What this file does not ship',
    'This file does not dispatch a parcel and it does not invent a tracking number.',
    '',
  ];
}

const FILE_SECTIONS = {
  'instant-logo-kit': ['Name candidates', 'Positioning', 'Taglines', 'Voice', 'Color and type', 'SVG wordmark', 'SVG monogram', 'SVG favicon'],
  'instant-product-naming': ['Name candidates', 'Positioning', 'Taglines'],
  'instant-brand-voice': ['Voice', 'Audience', 'Tone', 'Sample lines'],
  'instant-pitch-deck': ['Problem', 'Solution', 'Market', 'Product', 'Ask'],
  'instant-landing-page': ['Hero', 'Benefits', 'FAQ', 'Call to action'],
  'instant-seo-content-pack': ['Keywords', 'Title and meta', 'Article', 'Internal links'],
  'instant-email-sequence': ['Email 1', 'Email 5', 'Send timing', 'Call to action'],
  'instant-social-media-kit': ['Weekly theme', 'Hashtags'],
  'instant-resume-makeover': ['Resume', 'LinkedIn headline', 'About section'],
  'ent-engagement-kickoff': ['Discovery brief', 'Commercial proposal', 'Draft statement of work'],
};

function sectionsFor(serviceId) {
  return FILE_SECTIONS[String(serviceId || '')] || null;
}

module.exports = {
  write,
  sectionsFor,
  industrySections,
  frontierSections,
  listingSections,
  eightNames,
};
