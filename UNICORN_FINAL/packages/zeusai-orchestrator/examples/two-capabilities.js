'use strict';

const { runSandbox } = require('../index.js');

const ms = Number(process.env.SANDBOX_MS || 60000);

runSandbox(ms).then((result) => {
  console.log(JSON.stringify(result));
  if (!result.ok || result.conflicts !== 0) process.exit(1);
}).catch((err) => {
  console.error(err && err.stack || err);
  process.exit(1);
});
