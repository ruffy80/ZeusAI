// blockchainAdapter.js — simple blockchain integration for AI modules
const axios = require('axios');

const BLOCKCHAIN_API = process.env.BLOCKCHAIN_API || 'https://api.blockcypher.com/v1/btc/main';

async function getLatestBlock() {
  const res = await axios.get(BLOCKCHAIN_API);
  return res.data.height;
}

async function sendTransaction(txData) {
  // Placeholder: integrate with real blockchain API/provider
  return { txId: 'mock-tx-' + Date.now(), status: 'broadcasted', txData };
}

module.exports = { getLatestBlock, sendTransaction };
