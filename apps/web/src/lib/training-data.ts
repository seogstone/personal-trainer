import { createSupabaseAdmin } from "./supabase-admin";

export type TrainingOverview = {
  workoutsThisWeek: number;
  routines: Array<{
    id: string;
    title: string;
    exerciseCount: number;
    folderExternalId: string | null;
  }>;
  recentWorkouts: Array<{
    id: string;
    title: string;
    startAt: string;
    totalVolumeKg: number | null;
    exerciseCount: number | null;
    setCount: number | null;
  }>;
  connection: {
    status: string;
    lastSuccessfulSyncAt: string | null;
    safeMessage: string | null;
  } | null;
};

export async function getTrainingOverview(): Promise<TrainingOverview> {
  const supabase = createSupabaseAdmin();
  if (!supabase) {
    return emptyTrainingOverview();
  }

  const weekStart = startOfWeek(new Date());
  const [workoutsResult, routinesResult, connectionResult] = await Promise.all([
    supabase
      .from("workouts")
      .select("id,title,start_at,total_volume_kg,exercise_count,set_count")
      .gte("start_at", weekStart.toISOString())
      .order("start_at", { ascending: false })
      .limit(20),
    supabase
      .from("routines")
      .select("id,title,folder_external_id,routine_exercises(id)")
      .eq("source", "hevy")
      .order("position", { ascending: true }),
    supabase
      .from("integration_connections")
      .select("status,last_successful_sync_at,last_error_message_safe")
      .eq("provider", "hevy")
      .maybeSingle()
  ]);

  if (workoutsResult.error || routinesResult.error) {
    return emptyTrainingOverview(connectionResult.data?.status ?? "degraded");
  }

  return {
    workoutsThisWeek: workoutsResult.data?.length ?? 0,
    routines:
      routinesResult.data?.map((routine) => ({
        id: routine.id as string,
        title: routine.title as string,
        exerciseCount: Array.isArray(routine.routine_exercises) ? routine.routine_exercises.length : 0,
        folderExternalId: (routine.folder_external_id as string | null) ?? null
      })) ?? [],
    recentWorkouts:
      workoutsResult.data?.map((workout) => ({
        id: workout.id as string,
        title: workout.title as string,
        startAt: workout.start_at as string,
        totalVolumeKg: (workout.total_volume_kg as number | null) ?? null,
        exerciseCount: (workout.exercise_count as number | null) ?? null,
        setCount: (workout.set_count as number | null) ?? null
      })) ?? [],
    connection: connectionResult.data
      ? {
          status: connectionResult.data.status as string,
          lastSuccessfulSyncAt: (connectionResult.data.last_successful_sync_at as string | null) ?? null,
          safeMessage: (connectionResult.data.last_error_message_safe as string | null) ?? null
        }
      : null
  };
}

function emptyTrainingOverview(status = "not_configured"): TrainingOverview {
  return {
    workoutsThisWeek: 0,
    routines: [],
    recentWorkouts: [],
    connection: {
      status,
      lastSuccessfulSyncAt: null,
      safeMessage: null
    }
  };
}

function startOfWeek(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
  copy.setDate(diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
