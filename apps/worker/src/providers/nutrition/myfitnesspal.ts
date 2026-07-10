import type { AppEnv, NormalizedBodyMetric, NormalizedNutritionDay, NutritionProvider, ProviderConnection, SyncRange } from "@fitness/shared";

export class MyFitnessPalProvider implements NutritionProvider {
  constructor(private readonly env: AppEnv) {}

  async syncNutrition(_input: SyncRange): Promise<NormalizedNutritionDay[]> {
    this.assertConfigured();
    return [];
  }

  async syncWeight(_input: SyncRange): Promise<NormalizedBodyMetric[]> {
    this.assertConfigured();
    return [];
  }

  async getConnectionStatus(): Promise<ProviderConnection> {
    return {
      provider: "myfitnesspal",
      status: this.env.MFP_COOKIE_FILE ? "connected" : "not_configured",
      lastSuccessfulSyncAt: null,
      lastAttemptedSyncAt: null,
      reauthenticationRequired: false,
      safeMessage: "Cookie-based collection runs through the persistent Python collector."
    };
  }

  private assertConfigured() {
    if (!this.env.MFP_COOKIE_FILE) {
      throw new Error("MFP_COOKIE_FILE is not configured");
    }
  }
}
