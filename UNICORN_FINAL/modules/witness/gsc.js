'use strict';

/**
 * Search Console query fetch. Returns [] when credentials are missing,
 * the call fails, or Google returns no rows. It does not invent rows.
 */
async function fetchQueries(siteUrl, daysBack) {
  const clientId = process.env.GSC_CLIENT_ID;
  const clientSecret = process.env.GSC_CLIENT_SECRET;
  const refreshToken = process.env.GSC_REFRESH_TOKEN;
  const site = siteUrl || process.env.GSC_SITE_URL;
  const days = Number.isFinite(Number(daysBack)) ? Number(daysBack) : 7;
  if (process.env.NODE_ENV === 'test' && process.env.WITNESS_GSC_FIXTURE) {
    try {
      const parsed = JSON.parse(require('fs').readFileSync(process.env.WITNESS_GSC_FIXTURE, 'utf8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn('[witness] fixture read failed:', err && err.message);
      return [];
    }
  }
  if (!clientId || !clientSecret || !refreshToken || !site) {
    console.warn('[witness] Search Console is not configured. Set GSC_CLIENT_ID, GSC_CLIENT_SECRET, GSC_REFRESH_TOKEN, and GSC_SITE_URL. Returning no rows.');
    return [];
  }
  const end = new Date();
  const start = new Date(end.getTime() - (days * 24 * 60 * 60 * 1000));
  const fmt = (date) => date.toISOString().slice(0, 10);
  try {
    const { google } = require('googleapis');
    const auth = new google.auth.OAuth2(clientId, clientSecret);
    auth.setCredentials({ refresh_token: refreshToken });
    const webmasters = google.webmasters({ version: 'v3', auth });
    const response = await webmasters.searchanalytics.query({
      siteUrl: site,
      requestBody: {
        startDate: fmt(start),
        endDate: fmt(end),
        dimensions: ['query'],
        rowLimit: 100,
      },
    });
    const rows = response && response.data && Array.isArray(response.data.rows) ? response.data.rows : [];
    if (!rows.length) {
      console.warn('[witness] Search Console returned zero rows.');
      return [];
    }
    const date = fmt(end);
    return rows.map((row) => ({
      query: row && row.keys ? String(row.keys[0] || '') : '',
      clicks: Number(row && row.clicks),
      impressions: Number(row && row.impressions),
      date,
    })).filter((row) => row.query && Number.isFinite(row.clicks) && Number.isFinite(row.impressions));
  } catch (err) {
    console.warn('[witness] Search Console request failed:', err && err.message);
    return [];
  }
}

module.exports = { fetchQueries };
