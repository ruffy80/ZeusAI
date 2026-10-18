'use strict';

/**
 * MODULE DUTY — MDT/1.0
 *
 * Two duties, assigned by the file's job, not by its name.
 *
 * customer — the file creates a public shelf offer, opens the checkout
 *            order, writes the buyer file, or proves those three agree.
 * unicorn  — the file keeps Unicorn running. A buyer does not receive it
 *            as a product. A support row may be called while a purchase
 *            happens, and it is still an organ.
 *
 * deliversCustomer stays false on the census. The product is the shelf
 * offer, not the module file.
 */

const fs = require('fs');
const path = require('path');

const PROTOCOL = 'MDT/1.0';
const ROOT = path.join(__dirname, '..', '..');

const CUSTOMER = Object.freeze([
  {
    path: 'src/commerce/instant-catalog.js',
    duty: 'customer',
    role: 'offer',
    work: 'Defines the instant and professional shelf rows.',
  },
  {
    path: 'src/commerce/enterprise-catalog.js',
    duty: 'customer',
    role: 'offer',
    work: 'Defines the enterprise shelf rows.',
  },
  {
    path: 'src/commerce/public-catalog-filter.js',
    duty: 'customer',
    role: 'offer',
    work: 'Keeps internal module names off the public shelf.',
  },
  {
    path: 'src/commerce/commerce-buyability.js',
    duty: 'customer',
    role: 'offer',
    work: 'Decides whether the shelf button may open a checkout.',
  },
  {
    path: 'src/commerce/public-shelf.js',
    duty: 'customer',
    role: 'offer',
    work: 'Publishes the buyer offer: id, price, button, and clock.',
  },
  {
    path: 'src/site/sovereign-commerce.js',
    duty: 'customer',
    role: 'order',
    work: 'Opens the checkout order after the shelf proof passes.',
  },
  {
    path: 'src/site/v2/fulfillment-engine.js',
    duty: 'customer',
    role: 'file',
    work: 'Writes the activation pack, the kickoff pack, or the generated file.',
  },
  {
    path: 'src/site/v2/delivery-registry.js',
    duty: 'customer',
    role: 'file',
    work: 'Stores the paperwork and the downloadable artifact.',
  },
  {
    path: 'backend/modules/fulfillment-ai-os.js',
    duty: 'customer',
    role: 'file',
    work: 'Lets a model write six text shelf files when a real provider key exists.',
  },
  {
    path: 'src/commerce/service-integrity.js',
    duty: 'customer',
    role: 'proof',
    work: 'Refuses a shelf offer whose button and file disagree.',
  },
]);

const SUPPORT = Object.freeze([
  {
    path: 'backend/modules/dynamic-pricing.js',
    duty: 'unicorn',
    role: 'support',
    calledBy: 'src/commerce/public-shelf.js',
    work: 'Supplies a live price factor. The shelf row remains the offer.',
  },
  {
    path: 'backend/modules/aiProviders.js',
    duty: 'unicorn',
    role: 'support',
    calledBy: 'src/site/v2/fulfillment-engine.js',
    work: 'Carries a model call for an allowlisted text file. The file remains the delivery.',
  },
]);

const ORGAN_WORK = 'Keeps Unicorn running. It does not create a shelf offer and it does not write the buyer file.';

const BY_PATH = new Map();
for (const row of CUSTOMER) BY_PATH.set(row.path, row);
for (const row of SUPPORT) BY_PATH.set(row.path, row);

function judge(repoPath) {
  const key = String(repoPath || '').split('\\').join('/');
  const hit = BY_PATH.get(key);
  if (hit && hit.duty === 'customer') {
    return { path: key, duty: 'customer', role: hit.role, work: hit.work };
  }
  if (hit) {
    return { path: key, duty: 'unicorn', role: 'support', work: hit.work };
  }
  return { path: key, duty: 'unicorn', role: null, work: ORGAN_WORK };
}

function judgeModule(rel) {
  const name = String(rel || '').split('\\').join('/');
  if (!name) return judge('');
  return judge('backend/modules/' + name);
}

function sheet() {
  return {
    protocol: PROTOCOL,
    inventsServices: false,
    modulesAdvertiseCustomerDelivery: false,
    customerDelivery: 'public-shelf',
    customer: CUSTOMER.map((row) => ({
      path: row.path,
      role: row.role,
      work: row.work,
      present: fs.existsSync(path.join(ROOT, row.path)),
    })),
    support: SUPPORT.map((row) => ({
      path: row.path,
      role: 'support',
      calledBy: row.calledBy,
      work: row.work,
      present: fs.existsSync(path.join(ROOT, row.path)),
    })),
    note: 'A backend module works for Unicorn unless this list names it. The buyer receives a public shelf offer and its file. The module name is not that offer.',
  };
}

function status() {
  const listed = sheet();
  const census = require('../../backend/modules/module-census-os');
  const found = census.discovery();
  const fileRows = found.modules.filter((row) => row.kind === 'file' || row.kind === 'alias');
  let shelf = { ok: false, offers: 0, delivering: 0, kickoffOk: false };
  try {
    const audit = require('./service-integrity').audit();
    shelf = {
      ok: audit.ok === true,
      offers: audit.offers,
      delivering: audit.delivering,
      kickoffOk: audit.kickoffOk === true,
    };
  } catch (_) { /* shelf stays closed */ }
  return {
    ok: listed.customer.every((row) => row.present) && shelf.ok === true,
    protocol: PROTOCOL,
    inventsServices: false,
    modulesAdvertiseCustomerDelivery: false,
    customerDelivery: 'public-shelf',
    unicornFiles: fileRows.filter((row) => row.duty === 'unicorn').length,
    customerFiles: listed.customer.length,
    customerDutyFiles: fileRows.filter((row) => row.duty === 'customer').length,
    customer: listed.customer,
    support: listed.support,
    shelf,
    note: listed.note,
  };
}

module.exports = {
  PROTOCOL,
  CUSTOMER,
  SUPPORT,
  judge,
  judgeModule,
  sheet,
  status,
};
