import type { AppEnv } from "@fitness/shared";
import { HevyProvider, type HevyExerciseTemplate, type HevyRoutine, type HevyWorkout } from "../providers/training/hevy";
import { createSupabaseAdmin, resolveUserId, upsertConnection, type SupabaseAdmin } from "./supabase";

type SyncSummary = {
  userId: string;
  hevyUserId: string;
  exerciseTemplates: number;
  routines: number;
  workouts: number;
  workoutExercises: number;
  workoutSets: number;
};

export async function syncHevy(env: AppEnv): Promise<SyncSummary> {
  const supabase = createSupabaseAdmin(env);
  const userId = await resolveUserId(env, supabase);
  const provider = new HevyProvider(env);
  const hevyUser = await provider.getUserInfo();
  const [exerciseTemplates, routines, workouts] = await Promise.all([
    provider.listExerciseTemplates(),
    provider.listRoutines(),
    provider.listWorkouts()
  ]);

  await upsertExerciseTemplates(supabase, userId, exerciseTemplates);
  const exerciseTemplateMap = await getExternalIdMap(supabase, "exercise_templates", userId);
  await upsertRoutines(supabase, userId, routines, exerciseTemplateMap);
  const workoutCounts = await upsertWorkouts(supabase, userId, workouts, exerciseTemplateMap);

  await upsertConnection(supabase, {
    userId,
    provider: "hevy",
    status: "connected",
    externalAccountId: hevyUser.id
  });

  return {
    userId,
    hevyUserId: hevyUser.id,
    exerciseTemplates: exerciseTemplates.length,
    routines: routines.length,
    workouts: workouts.length,
    workoutExercises: workoutCounts.exercises,
    workoutSets: workoutCounts.sets
  };
}

async function upsertExerciseTemplates(supabase: SupabaseAdmin, userId: string, templates: HevyExerciseTemplate[]) {
  if (!templates.length) {
    return;
  }

  const { error } = await supabase.from("exercise_templates").upsert(
    templates.map((template) => ({
      user_id: userId,
      source: "hevy",
      external_id: template.id,
      title: template.title,
      primary_muscle_group: template.primary_muscle_group ?? null,
      secondary_muscle_groups_json: template.secondary_muscle_groups,
      equipment: template.equipment_category ?? null,
      is_custom: template.is_custom,
      updated_at: new Date().toISOString()
    })),
    { onConflict: "user_id,source,external_id" }
  );

  if (error) {
    throw new Error(`Failed to upsert Hevy exercise templates: ${error.message}`);
  }
}

async function upsertRoutines(
  supabase: SupabaseAdmin,
  userId: string,
  routines: HevyRoutine[],
  exerciseTemplateMap: Map<string, string>
) {
  if (!routines.length) {
    return;
  }

  const { data, error } = await supabase
    .from("routines")
    .upsert(
      routines.map((routine, position) => ({
        user_id: userId,
        source: "hevy",
        external_id: routine.id,
        folder_external_id: routine.folder_id == null ? null : String(routine.folder_id),
        title: routine.title,
        description: null,
        position,
        updated_at: new Date().toISOString()
      })),
      { onConflict: "user_id,source,external_id" }
    )
    .select("id, external_id");

  if (error) {
    throw new Error(`Failed to upsert Hevy routines: ${error.message}`);
  }

  const routineIdByExternalId = new Map((data ?? []).map((routine) => [routine.external_id as string, routine.id as string]));
  const routineIds = [...routineIdByExternalId.values()];
  if (routineIds.length) {
    await checked(supabase.from("routine_exercises").delete().in("routine_id", routineIds), "delete existing routine exercises");
  }

  const rows = routines.flatMap((routine) => {
    const routineId = routineIdByExternalId.get(routine.id);
    if (!routineId) {
      return [];
    }

    return routine.exercises.map((exercise) => ({
      user_id: userId,
      routine_id: routineId,
      exercise_template_id: exercise.exercise_template_id ? (exerciseTemplateMap.get(exercise.exercise_template_id) ?? null) : null,
      position: exercise.index,
      rest_seconds: Number(exercise.rest_seconds ?? 0) || null,
      notes: exercise.notes ?? null,
      sets_json: exercise.sets
    }));
  });

  if (rows.length) {
    await checked(supabase.from("routine_exercises").insert(rows), "insert routine exercises");
  }
}

