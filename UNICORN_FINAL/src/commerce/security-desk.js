'use strict';

/**
 * Security desk — the paid file for the NOHDE-shaped jobs.
 * Each file is the work. It does not install an agent, certify a framework,
 * scan a network, or staff a desk. A test brief does not include an exploit step.
 */

const FRAMEWORKS = ['NIS2', 'DORA', 'HIPAA', 'CMMC', 'PCI DSS'];

function field(lines, key) {
  const prefix = String(key).toLowerCase() + ':';
  const hit = (lines || []).find((line) => String(line).toLowerCase().startsWith(prefix));
  return hit ? String(hit).slice(prefix.length).trim() : '';
}

function parts(value) {
  return String(value || '')
    .split(/[;|]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 40);
}

function namedFrameworks(value) {
  const text = String(value || '').toUpperCase();
  if (!text) return FRAMEWORKS.slice();
  const picked = FRAMEWORKS.filter((name) => text.includes(name.toUpperCase()) || (name === 'PCI DSS' && text.includes('PCI')));
  return picked.length ? picked : FRAMEWORKS.slice();
}

function endpointLedger(lines) {
  const org = field(lines, 'orgName') || 'not named';
  const assets = parts(field(lines, 'assets'));
  const rows = assets.length
    ? assets.map((asset) => '| ' + asset + ' | not recorded in this order | not named |')
    : ['| No asset was named. No machine was invented. | | |'];
  return [
    '## Endpoint ledger',
    'Organization: ' + org + '.',
    'This count is the list below. It is not a scan.',
    '',
    '| Asset | Patch column | Owner |',
    '| --- | --- | --- |',
    rows.join('\n'),
    '',
    'Named assets: ' + String(assets.length) + '.',
    'It does not install an agent and it does not count machines that were not listed.',
  ].join('\n');
}

const CONTROLS = {
  NIS2: ['risk analysis', 'incident handling', 'supply chain', 'access control'],
  DORA: ['ICT risk', 'incident reporting', 'resilience testing', 'third-party ICT'],
  HIPAA: ['access control', 'audit controls', 'integrity', 'transmission security'],
  CMMC: ['access control', 'identification', 'media protection', 'system integrity'],
  'PCI DSS': ['network security', 'cardholder data', 'access control', 'monitoring'],
};

function controlEvidence(lines) {
  const org = field(lines, 'orgName') || 'not named';
  const frameworks = namedFrameworks(field(lines, 'frameworks'));
  const blocks = frameworks.map((name) => {
    const rows = (CONTROLS[name] || []).map((control) => (
      '| ' + control + ' | attach the export for this control | open |'
    ));
    return [
      '### ' + name,
      '| Control | Evidence to attach | Status in this file |',
      '| --- | --- | --- |',
      rows.join('\n'),
      'This file does not certify ' + name + ' and it does not claim an audit passed.',
    ].join('\n');
  });
  return [
    '## Control evidence',
    'Organization: ' + org + '.',
    '## Scope',
    field(lines, 'scopeNote') || 'No scope note was on the order. No system was added.',
    '',
    blocks.join('\n\n'),
  ].join('\n');
}

function networkPartition(lines) {
  const sites = field(lines, 'sites') || 'not named';
  const systems = parts(field(lines, 'systems'));
  const named = systems.length
    ? systems.map((system) => '- ' + system + ' — named by the buyer, placed in Applications.').join('\n')
    : '- No system was named. No network was invented.';
  return [
    '## Network partition',
    'Sites: ' + sites + '.',
    '## Zones',
    '- Users',
    '- Applications',
    '- Management',
    named,
    '',
    '## Who may talk',
    '- Users may reach Applications.',
    '- Management may reach Applications.',
    '- Users may not reach Management.',
    'It does not push a device config and it does not touch the network.',
  ].join('\n');
}

function securityTestBrief(lines) {
  const targets = parts(field(lines, 'targets'));
  const list = targets.length
    ? targets.map((target) => '- ' + target).join('\n')
    : '- No target was named. No system was scanned.';
  return [
    '## Security test brief',
    '## Scope',
    'In scope:',
    list,
    'Out of scope: every name that is not in the list above.',
    '',
    '## Rules',
    'The buyer authorizes any test outside this file.',
    'This download does not scan a network.',
    'This download does not include an exploit step.',
    '',
    '## Report headings',
    '1. Finding name.',
    '2. Affected name from the scope list.',
    '3. Evidence the buyer attaches.',
    '4. Retest note.',
    '',
    '## Window',
    field(lines, 'window') || 'No window was named.',
    field(lines, 'constraints') ? ('Constraints: ' + field(lines, 'constraints')) : 'No constraint was named.',
  ].join('\n');
}

function operationsWatch(lines) {
  const contacts = field(lines, 'contacts') || 'No contact was named. Nobody was messaged.';
  return [
    '## Operations watch',
    '## What to record',
    'Time, system name, what changed, and who saw it.',
    '## Clock',
    field(lines, 'hours') || 'No hours were named.',
    '## First hour',
    '1. Write the time.',
    '2. Name the system from the brief.',
    '3. Name the person on the contacts line.',
    '4. Keep the note in this clock.',
    '## Contacts',
    contacts,
    'It does not monitor a network and it does not staff a desk.',
  ].join('\n');
}

function incidentClock(lines) {
  return [
    '## Incident clock',
    '## Timeline',
    field(lines, 'whatHappened') || 'No incident text was on the order. No breach was invented.',
    '## Who was told',
    field(lines, 'contacts') || 'No one was named. No one was contacted.',
    '## Evidence kept',
    'The text above is the evidence in this file. A live system was not opened.',
    'It does not claim a breach response.',
  ].join('\n');
}

const WRITERS = {
  'instant-endpoint-ledger': endpointLedger,
  'instant-control-evidence': controlEvidence,
  'instant-network-partition': networkPartition,
  'instant-security-test-brief': securityTestBrief,
  'instant-operations-watch': operationsWatch,
  'instant-incident-clock': incidentClock,
};

function deliver(serviceId, lines) {
  const id = String(serviceId || '');
  if (id === 'instant-security-program') {
    const org = field(lines, 'orgName') || 'not named';
    const estate = field(lines, 'estate');
    const shared = lines.slice();
    if (estate && !field(lines, 'assets')) shared.push('assets: ' + estate);
    if (estate && !field(lines, 'systems')) shared.push('systems: ' + estate);
    if (estate && !field(lines, 'targets')) shared.push('targets: ' + estate);
    if (estate && !field(lines, 'whatHappened')) shared.push('whatHappened: ' + estate);
    return [
      '## Security program',
      'Organization: ' + org + '.',
      'This one file is the endpoint ledger, the control evidence, the network partition, the security test brief, the operations watch, and the incident clock.',
      'The six files are also sold alone.',
      '',
      endpointLedger(shared),
      '',
      controlEvidence(shared),
      '',
      networkPartition(shared),
      '',
      securityTestBrief(shared),
      '',
      operationsWatch(shared),
      '',
      incidentClock(shared),
    ].join('\n');
  }
  const write = WRITERS[id];
  if (!write) return '';
  return write(lines || []);
}

module.exports = {
  FRAMEWORKS,
  deliver,
};
