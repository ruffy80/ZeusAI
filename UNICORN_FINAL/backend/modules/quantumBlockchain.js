// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:01:10.450Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:58:03.205Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:53:47.289Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:53:01.152Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:52:08.802Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:51:01.990Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

const crypto = require('crypto');

class QuantumResistantBlockchain {
  constructor() {
    this.cache = new Map(); this.cacheTTL = 60000; 
    this.chain = [];
    this.pendingTransactions = [];
    this.difficulty = 4;
    this.reward = 10;
    this.createGenesisBlock();
  }

  createGenesisBlock() {
    const genesisBlock = {
      index: 0,
      timestamp: new Date().toISOString(),
      transactions: [],
      previousHash: '0',
      hash: this.calculateHash(0, [], '0'),
      nonce: 0,
      quantumProof: this.generateQuantumProof()
    };
    this.chain.push(genesisBlock);
  }

  calculateHash(index, transactions, previousHash, nonce = 0) {
    return crypto.createHash('sha512')
      .update(index + JSON.stringify(transactions) + previousHash + nonce)
      .digest('hex');
  }

  generateQuantumProof() {
    return crypto.randomBytes(64).toString('hex');
  }

  mineBlock() {
    const block = {
      index: this.chain.length,
      timestamp: new Date().toISOString(),
      transactions: this.pendingTransactions,
      previousHash: this.getLatestBlock().hash,
      nonce: 0,
      quantumProof: null,
      hash: ''
    };

    while (block.hash.substring(0, this.difficulty) !== '0'.repeat(this.difficulty)) {
      block.nonce++;
      block.hash = this.calculateHash(block.index, block.transactions, block.previousHash, block.nonce);
    }
    block.quantumProof = this.generateQuantumProof();

    this.chain.push(block);
    this.pendingTransactions = [];
    return block;
  }

  addTransaction(transaction) {
    this.pendingTransactions.push(transaction);
    return transaction;
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  getBalance(address) {
    let balance = 0;
    for (const block of this.chain) {
      for (const tx of block.transactions) {
        if (tx.from === address) balance -= tx.amount;
        if (tx.to === address) balance += tx.amount;
      }
    }
    return balance;
  }

  getStats() {
    return {
      chainLength: this.chain.length,
      totalTransactions: this.chain.reduce((sum, b) => sum + b.transactions.length, 0),
      pendingTransactions: this.pendingTransactions.length,
      difficulty: this.difficulty,
      reward: this.reward
    };
  }
}

module.exports = new QuantumResistantBlockchain();
