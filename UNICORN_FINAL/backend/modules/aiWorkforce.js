// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T21:05:42.808Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T20:21:48.172Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T20:18:03.447Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:17:59.230Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:15:25.089Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:14:20.602Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:10:41.142Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:01:10.444Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:58:03.195Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:53:47.284Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:53:01.146Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:52:08.798Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:51:01.986Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

const crypto = require('crypto');

class AIWorkforceMarketplace {
  constructor() {
    this.cache = new Map(); this.cacheTTL = 60000; 
    this.agents = new Map();
    this.jobs = new Map();
    this.hirings = new Map();
    this.reviews = new Map();
  }

  registerAgent(agentData) {
    const { name, description, capabilities, pricePerHour, skills } = agentData;
    const agentId = crypto.randomBytes(8).toString('hex');
    const agent = {
      id: agentId,
      name,
      description,
      capabilities: capabilities || [],
      pricePerHour: Number(pricePerHour || 0),
      skills: skills || [],
      rating: 5.0,
      totalJobs: 0,
      successRate: 1.0,
      available: true,
      registeredAt: new Date().toISOString()
    };
    this.agents.set(agentId, agent);
    return agent;
  }

  postJob(jobData) {
    const { title, description, requiredCapabilities, budget, deadline, companyId } = jobData;
    const jobId = crypto.randomBytes(8).toString('hex');
    const job = {
      id: jobId,
      title,
      description,
      requiredCapabilities: requiredCapabilities || [],
      budget: Number(budget || 0),
      deadline,
      companyId,
      status: 'open',
      postedAt: new Date().toISOString(),
      applications: []
    };
    this.jobs.set(jobId, job);
    return job;
  }

  findBestAgents(jobId, limit = 5) {
    const job = this.jobs.get(jobId);
    if (!job) return [];

    const agents = Array.from(this.agents.values()).filter(a => a.available);
    const scored = agents.map(agent => ({ agent, score: this.calculateAgentScore(agent, job) }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => s.agent);
  }

  calculateAgentScore(agent, job) {
    const capabilityMatch = (job.requiredCapabilities || []).filter(c => (agent.capabilities || []).includes(c)).length;
    const capabilityScore = capabilityMatch / ((job.requiredCapabilities || []).length || 1);
    const ratingScore = Number(agent.rating || 0) / 5;
    const priceScore = Math.min(1, Number(job.budget || 0) / (Number(agent.pricePerHour || 1) || 1));
    const successScore = Number(agent.successRate || 0);
    return capabilityScore * 0.4 + ratingScore * 0.2 + priceScore * 0.2 + successScore * 0.2;
  }

  hireAgent(jobId, agentId, companyId) {
    const job = this.jobs.get(jobId);
    const agent = this.agents.get(agentId);
    if (!job || !agent) throw new Error('Job or agent not found');
    if (job.status !== 'open') throw new Error('Job already filled');

    const hiringId = crypto.randomBytes(8).toString('hex');
    const hiring = {
      id: hiringId,
      jobId,
      agentId,
      companyId,
      status: 'active',
      hiredAt: new Date().toISOString(),
      deliverables: []
    };

    job.status = 'in_progress';
    job.agentId = agentId;
    agent.totalJobs++;
    this.hirings.set(hiringId, hiring);
    return hiring;
  }

  completeJob(hiringId, deliverables) {
    const hiring = this.hirings.get(hiringId);
    if (!hiring) throw new Error('Hiring not found');
    const job = this.jobs.get(hiring.jobId);
    const agent = this.agents.get(hiring.agentId);

    hiring.status = 'completed';
    hiring.deliverables = deliverables || [];
    hiring.completedAt = new Date().toISOString();
    job.status = 'completed';
    agent.successRate = (agent.successRate * (agent.totalJobs - 1) + 1) / agent.totalJobs;
    return hiring;
  }

  addReview(agentId, rating, comment, reviewerId) {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error('Agent not found');

    const review = {
      id: crypto.randomBytes(8).toString('hex'),
      agentId,
      rating: Number(rating || 0),
      comment,
      reviewerId,
      timestamp: new Date().toISOString()
    };

    if (!this.reviews.has(agentId)) this.reviews.set(agentId, []);
    this.reviews.get(agentId).push(review);

    const reviews = this.reviews.get(agentId);
    agent.rating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    return review;
  }

  getStats() {
    return {
      totalAgents: this.agents.size,
      totalJobs: this.jobs.size,
      activeHirings: Array.from(this.hirings.values()).filter(h => h.status === 'active').length,
      averageAgentRating: Array.from(this.agents.values()).reduce((sum, a) => sum + a.rating, 0) / (this.agents.size || 1)
    };
  }
}

module.exports = new AIWorkforceMarketplace();
