import {
  Activity,
  AlertTriangle,
  BedDouble,
  Brain,
  CalendarCheck,
  Clock3,
  Dumbbell,
  HeartPulse,
  RefreshCcw,
  Scale,
  ShieldCheck,
  Target,
  TrendingUp,
  Utensils
} from "lucide-react";
import { calculateNutritionAdherence, calculateReadiness, recommendTraining } from "@fitness/analytics";
import { demoConnections, demoNutrition, demoRecovery } from "@fitness/shared";
import { TrendChart } from "@/components/trend-chart";
import { ManualSyncButton } from "@/components/manual-sync-button";
import { Shell } from "@/components/shell";
import { getAiBriefing } from "@/lib/ai-briefing";
import { getNutritionOverview } from "@/lib/nutrition-data";
import { getRecoveryOverview } from "@/lib/recovery-data";
import { getTrainingOverview } from "@/lib/training-data";

export const dynamic = "force-dynamic";

const WEEKLY_WORKOUT_TARGET = 3;

export default async function DashboardPage() {
  const [training, nutritionOverview, recoveryOverview] = await Promise.all([getTrainingOverview(), getNutritionOverview(), getRecoveryOverview()]);
  const recoveryDays = recoveryOverview.recoveries.length ? recoveryOverview.recoveries : demoRecovery;
  const nutritionDays = nutritionOverview.days.length ? nutritionOverview.days : demoNutrition;
  const todayRecovery = recoveryDays.at(-1);
  const previousRecovery = recoveryDays.at(-2);
  const todaySleep = recoveryOverview.sleeps.at(-1);
  const todayNutrition = nutritionDays.at(-1);
  const nutrition = calculateNutritionAdherence(nutritionDays);
  const sleepDebtMinutes = todaySleep?.totalSleepMinutes != null && todaySleep.sleepNeedMinutes != null ? todaySleep.sleepNeedMinutes - todaySleep.totalSleepMinutes : null;
  const readiness = calculateReadiness({
    whoopRecoveryScore: todayRecovery?.recoveryScore ?? null,
    sleepMinutes: todaySleep?.totalSleepMinutes ?? null,
    sleepNeedMinutes: todaySleep?.sleepNeedMinutes ?? null,
    hrvRmssdMs: todayRecovery?.hrvRmssdMs ?? null,
    hrvBaselineRmssdMs: average(recoveryDays.map((day) => day.hrvRmssdMs).filter(isNumber)),
    restingHeartRate: todayRecovery?.restingHeartRate ?? null,
    restingHeartRateBaseline: average(recoveryDays.map((day) => day.restingHeartRate).filter(isNumber)),
    recentTrainingLoadScore: Math.min(75, training.workoutsThisWeek * 18)
  });
  const readinessScore = readiness.status === "ready" ? readiness.score : null;
  const recommendation = recommendTraining({
    readinessScore,
    workoutsCompletedThisWeek: training.workoutsThisWeek,
    weeklyWorkoutTarget: WEEKLY_WORKOUT_TARGET,
    nextRoutineTitle: training.routines[0]?.title ?? "the next planned routine",
    sleptUnderSixHours: Boolean(todaySleep?.totalSleepMinutes && todaySleep.totalSleepMinutes < 360)
  });
  const aiBriefing = await getAiBriefing({ training, nutrition: nutritionOverview, recovery: recoveryOverview });
  const connections = resolveConnections({
    training,
    nutritionDays: nutritionOverview.days.length,
    nutritionConnection: nutritionOverview.connection,
    recoveryDays: recoveryOverview.recoveries.length,
    recoveryConnection: recoveryOverview.connection,
    hevyConnection: training.connection
  });

  const readinessLabel = readinessScore == null ? "Incomplete data" : readinessScore >= 75 ? "Good to train" : readinessScore >= 55 ? "Train controlled" : "Keep it light";
  const recoveryDelta = todayRecovery?.recoveryScore != null && previousRecovery?.recoveryScore != null ? todayRecovery.recoveryScore - previousRecovery.recoveryScore : null;
  const proteinTarget = todayNutrition?.goalProteinG ?? 180;
  const proteinValue = todayNutrition?.proteinG ?? 0;
  const proteinPercent = proteinTarget ? Math.round((proteinValue / proteinTarget) * 100) : null;
  const calorieAverage = nutrition.sevenDayAverageCalories ? Math.round(nutrition.sevenDayAverageCalories) : null;
  const loggedCompleteness = Math.round(nutrition.loggedDayCompleteness * 100);

  return (
    <Shell active="dashboard">
      <div className="flex flex-col gap-4 sm:gap-5">
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">{formatToday()}</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-normal sm:text-3xl">Today&apos;s command center</h1>
            </div>
            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              <div className="flex min-w-fit items-center justify-center gap-2 rounded-md border border-border bg-panel/80 px-2.5 py-2 text-xs text-muted">
                <RefreshCcw className="h-4 w-4 text-accent" />
                {connections.filter((connection) => connection.status === "connected").length}/3 live
              </div>
              <ManualSyncButton />
            </div>
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-lg border border-border bg-panel/95 p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-muted">
                  <Activity className="h-4 w-4 text-accent" />
                  Training decision
                </p>
                <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">{readinessLabel}</h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-muted sm:text-base">{recommendation}</p>
              </div>
              <ScoreDial label="Readiness" score={readinessScore} />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <Signal label="Recovery" value={todayRecovery?.recoveryScore != null ? `${todayRecovery.recoveryScore}%` : "N/A"} detail={formatDelta(recoveryDelta)} icon={HeartPulse} />
              <Signal label="Sleep gap" value={sleepDebtMinutes == null ? "N/A" : sleepDebtMinutes > 0 ? `-${formatMinutesShort(sleepDebtMinutes)}` : "Covered"} detail={todaySleep?.sleepPerformancePercent ? `${Math.round(todaySleep.sleepPerformancePercent)}% performance` : "WHOOP sleep"} icon={BedDouble} />
              <Signal label="Next session" value={training.routines[0]?.title ?? "No routine"} detail={`${training.workoutsThisWeek}/${WEEKLY_WORKOUT_TARGET} workouts this week`} icon={Dumbbell} />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-panel/95 p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-medium text-muted">
                <Brain className="h-4 w-4 text-[#f0ad4e]" />
                Coach briefing
              </p>
              <span className="rounded-sm border border-border px-2 py-1 text-xs text-muted">{aiBriefing.status.replaceAll("_", " ")}</span>
            </div>
            <h2 className="mt-2 text-xl font-semibold">{aiBriefing.headline}</h2>
            <p className="mt-3 text-sm leading-6 text-muted">{aiBriefing.summary}</p>
          </div>
        </section>

        {aiBriefing.attentionItems.length ? (
          <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {aiBriefing.attentionItems.map((item) => (
              <AttentionItem detail={item.detail} key={`${item.label}:${item.detail}`} label={item.label} severity={item.severity} />
            ))}
          </section>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard icon={Utensils} label="Protein today" value={`${Math.round(proteinValue)}g`} subvalue={proteinPercent == null ? "No target" : `${proteinPercent}% of ${Math.round(proteinTarget)}g`} progress={proteinPercent} tone="cyan" />
          <KpiCard icon={Scale} label="Body comp" value={nutritionOverview.latestWeightKg ? `${nutritionOverview.latestWeightKg}kg` : "N/A"} subvalue={nutritionOverview.latestBodyFatPercent ? `${nutritionOverview.latestBodyFatPercent}% body fat` : "RENPHO trend"} tone="coral" />
          <KpiCard icon={CalendarCheck} label="Training week" value={`${training.workoutsThisWeek}/${WEEKLY_WORKOUT_TARGET}`} subvalue={`${training.routines.length} routines ready`} progress={(training.workoutsThisWeek / WEEKLY_WORKOUT_TARGET) * 100} tone="amber" />
          <KpiCard icon={Clock3} label="Food log" value={`${loggedCompleteness}%`} subvalue={calorieAverage ? `${calorieAverage} kcal avg` : `${nutritionOverview.mealCount} meals logged`} progress={loggedCompleteness} tone="violet" />
        </section>

        <section className="grid gap-3 lg:grid-cols-3">
          <FocusPanel
            icon={ShieldCheck}
            title="Joint-aware training"
            eyebrow="Shoulder · knee · ankle"
            lines={[
              "Warm up longer than you think you need.",
              "Keep main lifts controlled and stop sharp pain early.",
              training.workoutsThisWeek < WEEKLY_WORKOUT_TARGET ? "Protect the habit: complete the next routine before adding extras." : "Weekly target is covered; optional work should stay easy."
            ]}
          />
          <FocusPanel
            icon={Target}
            title="Nutrition target"
            eyebrow="Fat loss with muscle retention"
            lines={[
              nutrition.incompleteDiaryWarning ? "Food log is incomplete, so calorie conclusions are provisional." : "Food log has enough completed days for a useful signal.",
              `Protein target: ${Math.round(proteinTarget)}g. Current logged: ${Math.round(proteinValue)}g.`,
              nutritionOverview.latestWeightKg ? `Latest RENPHO weight: ${nutritionOverview.latestWeightKg}kg.` : "No recent body-weight record available."
            ]}
          />
          <FocusPanel
            icon={TrendingUp}
            title="Recovery trend"
            eyebrow="WHOOP context"
            lines={[
              todayRecovery?.hrvRmssdMs ? `HRV: ${Math.round(todayRecovery.hrvRmssdMs)} ms.` : "HRV not available.",
              todayRecovery?.restingHeartRate ? `Resting HR: ${todayRecovery.restingHeartRate} bpm.` : "Resting heart rate not available.",
              sleepDebtMinutes == null ? "Sleep need data is missing." : sleepDebtMinutes > 0 ? `Sleep is short by ${formatMinutesShort(sleepDebtMinutes)}.` : "Sleep need is covered."
            ]}
          />
        </section>

        <section className="grid gap-3 lg:grid-cols-2">
          <TrendChart
            title="Recovery, HRV and sleep"
            data={mergeRecoverySleep(recoveryDays, recoveryOverview.sleeps)}
            lines={[
              { dataKey: "recovery", name: "Recovery", color: "#37c5d6" },
              { dataKey: "hrv", name: "HRV", color: "#f0ad4e" },
              { dataKey: "sleep", name: "Sleep hours", color: "#d783ff" }
            ]}
          />
          <TrendChart
            title="Calories and protein"
            data={nutritionDays.map((day) => ({ date: day.calendarDate.slice(5), calories: day.caloriesConsumed ?? 0, protein: day.proteinG ?? 0 }))}
            lines={[
              { dataKey: "calories", name: "Calories", color: "#ff8a64" },
              { dataKey: "protein", name: "Protein", color: "#37c5d6" }
            ]}
          />
        </section>

        <section className="rounded-lg border border-border bg-panel/90 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Data freshness</h2>
            <p className="text-xs text-muted">Server-side sync only</p>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {connections.map((connection) => (
              <div className="rounded-md border border-border/80 px-3 py-2" key={connection.provider}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium capitalize">{connection.provider}</p>
                  <span className="text-xs text-muted">{connection.status.replaceAll("_", " ")}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted">{connection.safeMessage ?? "Read-only sync configured."}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Shell>
  );
}

function ScoreDial({ label, score }: { label: string; score: number | null }) {
  const value = score ?? 0;
  return (
    <div className="flex min-w-[7.5rem] items-center justify-center sm:justify-end">
      <div
        aria-label={`${label}: ${score ?? "not available"}`}
        className="grid h-28 w-28 place-items-center rounded-full"
        style={{ background: `conic-gradient(#37c5d6 ${value * 3.6}deg, rgba(238, 232, 213, 0.12) 0deg)` }}
      >
        <div className="grid h-[5.8rem] w-[5.8rem] place-items-center rounded-full bg-panel text-center">
          <div>
            <p className="text-3xl font-semibold">{score ?? "--"}</p>
            <p className="text-[11px] text-muted">{label}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Signal({ icon: Icon, label, value, detail }: { icon: typeof Activity; label: string; value: string; detail: string | null }) {
  return (
    <div className="rounded-md border border-border/80 bg-background/40 p-3">
      <p className="flex items-center gap-2 text-xs font-medium text-muted">
        <Icon className="h-4 w-4 text-accent" />
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted">{detail ?? "No comparison yet"}</p>
    </div>
  );
}

function AttentionItem({ label, detail, severity }: { label: string; detail: string; severity: "low" | "medium" | "high" }) {
  const severityClass = severity === "high" ? "text-[#ff8a64]" : severity === "medium" ? "text-[#f0ad4e]" : "text-[#37c5d6]";
  return (
    <article className="rounded-md border border-border bg-panel/90 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium">{label}</p>
        <AlertTriangle className={`h-4 w-4 ${severityClass}`} />
      </div>
      <p className="mt-2 text-sm leading-6 text-muted">{detail}</p>
      <p className={`mt-2 text-xs font-medium uppercase tracking-[0.18em] ${severityClass}`}>{severity}</p>
    </article>
  );
}

function KpiCard({ icon: Icon, label, value, subvalue, progress, tone }: { icon: typeof Activity; label: string; value: string; subvalue: string; progress?: number | null; tone: "cyan" | "coral" | "amber" | "violet" }) {
  const color = tone === "cyan" ? "#37c5d6" : tone === "coral" ? "#ff8a64" : tone === "amber" ? "#f0ad4e" : "#d783ff";
  return (
    <article className="rounded-lg border border-border bg-panel/90 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted">{label}</p>
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-muted">{subvalue}</p>
      {progress != null ? (
        <div className="mt-3 h-2 rounded-full bg-foreground/10">
          <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, progress))}%`, backgroundColor: color }} />
        </div>
      ) : null}
    </article>
  );
}

function FocusPanel({ icon: Icon, eyebrow, title, lines }: { icon: typeof Activity; eyebrow: string; title: string; lines: string[] }) {
  return (
    <section className="rounded-lg border border-border bg-panel/90 p-4 shadow-sm">
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted">
        <Icon className="h-4 w-4 text-accent" />
        {eyebrow}
      </p>
      <h2 className="mt-2 text-lg font-semibold">{title}</h2>
      <div className="mt-3 flex flex-col gap-2">
        {lines.map((line) => (
          <p className="text-sm leading-6 text-muted" key={line}>
            {line}
          </p>
        ))}
      </div>
    </section>
  );
}

function resolveConnections({
  training,
  hevyConnection,
  nutritionConnection,
  nutritionDays,
  recoveryConnection,
  recoveryDays
}: {
  training: Awaited<ReturnType<typeof getTrainingOverview>>;
  hevyConnection: Awaited<ReturnType<typeof getTrainingOverview>>["connection"];
  nutritionConnection: Awaited<ReturnType<typeof getNutritionOverview>>["connection"];
  nutritionDays: number;
  recoveryConnection: Awaited<ReturnType<typeof getRecoveryOverview>>["connection"];
  recoveryDays: number;
}) {
  return demoConnections.map((connection) => {
    if (connection.provider === "whoop" && recoveryConnection) {
      return {
        ...connection,
        status: recoveryConnection.status === "connected" ? ("connected" as const) : connection.status,
        lastSuccessfulSyncAt: recoveryConnection.lastSuccessfulSyncAt,
        safeMessage: recoveryDays ? `${recoveryDays} recovery days synced from WHOOP.` : "WHOOP connected; no recovery days synced yet."
      };
    }

    if (connection.provider === "hevy" && hevyConnection) {
      return {
        ...connection,
        status: hevyConnection.status === "connected" ? ("connected" as const) : connection.status,
        lastSuccessfulSyncAt: hevyConnection.lastSuccessfulSyncAt,
        safeMessage: training.routines.length ? `${training.routines.length} routines synced from Hevy.` : "Hevy connected; no routines synced yet."
      };
    }

    if (connection.provider === "myfitnesspal" && nutritionConnection) {
      return {
        ...connection,
        status: nutritionConnection.status === "connected" ? ("connected" as const) : connection.status,
        lastSuccessfulSyncAt: nutritionConnection.lastSuccessfulSyncAt,
        safeMessage: nutritionDays ? `${nutritionDays} nutrition days synced from MyFitnessPal.` : "MyFitnessPal connected; no diary days synced yet."
      };
    }

    return connection;
  });
}

function mergeRecoverySleep(recoveryDays: typeof demoRecovery, sleeps: Awaited<ReturnType<typeof getRecoveryOverview>>["sleeps"]) {
  return recoveryDays.map((day) => {
    const sleep = sleeps.find((item) => item.startAt?.slice(0, 10) === day.calendarDate || item.endAt?.slice(0, 10) === day.calendarDate);
    return {
      date: day.calendarDate.slice(5),
      recovery: day.recoveryScore ?? 0,
      hrv: day.hrvRmssdMs ?? 0,
      sleep: sleep?.totalSleepMinutes ? Math.round(sleep.totalSleepMinutes / 60) : 0
    };
  });
}

function formatToday() {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function formatMinutesShort(minutes: number) {
  const absolute = Math.abs(minutes);
  const hours = Math.floor(absolute / 60);
  const mins = absolute % 60;
  return hours ? `${hours}h ${mins}m` : `${mins}m`;
}

function formatDelta(value: number | null) {
  if (value == null) {
    return null;
  }
  if (value === 0) {
    return "No change vs yesterday";
  }
  return `${value > 0 ? "+" : ""}${value} vs yesterday`;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function isNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
