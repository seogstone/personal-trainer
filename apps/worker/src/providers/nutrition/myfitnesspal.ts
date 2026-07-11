import { execFile } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import type {
  AppEnv,
  NormalizedBodyMetric,
  NormalizedNutritionDay,
  NutritionProvider,
  ProviderConnection,
  SyncRange
} from "@fitness/shared";

const execFileAsync = promisify(execFile);

const mfpMealSchema = z.object({
  meal_name: z.string(),
  position: z.number(),
  calories: z.number().nullable(),
  protein_g: z.number().nullable(),
  carbohydrate_g: z.number().nullable(),
  fat_g: z.number().nullable(),
  items: z.array(z.record(z.unknown()))
});

const mfpNutritionDaySchema = z.object({
  source: z.literal("myfitnesspal"),
  calendar_date: z.string(),
  calories_consumed: z.number().nullable(),
  protein_g: z.number().nullable(),
  carbohydrate_g: z.number().nullable(),
  fat_g: z.number().nullable(),
  fibre_g: z.number().nullable(),
  sugar_g: z.number().nullable(),
  sodium_mg: z.number().nullable(),
  water_ml: z.number().nullable(),
  goal_calories: z.number().nullable(),
  goal_protein_g: z.number().nullable(),
  goal_carbohydrate_g: z.number().nullable(),
  goal_fat_g: z.number().nullable(),
  complete: z.boolean(),
  meals: z.array(mfpMealSchema)
});

const mfpBodyMetricSchema = z.object({
  source: z.literal("myfitnesspal"),
  measured_at: z.string(),
  weight_kg: z.number().nullable(),
  body_fat_percent: z.number().nullable()
});

const mfpSyncRangeSchema = z.object({
  status: z.literal("ok"),
  nutrition_days: z.array(mfpNutritionDaySchema),
  body_metrics: z.array(mfpBodyMetricSchema)
});

export type MfpNutritionDay = z.infer<typeof mfpNutritionDaySchema>;
export type MfpBodyMetric = z.infer<typeof mfpBodyMetricSchema>;
export type MfpSyncRange = z.infer<typeof mfpSyncRangeSchema>;

export class MyFitnessPalProvider implements NutritionProvider {
  constructor(private readonly env: AppEnv) {}

  async syncNutrition(input: SyncRange): Promise<NormalizedNutritionDay[]> {
    const result = await this.syncRange(input);
    return result.nutrition_days.map((day) => ({
      userId: input.userId,
      source: "myfitnesspal",
      calendarDate: day.calendar_date,
      caloriesConsumed: day.calories_consumed,
      proteinG: day.protein_g,
      carbohydrateG: day.carbohydrate_g,
      fatG: day.fat_g,
      goalCalories: day.goal_calories,
      goalProteinG: day.goal_protein_g,
      complete: day.complete
    }));
  }

  async syncWeight(input: SyncRange): Promise<NormalizedBodyMetric[]> {
    const result = await this.syncRange(input);
    return result.body_metrics.map((metric) => ({
      userId: input.userId,
      source: "myfitnesspal",
      measuredAt: metric.measured_at,
      weightKg: metric.weight_kg,
      bodyFatPercent: metric.body_fat_percent
    }));
  }

  async syncRange(input: SyncRange): Promise<MfpSyncRange> {
    this.assertConfigured();

    if (shouldUseMfpService(this.env)) {
      const response = await fetch(`${getMfpServiceUrl(this.env)}/sync-range`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.env.INTERNAL_WORKER_SECRET}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          start_date: input.startDate,
          end_date: input.endDate
        })
      });

      if (!response.ok) {
        throw new Error(`MFP service sync failed with status ${response.status}: ${await response.text()}`);
      }

      return mfpSyncRangeSchema.parse(await response.json());
    }

    const root = findWorkspaceRoot(process.cwd());
    const executable = join(root, "services/mfp/.venv/bin/fitness-mfp");
    if (!existsSync(executable)) {
      throw new Error("MFP collector is not installed. Run services/mfp/.venv/bin/python -m pip install -e services/mfp");
    }

    const { stdout } = await execFileAsync(
      executable,
      ["sync-range", input.startDate, input.endDate, "--cookie-file", this.env.MFP_COOKIE_FILE ?? ""],
      {
        cwd: root,
        maxBuffer: 1024 * 1024 * 10,
        timeout: 1000 * 60 * 5
      }
    );

    return mfpSyncRangeSchema.parse(JSON.parse(stdout));
  }

  async getConnectionStatus(): Promise<ProviderConnection> {
    const configured = Boolean(this.env.MFP_COOKIE_TEXT || this.env.MFP_COOKIE_BASE64) || Boolean(this.env.MFP_COOKIE_FILE && hasUsableCookieFile(this.env.MFP_COOKIE_FILE));

    return {
      provider: "myfitnesspal",
      status: configured ? "connected" : "not_configured",
      lastSuccessfulSyncAt: null,
      lastAttemptedSyncAt: null,
      reauthenticationRequired: Boolean((this.env.MFP_COOKIE_FILE || this.env.MFP_COOKIE_TEXT || this.env.MFP_COOKIE_BASE64) && !configured),
      safeMessage: configured
        ? "Cookie-based collection runs through the persistent Python collector."
        : "Configure MFP_COOKIE_FILE with an exported MyFitnessPal browser cookie jar."
    };
  }

  private assertConfigured() {
    if (shouldUseMfpService(this.env)) {
      if (!this.env.MFP_COOKIE_TEXT && !this.env.MFP_COOKIE_BASE64 && !this.env.MFP_COOKIE_FILE) {
        throw new Error("Configure MFP_COOKIE_TEXT or MFP_COOKIE_BASE64 for production MyFitnessPal sync");
      }
      return;
    }

    if (!this.env.MFP_COOKIE_FILE || !hasUsableCookieFile(this.env.MFP_COOKIE_FILE)) {
      throw new Error("MFP_COOKIE_FILE is not configured");
    }
  }
}

function shouldUseMfpService(env: AppEnv) {
  return Boolean(env.MFP_SERVICE_URL || process.env.VERCEL);
}

function getMfpServiceUrl(env: AppEnv) {
  return (env.MFP_SERVICE_URL ?? `${env.APP_BASE_URL.replace(/\/$/, "")}/api/mfp`).replace(/\/$/, "");
}

function hasUsableCookieFile(path: string) {
  try {
    return existsSync(path) && statSync(path).size > 0;
  } catch {
    return false;
  }
}

function findWorkspaceRoot(start: string) {
  let current = start;

  while (current !== dirname(current)) {
    if (existsSync(join(current, "pnpm-workspace.yaml"))) {
      return current;
    }

    current = dirname(current);
  }

  return start;
}
