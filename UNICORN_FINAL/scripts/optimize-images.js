// One-shot image optimizer for ZeusAI site assets.
// Reads source JPGs from src/site/v2/assets/ and emits responsive WebP + AVIF
// variants alongside them. Run manually with `node scripts/optimize-images.js`
// when source images change. Output files are committed to the repo so the
// production runtime has zero new dependencies.
'use strict';

const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const SRC_DIR = path.join(__dirname, '..', 'src', 'site', 'v2', 'assets');

// [base, srcFile, widths, jpgQuality, webpQuality, avifQuality]
const TARGETS = [
  { base: 'hero',  src: 'hero.jpg',  widths: [640, 1024, 1600], jpgQ: 78, webpQ: 72, avifQ: 50 },
  { base: 'brand', src: 'brand.jpg', widths: [88, 176, 264],    jpgQ: 80, webpQ: 75, avifQ: 55 },
  { base: 'watch', src: 'watch.jpg', widths: [640, 1024],       jpgQ: 78, webpQ: 72, avifQ: 50 }
];

async function run() {
  for (const t of TARGETS) {
    const inFile = path.join(SRC_DIR, t.src);
    if (!fs.existsSync(inFile)) {
      console.warn('skip (missing):', inFile);
      continue;
    }
    const meta = await sharp(inFile).metadata();
    console.log(`\n[${t.base}] source ${meta.width}x${meta.height} (${(fs.statSync(inFile).size/1024).toFixed(1)} KiB)`);
    for (const w of t.widths) {
      if (w > meta.width) {
        console.log(`  skip width ${w} > source ${meta.width}`);
        continue;
      }
      const stem = `${t.base}-${w}`;
      const pipeline = () => sharp(inFile).resize({ width: w, withoutEnlargement: true });
      const webpOut = path.join(SRC_DIR, `${stem}.webp`);
      const avifOut = path.join(SRC_DIR, `${stem}.avif`);
      const jpgOut  = path.join(SRC_DIR, `${stem}.jpg`);
      await pipeline().webp({ quality: t.webpQ, effort: 6 }).toFile(webpOut);
      await pipeline().avif({ quality: t.avifQ, effort: 4 }).toFile(avifOut);
      await pipeline().jpeg({ quality: t.jpgQ, mozjpeg: true, progressive: true }).toFile(jpgOut);
      const sz = (p) => (fs.statSync(p).size / 1024).toFixed(1) + ' KiB';
      console.log(`  ${w}w  jpg=${sz(jpgOut)}  webp=${sz(webpOut)}  avif=${sz(avifOut)}`);
    }
    // Also emit a re-encoded baseline JPG at the original size (smaller than the
    // current Photoshop output because of mozjpeg + progressive encoding).
    const jpgBase = path.join(SRC_DIR, `${t.base}.jpg`);
    const tmp = jpgBase + '.tmp';
    await sharp(inFile).jpeg({ quality: t.jpgQ, mozjpeg: true, progressive: true }).toFile(tmp);
    const before = fs.statSync(jpgBase).size;
    const after = fs.statSync(tmp).size;
    if (after < before) {
      fs.renameSync(tmp, jpgBase);
      console.log(`  (${t.base}.jpg re-encoded: ${(before/1024).toFixed(1)} -> ${(after/1024).toFixed(1)} KiB)`);
    } else {
      fs.unlinkSync(tmp);
      console.log(`  (${t.base}.jpg already smaller, kept original)`);
    }
  }
  console.log('\nDone.');
}

run().catch((e) => { console.error(e); process.exit(1); });
