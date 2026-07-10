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
    <main className="min-h-screen">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-4 md:px-6 lg:flex-row lg:py-6">
        <aside className="lg:w-56">
          <nav className="flex gap-2 overflow-x-auto lg:flex-col">
            {nav.map((item) => {
              const Icon = item.icon;
              const selected = active === item.key;
              return (
                <Link
                  className={`flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-medium ${selected ? "bg-foreground text-background" : "text-muted hover:bg-panel hover:text-foreground"}`}
                  href={item.href}
                  key={item.href}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
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
