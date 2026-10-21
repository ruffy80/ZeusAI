'use strict';

/**
 * Request edge for runtimes this host does not execute.
 *
 * zeusai.pro is Node behind nginx. A path that only PHP, ASP, or JSP could
 * run is refused before the HTML renderer. The query string and the path are
 * not stored. Counts are process-local and reset on restart.
 */

const SENSITIVE = /(?:^|\/)\.(?:env|git|aws|ssh|svn|hg)(?:$|\/|\.)|(?:^|\/)(?:wp-config\.php|composer\.(?:json|lock)|package-lock\.json)(?:$|\/)/i;
const DEAD_RUNTIME = /(?:^|\/)[^/]*\.(php[3-8]?|phtml|phar|pht|asp|aspx|asmx|ashx|jsp|jspx|cgi)(?:\.[a-z0-9]+)?(?:$|\/)/i;

const counts = { sensitive: 0, php: 0, asp: 0, jsp: 0, cgi: 0 };

function decodePath(input) {
  let requestPath = String(input || '/').split('#')[0].split('?')[0];
  for (let pass = 0; pass < 2; pass += 1) {
    try {
      const decoded = decodeURIComponent(requestPath);
      if (decoded === requestPath) break;
      requestPath = decoded;
    } catch (_) {
      break;
    }
  }
  requestPath = requestPath.replace(/\\/g, '/');
  const nul = requestPath.indexOf('\0');
  if (nul >= 0) requestPath = requestPath.slice(0, nul);
  return requestPath;
}

function family(ext) {
  const name = String(ext || '').toLowerCase();
  if (name.startsWith('php') || name === 'phtml' || name === 'phar' || name === 'pht') return 'php';
  if (name.startsWith('jsp')) return 'jsp';
  if (name === 'cgi') return 'cgi';
  return 'asp';
}

function classify(input) {
  const path = decodePath(input);
  if (SENSITIVE.test(path)) return 'sensitive';
  const match = path.match(DEAD_RUNTIME);
  if (!match) return null;
  return family(match[1]);
}

function refused(input) {
  const kind = classify(input);
  if (!kind) return null;
  if (counts[kind] < 1000000) counts[kind] += 1;
  return kind;
}

function snapshot() {
  return {
    sensitive: counts.sensitive,
    php: counts.php,
    asp: counts.asp,
    jsp: counts.jsp,
    cgi: counts.cgi,
    storesPaths: false,
    storesQuery: false,
  };
}

function resetForTests() {
  counts.sensitive = 0;
  counts.php = 0;
  counts.asp = 0;
  counts.jsp = 0;
  counts.cgi = 0;
}

module.exports = {
  decodePath,
  classify,
  refused,
  snapshot,
  resetForTests,
};
