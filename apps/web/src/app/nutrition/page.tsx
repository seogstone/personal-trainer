import { calculateNutritionAdherence } from "@fitness/analytics";
import { demoNutrition } from "@fitness/shared";
import { Shell } from "@/components/shell";
import { TrendChart } from "@/components/trend-chart";

export default function NutritionPage() {
  const adherence = calculateNutritionAdherence(demoNutrition);
  return (
    <Shell active="nutrition">
      <div className="flex flex-col gap-4">
        <section className="rounded-md border border-border bg-panel p-5">
          <h1 className="text-2xl font-semibold">Nutrition</h1>
          <p className="mt-2 text-muted">
            Seven-day averages: {Math.round(adherence.sevenDayAverageCalories ?? 0)} calories and {Math.round(adherence.sevenDayAverageProteinG ?? 0)}g protein.
          </p>
        </section>
        <TrendChart
          title="Target adherence"
          data={demoNutrition.map((day) => ({ date: day.calendarDate.slice(5), calories: day.caloriesConsumed ?? 0, protein: day.proteinG ?? 0 }))}
          lines={[
            { dataKey: "calories", name: "Calories", color: "#ef4444" },
            { dataKey: "protein", name: "Protein", color: "#d97706" }
          ]}
        />
      </div>
    </Shell>
  );
}
