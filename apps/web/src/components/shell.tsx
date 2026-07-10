import Link from "next/link";
import { Activity, BarChart3, Dumbbell, LineChart, Settings, Utensils } from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Dashboard", key: "dashboard", icon: Activity },
  { href: "/training", label: "Training", key: "training", icon: Dumbbell },
  { href: "/nutrition", label: "Nutrition", key: "nutrition", icon: Utensils },
  { href: "/recovery", label: "Recovery", key: "recovery", icon: BarChart3 },
  { href: "/progress", label: "Progress", key: "progress", icon: LineChart },
  { href: "/settings/integrations", label: "Settings", key: "settings", icon: Settings }
] as const;

export function Shell({ active, children }: { active: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen pb-20 lg:pb-0">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-3 py-3 sm:px-4 md:px-6 lg:flex-row lg:gap-6 lg:py-6">
        <aside className="lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:w-56">
          <div className="mb-3 hidden px-2 lg:block">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted">Private beta</p>
            <p className="mt-2 text-lg font-semibold">Command Center</p>
          </div>
          <nav className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-6 gap-1 rounded-lg border border-border bg-panel/95 p-1 shadow-2xl backdrop-blur lg:static lg:flex lg:flex-col lg:gap-2 lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
            {nav.map((item) => {
              const Icon = item.icon;
              const selected = active === item.key;
              return (
                <Link
                  className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-md px-2 text-[10px] font-medium sm:text-xs lg:min-h-10 lg:flex-row lg:justify-start lg:gap-2 lg:px-3 lg:text-sm ${selected ? "bg-foreground text-background" : "text-muted hover:bg-panel hover:text-foreground"}`}
                  href={item.href}
                  key={item.href}
                >
                  <Icon className="h-4 w-4" />
                  <span className="max-w-full truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </main>
  );
}
