'use strict';

/**
 * Public engineering guides.
 * ZeusAI does not open a repository, review a pull request, or publish a
 * customer. These pages explain the topics people search for and say what
 * the storefront actually sells.
 */

const DISCLAIMER = 'ZeusAI does not open a repository, does not review a pull request, and does not publish a customer.';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const pages = new Map();

function add(page) {
  pages.set(page.path, page);
}

function linksFor(path, extra) {
  const base = [
    { href: '/learn', label: 'Engineering guide index' },
    { href: '/services', label: 'Marketplace' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/contact', label: 'Contact the owner' },
    { href: '/solutions/model-routing', label: 'Model routing' },
  ];
  const more = extra || [];
  const seen = new Set([path]);
  const out = [];
  more.concat(base).forEach((item) => {
    if (!item || seen.has(item.href) || item.href === path) return;
    seen.add(item.href);
    out.push(item);
  });
  return out.slice(0, 8);
}

function layout(page) {
  const crumbs = [{ href: '/', label: 'Home' }].concat(page.crumbs || []).concat([{ href: page.path, label: page.h1 }]);
  const crumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      item: 'https://zeusai.pro' + c.href,
    })),
  };
  const faq = page.faq || [];
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
  const articleLd = String(page.path || '').indexOf('/blog/') === 0 ? {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: page.h1,
    description: page.description,
    mainEntityOfPage: 'https://zeusai.pro' + page.path,
    author: { '@type': 'Person', name: 'Vladoi Ionut' },
    publisher: { '@type': 'Organization', name: 'ZeusAI', url: 'https://zeusai.pro/' },
  } : null;
  const sections = (page.sections || []).map((section) => {
    const blocks = (section.paragraphs || []).map((p) => `<p>${esc(p)}</p>`).join('');
    const h3s = (section.h3 || []).map((h) => `<h3>${esc(h.h)}</h3>${(h.paragraphs || []).map((p) => `<p>${esc(p)}</p>`).join('')}`).join('');
    const items = (section.items || []).map((item) => `<li>${esc(item)}</li>`).join('');
    const list = items ? `<ul>${items}</ul>` : '';
    return `<h2>${esc(section.h2)}</h2>${blocks}${h3s}${list}`;
  }).join('');
  const offer = offerBlock(page.path);
  const related = linksFor(page.path, page.links);
  const faqHtml = faq.map((item) => `<h3>${esc(item.q)}</h3><p>${esc(item.a)}</p>`).join('');
  const linkHtml = related.map((item) => `<li><a href="${esc(item.href)}" data-link>${esc(item.label)}</a></li>`).join('');
  const crumbHtml = crumbs.map((c, i) => (i === crumbs.length - 1
    ? `<span>${esc(c.label)}</span>`
    : `<a href="${esc(c.href)}" data-link>${esc(c.label)}</a>`)).join(' / ');
  return `<section style="padding-top:140px;max-width:860px" id="authorityPage" data-path="${esc(page.path)}">
<nav aria-label="Breadcrumb" style="font-size:13px;color:var(--ink-dim);margin-bottom:14px">${crumbHtml}</nav>
<span class="kicker">${esc(page.kicker || 'Guide')}</span>
<h1 style="font-size:clamp(32px,4vw,52px);margin:10px 0 16px;line-height:1.08">${esc(page.h1)}</h1>
<p>${esc(DISCLAIMER)}</p>
${offer}
${sections}
<h2>Questions</h2>
${faqHtml}
<h2>Next pages</h2>
<ul>${linkHtml}</ul>
<p><a class="btn btn-primary" href="/services" data-link>Open the marketplace</a> <a class="btn" href="/pricing" data-link>See pricing</a> <a class="btn" href="/contact" data-link>Write to the owner</a></p>
<script type="application/ld+json">${JSON.stringify(crumbLd)}</script>
<script type="application/ld+json">${JSON.stringify(faqLd)}</script>
${articleLd ? `<script type="application/ld+json">${JSON.stringify(articleLd)}</script>` : ''}
</section>`;
}

const STANDARD_FAQ = [
  { q: 'Does ZeusAI read my repository?', a: 'No. The public site does not accept a repository upload and does not review a pull request.' },
  { q: 'What can a buyer pay for today?', a: 'A named file or engagement pack on the marketplace. The price on the card is the list price. Bitcoin pays 10% under that list. Card and PayPal pay the list price when they are configured. Delivery of the file is $0.' },
  { q: 'Is there a published customer or a review?', a: 'No. ZeusAI does not invent a buyer, a testimonial, a revenue figure, or a Lighthouse score.' },
];

function faq(extra) {
  return (extra || []).concat(STANDARD_FAQ);
}

function article(spec) {
  add({
    path: '/blog/' + spec.slug,
    title: spec.title,
    description: spec.description,
    h1: spec.h1,
    kicker: 'Guide',
    crumbs: [{ href: '/blog', label: 'Insights' }, { href: '/learn', label: 'Engineering guides' }],
    links: spec.links,
    faq: faq(spec.faq),
    sections: [
      { h2: 'The question', paragraphs: spec.lead },
      { h2: 'What the practice is', paragraphs: spec.practice, h3: spec.h3 },
      { h2: 'What breaks the claim', items: spec.limits },
      { h2: 'What ZeusAI sells instead', paragraphs: [
        'The homepage is a cost-router demo. It does not store the prompt and it does not call a model provider.',
        'The marketplace sells a named file or an engagement pack. A kickoff file is the start of an engagement. It is not an installed product and it is not a code review of your repo.',
        DISCLAIMER,
      ] },
    ],
  });
}

