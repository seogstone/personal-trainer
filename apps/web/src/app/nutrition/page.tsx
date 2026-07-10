import { calculateNutritionAdherence } from "@fitness/analytics";
import { Shell } from "@/components/shell";
import { TrendChart } from "@/components/trend-chart";
import { getNutritionOverview } from "@/lib/nutrition-data";

export const dynamic = "force-dynamic";

export default async function NutritionPage() {
  const overview = await getNutritionOverview();
  const adherence = calculateNutritionAdherence(overview.days);

  return (
    <Shell active="nutrition">
      <div className="flex flex-col gap-4">
        <section className="rounded-md border border-border bg-panel p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Nutrition</h1>
              <p className="mt-2 text-muted">
                MyFitnessPal status: {overview.connection?.status ?? "not configured"}
                {overview.connection?.lastSuccessfulSyncAt
                  ? ` · synced ${new Date(overview.connection.lastSuccessfulSyncAt).toLocaleString("en-GB")}`
                  : ""}
              </p>
            </div>
            <div className="rounded-md border border-border px-3 py-2 text-sm text-muted">
              {overview.days.length} diary days · {overview.mealCount} meals
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-border bg-panel p-4">
            <p className="text-sm text-muted">Seven-day calories</p>
            <p className="mt-2 text-2xl font-semibold">{Math.round(adherence.sevenDayAverageCalories ?? 0)}</p>
          </div>
          <div className="rounded-md border border-border bg-panel p-4">
            <p className="text-sm text-muted">Seven-day protein</p>
            <p className="mt-2 text-2xl font-semibold">{Math.round(adherence.sevenDayAverageProteinG ?? 0)}g</p>
          </div>
          <div className="rounded-md border border-border bg-panel p-4">
            <p className="text-sm text-muted">Latest weight</p>
            <p className="mt-2 text-2xl font-semibold">{overview.latestWeightKg ? `${overview.latestWeightKg}kg` : "N/A"}</p>
          </div>
        </section>

        {overview.days.length ? (
          <TrendChart
            title="Calories and protein"
            data={overview.days.map((day) => ({
              date: day.calendarDate.slice(5),
              calories: day.caloriesConsumed ?? 0,
              protein: day.proteinG ?? 0
            }))}
            lines={[
              { dataKey: "calories", name: "Calories", color: "#ef4444" },
              { dataKey: "protein", name: "Protein", color: "#d97706" }
            ]}
          />
        ) : (
          <section className="rounded-md border border-border bg-panel p-5">
            <h2 className="text-lg font-semibold">No nutrition days synced yet</h2>
            <p className="mt-2 text-sm text-muted">
              Run the MyFitnessPal sync after applying the nutrition detail migration. Empty diary days will still sync with targets.
            </p>
          </section>
        )}

        {adherence.incompleteDiaryWarning ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Some synced diary days are incomplete. Avoid treating low calories as intentional under-eating.
          </p>
        ) : null}
      </div>
    </Shell>
  );
}
