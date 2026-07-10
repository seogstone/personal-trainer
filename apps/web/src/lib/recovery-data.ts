import type { NormalizedRecovery, NormalizedSleep } from "@fitness/shared";
import { createSupabaseAdmin } from "./supabase-admin";

export type RecoveryOverview = {
  recoveries: NormalizedRecovery[];
  sleeps: NormalizedSleep[];
  connection: {
    status: string;
    lastSuccessfulSyncAt: string | null;
    safeMessage: string | null;
  } | null;
};

export async function getRecoveryOverview(): Promise<RecoveryOverview> {
  const supabase = createSupabaseAdmin();
  if (!supabase) {
    return emptyRecoveryOverview();
  }

  const since = new Date();
  since.setDate(since.getDate() - 13);
  const sinceDate = since.toISOString().slice(0, 10);

  const [recoveryResult, sleepResult, connectionResult] = await Promise.all([
    supabase
      .from("recovery_days")
      .select("external_id,calendar_date,recovery_score,resting_heart_rate,hrv_rmssd_ms")
      .eq("source", "whoop")
      .gte("calendar_date", sinceDate)
      .order("calendar_date", { ascending: true }),
    supabase
      .from("sleep_sessions")
      .select("external_id,start_at,end_at,total_sleep_minutes,sleep_need_minutes,sleep_performance_percent")
      .eq("source", "whoop")
      .gte("calendar_date", sinceDate)
      .order("calendar_date", { ascending: true }),
    supabase
      .from("integration_connections")
      .select("status,last_successful_sync_at,last_error_message_safe")
      .eq("provider", "whoop")
      .maybeSingle()
  ]);

  return {
    recoveries: recoveryResult.error
      ? []
      : (recoveryResult.data?.map((day) => ({
          userId: "",
          source: "whoop",
          externalId: day.external_id as string,
          calendarDate: day.calendar_date as string,
          recoveryScore: (day.recovery_score as number | null) ?? null,
          restingHeartRate: (day.resting_heart_rate as number | null) ?? null,
          hrvRmssdMs: (day.hrv_rmssd_ms as number | null) ?? null
        })) ?? []),
    sleeps: sleepResult.error
      ? []
      : (sleepResult.data?.map((sleep) => ({
          userId: "",
          source: "whoop",
          externalId: sleep.external_id as string,
          startAt: sleep.start_at as string,
          endAt: sleep.end_at as string,
          totalSleepMinutes: (sleep.total_sleep_minutes as number | null) ?? null,
          sleepNeedMinutes: (sleep.sleep_need_minutes as number | null) ?? null,
          sleepPerformancePercent: (sleep.sleep_performance_percent as number | null) ?? null
        })) ?? []),
    connection: connectionResult.data
      ? {
          status: connectionResult.data.status as string,
          lastSuccessfulSyncAt: (connectionResult.data.last_successful_sync_at as string | null) ?? null,
          safeMessage: (connectionResult.data.last_error_message_safe as string | null) ?? null
        }
      : null
  };
}

function emptyRecoveryOverview(status = "not_configured"): RecoveryOverview {
  return {
    recoveries: [],
    sleeps: [],
    connection: {
      status,
      lastSuccessfulSyncAt: null,
      safeMessage: null
    }
  };
}
