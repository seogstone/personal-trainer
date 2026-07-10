import type { NormalizedBodyMetric, NormalizedNutritionDay, NutritionProvider, ProviderConnection, SyncRange } from "@fitness/shared";

export class CsvNutritionProvider implements NutritionProvider {
  async syncNutrition(_input: SyncRange): Promise<NormalizedNutritionDay[]> {
    return [];
  }

  async syncWeight(_input: SyncRange): Promise<NormalizedBodyMetric[]> {
    return [];
  }

  async getConnectionStatus(): Promise<ProviderConnection> {
    return {
      provider: "csv",
      status: "connected",
      lastSuccessfulSyncAt: null,
      lastAttemptedSyncAt: null,
      reauthenticationRequired: false,
      safeMessage: "Manual CSV import fallback is available."
    };
  }
}
