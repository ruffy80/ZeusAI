/**
 * Homepage hero vision panel — "Building the AI feature" (right column).
 */
'use strict';

process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const shell = fs.readFileSync(path.join(__dirname, '..', 'src', 'site', 'v2', 'shell.js'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, '..', 'src', 'site', 'v2', 'styles.js'), 'utf8');

assert.ok(shell.includes('class="hero-side hero-vision"'), 'hero-vision aside');
assert.ok(shell.includes('Building the AI feature'), 'vision title copy');
assert.ok(shell.includes('We build the future.'), 'EN future signal');
assert.ok(!shell.includes('Construim viitorul'), 'RO copy must stay off the vision panel');
assert.ok(shell.includes('fonts.googleapis.com/css2?family=Syne'), 'non-blocking Syne/Orbitron load');
assert.ok(styles.includes('.hero-vision-title'), 'vision title CSS');
assert.ok(styles.includes('heroVisionShimmer'), 'shimmer keyframes');
assert.ok(styles.includes('font-family:Syne'), 'Syne in styles');
assert.ok(styles.includes('font-family:Orbitron'), 'Orbitron in styles');

// Brand remains the primary hero signal; vision follows it in markup.
const brandIdx = shell.indexOf('class="hero-brand"');
const visionIdx = shell.indexOf('Building the AI feature');
assert.ok(brandIdx > 0 && visionIdx > brandIdx, 'vision follows ZeusAI brand in hero');

console.log('homepage-hero-vision.test.js: all assertions passed');