const ARTICLES = [
  ['what-is-ai-code-review', 'What is AI code review', 'What AI code review is, and what ZeusAI does not do', 'AI code review is a model reading a diff and commenting on risk, tests, and style. A person still owns the merge. ZeusAI does not run that loop.'],
  ['ai-code-review-best-practices', 'AI code review best practices', 'Practices for AI comments on a diff', 'Keep the diff small, ask for bugs and missing tests, and do not treat a model comment as approval. ZeusAI does not comment on diffs.'],
  ['ai-codebase-analysis-explained', 'AI codebase analysis explained', 'What codebase analysis means', 'Codebase analysis maps modules, ownership, and hotspots. It needs a checkout. ZeusAI does not check out your code.'],
  ['how-ai-understands-large-repositories', 'How AI understands large repositories', 'How a model is pointed at a large repo', 'Large repositories are searched, chunked, and cited. The model does not hold the whole tree in one prompt. ZeusAI does not index your tree.'],
  ['best-ai-coding-assistants', 'A map of AI coding assistants', 'How to compare AI coding assistants without a fake ranking', 'Editors, chat panes, and terminal agents are different tools. This page maps the categories. It does not rank ZeusAI among them.'],
  ['ai-software-engineering-platforms', 'AI software engineering platforms', 'What an engineering platform has to include', 'A platform that claims to engineer software needs a repo, a review loop, and a deploy. ZeusAI is a storefront and a cost-router demo.'],
  ['reduce-technical-debt-with-ai', 'How to reduce technical debt with AI', 'A sober way to use a model on debt', 'Debt shrinks when a human picks one hotspot, adds a test, and deletes a path. A model can draft the test. It cannot decide the hotspot for you, and ZeusAI does not scan the repo.'],
  ['monorepo-analysis-with-ai', 'Monorepo analysis with AI', 'What a monorepo analysis has to name', 'A monorepo analysis names packages, the build graph, and who owns each package. ZeusAI does not read a workspace file.'],
  ['repository-intelligence-explained', 'Repository intelligence explained', 'What repository intelligence is', 'Repository intelligence is search plus history plus ownership. It is a property of a code host or a code-search product. It is not a page on this storefront.'],
  ['ai-refactoring-guide', 'AI refactoring guide', 'How a model can draft a refactor', 'A refactor needs a behavior-preserving test first. A model can propose the edit. A person runs the test. ZeusAI does not apply an edit.'],
  ['ai-architecture-review', 'AI architecture review', 'What an architecture review checks', 'An architecture review checks boundaries, data ownership, and failure modes. It is a meeting with a diagram. ZeusAI does not draw your diagram from a repo.'],
  ['ai-pull-request-review', 'AI pull request review', 'What a pull-request review bot does', 'A pull-request bot reads the diff on the forge and posts a comment. ZeusAI has no forge app and posts no review.'],
  ['ai-developer-productivity-guide', 'AI developer productivity guide', 'What productivity claims need', 'A productivity claim needs a before and after on a named team. ZeusAI publishes no such measurement.'],
  ['ai-code-quality-metrics', 'AI code quality metrics', 'Which quality numbers are real', 'Coverage, defect escape, and change-fail rate are measurements. A model score is not one of them unless you publish the method. ZeusAI publishes neither a score nor a method for your code.'],
  ['ai-engineering-workflows', 'AI engineering workflows', 'Where a model fits a delivery workflow', 'A workflow is issue, branch, test, review, deploy. A model can draft text inside that loop. ZeusAI does not host the loop.'],
  ['best-developer-ai-tools', 'A map of developer AI tools', 'Categories of developer AI tools', 'Completion, chat, agents, and review bots solve different jobs. This is a map, not a prize list, and ZeusAI is not entered as a winner.'],
  ['ai-for-startups', 'AI for startups', 'What a startup can buy here', 'A startup on this site can buy a named file, such as a website audit or a kickoff. It cannot hand ZeusAI the company repository.'],
  ['ai-for-software-agencies', 'AI for software agencies', 'What an agency can buy here', 'An agency can buy an engagement pack that is a file with a scope and milestones. The finished build is not in the file.'],
  ['ai-for-enterprise-development', 'AI for enterprise development', 'What enterprise means on this site', 'Enterprise on this site is a proposal or an engagement pack. It is not a private cloud, a source handover, or a code-review seat.'],
  ['complete-guide-to-ai-software-engineering', 'A complete guide to the phrase AI software engineering', 'How to read the phrase AI software engineering', 'The phrase covers assistants, review bots, and agents. This guide separates them. ZeusAI operates the cost demo and the shelf, not those products.'],
];

ARTICLES.forEach((row, index) => {
  const slug = row[0];
  const h1 = row[1];
  const title = h1;
  const description = row[2] + '. ' + DISCLAIMER;
  const next = ARTICLES[(index + 1) % ARTICLES.length];
  const prev = ARTICLES[(index + ARTICLES.length - 1) % ARTICLES.length];
  article({
    slug,
    title,
    description: description.slice(0, 180),
    h1,
    lead: [row[3], DISCLAIMER],
    practice: [
      'Name the input. A review needs a diff. An analysis needs a tree. A chat needs a question. If the input is missing, the output is a guess.',
      'Name the owner of the merge. A model comment is advice. The person who can revert the change is the reviewer of record.',
      'Keep the prompt and the code out of a vendor you have not contracted. This site does not ask for either.',
    ],
    h3: [
      { h: 'Input', paragraphs: ['Write down the artifact: a diff, a module map, or a design note. Do not ask a model to invent the artifact.'] },
      { h: 'Check', paragraphs: ['Run the test or read the diff yourself. A fluent paragraph is not a passing build.'] },
      { h: 'Record', paragraphs: ['Save the decision in the forge or the ticket. A chat transcript is not an audit log.'] },
    ],
    limits: [
      'No repository is uploaded on zeusai.pro.',
      'No pull request is opened or commented on by this site.',
      'No VS Code extension, BYOK desk, or health score is published.',
      'No customer, quote, or star rating is invented on this page.',
    ],
    links: [
      { href: '/blog/' + prev[0], label: prev[1] },
      { href: '/blog/' + next[0], label: next[1] },
      { href: '/use-cases', label: 'Use cases' },
      { href: '/cursor-vs-zeus-ai', label: 'Cursor and ZeusAI' },
    ],
    faq: [{ q: 'Is this a ZeusAI product feature?', a: 'No. ' + row[3] }],
  });
});

