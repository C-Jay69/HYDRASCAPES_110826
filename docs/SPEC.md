# Hydrascapes Build Specification v5 (Authoritative Build Spec)

## Architecture Overview
Hydrascapes is a co-hosting marketplace connecting Property Owners, Co-Hosts, Guests, and Admins.
Built on Next.js / React + TypeScript + Express Server + Gemini AI + Stripe Connect + n8n automation.

### Non-Negotiable Architectural Invariants
1. **Vision is a Core Product Capability**: Multimodal vision re-analyzes property photos asynchronously without blocking normal save operations.
2. **AI Does Not Control Money**: All financial arithmetic is performed in integer minor currency units (cents) by TypeScript. AI models return bounded advisory multipliers.
3. **Structured AI Outputs are Validated**: Every model output passes strict Zod schemas (`VisionAnalysisSchema`, `HostMatchSchema`, `PricingRefinementSchema`, `DisputeAssessmentSchema`).
4. **Model-Agnostic Architecture**: Gemini model identifiers are configuration parameters, not hardcoded business logic.
5. **Trust-First Architecture**: Idempotent payment operations, double-booking PostgreSQL GiST exclusion checks, dispute payout freezes, audit logging.
