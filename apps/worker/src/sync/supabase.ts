import { createClient } from "@supabase/supabase-js";
import type { AppEnv } from "@fitness/shared";

export function createSupabaseAdmin(env: AppEnv) {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase URL and service role key are required for sync");
  }

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export type SupabaseAdmin = ReturnType<typeof createSupabaseAdmin>;

export async function resolveUserId(env: AppEnv, supabase: SupabaseAdmin) {
  if (env.APP_USER_ID) {
    return env.APP_USER_ID;
  }

  const targetEmail = env.ALLOWED_EMAILS.split(",")[0]?.trim().toLowerCase();
  if (!targetEmail) {
    throw new Error("ALLOWED_EMAILS must include at least one email address");
  }

  let page = 1;
  const perPage = 100;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Unable to list Supabase users: ${error.message}`);
    }

    const match = data.users.find((user) => user.email?.toLowerCase() === targetEmail);
    if (match) {
      return match.id;
    }

    if (data.users.length < perPage) {
      break;
    }

    page += 1;
  }

  throw new Error(`No Supabase auth user found for ${targetEmail}. Sign in once or set APP_USER_ID.`);
}

export async function upsertConnection(
  supabase: SupabaseAdmin,
  input: {
    userId: string;
    provider: "hevy";
    status: "connected" | "degraded";
    externalAccountId?: string;
    safeMessage?: string;
  }
) {
  const { error } = await supabase.from("integration_connections").upsert(
    {
      user_id: input.userId,
      provider: input.provider,
      status: input.status,
      external_account_id: input.externalAccountId,
      last_attempted_sync_at: new Date().toISOString(),
      last_successful_sync_at: input.status === "connected" ? new Date().toISOString() : null,
      last_error_message_safe: input.safeMessage ?? null,
      reauthentication_required: false
    },
    { onConflict: "user_id,provider" }
  );

  if (error) {
    throw new Error(`Failed to upsert integration connection: ${error.message}`);
  }
}
