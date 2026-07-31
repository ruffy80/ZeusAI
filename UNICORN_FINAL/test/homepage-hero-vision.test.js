/**
 * Homepage hero — "Building the future" letterpress line above ZeusAI brand.
 */
'use strict';

process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const shell = fs.readFileSync(path.join(__dirname, '..', 'src', 'site', 'v2', 'shell.js'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, '..', 'src', 'site', 'v2', 'styles.js'), 'utf8');

assert.ok(!shell.includes('class="hero-side hero-vision"'), 'old right-side vision panel must be removed');
assert.ok(!shell.includes('Building the AI feature'), 'old "Building the AI feature" copy must be gone');
assert.ok(!shell.includes('Construim viitorul'), 'Romanian copy must stay off the hero');
assert.ok(shell.includes('class="hero-future"'), 'hero-future wrapper');
assert.ok(shell.includes('hero-future-plate'), 'letterpress plate frame');
assert.ok(shell.includes('Building the future'), 'exact English future line');

const futureIdx = shell.indexOf('Building the future');
const brandIdx = shell.indexOf('class="hero-brand"');
assert.ok(futureIdx > 0 && brandIdx > futureIdx, 'Building the future must sit above ZeusAI brand');

assert.ok(styles.includes('.hero-future-type'), 'letterpress type CSS');
assert.ok(styles.includes('font-family:Orbitron'), 'Orbitron letterpress font');
assert.ok(styles.includes('text-transform:uppercase'), 'print-type uppercase');
assert.ok(styles.includes('heroFutureShimmer'), 'vibrant shimmer motion');

console.log('homepage-hero-vision.test.js: all assertions passed');
