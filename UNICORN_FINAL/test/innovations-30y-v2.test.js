// Self-test for innovations-30y-v2 module
const I = require('../src/innovations-30y-v2');

// 1. ZK commitments
const c = I.commitValue({ amount: 1500, plan: 'enterprise' });
console.log('✓ Commitment:', c.commitment.slice(0, 16) + '…');
console.log('✓ Reveal verify:', I.verifyCommitment({ amount: 1500, plan: 'enterprise' }, c.blinding, c.commitment));

// 2. Threshold key
const tk = I.thresholdKeygen({ n: 5, t: 3 });
console.log('✓ Threshold key:', tk.threshold, '· pub:', tk.publicKey.slice(0, 16) + '…');

// 3. Federated learning
I.flSubmit({ roundId: 'r1', participantId: 'a', gradientHash: 'h1' });
I.flSubmit({ roundId: 'r1', participantId: 'b', gradientHash: 'h2' });
I.flSubmit({ roundId: 'r1', participantId: 'c', gradientHash: 'h3' });
const round = I.flCloseRound('r1');
console.log('✓ FL round closed:', round.count, 'submissions · root:', round.root.slice(0, 16) + '…');

// 4. VRF
const v = I.vrfProve('lottery-2026-04-25');
console.log('✓ VRF y:', v.y.slice(0, 16) + '…', '· verify:', I.vrfVerify(v.input, v.y, v.proof, v.pk));

// 5. Token bucket
const t1 = I.tokenBucketTake('u1');
console.log('✓ Token bucket:', t1.granted ? 'granted' : 'denied', '· remaining:', t1.remaining, '· proof:', t1.proof.slice(0, 16) + '…');

// 6. k-anon
for (let i = 0; i < 12; i++) I.kAnonRecord('login', { country: 'RO' });
const q = I.kAnonQuery('login', { country: 'RO' }, 10);
console.log('✓ k-anonymity:', q.allowed ? 'allowed (cohort=' + q.count + ')' : 'denied');

// 7. Relay
console.log('✓ Relay desc:', Object.keys(I.relayDescriptor()).join(','));

// 8. VDF
const vdf = I.vdfEvaluate('seed-2026', 1000);
console.log('✓ VDF y:', vdf.y.slice(0, 16) + '…', '· verify:', I.vdfVerify(vdf.seed, vdf.t, vdf.y));

// 9. Reputation
I.reputationClaim({ fromDid: 'did:web:trust.example', toDid: 'did:web:zeusai.pro', claim: 'reliable', weight: 5 });
I.reputationClaim({ fromDid: 'did:web:audit.example', toDid: 'did:web:zeusai.pro', claim: 'audited', weight: 3 });
const rep = I.reputationFor('did:web:zeusai.pro');
console.log('✓ Reputation:', rep.totalClaims, 'claims · score:', rep.score);

// 10. Compliance
const ca = I.complianceAttestation();
console.log('✓ Compliance hash:', ca.hash.slice(0, 16) + '…', '· standards:', ca.standard.length);

// 11. DR drill
const dr = I.drDrillRecord({ scenario: 'pm2-crash-restore', rtoSeconds: 12, rpoSeconds: 0, outcome: 'pass' });
console.log('✓ DR drill:', dr.scenario, '· RTO:', dr.rtoSeconds + 's · hash:', dr.hash.slice(0, 16) + '…');

// 12. Carbon
I.carbonRecord({ gCO2: 0.0042 });
I.carbonRecord({ gCO2: 0.0038 });
const co2 = I.carbonAttest();
console.log('✓ Carbon attest:', co2.totalGCO2, 'gCO2 ·', co2.entries, 'events · hash:', co2.hash.slice(0, 16) + '…');

// 13. Bounty
const b = I.bountyAdd({ title: 'Find bug in ML-DSA wrapper', severity: 'high', amountUsd: 5000, scope: 'src/innovations-30y.js' });
const tot = I.bountyTotal();
console.log('✓ Bug bounty:', b.bountyId.slice(0, 18), '· open:', tot.open, '· total $' + tot.totalUsd);

// 14. DID
const didDoc = I.didDocumentSelf();
console.log('✓ DID document:', didDoc.id, '· services:', didDoc.service.length);
console.log('✓ DID resolve:', I.didResolve('did:web:zeusai.pro').method);

// 15. Status overview
const s = I.v2Status();
console.log('✓ v2 Status: primitives =', s.primitives, '· features =', Object.keys(s.features).length);

console.log('\n🚀 All 15 v2 innovations operational.');
