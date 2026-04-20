# ZeusAI / Unicorn — New Site Architecture

> **Owner:** Vladoi Ionut — vladoi_ionut@yahoo.com  
> **BTC:** bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e  
> **Status:** Active Implementation — PR #1 (Architecture + Core Pages)

---

## 1. Executive Summary

The new Unicorn site is a complete, world-class web platform built on top of the existing React client (`UNICORN_FINAL/client/`) and powered by the Express backend (`UNICORN_FINAL/backend/`). It integrates every backend module — payments, marketplace, tenant management, AI orchestration, security, and evolution — into a seamless, conversion-optimised, mobile-first UI.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 18 + React Router v6 |
| Styling | Tailwind CSS v3 + custom CSS variables |
| Animation | Framer Motion v11 |
| 3D / Visuals | Three.js + @react-three/fiber |
| HTTP client | Axios |
| Auth | JWT (localStorage) |
| State | React context + local component state |
| Payments | Stripe, PayPal, BTC, ETH, bank (via backend) |
| Backend | Express.js + SQLite (db.js) |
| AI | OpenAI, Anthropic, DeepSeek, Gemini, Mistral, Cohere, xAI |
| Deployment | Hetzner VPS via PM2 + Nginx |

---

## 3. Site Pages & Routes

### 3.1 Public Marketing Pages

| Route | Component | Purpose |
|---|---|---|
| `/` | `Home` | Hero, big promise, features, social proof, CTA |
| `/services` | `Services` | All Unicorn services structured by category |
| `/pricing` | `Pricing` | Plans (Free / Starter / Pro / Enterprise), upsell |
| `/how-it-works` | `HowItWorks` | Step-by-step feature walkthrough |
| `/about` | `About` | Trust, team, mission, BTC ownership |
| `/legal/terms` | `Terms` | Terms of Service |
| `/legal/privacy` | `Privacy` | Privacy Policy + GDPR |
| `/legal/cookies` | `Cookies` | Cookie Policy |

### 3.2 Authentication

| Route | Component |
|---|---|
| `/login` | `Login` |
| `/register` | `Register` |
| `/verify-email` | `VerifyEmail` |
| `/reset-password` | `ResetPassword` |

### 3.3 Client Portal (auth-gated)

| Route | Component |
|---|---|
| `/dashboard` | `ClientDashboard` — overview KPIs |
| `/dashboard/services` | Purchased services + status |
| `/dashboard/billing` | Invoices + payment history |
| `/dashboard/profile` | `Profile` — account settings |

### 3.4 Checkout Flow

| Route | Component |
|---|---|
| `/checkout` | Step 1 — select service |
| `/checkout/configure` | Step 2 — configure options |
| `/checkout/pay` | Step 3 — payment method + confirm |
| `/checkout/success` | Step 4 — success + onboarding |

### 3.5 Innovation / Advanced Modules

| Route | Component |
|---|---|
| `/innovation` | `InnovationCommandCenter` |
| `/innovation/blockchain` | `QuantumBlockchainPage` |
| `/innovation/workforce` | `AIWorkforcePage` |
| `/innovation/ma` | `MAAdvisorPage` |
| `/innovation/legal` | `LegalContractsPage` |
| `/innovation/energy` | `EnergyGridPage` |
| `/marketplace` | `Marketplace` |

### 3.6 Enterprise Verticals

| Route | Component |
|---|---|
| `/enterprise` | `EnterpriseHub` |
| `/enterprise/aviation` | `AviationOps` |
| `/enterprise/government` | `GovernmentOps` |
| `/enterprise/defense` | `DefenseOps` |
| `/enterprise/telecom` | `TelecomOps` |
| `/enterprise/partners` | `PartnerHub` |

### 3.7 Admin (password-gated)

| Route | Component |
|---|---|
| `/admin/login` | `AdminLogin` |
| `/admin/dashboard` | `AdminDashboard` |
| `/admin/wealth` | `AdminWealth` |
| `/admin/bd` | `AdminBD` |
| `/executive` | `ExecutiveDashboard` |
| `/unicorn-lab` | `UnicornLab` |

---

## 4. Design System

### 4.1 Colour Tokens

```css
--color-bg:         #05060e       /* deep space */
--color-surface:    #0a0e24       /* card background */
--color-border:     rgba(0,200,255,.18)
--color-primary:    #00d4ff       /* electric cyan */
--color-secondary:  #c084fc       /* quantum purple */
--color-accent:     #00ffa3       /* neon green */
--color-text:       #e8f4ff
--color-muted:      #7090b0
--color-danger:     #ff6060
--color-warning:    #facc15
```

### 4.2 Typography

- **Display / headings:** `Orbitron` (Google Fonts) — 900/700/400
- **Body / UI:** `Rajdhani` (Google Fonts) — 700/600/400
- **Monospace / code:** system monospace

### 4.3 Spacing Scale

Uses Tailwind defaults: `4px` base unit.

### 4.4 Component Library

