export type ProviderId = "whoop" | "hevy" | "myfitnesspal" | "csv";

export type ConnectionStatus =
  | "connected"
  | "not_configured"
  | "reauthentication_required"
  | "degraded"
  | "syncing";

export type SyncRange = {
  userId: string;
  startDate: string;
  endDate: string;
};

export type ProviderConnection = {
  provider: ProviderId;
  status: ConnectionStatus;
  lastSuccessfulSyncAt: string | null;
  lastAttemptedSyncAt: string | null;
  reauthenticationRequired: boolean;
  safeMessage?: string;
};

export type NormalizedRecovery = {
  userId: string;
  source: "whoop";
  externalId: string;
  calendarDate: string;
  recoveryScore: number | null;
  restingHeartRate: number | null;
  hrvRmssdMs: number | null;
};

export type NormalizedSleep = {
  userId: string;
  source: "whoop";
  externalId: string;
  startAt: string;
  endAt: string;
  totalSleepMinutes: number | null;
  sleepNeedMinutes: number | null;
  sleepPerformancePercent: number | null;
};

export type NormalizedActivity = {
  userId: string;
  source: "whoop";
  externalId: string;
  activityType: string;
  startAt: string;
  endAt: string;
  strain: number | null;
};

export type NormalizedWorkout = {
  userId: string;
  source: "hevy";
  externalId: string;
  title: string;
  startAt: string;
  endAt: string;
  totalVolumeKg: number;
  exerciseCount: number;
  setCount: number;
};

export type NormalizedRoutine = {
  userId: string;
  source: "hevy";
  externalId: string;
  title: string;
  description: string | null;
};

export type NormalizedExerciseTemplate = {
  userId: string;
  source: "hevy";
  externalId: string;
  title: string;
  primaryMuscleGroup: string | null;
  equipment: string | null;
};

export type NormalizedNutritionDay = {
  userId: string;
  source: "myfitnesspal" | "csv";
  calendarDate: string;
  caloriesConsumed: number | null;
  proteinG: number | null;
  carbohydrateG: number | null;
  fatG: number | null;
  goalCalories: number | null;
  goalProteinG: number | null;
  complete: boolean;
};

export type NormalizedBodyMetric = {
  userId: string;
  source: "myfitnesspal" | "csv";
  measuredAt: string;
  weightKg: number | null;
  bodyFatPercent: number | null;
};

export interface RecoveryProvider {
  syncRecovery(input: SyncRange): Promise<NormalizedRecovery[]>;
  syncSleep(input: SyncRange): Promise<NormalizedSleep[]>;
  syncActivities(input: SyncRange): Promise<NormalizedActivity[]>;
  getConnectionStatus(): Promise<ProviderConnection>;
}

export interface TrainingProvider {
  syncWorkouts(input: SyncRange): Promise<NormalizedWorkout[]>;
  syncRoutines(): Promise<NormalizedRoutine[]>;
  syncExerciseTemplates(): Promise<NormalizedExerciseTemplate[]>;
  getConnectionStatus(): Promise<ProviderConnection>;
}

export interface NutritionProvider {
  syncNutrition(input: SyncRange): Promise<NormalizedNutritionDay[]>;
  syncWeight(input: SyncRange): Promise<NormalizedBodyMetric[]>;
  getConnectionStatus(): Promise<ProviderConnection>;
}