const COMPETITORS = [
  ['cursor', 'Cursor', 'An AI editor. You work in its IDE. It can edit files in a project you open locally.'],
  ['windsurf', 'Windsurf', 'An AI IDE from Codeium. The work happens in the editor on a project you open.'],
  ['github-copilot', 'GitHub Copilot', 'Completion and chat inside a host editor, plus a coding agent on GitHub. It needs your repository on that host.'],
  ['devin', 'Devin', 'An autonomous coding agent from Cognition. It is marketed as doing tasks in a development environment. It is not this storefront.'],
  ['sourcegraph-cody', 'Sourcegraph Cody', 'Chat and code search over repositories indexed by Sourcegraph. ZeusAI does not index a repository.'],
  ['replit', 'Replit', 'A browser IDE and hosting environment. Code lives in a Replit project.'],
  ['bolt', 'Bolt', 'An AI app builder in the browser. It generates a project from a prompt. ZeusAI does not.'],
  ['lovable', 'Lovable', 'An AI app builder aimed at generating a product UI from a prompt. ZeusAI does not generate that app.'],
  ['claude-code', 'Claude Code', 'Anthropic’s terminal coding agent. It runs against a checkout on your machine. ZeusAI does not.'],
  ['openai-codex', 'OpenAI Codex', 'OpenAI’s coding agent for a repository. It is a different product from this marketplace.'],
];

COMPETITORS.forEach((row) => {
  const slug = row[0];
  const name = row[1];
  const fact = row[2];
  add({
    path: '/' + slug + '-vs-zeus-ai',
    title: name + ' and ZeusAI',
    description: name + ' is a coding product. ZeusAI is a cost-router demo and a file marketplace. This page does not call ZeusAI a ' + name + ' alternative.',
    h1: name + ' and ZeusAI',
    kicker: 'Comparison',
    crumbs: [{ href: '/learn', label: 'Engineering guides' }],
    links: [
      { href: '/blog/best-ai-coding-assistants', label: 'Map of coding assistants' },
      { href: '/services', label: 'Marketplace' },
    ],
    faq: faq([
      { q: 'Is ZeusAI a ' + name + ' alternative?', a: 'No. ' + fact + ' ZeusAI does not open your repository.' },
    ]),
    sections: [
      { h2: 'What ' + name + ' is', paragraphs: [fact, 'People search for a "' + name + ' alternative" when they want another tool in that same job. This page answers the search by separating the jobs.'] },
      { h2: 'What ZeusAI is', paragraphs: [
        'ZeusAI is operated by Vladoi Ionut. The homepage demonstrates model-cost routing and does not store the prompt. The marketplace sells named files and engagement packs.',
        'Bitcoin is the live payment rail. The list price is the merchant price. Bitcoin pays 10% under the list. Card and PayPal pay the list price when they are configured.',
      ] },
      { h2: 'Feature table', items: [
        name + ': works on a project or repository you connect. ZeusAI: does not connect a repository.',
        name + ': can draft or edit code in its own product. ZeusAI: does not edit your code.',
        'ZeusAI: sells a file you can download after payment, and shows a cost-router demo.',
        'ZeusAI: publishes no customer count and no head-to-head benchmark against ' + name + '.',
      ] },
      { h2: 'Where ZeusAI fits', paragraphs: ['Use ' + name + ' when the job is editing or reviewing a repository. Use ZeusAI when the job is buying a named file or reading the cost demo.'] },
      { h2: 'Use', h3: [
        { h: 'Choose ' + name, paragraphs: ['Choose it when you need an editor, an agent, or a review on code you already host.'] },
        { h: 'Choose the ZeusAI shelf', paragraphs: ['Choose the shelf when you want a priced file, such as a website audit or a kickoff, with Bitcoin checkout.'] },
        { h: 'Do not merge the two claims', paragraphs: ['A page that calls ZeusAI a ' + name + ' replacement would be false. This page does not.'] },
      ] },
    ],
  });
});

const USES = [
  ['startups', 'Startups', 'A startup can buy a website audit or a kickoff file. It cannot upload the company repo.'],
  ['saas', 'SaaS teams', 'A SaaS team can read the cost-router demo and buy a named file. The demo does not sit in the product’s request path.'],
  ['agencies', 'Agencies', 'An agency can buy an engagement pack. The pack is a file. The client build is not inside it.'],
  ['enterprise', 'Enterprise', 'Enterprise here is a proposal or a pack sent to the owner. It is not a seat license for code review.'],
  ['freelancers', 'Freelancers', 'A freelancer can buy the resume file or a site audit. The file is the delivery.'],
  ['open-source', 'Open source', 'Maintainers who want a review bot should look at a forge app. This site is not one.'],
  ['devops', 'DevOps', 'Delivery and rollback stay on your own pipeline. ZeusAI does not deploy your service.'],
  ['qa-teams', 'QA teams', 'QA still owns the cases and the bug reports. ZeusAI does not execute a suite.'],
  ['engineering-managers', 'Engineering managers', 'A manager can read the guides and buy a file. There is no team dashboard of repository health.'],
  ['tech-leads', 'Tech leads', 'A tech lead who wants an architecture review still holds that review. This site does not attend it.'],
  ['founders', 'Founders', 'A founder can buy a kickoff file or a site audit. The company repository stays on the founder’s forge.'],
  ['product-teams', 'Product teams', 'A product team can buy a file that names a scope. The team still writes the product.'],
];

