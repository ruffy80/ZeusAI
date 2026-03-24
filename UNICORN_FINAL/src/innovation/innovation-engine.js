function scoreIdea(idea) {
  const impact = Number(idea.impact || 0);
  const feasibility = Number(idea.feasibility || 0);
  const urgency = Number(idea.urgency || 0);
  const safety = Number(idea.safety || 0);
  return impact * 0.4 + feasibility * 0.2 + urgency * 0.2 + safety * 0.2;
}

function buildInnovationReport() {
  const ideas = [
    {
      id: 'care-companion-ai',
      title: 'Personal preventive care companion',
      problem: 'Late detection of health risk patterns',
      impact: 10,
      feasibility: 7,
      urgency: 10,
      safety: 9
    },
    {
      id: 'micro-grid-coordinator',
      title: 'Community micro-grid optimizer',
      problem: 'Energy waste and unstable local grids',
      impact: 9,
      feasibility: 7,
      urgency: 9,
      safety: 9
    },
    {
      id: 'learning-path-orchestrator',
      title: 'Adaptive education path builder',
      problem: 'Low retention in one-size-fits-all education',
      impact: 9,
      feasibility: 8,
      urgency: 8,
      safety: 10
    }
  ];

  const prioritized = ideas
    .map((idea) => ({ ...idea, score: Number(scoreIdea(idea).toFixed(2)) }))
    .sort((a, b) => b.score - a.score);

  return {
    generatedAt: new Date().toISOString(),
    principles: [
      'human-first',
      'privacy-by-design',
      'reversible rollout',
      'measurable real-world impact'
    ],
    topPriority: prioritized[0],
    backlog: prioritized
  };
}

module.exports = { buildInnovationReport, scoreIdea };
