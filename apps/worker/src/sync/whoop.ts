import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import type { AppEnv } from "@fitness/shared";
import { createSupabaseAdmin, resolveUserId, type SupabaseAdmin } from "./supabase";

const recoverySchema = z.object({
  date: z.string(),
  score: z.number().nullable(),
  hrv: z.object({
    ms: z.number().nullable()
  }),
  rhr: z.object({
    bpm: z.number().nullable()
  }),
  spo2_pct: z.number().nullable(),
  skin_temp_c: z.number().nullable()
});

const sleepSchema = z.object({
  date: z.string(),
  started_at: z.string().nullable(),
  ended_at: z.string().nullable(),
  total_sleep_ms: z.number().int().nullable(),
  time_in_bed_ms: z.number().int().nullable(),
  efficiency_pct: z.number().nullable(),
  performance_pct: z.number().nullable(),
  consistency_pct: z.number().nullable(),
  stages: z.object({
    rem_ms: z.number().int().nullable(),
    light_ms: z.number().int().nullable(),
    sws_ms: z.number().int().nullable(),
    wake_ms: z.number().int().nullable()
  }),
  disturbances: z.number().int().nullable(),
  sleep_hr: z.object({
    avg_bpm: z.number().nullable(),
    min_bpm: z.number().nullable()
  })
});

type WhoopRecovery = z.infer<typeof recoverySchema>;
type WhoopSleep = z.infer<typeof sleepSchema>;

export async function syncWhoop(env: AppEnv, input?: { startDate?: string; endDate?: string }) {
  const credentialsPath = env.WHOOP_TOTEM_CREDENTIALS_PATH;
  if (!credentialsPath) {
    throw new Error("WHOOP_TOTEM_CREDENTIALS_PATH is required");
  }
  if (!existsSync(credentialsPath)) {
    throw new Error(`WHOOP Totem credentials file not found at ${credentialsPath}`);
  }

  const supabase = createSupabaseAdmin(env);
  const userId = await resolveUserId(env, supabase);
  const range = resolveRange(input);
  const client = await createTotemClient(credentialsPath);
  const dates = enumerateDates(range.startDate, range.endDate);

  const recoveries: WhoopRecovery[] = [];
  const sleeps: WhoopSleep[] = [];

  for (const date of dates) {
    const [recovery, sleep] = await Promise.all([fetchRecovery(client, date), fetchSleep(client, date)]);
    if (recovery) {
      recoveries.push(recovery);
    }
    if (sleep) {
      sleeps.push(sleep);
    }
  }

  await upsertRecoveryDays(supabase, userId, recoveries);
  await upsertSleepSessions(supabase, userId, sleeps);
  await upsertWhoopConnection(supabase, userId, "connected");

  return {
    userId,
    recoveryDays: recoveries.length,
    sleepSessions: sleeps.length,
    rangeStart: range.startDate,
    rangeEnd: range.endDate
  };
}

function resolveRange(input?: { startDate?: string; endDate?: string }) {
  const end = input?.endDate ? new Date(`${input.endDate}T00:00:00.000Z`) : new Date();
  const start = input?.startDate ? new Date(`${input.startDate}T00:00:00.000Z`) : new Date(end);
  if (!input?.startDate) {
    start.setUTCDate(end.getUTCDate() - 13);
  }

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10)
  };
}

