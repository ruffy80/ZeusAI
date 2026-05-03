const { buildInnovationReport } = require('./innovation-engine');

const report = buildInnovationReport();
console.log(JSON.stringify(report, null, 2));
