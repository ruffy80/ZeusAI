// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T20:42:03.523Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T12:15:50.133Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T12:11:52.890Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T11:25:28.365Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T10:52:40.346Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T10:50:35.970Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T09:27:40.691Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T09:27:11.554Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
// ==================== WHITE-LABEL TENANT ENGINE ====================

const crypto = require('crypto');

let _db = null;
function getDb() {
  if (!_db) _db = require('../db');
  return _db;
}

const DEFAULT_BRANDING = {
  logoUrl: '',
  primaryColor: '#6C63FF',
  companyName: 'Zeus AI',
  favicon: '',
  customDomain: '',
  supportEmail: '',
  footerText: '© 2026 Zeus AI Platform',
};

function validateSubdomain(subdomain) {
  if (!/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(subdomain)) {
    throw new Error('Subdomain must be 3-32 lowercase alphanumeric characters or hyphens, cannot start/end with hyphen');
  }
  const reserved = ['www', 'api', 'admin', 'app', 'mail', 'smtp', 'ftp', 'zeus', 'unicorn'];
  if (reserved.includes(subdomain)) throw new Error('Subdomain is reserved');
}

function createTenant(ownerId, data) {
  const { name, subdomain, branding = {} } = data;
  if (!name) throw new Error('name required');
  if (!subdomain) throw new Error('subdomain required');
  validateSubdomain(subdomain);

  const db = getDb();
  const existing = db.tenants ? db.tenants.findBySubdomain(subdomain) : null;
  if (existing) throw new Error('Subdomain already taken');

  const tenant = {
    id: crypto.randomBytes(8).toString('hex'),
    name: String(name).slice(0, 100),
    subdomain: subdomain.toLowerCase(),
    ownerId,
    branding: { ...DEFAULT_BRANDING, ...branding },
    planId: 'enterprise',
    active: 1,
    createdAt: new Date().toISOString(),
  };

  db.tenants.create(tenant);
  return tenant;
}

function getTenantBySubdomain(subdomain) {
  const db = getDb();
  return db.tenants ? db.tenants.findBySubdomain(subdomain) : null;
}

function getTenantsByOwner(ownerId) {
  const db = getDb();
  return db.tenants ? db.tenants.findByOwner(ownerId) : [];
}

function updateTenantBranding(tenantId, ownerId, branding) {
  const db = getDb();
  const tenants = db.tenants ? db.tenants.findByOwner(ownerId) : [];
  const tenant = tenants.find(t => t.id === tenantId);
  if (!tenant) throw new Error('Tenant not found or access denied');
  const updated = { branding: { ...tenant.branding, ...branding } };
  db.tenants.update(tenantId, updated);
  return { ...tenant, ...updated };
}

function getBrandingScript(subdomain) {
  const tenant = getTenantBySubdomain(subdomain);
  if (!tenant || !tenant.active) return null;
  const b = tenant.branding || {};
  return {
    companyName: b.companyName || 'Zeus AI',
    primaryColor: b.primaryColor || '#6C63FF',
    logoUrl: b.logoUrl || '',
    favicon: b.favicon || '',
    footerText: b.footerText || '© 2026 Zeus AI Platform',
    customDomain: b.customDomain || '',
    supportEmail: b.supportEmail || '',
  };
}

module.exports = {
  createTenant,
  getTenantBySubdomain,
  getTenantsByOwner,
  updateTenantBranding,
  getBrandingScript,
  DEFAULT_BRANDING,
};
