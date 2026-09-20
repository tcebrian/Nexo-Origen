# Nexo Origen — Current database model

This document describes the database shape visible from the current repository. It is not yet a complete production data dictionary.

## Core hierarchy

Current business hierarchy is effectively:

**empresa → marca → restaurante**

Important current peculiarity:

- `restaurantes` contains `empresa_id` and `marca_id`;
- `marcas` currently does **not** contain `empresa_id`;
- therefore company↔brand relationships are derived through restaurants.

Do not assume a direct `marcas.empresa_id` relation exists.

## Tables/views referenced by the app

From `lib/supabase/tables.ts`:

### Tables

- `empresas`
- `marcas`
- `restaurantes`
- `resenas`
- `kpi_diario`
- `dashboard_kpis`
- `perfiles`
- `analisis_ia`
- `resena_motivos`
- `usuario_marcas`
- `usuario_restaurantes`

### Views

- `kpi_restaurantes`

## Auth and roles

The application currently uses these roles:

- `super_admin`
- `empresa_admin`
- `marca_admin`
- `restaurante_user`

User scope is resolved in `lib/auth/scopes.ts`.

Assignments can come from:

- `perfiles.empresa_id`;
- `usuario_marcas`;
- `usuario_restaurantes`.

## Security reality

Several production-facing tables currently have permissive SELECT RLS policies for `anon` / `authenticated`.

The application therefore relies heavily on server/application scope filtering in `lib/auth/data-scope.ts`.

Treat that code as security-sensitive.

## External ownership

Review/public Google data is populated by an external process that does not currently live in this repository.

The application mainly consumes those records.

## Future modeling direction

As Nexo expands, new operational domains should preserve:

- source system identifiers;
- organization / brand / restaurant ownership where relevant;
- timestamps and period semantics;
- raw source payload/history when useful for reprocessing;
- normalized records used by business logic.

For reviews specifically, consider explicit version/history support for edited source reviews before relying on current snapshots for historical truth.
