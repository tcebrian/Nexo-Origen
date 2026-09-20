<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This project uses Next.js 16 and may differ from model training data.
Before changing framework-specific behavior, read the relevant guide in `node_modules/next/dist/docs/`.
Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Nexo Origen — agent rules

Nexo Origen is evolving from a reputation dashboard into a restaurant operational intelligence platform.

## Core architecture

Sources → Ingestion → Database → Domain → Brain → API → Interfaces

## Non-negotiable rules

- Inspect the current implementation before changing it.
- Do not put business rules in UI components.
- Deterministic calculations belong in domain/business code, not in AI prompts.
- AI interprets, classifies and explains; normal code calculates.
- Keep integrations decoupled from business rules.
- Never modify production directly.
- Never commit secrets, tokens, credentials or real customer data used only for testing.
- Do not remove existing functionality without a verified replacement.
- Preserve tenant isolation and authorization checks.
- Prefer small, reversible changes over large rewrites.
- Run relevant tests, typecheck and build after important changes.

## Context routing

Read only the documentation needed for the task.

- Project overview and direction → `docs/OVERVIEW.md`
- Current priorities and migration phases → `docs/ROADMAP.md`
- Architecture decisions → `docs/architecture/ARCHITECTURE.md`
- Reputation rules → `docs/business/REPUTATION.md`
- Current database model → `docs/database/CURRENT_SCHEMA.md`
- External systems → `docs/integrations/CURRENT_INTEGRATIONS.md`

`PROGRESS.md` is historical session context. Do not read it by default.
Read it only when a task depends on a past implementation detail not covered by the focused docs.

## Workflow

Before coding:
1. Inspect affected code.
2. Read only the relevant docs above.
3. Identify current behavior and dependencies.
4. Make the smallest safe plan.

After coding:
1. Run relevant tests.
2. Run `npm run typecheck`.
3. Run `npm run build` for important changes when practical.
4. Check for regressions.
5. Update the focused documentation if behavior or architecture changed.
