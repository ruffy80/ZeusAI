// retryFetch.js - universal fetch/axios retry util for frontend
import axios from 'axios';

export async function retryAxios(config, retries = 3, delay = 400) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      return await axios(config);
    } catch (err) {
      lastErr = err;
      if (i < retries - 1) await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

export async function retryFetch(url, opts = {}, retries = 3, delay = 400) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, opts);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res;
    } catch (err) {
      lastErr = err;
      if (i < retries - 1) await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
