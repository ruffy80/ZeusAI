#!/usr/bin/env node
'use strict';

/**
 * Compat Truth Instant Autofix (CTOS/1.1)
 * ---------------------------------------
 * Instantly repairs SITE_CTA_REGRESSION: raw /api or /.well-known JSON
 * anchors styled as buttons → Live Inspect buttons (data-live-inspect).
 *
 * Usage:
 *   node scripts/compat-truth-autofix.js           # write fixes
 *   node scripts/compat-truth-autofix.js --check   # exit 1 if fixes needed
 *   node scripts/compat-truth-autofix.js --dry-run # print only
 *
 * Wired into: husky/lint-staged, CTOS preflight, GitHub autofix workflow.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCAN_DIRS = [
  path.join(ROOT, 'src'),
  path.join(ROOT, 'backend', 'modules'),
];

const DRY = process.argv.includes('--dry-run');
const CHECK = process.argv.includes('--check');

const ALLOW_FILE_RE = /\.(test|spec)\.js$/i;
const SKIP_SNIPS = ['node_modules', '/data/', 'live-inspect-bootstrap.js'];

// Same surfaces as no-raw-json-cta-guard.
const HREF_RE = /href="(\/api\/[^"]+|\/\.well-known\/[^"]+|\/integrity\.json|\/openapi[^"]*)"/i;
const CTA_CLASS_RE = /\b(?:btn|cta|ds-cta)\b/i;
const FONT_WEIGHT_RE = /font-weight:\s*70[0-9]/i;

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === 'data' || ent.name === '.git') continue;
      walk(p, out);
    } else if (/\.(js|html|mjs|cjs)$/i.test(ent.name)) {
      out.push(p);
    }
  }
}

function isSkipped(file) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  if (ALLOW_FILE_RE.test(rel)) return true;
  return SKIP_SNIPS.some((s) => rel.includes(s));
}

function extractAttr(tag, name) {
  const re = new RegExp('\\b' + name + '\\s*=\\s*"([^"]*)"', 'i');
  const m = tag.match(re);
  return m ? m[1] : null;
}

function extractInnerText(tag) {
  const m = tag.match(/>([^<]*)</);
  return m ? m[1].trim() : 'Inspect live';
}

function shouldRewrite(tag) {
  if (!HREF_RE.test(tag)) return false;
  if (/\bdownload\b/i.test(tag)) return false;
  if (/data-allow-raw\s*=\s*["']1["']/.test(tag)) return false;
  if (/data-live-inspect\s*=/.test(tag)) return false;
  const cls = extractAttr(tag, 'class') || '';
  const style = extractAttr(tag, 'style') || '';
  const blank = /\btarget\s*=\s*["']_blank["']/i.test(tag);
  return CTA_CLASS_RE.test(cls) || FONT_WEIGHT_RE.test(style) || blank;
}

function sanitizeLabel(raw) {
  let label = String(raw || '').trim();
  // Forbidden UX phrases from no-raw-json-cta-guard — never keep them on CTAs.
  if (/Open JSON|Open in API Explorer|Open continuum JSON|Inspect raw JSON/i.test(label)
    || /^JSON\s*→?\s*$/i.test(label)) {
    label = 'Inspect live';
  }
  return label || 'Inspect live';
}

function rewriteTag(tag) {
  const hrefM = tag.match(HREF_RE);
  if (!hrefM) return tag;
  const href = hrefM[1];
  const cls = extractAttr(tag, 'class') || 'btn btn-ghost';
  const style = extractAttr(tag, 'style');
  const label = sanitizeLabel(extractInnerText(tag));
  const title = label.replace(/\s*→\s*$/, '').trim() || 'Inspect live';
  let out = '<button type="button" class="' + cls + '" data-live-inspect="' + href
    + '" data-live-title="' + title.replace(/"/g, '&quot;') + '"';
  if (style) out += ' style="' + style + '"';
  out += '>' + label + '</button>';
  return out;
}

function fixSource(src) {
  let changed = 0;
  // Match opening <a ...> ... </a> that may be CTA-ish. Keep it single-line friendly
  // (site templates almost always emit one-line anchors).
  const next = src.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, (full) => {
    const openEnd = full.indexOf('>');
    if (openEnd < 0) return full;
    const open = full.slice(0, openEnd + 1);
    if (!shouldRewrite(open) && !shouldRewrite(full)) return full;
    // Only rewrite when the opening tag itself is the CTA signal (class/style/blank)
    // or the full tag matches — avoid rewriting plain text links without btn class
    // unless target=_blank to JSON surfaces.
    if (!shouldRewrite(open) && !shouldRewrite(full.slice(0, Math.min(full.length, 400)))) {
      return full;
    }
    // Rebuild from open tag + inner text
    const synthetic = open.slice(0, -1) + '>' + extractInnerText(full) + '</a>';
    if (!shouldRewrite(synthetic) && !shouldRewrite(open)) return full;
    changed += 1;
    return rewriteTag(open.slice(0, -1) + '>' + extractInnerText(full) + '</a>');
  });
  return { next, changed };
}

function main() {
  const files = [];
  for (const d of SCAN_DIRS) walk(d, files);
  const edits = [];
  for (const f of files) {
    if (isSkipped(f)) continue;
    const src = fs.readFileSync(f, 'utf8');
    const { next, changed } = fixSource(src);
    if (!changed) continue;
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    edits.push({ file: rel, changed, abs: f, next });
    if (!DRY && !CHECK) {
      fs.writeFileSync(f, next, 'utf8');
    }
  }

  if (!edits.length) {
    console.log('[compat-truth-autofix] ✅ no SITE_CTA repairs needed');
    process.exit(0);
  }

  console.log('[compat-truth-autofix] ' + (DRY || CHECK ? 'would repair' : 'repaired')
    + ' ' + edits.length + ' file(s):');
  for (const e of edits) {
    console.log('  · ' + e.file + ' (' + e.changed + ' CTA' + (e.changed === 1 ? '' : 's') + ')');
  }

  if (CHECK) {
    console.error('[compat-truth-autofix] SITE_CTA_REGRESSION present — run: npm run compat-truth:fix');
    process.exit(1);
  }
  if (DRY) process.exit(0);
  console.log('[compat-truth-autofix] ✅ instant repair applied — commit these files');
  process.exit(0);
}

if (require.main === module) {
  main();
} else {
  module.exports = {
    fixSource,
    shouldRewrite,
    rewriteTag,
    HREF_RE,
    CTA_CLASS_RE,
  };
}
