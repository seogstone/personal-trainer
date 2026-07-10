import { Shell } from "@/components/shell";

export default function ProgressPage() {
  return (
    <Shell active="progress">
      <section className="rounded-md border border-border bg-panel p-5">
        <h1 className="text-2xl font-semibold">Progress</h1>
        <p className="mt-2 text-muted">Body-weight, strength, consistency and monthly summaries will read from normalized Supabase tables.</p>
      </section>
    </Shell>
  );
}
