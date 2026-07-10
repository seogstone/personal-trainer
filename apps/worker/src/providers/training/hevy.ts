import type { AppEnv, NormalizedExerciseTemplate, NormalizedRoutine, NormalizedWorkout, ProviderConnection, SyncRange, TrainingProvider } from "@fitness/shared";

export class HevyProvider implements TrainingProvider {
  constructor(private readonly env: AppEnv) {}

  async syncWorkouts(_input: SyncRange): Promise<NormalizedWorkout[]> {
    this.assertConfigured();
    return [];
  }

  async syncRoutines(): Promise<NormalizedRoutine[]> {
    this.assertConfigured();
    return [];
  }

  async syncExerciseTemplates(): Promise<NormalizedExerciseTemplate[]> {
    this.assertConfigured();
    return [];
  }

  async getConnectionStatus(): Promise<ProviderConnection> {
    return {
      provider: "hevy",
      status: this.env.HEVY_API_KEY ? "connected" : "not_configured",
      lastSuccessfulSyncAt: null,
      lastAttemptedSyncAt: null,
      reauthenticationRequired: false,
      safeMessage: "Hevy API key is read server-side only."
    };
  }

  private assertConfigured() {
    if (!this.env.HEVY_API_KEY) {
      throw new Error("HEVY_API_KEY is not configured");
    }
  }
}
