// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
// linux-mem.js — Accurate Linux MemAvailable helper (prevents false RAM
// emergencies caused by Linux kernel page cache shrinking os.freemem()).
// Falls back cleanly to os.freemem() on macOS / non-Linux hosts.

'use strict';

const fs = require('fs');
const os = require('os');

function getSystemMemoryInfo() {
  const totalBytes = os.totalmem();
  let availableBytes = os.freemem();
  let source = 'os.freemem';

  if (process.platform === 'linux') {
    try {
      const raw = fs.readFileSync('/proc/meminfo', 'utf8');
      const availMatch = raw.match(/^MemAvailable:\s+(\d+)\s+kB/m);
      if (availMatch) {
        availableBytes = Number(availMatch[1]) * 1024;
        source = 'proc.MemAvailable';
      } else {
        const freeM = raw.match(/^MemFree:\s+(\d+)\s+kB/m);
        const bufM = raw.match(/^Buffers:\s+(\d+)\s+kB/m);
        const cacheM = raw.match(/^Cached:\s+(\d+)\s+kB/m);
        if (freeM && cacheM) {
          availableBytes = (Number(freeM[1]) + Number(bufM ? bufM[1] : 0) + Number(cacheM[1])) * 1024;
          source = 'proc.FreePlusCache';
        }
      }
    } catch (_) {
      // fall back to os.freemem()
    }
  }

  availableBytes = Math.max(0, Math.min(totalBytes, availableBytes));
  const usedBytes = Math.max(0, totalBytes - availableBytes);
  const usedRatio = totalBytes > 0 ? usedBytes / totalBytes : 0;
  const freePct = totalBytes > 0 ? Math.round((availableBytes / totalBytes) * 100) : 100;
  const usedPct = totalBytes > 0 ? Math.round(usedRatio * 100) : 0;

  return {
    totalBytes,
    availableBytes,
    usedBytes,
    usedRatio,
    usedPct,
    freePct,
    source,
  };
}

module.exports = { getSystemMemoryInfo };