add({
  path: '/use-cases',
  title: 'Use cases',
  description: 'Who can buy a file on ZeusAI, and which engineering jobs this site does not do.',
  h1: 'Use cases',
  kicker: 'Use cases',
  crumbs: [{ href: '/learn', label: 'Engineering guides' }],
  links: USES.slice(0, 5).map((row) => ({ href: '/use-cases/' + row[0], label: row[1] })),
  faq: faq([]),
  sections: [
    { h2: 'Buyers', paragraphs: ['Each page below names one kind of buyer and the offer that matches. None of them upload a repository.'] },
    { h2: 'Pages', items: USES.map((row) => row[1] + ': /use-cases/' + row[0]) },
  ],
});

USES.forEach((row) => {
  add({
    path: '/use-cases/' + row[0],
    title: row[1],
    description: row[2],
    h1: row[1],
    kicker: 'Use case',
    crumbs: [{ href: '/learn', label: 'Engineering guides' }, { href: '/use-cases', label: 'Use cases' }],
    links: [{ href: '/use-cases', label: 'All use cases' }, { href: '/services', label: 'Marketplace' }],
    faq: faq([{ q: 'Does this use case include a repository review?', a: 'No. ' + row[2] }]),
    sections: [
      { h2: 'The job on this site', paragraphs: [row[2], DISCLAIMER] },
      { h2: 'A purchase that matches', paragraphs: ['Open the marketplace, read the file name and the list price, and pay with Bitcoin if you want the 10% reduction. The receipt follows settlement.'] },
      { h2: 'A job that does not match', paragraphs: ['Code review, pull-request comments, and IDE completion are not sold here. The comparison pages name products that do those jobs.'] },
    ],
  });
});

const FRAMEWORKS = [
  ['react', 'React', 'A review looks at state, effect dependencies, list keys, and data fetching.'],
  ['nextjs', 'Next.js', 'A review looks at server and client boundaries, caching, and route handlers.'],
  ['vue', 'Vue', 'A review looks at reactivity, props, and single-file component scope.'],
  ['angular', 'Angular', 'A review looks at modules, change detection, and injectable lifetime.'],
  ['nodejs', 'Node.js', 'A review looks at the event loop, unhandled rejections, and dependency weight.'],
  ['express', 'Express', 'A review looks at middleware order, error handlers, and request validation.'],
  ['nest', 'NestJS', 'A review looks at module boundaries, providers, and pipes.'],
  ['laravel', 'Laravel', 'A review looks at migrations, policies, and queued jobs.'],
  ['php', 'PHP', 'A review looks at types, autoloading, and request lifetime.'],
  ['python', 'Python', 'A review looks at packaging, types, and blocking calls.'],
  ['django', 'Django', 'A review looks at models, migrations, and permission classes.'],
  ['flask', 'Flask', 'A review looks at app factory scope, blueprints, and config.'],
  ['java', 'Java', 'A review looks at nullability, dependency injection, and build time.'],
  ['spring', 'Spring', 'A review looks at bean scope, transactions, and configuration properties.'],
  ['csharp', 'C#', 'A review looks at async, nullable references, and disposal.'],
  ['dotnet', '.NET', 'A review looks at the hosting model, middleware, and publish output.'],
  ['go', 'Go', 'A review looks at context cancellation, error returns, and module versions.'],
  ['rust', 'Rust', 'A review looks at ownership, unsafe blocks, and crate features.'],
];

FRAMEWORKS.forEach((row) => {
  add({
    path: '/' + row[0] + '-ai-code-review',
    title: row[1] + ' and AI code review',
    description: 'What a reviewer checks in ' + row[1] + '. ZeusAI does not run that review.',
    h1: row[1] + ' and AI code review',
    kicker: row[1],
    crumbs: [{ href: '/learn', label: 'Engineering guides' }],
    links: [
      { href: '/blog/what-is-ai-code-review', label: 'What AI code review is' },
      { href: '/services', label: 'Marketplace' },
    ],
    faq: faq([{ q: 'Will ZeusAI review my ' + row[1] + ' repository?', a: 'No. ' + row[2] + ' That work happens in your editor or on your forge.' }]),
    sections: [
      { h2: 'What a review of ' + row[1] + ' looks at', paragraphs: [row[2], 'The reviewer needs the diff. A paragraph about ' + row[1] + ' without the diff is general advice.'] },
      { h2: 'An example of the check', paragraphs: ['Read one changed function. Name the invariant it must keep. Ask whether a test covers that invariant. If the answer is no, the review is unfinished.'] },
      { h2: 'What this site will not do', paragraphs: [DISCLAIMER, 'There is no ' + row[1] + ' parser, plugin, or sample repo attached to checkout.'] },
    ],
  });
});

const DOCS = [
  ['getting-started', 'Getting started', 'Open the homepage, run the cost demo, then open the marketplace. The demo does not store the prompt.'],
  ['project-upload', 'Project upload', 'There is no project upload. ZeusAI does not accept a repository, a zip, or a git URL.'],
  ['code-review', 'Code review', 'There is no code-review product. The guide at /blog/what-is-ai-code-review explains the practice.'],
  ['feature-generator', 'Feature generator', 'There is no feature generator. A kickoff file can describe a feature. It does not build it.'],
  ['engineer-mode', 'Engineer mode', 'There is no engineer mode. The site has a homepage demo and a marketplace.'],
  ['health-score', 'Health score', 'There is no published health score for a repository. ZeusAI does not invent one.'],
  ['git-tools', 'Git tools', 'There is no git remote, no pull-request app, and no commit bot.'],
  ['vs-code-extension', 'VS Code extension', 'There is no VS Code extension to install.'],
  ['byok', 'Bring your own key', 'Buyer checkout does not ask for a model-provider key. Operator secrets stay off the public site.'],
  ['team-workflows', 'Team workflows', 'A team buys the same file as a person. There is no shared workspace or seat map.'],
];

