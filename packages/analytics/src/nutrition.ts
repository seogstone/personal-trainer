import type { NormalizedNutritionDay } from "@fitness/shared";

export type NutritionAdherence = {
  calorieAdherencePercent: number | null;
  proteinAdherencePercent: number | null;
  sevenDayAverageCalories: number | null;
  sevenDayAverageProteinG: number | null;
  loggedDayCompleteness: number;
  incompleteDiaryWarning: boolean;
};

const average = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);

export function calculateNutritionAdherence(days: NormalizedNutritionDay[]): NutritionAdherence {
  const completeDays = days.filter((day) => day.complete);
  const latest = days.at(-1);
  const calories = completeDays.flatMap((day) => (day.caloriesConsumed == null ? [] : [day.caloriesConsumed]));
  const protein = completeDays.flatMap((day) => (day.proteinG == null ? [] : [day.proteinG]));

  return {
    calorieAdherencePercent:
      latest?.caloriesConsumed && latest.goalCalories ? Math.round((latest.caloriesConsumed / latest.goalCalories) * 100) : null,
    proteinAdherencePercent:
      latest?.proteinG && latest.goalProteinG ? Math.round((latest.proteinG / latest.goalProteinG) * 100) : null,
    sevenDayAverageCalories: average(calories),
    sevenDayAverageProteinG: average(protein),
    loggedDayCompleteness: days.length ? completeDays.length / days.length : 0,
    incompleteDiaryWarning: days.some((day) => !day.complete)
  };
}
