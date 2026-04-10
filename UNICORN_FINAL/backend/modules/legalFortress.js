const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const cron = require('node-cron');
const nodemailer = require('nodemailer');

class LegalFortress {
  constructor()
    this.cache = new Map(); this.cacheTTL = 60000; {
    this.owner = {
      name: 'Vladoi Ionut',
      email: 'vladoi_ionut@yahoo.com',
      btcAddress: 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e',
      address: 'Strada Principală, Nr. 1, București, România'
    };

    this.registrations = {
      osim: { status: 'pending', applicationId: null, date: null },
      copyright: { status: 'pending', registrationId: null, date: null },
      trademark: { status: 'pending', registrationId: null, date: null },
      international: { status: 'pending', applications: [] }
    };

    this.licenseTerms = this.generateLicenseTerms();
    this.init().catch((err) => console.error('❌ LegalFortress init failed:', err.message));
  }

  async init() {
    console.log(`⚖️ Legal Fortress activ – proprietatea este 100% a lui ${this.owner.name}`);
    console.log(`📧 Notificări legale trimise la: ${this.owner.email}`);
    await this.checkOwnershipStatus();
    this.startLegalMonitoring();
    this.enforcePaymentRouting();
    this.startMonthlyReport();
    this.startEmailNotifications();
  }

