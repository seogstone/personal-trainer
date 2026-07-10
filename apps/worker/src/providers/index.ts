import type { AppEnv, NutritionProvider, RecoveryProvider, TrainingProvider } from "@fitness/shared";
import { CsvNutritionProvider } from "./nutrition/csv";
import { MyFitnessPalProvider } from "./nutrition/myfitnesspal";
import { HevyProvider } from "./training/hevy";
import { TotemWhoopProvider } from "./whoop/totem";

export function createProviders(env: AppEnv): {
  recovery: RecoveryProvider;
  training: TrainingProvider;
  nutrition: NutritionProvider;
  csvNutrition: NutritionProvider;
} {
  return {
    recovery: new TotemWhoopProvider(env),
    training: new HevyProvider(env),
    nutrition: new MyFitnessPalProvider(env),
    csvNutrition: new CsvNutritionProvider()
  };
}
