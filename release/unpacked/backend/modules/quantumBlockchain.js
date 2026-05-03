const crypto = require('crypto');

class QuantumResistantBlockchain {
  constructor() {
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
