import type { NormalizedNutritionDay } from "@fitness/shared";
import { createSupabaseAdmin } from "./supabase-admin";

export type NutritionOverview = {
  days: NormalizedNutritionDay[];
  mealCount: number;
  latestWeightKg: number | null;
  connection: {
    status: string;
    lastSuccessfulSyncAt: string | null;
    safeMessage: string | null;
  } | null;
};

export async function getNutritionOverview(): Promise<NutritionOverview> {
  const supabase = createSupabaseAdmin();
  if (!supabase) {
    return emptyNutritionOverview();
  }

  const since = new Date();
  since.setDate(since.getDate() - 13);
  const sinceDate = since.toISOString().slice(0, 10);

  const [daysResult, connectionResult, weightResult] = await Promise.all([
    supabase
      .from("nutrition_days")
      .select("id,calendar_date,calories_consumed,protein_g,carbohydrate_g,fat_g,goal_calories,goal_protein_g,complete,nutrition_meals(id)")
      .eq("source", "myfitnesspal")
      .gte("calendar_date", sinceDate)
      .order("calendar_date", { ascending: true }),
    supabase
      .from("integration_connections")
      .select("status,last_successful_sync_at,last_error_message_safe")
      .eq("provider", "myfitnesspal")
      .maybeSingle(),
    supabase
      .from("body_metrics")
      .select("weight_kg")
      .eq("source", "myfitnesspal")
      .not("weight_kg", "is", null)
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  if (daysResult.error) {
    return emptyNutritionOverview(connectionResult.data?.status ?? "degraded");
  }

  return {
    days:
      daysResult.data?.map((day) => ({
        userId: "",
        source: "myfitnesspal",
        calendarDate: day.calendar_date as string,
        caloriesConsumed: (day.calories_consumed as number | null) ?? null,
        proteinG: (day.protein_g as number | null) ?? null,
        carbohydrateG: (day.carbohydrate_g as number | null) ?? null,
        fatG: (day.fat_g as number | null) ?? null,
        goalCalories: (day.goal_calories as number | null) ?? null,
        goalProteinG: (day.goal_protein_g as number | null) ?? null,
        complete: Boolean(day.complete)
      })) ?? [],
    mealCount:
      daysResult.data?.reduce((sum, day) => {
        return sum + (Array.isArray(day.nutrition_meals) ? day.nutrition_meals.length : 0);
      }, 0) ?? 0,
    latestWeightKg: weightResult.error ? null : ((weightResult.data?.weight_kg as number | null | undefined) ?? null),
    connection: connectionResult.data
      ? {
          status: connectionResult.data.status as string,
          lastSuccessfulSyncAt: (connectionResult.data.last_successful_sync_at as string | null) ?? null,
          safeMessage: (connectionResult.data.last_error_message_safe as string | null) ?? null
        }
      : null
  };
}

function emptyNutritionOverview(status = "not_configured"): NutritionOverview {
  return {
    days: [],
    mealCount: 0,
    latestWeightKg: null,
    connection: {
      status,
      lastSuccessfulSyncAt: null,
      safeMessage: null
    }
  };
}
