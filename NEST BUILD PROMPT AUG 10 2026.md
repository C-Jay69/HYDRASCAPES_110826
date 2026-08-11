# ***NEST BUILD PROMPT AUG 10 2026***

NEST BUILD SPECIFICATION v5  
FINAL BUILD SPECIFICATION

Date: August 2026  
Status: Authoritative build specification  
Architecture: Next.js \+ TypeScript \+ Supabase \+ Tailwind \+ Stripe Connect \+ n8n  
AI: Vision-capable model through a provider abstraction  
Deployment philosophy: Free-tier-first, portable, auditable, production-oriented

This document is the single source of truth for the Nest application.

If implementation code conflicts with this specification, the implementation is considered incorrect unless this specification has first been deliberately amended and committed.

────────────────────────────────────────  
0\. BUILD MANIFESTO  
────────────────────────────────────────

Nest is a co-hosting marketplace.

Owners have properties but may not have time to manage them.

Hosts have time, local knowledge, and hospitality skills but may not own properties.

Guests need somewhere to stay.

Nest connects those groups while providing property analysis, identity verification, booking, pricing, payments, communication, reviews, and dispute support.

The following principles are non-negotiable.

1\. VISION IS A CORE PRODUCT CAPABILITY

Every property listing containing photographs must be eligible for automated multimodal analysis.

The analysis:

\- runs asynchronously after images change;  
\- never blocks the owner's normal save operation;  
\- is schema-validated;  
\- is versioned and auditable;  
\- contributes controlled signals to pricing;  
\- is visible to the owner;  
\- can provide clearly labelled AI-assessed highlights to guests;  
\- must never be presented as independently verified fact.

If vision processing fails, the property may still be listed unless another moderation rule prevents it.

2\. AI DOES NOT CONTROL MONEY

AI models must never calculate, authorize, transfer, refund, or release money.

For pricing, AI may return bounded classifications, multipliers, confidence and explanatory text.

TypeScript performs all financial arithmetic.

All pricing calculations must therefore be reproducible and unit-testable.

3\. ALL STRUCTURED AI OUTPUTS ARE VALIDATED

Every structured AI response must pass a Zod schema before application code can use it.

Never trust model-generated JSON directly.

Never access arbitrary model fields without schema validation.

Malformed responses must be retried or rejected safely.

4\. MODEL-AGNOSTIC ARCHITECTURE

No application feature may depend on a specific AI model name.

Model identifiers are configuration, not application logic.

Model identifiers may appear in:

\- environment/configuration files;  
\- deployment configuration;  
\- operational documentation;  
\- database audit records describing which model produced historical output.

They must not be embedded in business logic.

The provider layer must support capability detection and graceful failure.

Do not assume that a particular model will remain free, remain available, retain the same context window, or continue supporting vision.

5\. TRUST-FIRST ARCHITECTURE

Material actions require appropriate controls.

These include:

KYC for hosts.

Private storage for sensitive images.

RLS and server-side authorization.

Database constraints.

Stripe webhook verification.

Idempotent money operations.

Append-only audit history for material events.

Human oversight for disputes.

6\. FREE-TIER-FIRST, NOT “FREE FOREVER”

The MVP should preferentially use services with useful free tiers and open-source/self-hostable alternatives.

Never claim that the platform has zero infrastructure cost.

Possible costs include AI inference, payment processing, identity verification, email, hosting, database usage, storage, bandwidth, observability and third-party APIs.

Every external service must be documented in:

docs/COSTS.md

That file must explain:

service,  
free allowance if currently available,  
what causes charges,  
how to set usage alerts,  
and what happens if the service becomes unavailable.

7\. NO FAKE COMPLETENESS

Do not generate placeholder functionality simply to make the project appear finished.

No:

TODO implementations,  
fake APIs,  
fake payment success,  
empty admin pages,  
Lorem Ipsum,  
buttons that do nothing,  
or workflows that cannot run.

Development/demo content may use seeded data and properly licensed, owned or explicitly permitted demo imagery.

8\. BEGINNER-FRIENDLY DOCUMENTATION

Deployment documentation must assume the reader has never deployed a web application before.

Technical accuracy must not be sacrificed for simplicity.

9\. SECURITY OVER CONVENIENCE

Client-side controls are user experience, not security boundaries.

Anything important must be enforced server-side or at the database/payment-provider level.

10\. BUILD VERTICALLY

Do not ask an AI coding agent to build this entire specification in one generation.

Build one phase at a time.

A phase is complete only when its acceptance tests pass.

────────────────────────────────────────  
1\. TECHNOLOGY STACK  
────────────────────────────────────────

Framework:

Next.js App Router.

Use the current supported stable version selected at project initialization and pin it in package.json/package-lock.json.

Do not perform an unreviewed major-framework upgrade during an implementation phase.

Language:

TypeScript.