DOCS.forEach((row) => {
  add({
    path: '/docs/' + row[0],
    title: row[1],
    description: row[2],
    h1: row[1],
    kicker: 'Docs',
    crumbs: [{ href: '/docs', label: 'Docs' }],
    links: [{ href: '/docs', label: 'API docs' }, { href: '/learn', label: 'Engineering guides' }],
    faq: faq([{ q: 'Is ' + row[1].toLowerCase() + ' a shipped feature?', a: row[2] }]),
    sections: [
      { h2: 'Status', paragraphs: [row[2], DISCLAIMER] },
      { h2: 'What to use', paragraphs: ['Use /docs for the public API: catalog, checkout, order status, and delivery. Use /services for the file you can buy.'] },
    ],
  });
});

const CHECKS = [
  ['react', 'React', 'framework'],
  ['nextjs', 'Next.js', 'framework'],
  ['vue', 'Vue', 'framework'],
  ['angular', 'Angular', 'framework'],
  ['svelte', 'Svelte', 'framework'],
  ['nodejs', 'Node.js', 'language'],
  ['typescript', 'TypeScript', 'language'],
  ['javascript', 'JavaScript', 'language'],
  ['python', 'Python', 'language'],
  ['django', 'Django', 'framework'],
  ['flask', 'Flask', 'framework'],
  ['fastapi', 'FastAPI', 'framework'],
  ['java', 'Java', 'language'],
  ['kotlin', 'Kotlin', 'language'],
  ['spring', 'Spring', 'framework'],
  ['csharp', 'C#', 'language'],
  ['dotnet', '.NET', 'framework'],
  ['go', 'Go', 'language'],
  ['rust', 'Rust', 'language'],
  ['ruby', 'Ruby', 'language'],
  ['rails', 'Ruby on Rails', 'framework'],
  ['php', 'PHP', 'language'],
  ['laravel', 'Laravel', 'framework'],
  ['elixir', 'Elixir', 'language'],
  ['scala', 'Scala', 'language'],
  ['swift', 'Swift', 'language'],
  ['dart', 'Dart', 'language'],
  ['flutter', 'Flutter', 'framework'],
  ['cpp', 'C++', 'language'],
  ['c', 'C', 'language'],
  ['sql', 'SQL', 'language'],
  ['terraform', 'Terraform', 'tool'],
  ['kubernetes', 'Kubernetes', 'tool'],
  ['graphql', 'GraphQL', 'tool'],
  ['solidity', 'Solidity', 'language'],
  ['bash', 'shell scripts', 'tool'],
  ['startups', 'a startup', 'team'],
  ['saas', 'a SaaS team', 'team'],
  ['agencies', 'an agency', 'team'],
  ['enterprise', 'an enterprise team', 'team'],
  ['freelancers', 'a freelancer', 'team'],
  ['open-source', 'an open-source maintainer', 'team'],
  ['devops', 'a DevOps team', 'team'],
  ['qa', 'a QA team', 'team'],
  ['managers', 'an engineering manager', 'team'],
  ['tech-leads', 'a tech lead', 'team'],
  ['mobile', 'a mobile team', 'team'],
  ['data', 'a data team', 'team'],
  ['security', 'a security reviewer', 'team'],
  ['platform', 'a platform team', 'team'],
  ['design-systems', 'a design-system owner', 'team'],
  ['accessibility', 'an accessibility pass', 'job'],
  ['i18n', 'internationalization', 'job'],
  ['monorepo', 'a monorepo', 'job'],
  ['microservices', 'a microservice estate', 'job'],
  ['legacy', 'a legacy codebase', 'job'],
  ['migrations', 'a migration', 'job'],
  ['refactor', 'a refactor', 'job'],
  ['pr-review', 'pull-request review', 'job'],
  ['testing', 'a test gap', 'job'],
  ['ci', 'a CI pipeline', 'job'],
  ['onboarding', 'engineer onboarding', 'job'],
  ['incident', 'an incident write-up', 'job'],
  ['documentation', 'documentation debt', 'job'],
  ['dependencies', 'dependency updates', 'job'],
  ['licenses', 'license review', 'job'],
  ['fintech', 'a fintech codebase', 'domain'],
  ['health', 'a health-product codebase', 'domain'],
  ['ecommerce', 'an ecommerce codebase', 'domain'],
  ['marketplace', 'a marketplace codebase', 'domain'],
  ['internal-tools', 'internal tools', 'domain'],
  ['greenfield', 'a greenfield app', 'job'],
  ['observability', 'observability code', 'job'],
  ['wasm', 'WebAssembly', 'language'],
  ['zig', 'Zig', 'language'],
  ['haskell', 'Haskell', 'language'],
  ['clojure', 'Clojure', 'language'],
  ['erlang', 'Erlang', 'language'],
  ['perl', 'Perl', 'language'],
  ['lua', 'Lua', 'language'],
  ['r', 'R', 'language'],
  ['matlab', 'MATLAB', 'language'],
  ['powershell', 'PowerShell', 'tool'],
  ['protobuf', 'Protocol Buffers', 'tool'],
  ['ocaml', 'OCaml', 'language'],
  ['fsharp', 'F#', 'language'],
  ['groovy', 'Groovy', 'language'],
  ['objective-c', 'Objective-C', 'language'],
  ['cobol', 'COBOL', 'language'],
  ['fortran', 'Fortran', 'language'],
  ['nim', 'Nim', 'language'],
  ['crystal', 'Crystal', 'language'],
  ['elixir-jobs', 'an Elixir service boundary', 'job'],
  ['code-search', 'code search', 'job'],
  ['support-engineering', 'support engineering', 'team'],
  ['research', 'a research codebase', 'team'],
  ['indie', 'an indie developer', 'team'],
  ['backend', 'a backend team', 'team'],
  ['frontend', 'a frontend team', 'team'],
  ['fullstack', 'a full-stack team', 'team'],
];

