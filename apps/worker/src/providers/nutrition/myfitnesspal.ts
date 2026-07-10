import { existsSync } from "node:fs";
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
    const cookieFile = this.env.MFP_COOKIE_FILE;
    const configured = cookieFile ? existsSync(cookieFile) : false;

    return {
      provider: "myfitnesspal",
      status: configured ? "connected" : "not_configured",
      lastSuccessfulSyncAt: null,
      lastAttemptedSyncAt: null,
      reauthenticationRequired: Boolean(cookieFile && !configured),
      safeMessage: configured
        ? "Cookie-based collection runs through the persistent Python collector."
        : "Configure MFP_COOKIE_FILE with an exported MyFitnessPal browser cookie jar."
    };
  }

  private assertConfigured() {
    if (!this.env.MFP_COOKIE_FILE) {
      throw new Error("MFP_COOKIE_FILE is not configured");
    }
  }
}
