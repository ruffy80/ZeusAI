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
