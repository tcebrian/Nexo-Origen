# Nexo Origen — Reputation domain

## Current importance

Reputation is the first mature Nexo vertical and should become the reference implementation for future domains.

## Current data

The app works primarily with:

- `resenas`;
- `analisis_ia`;
- `resena_motivos`;
- `kpi_diario`;
- `kpi_restaurantes`;
- restaurant / brand metadata.

Public Google rating fields on restaurants are read by the app and are updated by an external process.

## Core rules

### Rating target

Current general reputation target in code:

`REPUTATION_TARGET = 4.4`

### Positive / neutral / negative

Current business convention:

- positive: 4–5 stars;
- neutral: 3 stars;
- negative: 1–2 stars.

Note: some legacy/internal functions may use broader thresholds for specific problem-analysis flows. Do not change thresholds without checking the exact consumer.

### Weighted averages

Network or multi-restaurant averages must be weighted by review volume, not computed as a simple mean of restaurant averages.

### Status

Status logic must be defined centrally and reused by dashboard, reports and alerts.

Do not create a new status formula inside a UI component.

## Review deduplication

Current code prefers `review_id` when available and falls back to a content signature.

Before changing deduplication, inspect `lib/review-metrics.ts`.

Important future requirement:
edited Google reviews may change over time. Long-term design should preserve enough source history/version information to avoid silently losing historical period truth.

## AI analysis

AI/classification can identify:

- main reason;
- impact;
- mentioned employee;
- operational issue;
- recommended action.

Deterministic calculations such as averages, counts and deltas must remain normal code.

## First migration goal

For reputation, progressively centralize:

- rating calculations;
- star counts;
- target/status logic;
- comparison logic;
- reason aggregation;
- review deduplication rules.

Then make Web, reports, alerts and WhatsApp consume those shared results.
