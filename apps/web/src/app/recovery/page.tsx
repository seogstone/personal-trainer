import { Shell } from "@/components/shell";
import { TrendChart } from "@/components/trend-chart";
import { getRecoveryOverview } from "@/lib/recovery-data";

export const dynamic = "force-dynamic";

export default async function RecoveryPage() {
  const overview = await getRecoveryOverview();

  return (
    <Shell active="recovery">
      <div className="flex flex-col gap-4">
        <section className="rounded-md border border-border bg-panel p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Recovery</h1>
              <p className="mt-2 text-muted">
                WHOOP status: {overview.connection?.status ?? "not configured"}
                {overview.connection?.lastSuccessfulSyncAt
                  ? ` · synced ${new Date(overview.connection.lastSuccessfulSyncAt).toLocaleString("en-GB")}`
                  : ""}
              </p>
            </div>
            <div className="rounded-md border border-border px-3 py-2 text-sm text-muted">
              {overview.recoveries.length} recovery days · {overview.sleeps.length} sleep sessions
            </div>
          </div>
        </section>

        {overview.recoveries.length ? (
          <TrendChart
            title="Recovery trend"
            data={overview.recoveries.map((day) => ({
              date: day.calendarDate.slice(5),
              recovery: day.recoveryScore ?? 0,
              hrv: day.hrvRmssdMs ?? 0,
              rhr: day.restingHeartRate ?? 0
            }))}
            lines={[
              { dataKey: "recovery", name: "Recovery", color: "#0f9f83" },
              { dataKey: "hrv", name: "HRV", color: "#3b82f6" },
              { dataKey: "rhr", name: "RHR", color: "#ef4444" }
            ]}
          />
        ) : (
          <section className="rounded-md border border-border bg-panel p-5">
            <h2 className="text-lg font-semibold">No WHOOP recovery synced yet</h2>
            <p className="mt-2 text-sm text-muted">Run the WHOOP sync after applying the sleep sessions migration.</p>
          </section>
        )}
      </div>
    </Shell>
  );
}
