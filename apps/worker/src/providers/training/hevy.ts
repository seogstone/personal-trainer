import { z } from "zod";
import type {
  AppEnv,
  NormalizedExerciseTemplate,
  NormalizedRoutine,
  NormalizedWorkout,
  ProviderConnection,
  SyncRange,
  TrainingProvider
} from "@fitness/shared";

const hevyBaseUrl = "https://api.hevyapp.com/v1";

const hevySetSchema = z.object({
  index: z.number(),
  type: z.string().nullable().optional(),
  weight_kg: z.number().nullable().optional(),
  reps: z.number().nullable().optional(),
  distance_meters: z.number().nullable().optional(),
  duration_seconds: z.number().nullable().optional(),
  rpe: z.number().nullable().optional(),
  custom_metric: z.number().nullable().optional()
});

const hevyWorkoutExerciseSchema = z.object({
  index: z.number(),
  title: z.string(),
  notes: z.string().nullable().optional(),
  exercise_template_id: z.string().nullable().optional(),
  supersets_id: z.number().nullable().optional(),
  sets: z.array(hevySetSchema).default([])
});

const hevyWorkoutSchema = z.object({
  id: z.string(),
  title: z.string(),
  routine_id: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  start_time: z.string(),
  end_time: z.string(),
  updated_at: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  exercises: z.array(hevyWorkoutExerciseSchema).default([])
});

const hevyRoutineExerciseSchema = z.object({
  index: z.number(),
  title: z.string(),
  rest_seconds: z.union([z.number(), z.string()]).nullable().optional(),
  notes: z.string().nullable().optional(),
  exercise_template_id: z.string().nullable().optional(),
  supersets_id: z.number().nullable().optional(),
  sets: z.array(hevySetSchema.extend({ rep_range: z.unknown().optional() })).default([])
});

const hevyRoutineSchema = z.object({
  id: z.string(),
  title: z.string(),
  folder_id: z.number().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  exercises: z.array(hevyRoutineExerciseSchema).default([])
});

const hevyExerciseTemplateSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.string().nullable().optional(),
  primary_muscle_group: z.string().nullable().optional(),
  secondary_muscle_groups: z.array(z.string()).default([]),
  equipment_category: z.string().nullable().optional(),
  is_custom: z.boolean().default(false)
});

const userInfoResponseSchema = z.object({
  data: z.object({
    id: z.string(),
    name: z.string(),
    url: z.string().nullable().optional()
  })
});

const workoutsPageSchema = z.object({
  page: z.number(),
  page_count: z.number(),
  workouts: z.array(hevyWorkoutSchema)
});

const routinesPageSchema = z.object({
  page: z.number(),
  page_count: z.number(),
  routines: z.array(hevyRoutineSchema)
});

const exerciseTemplatesPageSchema = z.object({
  page: z.number(),
  page_count: z.number(),
  exercise_templates: z.array(hevyExerciseTemplateSchema)
});

export type HevyWorkout = z.output<typeof hevyWorkoutSchema>;
export type HevyRoutine = z.output<typeof hevyRoutineSchema>;
export type HevyExerciseTemplate = z.output<typeof hevyExerciseTemplateSchema>;

export class HevyProvider implements TrainingProvider {
  constructor(private readonly env: AppEnv) {}

  async syncWorkouts(input: SyncRange): Promise<NormalizedWorkout[]> {
    const workouts = await this.listWorkouts();
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);

