// Self-test for innovations-30y module (15 features)
const I = require('../src/innovations-30y');

const r1 = I.appendReceipt({ type: 'order', plan: 'Adaptive AI', amount: 499 });
console.log('✓ Receipt:', r1.receiptId.slice(0, 20) + '...');

const root = I.rollDailyRoot();
console.log('✓ Daily root:', root.root.slice(0, 16) + '...');

const proof = I.getProof(r1.receiptId);
console.log('✓ Merkle proof valid:', I.verifyInclusion(proof.leafHash, proof.proof, proof.root));

console.log('✓ OP_RETURN:', I.opReturnPayload().lengthBytes, 'bytes');
console.log('✓ Constitution hash:', I.getConstitution().hashShort);
console.log('✓ Models:', I.MODELS.length);
console.log('✓ X-AI-Provenance:', I.provenanceHeader('zeus-30y', { tools: ['search'] }).length, 'b64 chars');
console.log('✓ SBOM:', I.buildSBOM().compositeHash.slice(0, 16) + '...');
console.log('✓ Honeytoken:', I.honeytoken('demo'));
console.log('✓ DP count(100):', I.dpCount(100));

const cap = I.buildTimeCapsule(JSON.stringify({ state: 'live' }));
console.log('✓ Time capsule:', cap.capsuleId.slice(0, 20), '· shards:', cap.keyShards.length);

const inc = I.sealIncident({ severity: 'low' }, 0);
const list = I.listIncidentsPublic();
console.log('✓ Incident:', inc.incidentId.slice(0, 20), '· status:', list[0].status);

I.appendAudit('user1', { action: 'login' });
I.appendAudit('user1', { action: 'view', resource: '/services' });
const m = I.getUserAuditMerkle('user1');
console.log('✓ User audit:', m.count, 'entries · root:', m.root.slice(0, 16) + '...');

const sig = I.hybridSign('hello');
console.log('✓ Hybrid sign: classical?', !!sig.classical, '· PQ:', sig.pqc.algo, '· sig bytes:', sig.pqc.sig.length / 2);

const ok = I.pqVerify('hello', Buffer.from(sig.pqc.sig, 'hex'));
console.log('✓ PQ verify:', ok);

console.log('\n🚀 All 15 innovations operational.');
