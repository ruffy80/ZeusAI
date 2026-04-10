// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T20:26:26.903Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:17:59.231Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:15:25.090Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:14:20.603Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:10:41.144Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:01:10.445Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:58:03.197Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:53:47.285Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:53:01.147Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:52:08.799Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:51:01.987Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

class AviationModule {
  constructor() {
    this.cache = new Map(); this.cacheTTL = 60000; 
    this.airlines = new Map();
    this.routes = new Map();
    this.fleet = new Map();
  }

  optimizeRoutes(airlineId, params = {}) {
    const demand = Array.isArray(params.demandForecast) ? params.demandForecast : [];
    const currentRoutes = Array.isArray(params.currentRoutes) ? params.currentRoutes : [];
    const fuelCostIndex = Number(params.fuelCostIndex || 1);
    const slotPressure = Number(params.slotPressure || 0.4);

    const optimizedRoutes = currentRoutes.map((route, index) => {
      const demandFactor = Number(demand[index]?.demand || route.demand || 0.6);
      const utilization = Math.min(0.98, 0.55 + demandFactor * 0.35);
      const recommendedFrequency = Math.max(1, Math.round((route.frequency || 7) * (0.8 + demandFactor * 0.5)));
      const estimatedMargin = Number((((route.avgFare || 240) * utilization) - (route.costPerFlight || 140)).toFixed(2));
      return {
        routeId: route.routeId || route.id || 'route_' + index,
        origin: route.origin || 'HUB',
        destination: route.destination || 'DEST',
        utilization,
        recommendedFrequency,
        estimatedMargin,
        action: utilization < 0.65 ? 'consolidate' : utilization > 0.88 ? 'expand' : 'optimize',
        slotRecommendation: slotPressure > 0.7 ? 'prioritize premium windows' : 'maintain slot allocation'
      };
    });

    const estimatedSavings = Math.round((optimizedRoutes.length || 3) * 2500000 * (2 - fuelCostIndex + slotPressure));
    const result = {
      airlineId,
      optimizedRoutes,
      estimatedSavings: Math.max(500000, estimatedSavings),
      generatedAt: new Date().toISOString()
    };

    if (airlineId) this.airlines.set(airlineId, result);
    return result;
  }

  predictiveMaintenance(fleetData = {}) {
    const aircraft = Array.isArray(fleetData.aircraft) ? fleetData.aircraft : [];
    const alerts = aircraft
      .filter((item) => Number(item.engineHealth || 1) < 0.78 || Number(item.cyclesSinceMaintenance || 0) > 850)
      .map((item) => ({
        aircraftId: item.id,
        severity: Number(item.engineHealth || 1) < 0.6 ? 'critical' : 'medium',
        reason: Number(item.engineHealth || 1) < 0.78 ? 'engine degradation' : 'maintenance cycle threshold exceeded'
      }));

    return {
      alerts,
      nextMaintenance: fleetData.nextMaintenance || '2026-04-15',
      savings: alerts.length ? 5000000 - alerts.length * 250000 : 5000000,
      fleetHealthScore: Number((1 - alerts.length / ((aircraft.length || 1) * 5)).toFixed(2))
    };
  }

  optimizeTicketPrices(route = {}, demand = {}, competitors = []) {
    const demandIndex = Number(demand.current || demand.index || 0.72);
    const competitorAverage = competitors.length
      ? competitors.reduce((sum, item) => sum + Number(item.price || 0), 0) / competitors.length
      : Number(route.basePrice || 299);
    const recommendedPrice = Math.round((competitorAverage * (0.94 + demandIndex * 0.18)) * 100) / 100;

    return {
      route: route.routeId || route.name || 'standard-route',
      recommendedPrice,
      estimatedRevenue: Math.round(recommendedPrice * Number(route.monthlyPassengers || 85000)),
      demandIndex,
      competitorAverage: Math.round(competitorAverage * 100) / 100
    };
  }
}

module.exports = new AviationModule();
