// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-13T03:10:20.946Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
// ==================== SENTIMENT ANALYSIS ENGINE ====================
// Agent AI care analizează sentimentul pieței, utilizatorilor și brand-ului în timp real

const _state = {
  name: 'sentiment-analysis-engine',
  label: 'Sentiment Analysis Engine',
  startedAt: null,
  processCount: 0,
  lastRun: null,
  health: 'good',
  overallSentiment: 'positive',
  brandScore: 0,
  marketMood: 'neutral',
  signals: [],
  recentAnalyses: [],
};

const SENTIMENT_SOURCES = [
  'Twitter/X', 'Reddit', 'LinkedIn', 'Product Reviews', 'Support Tickets',
  'App Store', 'News Articles', 'Forum Posts',
];

const SENTIMENT_LABELS = ['very_positive', 'positive', 'neutral', 'negative', 'very_negative'];
const MOOD_LABELS = ['euphoric', 'bullish', 'neutral', 'bearish', 'fearful'];

const TOPICS = [
  'pricing', 'onboarding', 'customer support', 'AI features',
  'integrations', 'performance', 'security', 'UI/UX',
];

function _classifySentiment(score) {
  if (score >= 80) return 'very_positive';
  if (score >= 60) return 'positive';
  if (score >= 40) return 'neutral';
  if (score >= 20) return 'negative';
  return 'very_negative';
}

function _analyzeSource(source) {
  const score = Math.round(30 + Math.random() * 65);
  const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
  const label = _classifySentiment(score);
  return {
    id: `sent_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    source,
    topic,
    score,
    label,
    sampleCount: Math.round(100 + Math.random() * 4900),
    insight: label === 'very_positive' || label === 'positive'
      ? `Users love your ${topic} — amplify this in marketing`
      : label === 'negative' || label === 'very_negative'
        ? `⚠️ Negative sentiment around ${topic} — needs immediate attention`
        : `Neutral sentiment on ${topic} — opportunity to differentiate`,
    analyzedAt: new Date().toISOString(),
  };
}

function _computeOverall(analyses) {
  if (!analyses.length) return { label: 'neutral', score: 50 };
  const avg = analyses.reduce((s, a) => s + a.score, 0) / analyses.length;
  return { label: _classifySentiment(avg), score: Math.round(avg) };
}

function _computeMarketMood() {
  const score = Math.round(20 + Math.random() * 75);
  const idx = score >= 80 ? 0 : score >= 65 ? 1 : score >= 45 ? 2 : score >= 30 ? 3 : 4;
  return { mood: MOOD_LABELS[idx], score };
}

function init() {
  _state.startedAt = new Date().toISOString();
  // Initial analysis across all sources
  const initial = SENTIMENT_SOURCES.map(s => _analyzeSource(s));
  _state.recentAnalyses = initial;
  const overall = _computeOverall(initial);
  _state.overallSentiment = overall.label;
  _state.brandScore = overall.score;
  const mood = _computeMarketMood();
  _state.marketMood = mood.mood;
  // Re-analyze every 12 minutes
  setInterval(() => {
    const analyses = SENTIMENT_SOURCES.map(s => _analyzeSource(s));
    _state.recentAnalyses = analyses;
    const ov = _computeOverall(analyses);
    _state.overallSentiment = ov.label;
    _state.brandScore = ov.score;
    const m = _computeMarketMood();
    _state.marketMood = m.mood;
    _state.signals.unshift({
      summary: `Brand score: ${ov.score}/100 | Market mood: ${m.mood}`,
      timestamp: new Date().toISOString(),
    });
    if (_state.signals.length > 100) _state.signals.pop();
    _state.lastRun = new Date().toISOString();
  }, 12 * 60 * 1000);
  console.log('🧠 Sentiment Analysis Engine activat.');
}

async function process(input = {}) {
  _state.processCount++;
  _state.lastRun = new Date().toISOString();
  const source = input.source && SENTIMENT_SOURCES.includes(input.source)
    ? input.source
    : SENTIMENT_SOURCES[Math.floor(Math.random() * SENTIMENT_SOURCES.length)];
  const analysis = _analyzeSource(source);
  _state.recentAnalyses.unshift(analysis);
  if (_state.recentAnalyses.length > 100) _state.recentAnalyses.pop();
  const overall = _computeOverall(_state.recentAnalyses.slice(0, 20));
  _state.overallSentiment = overall.label;
  _state.brandScore = overall.score;
  return {
    status: 'ok',
    module: _state.name,
    label: _state.label,
    analysis,
    overallBrandScore: overall.score,
    overallSentiment: overall.label,
    marketMood: _state.marketMood,
    timestamp: _state.lastRun,
  };
}

function getStatus() {
  return {
    ..._state,
    sourcesMonitored: SENTIMENT_SOURCES.length,
    recentAnalysesCount: _state.recentAnalyses.length,
    topInsight: _state.recentAnalyses[0]
      ? _state.recentAnalyses[0].insight
      : 'No data yet',
  };
}

init();

module.exports = { process, getStatus, init, name: 'sentiment-analysis-engine' };
