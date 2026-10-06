'use strict';

/**
 * The five frontier organs run real local work.
 * They do not claim spacecraft, implants, or quantum hardware.
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');

let passed = 0;
function check(name, fn) {
  const ret = fn();
  if (ret && typeof ret.then === 'function') {
    return ret.then(() => {
      passed += 1;
      console.log('✓', name);
    });
  }
  passed += 1;
  console.log('✓', name);
  return undefined;
}

async function main() {
  await check('space computing runs a job and refuses a ninth new id when full', () => {
    const space = require('../backend/modules/AutonomousSpaceComputing');
    const first = space.submit({ id: 'alpha', payload: 'orbit-is-not-claimed' });
    assert.strictEqual(first.ok, true);
    assert.equal(typeof first.job.checksum, 'string');
    assert.strictEqual(first.claimsOrbital, false);
    for (let i = 0; i < 8; i += 1) space.submit({ id: 'slot-' + i, payload: i });
    const full = space.submit({ id: 'overflow', payload: 'no' });
    assert.strictEqual(full.ok, false);
    assert.strictEqual(full.reason, 'space_full');
    assert.strictEqual(space.getStatus().claimsOrbital, false);
    assert.strictEqual(space.release('alpha').removed, true);
  });

  await check('twin graph syncs only across a link', () => {
    const twins = require('../backend/modules/DecentralizedDigitalTwinNetwork');
    assert.strictEqual(twins.upsert('a', { paid: 1 }).ok, true);
    assert.strictEqual(twins.upsert('b', { paid: 0 }).ok, true);
    assert.strictEqual(twins.sync('a', 'b').reason, 'not_linked');
    assert.strictEqual(twins.link('a', 'b').ok, true);
    const synced = twins.sync('a', 'b');
    assert.strictEqual(synced.ok, true);
    const snap = twins.snapshot();
    const b = snap.nodes.find((node) => node.id === 'b');
    assert.strictEqual(b.state.paid, 1);
    assert.strictEqual(snap.claimsPlanetaryGrid, false);
  });

  await check('neural interface remembers and ranks without an implant', () => {
    const neural = require('../backend/modules/NeuralInterfaceAPI');
    const saved = neural.dispatch('remember origin zeusai');
    assert.strictEqual(saved.ok, true);
    assert.strictEqual(saved.claimsNeuralImplant, false);
    const recalled = neural.dispatch('recall origin');
    assert.strictEqual(recalled.result.value, 'zeusai');
    const ranked = neural.dispatch('rank short | a much longer option');
    assert.strictEqual(ranked.result.ranked[0].text, 'a much longer option');
    const heard = neural.dispatch('hello');
    assert.strictEqual(heard.intent, 'hear');
  });

  await check('packet link seals and rejects a bad mac', () => {
    const qnet = require('../backend/modules/QuantumInternetProtocol');
    assert.strictEqual(qnet.createNode('n1').ok, true);
    assert.strictEqual(qnet.createNode('n2').ok, true);
    assert.strictEqual(qnet.openLink('n1', 'n2').channel, 'x25519-hmac-sha256');
    const sent = qnet.send('n1', 'n2', { hello: 'node' });
    assert.strictEqual(sent.ok, true);
    const got = qnet.receive('n2');
    assert.strictEqual(got.packets.length, 1);
    assert.strictEqual(got.packets[0].payload.hello, 'node');
    assert.strictEqual(got.claimsQuantumChannel, false);
    qnet.send('n1', 'n2', { hello: 'again' });
    const box = qnet.receive('n2');
    assert.strictEqual(box.packets.length, 1);
    const forged = qnet.verify({ from: 'n1', to: 'n2', body: Buffer.from('{}').toString('base64'), mac: '00' });
    assert.strictEqual(forged.ok, false);
    assert.strictEqual(forged.reason, 'bad_mac');
    const status = qnet.getStatus();
    assert.strictEqual(status.claimsQuantumChannel, false);
    assert.ok(!JSON.stringify(status).includes('private'));
  });

  await check('statevector bell pair and perceptron both run', () => {
    const qml = require('../backend/modules/QuantumMachineLearningCore');
    const bell = qml.bell();
    assert.deepStrictEqual(bell.probabilities, [0.5, 0, 0, 0.5]);
    assert.strictEqual(bell.claimsQuantumHardware, false);
    const trained = qml.train([
      { features: [0, 0], label: 0 },
      { features: [0, 1], label: 1 },
      { features: [1, 0], label: 1 },
      { features: [1, 1], label: 1 },
    ]);
    assert.strictEqual(trained.ok, true);
    assert.strictEqual(qml.predict([0, 0]).label, 0);
    assert.strictEqual(qml.predict([1, 1]).label, 1);
    assert.strictEqual(qml.getStatus().qubits, 2);
    assert.strictEqual(qml.getStatus().claimsQuantumHardware, false);
  });

  await check('OCC process delegates into the space engine', async () => {
    const occ = require('../backend/modules/orchestrated-capability-continuum');
    const out = await occ.autonomousSpace.process({ id: 'occ-job', payload: 'local' });
    assert.strictEqual(out.ok, true);
    assert.strictEqual(out.claimsOrbital, false);
    assert.equal(typeof out.job.checksum, 'string');
    assert.strictEqual(out.honesty.claimsQuantumInternet, false);
  });

  console.log('\n✅ frontier-organs: ' + passed + ' tests passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