CHECKS.forEach((row) => {
  add({
    path: '/best-ai-tool-for/' + row[0],
    title: 'Best AI tool for ' + row[1] + ': a checklist, not a ranking',
    description: 'What to demand from an AI tool aimed at ' + row[1] + '. ZeusAI is not ranked as that tool.',
    h1: 'Best AI tool for ' + row[1] + ': a checklist, not a ranking',
    kicker: 'Checklist',
    crumbs: [{ href: '/learn', label: 'Engineering guides' }],
    links: [{ href: '/blog/best-developer-ai-tools', label: 'Tool map' }, { href: '/services', label: 'Marketplace' }],
    faq: faq([{ q: 'Is ZeusAI the best AI tool for ' + row[1] + '?', a: 'No ranking is published. ZeusAI does not analyze ' + row[1] + '.' }]),
    sections: [
      { h2: 'The search', paragraphs: ['People search “best AI tool for ' + row[1] + '”. A honest answer is a checklist for a ' + row[2] + ', not a prize.'] },
      { h2: 'Ask these questions', items: [
        'Does the tool open the code, or only talk about the language?',
        'Can you point at a diff and get a comment on that diff?',
        'Who stores the source, and for how long?',
        'What measurement, if any, supports a quality claim?',
        'What do you do when the model is wrong?',
      ] },
      { h2: 'Where ZeusAI stands', paragraphs: ['ZeusAI does not analyze ' + row[1] + '. ' + DISCLAIMER] },
    ],
  });
});

const ILLUSTRATIONS = [
  ['website-audit', 'A website audit file', 'A founder pays the list price for the website audit file. The delivery is the file named on the card. This is an illustration, not a customer.'],
  ['resume-file', 'A resume file', 'A person pays for the resume makeover file and supplies their own text. The file does not invent an employer. This is an illustration, not a customer.'],
  ['kickoff-file', 'A kickoff file', 'A team pays for a kickoff file that lists scope and milestones. The finished build is not in the file. This is an illustration, not a customer.'],
  ['bitcoin-receipt', 'A Bitcoin receipt', 'A buyer pays Bitcoin at 10% under the list price and receives a signed receipt after settlement. This is an illustration, not a recorded order.'],
  ['card-list-price', 'Card at the list price', 'When card or PayPal is configured, that rail pays the list price, not the Bitcoin figure. This is an illustration, not a transaction.'],
  ['proposal', 'A proposal', 'An enterprise enquiry produces a proposal. The proposal is not a cart and not an annual contract value. This is an illustration, not a deal.'],
  ['refund-closed', 'A closed refund', 'After the file is issued, the refund closes. The buyer keeps the file. This is the published rule, not a story about a named buyer.'],
  ['cost-demo', 'The cost demo', 'A visitor types a prompt into the homepage demo. The demo does not store it and does not call a provider. This is how the page works, not a case study of savings.'],
  ['owner-email', 'A note to the owner', 'A buyer writes vladoi_ionut@yahoo.com. The note reaches Vladoi Ionut. This is the contact path, not a testimonial.'],
  ['no-repo', 'No repository', 'Someone asks for a code review of a private repo. The honest reply is that the site does not accept the repo. This is an illustration of a refusal, not a customer.'],
];

add({
  path: '/case-studies',
  title: 'Illustrations, not case studies',
  description: 'Ten illustrations of how the shelf works. None of them is a ZeusAI customer.',
  h1: 'Illustrations, not case studies',
  kicker: 'Honesty',
  crumbs: [{ href: '/learn', label: 'Engineering guides' }],
  links: ILLUSTRATIONS.slice(0, 6).map((row) => ({ href: '/case-studies/' + row[0], label: row[1] })),
  faq: faq([{ q: 'Are these customers?', a: 'No. Each illustration is labeled. ZeusAI does not publish a customer.' }]),
  sections: [
    { h2: 'Why this page is not a case-study library', paragraphs: ['A case study needs a named organization, a permission, and a result you can check. None of those exist here. The ten pages below are illustrations of the offer, the price, and the refusal to take a repository.'] },
    { h2: 'The ten illustrations', items: ILLUSTRATIONS.map((row) => row[1]) },
  ],
});

ILLUSTRATIONS.forEach((row) => {
  add({
    path: '/case-studies/' + row[0],
    title: row[1] + ' (illustration)',
    description: row[2],
    h1: row[1],
    kicker: 'Illustration, not a customer',
    crumbs: [{ href: '/case-studies', label: 'Illustrations' }],
    links: [{ href: '/case-studies', label: 'All illustrations' }, { href: '/services', label: 'Marketplace' }],
    faq: faq([{ q: 'Is this a real customer?', a: 'No. ' + row[2] }]),
    sections: [
      { h2: 'Label', paragraphs: [row[2], 'Do not cite this page as social proof.'] },
      { h2: 'What you can verify', paragraphs: ['You can open the marketplace and read the same file name and list price. You cannot find this illustration in an order ledger, because it was not an order.'] },
    ],
  });
});

