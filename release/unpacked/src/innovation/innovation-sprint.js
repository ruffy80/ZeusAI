const { buildInnovationReport } = require('./innovation-engine');

function generateSprintPlan() {
  const report = buildInnovationReport();
  const top = report.topPriority;

  const tasks = [
    {
      id: 'research-problem-space',
      title: 'Research problem boundaries and user risks',
      owner: 'product',
      etaDays: 2,
      dependsOn: []
    },
    {
      id: 'prototype-core-flow',
      title: 'Prototype end-to-end core user flow',
      owner: 'engineering',
      etaDays: 4,
      dependsOn: ['research-problem-space']
    },
    {
      id: 'safety-and-privacy-gates',
      title: 'Implement safety, privacy, and rollback gates',
      owner: 'platform',
      etaDays: 3,
      dependsOn: ['prototype-core-flow']
    },
    {
      id: 'pilot-and-measurement',
      title: 'Run pilot and capture measurable impact metrics',
      owner: 'operations',
      etaDays: 5,
      dependsOn: ['safety-and-privacy-gates']
    }
  ];

  return {
    generatedAt: new Date().toISOString(),
    selectedInnovation: top,
    sprintLengthDays: 14,
    successMetrics: [
      'time-to-value',
      'safety incidents = 0',
      'user retention uplift',
      'operational cost delta'
    ],
    tasks
  };
}

module.exports = { generateSprintPlan };
