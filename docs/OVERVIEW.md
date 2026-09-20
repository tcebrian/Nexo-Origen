# Nexo Origen — Overview

## What Nexo is

Nexo Origen is a restaurant intelligence platform.

Today its strongest working vertical is online reputation. The long-term goal is to connect reputation with operational data so managers can understand not only **what is happening**, but also **why it may be happening**.

## Current product

The repository already contains a working Next.js application with:

- authentication and user roles;
- organization / brand / restaurant scoping;
- restaurant dashboards;
- review ingestion consumption from Supabase;
- reputation KPIs and period comparisons;
- review classification and AI analysis;
- alerts and notifications;
- report generation;
- image generation for negative-review alerts;
- ranking, insights and operational views;
- Supabase SQL and schema-related files.

The current product must keep working while the architecture is improved.

## Direction

Nexo should progressively unify these areas:

### Reputation
Reviews, ratings, negative-review reasons, trends, alerts, local SEO context and response workflows.

### Sales
Revenue, tickets, average ticket, channel mix, hourly sales and comparisons.

### Service times
Drive-thru / Auto, counter, kitchen, delivery and other service-time metrics.

### Labour
Hours, staffing, labour cost, labour percentage and productivity.

### Costs
Food cost and other operational costs when data is available.

## Intelligence layer

The goal is not to build isolated dashboards for each dataset.

Nexo should connect them.

Example:

Sales ↑  
Tickets ↑  
Staffing =  
Service time ↑  
Waiting complaints ↑

Nexo should be able to surface that relationship as an operational hypothesis, with the underlying evidence visible.

## Architecture principle

**Sources → Ingestion → Database → Domain → Brain → API → Interfaces**

- Database stores the operational truth.
- Domain applies deterministic business rules and calculations.
- Brain detects patterns, anomalies, correlations and produces explanations.
- API exposes capabilities.
- Web, WhatsApp, email and reports are interfaces.

A calculation should be defined once and reused everywhere.

## Migration principle

Do not rebuild everything from zero.

The current repository is already partially modular. The first objective is to strengthen boundaries inside the existing codebase, then extract services only when the operational need justifies it.

## Product principle

Nexo is not intended to replace POS, scheduling, delivery or workforce systems initially.

It should connect them, normalize their data and turn fragmented information into operational intelligence.