add({
  path: '/testimonials',
  title: 'Testimonials',
  description: 'ZeusAI publishes no testimonial. A review rich snippet would require a real person and a real statement.',
  h1: 'No testimonial is published',
  kicker: 'Honesty',
  crumbs: [{ href: '/about', label: 'About' }],
  links: [{ href: '/about', label: 'About the owner' }, { href: '/origin', label: 'Published buyer count' }],
  faq: faq([
    { q: 'Where is the review snippet?', a: 'There is none. This page does not emit a Review or AggregateRating.' },
  ]),
  sections: [
    { h2: 'What would be required', paragraphs: ['A testimonial needs a person who paid, a sentence they agree to publish, and a result that matches the order. ZeusAI does not invent any of the three.'] },
    { h2: 'What is public instead', paragraphs: ['The owner is Vladoi Ionut. The email is vladoi_ionut@yahoo.com. The buyer count is not invented on the marketing pages. The marketplace names the file.'] },
  ],
});

add({
  path: '/learn',
  title: 'Engineering guides',
  description: 'Guides to AI code review, coding assistants, and repository tools, written so they do not pretend ZeusAI is those products.',
  h1: 'Engineering guides for a storefront that does not review your code',
  kicker: 'Index',
  crumbs: [],
  links: [
    { href: '/blog/what-is-ai-code-review', label: 'What AI code review is' },
    { href: '/use-cases', label: 'Use cases' },
    { href: '/cursor-vs-zeus-ai', label: 'Cursor and ZeusAI' },
    { href: '/react-ai-code-review', label: 'React and AI code review' },
    { href: '/docs/getting-started', label: 'Getting started' },
    { href: '/what-is-zeus-ai', label: 'What ZeusAI is' },
    { href: '/tools', label: 'Worksheets' },
    { href: '/benchmarks', label: 'Benchmarks' },
  ],
  faq: faq([]),
  sections: [
    {
      h2: 'AI software engineer, coding assistant, and code review',
      paragraphs: ['Those phrases name editors, agents, and review bots. They are real product categories. ZeusAI is not in them.'],
      h3: [
        { h: 'AI software engineer', paragraphs: ['An agent that takes a task and edits a repo. This site does not.'] },
        { h: 'AI coding assistant', paragraphs: ['Completion inside an editor. This site does not ship an editor.'] },
        { h: 'AI code review', paragraphs: ['Comments on a diff. This site does not read a diff.'] },
      ],
    },
    {
      h2: 'Codebase analysis, repository intelligence, and architecture',
      paragraphs: ['Analysis needs the tree. Intelligence needs the history. Architecture review needs the diagram and the owners. None of those inputs are accepted here.'],
      h3: [
        { h: 'Codebase analysis', paragraphs: ['See the guide. It explains the practice and the missing checkout.'] },
        { h: 'Repository intelligence', paragraphs: ['Search and ownership live on a code host. They do not live on this domain.'] },
        { h: 'Software architecture analysis', paragraphs: ['A review is a meeting. This site can sell a kickoff file. It cannot attend the meeting.'] },
      ],
    },
    {
      h2: 'Developer tools and the engineering workspace',
      paragraphs: ['The comparisons name Cursor, Copilot, Devin, Cody, Replit, Bolt, Lovable, Claude Code, and Codex. Each one works on code. ZeusAI sells files and shows a cost demo.'],
      h3: [
        { h: 'AI developer tools', paragraphs: ['Use the tool map before you buy a seat. The map is not a ranking.'] },
        { h: 'Engineering workspace', paragraphs: ['Your workspace is your editor and your forge. This website is neither.'] },
      ],
    },
    {
      h2: 'What to do on ZeusAI',
      paragraphs: ['Read a guide, open the marketplace, or write to the owner. Pay Bitcoin if you want the price under the list. Do not send a repository.'],
      h3: [
        { h: 'Marketplace', paragraphs: ['The card names the file and the list price.'] },
        { h: 'Pricing', paragraphs: ['The same offers, three clocks.'] },
      ],
    },
  ],
});

function has(route) {
  return pages.has(String(route || ''));
}

function meta(route) {
  return pages.get(String(route || '')) || null;
}

function render(route) {
  const page = meta(route);
  return page ? layout(page) : '';
}

function paths() {
  return Array.from(pages.keys()).sort();
}

function urlsetXml(origin) {
  const base = String(origin || 'https://zeusai.pro').replace(/\/+$/, '');
  const rows = paths().map((path) => {
    return '  <url><loc>' + base + path + '</loc><changefreq>monthly</changefreq><priority>0.4</priority></url>';
  });
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + rows.join('\n') + '\n</urlset>\n';
}

function blogCards() {
  return ARTICLES.map((row) => {
    const pick = offerIdFor('/blog/' + row[0]);
    const name = OFFER_TITLES[pick.id] || 'a shelf file';
    return {
      href: '/blog/' + row[0],
      tag: 'Guide',
      title: row[1],
      sub: 'The file on this page is ' + name + '. ZeusAI does not run this practice on your repository.',
    };
  });
}

const OFFER_TITLES = {
  'instant-website-audit': 'Instant Website Audit (AI)',
  'instant-resume-makeover': 'Instant Resume + LinkedIn Makeover',
  'professional-saas-mvp': 'SaaS MVP Kickoff File',
  'ent-engagement-kickoff': 'Enterprise Engagement Kickoff',
};

const OFFER_WHY = {
  'instant-website-audit': 'The file is a Markdown audit of a URL you send. It does not open a repository and it does not fill in a score unless a provider key is armed.',
  'instant-resume-makeover': 'The file is a resume and a LinkedIn headline written from text you supply. It does not invent an employer.',
  'professional-saas-mvp': 'The file is a kickoff: scope, an architecture sketch, and milestones. The finished product is not in the file.',
  'ent-engagement-kickoff': 'The file is a discovery brief, a proposal, and a draft statement of work. It does not include a license, a private cloud, or a code review.',
};

