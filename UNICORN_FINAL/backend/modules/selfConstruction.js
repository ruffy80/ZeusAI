const fs = require('fs');
const path = require('path');

class SelfConstruction {
  constructor() {
    this.hasRun = false;
  }

  async start() {
    if (this.hasRun) return;
    console.log('🔧 Self‑Construction Engine pornit...');
    this.hasRun = true;

    const modulesDir = path.join(__dirname);
    const files = fs.readdirSync(modulesDir).filter(f => f.endsWith('.js') && f !== 'selfConstruction.js');

    for (const file of files) {
      const filePath = path.join(modulesDir, file);
      let content = fs.readFileSync(filePath, 'utf8');

      if (!content.includes('module.exports') || content.length < 200) {
        console.log('🛠️ Îmbunătățesc modulul ' + file);

        // Adaugă structura de bază dacă lipsește
        if (!content.includes('getStatus')) {
          const name = file.replace('.js', '');
          content = [
            '// Modul auto-construit: ' + name,
            'let state = { counter: 0, lastRun: null };',
            '',
            'module.exports = {',
            "  name: '" + name + "',",
            '  state,',
            '  methods: {',
            '    async process(input) {',
            '      state.counter++;',
            '      state.lastRun = new Date().toISOString();',
            "      console.log('🔄 ' + this.name + ' procesează: ' + JSON.stringify(input));",
            "      return { status: 'ok', module: this.name, counter: state.counter, input };",
            '    },',
            '    getStatus() {',
            '      return {',
            '        name: this.name,',
            "        health: 'good',",
            '        uptime: process.uptime(),',
            '        counter: state.counter,',
            '        lastRun: state.lastRun',
            '      };',
            '    }',
            '  }',
            '};',
            ''
          ].join('\n');
          fs.writeFileSync(filePath, content);
        }
      }
    }

    console.log('✅ Self‑Construction finalizat.');
  }
}

module.exports = new SelfConstruction();
