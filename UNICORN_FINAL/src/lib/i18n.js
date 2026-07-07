'use strict';

const CATALOG = {
  en: {
    app_name: 'ZEUS NETWORK',
    status_live: 'Live',
  },
  ro: {
    app_name: 'REȚEAUA ZEUS',
    status_live: 'Live',
  },
};

function available() {
  return Object.keys(CATALOG);
}

function all(lang) {
  const l = String(lang || 'en').toLowerCase();
  return CATALOG[l] || CATALOG.en;
}

module.exports = { available, all };
