@AGENTS.md

# Nexo Origen — Claude entrypoint

Treat `AGENTS.md` as the permanent operating rules for this repository.

Do not read `PROGRESS.md` automatically. It is a historical log and can be large.
Use the focused documentation in `docs/` first, and open `PROGRESS.md` only when a task needs historical implementation details that are not documented elsewhere.

## Current project shape

- Next.js 16 App Router + React 19 + TypeScript.
- Supabase for auth and operational data.
- Current production-oriented code lives mainly in `app/`, `lib/`, `supabase/` and `templates/`.
- Existing modular areas include auth, reviews, reports, restaurants, notifications and Supabase access.
- The migration strategy is incremental: improve boundaries inside the current repo before considering a larger monorepo/service split.

## Important existing constraints

- Never instantiate a server-only Supabase client at module scope when that module can be imported by client code.
- `lib/restaurants/restaurants-repository-shared.ts` can execute in the browser; do not import server-only Supabase helpers there.
- Data access must continue respecting the existing user scope / restaurant scope model.
- The current database has some permissive RLS policies; application-level scope filtering is therefore security-critical.
- Real review data used for temporary visual testing must not be committed.

For detailed context, use the routing table in `AGENTS.md`.