function enumerateDates(startDate: string, endDate: string) {
  const dates: string[] = [];
  const current = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

async function createTotemClient(credentialsPath: string) {
  loadEnvFile(credentialsPath);
  const totemRoot = dirname(credentialsPath);
  const importFromTotem = async (path: string) => import(pathToFileURL(join(totemRoot, path)).href);
  const [{ WhoopClient }, { TokenManager }, { EnvFileTokenStore }] = await Promise.all([
    importFromTotem("dist/whoop/client.js"),
    importFromTotem("dist/whoop/token_manager.js"),
    importFromTotem("dist/whoop/token_store.js")
  ]);

  const email = requireProcessEnv("WHOOP_EMAIL");
  const accessToken = requireProcessEnv("WHOOP_IOS_BEARER_TOKEN");
  const refreshToken = requireProcessEnv("WHOOP_COGNITO_REFRESH_TOKEN");
  const tokenManager = new TokenManager({
    email,
    accessToken,
    refreshToken,
    store: new EnvFileTokenStore(credentialsPath)
  });

  return {
    root: totemRoot,
    client: new WhoopClient({ getToken: () => tokenManager.getToken() }),
    importFromTotem
  };
}

async function fetchRecovery(totem: Awaited<ReturnType<typeof createTotemClient>>, date: string) {
  const [{ projectRecovery }, { RecoveryOut }] = await Promise.all([
    totem.importFromTotem("dist/projections/recovery.js"),
    totem.importFromTotem("dist/schemas/recovery.js")
  ]);
  const dayMs = Date.parse(`${date}T00:00:00.000Z`);
  const start = new Date(dayMs - 86_400_000).toISOString();
  const end = new Date(dayMs + 2 * 86_400_000).toISOString();

  const [raw, recoveryV2] = await Promise.all([
    totem.client.get("/home-service/v1/deep-dive/recovery", { date }),
    totem.client.get("/developer/v2/recovery", { start, end, limit: "10" }).catch(() => null)
  ]);
  const parsed = RecoveryOut.parse(projectRecovery(raw, date, recoveryV2));
  return recoverySchema.parse(parsed);
}

async function fetchSleep(totem: Awaited<ReturnType<typeof createTotemClient>>, date: string) {
  const [{ projectSleep }, { SleepOut }] = await Promise.all([
    totem.importFromTotem("dist/projections/sleep.js"),
    totem.importFromTotem("dist/schemas/sleep.js")
  ]);
  const raw = await totem.client.get("/home-service/v1/deep-dive/sleep/last-night", { date });
  const parsed = SleepOut.parse(projectSleep(raw, date));
  return sleepSchema.parse(parsed);
}

async function upsertRecoveryDays(supabase: SupabaseAdmin, userId: string, recoveries: WhoopRecovery[]) {
  if (!recoveries.length) {
    return;
  }

  await checked(
    supabase.from("recovery_days").upsert(
      recoveries.map((recovery) => ({
        user_id: userId,
        source: "whoop",
        external_id: recovery.date,
        calendar_date: recovery.date,
        recovery_score: recovery.score == null ? null : Math.round(recovery.score),
        resting_heart_rate: recovery.rhr.bpm == null ? null : Math.round(recovery.rhr.bpm),
        hrv_rmssd_ms: recovery.hrv.ms,
        spo2_percent: recovery.spo2_pct,
        skin_temperature_c: recovery.skin_temp_c,
        raw_json_optional: recovery,
        updated_at: new Date().toISOString()
      })),
      { onConflict: "user_id,source,external_id" }
    ),
    "upsert WHOOP recovery days"
  );
}

async function upsertSleepSessions(supabase: SupabaseAdmin, userId: string, sleeps: WhoopSleep[]) {
  if (!sleeps.length) {
    return;
  }

  await checked(
    supabase.from("sleep_sessions").upsert(
      sleeps.map((sleep) => ({
        user_id: userId,
        source: "whoop",
        external_id: sleep.date,
        calendar_date: sleep.date,
        start_at: sleep.started_at,
        end_at: sleep.ended_at,
        time_in_bed_minutes: msToMinutes(sleep.time_in_bed_ms),
        total_sleep_minutes: msToMinutes(sleep.total_sleep_ms),
        awake_minutes: msToMinutes(sleep.stages.wake_ms),
        light_sleep_minutes: msToMinutes(sleep.stages.light_ms),
        deep_sleep_minutes: msToMinutes(sleep.stages.sws_ms),
        rem_sleep_minutes: msToMinutes(sleep.stages.rem_ms),
        sleep_need_minutes:
          sleep.total_sleep_ms != null && sleep.performance_pct && sleep.performance_pct > 0
            ? Math.round(msToMinutes(sleep.total_sleep_ms)! / (sleep.performance_pct / 100))
            : null,
        sleep_performance_percent: sleep.performance_pct,
        sleep_efficiency_percent: sleep.efficiency_pct,
        sleep_consistency_percent: sleep.consistency_pct,
        disturbance_count: sleep.disturbances,
        average_sleep_heart_rate: sleep.sleep_hr.avg_bpm == null ? null : Math.round(sleep.sleep_hr.avg_bpm),
        minimum_sleep_heart_rate: sleep.sleep_hr.min_bpm == null ? null : Math.round(sleep.sleep_hr.min_bpm),
        raw_json_optional: sleep,
        updated_at: new Date().toISOString()
      })),
      { onConflict: "user_id,source,external_id" }
    ),
    "upsert WHOOP sleep sessions"
  );
}

async function upsertWhoopConnection(supabase: SupabaseAdmin, userId: string, status: "connected" | "degraded") {
  await checked(
    supabase.from("integration_connections").upsert(
      {
        user_id: userId,
        provider: "whoop",
        status,
        last_attempted_sync_at: new Date().toISOString(),
        last_successful_sync_at: status === "connected" ? new Date().toISOString() : null,
        reauthentication_required: status !== "connected"
      },
      { onConflict: "user_id,provider" }
    ),
    "upsert WHOOP connection"
  );
}

function loadEnvFile(path: string) {
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separator = line.indexOf("=");
    if (separator === -1) {
      continue;
    }
    process.env[line.slice(0, separator)] = line.slice(separator + 1);
  }
}

function requireProcessEnv(key: string) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing ${key} in Totem credentials file`);
  }
  return value;
}

function msToMinutes(value: number | null) {
  return value == null ? null : Math.round(value / 60_000);
}

async function checked<T extends { error: null | { message: string } }>(result: PromiseLike<T>, action: string) {
  const { error } = await result;
  if (error) {
    throw new Error(`Failed to ${action}: ${error.message}`);
  }
}