async function upsertWorkouts(
  supabase: SupabaseAdmin,
  userId: string,
  workouts: HevyWorkout[],
  exerciseTemplateMap: Map<string, string>
) {
  if (!workouts.length) {
    return { exercises: 0, sets: 0 };
  }

  const { data, error } = await supabase
    .from("workouts")
    .upsert(
      workouts.map((workout) => {
        const setCount = workout.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
        const totalVolumeKg = workout.exercises.reduce(
          (exerciseSum, exercise) =>
            exerciseSum +
            exercise.sets.reduce((setSum, set) => {
              if (!set.weight_kg || !set.reps) {
                return setSum;
              }
              return setSum + set.weight_kg * set.reps;
            }, 0),
          0
        );

        return {
          user_id: userId,
          source: "hevy",
          external_id: workout.id,
          title: workout.title,
          description: workout.description ?? null,
          start_at: workout.start_time,
          end_at: workout.end_time,
          duration_seconds: Math.max(0, Math.round((Date.parse(workout.end_time) - Date.parse(workout.start_time)) / 1000)),
          routine_external_id: workout.routine_id ?? null,
          total_volume_kg: totalVolumeKg,
          exercise_count: workout.exercises.length,
          set_count: setCount,
          updated_at: new Date().toISOString()
        };
      }),
      { onConflict: "user_id,source,external_id" }
    )
    .select("id, external_id");

  if (error) {
    throw new Error(`Failed to upsert Hevy workouts: ${error.message}`);
  }

  const workoutIdByExternalId = new Map((data ?? []).map((workout) => [workout.external_id as string, workout.id as string]));
  const workoutIds = [...workoutIdByExternalId.values()];
  if (workoutIds.length) {
    await checked(supabase.from("workout_exercises").delete().in("workout_id", workoutIds), "delete existing workout exercises");
  }

  const exerciseRows = workouts.flatMap((workout) => {
    const workoutId = workoutIdByExternalId.get(workout.id);
    if (!workoutId) {
      return [];
    }

    return workout.exercises.map((exercise) => ({
      user_id: userId,
      workout_id: workoutId,
      exercise_template_id: exercise.exercise_template_id ? (exerciseTemplateMap.get(exercise.exercise_template_id) ?? null) : null,
      external_exercise_id: `${workout.id}:${exercise.index}`,
      title_snapshot: exercise.title,
      position: exercise.index,
      notes: exercise.notes ?? null
    }));
  });

  if (!exerciseRows.length) {
    return { exercises: 0, sets: 0 };
  }

  const { data: insertedExercises, error: insertExerciseError } = await supabase
    .from("workout_exercises")
    .insert(exerciseRows)
    .select("id, external_exercise_id");

  if (insertExerciseError) {
    throw new Error(`Failed to insert Hevy workout exercises: ${insertExerciseError.message}`);
  }

  const exerciseIdByExternalId = new Map(
    (insertedExercises ?? []).map((exercise) => [exercise.external_exercise_id as string, exercise.id as string])
  );
  const setRows = workouts.flatMap((workout) =>
    workout.exercises.flatMap((exercise) => {
      const workoutExerciseId = exerciseIdByExternalId.get(`${workout.id}:${exercise.index}`);
      if (!workoutExerciseId) {
        return [];
      }

      return exercise.sets.map((set) => ({
        user_id: userId,
        workout_exercise_id: workoutExerciseId,
        external_id: `${workout.id}:${exercise.index}:${set.index}`,
        set_index: set.index,
        set_type: set.type ?? null,
        weight_kg: set.weight_kg ?? null,
        reps: set.reps ?? null,
        distance_m: set.distance_meters ?? null,
        duration_seconds: set.duration_seconds == null ? null : Math.round(set.duration_seconds),
        rpe: set.rpe ?? null,
        completed: true
      }));
    })
  );

  if (setRows.length) {
    await checked(supabase.from("workout_sets").insert(setRows), "insert workout sets");
  }

  return { exercises: exerciseRows.length, sets: setRows.length };
}

async function getExternalIdMap(supabase: SupabaseAdmin, table: "exercise_templates", userId: string) {
  const { data, error } = await supabase.from(table).select("id, external_id").eq("user_id", userId).eq("source", "hevy");
  if (error) {
    throw new Error(`Failed to read ${table}: ${error.message}`);
  }

  return new Map((data ?? []).map((row) => [row.external_id as string, row.id as string]));
}

async function checked<T extends { error: null | { message: string } }>(result: PromiseLike<T>, action: string) {
  const { error } = await result;
  if (error) {
    throw new Error(`Failed to ${action}: ${error.message}`);
  }
}