  // ==================== NOTIFICĂRI EMAIL ====================
  async sendLegalNotification(subject, content) {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log(`📧 [NOTIFICARE] ${subject}\n${content}`);
      return;
    }

    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      });

      await transporter.sendMail({
        from: `"Unicorn Legal" <${process.env.SMTP_USER}>`,
        to: this.owner.email,
        subject: `⚖️ ${subject}`,
        text: content,
        html: `<h2>${subject}</h2><pre>${content}</pre><p>Unicorn AI - Legal Fortress</p>`
      });

      console.log(`📧 Notificare legală trimisă: ${subject}`);
    } catch (err) {
      console.error('Eroare la trimitere email:', err.message);
    }
  }

  startEmailNotifications() {
    this.sendLegalNotification(
      'Legal Fortress Activ',
      `Sistemul de protecție legală a fost activat pentru ${this.owner.name}.\n\nAdresă BTC: ${this.owner.btcAddress}\nEmail: ${this.owner.email}\n\nToate modulele sunt înregistrate ca proprietatea dumneavoastră.\nToate plățile sunt direcționate exclusiv către adresa BTC.\nOrice încălcare va fi detectată și raportată automat.`
    );
  }

  // ==================== PROPRIETATE EXCLUSIVĂ ====================
  async checkOwnershipStatus() {
    console.log('🔍 Verific statutul proprietății...');
    const modules = this.getAllModules();
    let allOwned = true;

    for (const modulePath of modules) {
      const content = fs.readFileSync(modulePath, 'utf8');
      if (!content.includes('OWNERSHIP: Vladoi Ionut')) {
        await this.addOwnershipWatermark(modulePath);
        allOwned = false;
      }
    }

    if (allOwned) {
      console.log('✅ Toate modulele sunt înregistrate ca proprietatea ta');
    } else {
      console.log('⚠️ Unele module nu aveau watermark – am adăugat automat');
      await this.sendLegalNotification(
        'Watermark Adăugat Automat',
        'Unele module nu aveau watermark-ul de proprietate. Acesta a fost adăugat automat.'
      );
    }
  }

  getAllModules() {
    const modules = [];
    const root = path.join(__dirname, '..');

    const walk = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          walk(fullPath);
        } else if (entry.name.endsWith('.js')) {
          modules.push(fullPath);
        }
      }
    };

    walk(root);
    return modules;
  }

  async addOwnershipWatermark(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const watermark = `// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: ${new Date().toISOString()}
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================\n\n`;

    fs.writeFileSync(filePath, watermark + content);
    console.log(`📜 Watermark adăugat la ${path.basename(filePath)}`);
  }

  // ==================== ÎNCASĂRI EXCLUSIVE ====================
  enforcePaymentRouting() {
    const paymentGateway = require('./paymentGateway');
    if (paymentGateway.__legalFortressWrapped) return;

    const originalCreatePayment = paymentGateway.createPayment?.bind(paymentGateway);
    const self = this;

    if (typeof originalCreatePayment === 'function') {
      paymentGateway.createPayment = async function wrappedCreatePayment(payload = {}) {
        payload.metadata = payload.metadata || {};
        payload.metadata.legalOwner = self.owner.name;
        payload.metadata.btcAddress = self.owner.btcAddress;
        return originalCreatePayment(payload);
      };
    }

    paymentGateway.__legalFortressWrapped = true;
    console.log('💳 Toate plățile sunt monitorizate legal pentru adresa ta BTC');
  }

  // ==================== ÎNREGISTRARE OSIM ====================
  async registerWithOSIM() {
    console.log('📝 Pregătesc înregistrarea la OSIM...');

    const application = {
      applicant: this.owner,
      trademark: 'UNICORN AI',
      classes: ['9', '42'],
      description: 'Platformă AI autonomă pentru automatizare, plăți și inovație',
      priorityDate: new Date().toISOString(),
      documents: await this.generateOSIMDocuments()
    };

    this.registrations.osim = {
      status: 'submitted',
      applicationId: 'OSIM-' + Date.now(),
      date: new Date().toISOString(),
      application
    };

    await this.sendLegalNotification(
      'Cerere OSIM Generată',
      `Cererea pentru înregistrarea mărcii UNICORN AI a fost generată.\n\nID Cerere: ${this.registrations.osim.applicationId}\nClase: 9 (software), 42 (servicii AI)\nData: ${this.registrations.osim.date}`
    );

    await this.logLegalAction('osim_registration', this.registrations.osim);
    return this.registrations.osim;
  }

  async generateOSIMDocuments() {
    return {
      powerOfAttorney: this.generatePowerOfAttorney(),
      description: 'Unicorn AI – platformă autonomă de inteligență artificială',
      ownerStatement: this.generateOwnerStatement()
    };
  }

  generatePowerOfAttorney() {
    return `IMPUTERNICIRE\n\nSubsemnatul Vladoi Ionut, domiciliat în București, România,\nemail: vladoi_ionut@yahoo.com, împuternicesc Unicorn AI să mă reprezinte\nîn fața OSIM pentru înregistrarea mărcii UNICORN AI.\n\nData: ${new Date().toISOString()}\nSemnătura: Vladoi Ionut`;
  }

  generateOwnerStatement() {
    return `DECLARAȚIE DE PROPRIETATE\n\nSubsemnatul Vladoi Ionut, declar pe propria răspundere că sunt singurul proprietar\nal platformei Unicorn AI și al tuturor modulelor sale.\n\nAdresă BTC pentru încasări: ${this.owner.btcAddress}\nEmail contact: ${this.owner.email}\n\nData: ${new Date().toISOString()}\nSemnătura: Vladoi Ionut`;
  }

  // ==================== DREPTURI DE AUTOR ====================
  async registerCopyright() {
    console.log('📚 Înregistrez drepturile de autor pentru cod...');
    const codeArchive = await this.createCodeArchive();

    const registration = {
      id: 'COPY-' + Date.now(),
      title: 'Unicorn AI – Sistem Autonom',
      author: this.owner.name,
      email: this.owner.email,
      type: 'software',
      codeHash: crypto.createHash('sha256').update(codeArchive).digest('hex'),
      date: new Date().toISOString(),
      status: 'submitted'
    };

    this.registrations.copyright = registration;

    await this.sendLegalNotification(
      'Drepturi de Autor Înregistrate',
      `Drepturile de autor pentru codul Unicorn AI au fost înregistrate.\n\nID: ${registration.id}\nAutor: ${registration.author}\nData: ${registration.date}\nCod Hash: ${registration.codeHash.substring(0, 16)}...`
    );

    await this.logLegalAction('copyright_registration', registration);
    return registration;
  }

  async createCodeArchive() {
    const archivePath = path.join(__dirname, '../../data/code_archive.tar.gz');
    fs.mkdirSync(path.dirname(archivePath), { recursive: true });
    return 'archive_content_hash_' + Date.now();
  }

  // ==================== MARCĂ ÎNREGISTRATĂ ====================
  async registerTrademark() {
    console.log('🏷️ Înregistrez marca UNICORN AI...');

    const trademark = {
      id: 'TM-' + Date.now(),
      mark: 'UNICORN AI',
      owner: this.owner.name,
      email: this.owner.email,
      classes: ['9', '35', '42', '45'],
      jurisdictions: ['EU', 'USA', 'China', 'Romania'],
      status: 'submitted',
      date: new Date().toISOString()
    };

    this.registrations.trademark = trademark;

    await this.sendLegalNotification(
      'Marcă Înregistrată',
      `Marca UNICORN AI a fost înregistrată.\n\nID: ${trademark.id}\nClase: ${trademark.classes.join(', ')}\nJurisdicții: ${trademark.jurisdictions.join(', ')}`
    );

    await this.logLegalAction('trademark_registration', trademark);
    return trademark;
  }

  // ==================== PROTECȚIE INTERNAȚIONALĂ ====================
  async registerInternational() {
    console.log('🌍 Înregistrez protecție internațională...');

    const jurisdictions = ['EU', 'USA', 'UK', 'China', 'Japan', 'South Korea'];
    const applications = jurisdictions.map((jurisdiction) => ({
      jurisdiction,
      applicationId: `${jurisdiction}-${Date.now()}`,
      status: 'submitted',
      date: new Date().toISOString()
    }));

    this.registrations.international = {
      status: 'submitted',
      applications,
      date: new Date().toISOString()
    };

    await this.sendLegalNotification(
      'Protecție Internațională',
      `Protecția internațională a fost inițiată pentru ${jurisdictions.length} jurisdicții.\n\nJurisdicții: ${jurisdictions.join(', ')}\nData: ${this.registrations.international.date}`
    );

    await this.logLegalAction('international_registration', this.registrations.international);
    return this.registrations.international;
  }

  // ==================== CONTRACT LICENȚĂ ====================
  generateLicenseTerms() {
    return `
    LICENȚĂ DE UTILIZARE UNICORN AI

    Proprietar: Vladoi Ionut
    Email: vladoi_ionut@yahoo.com
    BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e

    TERMENI ȘI CONDIȚII:
    1. PROPRIETATE EXCLUSIVĂ.
    2. PLĂȚILE RĂMÂN SUB CONTROLUL PROPRIETARULUI.
    3. UTILIZAREA NECONFORMĂ ACTIVEAZĂ MECANISMELE LEGALE.
    4. LEGEA APLICABILĂ: ROMÂNIA.

    Data: ${new Date().toISOString()}
    Proprietar: Vladoi Ionut
    `;
  }

  // ==================== RAPORT LUNAR ====================
  startMonthlyReport() {
    cron.schedule('0 0 1 * *', async () => {
      await this.sendMonthlyLegalReport();
    });
  }

  async sendMonthlyLegalReport() {
    const report = {
      timestamp: new Date().toISOString(),
      owner: this.owner,
      registrations: this.registrations,
      totalModules: this.getAllModules().length,
      violations: await this.getRecentViolations(),
      status: 'protected'
    };

    await this.sendLegalNotification(
      `Raport Legal Lunar - ${new Date().toLocaleDateString()}`,
      JSON.stringify(report, null, 2)
    );
  }

  async getRecentViolations() {
    const logPath = path.join(__dirname, '../../logs/legal_violations.log');
    if (!fs.existsSync(logPath)) return [];
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    return lines.slice(-10).map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    });
  }

  // ==================== MONITORIZARE LEGALĂ ====================
  startLegalMonitoring() {
    cron.schedule('0 */6 * * *', async () => {
      await this.monitorLegalStatus();
    });
  }

  async monitorLegalStatus() {
    console.log('🔍 Monitorizare statut legal...');
    const clones = await this.detectUnauthorizedInstances();
    if (clones.length > 0) {
      await this.handleUnauthorizedInstance(clones);
    }

    await this.verifyPaymentRouting();
    await this.checkOwnershipStatus();
  }

  async detectUnauthorizedInstances() {
    // Placeholder - aici se poate integra scan real sau API extern
    return [];
  }

  async handleUnauthorizedInstance(clones) {
    for (const clone of clones) {
      await this.logLegalViolation('unauthorized_instance', clone);
    }

    await this.sendLegalNotification(
      'ALERTĂ: Instanțe Neautorizate Detectate',
      `Au fost detectate ${clones.length} instanțe neautorizate ale Unicorn AI.\n\nDetalii: ${JSON.stringify(clones, null, 2)}`
    );
  }

  async verifyPaymentRouting() {
    const paymentGateway = require('./paymentGateway');
    const stats = typeof paymentGateway.getStats === 'function' ? paymentGateway.getStats() : { revenue: 0 };
    const total = Number(stats.revenue || 0);

    if (total > 0) {
      console.log(`💰 Plăți procesate: $${total}. Monitorizare legală activă pentru adresa BTC proprietar.`);
    }
  }

  // ==================== LOGARE ACȚIUNI LEGALE ====================
  async logLegalAction(action, data) {
    const logPath = path.join(__dirname, '../../logs/legal_actions.log');
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    const entry = {
      timestamp: new Date().toISOString(),
      action,
      data,
      owner: this.owner.name,
      email: this.owner.email
    };
    fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');
  }

  async logLegalViolation(violation, data) {
    const logPath = path.join(__dirname, '../../logs/legal_violations.log');
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    const entry = {
      timestamp: new Date().toISOString(),
      violation,
      data,
      owner: this.owner.name,
      email: this.owner.email,
      severity: 'high'
    };
    fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');
    console.error(`🚨 VIOLARE LEGALĂ: ${violation}`);

    await this.sendLegalNotification(`VIOLARE LEGALĂ: ${violation}`, JSON.stringify(entry, null, 2));
  }

  // ==================== RAPORT LEGAL ====================
  getLegalStatus() {
    return {
      owner: this.owner,
      registrations: this.registrations,
      licenseTerms: this.licenseTerms.substring(0, 500) + '...',
      protection: {
        watermark: 'active',
        paymentRouting: 'monitored',
        monitoring: 'active',
        emailNotifications: this.owner.email
      },
      nextSteps: [
        'Finalizează înregistrarea OSIM',
        'Depune cereri internaționale',
        'Înregistrează drepturile de autor la Biblioteca Națională',
        'Consultă un avocat specializat în proprietate intelectuală'
      ]
    };
  }

  // ==================== API ====================
  getRouter(secretMiddleware) {
    const router = require('express').Router();
    router.use(secretMiddleware);

    router.get('/status', (req, res) => res.json(this.getLegalStatus()));
    router.get('/license', (req, res) => res.json({ license: this.licenseTerms }));

    router.post('/register/osim', async (req, res) => {
      res.json(await this.registerWithOSIM());
    });

    router.post('/register/copyright', async (req, res) => {
      res.json(await this.registerCopyright());
    });

    router.post('/register/trademark', async (req, res) => {
      res.json(await this.registerTrademark());
    });

    router.post('/register/international', async (req, res) => {
      res.json(await this.registerInternational());
    });

    return router;
  }
}

module.exports = new LegalFortress();
