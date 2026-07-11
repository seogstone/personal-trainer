import { envSchema, type AppEnv, type ProviderId } from "@fitness/shared";
import { createSupabaseAdmin, resolveUserId, syncHevy, syncMyFitnessPal, syncRenpho, syncWhoop } from "@fitness/worker/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type SyncResult = {
  provider: ProviderId;
  status: "success" | "failed" | "skipped";
  summary?: unknown;
  message?: string;
};

const providerOrder = ["hevy", "myfitnesspal", "renpho", "whoop"] as const;

export async function GET(request: Request) {
  const authResult = authorizeCron(request);
  if (!authResult.ok) {
    return Response.json({ ok: false, error: authResult.error }, { status: authResult.status });
  }

  const env = envSchema.parse(process.env);
  const supabase = createSupabaseAdmin(env);
  const userId = await resolveUserId(env, supabase);
  const range = recentRange(14);
  const results: SyncResult[] = [];

  for (const provider of providerOrder) {
    const startedAt = new Date().toISOString();

    try {
      const summary = await runProvider(provider, env, range);
      results.push({ provider, status: "success", summary });
      await recordSyncRun({
        env,
        userId,
        provider,
        status: "success",
        startedAt,
        rangeStart: range.startDate,
        rangeEnd: range.endDate,
        summary
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown sync error";
      results.push({ provider, status: "failed", message });
      await recordSyncRun({
        env,
        userId,
        provider,
        status: "failed",
        startedAt,
        rangeStart: range.startDate,
        rangeEnd: range.endDate,
        errorMessage: safeError(message)
      });
    }
  }

  return Response.json({
    ok: results.some((result) => result.status === "success"),
    range,
    results
  });
}

function authorizeCron(request: Request): { ok: true } | { ok: false; status: number; error: string } {
  const allowedSecrets = [process.env.CRON_SECRET, process.env.INTERNAL_WORKER_SECRET].filter(Boolean);
  if (!allowedSecrets.length) {
    return { ok: false, status: 500, error: "No cron authorization secret is configured" };
  }

  const authorization = request.headers.get("authorization");
  if (!allowedSecrets.some((secret) => authorization === `Bearer ${secret}`)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  return { ok: true };
}

async function runProvider(provider: (typeof providerOrder)[number], env: AppEnv, range: { startDate: string; endDate: string }) {
  if (provider === "hevy") {
    return syncHevy(env);
  }

  if (provider === "myfitnesspal") {
    return syncMyFitnessPal(env, range);
  }

  if (provider === "renpho") {
    return syncRenpho(env, range);
  }

  return syncWhoop(env, range);
}

async function recordSyncRun(input: {
  env: AppEnv;
  userId: string;
  provider: ProviderId;
  status: "success" | "failed";
  startedAt: string;
  rangeStart: string;
  rangeEnd: string;
  summary?: unknown;
  errorMessage?: string;
}) {
  const supabase = createSupabaseAdmin(input.env);
  const { error } = await supabase.from("sync_runs").insert({
    user_id: input.userId,
    provider: input.provider,
    sync_type: "daily_cron",
    status: input.status,
    range_start: `${input.rangeStart}T00:00:00.000Z`,
    range_end: `${input.rangeEnd}T23:59:59.999Z`,
    records_read: extractRecordCount(input.summary),
    records_inserted: 0,
    records_updated: 0,
    error_message_safe: input.errorMessage ?? null,
    started_at: input.startedAt,
    completed_at: new Date().toISOString(),
    metadata_json: input.summary ?? {}
  });

  if (error) {
    throw new Error(`Failed to record ${input.provider} sync run: ${error.message}`);
  }
}

function recentRange(days: number) {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - Math.max(1, days - 1));

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10)
  };
}

function safeError(message: string) {
  return message.replace(/[^\x20-\x7E]/g, "").slice(0, 500);
}

function extractRecordCount(summary: unknown) {
  if (!summary || typeof summary !== "object") {
    return 0;
  }

  return Object.entries(summary).reduce((total, [key, value]) => {
    if (key.toLowerCase().includes("userid") || typeof value !== "number") {
      return total;
    }

    return total + Math.max(0, Math.round(value));
  }, 0);
}
