<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know
This project uses Next.js 16 and may differ from model training data.
Before changing framework-specific behavior, read the relevant guide in `node_modules/next/dist/docs/`.
Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Nexo Origen — agent rules

Nexo evolves from a reputation dashboard into a restaurant operational intelligence platform.

**Architecture:** Sources → Ingestion → Database → Domain → Brain → API → Interfaces

## Non-negotiable
- Inspect existing behavior before changing it.
- Business rules/calculations do not belong in UI or AI prompts.
- AI interprets; deterministic code calculates.
- Integrations adapt data; they do not define business meaning.
- Preserve tenant isolation and backend authorization.
- Never commit secrets, tokens or temporary real customer data.
- Never modify production directly.
- Prefer small, reversible changes; verify before removing legacy behavior.

## Read only what the task needs
- Direction → `docs/OVERVIEW.md`
- Priorities → `docs/ROADMAP.md`
- Architecture → `docs/architecture/ARCHITECTURE.md`
- KPI/formula rules → `docs/business/BUSINESS_RULES.md`
- Reputation → `docs/business/REPUTATION.md`
- Existing Supabase → `docs/database/CURRENT_SCHEMA.md`
- New data-model design → `docs/database/DATA_MODEL.md`
- Existing integrations → `docs/integrations/CURRENT_INTEGRATIONS.md`
- New/provider integration work → `docs/integrations/INTEGRATION_RULES.md`

For KPI/formula/status changes, read BUSINESS_RULES + the domain doc.
For provider/webhook/WhatsApp/Make/API changes, read both integration docs.
For existing DB changes, read CURRENT_SCHEMA; for new tables/domains, also read DATA_MODEL.
Never treat future structures in DATA_MODEL as already deployed.

`PROGRESS.md` is historical context. Do not read it by default.

## Workflow
Before coding: inspect affected code → read focused docs → identify current behavior/dependencies → make the smallest safe plan.
After coding: run relevant tests + `npm run typecheck`; run `npm run build` for important changes when practical; check regressions; update focused docs when behavior/architecture changes.
