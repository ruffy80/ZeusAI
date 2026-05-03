const { generateSprintPlan } = require('./innovation-sprint');

const sprint = generateSprintPlan();
console.log(JSON.stringify(sprint, null, 2));
