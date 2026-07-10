# Fitness Command Center

Private fitness dashboard for recovery, training, nutrition and progress tracking.

## Apps

- `apps/web`: Next.js dashboard.
- `apps/worker`: persistent sync/orchestration worker.
- `services/mfp`: Python MyFitnessPal collector.

## Quick start

```bash
pnpm install
pnpm dev
```

The dashboard is available at `http://localhost:3000`.

## Current status

This is the production-oriented MVP foundation. Provider integrations are isolated behind adapters and default to safe placeholder data until credentials and Supabase are configured.
