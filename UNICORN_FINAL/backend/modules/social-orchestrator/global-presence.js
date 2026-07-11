// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-07-10T14:57:37.346Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

/**
 * Global Presence Engine
 * Manages worldwide CDN, edge deployment, multi-region API endpoints, and sub-100ms latency
 * Enables ZeusAI social network to be instantly accessible everywhere
 */

class GlobalPresence {
  constructor(opts = {}) {
    this.regions = {
      'us-east': { latency: 15, endpoint: 'https://api-us-e.zeusai.pro', users: 0, active: true },
      'eu-west': { latency: 20, endpoint: 'https://api-eu-w.zeusai.pro', users: 0, active: true },
      'asia-sg': { latency: 25, endpoint: 'https://api-asia-sg.zeusai.pro', users: 0, active: true },
      'asia-jp': { latency: 28, endpoint: 'https://api-asia-jp.zeusai.pro', users: 0, active: true },
      'asia-in': { latency: 32, endpoint: 'https://api-asia-in.zeusai.pro', users: 0, active: true },
      'latam-br': { latency: 35, endpoint: 'https://api-latam-br.zeusai.pro', users: 0, active: true },
      'africa-ng': { latency: 40, endpoint: 'https://api-africa-ng.zeusai.pro', users: 0, active: true },
      'mena-ae': { latency: 30, endpoint: 'https://api-mena-ae.zeusai.pro', users: 0, active: true },
    };

    this.capabilities = {
      cdn: {
        provider: 'cloudflare',
        edgeLocations: 200,
        cacheLayers: 3,
        strategy: 'smart-ttl-by-content-type',
      },
      geo: {
        routingMode: 'latency-optimized',
        fallbackChain: true,
        healthCheckIntervalSec: 30,
      },
      feed: {
        maxCacheTTL: 15, // seconds - real-time but cached
        feedSize: 100,
        streamStrategy: 'continuous-push',
      },
      protocol: {
        supported: ['http2', 'http3-quic', 'websocket-multiplex'],
        compression: 'brotli-dynamic',
        headerOptimization: true,
      },
    };

    this.metrics = {
      globalQps: 0,
      avgLatencyMs: 0,
      p99LatencyMs: 0,
      activeRegions: Object.keys(this.regions).length,
      cacheHitRate: 0,
    };

    this.lastHealthCheck = null;
  }

  /**
   * Route user to closest/healthiest region
   */
  routeToOptimalRegion(userLocation = {}) {
    const { lat = 0, lng = 0 } = userLocation;

    // Simple distance approximation
    const distToRegion = (r) => {
      const regions = {
        'us-east': { lat: 40, lng: -74 },
        'eu-west': { lat: 48, lng: 2 },
        'asia-sg': { lat: 1, lng: 104 },
        'asia-jp': { lat: 35, lng: 139 },
        'asia-in': { lat: 28, lng: 77 },
        'latam-br': { lat: -23, lng: -46 },
        'africa-ng': { lat: 6, lng: 3 },
        'mena-ae': { lat: 24, lng: 54 },
      };
      const pos = regions[r];
      if (!pos) return 1e6;
      const dlat = lat - pos.lat;
      const dlng = lng - pos.lng;
      return Math.sqrt(dlat * dlat + dlng * dlng);
    };

    const active = Object.entries(this.regions).filter(([_, r]) => r.active);
    if (!active.length) return this.regions['us-east'];

    const best = active.reduce((a, b) =>
      distToRegion(a[0]) < distToRegion(b[0]) ? a : b
    );

    return { region: best[0], ...best[1] };
  }

  /**
   * Generate CDN cache strategy headers
   */
  cacheHeaders(contentType = 'application/json') {
    const strategies = {
      'application/json': { ttl: 15, sMaxAge: 10, privacy: 'public' },
      'text/html': { ttl: 30, sMaxAge: 15, privacy: 'public' },
      'image/*': { ttl: 86400, sMaxAge: 43200, privacy: 'public' },
      'application/json+social-feed': { ttl: 8, sMaxAge: 5, privacy: 'public' },
      'application/json+social-timeline': { ttl: 12, sMaxAge: 8, privacy: 'public' },
    };

    const config = strategies[contentType] || strategies['application/json'];
    return {
      'cache-control': `public, max-age=${config.ttl}, s-maxage=${config.sMaxAge}`,
      'cdn-cache-control': `max-age=${config.ttl}`,
      'cf-cache-everything': 'true',
      'cf-cache-on-cookie': 'false',
      'vary': 'Accept-Encoding,Accept-Language',
    };
  }

  /**
   * Health check all regional endpoints
   */
  async healthCheckRegions() {
    const checks = [];
    for (const [region, config] of Object.entries(this.regions)) {
      try {
        const start = Date.now();
        const res = await Promise.race([
          fetch(`${config.endpoint}/health`, { method: 'HEAD', timeout: 5000 }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
        ]);
        const latency = Date.now() - start;
        const active = res.ok || res.status < 500;
        this.regions[region].latency = latency;
        this.regions[region].active = active;
        checks.push({ region, latency, active });
      } catch (e) {
        this.regions[region].active = false;
        checks.push({ region, error: String(e), active: false });
      }
    }

    const activeCount = checks.filter(c => c.active).length;
    const avgLatency = checks
      .filter(c => c.latency)
      .reduce((sum, c) => sum + c.latency, 0) / Math.max(1, checks.filter(c => c.latency).length);

    this.metrics.activeRegions = activeCount;
    this.metrics.avgLatencyMs = Math.round(avgLatency);
    this.lastHealthCheck = { ts: new Date().toISOString(), checks };

    return {
      ok: true,
      activeRegions: activeCount,
      avgLatencyMs: Math.round(avgLatency),
      checks,
    };
  }

  /**
   * Get deployment manifest for global rollout
   */
  getDeploymentManifest() {
    return {
      name: 'zeusai-social-global-v1',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      regions: Object.entries(this.regions).map(([k, v]) => ({
        id: k,
        endpoint: v.endpoint,
        latency: v.latency,
        active: v.active,
        capabilities: ['read', 'write', 'stream', 'cache'],
      })),
      infrastructure: {
        cdn: this.capabilities.cdn,
        globalLoadBalancer: {
          algorithm: 'latency-aware',
          healthCheckInterval: 30,
          failoverMode: 'automatic',
        },
        faultTolerance: {
          regionFailover: true,
          gracefulDegradation: true,
          circuitBreaker: true,
        },
      },
      sla: {
        uptime: '99.99%',
        p95Latency: 100,
        p99Latency: 250,
        globalAvgLatency: 50,
      },
    };
  }

  getStatus() {
    return {
      ok: true,
      ts: new Date().toISOString(),
      activeRegions: this.metrics.activeRegions,
      avgLatencyMs: this.metrics.avgLatencyMs,
      regionStatus: this.regions,
      lastHealthCheck: this.lastHealthCheck,
      capabilities: this.capabilities,
    };
  }
}

module.exports = GlobalPresence;
