import { demoRecovery } from "@fitness/shared";
import { Shell } from "@/components/shell";
import { TrendChart } from "@/components/trend-chart";

export default function RecoveryPage() {
  return (
    <Shell active="recovery">
      <TrendChart
        title="Recovery trend"
        data={demoRecovery.map((day) => ({ date: day.calendarDate.slice(5), recovery: day.recoveryScore ?? 0, hrv: day.hrvRmssdMs ?? 0, rhr: day.restingHeartRate ?? 0 }))}
        lines={[
          { dataKey: "recovery", name: "Recovery", color: "#0f9f83" },
          { dataKey: "hrv", name: "HRV", color: "#3b82f6" },
          { dataKey: "rhr", name: "RHR", color: "#ef4444" }
        ]}
      />
    </Shell>
  );
}
