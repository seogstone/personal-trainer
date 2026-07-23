import type { NormalizedNutritionDay } from "@fitness/shared";

export type NutritionAdherence = {
  calorieAdherencePercent: number | null;
  proteinAdherencePercent: number | null;
  sevenDayAverageCalories: number | null;
  sevenDayAverageProteinG: number | null;
  loggedDayCompleteness: number;
  incompleteDiaryWarning: boolean;
};

export type NutritionAdherenceOptions = {
  currentDate?: string;
  includeCurrentDayInCompleteness?: boolean;
  allowPartialHistoricalLogs?: boolean;
};

const average = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);

export function calculateNutritionAdherence(days: NormalizedNutritionDay[], options: NutritionAdherenceOptions = {}): NutritionAdherence {
  const currentDate = options.currentDate ?? new Date().toISOString().slice(0, 10);
  const completedOrInProgressDays = options.includeCurrentDayInCompleteness ? days : days.filter((day) => day.calendarDate !== currentDate);
  const trackedDays = completedOrInProgressDays.filter(hasLoggedNutrition);
  const completeDays = completedOrInProgressDays.filter((day) => day.complete);
  const analysisDays = completeDays.length || !options.allowPartialHistoricalLogs ? completeDays : trackedDays;
  const latest = days.at(-1);
  const calories = analysisDays.flatMap((day) => (day.caloriesConsumed == null ? [] : [day.caloriesConsumed]));
  const protein = analysisDays.flatMap((day) => (day.proteinG == null ? [] : [day.proteinG]));
  const reliabilityDays = options.allowPartialHistoricalLogs ? trackedDays : completeDays;

  return {
    calorieAdherencePercent:
      latest?.caloriesConsumed && latest.goalCalories ? Math.round((latest.caloriesConsumed / latest.goalCalories) * 100) : null,
    proteinAdherencePercent:
      latest?.proteinG && latest.goalProteinG ? Math.round((latest.proteinG / latest.goalProteinG) * 100) : null,
    sevenDayAverageCalories: average(calories),
    sevenDayAverageProteinG: average(protein),
    loggedDayCompleteness: completedOrInProgressDays.length ? reliabilityDays.length / completedOrInProgressDays.length : 0,
    incompleteDiaryWarning: options.allowPartialHistoricalLogs
      ? completedOrInProgressDays.some((day) => !hasLoggedNutrition(day))
      : completedOrInProgressDays.some((day) => !day.complete)
  };
}

function hasLoggedNutrition(day: NormalizedNutritionDay) {
  return Boolean((day.caloriesConsumed != null && day.caloriesConsumed > 0) || (day.proteinG != null && day.proteinG > 0));
}
