import { demoWorkouts } from "@fitness/shared";
import { Shell } from "@/components/shell";

export default function TrainingPage() {
  return (
    <Shell active="training">
      <section className="rounded-md border border-border bg-panel p-5">
        <h1 className="text-2xl font-semibold">Training</h1>
        <div className="mt-5 grid gap-3">
          {demoWorkouts.map((workout) => (
            <article className="rounded-md border border-border p-4" key={workout.externalId}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold">{workout.title}</h2>
                <span className="text-sm text-muted">{new Date(workout.startAt).toLocaleDateString("en-GB")}</span>
              </div>
              <p className="mt-2 text-sm text-muted">
                {workout.exerciseCount} exercises, {workout.setCount} sets, {workout.totalVolumeKg.toLocaleString()} kg volume
              </p>
            </article>
          ))}
        </div>
      </section>
    </Shell>
  );
}
