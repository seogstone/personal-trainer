import type { LucideIcon } from "lucide-react";

const tones = {
  green: "text-[#43d6c9] bg-[#123b39] border-[#2a7771]",
  blue: "text-[#7cc7ff] bg-[#172f43] border-[#315d7b]",
  amber: "text-[#f0ad4e] bg-[#3d2b12] border-[#7b5620]",
  red: "text-[#ff8a64] bg-[#3e2018] border-[#84412e]"
};

export function MetricCard({ icon: Icon, label, value, helper, tone }: { icon: LucideIcon; label: string; value: string; helper: string; tone: keyof typeof tones }) {
  return (
    <article className="rounded-md border border-border bg-panel/90 p-4 shadow-sm">
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
