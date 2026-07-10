import type { NormalizedNutritionDay, NormalizedRecovery, NormalizedWorkout, ProviderConnection } from "./providers";

export const demoUserId = "00000000-0000-4000-8000-000000000001";

export const demoConnections: ProviderConnection[] = [
  {
    provider: "whoop",
    status: "degraded",
    lastSuccessfulSyncAt: "2026-07-10T05:30:00.000Z",
    lastAttemptedSyncAt: "2026-07-10T07:30:00.000Z",
    reauthenticationRequired: false,
    safeMessage: "Private API integration isolated behind Totem adapter."
  },
  {
    provider: "hevy",
    status: "connected",
    lastSuccessfulSyncAt: "2026-07-10T07:00:00.000Z",
    lastAttemptedSyncAt: "2026-07-10T07:00:00.000Z",
    reauthenticationRequired: false
  },
  {
    provider: "myfitnesspal",
    status: "reauthentication_required",
    lastSuccessfulSyncAt: "2026-07-09T20:15:00.000Z",
    lastAttemptedSyncAt: "2026-07-10T06:15:00.000Z",
    reauthenticationRequired: true,
    safeMessage: "Cookie refresh required."
  }
];

export const demoRecovery: NormalizedRecovery[] = [
  { userId: demoUserId, source: "whoop", externalId: "r-1", calendarDate: "2026-07-04", recoveryScore: 61, restingHeartRate: 57, hrvRmssdMs: 58 },
  { userId: demoUserId, source: "whoop", externalId: "r-2", calendarDate: "2026-07-05", recoveryScore: 68, restingHeartRate: 55, hrvRmssdMs: 63 },
  { userId: demoUserId, source: "whoop", externalId: "r-3", calendarDate: "2026-07-06", recoveryScore: 72, restingHeartRate: 54, hrvRmssdMs: 69 },
  { userId: demoUserId, source: "whoop", externalId: "r-4", calendarDate: "2026-07-07", recoveryScore: 49, restingHeartRate: 61, hrvRmssdMs: 47 },
  { userId: demoUserId, source: "whoop", externalId: "r-5", calendarDate: "2026-07-08", recoveryScore: 57, restingHeartRate: 59, hrvRmssdMs: 53 },
  { userId: demoUserId, source: "whoop", externalId: "r-6", calendarDate: "2026-07-09", recoveryScore: 66, restingHeartRate: 56, hrvRmssdMs: 64 },
  { userId: demoUserId, source: "whoop", externalId: "r-7", calendarDate: "2026-07-10", recoveryScore: 74, restingHeartRate: 53, hrvRmssdMs: 71 }
];

export const demoNutrition: NormalizedNutritionDay[] = [
  { userId: demoUserId, source: "myfitnesspal", calendarDate: "2026-07-04", caloriesConsumed: 2290, proteinG: 172, carbohydrateG: 210, fatG: 72, goalCalories: 2400, goalProteinG: 180, complete: true },
  { userId: demoUserId, source: "myfitnesspal", calendarDate: "2026-07-05", caloriesConsumed: 2510, proteinG: 181, carbohydrateG: 240, fatG: 78, goalCalories: 2400, goalProteinG: 180, complete: true },
  { userId: demoUserId, source: "myfitnesspal", calendarDate: "2026-07-06", caloriesConsumed: 2360, proteinG: 188, carbohydrateG: 216, fatG: 69, goalCalories: 2400, goalProteinG: 180, complete: true },
  { userId: demoUserId, source: "myfitnesspal", calendarDate: "2026-07-07", caloriesConsumed: 1980, proteinG: 132, carbohydrateG: 176, fatG: 62, goalCalories: 2400, goalProteinG: 180, complete: false },
  { userId: demoUserId, source: "myfitnesspal", calendarDate: "2026-07-08", caloriesConsumed: 2415, proteinG: 184, carbohydrateG: 230, fatG: 74, goalCalories: 2400, goalProteinG: 180, complete: true },
  { userId: demoUserId, source: "myfitnesspal", calendarDate: "2026-07-09", caloriesConsumed: 2335, proteinG: 176, carbohydrateG: 205, fatG: 77, goalCalories: 2400, goalProteinG: 180, complete: true },
  { userId: demoUserId, source: "myfitnesspal", calendarDate: "2026-07-10", caloriesConsumed: 1420, proteinG: 104, carbohydrateG: 126, fatG: 42, goalCalories: 2400, goalProteinG: 180, complete: false }
];

export const demoWorkouts: NormalizedWorkout[] = [
  { userId: demoUserId, source: "hevy", externalId: "w-1", title: "Workout A", startAt: "2026-07-06T17:30:00.000Z", endAt: "2026-07-06T18:28:00.000Z", totalVolumeKg: 6840, exerciseCount: 6, setCount: 19 },
  { userId: demoUserId, source: "hevy", externalId: "w-2", title: "Workout B", startAt: "2026-07-08T17:45:00.000Z", endAt: "2026-07-08T18:43:00.000Z", totalVolumeKg: 7225, exerciseCount: 6, setCount: 20 }
];