const RESUME_PATHS = new Set([
  '/use-cases/freelancers',
  '/case-studies/resume-file',
  '/best-ai-tool-for/freelancers',
  '/best-ai-tool-for/indie',
]);

const SAAS_PATHS = new Set([
  '/use-cases/startups',
  '/use-cases/saas',
  '/blog/ai-for-startups',
  '/best-ai-tool-for/startups',
  '/best-ai-tool-for/saas',
  '/best-ai-tool-for/greenfield',
]);

const KICKOFF_PATHS = new Set([
  '/use-cases/enterprise',
  '/use-cases/agencies',
  '/use-cases/engineering-managers',
  '/use-cases/tech-leads',
  '/blog/ai-for-software-agencies',
  '/blog/ai-for-enterprise-development',
  '/blog/ai-architecture-review',
  '/blog/complete-guide-to-ai-software-engineering',
  '/case-studies/kickoff-file',
  '/case-studies/proposal',
  '/best-ai-tool-for/enterprise',
  '/best-ai-tool-for/agencies',
  '/best-ai-tool-for/managers',
  '/best-ai-tool-for/tech-leads',
  '/best-ai-tool-for/platform',
]);

function offerIdFor(route) {
  const path = String(route || '');
  if (RESUME_PATHS.has(path)) return { id: 'instant-resume-makeover', also: 'instant-website-audit' };
  if (SAAS_PATHS.has(path)) return { id: 'professional-saas-mvp', also: 'instant-website-audit' };
  if (KICKOFF_PATHS.has(path)) return { id: 'ent-engagement-kickoff', also: 'instant-website-audit' };
  return { id: 'instant-website-audit', also: 'ent-engagement-kickoff' };
}

function usdText(n) {
  const price = Number(n) || 0;
  const frac = Number.isFinite(price) && Math.abs(price - Math.round(price)) > 0.0049;
  return '$' + price.toLocaleString('en-US', { minimumFractionDigits: frac ? 2 : 0, maximumFractionDigits: 2 });
}

function btcPayUsd(listUsd) {
  const cents = Math.round(Number(listUsd) * 100);
  if (!Number.isFinite(cents) || cents <= 0) return 0;
  return Math.round(cents * 90 / 100) / 100;
}

const shelfMemo = new Map();

function shelfOffer(id) {
  if (shelfMemo.has(id)) return shelfMemo.get(id);
  let item = null;
  try { item = require('../../commerce/public-shelf').byId(id); } catch (_) { item = null; }
  shelfMemo.set(id, item || null);
  return item || null;
}

function receiptHtml(listUsd) {
  const list = Number(listUsd) || 0;
  if (!(list > 0)) return '';
  return '<dl class="pay-receipt"><div><dt>List</dt><dd>' + usdText(list) + '</dd></div>'
    + '<div><dt>Bitcoin</dt><dd>' + usdText(btcPayUsd(list)) + '</dd></div>'
    + '<div><dt>Delivery</dt><dd>$0</dd></div></dl>'
    + '<p class="pay-receipt-note">Bitcoin is 10% under the list price. Card and PayPal pay the list price when they are configured. You keep the file.</p>';
}

function offerCard(id) {
  const item = shelfOffer(id);
  const title = (item && item.title) || OFFER_TITLES[id] || id;
  const href = '/services/' + encodeURIComponent(id);
  const why = OFFER_WHY[id] || 'This is a named file on the shelf.';
  const price = item ? Number(item.priceUsd) : 0;
  const priceHtml = price > 0
    ? receiptHtml(price)
    : '<p>The live price is on the file page. This guide does not invent one.</p>';
  return '<article class="guide-offer" data-offer-id="' + esc(id) + '">'
    + '<h3><a href="' + esc(href) + '" data-link>' + esc(title) + '</a></h3>'
    + '<p>' + esc(why) + '</p>'
    + priceHtml
    + '<p><a class="btn btn-primary" href="' + esc(href) + '" data-link>Open this file</a></p>'
    + '</article>';
}

function offerBlock(route) {
  const pick = offerIdFor(route);
  const also = shelfOffer(pick.also);
  const alsoTitle = (also && also.title) || OFFER_TITLES[pick.also] || pick.also;
  const alsoHref = '/services/' + encodeURIComponent(pick.also);
  return '<div id="guideOffer">'
    + offerCard(pick.id)
    + '<p>The other door is <a href="' + esc(alsoHref) + '" data-link>' + esc(alsoTitle) + '</a>.</p>'
    + '</div>';
}

function homeGuideLine() {
  return '<p class="cost-trust-note" id="homeGuideLine">The guides at <a href="/learn" data-link>/learn</a> explain code review and coding assistants. ZeusAI does not do that work. Facts an answer engine can cite are at <a href="/what-is-zeus-ai" data-link>/what-is-zeus-ai</a>. The three files you can buy are under this demo.</p>';
}

function homeDoorsHtml() {
  const ids = ['instant-website-audit', 'instant-resume-makeover', 'ent-engagement-kickoff'];
  return '<section id="homeDoors" aria-label="Files you can buy">'
    + '<div class="section-title"><div><h2>Three files you can buy</h2></div></div>'
    + '<p class="cost-trust-note">Each card is a file. The list price is the price on the shelf. A guide is not a code review.</p>'
    + '<div class="home-doors">' + ids.map(offerCard).join('') + '</div>'
    + '</section>';
}

function docLinks() {
  return DOCS.map((row) => ({ href: '/docs/' + row[0], label: row[1] }));
}

module.exports = {
  DISCLAIMER,
  has,
  meta,
  render,
  paths,
  urlsetXml,
  blogCards,
  docLinks,
  offerIdFor,
  btcPayUsd,
  homeGuideLine,
  homeDoorsHtml,
};
