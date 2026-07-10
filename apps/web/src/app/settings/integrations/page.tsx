import { AlertTriangle } from "lucide-react";
import { demoConnections } from "@fitness/shared";
import { Shell } from "@/components/shell";

export default function IntegrationsPage() {
  return (
    <Shell active="settings">
      <div className="flex flex-col gap-4">
        <section className="rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-950">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p className="text-sm">
              WHOOP sync uses an experimental private API adapter through Totem. Tokens must stay server-side and this adapter is designed to be replaceable.
            </p>
          </div>
        </section>
        <section className="rounded-md border border-border bg-panel p-5">
          <h1 className="text-2xl font-semibold">Integrations</h1>
          <div className="mt-5 grid gap-3">
            {demoConnections.map((connection) => (
              <article className="rounded-md border border-border p-4" key={connection.provider}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-semibold capitalize">{connection.provider}</h2>
                    <p className="text-sm text-muted">{connection.safeMessage ?? "Connection metadata only. Secrets remain outside browser code."}</p>
                  </div>
                  <button className="min-h-10 rounded-md border border-border px-3 text-sm font-medium" type="button">
                    Sync now
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </Shell>
  );
}