\`strict: true\`

No \`any\` in committed application code unless a third-party boundary makes it unavoidable and the exception is documented.

Styling:

Tailwind CSS using the configuration mechanism appropriate to the installed pinned Tailwind major version.

shadcn/ui for accessible primitives.

Database:

Supabase PostgreSQL.

RLS on all application-facing tables.

Authentication:

Supabase Auth.

Storage:

Supabase Storage.

Property and inspection photographs are private.

AI:

Provider abstraction supporting OpenRouter as the initial hosted provider.

Optional fallbacks may include Ollama or another compatible provider.

Validation:

Zod.

Payments:

Stripe Connect.

Use platform charges plus separate transfers when delayed payout is required.

Do not describe this architecture as regulated "escrow" unless Nest later integrates a legally appropriate escrow service and receives appropriate legal advice.

KYC:

Stripe Identity or another explicitly configured identity provider.

Identity verification is not assumed to be free.

Automation:

n8n, preferably self-hosted for the bootstrap deployment.

Maps:

Leaflet \+ OpenStreetMap-compatible tiles.

Production traffic must comply with the selected tile provider's usage policy.

Email:

Provider abstraction, initially Resend if suitable.

Analytics:

Privacy-conscious analytics such as self-hosted Umami.

Monitoring:

Structured application logs plus an error-monitoring provider if configured.

Deployment:

Vercel or another compatible Next.js host.

Scheduled automation belongs in n8n unless explicitly documented otherwise.

────────────────────────────────────────  
2\. PLATFORM ROLES  
────────────────────────────────────────

Nest has four principal roles.

Owner:

Creates properties, uploads photos, reviews AI property analysis, receives host applications, controls pricing, receives payouts, monitors bookings.

Host:

Completes identity verification, discovers eligible properties, applies to manage them, communicates with relevant parties, manages stays and receives configured compensation.

Guest:

Searches properties, obtains quotes, books, pays, communicates, completes optional inspections where appropriate, opens disputes and leaves reviews.

Admin:

Performs platform moderation, KYC oversight where permitted, dispute adjudication, user administration, payment support, AI auditing and operational monitoring.

An ordinary user must never be able to assign themselves the admin role.

────────────────────────────────────────  
3\. CONFIGURABLE BUSINESS POLICY  
────────────────────────────────────────

Business policy must not be scattered through application source code.

Defaults may be supplied through environment configuration and/or a platform\_settings table.

Configurable policies include:

PLATFORM\_FEE\_PCT  
DEFAULT\_HOST\_FEE\_PCT  
KYC\_GUEST\_THRESHOLD  
DISPUTE\_REVIEW\_THRESHOLD  
PAYOUT\_RELEASE\_DELAY  
DISPUTE\_WINDOW  
CANCELLATION\_POLICY\_PARAMETERS  
AI\_PRICING\_MAX\_ADJUSTMENT  
VISION\_PRICING\_MAX\_CONTRIBUTION

Seed defaults may initially represent the intended commercial model, for example:

owner share: 82%  
host share: 15%  
platform share: 3%

Those values are product assumptions, not architectural truths.

All payout percentages must be snapshotted onto the booking/payout at transaction time so historical bookings do not change when configuration changes later.

Money must be represented with fixed-point decimal values or integer minor currency units.

Never use JavaScript floating-point arithmetic directly for payment settlement.

────────────────────────────────────────  
4\. DESIGN SYSTEM  
────────────────────────────────────────

Theme:

Warm Amber × Electric Teal.

The visual intention is warmth, intelligence and trust without looking clinical.

Core tokens:

void: \#0B0F14  
surface: \#141B24  
card: \#1C242F  
divider: \#2A3441

ember-500: \#FF7A45  
ember-300: \#FFB067

teal-500: \#14B8A6  
teal-300: \#5EEAD4

gold-500: \#F5B841

foreground: \#F5F7FA  
foreground-muted: \#B4BCC8  
foreground-faint: \#7A8494

success: \#22C55E  
warning: \#F5B841  
danger: \#EF4444

Use design tokens rather than arbitrary colour literals inside components.

Primary button:

ember → teal gradient.

Secondary button:

teal outline.

Verified badge:

gold shield/check treatment.

Cards:

card background, divider border, rounded corners.

Upload zone:

drag/drop support, accessible keyboard operation, per-file upload and analysis state.

Navigation:

responsive and usable at 375px.

Accessibility requirements:

WCAG-conscious contrast,  
visible focus states,  
semantic controls,  
keyboard operability,  
meaningful alt text,  
labels on form fields,  
reduced-motion compatibility.

────────────────────────────────────────  
5\. DATABASE ARCHITECTURE  
────────────────────────────────────────

Use separate migrations.

At minimum:

supabase/migrations/0001\_init.sql  
supabase/migrations/0002\_rls.sql  
supabase/migrations/0003\_storage.sql  
supabase/migrations/0004\_seed\_dev.sql

The data model includes:

profiles  
properties  
availability\_blocks  
bookings  
booking\_inspections  
host\_applications  
message\_threads  
thread\_participants  
messages  
reviews  
payouts  
disputes  
pricing\_signals  
price\_suggestions  
price\_calendar  
pricing\_rules  
property\_comps  
kyc\_verifications  
processed\_webhook\_events  
audit\_logs  
platform\_settings

Use PostgreSQL enums for stable application states where appropriate.

────────────────────────────────────────  
5.1 PROFILES  
────────────────────────────────────────

Profiles extend \`auth.users\`.

Important fields:

id  
email  
role  
full\_name  
avatar\_path  
location\_json  
bio  
rating\_avg  
rating\_count  
kyc\_status  
kyc\_verified\_at  
stripe\_connect\_id  
stripe\_customer\_id  
created\_at  
updated\_at

Signup may allow:

owner  
host  
guest

Signup must never allow:

admin

Protect this in both application logic and database logic.

────────────────────────────────────────  
5.2 PROPERTIES  
────────────────────────────────────────

Important fields:

id  
owner\_id  
assigned\_host\_id  
title  
description  
address\_json  
latitude  
longitude  
bedrooms  
bathrooms  
max\_guests  
amenities  
base\_price  
min\_price  
max\_price  
currency  
cleaning\_fee  
status  
photos  
cover\_photo  
vision\_analysis  
vision\_status  
vision\_analyzed\_at  
vision\_model  
vision\_schema\_version  
vision\_photos\_hash  
created\_at  
updated\_at

\`photos\` stores Supabase Storage object paths.

Do not persist signed URLs.

Constraint:

min\_price \<= base\_price \<= max\_price

Property images are resolved to temporary signed URLs server-side.

────────────────────────────────────────  
5.3 AVAILABILITY AND DOUBLE-BOOKING  
────────────────────────────────────────

Use PostgreSQL exclusion constraints.

Live booking states must not overlap for the same property.

Use:

daterange(checkin, checkout, '\[)')

and a GiST exclusion constraint.

The database is the final authority.

Application code must also check availability to provide a good user experience, but an application check is not considered protection against a race condition.

Availability blocks must also be checked.

A concurrency test must attempt multiple simultaneous reservations for identical dates.

Exactly one may succeed.

────────────────────────────────────────  
5.4 BOOKING STATE MACHINE  
────────────────────────────────────────

Use explicit transitions.

Typical states:

pending\_payment  
reserved  
confirmed  
checked\_in  
checked\_out  
completed  
cancelled  
refunded

A state transition function must reject invalid transitions.

Examples:

pending\_payment → reserved  
reserved → confirmed  
confirmed → checked\_in  
checked\_in → checked\_out  
checked\_out → completed

Cancellation/refund transitions occur only according to documented rules.

Do not allow arbitrary client UPDATEs of booking status.

Sensitive transitions happen via server functions/routes using verified authorization.

────────────────────────────────────────  
5.5 INSPECTION PHOTOS  
────────────────────────────────────────

Store check-in/check-out inspection metadata separately from property photos.

Fields:

booking\_id  
kind  
photos  
notes  
submitted\_by  
submitted\_at

Photos remain private.

Only booking parties and authorized administrators may access them.

Inspection photos may be used by the AI dispute-assessment system after authorization.

Missing inspection photos must never be treated as proof of liability.

────────────────────────────────────────  
5.6 HOST APPLICATIONS  
────────────────────────────────────────

Fields include:

property\_id  
host\_id  
status  
proposed\_fee\_pct  
pitch\_text  
ai\_match\_score  
ai\_match\_reasoning  
ai\_model  
ai\_scored\_at

A host must have the required KYC state before applying.

Enforce at:

UI,  
server/API,  
database.

The AI host score is advisory.

It must never automatically reject or discriminate against an applicant.

────────────────────────────────────────  
5.7 MESSAGING  
────────────────────────────────────────

Use:

message\_threads  
thread\_participants  
messages

Do not represent participants as an unindexed UUID array.

RLS must verify membership before message access.

Media remains private.

────────────────────────────────────────  
5.8 REVIEWS  
────────────────────────────────────────

Reviews require an eligible booking relationship.

A user must not be able to review an unrelated property/person by manually changing an ID.

Review eligibility is enforced server-side/database-side.

────────────────────────────────────────  
5.9 PAYOUTS  
────────────────────────────────────────

Never use a weak constraint such as:

\`round(owner\_amount \+ host\_amount \+ platform\_amount, 2\) is not null\`

That proves nothing.

Store:

booking\_id  
settlement\_base\_amount  
owner\_amount  
host\_amount  
platform\_amount  
currency  
owner\_pct\_snapshot  
host\_pct\_snapshot  
platform\_pct\_snapshot  
status  
releasable\_at  
Stripe transfer identifiers  
failure information  
released\_at

Validate:

owner\_amount \>= 0  
host\_amount \>= 0  
platform\_amount \>= 0

and:

owner\_amount \+ host\_amount \+ platform\_amount \= settlement\_base\_amount

subject to an explicitly documented rounding rule.

Prefer calculating money in integer minor currency units in the payment domain.

Settlement must be constructed atomically on the server.

────────────────────────────────────────  
5.10 DISPUTES  
────────────────────────────────────────

Opening a qualifying dispute freezes an unreleased payout.

Store:

claimant  
respondent  
booking  
amount claimed  
description  
AI assessment  
AI model  
AI assessment timestamp  
admin decision  
award  
resolution notes  
resolver  
timestamps

The AI assessment never transfers money.

An authorized human/system policy determines the final settlement.

Higher-risk disputes always require human review.

────────────────────────────────────────  
5.11 PRICING  
────────────────────────────────────────

Maintain separate concepts for:

signals,  
suggestions,  
live calendar prices,  
rules,  
manual comparable listings.

A price suggestion is advice.

\`price\_calendar\` is the live price source.

Do not scrape competitors in violation of their terms.

Owner-entered comparable properties may contain:

URL  
bedrooms  
observed rate  
date observed  
notes

If automated market data is added later, it must come from a licensed/permitted source.

────────────────────────────────────────  
5.12 KYC  
────────────────────────────────────────

Store verification status and provider references.

Do not store identity-document images unless there is a specifically approved legal/security reason to do so.

Prefer keeping identity documents with the KYC provider.

Treat KYC information as sensitive personal data.

────────────────────────────────────────  
5.13 WEBHOOK IDEMPOTENCY  
────────────────────────────────────────

Add:

\`processed\_webhook\_events\`

with fields such as:

provider  
event\_id  
event\_type  
payload\_hash  
processing\_status  
processed\_at  
created\_at

Unique constraint:

(provider, event\_id)

Every Stripe webhook must:

verify the Stripe signature,  
identify the event,  
check whether it was already processed,  
process it inside an idempotent transaction,  
record successful processing.

Duplicate delivery must return success without performing the financial operation again.

Do not assume webhook ordering.

State transitions must tolerate delayed and out-of-order events.

────────────────────────────────────────  
5.14 AUDIT LOG  
────────────────────────────────────────

Material events are recorded in append-only \`audit\_logs\`.

Examples:

KYC state changes,  
property moderation,  
vision overrides,  
pricing application,  
booking state changes,  
refunds,  
payout state changes,  
dispute resolutions,  
admin role changes.

Application users receive no UPDATE or DELETE policy on audit rows.

Database/service credentials still technically have elevated access, so operational controls and backups are also required.

Do not describe PostgreSQL rows as cryptographically immutable unless an actual tamper-evident mechanism is added.

────────────────────────────────────────  
6\. ROW LEVEL SECURITY  
────────────────────────────────────────

Enable RLS on every application-facing table.

But "every table has a policy" is not enough.

Authorization tests must answer:

Can Alice read Bob's private booking?

Can a guest change a booking total?

Can a host alter their own KYC status?

Can an owner change a payout amount?

Can an ordinary user assign themselves admin?

Can one thread participant add a stranger to a private conversation?

Can a user modify an AI audit record?

Can a host change an application's AI score?

Can a guest mark their own booking refunded?

All answers must be no.

For sensitive state changes, prefer restricted server-side operations/RPC functions rather than broad user UPDATE privileges.

Do not expose the full \`profiles\` table publicly merely because some profile fields are public.

Create a limited public profile view containing only intentionally public fields.

────────────────────────────────────────  
7\. STORAGE SECURITY  
────────────────────────────────────────

Buckets:

property-photos — private  
inspection-photos — private  
message-media — private  
avatars — public or private according to product decision

Upload controls must validate:

authenticated user,  
object ownership/path,  
MIME type,  
extension,  
file size,  
maximum image dimensions,  
number of files.

Re-encode uploaded property images server-side before AI processing where practical.

Do not trust the browser-provided MIME type alone.

Strip unnecessary image metadata, including EXIF location information where appropriate.

Signed URLs should use short lifetimes.

Never log signed URLs containing access tokens.

Never allow AI routes to accept arbitrary remote image URLs from users. Resolve authorized storage paths server-side to prevent SSRF and unauthorized inference against third-party URLs.

────────────────────────────────────────  
8\. AI PROVIDER ARCHITECTURE  
────────────────────────────────────────

Create:

src/lib/ai/provider.ts  
src/lib/ai/structured.ts  
src/lib/ai/schemas.ts  
src/lib/ai/vision.ts  
src/lib/ai/matching.ts  
src/lib/ai/arbitration.ts

\`provider.ts\` exposes a normalized provider interface.

Configuration:

AI\_PROVIDER  
AI\_MODEL  
AI\_API\_KEY  
AI\_BASE\_URL

Optional fallback configuration:

AI\_FALLBACK\_1\_PROVIDER  
AI\_FALLBACK\_1\_MODEL

AI\_FALLBACK\_2\_PROVIDER  
AI\_FALLBACK\_2\_MODEL

The selected model must be validated at deployment/runtime.

Do not assume "free" means guaranteed capacity.

────────────────────────────────────────  
8.1 AI CAPABILITIES  
────────────────────────────────────────

Provider implementations expose capabilities such as:

supportsVision  
supportsStructuredOutput  
maximum known image constraints where available

Capability information may be configured/probed.

Never make pricing/business logic depend on a hard-coded model context length.

Chunk defensively.

Set request timeouts.

Set maximum retries.

Handle provider rate limits.

────────────────────────────────────────  
8.2 STRUCTURED OUTPUT  
────────────────────────────────────────

Implement a single \`aiJson()\` boundary.

Responsibilities:

call provider,  
extract structured JSON safely,  
parse JSON,  
validate using Zod,  
retry bounded failures,  
optionally provide validation feedback,  
try configured fallback provider,  
return validated output plus model metadata.

\`JSON.parse\` is allowed inside this controlled extraction layer because JSON eventually has to be parsed.

The rule is:

No call site may directly \`JSON.parse()\` untrusted model output.

────────────────────────────────────────  
8.3 AI OBSERVABILITY  
────────────────────────────────────────

For every AI task record operational metadata where appropriate:

task type  
provider  
model  
start/end time  
latency  
success/failure  
retry count  
schema version  
approximate request size  
token/usage metadata when supplied  
error category

Do not log private images or unnecessary personal data.

Do not log full prompts where they contain sensitive information unless explicitly required and appropriately protected.

────────────────────────────────────────  
9\. PROPERTY VISION  
────────────────────────────────────────

Vision begins after property photographs change.

Compute a deterministic hash of the relevant image object identifiers/version metadata.

If the hash differs from the last successfully analyzed set:

vision\_status \= pending

Queue asynchronous processing.

Limit number/size of images.

Resize before model ingestion.

Use controlled image quality.

Vision schema:

quality\_tier:  
budget | mid\_range | premium | luxury

condition\_score:  
1–10

interior\_modernity\_score:  
1–10

curb\_appeal\_score:  
1–10

notable\_features:  
bounded string array

red\_flags:  
bounded string array

aesthetic\_vibe:  
controlled enum

estimated\_size\_bracket:  
controlled enum

lighting\_quality:  
controlled enum

visual\_justification:  
bounded text

confidence:  
low | medium | high

Schema version must be stored.

Feature descriptions are normalized onto a controlled taxonomy before affecting pricing.

Examples:

pool  
hot\_tub  
ocean\_view  
fireplace

Free-text features that do not map safely to the taxonomy contribute zero to price.

Total vision influence on pricing is capped by configuration.

Vision failure:

set status \= failed,  
record safe error metadata,  
retry with bounded exponential backoff.

Vision failure does not prevent normal base pricing.

────────────────────────────────────────  
10\. PRICING ENGINE  
────────────────────────────────────────

Pricing has three layers.

LAYER 1 — SIGNAL COLLECTION

Signals may include:

booking history  
day of week  
seasonality  
lead time  
forward occupancy  
owner-entered comps  
events  
weather  
vision analysis

Any external event/weather source must have documented licensing/usage conditions.

LAYER 2 — DETERMINISTIC PRICING

TypeScript calculates the baseline.

Each factor is represented as:

key  
label  
multiplier  
source

The baseline applies deterministic bounded multipliers.

Vision adjustments use percentages, not fixed dollar values.

Example conceptual multipliers:

quality tier  
condition  
lighting  
recognized features  
red flags

The combined contribution of vision must be capped.

LAYER 3 — AI REFINEMENT

The AI receives:

baseline  
factor list  
vision summary  
comparable data  
events  
weather  
relevant contextual signals

It must not return the final price.

Schema:

adjustment\_multiplier  
confidence  
rationale  
risk\_factors  
reasoning\_notes

Clamp the AI multiplier to a configured bounded range.

Then TypeScript calculates:

raw final price \= baseline × bounded AI multiplier

Then code clamps to:

owner floor  
owner ceiling

Then code applies currency-safe rounding.

Every suggestion stores a human-readable reasoning trace.

Example:

Base rate: $180  
Saturday demand: \+$22  
High forward occupancy: \+$14  
Premium visual condition: \+$11  
Local event: \+$18  
AI contextual adjustment: \+$7  
Final suggestion: $252

The values in that trace are computed by code, not invented by the model.

────────────────────────────────────────  
11\. PRICE AUTO-APPLICATION  
────────────────────────────────────────

Auto-application is optional.

If enabled:

change must be inside the owner's configured threshold.

Never auto-change dates attached to an existing reserved-or-later booking.

Write the result to \`price\_calendar\`.

Log the action.

The owner must be able to see why it occurred.

AI/provider failure falls back to deterministic pricing.

If deterministic signal collection also fails, fall back safely to existing calendar/base pricing.

Guests must never encounter an unavailable booking page solely because AI pricing failed.

────────────────────────────────────────  
12\. HOST MATCHING  
────────────────────────────────────────

AI can score compatibility between a host and property.

Structured result:

score  
strengths  
concerns  
reasoning  
recommendation

The score is advisory.

It must not auto-reject applicants.

Prompts must avoid requesting or inferring protected/sensitive personal traits that are irrelevant to hosting suitability.

Matching should focus on legitimate factors such as:

availability,  
experience,  
location/service area,  
property-management skills,  
guest ratings,  
relevant track record,  
proposal.

────────────────────────────────────────  
13\. DISPUTE AI  
────────────────────────────────────────

Use separately labelled before/after image sets.

The AI is instructed:

compare only what is visible,  
do not infer causation,  
identify uncertainty,  
reduce evidence confidence when images are missing,  
do not invent repair costs.

Output schema:

damage\_detected  
severity  
itemised\_findings  
evidence\_quality  
recommended\_award\_pct  
rationale  
requires\_human\_review

The recommendation is advisory.

It never moves money.

The assessment endpoint requires:

authenticated session,  
booking/dispute relationship or admin authorization,  
authorized private storage access,  
rate limiting.

No arbitrary image URLs.

Both parties may see the assessment subject to product/legal review.

Final dispute adjudication is separately recorded.

────────────────────────────────────────  
14\. KYC  
────────────────────────────────────────

Host flow:

Host signs up.

Dashboard explains identity verification requirement.

Server creates a verification session using the configured provider.

Provider handles document capture.

Provider webhook is verified.

On verified:

update KYC record,  
update profile state,  
write audit event,  
unlock eligible actions.

On failure/retry requirement:

record state safely,  
show user an actionable message,  
allow retry according to provider rules.

KYC enforcement exists in:

UI  
API  
database

Guest KYC above a configured transaction threshold is a product/compliance policy and must remain configurable.

Do not claim a particular KYC provider is free.

────────────────────────────────────────  
15\. PAYMENTS AND DELAYED PAYOUTS  
────────────────────────────────────────

Important terminology:

Nest uses delayed marketplace payouts.

Do not call this legal escrow in UI, documentation or marketing unless an appropriate regulated escrow arrangement exists.

Payment architecture must be reviewed against the Stripe Connect account type and the jurisdictions where Nest operates before launch.

For a delayed payout architecture, use a supported Stripe Connect charge/transfer pattern such as separate charges and transfers where appropriate.

Do not call a charge a "destination charge" if no destination transfer is configured.

At booking:

guest pays,  
payment is associated with the booking,  
successful verified webhook reserves the booking,  
payout split is calculated by server code,  
split percentages are snapshotted,  
payout remains held internally until it becomes eligible for transfer.

Stripe's actual fund-availability and Connect rules remain authoritative.

────────────────────────────────────────  
15.1 PAYOUT RELEASE  
────────────────────────────────────────

Default policy may initially be:

24 hours after checkout.

But this is configurable.

If a dispute opens before transfer:

payout becomes frozen.

Release worker processes only:

eligible state,  
releasable time reached,  
not frozen,  
not already transferred.

Transfers use Stripe idempotency keys.

Example conceptual key:

booking:{bookingId}:owner

booking:{bookingId}:host

Before retrying an uncertain transfer, reconcile existing Stripe state.

Never blindly create a second transfer.

────────────────────────────────────────  
15.2 CANCELLATIONS  
────────────────────────────────────────

Cancellation rules are business policy, not architecture.

Implement a configurable policy engine.

Initial named policies may include:

Flexible  
Moderate  
Strict

Store the applied policy/version on each booking.

Changing today's cancellation policy must not retroactively change an old booking.

Refunds use server-side deterministic arithmetic.

Every refund request uses Stripe idempotency.

Webhook reconciliation confirms provider state.

────────────────────────────────────────  
16\. STRIPE WEBHOOK SECURITY  
────────────────────────────────────────

Webhook handlers:

read raw request body as required by the Stripe SDK,  
verify signature before trusting payload,  
reject invalid signatures,  
persist provider event ID,  
process idempotently.

Expect:

duplicates,  
retries,  
delays,  
out-of-order events.

Never rely on "this webhook normally arrives after that one."

State transitions must be validated against current database/payment state.

────────────────────────────────────────  
17\. n8n WORKFLOWS  
────────────────────────────────────────

Exactly ten workflows are part of v1.

1\. vision-property-analysis  
2\. kyc-verification  
3\. nightly-signals  
4\. pricing-engine  
5\. host-application-matcher  
6\. booking-lifecycle  
7\. payout-release  
8\. dispute-intake  
9\. review-requests  
10\. guest-personalization

Export to:

workflows/nest-suite.json

Every workflow must:

import into a clean n8n instance,  
use documented environment names,  
call routes that actually exist,  
supply required request bodies,  
use the standard internal authentication mechanism,  
contain useful node notes,  
handle retryable failure appropriately.

Machine-to-machine requests use:

Authorization: Bearer INTERNAL\_API\_TOKEN

Compare authentication secrets using a constant-time-safe approach where practical.

Long term, internal request signing or a private network/service-auth mechanism may replace the shared token.

Workflow build order:

vision,  
KYC,  
signals,  
pricing,

then remaining workflows.

Do not generate all ten as untested JSON and declare completion.

────────────────────────────────────────  
18\. ROUTES  
────────────────────────────────────────

Public/product routes:

/  
 /auth/login  
/auth/signup  
/auth/verify-identity  
/dashboard  
/dashboard/owner  
/dashboard/owner/\[id\]  
/dashboard/host  
/dashboard/guest  
/search  
/property/\[id\]  
/book/\[propertyId\]  
/bookings/\[id\]  
/bookings/\[id\]/dispute  
/messages  
/review/\[bookingId\]  
/docs

Admin:

/admin  
/admin/users  
/admin/kyc  
/admin/properties  
/admin/disputes  
/admin/pricing  
/admin/analytics  
/admin/operations

APIs:

/api/properties  
/api/properties/\[id\]  
/api/properties/\[id\]/analyze-vision

/api/bookings/quote  
/api/bookings

/api/disputes  
/api/disputes/\[id\]/assess

/api/webhooks/stripe  
/api/webhooks/stripe-identity

/api/internal/pricing/queue  
/api/internal/pricing/recompute  
/api/internal/kyc  
/api/internal/payouts/release

/api/me  
/api/me/data  
/api/me/delete-request

All internal routes require internal authentication.

Only trusted server-side code may use the Supabase service role.

────────────────────────────────────────  
19\. ADMIN PORTAL  
────────────────────────────────────────

Admin capabilities include:

user administration,  
property moderation,  
vision audits,  
KYC operational status,  
booking support,  
refund support,  
dispute adjudication,  
pricing monitoring,  
AI operational health,  
workflow health,  
analytics.

High-risk admin operations require explicit confirmation.

Role changes, refunds, payout interventions, KYC overrides and dispute decisions are audited.

Admin access must be role-gated on the server, not merely hidden in navigation.

────────────────────────────────────────  
20\. SECURITY BASELINE  
────────────────────────────────────────

Authentication:

Supabase Auth.

Authorization:

RLS \+ server authorization \+ narrowly scoped privileged operations.

Admin:

server-enforced role authorization.

Service-role key:

server only.

A build/CI check must look for accidental exposure.

Images:

private storage where appropriate.

Webhooks:

signature verified.

Money:

idempotent operations.

AI endpoints:

authenticated and rate limited.

Uploads:

validated and size-limited.

Secrets:

never committed.

Dependencies:

automated dependency/security checks.

Security headers:

configure CSP and other applicable headers without breaking required integrations.

URLs:

prevent arbitrary server-side fetching.

Errors:

never return internal stack traces or secrets to users in production.

────────────────────────────────────────  
21\. RATE LIMITING AND ABUSE  
────────────────────────────────────────

Apply limits to:

authentication attempts,  
password/magic-link requests,  
AI endpoints,  
vision re-analysis,  
messaging,  
booking attempts,  
dispute creation,  
expensive search operations,  
internal endpoints.

Rate limiting must not rely only on browser state.

AI abuse controls should combine user/account identity and infrastructure-level signals where appropriate.

────────────────────────────────────────  
22\. PRIVACY AND DATA RETENTION  
────────────────────────────────────────

Do not promise that DELETE \`/api/me\` blindly deletes every record.

Financial, tax, fraud-prevention, dispute or legal records may need to be retained for a legally required period.

Implement account deletion as a documented process:

delete data that may lawfully be deleted,  
anonymize/pseudonymize retained records where appropriate,  
retain only data required for legitimate/legal obligations,  
record the deletion request,  
remove unnecessary stored media,  
respect third-party deletion obligations.

\`GET /api/me/data\` provides the user's exportable data where applicable.

Create:

docs/PRIVACY-DATA-MAP.md

It documents:

data category,  
where stored,  
purpose,  
retention policy,  
deletion behavior,  
third-party processor.

Legal requirements vary by jurisdiction. Do not claim "GDPR compliant" solely because export/delete endpoints exist.

────────────────────────────────────────  
23\. OBSERVABILITY  
────────────────────────────────────────

Production must provide enough information to answer:

Why did this booking fail?

Why did this price change?

Why did vision fail?

Was a Stripe webhook processed?

Was this payout transferred?

Did n8n run?

Which AI model generated this assessment?

Use structured logging.

Every important request has a correlation/request ID where practical.

Categorize errors:

authentication  
authorization  
validation  
database  
AI provider  
payment  
storage  
workflow  
third-party API

Sensitive values are redacted.

────────────────────────────────────────  
24\. BACKUPS AND RECOVERY  
────────────────────────────────────────

Production launch requires a recovery plan.

Document:

database backup mechanism,  
backup retention,  
storage recovery expectations,  
Stripe reconciliation source,  
n8n workflow export/backup,  
environment-secret recovery,  
restore procedure.

Create:

docs/RECOVERY.md

A backup that has never been restored is not considered tested.

Perform at least one documented recovery exercise before production launch.

────────────────────────────────────────  
25\. ENVIRONMENT CONFIGURATION  
────────────────────────────────────────

\`.env.example\` documents every variable.

Example groups:

APP

NEXT\_PUBLIC\_APP\_URL  
INTERNAL\_API\_TOKEN

SUPABASE

NEXT\_PUBLIC\_SUPABASE\_URL  
NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY  
SUPABASE\_SERVICE\_ROLE\_KEY

AI

AI\_PROVIDER  
AI\_BASE\_URL  
AI\_API\_KEY  
AI\_MODEL  
AI\_REQUEST\_TIMEOUT\_MS

AI\_FALLBACK\_1\_PROVIDER  
AI\_FALLBACK\_1\_MODEL

VISION

VISION\_ENABLED  
VISION\_MAX\_IMAGES  
VISION\_IMAGE\_MAX\_PX  
VISION\_JPEG\_QUALITY  
VISION\_REANALYSIS\_COOLDOWN\_MIN

STRIPE

STRIPE\_SECRET\_KEY  
NEXT\_PUBLIC\_STRIPE\_PUBLISHABLE\_KEY  
STRIPE\_WEBHOOK\_SECRET  
STRIPE\_IDENTITY\_WEBHOOK\_SECRET

BUSINESS POLICY

PLATFORM\_FEE\_PCT  
DEFAULT\_HOST\_FEE\_PCT  
KYC\_GUEST\_THRESHOLD  
DISPUTE\_REVIEW\_THRESHOLD  
PAYOUT\_RELEASE\_HOURS\_AFTER\_CHECKOUT  
AI\_PRICING\_MAX\_ADJUSTMENT\_PCT  
VISION\_PRICING\_MAX\_CONTRIBUTION\_PCT

SERVICES

RESEND\_API\_KEY  
TICKETMASTER\_API\_KEY or configured event provider

N8N

N8N\_WEBHOOK\_BASE

Never put secrets in \`NEXT\_PUBLIC\_\*\`.

Every variable in \`.env.example\` must explain:

what it does,  
whether secret,  
where to obtain it,  
whether optional,  
what happens when absent.

Do not put real production secrets in the example file.

────────────────────────────────────────  
26\. EXTERNAL COST DOCUMENTATION  
────────────────────────────────────────

\`docs/COSTS.md\` is mandatory.

Track:

hosting,  
Supabase,  
AI inference,  
KYC,  
Stripe processing,  
email,  
maps/tiles,  
events,  
n8n hosting,  
monitoring,  
storage/egress.

For each provider record:

pricing link,  
free-tier information if applicable,  
usage limits,  
configured spending safeguards,  
fallback behavior.

External pricing changes.

Therefore documentation must include a "last verified" date rather than claiming prices permanently.

────────────────────────────────────────  
27\. DOCUMENTATION  
────────────────────────────────────────

Required:

docs/SPEC.md  
docs/deploy.md  
docs/owner-guide.md  
docs/host-guide.md  
docs/guest-guide.md  
docs/admin-guide.md  
docs/COSTS.md  
docs/PRIVACY-DATA-MAP.md  
docs/RECOVERY.md  
docs/SECURITY.md

Deploy documentation assumes no prior deployment experience.

Explain terms before using them.

Screenshots must match the actual application/provider interface closely enough to be useful and should be updated when materially obsolete.

The deployment guide covers:

accounts,  
environment variables,  
Supabase setup,  
migrations,  
storage,  
Stripe test mode,  
AI provider,  
n8n,  
deployment,  
webhooks,  
end-to-end test.

────────────────────────────────────────  
28\. BUILD PHASES  
────────────────────────────────────────

PHASE 1 — FOUNDATION

Create:

Next.js application  
strict TypeScript  
design system  
Supabase migrations  
RLS foundation  
auth  
role onboarding  
landing page  
responsive navigation  
role dashboards

Done when:

owner, host and guest accounts can sign up, authenticate and reach their correct empty dashboard.

Admin cannot be self-selected.

PHASE 2 — PROPERTY \+ VISION

Build:

property CRUD  
private image upload  
upload validation  
signed URL helper  
AI provider abstraction  
structured AI output  
vision schemas  
vision pipeline  
Property Eye card  
search  
property detail

Done when:

an owner uploads real permitted test photographs and asynchronously receives validated property analysis.

Failure behavior must also be demonstrated.

PHASE 3 — BOOKINGS \+ PAYMENTS

Build:

availability  
pricing quote  
booking state machine  
double-booking exclusion constraint  
Stripe payment  
webhook verification  
webhook idempotency  
payout records  
cancellation calculation  
guest trips

Done when:

ten concurrent attempts at identical property dates result in exactly one reservation.

Duplicate Stripe webhook delivery results in exactly one state transition/financial effect.

PHASE 4 — TRUST

Build:

KYC  
host applications  
KYC enforcement  
host matching  
messaging  
reviews  
inspection photographs

Done when:

an unverified host is rejected by UI, API and database.

A verified host can apply.

AI matching appears as advisory information only.

PHASE 5 — PRICING \+ DISPUTES

Build:

signals  
deterministic pricing  
pricing unit tests  
AI refinement  
price calendar  
pricing trace  
pricing rules  
dispute intake  
AI assessment  
payout freeze

Done when:

an owner can open a date and understand every deterministic monetary adjustment.

AI failure still produces safe pricing.

A dispute freezes an eligible payout and AI cannot independently move money.

PHASE 6 — ADMIN \+ AUTOMATION

Build:

admin portal  
n8n workflows  
emails  
monitoring views  
analytics  
operational health

Done when:

all ten workflows import into a clean n8n installation and have each completed at least one documented test execution.

PHASE 7 — SECURITY \+ OPERATIONS \+ LAUNCH

Build/finalize:

security tests  
authorization tests  
performance pass  
accessibility pass  
privacy handling  
cost documentation  
backup/recovery  
production monitoring  
deploy guide  
role guides

Done when:

a new tester can deploy the system using the documentation and a recovery exercise has been completed.

────────────────────────────────────────  
29\. TESTING REQUIREMENTS  
────────────────────────────────────────

Required automated suites include:

pricing unit tests  
RLS authorization tests  
booking concurrency tests  
state-transition tests  
webhook idempotency tests  
payout split arithmetic tests  
cancellation arithmetic tests  
AI schema-validation tests  
AI failure/fallback tests  
upload authorization tests  
admin authorization tests

Important negative tests are mandatory.

Examples:

Guest cannot read another guest's booking.

Guest cannot change booking total.

Owner cannot change another owner's property.

Host cannot mark themselves KYC verified.

User cannot become admin.

User cannot change payout amounts.

AI cannot produce an out-of-range pricing multiplier.

Repeated Stripe event does not repeat an operation.

Arbitrary external image URL cannot be submitted to dispute analysis.

────────────────────────────────────────  
30\. FINANCIAL INVARIANTS  
────────────────────────────────────────

Financial operations must satisfy:

settlement component totals reconcile to settlement base;

refund amount never exceeds refundable amount;

transfer amount never exceeds the party's remaining unpaid entitlement;

a successful transfer is never recreated merely because a worker retries;

a frozen payout cannot be released;

historical bookings retain the policy snapshot used when created;

currency must match throughout a settlement unless an explicitly implemented FX layer exists.

Financial invariants receive unit/integration tests.

────────────────────────────────────────  
31\. AI SAFETY INVARIANTS  
────────────────────────────────────────

AI must never:

set a final dollar value directly,  
execute a payment,  
change KYC status,  
assign roles,  
automatically resolve a serious dispute,  
auto-reject a host,  
override an owner pricing floor/ceiling,  
fetch arbitrary user-provided URLs,  
bypass application authorization.

Every AI result is treated as untrusted input until validated.

────────────────────────────────────────  
32\. DEFINITION OF DONE  
────────────────────────────────────────

Nest v1 is complete only when all of the following are true.

Functional:

Owner lists a property end to end.

Vision automatically analyzes authorized uploaded property images.

Host KYC gates applications.

Host applications receive advisory AI matching.

Guest searches, receives a deterministic quote and books.

Concurrent double-booking is prevented by PostgreSQL.

Stripe test-mode booking works.

Delayed payout records reconcile correctly.

Disputes freeze payouts appropriately.

AI dispute analysis is advisory.

Cancellation/refund calculations are tested.

Pricing produces a transparent reasoning trace.

Security:

RLS is enabled wherever required.

Authorization tests prove protected fields cannot be changed by the wrong actor.

Admin role cannot be self-assigned.

Stripe webhooks reject invalid signatures.

Duplicate Stripe events are idempotent.

AI endpoints require authorization.

Sensitive storage is private.

Signed URLs are temporary.

Service-role key is server-only.

Arbitrary remote image fetching is prohibited.

Quality:

TypeScript passes.

Lint passes.

Automated tests pass.

No TODO implementations.

No dead buttons.

No fake integrations masquerading as completed work.

Responsive at:

375px  
768px  
1440px

Accessibility receives a keyboard and contrast pass.

Operations:

All ten n8n workflows import successfully.

Every workflow has been run.

External costs are documented.

AI failures degrade gracefully.

Payment-provider failures produce recoverable states.

Database recovery documentation exists.

A restore procedure has been tested.

Deployment documentation has been followed by someone other than its author.

────────────────────────────────────────  
33\. RELEASE VERIFICATION  
────────────────────────────────────────

Before release verify database RLS coverage.

Check for tables with RLS enabled but no policies.

Also check for application-facing tables where RLS is disabled.

Verify the double-booking exclusion constraint exists.

Run authorization tests using:

anonymous client,  
guest,  
owner,  
host,  
admin.

Do not rely solely on SQL inspection.

Actually attempt prohibited operations.

Run booking concurrency tests.

Run duplicate webhook tests.

Run financial reconciliation tests.

Run an AI-provider outage test.

Run a vision failure test.

Run a failed Stripe-transfer test.

Release is blocked when a critical verification fails.

────────────────────────────────────────  
34\. FILE STRUCTURE  
────────────────────────────────────────

nest/  
├── src/  
│   ├── app/  
│   │   ├── (auth)/  
│   │   ├── (dashboard)/  
│   │   ├── admin/  
│   │   ├── api/  
│   │   ├── bookings/  
│   │   ├── property/  
│   │   ├── search/  
│   │   ├── messages/  
│   │   ├── review/  
│   │   ├── docs/  
│   │   ├── globals.css  
│   │   ├── layout.tsx  
│   │   └── page.tsx  
│   │  
│   ├── lib/  
│   │   ├── ai/  
│   │   │   ├── provider.ts  
│   │   │   ├── structured.ts  
│   │   │   ├── schemas.ts  
│   │   │   ├── vision.ts  
│   │   │   ├── matching.ts  
│   │   │   └── arbitration.ts  
│   │   │  
│   │   ├── pricing/  
│   │   │   ├── signals.ts  
│   │   │   ├── baseline.ts  
│   │   │   ├── refine.ts  
│   │   │   ├── apply.ts  
│   │   │   └── taxonomy.ts  
│   │   │  
│   │   ├── supabase/  
│   │   │   ├── client.ts  
│   │   │   ├── server.ts  
│   │   │   └── service.ts  
│   │   │  
│   │   ├── stripe/  
│   │   │   ├── payments.ts  
│   │   │   ├── connect.ts  
│   │   │   ├── transfers.ts  
│   │   │   └── webhooks.ts  
│   │   │  
│   │   ├── storage/  
│   │   │   ├── signed-urls.ts  
│   │   │   ├── upload-validation.ts  
│   │   │   └── resize.ts  
│   │   │  
│   │   ├── audit.ts  
│   │   ├── authorization.ts  
│   │   ├── email.ts  
│   │   ├── money.ts  
│   │   └── utils.ts  
│   │  
│   ├── components/  
│   │   ├── ui/  
│   │   ├── vision/  
│   │   ├── pricing/  
│   │   ├── booking/  
│   │   ├── kyc/  
│   │   └── disputes/  
│   │  
│   ├── hooks/  
│   └── types/  
│  
├── supabase/  
│   └── migrations/  
│       ├── 0001\_init.sql  
│       ├── 0002\_rls.sql  
│       ├── 0003\_storage.sql  
│       └── 0004\_seed\_dev.sql  
│  
├── workflows/  
│   └── nest-suite.json  
│  
├── docs/  
│   ├── SPEC.md  
│   ├── deploy.md  
│   ├── owner-guide.md  
│   ├── host-guide.md  
│   ├── guest-guide.md  
│   ├── admin-guide.md  
│   ├── COSTS.md  
│   ├── PRIVACY-DATA-MAP.md  
│   ├── RECOVERY.md  
│   └── SECURITY.md  
│  
├── tests/  
│   ├── pricing.test.ts  
│   ├── rls.test.ts  
│   ├── authorization.test.ts  
│   ├── concurrency.test.ts  
│   ├── webhooks.test.ts  
│   ├── money.test.ts  
│   └── ai-validation.test.ts  
│  
├── .env.example  
├── package.json  
├── next.config.\*  
└── README.md

────────────────────────────────────────  
35\. AGENT IMPLEMENTATION RULES  
────────────────────────────────────────

This specification must not be handed to an AI coding agent with only the instruction:

"Build this."

Instead, commit this document as:

\`docs/SPEC.md\`

Create an agent instruction file such as:

\`CLAUDE.md\`

or the equivalent supported by the chosen coding tool.

Use the following master agent instruction.

BEGIN AGENT INSTRUCTION

You are implementing the Nest application.

Before changing code, read \`docs/SPEC.md\`.

\`docs/SPEC.md\` is the project's authoritative product and engineering specification.

Rules:

Do not implement multiple build phases unless explicitly instructed.

Do not create placeholder implementations for future phases.

Do not modify \`docs/SPEC.md\` as a side effect of implementation.

If the requested implementation conflicts with \`docs/SPEC.md\`, report the conflict before making the conflicting change.

If a security-critical or money-critical requirement is genuinely ambiguous, do not invent a convenient implementation. Identify the ambiguity.

Never expose the Supabase service-role key to client code.

Never trust client-provided ownership, roles, prices, payout values or KYC states.

Never bypass RLS merely to make a feature work.

Never let an AI response directly determine or move money.

Every structured AI output must pass its Zod schema.

Never directly parse model output outside the shared structured-output layer.

Never hard-code an AI model identifier into application business logic.

Never assume an external provider remains free.

Never call delayed marketplace payments "escrow" unless the project specification has explicitly changed to a legally appropriate escrow product.

Never accept arbitrary remote image URLs for AI processing.

All financial operations must be idempotent.

Stripe webhook signatures must be verified before events are trusted.

Duplicate and out-of-order webhooks must be safe.

Do not weaken database constraints to make tests pass.

Do not weaken authorization policies to make a page work.

Before implementing a phase:

1\. Read the relevant sections of \`docs/SPEC.md\`.  
2\. Inspect the existing repository.  
3\. State which files need to be created or modified.  
4\. Identify migrations or environment variables required.  
5\. Identify security or payment implications.  
6\. Wait for approval if the human has requested approval-before-code mode.

After implementing:

Run TypeScript checks.

Run lint.

Run applicable automated tests.

Run the phase acceptance criteria.

Report:

files changed,  
tests run,  
tests passed,  
known limitations,  
required manual configuration.

A phase is not complete if its Definition of Done fails.

END AGENT INSTRUCTION

────────────────────────────────────────  
36\. PHASE PROMPT TEMPLATE  
────────────────────────────────────────

Use prompts of this form when working with the coding agent:

BEGIN IMPLEMENTATION PROMPT

Read \`docs/SPEC.md\` in full.

Implement Phase \[NUMBER\] only.

In scope:

\[EXACT SECTIONS\]

Out of scope:

\[EXPLICIT FUTURE FEATURES\]

Do not create stubs or placeholder pages for out-of-scope features.

Preserve existing working behavior.

Security requirements:

Follow the authorization, storage, RLS and secret-handling requirements in the specification.

AI requirements:

Every structured AI response must be Zod validated.

AI must not perform financial arithmetic.

Payment requirements:

All financial arithmetic must use the shared money utilities and all provider operations must be idempotent.

Definition of Done:

\[COPY PHASE ACCEPTANCE CRITERIA\]

Before coding, inspect the repository and tell me:

1\. Files you will create.  
2\. Files you will modify.  
3\. Database migrations required.  
4\. Environment variables required.  
5\. Tests you will add/run.

Wait for my confirmation before writing code.

END IMPLEMENTATION PROMPT

────────────────────────────────────────  
37\. EXAMPLE — PHASE 2 PROMPT  
────────────────────────────────────────

BEGIN PROMPT

Read \`docs/SPEC.md\` in full, then implement Phase 2 only.

In scope:

Property CRUD.

Private property-photo storage.

Secure upload validation.

Short-lived signed URL generation.

AI provider abstraction.

Structured AI output handling.

Zod AI schemas.

Property vision pipeline.

Vision persistence and version/hash tracking.

AI Property Eye owner component.

Guest AI-assessed property highlights.

Property search.

Property detail page.

Out of scope:

Pricing engine.

Bookings.

Stripe payments.

KYC.

Host applications.

Messaging.

Disputes.

Payouts.

Admin portal.

Do not stub the out-of-scope features.

Constraints:

Property photos are private storage paths, never permanent public URLs.

Do not store signed URLs.

Do not accept arbitrary remote URLs for vision analysis.

Resize/re-encode images before AI submission according to the specification.

Every structured model response must pass a Zod schema.

No model identifier may be hard-coded into application business logic.

Vision failure must not prevent the property from being saved/listed.

Use only design-system tokens.

Use accessible controls.

Add tests for the structured AI boundary and image authorization.

Done when:

An authenticated owner can create a property, upload permitted test images and save it.

Vision processing starts asynchronously.

A schema-valid analysis is persisted with model/schema metadata.

The owner sees the completed Property Eye card without needing to recreate the listing.

Another owner cannot access the property's private image paths.

A provider failure produces a safe failed/retryable state instead of crashing the property page.

TypeScript, lint and applicable tests pass.

Before writing any code, inspect the repository and list the files, migrations, environment variables and tests you propose.

Wait for my confirmation.

END PROMPT

────────────────────────────────────────  
38\. FINAL ENGINEERING PRINCIPLE  
────────────────────────────────────────

Nest is not considered production-ready because it has many features.

It is production-ready only when its important invariants survive failure.

A model can fail without preventing a booking.

A workflow can retry without paying someone twice.

A webhook can arrive twice without duplicating a financial action.

Two guests can click Book simultaneously without creating two reservations.

A user can manipulate the browser without becoming an admin.

A host cannot bypass KYC by calling the API directly.

A model can hallucinate without being allowed to invent the amount of money charged.

A dispute can exist without an AI model being given authority to decide who receives money.

A provider can change its pricing or model availability without requiring the application architecture to be rewritten.

A user can request account deletion without the system falsely promising deletion of records that may lawfully need to be retained.

An administrator can understand why a price changed, why a payout was held and which model produced an AI assessment.

Every property gets intelligently analyzed.

Every sensitive action is authorized.

Every AI output is treated as untrusted until validated.

Every important price is calculated by deterministic code.

Every financial operation is reconcilable.

Every material decision is auditable.

Build for bootstrappers.

Do not build like a prototype.

END OF NEST BUILD SPECIFICATION v5

────────────────────────────────────────

There is one thing I would do before giving this to the coding model.

Your original Prompt 2 contained a large amount of actual SQL, including its RLS policies. I deliberately changed the architectural requirements above rather than blindly reproducing those policies because some of the original policies are precisely where I think the security weaknesses are. In particular, I would not tell a coding agent that the old SQL is canonical and then separately tell it to harden authorization; those instructions could conflict.

The cleanest package for your project would therefore be three files:

\- \`docs/SPEC.md\` — the v5 specification above.  
\- \`CLAUDE.md\` (or equivalent) — the Master Agent Instruction from §35.  
\- A new \`0001\_init.sql\` \+ \`0002\_rls.sql\` designed specifically against v5, with hardened column/state-transition authorization rather than copying the v4 policies.

That last SQL/RLS piece is important enough that I would design it before starting Phase 1\. It is the foundation on which the bookings, KYC, admin privileges and money flows sit.

One important architectural choice first: ordinary authenticated clients get direct database writes only where that is both useful and low-risk. Anything controlling money, KYC, roles, AI results, booking state, disputes, or payout state goes through trusted server routes/RPCs. That makes the RLS model substantially easier to reason about.

Save the first section as \`supabase/migrations/0001\_init.sql\` and the second as \`supabase/migrations/0002\_rls.sql\`.

PART A — \`supabase/migrations/0001\_init.sql\`

\`\`\`sql  
\-- NEST v5  
\-- 0001\_init.sql  
\--  
\-- Core schema.  
\-- Security policies are intentionally separated into 0002\_rls.sql.  
\--  
\-- IMPORTANT:  
\-- Money columns use integer minor units.  
\-- Example: USD 123.45 \= 12345\.  
\-- This avoids floating-point settlement errors.

begin;

create extension if not exists "pgcrypto";  
create extension if not exists "btree\_gist";

\-- \============================================================  
\-- ENUMS  
\-- \============================================================

create type public.user\_role as enum (  
  'owner',  
  'host',  
  'guest',  
  'admin'  
);

create type public.kyc\_state as enum (  
  'none',  
  'pending',  
  'verified',  
  'rejected',  
  'expired'  
);

create type public.property\_state as enum (  
  'draft',  
  'listed',  
  'pending\_host',  
  'managed',  
  'suspended'  
);

create type public.vision\_state as enum (  
  'pending',  
  'processing',  
  'complete',  
  'failed',  
  'stale'  
);

create type public.application\_state as enum (  
  'applied',  
  'accepted',  
  'rejected',  
  'withdrawn'  
);

create type public.booking\_state as enum (  
  'pending\_payment',  
  'reserved',  
  'confirmed',  
  'checked\_in',  
  'checked\_out',  
  'completed',  
  'cancelled',  
  'refunded'  
);

create type public.payout\_state as enum (  
  'held',  
  'releasable',  
  'released',  
  'failed',  
  'frozen'  
);

create type public.dispute\_state as enum (  
  'open',  
  'under\_review',  
  'resolved',  
  'withdrawn'  
);

create type public.webhook\_processing\_state as enum (  
  'processing',  
  'processed',  
  'failed'  
);

\-- \============================================================  
\-- COMMON FUNCTIONS  
\-- \============================================================

create or replace function public.set\_updated\_at()  
returns trigger  
language plpgsql  
set search\_path \= ''  
as $$  
begin  
  new.updated\_at \= now();  
  return new;  
end;  
$$;

\-- \============================================================  
\-- PROFILES  
\-- \============================================================

create table public.profiles (  
  id uuid primary key references auth.users(id) on delete cascade,

  email text unique not null,  
  role public.user\_role not null default 'guest',

  full\_name text not null,  
  avatar\_path text,  
  location\_json jsonb not null default '{}'::jsonb,  
  bio text,

  rating\_avg numeric(3,2)  
    check (rating\_avg is null or rating\_avg between 1 and 5),

  rating\_count integer not null default 0  
    check (rating\_count \>= 0),

  kyc\_status public.kyc\_state not null default 'none',  
  kyc\_verified\_at timestamptz,

  stripe\_connect\_id text unique,  
  stripe\_customer\_id text unique,

  created\_at timestamptz not null default now(),  
  updated\_at timestamptz not null default now()  
);

create trigger profiles\_updated\_at  
before update on public.profiles  
for each row execute function public.set\_updated\_at();

\-- Prevent signup metadata from creating an administrator.  
create or replace function public.handle\_new\_user()  
returns trigger  
language plpgsql  
security definer  
set search\_path \= ''  
as $$  
declare  
  requested\_role text;  
  safe\_role public.user\_role;  
begin  
  requested\_role := lower(  
    coalesce(new.raw\_user\_meta\_data \-\>\> 'role', 'guest')  
  );

  if requested\_role in ('owner', 'host', 'guest') then  
    safe\_role := requested\_role::public.user\_role;  
  else  
    safe\_role := 'guest';  
  end if;

  insert into public.profiles (  
    id,  
    email,  
    full\_name,  
    role  
  )  
  values (  
    new.id,  
    coalesce(new.email, ''),  
    coalesce(  
      nullif(new.raw\_user\_meta\_data \-\>\> 'full\_name', ''),  
      split\_part(coalesce(new.email, ''), '@', 1),  
      'Nest user'  
    ),  
    safe\_role  
  );

  return new;  
end;  
$$;

create trigger on\_auth\_user\_created  
after insert on auth.users  
for each row execute function public.handle\_new\_user();

\-- \============================================================  
\-- AUTHORIZATION HELPERS  
\-- \============================================================

create or replace function public.current\_user\_role()  
returns public.user\_role  
language sql  
stable  
security definer  
set search\_path \= ''  
as $$  
  select p.role  
  from public.profiles p  
  where p.id \= auth.uid()  
$$;

create or replace function public.is\_admin()  
returns boolean  
language sql  
stable  
security definer  
set search\_path \= ''  
as $$  
  select coalesce(  
    (  
      select p.role \= 'admin'  
      from public.profiles p  
      where p.id \= auth.uid()  
    ),  
    false  
  )  
$$;

create or replace function public.owns\_property(property\_uuid uuid)  
returns boolean  
language sql  
stable  
security definer  
set search\_path \= ''  
as $$  
  select exists (  
    select 1  
    from public.properties p  
    where p.id \= property\_uuid  
      and p.owner\_id \= auth.uid()  
  )  
$$;

\-- The properties table is created below. PostgreSQL resolves this  
\-- function after the entire migration transaction is parsed/applied  
\-- by normal migration tooling. If your local migration runner objects,  
\-- move owns\_property/manages\_property immediately after properties.

\-- \============================================================  
\-- PROPERTIES  
\-- \============================================================

create table public.properties (  
  id uuid primary key default gen\_random\_uuid(),

  owner\_id uuid not null  
    references public.profiles(id)  
    on delete cascade,

  assigned\_host\_id uuid  
    references public.profiles(id)  
    on delete set null,

  title text not null  
    check (char\_length(title) between 3 and 140),

  description text,

  address\_json jsonb not null default '{}'::jsonb,

  latitude double precision  
    check (latitude is null or latitude between \-90 and 90),

  longitude double precision  
    check (longitude is null or longitude between \-180 and 180),

  bedrooms integer not null default 1  
    check (bedrooms \>= 0 and bedrooms \<= 100),

  bathrooms numeric(4,1) not null default 1  
    check (bathrooms \>= 0 and bathrooms \<= 100),

  max\_guests integer not null default 2  
    check (max\_guests \>= 1 and max\_guests \<= 100),

  amenities text\[\] not null default '{}',

  \-- Integer minor currency units.  
  base\_price\_minor bigint not null  
    check (base\_price\_minor \> 0),

  min\_price\_minor bigint not null  
    check (min\_price\_minor \> 0),

  max\_price\_minor bigint not null  
    check (max\_price\_minor \> 0),

  currency char(3) not null default 'USD'  
    check (currency \= upper(currency)),

  cleaning\_fee\_minor bigint not null default 0  
    check (cleaning\_fee\_minor \>= 0),

  status public.property\_state not null default 'draft',

  \-- Storage object paths, never signed/public URLs.  
  photos text\[\] not null default '{}',  
  cover\_photo text,

  vision\_analysis jsonb not null default '{}'::jsonb,  
  vision\_status public.vision\_state not null default 'pending',  
  vision\_analyzed\_at timestamptz,  
  vision\_model text,  
  vision\_schema\_version integer,  
  vision\_photos\_hash text,

  created\_at timestamptz not null default now(),  
  updated\_at timestamptz not null default now(),

  constraint properties\_price\_band\_check  
    check (  
      min\_price\_minor \<= base\_price\_minor  
      and base\_price\_minor \<= max\_price\_minor  
    )  
);

create index properties\_owner\_idx  
  on public.properties(owner\_id);

create index properties\_assigned\_host\_idx  
  on public.properties(assigned\_host\_id);

create index properties\_public\_status\_idx  
  on public.properties(status)  
  where status in ('listed', 'managed');

create index properties\_amenities\_idx  
  on public.properties using gin(amenities);

create index properties\_vision\_idx  
  on public.properties  
  using gin(vision\_analysis jsonb\_path\_ops);

create trigger properties\_updated\_at  
before update on public.properties  
for each row execute function public.set\_updated\_at();

create or replace function public.owns\_property(property\_uuid uuid)  
returns boolean  
language sql  
stable  
security definer  
set search\_path \= ''  
as $$  
  select exists (  
    select 1  
    from public.properties p  
    where p.id \= property\_uuid  
      and p.owner\_id \= auth.uid()  
  )  
$$;

create or replace function public.manages\_property(property\_uuid uuid)  
returns boolean  
language sql  
stable  
security definer  
set search\_path \= ''  
as $$  
  select exists (  
    select 1  
    from public.properties p  
    where p.id \= property\_uuid  
      and (  
        p.owner\_id \= auth.uid()  
        or p.assigned\_host\_id \= auth.uid()  
      )  
  )  
$$;

\-- \============================================================  
\-- AVAILABILITY  
\-- \============================================================

create table public.availability\_blocks (  
  id uuid primary key default gen\_random\_uuid(),

  property\_id uuid not null  
    references public.properties(id)  
    on delete cascade,

  start\_date date not null,  
  end\_date date not null,

  reason text,

  created\_by uuid  
    references public.profiles(id)  
    on delete set null,

  created\_at timestamptz not null default now(),

  check (end\_date \> start\_date),

  constraint availability\_no\_overlap  
  exclude using gist (  
    property\_id with \=,  
    daterange(start\_date, end\_date, '\[)') with &&  
  )  
);

create index availability\_property\_idx  
  on public.availability\_blocks(property\_id, start\_date);

\-- \============================================================  
\-- BOOKINGS  
\-- \============================================================

create table public.bookings (  
  id uuid primary key default gen\_random\_uuid(),

  property\_id uuid not null  
    references public.properties(id)  
    on delete restrict,

  guest\_id uuid not null  
    references public.profiles(id)  
    on delete restrict,

  host\_id uuid  
    references public.profiles(id)  
    on delete set null,

  owner\_id uuid not null  
    references public.profiles(id)  
    on delete restrict,

  checkin date not null,  
  checkout date not null,

  nights integer generated always as (checkout \- checkin) stored,

  guests\_count integer not null default 1  
    check (guests\_count \> 0),

  per\_night\_rate\_minor bigint not null  
    check (per\_night\_rate\_minor \>= 0),

  nightly\_subtotal\_minor bigint not null  
    check (nightly\_subtotal\_minor \>= 0),

  cleaning\_fee\_minor bigint not null default 0  
    check (cleaning\_fee\_minor \>= 0),

  taxes\_minor bigint not null default 0  
    check (taxes\_minor \>= 0),

  total\_amount\_minor bigint not null  
    check (total\_amount\_minor \>= 0),

  currency char(3) not null  
    check (currency \= upper(currency)),

  status public.booking\_state not null default 'pending\_payment',

  stripe\_payment\_intent\_id text unique,

  cancellation\_policy\_key text not null,  
  cancellation\_policy\_version integer not null,

  cancellation\_policy\_snapshot jsonb not null default '{}'::jsonb,

  cancelled\_at timestamptz,  
  cancelled\_by uuid references public.profiles(id),

  refund\_amount\_minor bigint  
    check (  
      refund\_amount\_minor is null  
      or refund\_amount\_minor \>= 0  
    ),

  guest\_preferences jsonb not null default '{}'::jsonb,

  created\_at timestamptz not null default now(),  
  updated\_at timestamptz not null default now(),

  check (checkout \> checkin),

  constraint booking\_refund\_not\_above\_total  
    check (  
      refund\_amount\_minor is null  
      or refund\_amount\_minor \<= total\_amount\_minor  
    ),

  constraint no\_double\_booking  
  exclude using gist (  
    property\_id with \=,  
    daterange(checkin, checkout, '\[)') with &&  
  )  
  where (  
    status in (  
      'reserved',  
      'confirmed',  
      'checked\_in',  
      'checked\_out',  
      'completed'  
    )  
  )  
);

create index bookings\_property\_date\_idx  
  on public.bookings(property\_id, checkin);

create index bookings\_guest\_idx  
  on public.bookings(guest\_id, created\_at desc);

create index bookings\_owner\_idx  
  on public.bookings(owner\_id, created\_at desc);

create index bookings\_host\_idx  
  on public.bookings(host\_id, created\_at desc);

create index bookings\_status\_idx  
  on public.bookings(status);

create trigger bookings\_updated\_at  
before update on public.bookings  
for each row execute function public.set\_updated\_at();

\-- \============================================================  
\-- BOOKING INSPECTIONS  
\-- \============================================================

create table public.booking\_inspections (  
  id uuid primary key default gen\_random\_uuid(),

  booking\_id uuid not null  
    references public.bookings(id)  
    on delete cascade,

  kind text not null  
    check (kind in ('check\_in', 'check\_out')),

  photos text\[\] not null default '{}',  
  notes text,

  submitted\_by uuid not null  
    references public.profiles(id)  
    on delete restrict,

  submitted\_at timestamptz not null default now(),

  unique (booking\_id, kind)  
);

create index booking\_inspections\_booking\_idx  
  on public.booking\_inspections(booking\_id);

\-- \============================================================  
\-- HOST APPLICATIONS  
\-- \============================================================

create table public.host\_applications (  
  id uuid primary key default gen\_random\_uuid(),

  property\_id uuid not null  
    references public.properties(id)  
    on delete cascade,

  host\_id uuid not null  
    references public.profiles(id)  
    on delete cascade,

  status public.application\_state not null default 'applied',

  proposed\_fee\_pct numeric(5,2) not null  
    check (proposed\_fee\_pct between 0 and 50),

  pitch\_text text,

  ai\_match\_score numeric(5,2)  
    check (  
      ai\_match\_score is null  
      or ai\_match\_score between 0 and 100  
    ),

  ai\_match\_reasoning text,  
  ai\_model text,  
  ai\_scored\_at timestamptz,

  created\_at timestamptz not null default now(),  
  responded\_at timestamptz,

  unique (property\_id, host\_id)  
);

create index host\_applications\_property\_idx  
  on public.host\_applications(property\_id, created\_at desc);

create index host\_applications\_host\_idx  
  on public.host\_applications(host\_id, created\_at desc);

\-- Database-level KYC enforcement.  
create or replace function public.enforce\_host\_application\_kyc()  
returns trigger  
language plpgsql  
security definer  
set search\_path \= ''  
as $$  
begin  
  if new.host\_id \<\> auth.uid()  
     and auth.role() \<\> 'service\_role' then  
    raise exception 'HOST\_ID\_MISMATCH'  
      using errcode \= 'P0001';  
  end if;

  if not exists (  
    select 1  
    from public.profiles p  
    where p.id \= new.host\_id  
      and p.role \= 'host'  
      and p.kyc\_status \= 'verified'  
  ) then  
    raise exception 'HOST\_NOT\_VERIFIED'  
      using errcode \= 'P0001';  
  end if;

  return new;  
end;  
$$;

create trigger host\_application\_requires\_kyc  
before insert on public.host\_applications  
for each row execute function public.enforce\_host\_application\_kyc();

\-- \============================================================  
\-- MESSAGING  
\-- \============================================================

create table public.message\_threads (  
  id uuid primary key default gen\_random\_uuid(),

  booking\_id uuid  
    references public.bookings(id)  
    on delete set null,

  property\_id uuid  
    references public.properties(id)  
    on delete set null,

  subject text,

  created\_at timestamptz not null default now(),  
  updated\_at timestamptz not null default now()  
);

create trigger message\_threads\_updated\_at  
before update on public.message\_threads  
for each row execute function public.set\_updated\_at();

create table public.thread\_participants (  
  thread\_id uuid not null  
    references public.message\_threads(id)  
    on delete cascade,

  user\_id uuid not null  
    references public.profiles(id)  
    on delete cascade,

  last\_read\_at timestamptz,

  primary key (thread\_id, user\_id)  
);

create index thread\_participants\_user\_idx  
  on public.thread\_participants(user\_id);

create table public.messages (  
  id uuid primary key default gen\_random\_uuid(),

  thread\_id uuid not null  
    references public.message\_threads(id)  
    on delete cascade,

  sender\_id uuid not null  
    references public.profiles(id)  
    on delete cascade,

  content text not null  
    check (char\_length(content) between 1 and 5000),

  media\_path text,

  created\_at timestamptz not null default now()  
);

create index messages\_thread\_created\_idx  
  on public.messages(thread\_id, created\_at desc);

create or replace function public.is\_thread\_participant(thread\_uuid uuid)  
returns boolean  
language sql  
stable  
security definer  
set search\_path \= ''  
as $$  
  select exists (  
    select 1  
    from public.thread\_participants tp  
    where tp.thread\_id \= thread\_uuid  
      and tp.user\_id \= auth.uid()  
  )  
$$;

\-- \============================================================  
\-- REVIEWS  
\-- \============================================================

create table public.reviews (  
  id uuid primary key default gen\_random\_uuid(),

  booking\_id uuid not null  
    references public.bookings(id)  
    on delete cascade,

  reviewer\_id uuid not null  
    references public.profiles(id)  
    on delete cascade,

  target\_type text not null  
    check (target\_type in ('property', 'host', 'guest')),

  target\_id uuid not null,

  rating integer not null  
    check (rating between 1 and 5),

  comment text,

  created\_at timestamptz not null default now(),

  unique (booking\_id, reviewer\_id, target\_type)  
);

create index reviews\_booking\_idx  
  on public.reviews(booking\_id);

\-- \============================================================  
\-- PAYOUTS  
\-- \============================================================

create table public.payouts (  
  id uuid primary key default gen\_random\_uuid(),

  booking\_id uuid not null unique  
    references public.bookings(id)  
    on delete restrict,

  owner\_id uuid not null  
    references public.profiles(id)  
    on delete restrict,

  host\_id uuid  
    references public.profiles(id)  
    on delete restrict,

  \-- Amount being distributed among owner/host/platform.  
  settlement\_base\_minor bigint not null  
    check (settlement\_base\_minor \>= 0),

  owner\_amount\_minor bigint not null  
    check (owner\_amount\_minor \>= 0),

  host\_amount\_minor bigint not null default 0  
    check (host\_amount\_minor \>= 0),

  platform\_amount\_minor bigint not null  
    check (platform\_amount\_minor \>= 0),

  owner\_pct\_snapshot numeric(7,4) not null  
    check (owner\_pct\_snapshot between 0 and 100),

  host\_pct\_snapshot numeric(7,4) not null  
    check (host\_pct\_snapshot between 0 and 100),

  platform\_pct\_snapshot numeric(7,4) not null  
    check (platform\_pct\_snapshot between 0 and 100),

  currency char(3) not null  
    check (currency \= upper(currency)),

  status public.payout\_state not null default 'held',

  releasable\_at timestamptz not null,

  stripe\_transfer\_owner\_id text unique,  
  stripe\_transfer\_host\_id text unique,

  failure\_reason text,

  released\_at timestamptz,  
  created\_at timestamptz not null default now(),

  constraint payout\_amounts\_reconcile  
    check (  
      owner\_amount\_minor  
      \+ host\_amount\_minor  
      \+ platform\_amount\_minor  
      \= settlement\_base\_minor  
    ),

  constraint payout\_percentage\_snapshot\_sane  
    check (  
      round(  
        owner\_pct\_snapshot  
        \+ host\_pct\_snapshot  
        \+ platform\_pct\_snapshot,  
        4  
      ) \= 100.0000  
    )  
);

create index payouts\_status\_releasable\_idx  
  on public.payouts(status, releasable\_at);

create index payouts\_owner\_idx  
  on public.payouts(owner\_id);

create index payouts\_host\_idx  
  on public.payouts(host\_id);

\-- \============================================================  
\-- DISPUTES  
\-- \============================================================

create table public.disputes (  
  id uuid primary key default gen\_random\_uuid(),

  booking\_id uuid not null  
    references public.bookings(id)  
    on delete cascade,

  claimant\_id uuid not null  
    references public.profiles(id)  
    on delete restrict,

  respondent\_id uuid not null  
    references public.profiles(id)  
    on delete restrict,

  amount\_claimed\_minor bigint not null  
    check (amount\_claimed\_minor \>= 0),

  description text not null  
    check (char\_length(description) between 1 and 10000),

  status public.dispute\_state not null default 'open',

  ai\_assessment jsonb,  
  ai\_model text,  
  ai\_assessed\_at timestamptz,

  admin\_decision text,

  admin\_award\_claimant\_minor bigint  
    check (  
      admin\_award\_claimant\_minor is null  
      or admin\_award\_claimant\_minor \>= 0  
    ),

  resolved\_by uuid  
    references public.profiles(id)  
    on delete set null,

  resolved\_at timestamptz,

  created\_at timestamptz not null default now()  
);

create index disputes\_booking\_idx  
  on public.disputes(booking\_id);

create index disputes\_open\_idx  
  on public.disputes(status, created\_at)  
  where status in ('open', 'under\_review');

create or replace function public.freeze\_payout\_on\_dispute()  
returns trigger  
language plpgsql  
security definer  
set search\_path \= ''  
as $$  
begin  
  update public.payouts  
  set status \= 'frozen'  
  where booking\_id \= new.booking\_id  
    and status in ('held', 'releasable');

  return new;  
end;  
$$;

create trigger dispute\_freezes\_payout  
after insert on public.disputes  
for each row execute function public.freeze\_payout\_on\_dispute();

\-- \============================================================  
\-- PRICING  
\-- \============================================================

create table public.pricing\_signals (  
  id bigint generated always as identity primary key,

  property\_id uuid not null  
    references public.properties(id)  
    on delete cascade,

  signal\_date date not null,

  signal\_type text not null,

  value\_decimal numeric(18,6),  
  value\_text text,  
  value\_json jsonb,

  confidence real  
    check (confidence is null or confidence between 0 and 1),

  collected\_at timestamptz not null default now(),

  unique (property\_id, signal\_date, signal\_type)  
);

create index pricing\_signals\_property\_idx  
  on public.pricing\_signals(property\_id, signal\_date desc);

create table public.price\_suggestions (  
  id bigint generated always as identity primary key,

  property\_id uuid not null  
    references public.properties(id)  
    on delete cascade,

  stay\_date date not null,

  current\_price\_minor bigint not null  
    check (current\_price\_minor \>= 0),

  suggested\_price\_minor bigint not null  
    check (suggested\_price\_minor \>= 0),

  price\_low\_minor bigint not null  
    check (price\_low\_minor \>= 0),

  price\_high\_minor bigint not null  
    check (price\_high\_minor \>= 0),

  confidence text not null  
    check (confidence in ('low', 'medium', 'high')),

  reasoning\_trace jsonb not null,  
  multipliers jsonb not null,

  model text,

  status text not null default 'pending'  
    check (  
      status in (  
        'pending',  
        'applied',  
        'rejected',  
        'superseded'  
      )  
    ),

  applied\_at timestamptz,  
  applied\_by uuid references public.profiles(id),

  created\_at timestamptz not null default now(),

  constraint price\_suggestion\_range  
    check (  
      price\_low\_minor  
      \<= suggested\_price\_minor  
      and suggested\_price\_minor  
      \<= price\_high\_minor  
    )  
);

create index price\_suggestions\_pending\_idx  
  on public.price\_suggestions(property\_id, stay\_date)  
  where status \= 'pending';

create table public.price\_calendar (  
  property\_id uuid not null  
    references public.properties(id)  
    on delete cascade,

  stay\_date date not null,

  price\_minor bigint not null  
    check (price\_minor \> 0),

  source text not null  
    check (source in ('base', 'manual', 'ai\_applied')),

  updated\_at timestamptz not null default now(),

  primary key (property\_id, stay\_date)  
);

create table public.pricing\_rules (  
  property\_id uuid primary key  
    references public.properties(id)  
    on delete cascade,

  auto\_apply boolean not null default false,

  auto\_apply\_threshold\_pct numeric(6,2) not null default 15  
    check (auto\_apply\_threshold\_pct between 0 and 100),

  enable\_event\_pricing boolean not null default true,  
  enable\_seasonality boolean not null default true,  
  enable\_vision\_adjust boolean not null default true,  
  enable\_weather boolean not null default true,

  floor\_price\_minor bigint  
    check (floor\_price\_minor is null or floor\_price\_minor \> 0),

  ceiling\_price\_minor bigint  
    check (ceiling\_price\_minor is null or ceiling\_price\_minor \> 0),

  updated\_by uuid references public.profiles(id),

  updated\_at timestamptz not null default now(),

  check (  
    floor\_price\_minor is null  
    or ceiling\_price\_minor is null  
    or floor\_price\_minor \<= ceiling\_price\_minor  
  )  
);

create trigger pricing\_rules\_updated\_at  
before update on public.pricing\_rules  
for each row execute function public.set\_updated\_at();

create table public.property\_comps (  
  id uuid primary key default gen\_random\_uuid(),

  property\_id uuid not null  
    references public.properties(id)  
    on delete cascade,

  url text,  
  bedrooms integer check (bedrooms is null or bedrooms \>= 0),

  observed\_rate\_minor bigint not null  
    check (observed\_rate\_minor \> 0),

  currency char(3) not null  
    check (currency \= upper(currency)),

  observed\_on date not null,

  notes text,

  created\_by uuid not null  
    references public.profiles(id)  
    on delete restrict,

  created\_at timestamptz not null default now(),  
  updated\_at timestamptz not null default now()  
);

create index property\_comps\_property\_idx  
  on public.property\_comps(property\_id);

create trigger property\_comps\_updated\_at  
before update on public.property\_comps  
for each row execute function public.set\_updated\_at();

\-- \============================================================  
\-- KYC  
\-- \============================================================

create table public.kyc\_verifications (  
  id uuid primary key default gen\_random\_uuid(),

  user\_id uuid not null  
    references public.profiles(id)  
    on delete cascade,

  provider text not null,  
  provider\_session\_id text unique,

  status public.kyc\_state not null default 'pending',

  document\_type text,  
  selfie\_match boolean,  
  address\_verified boolean,

  failure\_code text,

  admin\_review\_notes text,

  reviewed\_by uuid  
    references public.profiles(id)  
    on delete set null,

  verified\_at timestamptz,

  created\_at timestamptz not null default now(),  
  updated\_at timestamptz not null default now()  
);

create index kyc\_user\_idx  
  on public.kyc\_verifications(user\_id, created\_at desc);

create trigger kyc\_updated\_at  
before update on public.kyc\_verifications  
for each row execute function public.set\_updated\_at();

\-- \============================================================  
\-- WEBHOOK IDEMPOTENCY  
\-- \============================================================

create table public.processed\_webhook\_events (  
  id bigint generated always as identity primary key,

  provider text not null,  
  event\_id text not null,  
  event\_type text not null,

  payload\_hash text,

  processing\_status public.webhook\_processing\_state  
    not null default 'processing',

  error\_code text,

  created\_at timestamptz not null default now(),  
  processed\_at timestamptz,

  unique (provider, event\_id)  
);

create index webhook\_status\_idx  
  on public.processed\_webhook\_events(  
    provider,  
    processing\_status,  
    created\_at  
  );

\-- \============================================================  
\-- PLATFORM SETTINGS  
\-- \============================================================

create table public.platform\_settings (  
  key text primary key,  
  value\_json jsonb not null,  
  description text,  
  updated\_by uuid references public.profiles(id),  
  updated\_at timestamptz not null default now()  
);

\-- Seed policy defaults.  
\-- These are configurable product defaults, not architectural truth.

insert into public.platform\_settings (  
  key,  
  value\_json,  
  description  
)  
values  
(  
  'revenue\_split',  
  '{"owner\_pct":82,"host\_pct":15,"platform\_pct":3}'::jsonb,  
  'Default marketplace settlement split. Snapshot onto each payout.'  
),  
(  
  'payout\_policy',  
  '{"release\_hours\_after\_checkout":24}'::jsonb,  
  'Default delayed payout timing.'  
),  
(  
  'pricing\_ai\_limits',  
  '{"ai\_max\_adjustment\_pct":15,"vision\_max\_contribution\_pct":30}'::jsonb,  
  'Maximum configured AI and vision pricing influence.'  
)  
on conflict (key) do nothing;

\-- \============================================================  
\-- AUDIT LOG  
\-- \============================================================

create table public.audit\_logs (  
  id bigint generated always as identity primary key,

  actor\_id uuid  
    references public.profiles(id)  
    on delete set null,

  action text not null,

  entity\_type text,  
  entity\_id uuid,

  old\_values jsonb,  
  new\_values jsonb,

  request\_id text,  
  ip\_address inet,  
  user\_agent text,

  created\_at timestamptz not null default now()  
);

create index audit\_entity\_idx  
  on public.audit\_logs(  
    entity\_type,  
    entity\_id,  
    created\_at desc  
  );

create index audit\_actor\_idx  
  on public.audit\_logs(  
    actor\_id,  
    created\_at desc  
  );

\-- \============================================================  
\-- PUBLIC PROFILE VIEW  
\-- \============================================================

\-- Do not expose profiles directly to anonymous/public users.

create view public.public\_profiles  
with (security\_invoker \= true)  
as  
select  
  id,  
  full\_name,  
  avatar\_path,  
  bio,  
  rating\_avg,  
  rating\_count,  
  case  
    when kyc\_status \= 'verified' then true  
    else false  
  end as identity\_verified  
from public.profiles;

commit;  
\`\`\`

There is one adjustment I recommend when actually applying that migration: put the first definition of \`owns\_property()\` after \`properties\` is created. I included the later valid definition to make the intended helper placement obvious, but there is no benefit to defining it twice in the production migration. The coding agent should keep only the post-properties version.

Now the important part: RLS.

PART B — \`supabase/migrations/0002\_rls.sql\`

The major security change compared with v4 is that authenticated users do not get broad UPDATE access to security-sensitive records.

\`\`\`sql  
\-- NEST v5  
\-- 0002\_rls.sql  
\--  
\-- Principle:  
\-- RLS determines WHICH ROWS a caller can touch.  
\-- Column privileges / trusted server routes determine WHAT  
\-- sensitive fields they are allowed to change.

begin;

\-- \============================================================  
\-- ENABLE RLS EVERYWHERE  
\-- \============================================================

alter table public.profiles enable row level security;  
alter table public.properties enable row level security;  
alter table public.availability\_blocks enable row level security;  
alter table public.bookings enable row level security;  
alter table public.booking\_inspections enable row level security;  
alter table public.host\_applications enable row level security;  
alter table public.message\_threads enable row level security;  
alter table public.thread\_participants enable row level security;  
alter table public.messages enable row level security;  
alter table public.reviews enable row level security;  
alter table public.payouts enable row level security;  
alter table public.disputes enable row level security;  
alter table public.pricing\_signals enable row level security;  
alter table public.price\_suggestions enable row level security;  
alter table public.price\_calendar enable row level security;  
alter table public.pricing\_rules enable row level security;  
alter table public.property\_comps enable row level security;  
alter table public.kyc\_verifications enable row level security;  
alter table public.processed\_webhook\_events enable row level security;  
alter table public.platform\_settings enable row level security;  
alter table public.audit\_logs enable row level security;

\-- Force table owners to respect RLS during ordinary testing.  
\-- Service-role behavior must still be understood separately.

alter table public.profiles force row level security;  
alter table public.properties force row level security;  
alter table public.availability\_blocks force row level security;  
alter table public.bookings force row level security;  
alter table public.booking\_inspections force row level security;  
alter table public.host\_applications force row level security;  
alter table public.message\_threads force row level security;  
alter table public.thread\_participants force row level security;  
alter table public.messages force row level security;  
alter table public.reviews force row level security;  
alter table public.payouts force row level security;  
alter table public.disputes force row level security;  
alter table public.pricing\_signals force row level security;  
alter table public.price\_suggestions force row level security;  
alter table public.price\_calendar force row level security;  
alter table public.pricing\_rules force row level security;  
alter table public.property\_comps force row level security;  
alter table public.kyc\_verifications force row level security;  
alter table public.processed\_webhook\_events force row level security;  
alter table public.platform\_settings force row level security;  
alter table public.audit\_logs force row level security;

\-- \============================================================  
\-- PROFILES  
\-- \============================================================

\-- A signed-in user sees their complete profile.  
create policy profiles\_self\_select  
on public.profiles  
for select  
to authenticated  
using (id \= auth.uid());

\-- Admin server/user sees profiles.  
create policy profiles\_admin\_select  
on public.profiles  
for select  
to authenticated  
using (public.is\_admin());

\-- Do NOT provide a broad self-update policy.  
\-- Profile edits should use a restricted RPC/server endpoint that only  
\-- allows safe fields such as full\_name, avatar\_path, location\_json, bio.  
\--  
\-- In particular the browser must never directly update:  
\-- role  
\-- kyc\_status  
\-- kyc\_verified\_at  
\-- stripe\_connect\_id  
\-- stripe\_customer\_id  
\-- ratings

\-- \============================================================  
\-- PROPERTIES  
\-- \============================================================

create policy properties\_public\_select  
on public.properties  
for select  
to anon, authenticated  
using (  
  status in ('listed', 'managed')  
  or owner\_id \= auth.uid()  
  or assigned\_host\_id \= auth.uid()  
  or public.is\_admin()  
);

create policy properties\_owner\_insert  
on public.properties  
for insert  
to authenticated  
with check (  
  owner\_id \= auth.uid()  
  and public.current\_user\_role() \= 'owner'  
);

\-- Deliberately no broad authenticated UPDATE policy.  
\-- Property mutations go through the property API/server boundary.  
\--  
\-- This prevents an owner from directly modifying:  
\-- assigned\_host\_id  
\-- vision\_analysis  
\-- vision\_model  
\-- vision\_status  
\-- moderation-sensitive status  
\--  
\-- The server may expose explicitly allowed editable fields.

\-- \============================================================  
\-- AVAILABILITY  
\-- \============================================================

create policy availability\_public\_select  
on public.availability\_blocks  
for select  
to anon, authenticated  
using (true);

create policy availability\_manager\_insert  
on public.availability\_blocks  
for insert  
to authenticated  
with check (  
  public.manages\_property(property\_id)  
  and created\_by \= auth.uid()  
);

create policy availability\_manager\_delete  
on public.availability\_blocks  
for delete  
to authenticated  
using (public.manages\_property(property\_id));

\-- Updates can be modeled as delete \+ insert, reducing ambiguity.

\-- \============================================================  
\-- BOOKINGS  
\-- \============================================================

create policy bookings\_party\_select  
on public.bookings  
for select  
to authenticated  
using (  
  guest\_id \= auth.uid()  
  or owner\_id \= auth.uid()  
  or host\_id \= auth.uid()  
  or public.is\_admin()  
);

\-- NO client insert.  
\--  
\-- Booking creation must go through POST /api/bookings.  
\-- That endpoint calculates:  
\-- owner\_id  
\-- host\_id  
\-- nightly price  
\-- fees  
\-- taxes  
\-- total  
\-- cancellation policy  
\--  
\-- The browser must never be allowed to INSERT those values directly.

\-- NO client update.  
\--  
\-- Booking state, totals, refunds and Stripe IDs are trusted-server only.

\-- \============================================================  
\-- BOOKING INSPECTIONS  
\-- \============================================================

create policy inspections\_party\_select  
on public.booking\_inspections  
for select  
to authenticated  
using (  
  exists (  
    select 1  
    from public.bookings b  
    where b.id \= booking\_id  
      and (  
        b.guest\_id \= auth.uid()  
        or b.owner\_id \= auth.uid()  
        or b.host\_id \= auth.uid()  
      )  
  )  
  or public.is\_admin()  
);

create policy inspections\_party\_insert  
on public.booking\_inspections  
for insert  
to authenticated  
with check (  
  submitted\_by \= auth.uid()  
  and exists (  
    select 1  
    from public.bookings b  
    where b.id \= booking\_id  
      and (  
        b.guest\_id \= auth.uid()  
        or b.owner\_id \= auth.uid()  
        or b.host\_id \= auth.uid()  
      )  
      and b.status in (  
        'confirmed',  
        'checked\_in',  
        'checked\_out'  
      )  
  )  
);

\-- Inspection modification/deletion is intentionally restricted.  
\-- Evidence should not silently change after submission.

\-- \============================================================  
\-- HOST APPLICATIONS  
\-- \============================================================

create policy applications\_visible  
on public.host\_applications  
for select  
to authenticated  
using (  
  host\_id \= auth.uid()  
  or public.owns\_property(property\_id)  
  or public.is\_admin()  
);

create policy applications\_host\_insert  
on public.host\_applications  
for insert  
to authenticated  
with check (  
  host\_id \= auth.uid()  
  and public.current\_user\_role() \= 'host'  
  and status \= 'applied'  
  and ai\_match\_score is null  
  and ai\_match\_reasoning is null  
  and ai\_model is null  
  and ai\_scored\_at is null  
);

\-- Withdrawal and owner acceptance/rejection happen through trusted routes.  
\--  
\-- This prevents a host from directly changing:  
\-- status  
\-- AI score  
\-- AI reasoning  
\--  
\-- It also prevents an owner from assigning themselves arbitrary AI data.

\-- \============================================================  
\-- THREADS / MESSAGES  
\-- \============================================================

create policy threads\_participant\_select  
on public.message\_threads  
for select  
to authenticated  
using (  
  public.is\_thread\_participant(id)  
  or public.is\_admin()  
);

create policy thread\_participants\_select  
on public.thread\_participants  
for select  
to authenticated  
using (  
  user\_id \= auth.uid()  
  or public.is\_thread\_participant(thread\_id)  
  or public.is\_admin()  
);

\-- Creation of threads and participant membership happens through server  
\-- routes after validating the property/booking relationship.  
\--  
\-- This prevents a user from adding arbitrary participants.

create policy messages\_participant\_select  
on public.messages  
for select  
to authenticated  
using (  
  public.is\_thread\_participant(thread\_id)  
  or public.is\_admin()  
);

create policy messages\_participant\_insert  
on public.messages  
for insert  
to authenticated  
with check (  
  sender\_id \= auth.uid()  
  and public.is\_thread\_participant(thread\_id)  
);

\-- Message editing/deleting is not supported in v1.

\-- \============================================================  
\-- REVIEWS  
\-- \============================================================

create policy reviews\_public\_select  
on public.reviews  
for select  
to anon, authenticated  
using (true);

\-- Review insertion should go through server validation because validating  
\-- target\_id correctly differs for property / host / guest.  
\--  
\-- Do not allow arbitrary direct INSERT merely because the caller was part  
\-- of the booking.

\-- \============================================================  
\-- PAYOUTS  
\-- \============================================================

create policy payouts\_party\_select  
on public.payouts  
for select  
to authenticated  
using (  
  owner\_id \= auth.uid()  
  or host\_id \= auth.uid()  
  or public.is\_admin()  
);

\-- No authenticated INSERT / UPDATE / DELETE policies.  
\--  
\-- Payout creation, release, freeze, failure and reconciliation are  
\-- trusted-server/service operations only.

\-- \============================================================  
\-- DISPUTES  
\-- \============================================================

create policy disputes\_party\_select  
on public.disputes  
for select  
to authenticated  
using (  
  claimant\_id \= auth.uid()  
  or respondent\_id \= auth.uid()  
  or public.is\_admin()  
);

\-- Dispute creation goes through POST /api/disputes.  
\--  
\-- Server derives/validates:  
\-- booking relationship  
\-- respondent  
\-- maximum claim  
\-- applicable dispute window  
\--  
\-- AI fields and final decisions are never browser writable.

\-- \============================================================  
\-- PRICING SIGNALS  
\-- \============================================================

create policy pricing\_signals\_manager\_select  
on public.pricing\_signals  
for select  
to authenticated  
using (  
  public.manages\_property(property\_id)  
  or public.is\_admin()  
);

\-- Signals are machine-written only.

\-- \============================================================  
\-- PRICE SUGGESTIONS  
\-- \============================================================

create policy price\_suggestions\_manager\_select  
on public.price\_suggestions  
for select  
to authenticated  
using (  
  public.manages\_property(property\_id)  
  or public.is\_admin()  
);

\-- Applying/rejecting suggestions occurs through trusted server logic.  
\-- No broad browser UPDATE.

\-- \============================================================  
\-- PRICE CALENDAR  
\-- \============================================================

create policy price\_calendar\_public\_select  
on public.price\_calendar  
for select  
to anon, authenticated  
using (  
  exists (  
    select 1  
    from public.properties p  
    where p.id \= property\_id  
      and (  
        p.status in ('listed', 'managed')  
        or p.owner\_id \= auth.uid()  
        or p.assigned\_host\_id \= auth.uid()  
        or public.is\_admin()  
      )  
  )  
);

\-- Calendar mutations go through pricing/property server operations.

\-- \============================================================  
\-- PRICING RULES  
\-- \============================================================

create policy pricing\_rules\_owner\_select  
on public.pricing\_rules  
for select  
to authenticated  
using (  
  public.owns\_property(property\_id)  
  or public.is\_admin()  
);

\-- Owner changes go through API/RPC so updated\_by is server-derived and  
\-- values can be checked against property price bands.

\-- \============================================================  
\-- PROPERTY COMPS  
\-- \============================================================

create policy property\_comps\_owner\_select  
on public.property\_comps  
for select  
to authenticated  
using (  
  public.owns\_property(property\_id)  
  or public.is\_admin()  
);

create policy property\_comps\_owner\_insert  
on public.property\_comps  
for insert  
to authenticated  
with check (  
  public.owns\_property(property\_id)  
  and created\_by \= auth.uid()  
);

create policy property\_comps\_owner\_delete  
on public.property\_comps  
for delete  
to authenticated  
using (  
  public.owns\_property(property\_id)  
);

\-- Changes may be delete \+ recreate, or later exposed through safe RPC.

\-- \============================================================  
\-- KYC  
\-- \============================================================

create policy kyc\_self\_select  
on public.kyc\_verifications  
for select  
to authenticated  
using (  
  user\_id \= auth.uid()  
  or public.is\_admin()  
);

\-- No client writes.  
\--  
\-- KYC state comes from verified provider webhook/server operations only.

\-- \============================================================  
\-- WEBHOOK EVENTS  
\-- \============================================================

\-- Intentionally NO policies for normal clients.  
\--  
\-- Only trusted backend/service operations should access this table.

\-- \============================================================  
\-- PLATFORM SETTINGS  
\-- \============================================================

create policy platform\_settings\_admin\_select  
on public.platform\_settings  
for select  
to authenticated  
using (public.is\_admin());

\-- No browser writes in v1.  
\-- Admin changes should use audited server routes.

\-- \============================================================  
\-- AUDIT LOG  
\-- \============================================================

create policy audit\_admin\_select  
on public.audit\_logs  
for select  
to authenticated  
using (public.is\_admin());

\-- No client insert/update/delete.  
\-- Trusted server/service operations write audit rows.

commit;  
\`\`\`

PART C — COLUMN PRIVILEGES AND SAFE PROFILE EDITING

This is the piece that Prompt 2 was missing conceptually.

RLS answers "which rows?" It does not by itself give you a pleasant field-level security model.

So rather than allowing:

\`\`\`sql  
update profiles  
set role \= 'admin'  
where id \= auth.uid();  
\`\`\`

we provide a restricted function for editable profile fields.

Add a third migration:

\`supabase/migrations/0003\_safe\_mutations.sql\`

\`\`\`sql  
\-- NEST v5  
\-- 0003\_safe\_mutations.sql

begin;

\-- \============================================================  
\-- SAFE PROFILE UPDATE  
\-- \============================================================

create or replace function public.update\_my\_profile(  
  p\_full\_name text,  
  p\_avatar\_path text,  
  p\_location\_json jsonb,  
  p\_bio text  
)  
returns public.profiles  
language plpgsql  
security definer  
set search\_path \= ''  
as $$  
declare  
  result public.profiles;  
begin  
  if auth.uid() is null then  
    raise exception 'AUTH\_REQUIRED'  
      using errcode \= 'P0001';  
  end if;

  if p\_full\_name is null  
     or char\_length(trim(p\_full\_name)) \< 1  
     or char\_length(p\_full\_name) \> 120 then  
    raise exception 'INVALID\_FULL\_NAME'  
      using errcode \= 'P0001';  
  end if;

  update public.profiles  
  set  
    full\_name \= trim(p\_full\_name),  
    avatar\_path \= p\_avatar\_path,  
    location\_json \= coalesce(p\_location\_json, '{}'::jsonb),  
    bio \= p\_bio,  
    updated\_at \= now()  
  where id \= auth.uid()  
  returning \* into result;

  if result.id is null then  
    raise exception 'PROFILE\_NOT\_FOUND'  
      using errcode \= 'P0001';  
  end if;

  return result;  
end;  
$$;

revoke all  
on function public.update\_my\_profile(text, text, jsonb, text)  
from public;

grant execute  
on function public.update\_my\_profile(text, text, jsonb, text)  
to authenticated;

\-- \============================================================  
\-- PREVENT CLIENT TABLE WRITES TO PROFILES  
\-- \============================================================

revoke insert, update, delete  
on public.profiles  
from anon, authenticated;

\-- Existing SELECT remains governed by RLS.

\-- \============================================================  
\-- HIGH-RISK TABLE PRIVILEGES  
\-- \============================================================

revoke insert, update, delete  
on public.bookings  
from anon, authenticated;

revoke insert, update, delete  
on public.payouts  
from anon, authenticated;

revoke insert, update, delete  
on public.kyc\_verifications  
from anon, authenticated;

revoke insert, update, delete  
on public.processed\_webhook\_events  
from anon, authenticated;

revoke insert, update, delete  
on public.audit\_logs  
from anon, authenticated;

revoke insert, update, delete  
on public.platform\_settings  
from anon, authenticated;

revoke insert, update, delete  
on public.pricing\_signals  
from anon, authenticated;

\-- Keep only the intentionally exposed operations on lower-risk tables.  
\-- Explicit privileges are safer than relying on Supabase defaults.

commit;  
\`\`\`

For maximum control, I would actually have the coding agent explicitly GRANT each permitted action rather than rely on Supabase's default grants. That can be added once the exact client-vs-server write architecture has been established during Phase 1\.

PART D — STORAGE MIGRATION

Create:

\`supabase/migrations/0004\_storage.sql\`

\`\`\`sql  
\-- NEST v5  
\-- 0004\_storage.sql

begin;

insert into storage.buckets (  
  id,  
  name,  
  public,  
  file\_size\_limit,  
  allowed\_mime\_types  
)  
values  
(  
  'property-photos',  
  'property-photos',  
  false,  
  10485760,  
  array\[  
    'image/jpeg',  
    'image/png',  
    'image/webp'  
  \]  
),  
(  
  'inspection-photos',  
  'inspection-photos',  
  false,  
  10485760,  
  array\[  
    'image/jpeg',  
    'image/png',  
    'image/webp'  
  \]  
),  
(  
  'message-media',  
  'message-media',  
  false,  
  10485760,  
  array\[  
    'image/jpeg',  
    'image/png',  
    'image/webp'  
  \]  
)  
on conflict (id) do nothing;

commit;  
\`\`\`

I would not initially allow clients to arbitrarily upload into these buckets. The Next.js server should issue validated upload permissions or perform controlled uploads. That gives you a place to enforce ownership, size, file count and path format.

For example, property object paths should follow a server-generated structure such as:

\`\`\`text  
properties/{propertyId}/{uuid}.jpg  
\`\`\`

Inspection images:

\`\`\`text  
inspections/{bookingId}/{check\_in|check\_out}/{uuid}.jpg  
\`\`\`

Never trust a client-supplied \`propertyId\` without checking ownership first.

PART E — THE RLS TESTS

This part is extremely important. I would put the following requirement straight into the agent instructions.

Create:

\`tests/rls.test.ts\`

The test must create distinct test identities:

\- Alice — owner  
\- Bob — owner  
\- Hannah — verified host  
\- George — guest  
\- Grace — second guest  
\- Adam — admin

Then test both things that should work and things that absolutely must fail.

The minimum matrix is:

\`\`\`text  
Alice can read Alice's private property.  
Bob cannot read Alice's draft property.

Anonymous can read Alice's listed property.  
Anonymous cannot read Alice's draft property.

George can read George's booking.  
Grace cannot read George's booking.

George cannot alter booking.total\_amount\_minor.  
George cannot alter booking.status.  
Alice cannot alter booking.total\_amount\_minor directly.

Hannah cannot change her own kyc\_status.  
Hannah cannot change her role.  
Hannah cannot make herself admin.

Alice cannot modify vision\_analysis directly.  
Alice cannot assign an arbitrary host directly.

Hannah cannot insert an application before KYC verification.  
Hannah can insert an application after verification.

Hannah cannot set ai\_match\_score herself.

Alice can see applications to her property.  
Bob cannot see applications to Alice's private property.

Guest cannot read payout.  
Owner can read their payout.  
Host can read their payout.  
Neither can alter payout values.

Dispute party can see dispute.  
Unrelated user cannot.

Neither claimant nor respondent can alter ai\_assessment.  
Neither can set admin\_award\_claimant\_minor.

Ordinary users cannot read processed\_webhook\_events.  
Ordinary users cannot write audit\_logs.  
Ordinary users cannot alter platform\_settings.  
\`\`\`

PART F — CRITICAL BOOKING CONCURRENCY TEST

Create:

\`tests/concurrency.test.ts\`

The important test conceptually remains:

\`\`\`typescript  
test('ten concurrent attempts cannot reserve identical dates twice', async () \=\> {  
  const attempts \= Array.from(  
    { length: 10 },  
    () \=\> reserveTestBooking({  
      propertyId,  
      checkin: '2026-09-01',  
      checkout: '2026-09-05',  
    }),  
  );

  const results \= await Promise.allSettled(attempts);

  const successfulReservations \= results.filter(  
    (result) \=\> result.status \=== 'fulfilled',  
  );

  expect(successfulReservations).toHaveLength(1);  
});  
\`\`\`

But the real implementation should exercise the trusted reservation path/state transition, not simply INSERT directly into the table.

PART G — STRIPE WEBHOOK IDEMPOTENCY TEST

Create:

\`tests/webhooks.test.ts\`.

Send the same simulated verified Stripe event twice.

Expected result:

\`\`\`text  
First delivery:  
event recorded  
booking transitioned once  
financial effect performed once  
event marked processed

Second delivery:  
same event ID detected  
HTTP success returned  
no duplicate booking transition  
no duplicate transfer/refund/payment action  
\`\`\`

Then test out-of-order delivery separately.

For example:

\`\`\`text  
payment\_intent.succeeded  
arrives after a cancellation/refund has already been finalized

Result:  
server examines current state  
does not blindly resurrect booking  
records/reconciles event  
alerts operations if necessary  
\`\`\`

PART H — DATABASE VERIFICATION QUERIES

Put these into \`docs/SECURITY.md\`.

Find application tables without RLS:

\`\`\`sql  
select  
  n.nspname as schema\_name,  
  c.relname as table\_name  
from pg\_class c  
join pg\_namespace n  
  on n.oid \= c.relnamespace  
where n.nspname \= 'public'  
  and c.relkind \= 'r'  
  and not c.relrowsecurity  
order by c.relname;  
\`\`\`

Expected:

Zero application tables.

Find RLS tables with no policies:

\`\`\`sql  
select  
  n.nspname as schema\_name,  
  c.relname as table\_name  
from pg\_class c  
join pg\_namespace n  
  on n.oid \= c.relnamespace  
where n.nspname \= 'public'  
  and c.relkind \= 'r'  
  and c.relrowsecurity  
  and not exists (  
    select 1  
    from pg\_policy p  
    where p.polrelid \= c.oid  
  )  
order by c.relname;  
\`\`\`

Important nuance: in our architecture, that query may legitimately return machine-only tables if we've deliberately enabled RLS and supplied no ordinary-client policies. That is not necessarily a defect.

Therefore change the v4 rule from:

"Every table must have at least one RLS policy"

to:

"Every application table must have RLS enabled. Every client-accessible table must have explicitly tested policies. A table intentionally inaccessible to normal clients may correctly have zero client policies."

That's a much better security invariant.

Verify double-booking constraint:

\`\`\`sql  
select  
  conname,  
  convalidated  
from pg\_constraint  
where conname \= 'no\_double\_booking';  
\`\`\`

Expected:

\`\`\`text  
no\_double\_booking | true  
\`\`\`

Verify payout reconciliation constraint:

\`\`\`sql  
select  
  conname,  
  convalidated  
from pg\_constraint  
where conname \= 'payout\_amounts\_reconcile';  
\`\`\`

Expected one valid row.

PART I — ONE MORE CHANGE TO YOUR v5 SPEC

I recommend replacing this sentence from §32:

"RLS is enabled wherever required."

with:

"RLS is enabled on every application-facing table. Direct client privileges follow least privilege. Security-sensitive mutations are performed through explicitly authorized server operations or narrowly scoped RPCs. Automated negative authorization tests prove that protected fields cannot be modified by unauthorized actors."

That's much stronger because it describes the security outcome rather than simply the presence of RLS.

PART J — WHAT I WOULD HAND TO THE CODING AGENT

You now have the beginnings of four layers:

\`\`\`text  
docs/SPEC.md  
        ↓  
Database schema  
        ↓  
RLS / trusted mutation boundary  
        ↓  
Automated adversarial tests  
\`\`\`

For Phase 1, I would give the coding agent this exact instruction:

\`\`\`text  
Read docs/SPEC.md completely.

Implement Phase 1 only.

Before writing application code, implement and verify the database  
security foundation.

Use the approved v5 database design:

supabase/migrations/0001\_init.sql  
supabase/migrations/0002\_rls.sql  
supabase/migrations/0003\_safe\_mutations.sql  
supabase/migrations/0004\_storage.sql

Important:

Money is stored in integer minor currency units.

Ordinary clients do not directly mutate:  
\- roles  
\- KYC status  
\- booking financial fields or state  
\- payout records  
\- AI assessment fields  
\- vision analysis  
\- platform settings  
\- audit logs  
\- webhook processing records

Do not weaken RLS or table privileges to make UI code easier.

Do not use the Supabase service-role client from browser code.

Admin cannot be selected at signup.

Write adversarial authorization tests before declaring the  
database foundation complete.

Required negative tests include:  
\- user cannot self-promote to admin  
\- user cannot self-verify KYC  
\- guest cannot modify booking amount/status  
\- owner cannot modify payout amount  
\- property owner cannot directly forge vision\_analysis  
\- host cannot forge ai\_match\_score  
\- normal user cannot write audit\_logs  
\- normal user cannot read webhook-processing records

Apply migrations to a clean local Supabase database.

Run all authorization tests.

Then implement:  
\- Next.js application foundation  
\- strict TypeScript  
\- design tokens  
\- Supabase auth  
\- owner/host/guest signup  
\- role dashboards  
\- responsive navigation  
\- landing page

Do not implement Phase 2 features.

Before changing files, tell me:  
1\. Which files you will create.  
2\. Which files you will modify.  
3\. Any issues you see in the proposed migrations.  
4\. Which tests you will run.

Wait for my approval.  
\`\`\`

One correction should be made before you use my SQL verbatim: remove the preliminary \`owns\_property()\` function appearing before the \`properties\` table and retain only the version after \`properties\` is created. Apart from that, I would have the coding agent review the migrations against the actual pinned Supabase/PostgreSQL environment and report migration errors rather than silently rewriting security controls.

This gives Nest a much stronger foundation than the original Prompt 2: instead of merely saying "we have RLS," you are designing the application on the assumption that users will deliberately manipulate requests, IDs and database calls—and ensuring those attempts fail.

