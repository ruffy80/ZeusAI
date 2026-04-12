const { generateSprintPlan } = require('./innovation-sprint');

const sprint = generateSprintPlan();
console.log(JSON.stringify(sprint, null, 2));


// Auto-reparat de CodeSanityEngine
module.exports = { name: 'sprint', getStatus: () => ({ health: 'good', name: 'sprint' }) };
