import type { AppEnv, NormalizedActivity, NormalizedRecovery, NormalizedSleep, ProviderConnection, RecoveryProvider, SyncRange } from "@fitness/shared";

export class TotemWhoopProvider implements RecoveryProvider {
  constructor(private readonly env: AppEnv) {}

  async syncRecovery(_input: SyncRange): Promise<NormalizedRecovery[]> {
    this.assertConfigured();
    return [];
  }

  async syncSleep(_input: SyncRange): Promise<NormalizedSleep[]> {
    this.assertConfigured();
    return [];
  }

  async syncActivities(_input: SyncRange): Promise<NormalizedActivity[]> {
    this.assertConfigured();
    return [];
  }

  async getConnectionStatus(): Promise<ProviderConnection> {
    return {
      provider: "whoop",
      status: this.env.WHOOP_TOTEM_CREDENTIALS_PATH ? "connected" : "not_configured",
      lastSuccessfulSyncAt: null,
      lastAttemptedSyncAt: null,
      reauthenticationRequired: false,
      safeMessage: "Totem adapter is read-only and isolated for future official API replacement."
    };
  }

  private assertConfigured() {
    if (!this.env.WHOOP_TOTEM_CREDENTIALS_PATH) {
      throw new Error("WHOOP Totem credentials path is not configured");
    }
  }
}
