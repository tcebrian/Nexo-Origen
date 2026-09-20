# Nexo Origen — Roadmap

This file describes direction and current migration priority. It is not a session log.

## NOW — Foundation

Goal: make the current codebase easier and safer for humans and coding agents to evolve.

Priorities:

- focused project documentation;
- clear business/domain boundaries;
- explicit data-access boundaries;
- preserve current auth and tenant scoping;
- keep production behavior unchanged;
- reduce duplicated calculations;
- establish a safer migration path for future modules;
- keep `PROGRESS.md` as history instead of mandatory context.

## NEXT — Reputation vertical hardening

Goal: make reputation the first fully structured Nexo domain.

Work includes:

- centralize reputation business rules;
- centralize target/status logic;
- document review deduplication/version assumptions;
- separate data access from calculations;
- keep Web / reports / alerts consuming the same rules;
- add tests for critical calculations.

## AFTER — Sales

Add a normalized sales model:

- revenue;
- tickets;
- average ticket;
- channels;
- hourly/daypart views;
- comparisons and targets.

Do not build sales logic directly into dashboard components.

## AFTER — Service times

Add:

- Auto / drive-thru time;
- counter time;
- delivery time;
- service-time targets;
- period and daypart comparisons.

## AFTER — Labour

Add:

- scheduled/worked hours;
- staffing by daypart;
- labour cost;
- labour percentage;
- productivity metrics.

## AFTER — Cross-domain Brain

Once several domains are reliable, detect relationships such as:

- sales vs service time;
- staffing vs service time;
- service time vs review complaints;
- sales mix vs operational pressure;
- recurring problems across restaurants.

## Future infrastructure

Introduce dedicated workers / queues / separate API services only when actual scale or reliability requirements justify them.

Avoid premature microservices.