| Component | File | Purpose |
|---|---|---|
| `HolographicCard` | `components/HolographicCard.jsx` | Glassmorphic card with glow |
| `NeonPulseButton` | `components/NeonPulseButton.jsx` | Animated CTA button |
| `QuantumLoader` | `components/QuantumLoader.jsx` | Loading overlay |
| `ScrollReveal` | `components/ScrollReveal.jsx` | Entrance animation wrapper |
| `ParticlesBackground3D` | `components/ParticlesBackground3D.jsx` | Animated particle canvas |
| `Chatbot` | `components/Chatbot.jsx` | AI chat widget |
| `PaymentModal` | `components/PaymentModal.jsx` | Multi-method payment modal |
| `AnimatedDataStream` | `components/AnimatedDataStream.jsx` | Live metrics chart |
| `ZEUS3D` | `components/ZEUS3D.jsx` | 3D Zeus avatar |
| `PricingCard` | `components/PricingCard.jsx` | *(new)* Pricing plan card |
| `ServiceCard` | `components/ServiceCard.jsx` | *(new)* Service listing card |
| `FeatureGrid` | `components/FeatureGrid.jsx` | *(new)* Features section |
| `TestimonialSlider` | `components/TestimonialSlider.jsx` | *(new)* Social proof slider |
| `StatsBar` | `components/StatsBar.jsx` | *(new)* Animated stat counters |
| `CheckoutStepper` | `components/CheckoutStepper.jsx` | *(new)* Multi-step checkout |
| `SEOMeta` | `components/SEOMeta.jsx` | *(new)* Head meta tags |

---

## 5. Backend API Integration Map

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/verify-email`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET  /api/auth/me`

### Payments
- `GET  /api/payment/stats`
- `GET  /api/payment/history`
- `GET  /api/payment/btc-rate`
- `POST /api/payment/create`
- `GET  /api/payment/:txId`
- Webhooks: `/api/payment/webhook/stripe`, `/api/payment/webhook/paypal`

### Marketplace
- `GET  /api/marketplace/services`
- `GET  /api/marketplace/categories`
- `GET  /api/marketplace/stats`
- `POST /api/marketplace/price`
- `POST /api/marketplace/purchase`
- `GET  /api/marketplace/purchases/:clientId`
- `GET  /api/marketplace/recommendations/:clientId`

### AI
- `POST /api/ai/chat`
- `POST /api/ai/dispatch`
- `POST /api/ai/dispatch/batch`
- `GET  /api/ai/dispatch/status`

### Multi-Tenant SaaS
- `GET/POST /api/saas/plans`
- `GET/POST /api/saas/tenants`
- `GET/POST /api/saas/billing`
- `/api/tenant/*` — tenant management
- `/api/me/*` — per-tenant self-service

### Innovation / Modules
- `GET /api/innovation/insights`
- `GET /api/evolution/status`
- `GET /api/orchestrator/v4/status`
- `GET /health`
- `GET /snapshot`

---

## 6. Checkout Flow

```
1. /checkout
   → Browse services (from /api/marketplace/services)
   → Select plan/service

2. /checkout/configure
   → Choose billing period (monthly/annual)
   → Add-ons / options
   → Promo code

3. /checkout/pay
   → PaymentModal (Stripe / PayPal / BTC / ETH / bank)
   → POST /api/payment/create
   → POST /api/marketplace/purchase

4. /checkout/success
   → Confirmation + invoice
   → Onboarding next steps
   → Redirect to /dashboard
```

---

## 7. SEO Strategy

- `<title>` and `<meta name="description">` on every page via `SEOMeta` component
- Open Graph tags: `og:title`, `og:description`, `og:image`, `og:url`
- Twitter Card tags
- Canonical URLs
- Structured data (JSON-LD): Organization, Product, Service, BreadcrumbList
- `robots.txt` — allow all
- `sitemap.xml` — all public routes

---

## 8. Performance Plan

- **Code splitting:** `React.lazy()` + `Suspense` on heavy pages
- **Images:** Use `loading="lazy"` on all images
- **Fonts:** `font-display: swap` — preloaded in `<head>`
- **Critical CSS:** inlined in HTML template
- **Route caching:** backend `route-cache` module already active
- **Compression:** `compression` middleware already active in Express

---

## 9. Security Integration

- Helmet CSP already configured in backend
- JWT auth with plan-based feature gating
- Admin routes protected by `adminTokenMiddleware`
- QuantumVault for secrets (no hardcoded keys)
- Input sanitization middleware on all POST bodies
- Rate limiting: global (200 req/min), auth (10 req/15min), admin (60 req/min)

---

## 10. Implementation Milestones

| PR | Title | Contents |
|---|---|---|
| **#1** (this) | Architecture + Core Pages | architecture.md, new Home, Pricing, Services, About, Legal, SEO |
| #2 | Design System | PricingCard, ServiceCard, FeatureGrid, StatsBar, TestimonialSlider, SEOMeta |
| #3 | Checkout Flow | CheckoutStepper, multi-step pages, success confirmation |
| #4 | Client Portal | Improved Dashboard, billing view, profile |
| #5 | Optimisation | Lazy loading, meta tags, robots.txt, sitemap.xml |

---

*Generated by ZeusAI Copilot Agent — 2026-04-20*
