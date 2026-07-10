import type { AppEnv } from "@fitness/shared";
import { MyFitnessPalProvider, type MfpBodyMetric, type MfpNutritionDay } from "../providers/nutrition/myfitnesspal";
import { createSupabaseAdmin, resolveUserId, type SupabaseAdmin } from "./supabase";

type SyncSummary = {
  userId: string;
  nutritionDays: number;
  nutritionMeals: number;
  bodyMetrics: number;
  rangeStart: string;
  rangeEnd: string;
};

export async function syncMyFitnessPal(env: AppEnv, input?: { startDate?: string; endDate?: string }): Promise<SyncSummary> {
  const supabase = createSupabaseAdmin(env);
  const userId = await resolveUserId(env, supabase);
  const range = resolveRange(input);
  const provider = new MyFitnessPalProvider(env);
  const result = await provider.syncRange({ userId, startDate: range.startDate, endDate: range.endDate });

  const nutritionDayIds = await upsertNutritionDays(supabase, userId, result.nutrition_days);
  const mealCount = await replaceNutritionMeals(supabase, userId, result.nutrition_days, nutritionDayIds);
  await upsertBodyMetrics(supabase, userId, result.body_metrics);
  await upsertMfpConnection(supabase, userId, "connected");

  return {
    userId,
    nutritionDays: result.nutrition_days.length,
    nutritionMeals: mealCount,
    bodyMetrics: result.body_metrics.length,
    rangeStart: range.startDate,
    rangeEnd: range.endDate
  };
}

function resolveRange(input?: { startDate?: string; endDate?: string }) {
  const end = input?.endDate ? new Date(input.endDate) : new Date();
  const start = input?.startDate ? new Date(input.startDate) : new Date(end);
  if (!input?.startDate) {
    start.setDate(end.getDate() - 89);
  }

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10)
  };
}

async function upsertNutritionDays(supabase: SupabaseAdmin, userId: string, days: MfpNutritionDay[]) {
  if (!days.length) {
    return new Map<string, string>();
  }

  const { data, error } = await supabase
    .from("nutrition_days")
    .upsert(
      days.map((day) => ({
        user_id: userId,
        source: "myfitnesspal",
        calendar_date: day.calendar_date,
        calories_consumed: day.calories_consumed == null ? null : Math.round(day.calories_consumed),
        protein_g: day.protein_g,
        carbohydrate_g: day.carbohydrate_g,
        fat_g: day.fat_g,
        fibre_g: day.fibre_g,
        sugar_g: day.sugar_g,
        sodium_mg: day.sodium_mg,
        water_ml: day.water_ml == null ? null : Math.round(day.water_ml),
        goal_calories: day.goal_calories == null ? null : Math.round(day.goal_calories),
        goal_protein_g: day.goal_protein_g,
        goal_carbohydrate_g: day.goal_carbohydrate_g,
        goal_fat_g: day.goal_fat_g,
        complete: day.complete,
        updated_at: new Date().toISOString()
      })),
      { onConflict: "user_id,source,calendar_date" }
    )
    .select("id, calendar_date");

  if (error) {
    throw new Error(`Failed to upsert MyFitnessPal nutrition days: ${error.message}`);
  }

  return new Map((data ?? []).map((row) => [row.calendar_date as string, row.id as string]));
}

async function replaceNutritionMeals(
  supabase: SupabaseAdmin,
  userId: string,
  days: MfpNutritionDay[],
  nutritionDayIds: Map<string, string>
) {
  const dayIds = [...nutritionDayIds.values()];
  if (dayIds.length) {
    await checked(supabase.from("nutrition_meals").delete().in("nutrition_day_id", dayIds), "delete existing nutrition meals");
  }

  const rows = days.flatMap((day) => {
    const nutritionDayId = nutritionDayIds.get(day.calendar_date);
    if (!nutritionDayId) {
      return [];
    }

    return day.meals.map((meal) => ({
      user_id: userId,
      nutrition_day_id: nutritionDayId,
      meal_name: meal.meal_name,
      position: meal.position,
      calories: meal.calories == null ? null : Math.round(meal.calories),
      protein_g: meal.protein_g,
      carbohydrate_g: meal.carbohydrate_g,
      fat_g: meal.fat_g,
      items_json: meal.items,
      updated_at: new Date().toISOString()
    }));
  });

  if (rows.length) {
    await checked(supabase.from("nutrition_meals").insert(rows), "insert nutrition meals");
  }

  return rows.length;
}

async function upsertBodyMetrics(supabase: SupabaseAdmin, userId: string, metrics: MfpBodyMetric[]) {
  if (!metrics.length) {
    return;
  }

  await checked(
    supabase.from("body_metrics").upsert(
      metrics.map((metric) => ({
        user_id: userId,
        source: "myfitnesspal",
        measured_at: `${metric.measured_at}T00:00:00.000Z`,
        weight_kg: metric.weight_kg,
        body_fat_percent: metric.body_fat_percent,
        updated_at: new Date().toISOString()
      })),
      { onConflict: "user_id,source,measured_at" }
    ),
    "upsert body metrics"
  );
}

async function upsertMfpConnection(supabase: SupabaseAdmin, userId: string, status: "connected" | "degraded") {
  await checked(
    supabase.from("integration_connections").upsert(
      {
        user_id: userId,
        provider: "myfitnesspal",
        status,
        last_attempted_sync_at: new Date().toISOString(),
        last_successful_sync_at: status === "connected" ? new Date().toISOString() : null,
        reauthentication_required: false
      },
      { onConflict: "user_id,provider" }
    ),
    "upsert MyFitnessPal connection"
  );
}

async function checked<T extends { error: null | { message: string } }>(result: PromiseLike<T>, action: string) {
  const { error } = await result;
  if (error) {
    throw new Error(`Failed to ${action}: ${error.message}`);
  }
}
