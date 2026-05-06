// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-06T14:29:22.954Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// aiOpenAi.js — OpenAI integration for advanced AI modules
const axios = require('axios');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

async function askOpenAI(messages, model = 'gpt-4') {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY missing');
  const res = await axios.post(OPENAI_URL, {
    model,
    messages,
    temperature: 0.2,
    max_tokens: 256
  }, {
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  return res.data.choices[0].message.content;
}

module.exports = { askOpenAI };
