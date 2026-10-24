'use strict';

/**
 * A refund stays open only until the deliverable is issued.
 * Once a file, license, or completed delivery exists, the refund is closed.
 * Paying and then using the work does not open a second chance to take the money back.
 */

function _text(value) {
  return String(value == null ? '' : value).trim();
}

function _listed(value) {
  return Array.isArray(value) && value.length > 0;
}

function consumptionSignals(record) {
  const row = record && typeof record === 'object' ? record : {};
  const signals = [];
  if (_text(row.deliveredAt) || _text(row.delivered_at)) signals.push('deliveredAt');
  if (row.license && typeof row.license === 'object') signals.push('license');
  if (_text(row.licenseIssuedAt)) signals.push('licenseIssuedAt');
  if (_listed(row.deliverables) || _listed(row.files)) signals.push('deliverables');
  const delivery = row.delivery && typeof row.delivery === 'object' ? row.delivery : null;
  if (delivery) {
    const status = _text(delivery.status).toLowerCase();
    if (status === 'delivered' || status === 'complete' || status === 'completed') signals.push('delivery');
    if (_listed(delivery.items) || _listed(delivery.artifacts) || _listed(delivery.files)) signals.push('delivery');
  }
  const deliveryStatus = _text(row.deliveryStatus || row.fulfillmentStatus).toLowerCase();
  if (deliveryStatus === 'delivered' || deliveryStatus === 'complete' || deliveryStatus === 'completed') {
    signals.push('deliveryStatus');
  }
  if (Number(row.downloadCount) > 0 || Number(row.downloads) > 0) signals.push('download');
  if (_text(row.activatedAt) || row.activated === true) signals.push('activated');
  return [...new Set(signals)];
}

function assessRefund(record) {
  const signals = consumptionSignals(record);
  if (signals.length) {
    return {
      allowed: false,
      reason: 'deliverable_already_issued',
      signals,
      note: 'The refund is closed once the file, license, or work is issued.',
    };
  }
  return {
    allowed: true,
    reason: 'not_issued',
    signals: [],
    note: 'No deliverable has been issued for this order.',
  };
}

function providerForced(proof) {
  if (!proof || typeof proof !== 'object') return false;
  if (proof.forced === true) return true;
  return !!(_text(proof.provider) || _text(proof.providerRef) || _text(proof.paymentId) || _text(proof.paypalOrderId));
}

function decideRevoke(record, proof) {
  const decision = assessRefund(record);
  if (decision.allowed) return { action: 'refund', decision };
  if (providerForced(proof)) return { action: 'revoke_access', decision };
  return { action: 'refuse', decision };
}

module.exports = {
  consumptionSignals,
  assessRefund,
  providerForced,
  decideRevoke,
};
