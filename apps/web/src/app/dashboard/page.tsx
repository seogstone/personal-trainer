import { Activity, Dumbbell, Moon, RefreshCcw, Utensils } from "lucide-react";
import { calculateNutritionAdherence, calculateReadiness, recommendTraining } from "@fitness/analytics";
import { demoConnections, demoNutrition, demoRecovery } from "@fitness/shared";
import { MetricCard } from "@/components/metric-card";
import { TrendChart } from "@/components/trend-chart";
import { Shell } from "@/components/shell";
import { getNutritionOverview } from "@/lib/nutrition-data";
import { getTrainingOverview } from "@/lib/training-data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [training, nutritionOverview] = await Promise.all([getTrainingOverview(), getNutritionOverview()]);
  const todayRecovery = demoRecovery.at(-1);
  const nutritionDays = nutritionOverview.days.length ? nutritionOverview.days : demoNutrition;
  const todayNutrition = nutritionDays.at(-1);
  const nutrition = calculateNutritionAdherence(nutritionDays);
  const readiness = calculateReadiness({
    whoopRecoveryScore: todayRecovery?.recoveryScore ?? null,
    sleepMinutes: 438,
    sleepNeedMinutes: 480,
    hrvRmssdMs: todayRecovery?.hrvRmssdMs ?? null,
    hrvBaselineRmssdMs: 61,
    restingHeartRate: todayRecovery?.restingHeartRate ?? null,
    restingHeartRateBaseline: 56,
    recentTrainingLoadScore: 34
  });
  const readinessScore = readiness.status === "ready" ? readiness.score : null;
  const recommendation = recommendTraining({
    readinessScore,
    workoutsCompletedThisWeek: training.workoutsThisWeek,
    weeklyWorkoutTarget: 3,
    nextRoutineTitle: training.routines[0]?.title ?? "the next planned routine",
    sleptUnderSixHours: false
  });
  const connections = demoConnections.map((connection) => {
    if (connection.provider === "hevy" && training.connection) {
      return {
        ...connection,
        status: training.connection.status === "connected" ? ("connected" as const) : connection.status,
        lastSuccessfulSyncAt: training.connection.lastSuccessfulSyncAt,
        safeMessage: training.routines.length
          ? `${training.routines.length} routines synced from Hevy.`
          : "Hevy connected; no routines synced yet."
      };
    }

    if (connection.provider === "myfitnesspal" && nutritionOverview.connection) {
      return {
        ...connection,
        status: nutritionOverview.connection.status === "connected" ? ("connected" as const) : connection.status,
        lastSuccessfulSyncAt: nutritionOverview.connection.lastSuccessfulSyncAt,
        safeMessage: nutritionOverview.days.length
          ? `${nutritionOverview.days.length} nutrition days synced from MyFitnessPal.`
          : "MyFitnessPal connected; no diary days synced yet."
      };
    }

    return connection;
  });

  return (
    <Shell active="dashboard">
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-muted">Friday, 10 July 2026</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal md:text-4xl">Fitness Command Center</h1>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-border bg-panel px-3 py-2 text-sm text-muted">
            <RefreshCcw className="h-4 w-4" />
            {connections.filter((connection) => connection.status === "connected").length}/3 integrations fresh
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Activity} label="Dashboard readiness" value={readinessScore ? `${readinessScore}` : "N/A"} helper="Deterministic score, not diagnosis" tone="green" />
          <MetricCard icon={Moon} label="Sleep" value="7h 18m" helper="91% of estimated need" tone="blue" />
          <MetricCard icon={Utensils} label="Protein" value={`${todayNutrition?.proteinG ?? 0}g`} helper={`${nutrition.proteinAdherencePercent ?? 0}% of target logged`} tone="amber" />
          <MetricCard icon={Dumbbell} label="Training" value={`${training.workoutsThisWeek}/3`} helper={`${training.routines.length} Hevy routines synced`} tone="red" />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_420px]">
          <div className="rounded-md border border-border bg-panel p-5">
            <p className="text-sm font-medium text-muted">Today</p>
            <h2 className="mt-2 text-xl font-semibold">Recommended adjustment</h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-muted">{recommendation}</p>
            {nutrition.incompleteDiaryWarning ? (
              <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Nutrition diary is incomplete today. Avoid reading low calories as intentional under-eating.
              </p>
            ) : null}
          </div>

          <div className="rounded-md border border-border bg-panel p-5">
            <p className="text-sm font-medium text-muted">Connection status</p>
            <div className="mt-4 flex flex-col gap-3">
              {connections.map((connection) => (
                <div className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0" key={connection.provider}>
                  <div>
                    <p className="font-medium capitalize">{connection.provider}</p>
                    <p className="text-xs text-muted">{connection.safeMessage ?? "Read-only sync configured."}</p>
                  </div>
                  <span className="rounded-sm border border-border px-2 py-1 text-xs text-muted">{connection.status.replaceAll("_", " ")}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <TrendChart
            title="Recovery and HRV"
            data={demoRecovery.map((day) => ({ date: day.calendarDate.slice(5), recovery: day.recoveryScore ?? 0, hrv: day.hrvRmssdMs ?? 0 }))}
            lines={[
              { dataKey: "recovery", name: "Recovery", color: "#0f9f83" },
              { dataKey: "hrv", name: "HRV", color: "#3b82f6" }
            ]}
          />
          <TrendChart
            title="Calories and protein"
            data={nutritionDays.map((day) => ({ date: day.calendarDate.slice(5), calories: day.caloriesConsumed ?? 0, protein: day.proteinG ?? 0 }))}
            lines={[
              { dataKey: "calories", name: "Calories", color: "#ef4444" },
              { dataKey: "protein", name: "Protein", color: "#d97706" }
            ]}
          />
        </section>
      </div>
    </Shell>
  );
}
