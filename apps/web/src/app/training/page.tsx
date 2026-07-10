import { Shell } from "@/components/shell";
import { getTrainingOverview } from "@/lib/training-data";

export const dynamic = "force-dynamic";

export default async function TrainingPage() {
  const training = await getTrainingOverview();

  return (
    <Shell active="training">
      <div className="flex flex-col gap-4">
        <section className="rounded-md border border-border bg-panel p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Training</h1>
              <p className="mt-2 text-muted">
                Hevy status: {training.connection?.status ?? "not configured"}
                {training.connection?.lastSuccessfulSyncAt
                  ? ` · synced ${new Date(training.connection.lastSuccessfulSyncAt).toLocaleString("en-GB")}`
                  : ""}
              </p>
            </div>
            <div className="rounded-md border border-border px-3 py-2 text-sm text-muted">
              {training.workoutsThisWeek}/3 workouts this week
            </div>
          </div>
        </section>

        <section className="rounded-md border border-border bg-panel p-5">
          <h2 className="text-lg font-semibold">Hevy routines</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {training.routines.map((routine) => (
              <article className="rounded-md border border-border p-4" key={routine.id}>
                <h3 className="font-semibold">{routine.title}</h3>
                <p className="mt-2 text-sm text-muted">
                  {routine.exerciseCount} planned exercises
                  {routine.folderExternalId ? ` · folder ${routine.folderExternalId}` : ""}
                </p>
              </article>
            ))}
            {!training.routines.length ? <p className="text-sm text-muted">No Hevy routines synced yet.</p> : null}
          </div>
        </section>

        <section className="rounded-md border border-border bg-panel p-5">
          <h2 className="text-lg font-semibold">Recent workouts</h2>
          <div className="mt-4 grid gap-3">
            {training.recentWorkouts.map((workout) => (
              <article className="rounded-md border border-border p-4" key={workout.id}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold">{workout.title}</h3>
                  <span className="text-sm text-muted">{new Date(workout.startAt).toLocaleDateString("en-GB")}</span>
                </div>
                <p className="mt-2 text-sm text-muted">
                  {workout.exerciseCount ?? 0} exercises, {workout.setCount ?? 0} sets, {(workout.totalVolumeKg ?? 0).toLocaleString()} kg volume
                </p>
              </article>
            ))}
            {!training.recentWorkouts.length ? (
              <p className="rounded-md border border-border p-4 text-sm text-muted">
                Hevy returned zero completed workouts. Once you log a session in Hevy and rerun sync, it will appear here.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </Shell>
  );
}
