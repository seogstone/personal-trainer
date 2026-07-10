# Fitness Command Center

## Codex Build Brief

Build a private, production-quality fitness dashboard that combines:

- WHOOP data through [`thebriangao/totem`](https://github.com/thebriangao/totem)
- Hevy workout data through [`chrisdoc/hevy-mcp`](https://github.com/chrisdoc/hevy-mcp)
- MyFitnessPal nutrition data through [`coddingtonbear/python-myfitnesspal`](https://github.com/coddingtonbear/python-myfitnesspal)

The application is initially for one user, but the architecture should not make future multi-user support impossible.

---

## 1. Product goal

Create one central dashboard that answers:

1. How recovered am I today?
2. What training should I do today?
3. Am I progressing in the gym?
4. Am I eating enough protein and the correct number of calories?
5. How are sleep, recovery, nutrition and training affecting one another?
6. Am I training consistently without exceeding sensible fatigue levels?
7. What should I adjust next?

The app should feel like a modern personal performance dashboard rather than a collection of raw API screens.

Primary goals:

- Lose fat
- Build muscle
- Increase strength
- Improve physical capacity for golf
- Train three times per week
- Keep sessions to approximately 60 minutes
- Account for shoulder, knee and right ankle injury history

The dashboard must never present itself as medical diagnosis software.

---

## 2. Important integration constraints

### WHOOP

Totem uses WHOOP's private, reverse-engineered iOS API rather than WHOOP's supported public OAuth API.

Treat this integration as experimental and isolate it behind an adapter so it can be replaced later.

Requirements:

- Never expose WHOOP tokens to the browser.
- Store tokens only in server-side encrypted secrets.
- Keep raw WHOOP responses out of application logs.
- Implement request throttling and caching.
- Do not continuously poll WHOOP.
- Use read-only operations for the initial version.
- Disable or do not expose Totem write tools.
- Add a visible integration warning in the settings screen.
- Make it possible to replace Totem with the official WHOOP API later without changing dashboard components.

Totem requires Node.js 24 or newer and uses expiring WHOOP credentials. Its credentials may need to be refreshed periodically.

### Hevy

Hevy API access requires a Hevy Pro API key.

Requirements:

- Use the official Hevy API underneath the adapter where practical.
- The `hevy-mcp` repository can be used as the reference implementation and optional MCP interface.
- Never expose `HEVY_API_KEY` to the browser.
- Initial app functionality is read-only.
- Import existing routines, routine folders, exercise templates and workout history.
- Preserve Hevy IDs as external IDs.
- Design future support for writing workouts or routines, but do not enable it in the MVP.

### MyFitnessPal

`python-myfitnesspal` depends on authenticated browser cookies because MyFitnessPal's login flow includes CAPTCHA and does not provide a generally available public API.

This makes MyFitnessPal the least reliable integration.

Requirements:

- Run MyFitnessPal collection in a persistent Python worker, not a Vercel serverless function.
- Do not attempt username/password login.
- Load cookies from an explicitly configured cookie file or cookie jar.
- Encrypt any persisted cookie material.
- Never print cookies to logs.
- Detect expired authentication and expose a clear `reauthentication_required` integration status.
- Keep the source behind a `NutritionProvider` interface so another provider can replace it.
- Build sync failures so they do not break the rest of the dashboard.
- Allow manual CSV import as a fallback.
- Do not build food logging or nutrition write operations in the MVP.

---

## 3. Recommended architecture

Use a monorepo.

```text
fitness-command-center/
├── apps/
│   ├── web/                  # Next.js dashboard
│   └── worker/               # Persistent sync/orchestration service
├── packages/
│   ├── database/             # Supabase types, migrations and queries
│   ├── shared/               # Shared TypeScript types and validation
│   ├── analytics/            # Derived metrics and scoring functions
│   └── ui/                   # Reusable UI components
├── services/
│   └── mfp/                  # Python MyFitnessPal collector
├── docs/
│   ├── architecture.md
│   ├── integrations.md
│   ├── data-model.md
│   └── operations.md
├── infra/
│   ├── docker/
│   └── compose.yaml
├── .env.example
├── AGENTS.md
├── README.md
└── pnpm-workspace.yaml
```

### Web application

Use:

- Next.js with App Router
- TypeScript in strict mode
- Tailwind CSS
- shadcn/ui or an equivalent accessible component set
- Recharts for dashboard charts
- TanStack Query only where client-side fetching is actually needed
- Zod for all external inputs
- Supabase for PostgreSQL, authentication and row-level security
- Vercel for the web application

Prefer React Server Components for data-heavy dashboard pages.

### Worker

Use a persistent Node.js worker for orchestration.

Suitable hosting options:

- Railway
- Fly.io
- Render
- A trusted VPS
- The user's always-on Mac mini for local-first operation

Do not run the persistent worker as a Vercel Function.

Worker responsibilities:

- Schedule integration syncs
- Run Totem/WHOOP calls
- Run Hevy API synchronisation
- Invoke the Python MyFitnessPal collector
- Normalize provider responses
- Upsert records into Supabase
- Track sync state and errors
- Calculate derived daily metrics
- Run backfills and retries
- Expose a protected health endpoint

### Python service

Use:

- Python 3.12+
- `python-myfitnesspal`
- Pydantic
- Typer for CLI commands
- Structured JSON output
- pytest
- Ruff

The Node worker may call the Python collector as:

1. A local subprocess in the same container, or
2. A private HTTP service on an internal network.

Prefer a subprocess for the first version because it reduces infrastructure.

### Database

Use Supabase PostgreSQL as the application source of truth.

The dashboard must read from Supabase, not call WHOOP, Hevy or MyFitnessPal directly during page rendering.

---

## 4. Core design rule

All provider-specific data must pass through adapters.

Create interfaces similar to:

```ts
export interface RecoveryProvider {
  syncRecovery(input: SyncRange): Promise<NormalizedRecovery[]>;
  syncSleep(input: SyncRange): Promise<NormalizedSleep[]>;
  syncActivities(input: SyncRange): Promise<NormalizedActivity[]>;
  getConnectionStatus(): Promise<ConnectionStatus>;
}

export interface TrainingProvider {
  syncWorkouts(input: SyncRange): Promise<NormalizedWorkout[]>;
  syncRoutines(): Promise<NormalizedRoutine[]>;
  syncExerciseTemplates(): Promise<NormalizedExerciseTemplate[]>;
  getConnectionStatus(): Promise<ConnectionStatus>;
}

export interface NutritionProvider {
  syncNutrition(input: SyncRange): Promise<NormalizedNutritionDay[]>;
  syncWeight(input: SyncRange): Promise<NormalizedBodyMetric[]>;
  getConnectionStatus(): Promise<ConnectionStatus>;
}
```

Implement:

```text
TotemWhoopProvider
HevyProvider
MyFitnessPalProvider
CsvNutritionProvider
```

Provider code must not leak into React components.

---

## 5. Authentication and privacy

This is a private health-data application.

Implement:

- Supabase Auth
- Email magic-link login initially
- A user allowlist
- Row-level security on every user-owned table
- No anonymous data access
- Secure, HTTP-only session cookies
- CSRF protection for mutations
- Rate limiting on internal sync endpoints
- An internal worker secret
- Environment validation at startup
- Redaction of secrets and sensitive raw payloads in logs
- Audit events for connection changes, manual syncs and data deletion
- A “delete my imported data” action
- A “disconnect provider” action
- No analytics or tracking scripts in the MVP
- No health-data payloads sent to third-party error monitoring

Do not store integration secrets in ordinary database columns.

Preferred secret strategy:

- Host secrets in the worker platform's secret manager.
- Store only non-sensitive connection metadata in Supabase.
- If credentials must be stored in PostgreSQL, encrypt them using a server-held key and document key rotation.

---

## 6. Proposed database schema

Use UUID primary keys unless an existing Supabase convention dictates otherwise.

Every user-owned row must include `user_id`.

### profiles

```text
id
user_id
display_name
timezone
date_of_birth
height_cm
primary_goal
created_at
updated_at
```

Default timezone: `Europe/London`.

### user_goals

```text
id
user_id
effective_from
target_weight_kg
target_body_fat_percent
calorie_target
protein_target_g
carbohydrate_target_g
fat_target_g
weekly_workout_target
notes
created_at
```

### integration_connections

```text
id
user_id
provider
status
external_account_id
last_successful_sync_at
last_attempted_sync_at
last_error_code
last_error_message_safe
reauthentication_required
metadata_json
created_at
updated_at
```

Provider values:

```text
whoop
hevy
myfitnesspal
csv
```

### sync_runs

```text
id
user_id
provider
sync_type
status
range_start
range_end
records_read
records_inserted
records_updated
error_code
error_message_safe
started_at
completed_at
metadata_json
```

### recovery_days

```text
id
user_id
source
external_id
calendar_date
recovery_score
resting_heart_rate
hrv_rmssd_ms
spo2_percent
skin_temperature_c
raw_json_optional
created_at
updated_at
```

Unique constraint:

```text
(user_id, source, external_id)
```

### sleep_sessions

```text
id
user_id
source
external_id
start_at
end_at
timezone_offset_minutes
sleep_performance_percent
sleep_efficiency_percent
sleep_consistency_percent
time_in_bed_minutes
total_sleep_minutes
awake_minutes
light_sleep_minutes
deep_sleep_minutes
rem_sleep_minutes
sleep_need_minutes
disturbance_count
nap
raw_json_optional
created_at
updated_at
```

### strain_days

```text
id
user_id
source
external_id
calendar_date
day_strain
average_heart_rate
max_heart_rate
kilojoules
created_at
updated_at
```

### activities

```text
id
user_id
source
external_id
activity_type
sport_name
start_at
end_at
strain
average_heart_rate
max_heart_rate
kilojoules
distance_m
zone_minutes_json
created_at
updated_at
```

### exercise_templates

```text
id
user_id
source
external_id
title
primary_muscle_group
secondary_muscle_groups_json
equipment
is_custom
created_at
updated_at
```

### routines

```text
id
user_id
source
external_id
folder_external_id
title
description
position
created_at
updated_at
```

### routine_exercises

```text
id
user_id
routine_id
exercise_template_id
position
rest_seconds
notes
sets_json
created_at
updated_at
```

### workouts

```text
id
user_id
source
external_id
title
description
start_at
end_at
duration_seconds
routine_external_id
total_volume_kg
exercise_count
set_count
created_at
updated_at
```

### workout_exercises

```text
id
user_id
workout_id
exercise_template_id
external_exercise_id
title_snapshot
position
notes
created_at
updated_at
```

### workout_sets

```text
id
user_id
workout_exercise_id
external_id
set_index
set_type
weight_kg
reps
distance_m
duration_seconds
rpe
completed
created_at
updated_at
```

### nutrition_days

```text
id
user_id
source
calendar_date
calories_consumed
calories_burned_optional
protein_g
carbohydrate_g
fat_g
fibre_g
sugar_g
sodium_mg
water_ml
goal_calories
goal_protein_g
goal_carbohydrate_g
goal_fat_g
complete
created_at
updated_at
```

Unique constraint:

```text
(user_id, source, calendar_date)
```

### nutrition_meals

```text
id
user_id
nutrition_day_id
meal_name
position
calories
protein_g
carbohydrate_g
fat_g
items_json
created_at
updated_at
```

### body_metrics

```text
id
user_id
source
external_id_optional
measured_at
weight_kg
body_fat_percent
lean_mass_kg
waist_cm
notes
created_at
updated_at
```

### daily_insights

```text
id
user_id
calendar_date
readiness_score
training_load_score
nutrition_adherence_score
sleep_score
consistency_score
recommended_session_type
headline
explanation_json
flags_json
algorithm_version
created_at
updated_at
```

Do not store opaque raw data unless needed for debugging or remapping. If raw JSON is retained, make retention configurable.

---

## 7. Normalization rules

- Store all timestamps in UTC.
- Retain source timezone offsets where provided.
- Render dates in the user's configured timezone.
- Store weight in kilograms.
- Store distance in metres.
- Store duration in seconds or clearly named minute columns.
- Store energy consistently.
- Preserve original source IDs.
- Use idempotent upserts.
- Never use provider display names as stable identifiers.
- Retain source attribution on every imported record.
- Distinguish a missing value from a zero value.
- Use decimal-safe PostgreSQL numeric types for body weight and lifted weight.
- Convert Hevy weights to kilograms if another unit is returned.
- Handle workouts that cross midnight correctly.
- Associate daily data with the local calendar date, not blindly with UTC date.

---

## 8. Sync strategy

### Initial backfill

On first connection:

- WHOOP: attempt 90 days
- Hevy: import all available routines and at least 12 months of workout history
- MyFitnessPal: attempt 90 days
- Allow a configurable full-history backfill later

Backfills must:

- Run in bounded date windows
- Be resumable
- Record checkpoints
- Be idempotent
- Respect provider rate limits
- Continue other providers if one fails

### Scheduled syncs

Suggested cadence:

```text
WHOOP recovery/sleep: every 2 hours
WHOOP activities/strain: every 2 hours
Hevy workouts: every 30 minutes
Hevy routines/templates: once daily
MyFitnessPal nutrition: every 3 hours
Derived daily metrics: after successful provider sync and nightly
```

Do not sync more frequently unless the provider documentation supports it.

### Manual sync

Add a “Sync now” control per integration.

The UI must:

- Disable repeated clicking while a sync is active
- Display the most recent successful sync
- Display a safe error message
- Never expose stack traces or credentials
- Show when reauthentication is required

### Retry policy

Use exponential backoff with jitter.

Categorize errors:

```text
authentication
rate_limited
provider_unavailable
invalid_response
network
configuration
unknown
```

Do not retry authentication failures indefinitely.

---

## 9. MVP pages

### `/dashboard`

The primary daily dashboard.

Show:

- Today's recovery score
- HRV and resting heart-rate trend
- Last night's sleep duration and sleep performance
- Today's WHOOP strain
- Calories and protein consumed against targets
- Training status
- Next scheduled routine
- Current weekly workout count
- A concise “Today” recommendation
- Integration freshness indicators

Example recommendation:

```text
Recovery is good and sleep was close to target. Complete Workout B today.
Keep the session around RPE 7 and aim for at least 180 g protein.
```

Recommendations must be deterministic in the MVP. Do not require an LLM.

### `/training`

Show:

- Workout calendar
- Recent workouts
- Weekly training frequency
- Exercise history
- Estimated one-rep-max trends
- Volume trends by exercise and muscle group
- Personal records
- Existing Hevy routines
- Routine detail
- Last performance for each planned exercise

### `/nutrition`

Show:

- Calories by day
- Protein by day
- Macro split
- Target adherence
- Meal breakdown
- Seven-day averages
- Weight trend alongside calorie intake
- Missing/incomplete diary warnings

### `/recovery`

Show:

- Recovery trend
- HRV trend
- Resting heart-rate trend
- Sleep duration
- Sleep stages
- Sleep consistency
- Strain versus recovery
- Training days overlaid on recovery trends

### `/progress`

Show:

- Body-weight trend
- Smoothed seven-day weight
- Strength trends
- Workout consistency
- Protein adherence
- Calorie adherence
- Recovery averages
- Monthly summary cards

### `/settings/integrations`

Show:

- Provider connection status
- Last successful sync
- Last attempted sync
- Reauthentication status
- Manual sync
- Disconnect
- Data deletion
- WHOOP private-API warning
- MyFitnessPal cookie refresh instructions

---

## 10. Dashboard visual design

Design direction:

- Modern and polished
- Mobile-first
- Useful on an iPhone
- Desktop dashboard should use space well
- Dark and light mode
- Clear hierarchy
- Minimal decorative clutter
- Avoid copying WHOOP, Hevy or MyFitnessPal branding
- Use source badges where useful
- Use accessible contrast
- Do not rely on colour alone to communicate readiness
- Charts must include tooltips and readable labels
- Loading states should use skeletons
- Empty states should explain what data is missing

Suggested layout:

```text
Top bar:
Date | sync status | profile

Hero row:
Recovery | Sleep | Nutrition | Training

Main:
Today's recommendation
Weekly workout progress
Calories/protein progress
Recovery and HRV trend
Upcoming routine

Lower:
Recent workouts
Weight trend
Data quality/integration warnings
```

---

## 11. Initial analytics

Place all calculations in `packages/analytics`.

Every derived value must:

- Be a pure function where possible
- Have unit tests
- Declare required inputs
- Return `insufficient_data` rather than inventing a result
- Include an algorithm version
- Be documented

### Readiness score

Create an internal readiness score from 0 to 100 using available inputs.

Initial weighting:

```text
WHOOP recovery score: 45%
Sleep duration versus need: 20%
HRV versus 28-day baseline: 15%
Resting HR versus 28-day baseline: 10%
Recent training load: 10%
```

If WHOOP recovery exists, do not pretend the internal score is medically superior. Label it “Dashboard readiness”.

Adjust weights proportionally when optional inputs are absent.

### Training recommendation

Initial rules:

```text
Readiness >= 70:
  planned training is suitable

Readiness 50-69:
  train, but reduce volume or intensity by approximately 10-20%

Readiness < 50:
  recommend recovery, mobility, walking or a reduced session

Acute injury flag:
  never recommend pushing through pain
```

Also consider:

- Days since last workout
- Number of workouts completed this week
- Whether the next Hevy routine is known
- Sleep under six hours
- Consecutive high-strain days
- User injury notes

### Nutrition adherence

Calculate:

```text
calorie adherence
protein adherence
seven-day calorie average
seven-day protein average
logged-day completeness
```

Avoid praising apparent under-eating when the diary is incomplete.

### Strength progress

For suitable exercises, calculate estimated one-rep max using Epley:

```text
estimated_1rm = weight * (1 + reps / 30)
```

Do not calculate it for time, distance or bodyweight-only sets unless a valid model is defined.

### Training volume

```text
volume = sum(weight_kg * reps)
```

Keep bodyweight exercises separate unless external load is explicitly recorded.

---

## 12. Injury-aware context

Store user-provided training constraints separately from imported health metrics.

Initial context:

- Surgically repaired shoulder with plate and screws
- Historical right patellar tendon and growth-plate injury
- Recurrent right ankle ligament issues, currently under physiotherapy care
- Goal is improved golf performance
- Intermediate gym experience
- Three sessions per week
- Approximately 60 minutes per session

Rules:

- Do not generate medical claims.
- Do not infer that a low recovery score is caused by an injury.
- Do not override physiotherapist or clinician instructions.
- Include a pain/injury check-in before recommending progression.
- Do not auto-progress an exercise after pain is reported.
- Keep recommendations descriptive and conservative.

---

## 13. API routes

Create protected application endpoints such as:

```text
GET  /api/dashboard
GET  /api/training/workouts
GET  /api/training/routines
GET  /api/training/exercises/:id
GET  /api/nutrition/days
GET  /api/recovery/days
GET  /api/progress
GET  /api/integrations
POST /api/integrations/:provider/sync
POST /api/integrations/:provider/disconnect
DELETE /api/integrations/:provider/data
```

Worker-only routes:

```text
POST /api/internal/sync/complete
POST /api/internal/sync/fail
POST /api/internal/derived-metrics/rebuild
```

Requirements:

- Validate every query and body with Zod.
- Confirm user ownership for every record.
- Return typed error codes.
- Do not expose provider payloads directly.
- Generate an OpenAPI document if practical.

---

## 14. Worker commands

Provide CLI commands:

```bash
pnpm worker sync whoop --from 2026-01-01 --to 2026-07-10
pnpm worker sync hevy --from 2026-01-01 --to 2026-07-10
pnpm worker sync mfp --from 2026-01-01 --to 2026-07-10
pnpm worker sync all --days 14
pnpm worker backfill hevy
pnpm worker derive --date 2026-07-10
pnpm worker status
```

Python commands:

```bash
python -m mfp_collector status
python -m mfp_collector sync-day 2026-07-10
python -m mfp_collector sync-range 2026-07-01 2026-07-10
python -m mfp_collector export-csv 2026-07-01 2026-07-10
```

All machine-readable commands should support JSON output.

---

## 15. Environment variables

Create `.env.example` with placeholders only.

```bash
# Web
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APP_URL=
ALLOWED_USER_EMAILS=

# Worker authentication
INTERNAL_WORKER_SECRET=
CREDENTIAL_ENCRYPTION_KEY=

# Hevy
HEVY_API_KEY=

# WHOOP / Totem
WHOOP_IOS_BEARER_TOKEN=
WHOOP_COGNITO_REFRESH_TOKEN=
MCP_AUTH_TOKEN=
MCP_TRANSPORT=stdio

# MyFitnessPal
MFP_COOKIE_FILE=
MFP_USERNAME_HINT=

# Optional
LOG_LEVEL=info
RAW_PROVIDER_DATA_RETENTION_DAYS=0
```

Never commit real values.

Add startup validation that fails with a useful message when required variables are absent.

---

## 16. Local development

Create a Docker Compose environment containing:

- PostgreSQL only if not using hosted Supabase locally
- Web app
- Worker
- Python dependencies
- Optional Supabase local stack

The simplest supported development path should be documented.

Example:

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm db:migrate
pnpm dev
```

For MyFitnessPal:

1. Log into MyFitnessPal in a supported local browser.
2. Export or reference the browser cookie jar.
3. Configure `MFP_COOKIE_FILE`.
4. Run `python -m mfp_collector status`.
5. Never copy cookies into source-controlled files.

For Totem:

1. Follow Totem's supported authentication flow.
2. Start in local/stdio mode.
3. Confirm read-only WHOOP retrieval.
4. Copy only required secrets into the worker's secret manager.
5. Do not deploy until local sync and redaction tests pass.

For Hevy:

1. Obtain a Hevy API key from the Hevy account.
2. Configure `HEVY_API_KEY`.
3. Verify routines and workout history.
4. Confirm pagination before running a full backfill.

---

## 17. Tests

### Unit tests

Cover:

- Unit conversion
- Date and timezone mapping
- Readiness calculation
- Nutrition adherence
- Estimated one-rep max
- Training volume
- Provider normalization
- Error classification
- Missing-data behavior

### Integration tests

Use recorded, sanitized fixtures.

Cover:

- WHOOP normalization
- Hevy pagination
- MyFitnessPal day parsing
- Idempotent upserts
- Sync checkpoint recovery
- Expired credentials
- Rate-limit response
- Partial provider outage

Never store real health data or credentials in fixtures.

### End-to-end tests

Use Playwright.

Cover:

- Login
- Dashboard loading
- Empty state
- Integration status
- Manual sync request
- Training history filters
- Nutrition date selection
- Mobile navigation
- Data deletion confirmation

---

## 18. Observability

Implement structured logging.

Log:

- Sync start and finish
- Provider
- Date range
- Number of records processed
- Duration
- Safe error code
- Retry count

Never log:

- Access tokens
- Refresh tokens
- API keys
- Cookies
- Authorization headers
- Full raw provider payloads
- Meal item names unless explicitly needed
- Health values in ordinary infrastructure logs

Add:

- `/health`
- `/ready`
- Worker heartbeat
- Last successful sync per provider
- Alert state after repeated failures

---

## 19. Delivery phases

### Phase 0: repository and architecture

Deliver:

- Monorepo
- Next.js app
- Worker scaffold
- Python collector scaffold
- Supabase migrations
- Authentication
- Environment validation
- CI checks
- Architecture documentation

### Phase 1: Hevy integration

Start with Hevy because it has the cleanest supported API.

Deliver:

- Connection check
- Routine import
- Exercise template import
- Workout import
- Training pages
- Progress calculations
- Full test coverage for pagination and normalization

### Phase 2: WHOOP integration

Deliver:

- Recovery import
- Sleep import
- Strain/activity import
- Recovery pages
- Readiness calculation
- Safe token handling
- Documented private-API risk
- Read-only registration of Totem capabilities

### Phase 3: MyFitnessPal integration

Deliver:

- Cookie-based local authentication check
- Nutrition-day import
- Meal summaries
- Body-weight import if available
- Reauthentication flow
- CSV fallback
- Nutrition pages

### Phase 4: combined dashboard

Deliver:

- Daily overview
- Cross-source trends
- Deterministic recommendations
- Data freshness indicators
- Mobile polish
- Accessibility review

### Phase 5: optional intelligence

Only after the deterministic dashboard is reliable:

- Weekly narrative summary
- Correlation exploration
- Natural-language queries
- Coach chat
- LLM-generated explanations

Any LLM feature must receive normalized, minimal data rather than raw provider credentials or unrestricted full history.

---

## 20. Acceptance criteria for MVP

The MVP is complete when:

- A permitted user can securely sign in.
- Existing Hevy routines appear in the app.
- Hevy workout history syncs idempotently.
- WHOOP recovery, sleep and strain data sync successfully.
- MyFitnessPal nutrition days sync through the Python collector.
- One provider failing does not break other pages.
- Every page shows data freshness.
- Manual sync works and is rate-limited.
- The dashboard works well on iPhone and desktop.
- No credentials appear in browser bundles, API responses or logs.
- All database tables have row-level security.
- Important analytics have unit tests.
- Backfills can resume after interruption.
- Integration disconnection and data deletion work.
- Setup documentation is sufficient for a fresh machine.
- CI passes linting, type checking, tests and production build.

---

## 21. Codex operating instructions

Work in small, reviewable changes.

For each phase:

1. Inspect the existing repository before making assumptions.
2. Update `docs/architecture.md` when architecture changes.
3. Create or update database migrations.
4. Write tests alongside implementation.
5. Run lint, type checks, tests and build.
6. Report changed files and any unresolved risks.
7. Do not silently weaken typing or security to make tests pass.
8. Do not introduce provider-specific fields into shared UI models.
9. Do not enable write operations against WHOOP or Hevy without explicit approval.
10. Do not commit credentials, cookies or real health data.

Prefer maintainable code over clever abstractions.

Do not create mocked dashboard values in production paths. If data is unavailable, render a truthful empty state.

---

## 22. First Codex task

Begin with Phase 0 and Phase 1 only.

Create the repository structure, database schema, authentication and Hevy integration.

Specific first milestone:

1. Scaffold the monorepo.
2. Add Supabase migrations and row-level security.
3. Add magic-link authentication and allowlist enforcement.
4. Implement the `TrainingProvider` interface.
5. Implement `HevyProvider`.
6. Import exercise templates, routines and workouts.
7. Build `/training` and `/training/routines/[id]`.
8. Build `/settings/integrations`.
9. Add manual Hevy sync.
10. Add tests for pagination, units, normalization and idempotency.
11. Add local setup documentation.
12. Run all checks and provide a completion report.

Do not begin WHOOP or MyFitnessPal implementation until the Hevy data flow is stable.

---

## 23. Decisions that must remain configurable

Do not hard-code:

- Hosting provider for the worker
- Supabase project identifiers
- User email address
- Nutrition targets
- Calorie targets
- Training-day schedule
- Date range for backfills
- Sync cadence
- Provider base URLs
- Raw-data retention
- Readiness thresholds
- Unit preferences
- Timezone

Use configuration, database settings or environment variables as appropriate.

---

## 24. Known risks

### WHOOP private API risk

Totem's WHOOP integration is unsupported by WHOOP and may change without notice. Keep the adapter replaceable and avoid unnecessary write operations.

### MyFitnessPal fragility

MyFitnessPal may change page structure, cookies, CAPTCHA or internal endpoints. The app must degrade gracefully and support CSV fallback.

### Credential lifecycle

WHOOP and MyFitnessPal credentials may expire. Reauthentication must be an expected product state, not an unhandled exception.

### Cross-source date alignment

Sleep sessions, workouts and food diaries use different date concepts. Normalize dates using `Europe/London` and test daylight-saving changes.

### Misleading correlations

Do not describe correlations as causation. Display sample size and label exploratory insights clearly.

### Health-data sensitivity

Treat all imported records as sensitive personal data. Minimize collection, retention and third-party exposure.