    return workouts
      .filter((workout) => {
        const startedAt = new Date(workout.start_time);
        return startedAt >= start && startedAt <= end;
      })
      .map((workout) => this.toNormalizedWorkout(input.userId, workout));
  }

  async syncRoutines(): Promise<NormalizedRoutine[]> {
    const routines = await this.listRoutines();
    return routines.map((routine) => ({
      userId: "00000000-0000-4000-8000-000000000000",
      source: "hevy",
      externalId: routine.id,
      title: routine.title,
      description: null
    }));
  }

  async syncExerciseTemplates(): Promise<NormalizedExerciseTemplate[]> {
    const templates = await this.listExerciseTemplates();
    return templates.map((template) => ({
      userId: "00000000-0000-4000-8000-000000000000",
      source: "hevy",
      externalId: template.id,
      title: template.title,
      primaryMuscleGroup: template.primary_muscle_group ?? null,
      equipment: template.equipment_category ?? null
    }));
  }

  async getConnectionStatus(): Promise<ProviderConnection> {
    if (!this.env.HEVY_API_KEY) {
      return {
        provider: "hevy",
        status: "not_configured",
        lastSuccessfulSyncAt: null,
        lastAttemptedSyncAt: null,
        reauthenticationRequired: false,
        safeMessage: "HEVY_API_KEY is not configured."
      };
    }

    try {
      await this.getUserInfo();
      return {
        provider: "hevy",
        status: "connected",
        lastSuccessfulSyncAt: null,
        lastAttemptedSyncAt: null,
        reauthenticationRequired: false,
        safeMessage: "Hevy API key is valid and read server-side only."
      };
    } catch {
      return {
        provider: "hevy",
        status: "degraded",
        lastSuccessfulSyncAt: null,
        lastAttemptedSyncAt: new Date().toISOString(),
        reauthenticationRequired: false,
        safeMessage: "Hevy API connection check failed."
      };
    }
  }

  async getUserInfo() {
    return userInfoResponseSchema.parse(await this.fetchJson("/user/info")).data;
  }

  async listWorkouts() {
    return this.fetchPaginated("/workouts", "workouts", workoutsPageSchema, 10);
  }

  async listRoutines() {
    return this.fetchPaginated("/routines", "routines", routinesPageSchema, 10);
  }

  async listExerciseTemplates() {
    return this.fetchPaginated("/exercise_templates", "exercise_templates", exerciseTemplatesPageSchema, 100);
  }

  private toNormalizedWorkout(userId: string, workout: HevyWorkout): NormalizedWorkout {
    const totalVolumeKg = workout.exercises.reduce((exerciseSum, exercise) => {
      return (
        exerciseSum +
        exercise.sets.reduce((setSum, set) => {
          if (!set.weight_kg || !set.reps) {
            return setSum;
          }

          return setSum + set.weight_kg * set.reps;
        }, 0)
      );
    }, 0);
    const setCount = workout.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);

    return {
      userId,
      source: "hevy",
      externalId: workout.id,
      title: workout.title,
      startAt: workout.start_time,
      endAt: workout.end_time,
      totalVolumeKg,
      exerciseCount: workout.exercises.length,
      setCount
    };
  }

  private async fetchPaginated<TPage extends { page_count: number }, TKey extends string, TItem>(
    path: string,
    key: TKey,
    schema: z.ZodType<TPage & Record<TKey, TItem[]>, z.ZodTypeDef, unknown>,
    pageSize: number
  ) {
    const items: TItem[] = [];
    let page = 1;
    let pageCount = 1;

    do {
      const payload = schema.parse(await this.fetchJson(path, { page: String(page), pageSize: String(pageSize) })) as TPage &
        Record<TKey, TItem[]>;
      items.push(...payload[key]);
      pageCount = payload.page_count;
      page += 1;
    } while (page <= pageCount);

    return items;
  }

  private async fetchJson(path: string, params?: Record<string, string>) {
    this.assertConfigured();
    const url = new URL(`${hevyBaseUrl}${path}`);
    for (const [key, value] of Object.entries(params ?? {})) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url, {
      headers: {
        "api-key": this.env.HEVY_API_KEY ?? "",
        accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Hevy request failed with status ${response.status}`);
    }

    return response.json();
  }

  private assertConfigured() {
    if (!this.env.HEVY_API_KEY) {
      throw new Error("HEVY_API_KEY is not configured");
    }
  }
}
