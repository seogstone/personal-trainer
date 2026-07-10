import type { LucideIcon } from "lucide-react";

const tones = {
  green: "text-emerald-700 bg-emerald-50 border-emerald-200",
  blue: "text-blue-700 bg-blue-50 border-blue-200",
  amber: "text-amber-800 bg-amber-50 border-amber-200",
  red: "text-rose-700 bg-rose-50 border-rose-200"
};

export function MetricCard({ icon: Icon, label, value, helper, tone }: { icon: LucideIcon; label: string; value: string; helper: string; tone: keyof typeof tones }) {
  return (
    <article className="rounded-md border border-border bg-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted">{label}</p>
        <span className={`rounded-md border p-2 ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-4 text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-muted">{helper}</p>
    </article>
  );
}
