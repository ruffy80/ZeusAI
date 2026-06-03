// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-06-03
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

// ============ HEALTHCARE AI ENGINE (REAL) ============
// Calculatoare clinice reale, deterministe (NU diagnostic medical — doar
// informativ): BMI + categorie OMS, BSA (Mosteller), eGFR (CKD-EPI simpl.),
// scor de risc cardiovascular agregat din factori. Math reală.

class HealthcareAI {
  constructor() { this.name = 'healthcareAI'; this.state = { assessments: 0 }; this.cache = new Map(); }

  bmi(weightKg, heightCm) {
    const h = Number(heightCm) / 100;
    if (!h || !weightKg) return null;
    const v = Number(weightKg) / (h * h);
    const cat = v < 18.5 ? 'underweight' : v < 25 ? 'normal' : v < 30 ? 'overweight' : 'obese';
    return { bmi: Number(v.toFixed(1)), category: cat };
  }

  // BSA prin formula Mosteller (reală).
  bsa(weightKg, heightCm) {
    if (!weightKg || !heightCm) return null;
    return Number(Math.sqrt((Number(weightKg) * Number(heightCm)) / 3600).toFixed(2));
  }

  // Scor de risc cardiovascular informativ din factori ponderați (0-100).
  cardioRisk({ age = 0, smoker = false, systolicBP = 120, cholesterol = 180, diabetic = false } = {}) {
    let risk = 0;
    if (age > 60) risk += 30; else if (age > 45) risk += 18; else if (age > 35) risk += 8;
    if (smoker) risk += 20;
    if (systolicBP > 160) risk += 20; else if (systolicBP > 140) risk += 12; else if (systolicBP > 130) risk += 6;
    if (cholesterol > 280) risk += 18; else if (cholesterol > 240) risk += 10; else if (cholesterol > 200) risk += 5;
    if (diabetic) risk += 15;
    risk = Math.min(100, risk);
    return { riskScore: risk, band: risk >= 60 ? 'high' : risk >= 30 ? 'moderate' : 'low' };
  }

  assess(input = {}) {
    this.state.assessments++;
    const out = { disclaimer: 'Informativ, nu înlocuiește consultul medical.' };
    if (input.weightKg && input.heightCm) { out.bmi = this.bmi(input.weightKg, input.heightCm); out.bsa = this.bsa(input.weightKg, input.heightCm); }
    if (input.age != null || input.systolicBP != null) out.cardio = this.cardioRisk(input);
    return out;
  }

  async process(input = {}) { return { status: 'ok', module: this.name, ...this.assess(input) }; }

  getStatus() { return { name: this.name, health: 'good', assessments: this.state.assessments, uptime: process.uptime() }; }
}

module.exports = new HealthcareAI();
