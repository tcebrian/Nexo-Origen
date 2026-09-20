# Nexo Origen — Current integrations

## Supabase

Primary backend for:

- authentication;
- profiles;
- restaurants/brands/companies;
- reviews;
- KPI tables/views;
- AI analysis records;
- authorization scope data.

Server-only service-role access exists and must never leak to client code.

## External review ingestion

Google review/public rating data is populated by an external scraper/process.

That ingestion process is not currently implemented in this repository.

The app consumes the resulting Supabase data.

## Twilio / WhatsApp

The repository includes Twilio as a dependency and environment variables for WhatsApp notifications.

Relevant secrets must stay outside Git.

## Vercel

The project includes Vercel deployment configuration.

Production changes should not be made directly or used as an experiment environment.

## AI

The repository contains AI-analysis related code and stores analysis results in Supabase.

AI should be used for interpretation/classification, not for deterministic KPI math.

## Future integrations

Expected future sources may include:

- StoreAce / POS / sales systems;
- delivery platforms;
- workforce scheduling/fichaje systems;
- service-time systems;
- official Google Business sources.

Each new integration should translate source data into Nexo's internal model instead of leaking provider-specific logic throughout the product.
