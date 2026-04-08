require('./backend/modules/unicornAutoGenesis.js').run().catch((err) => {
  console.error('❌ Auto-Genesis failed:', err.message);
  process.exit(1);
});
