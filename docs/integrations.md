# Integrations

## WHOOP

WHOOP is isolated behind `TotemWhoopProvider`. It must remain read-only, throttled and server-side. The UI carries an explicit private API warning.

## Hevy

Hevy is isolated behind `HevyProvider`. `HEVY_API_KEY` is never exposed to browser code.

## MyFitnessPal

MyFitnessPal collection is delegated to `services/mfp` and requires an explicitly configured cookie file. Expired or missing cookies produce `reauthentication_required`.
