// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================
//
// ZACC — Curated physical-product catalogue.
// RO: catalog premium de SKU-uri fizice reale (arhetipuri), cu costuri și
// margini realiste din date publice. Folosit ca sursă "zeus-curated" când
// nu sunt configurate chei de furnizor (CJ/AliExpress). Fiecare produs este
// marcat demoOnly:true și supplier:'manual' — nu se rutează automat către un
// furnizor real fără un supplierRef explicit. Determinist, fără dependențe.

'use strict';

const { slug } = require('./util');

// picsum.photos serves stable placeholder imagery keyed by seed so the
// storefront looks like a real shop before any live source is connected.
function img(name) {
  return 'https://picsum.photos/seed/' + slug(name) + '/640/480';
}

// 24 premium physical SKUs across electronics, home, fitness, beauty, pets and
// outdoor. Costs/shipping mirror realistic supplier landed costs; margins are
// left to the ProfitMaximizer (markup + fees) downstream.
const RAW = [
  // --- electronics ---
  { name: 'Wireless Charging Stand 15W Dual Coil', category: 'electronics', costUsd: 8.4, shippingUsd: 3.2, rating: 4.6, reviews: 5210, weightKg: 0.28 },
  { name: 'Bluetooth 5.3 ANC Earbuds Pro', category: 'electronics', costUsd: 13.5, shippingUsd: 2.9, rating: 4.5, reviews: 9840, weightKg: 0.12 },
  { name: 'Portable 1080p Mini Projector', category: 'electronics', costUsd: 44.0, shippingUsd: 7.8, rating: 4.4, reviews: 3120, weightKg: 0.9 },
  { name: 'GaN 65W USB-C Fast Charger', category: 'electronics', costUsd: 9.8, shippingUsd: 2.6, rating: 4.7, reviews: 6410, weightKg: 0.15 },

  // --- home ---
  { name: 'Smart WiFi LED Strip 5m RGBIC', category: 'home', costUsd: 8.1, shippingUsd: 3.4, rating: 4.7, reviews: 12870, weightKg: 0.35 },
  { name: 'Ultrasonic Aroma Diffuser Wood Grain', category: 'home', costUsd: 5.9, shippingUsd: 3.1, rating: 4.6, reviews: 9450, weightKg: 0.42 },
  { name: 'Robot Window Cleaner Cordless', category: 'home', costUsd: 52.0, shippingUsd: 9.5, rating: 4.3, reviews: 1980, weightKg: 1.3 },
  { name: 'Cordless Handheld Vacuum 12000Pa', category: 'home', costUsd: 21.5, shippingUsd: 6.2, rating: 4.5, reviews: 4360, weightKg: 0.7 },

  // --- fitness ---
  { name: 'Resistance Bands Set Pro 11pc', category: 'fitness', costUsd: 4.6, shippingUsd: 2.6, rating: 4.6, reviews: 7320, weightKg: 0.55 },
  { name: 'Adjustable Dumbbell 24kg Single', category: 'fitness', costUsd: 34.0, shippingUsd: 11.0, rating: 4.7, reviews: 2540, weightKg: 6.2 },
  { name: 'Smart Jump Rope with Counter', category: 'fitness', costUsd: 5.2, shippingUsd: 2.4, rating: 4.5, reviews: 8110, weightKg: 0.2 },
  { name: 'Massage Gun Deep Tissue 6-Head', category: 'fitness', costUsd: 18.9, shippingUsd: 5.4, rating: 4.6, reviews: 6890, weightKg: 0.85 },

  // --- beauty ---
  { name: 'Ionic Hair Dryer Brush 3-in-1', category: 'beauty', costUsd: 11.2, shippingUsd: 4.1, rating: 4.5, reviews: 10230, weightKg: 0.6 },
  { name: 'LED Red-Light Therapy Face Mask', category: 'beauty', costUsd: 16.7, shippingUsd: 4.8, rating: 4.4, reviews: 3480, weightKg: 0.45 },
  { name: 'Microneedle Derma Roller Kit', category: 'beauty', costUsd: 4.3, shippingUsd: 2.3, rating: 4.4, reviews: 5780, weightKg: 0.1 },
  { name: 'Rechargeable Nail Drill Set', category: 'beauty', costUsd: 7.6, shippingUsd: 3.0, rating: 4.5, reviews: 4120, weightKg: 0.3 },

  // --- pets ---
  { name: 'Self-Cleaning Slicker Pet Brush', category: 'pets', costUsd: 3.3, shippingUsd: 2.1, rating: 4.6, reviews: 11200, weightKg: 0.18 },
  { name: 'Automatic Pet Water Fountain 2.5L', category: 'pets', costUsd: 9.4, shippingUsd: 4.6, rating: 4.5, reviews: 7640, weightKg: 0.65 },
  { name: 'Interactive Cat Laser Toy Auto', category: 'pets', costUsd: 6.1, shippingUsd: 2.8, rating: 4.4, reviews: 5230, weightKg: 0.25 },
  { name: 'No-Pull Reflective Dog Harness', category: 'pets', costUsd: 5.5, shippingUsd: 3.0, rating: 4.7, reviews: 9010, weightKg: 0.3 },

  // --- outdoor ---
  { name: 'Insulated Stainless Water Bottle 1L', category: 'outdoor', costUsd: 6.8, shippingUsd: 4.0, rating: 4.7, reviews: 8320, weightKg: 0.5 },
  { name: 'Solar Power Bank 26800mAh Rugged', category: 'outdoor', costUsd: 15.9, shippingUsd: 5.1, rating: 4.4, reviews: 4670, weightKg: 0.62 },
  { name: 'Ultralight Backpacking Tent 2-Person', category: 'outdoor', costUsd: 38.5, shippingUsd: 10.5, rating: 4.6, reviews: 2210, weightKg: 1.9 },
  { name: 'LED Camping Lantern Rechargeable', category: 'outdoor', costUsd: 7.2, shippingUsd: 3.3, rating: 4.6, reviews: 6540, weightKg: 0.34 },
];

// Fully-shaped curated product records. Frozen so downstream mutation (e.g.
// scraper price drift) always clones instead of corrupting the source list.
const CURATED_PRODUCTS = RAW.map((p) => Object.freeze({
  name: p.name,
  category: p.category,
  costUsd: p.costUsd,
  shippingUsd: p.shippingUsd,
  rating: p.rating,
  reviews: p.reviews,
  image: img(p.name),
  source: 'zeus-curated',
  supplier: 'manual',
  supplierRef: null,
  weightKg: p.weightKg,
  originCountry: 'CN',
  demoOnly: true,
}));

// Return a shallow-cloned array so callers can safely enrich/mutate items.
function getCuratedCatalog() {
  return CURATED_PRODUCTS.map((p) => Object.assign({}, p));
}

module.exports = { CURATED_PRODUCTS, getCuratedCatalog };
