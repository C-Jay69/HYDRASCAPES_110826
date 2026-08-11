# Nest — AI-Powered Co-Hosting Marketplace Platform

Nest is an enterprise co-hosting marketplace connecting Property Owners, Professional Co-Hosts, Guests, and Administrators. Built with Next.js/React, Express, Gemini 2.5/1.5 AI Multimodal Vision, Stripe Connect, and n8n Workflow Automations.

---

## 🌟 Key Features & Architecture

### 1. 👁️ AI Property Eye (Multimodal Vision)
- **Asynchronous Photo Analysis:** Evaluates property cover and listing photos using Gemini Multimodal Vision.
- **Scoring & Classification:** Computes condition scores (1–10), interior modernity, curb appeal, and assigns quality tiers (`Luxury`, `Premium`, `Standard`, `Economy`).
- **Guest Highlights & Red Flags:** Automatically extracts key selling highlights and identifies structural or aesthetic considerations.

### 2. 📈 Dynamic Pricing Engine with Reasoning Trace
- **Deterministic Baseline + AI Refinement:** Combines season, day-of-week, occupancy, and floor/ceiling boundaries with Gemini advisory multipliers.
- **Explainable Pricing Trace:** Displays exact line-item breakdowns for base rates, seasonal adjustments, and AI multipliers.

### 3. 🛡️ Trust-First Dispute Arbitrator & Payout Freezes
- **Comparative Inspection Evidence:** Compares guest check-in and check-out inspection photos side-by-side.
- **Automated Payout Lock:** Automatically freezes host/owner payouts upon dispute initiation.
- **AI Adjudication Advisory:** Generates itemized findings and recommended percentage settlement awards for admin review.

### 4. 🤝 Co-Host Matching Engine
- **KYC Verification Gate:** Integrates Stripe Identity verification requirements before hosts can submit proposals.
- **AI Compatibility Evaluation:** Scores co-host proposals against property needs and owner preferences.

### 5. ⚡ 10-Suite n8n Automation Workflows
- Full operational automation suite including booking confirmations, payout reconciliation, dispute freezes, host onboarding, and review triggers.

---

## 🛠️ Environment Configuration & API Keys

Rename `.env.example` to `.env` or set the environment variables in your deployment environment:

| Variable | Description |
| :--- | :--- |
| `GEMINI_API_KEY` | Server-side API Key for Gemini models (AI Property Eye & Pricing) |
| `STRIPE_SECRET_KEY` | Stripe Secret Key for payment intents & Connect transfers |
| `STRIPE_PUBLISHABLE_KEY` | Stripe Publishable Key for frontend checkout |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook Secret for idempotent payment reconciliation |
| `INTERNAL_API_TOKEN` | Machine-to-machine internal bearer token for n8n automation triggers |
| `APP_URL` | Base canonical application URL (e.g. `http://localhost:3000`) |

---

## 🚀 Local Setup & Development

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Start Dev Server:**
   ```bash
   npm run dev
   ```
   The dev server starts on `http://0.0.0.0:3000`.

3. **Build & Production Deployment:**
   ```bash
   npm run build
   npm start
   ```

---

## 🛡️ Security & Financial Compliance
- **Financial Arithmetic Invariant:** All currency arithmetic is strictly computed in integer minor units (cents) in TypeScript.
- **Idempotent Operations:** Payment requests use Stripe idempotency keys to prevent duplicate charges.
