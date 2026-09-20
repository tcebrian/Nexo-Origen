# Nexo Origen — Architecture

## Current reality

Nexo is currently a single Next.js repository, not a multi-service platform.

Important areas already exist:

- `app/` — UI, pages and Next.js route handlers.
- `lib/auth/` — roles, permissions and data scopes.
- `lib/reviews/` — review classification and review-domain helpers.
- `lib/reports/` — report generation.
- `lib/restaurants/` — restaurant-related logic and repositories.
- `lib/supabase/` — Supabase data access.
- `lib/notifications/` — notification logic.
- `supabase/` — SQL/schema support files.
- `templates/` — visual/report templates.

The architecture should improve incrementally from this structure.

## Target logical layers

### 1. Sources
External systems: Google/Apify, POS/StoreAce, delivery systems, workforce systems, WhatsApp and future integrations.

### 2. Ingestion
Receives and normalizes external data.

Responsibilities:
- validate;
- normalize;
- deduplicate/version where needed;
- retain source identifiers;
- log failures.

### 3. Database
PostgreSQL/Supabase stores normalized operational truth and history.

### 4. Domain
Pure business logic and deterministic calculations.

Examples:
- reputation average;
- target status;
- period comparison;
- ticket average;
- labour percentage;
- service-time status.

Domain logic should not depend on UI.

### 5. Brain
Interpretation and intelligence:

- pattern detection;
- anomaly detection;
- cross-domain correlations;
- natural-language explanations;
- recommendations/hypotheses.

AI belongs here when interpretation is actually needed.

### 6. API
Stable access to Nexo capabilities.

Current Next.js route handlers can continue to serve this role while the product is smaller.

### 7. Interfaces
- Web;
- WhatsApp;
- email;
- PDF/images;
- future app.

Interfaces display or request information. They should not independently redefine business rules.

## Current migration strategy

Do not perform a big-bang rewrite.

For each domain:

1. identify current calculations and data access;
2. define one canonical implementation;
3. add tests;
4. make existing interfaces consume it;
5. remove duplicate legacy logic only after parity is verified.

## Security boundary

Current tenant isolation depends heavily on application-level scope filtering.

Therefore:

- authorization is backend logic, not visual hiding;
- client-side visibility is not a security boundary;
- changes in `lib/auth/`, Supabase repositories or scope handling require extra care;
- stronger database-level RLS can be introduced later, but current behavior must not be broken casually.

## When to split services

Do not split into separate API/worker services merely for architectural purity.

A separate worker/API becomes justified when one or more of these are real constraints:

- long-running jobs;
- queue/retry requirements;
- independent scaling;
- scheduled workloads;
- high-volume integrations;
- isolation of sensitive backend-only capabilities.

Until then, prefer a modular monolith.
