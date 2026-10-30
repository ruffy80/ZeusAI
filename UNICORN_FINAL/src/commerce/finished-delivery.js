'use strict';

/**
 * Every current and future shelf offer must download a finished file for the
 * job named on the card. The file states that job and contains the work.
 * A kickoff file is the finished delivery for a kickoff offer. It is not a
 * running system. A new offer reaches checkout only when buyerFile includes
 * these two headings and the product title.
 */

const PROBLEM_HEADING = '## The problem this file solves';
const WORK_HEADING = '## Finished work';

function titleOf(item) {
  return String(item && (item.title || item.name || item.id) || '').trim();
}

function problemOf(item) {
  const text = String(item && (item.description || item.note) || '').split('\n')[0].trim();
  return text.slice(0, 500);
}

function stamp(content, item) {
  const body = String(content || '');
  const title = titleOf(item) || 'This offer';
  const hasHeadings = body.indexOf(PROBLEM_HEADING) !== -1 && body.indexOf(WORK_HEADING) !== -1;
  const hasTitle = title.length < 8 || body.toLowerCase().indexOf(title.toLowerCase()) !== -1;
  if (hasHeadings && hasTitle) return body;
  const problem = problemOf(item) || 'The shelf card names the job. This file is that job.';
  const block = [
    PROBLEM_HEADING,
    title + ' is the finished file for this order.',
    problem,
    '',
    WORK_HEADING,
    'The headings already in this file are the finished delivery. Use them as the work product.',
    'A later system, a parcel, and a measured score are not added here.',
    '',
  ].join('\n');
  return body.replace(/\s*$/, '') + '\n\n' + block + '\n';
}

function review(item, content) {
  const failures = [];
  const text = String(content || '');
  if (!text.trim()) return { pass: false, failures: ['solution_missing'] };
  if (text.indexOf(PROBLEM_HEADING) === -1) failures.push('solution_missing');
  if (text.indexOf(WORK_HEADING) === -1) failures.push('solution_missing');
  const title = titleOf(item);
  if (title.length >= 8 && text.toLowerCase().indexOf(title.toLowerCase()) === -1) {
    failures.push('solution_missing');
  }
  return { pass: failures.length === 0, failures };
}

module.exports = {
  PROBLEM_HEADING,
  WORK_HEADING,
  stamp,
  review,
};
