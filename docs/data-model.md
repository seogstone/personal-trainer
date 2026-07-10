# Data Model

Supabase is the source of truth. Every user-owned table includes `user_id` and RLS policies. Source IDs are preserved as external IDs and idempotent upserts should target `(user_id, source, external_id)` or equivalent natural keys.
