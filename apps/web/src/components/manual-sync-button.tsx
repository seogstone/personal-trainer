"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, RefreshCcw, XCircle } from "lucide-react";

type DailySyncResponse = {
  ok: boolean;
  results: Array<{
    provider: string;
    status: "success" | "failed" | "skipped";
  }>;
};

type SyncState = {
  status: "idle" | "pending" | "success" | "failed";
  message?: string;
};

export function ManualSyncButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [syncState, setSyncState] = useState<SyncState>({ status: "idle" });
  const busy = isPending || syncState.status === "pending";

  const statusIcon = useMemo(() => {
    if (busy) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }
    if (syncState.status === "success") {
      return <CheckCircle2 className="h-4 w-4" />;
    }
    if (syncState.status === "failed") {
      return <XCircle className="h-4 w-4" />;
    }
    return <RefreshCcw className="h-4 w-4" />;
  }, [busy, syncState.status]);

  async function handleRefresh() {
    setSyncState({ status: "pending", message: "Refreshing all sources..." });

    try {
      const response = await fetch("/api/sync/refresh", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        }
      });
      const payload = (await response.json()) as DailySyncResponse | { error?: string };

      if (!response.ok || !("results" in payload)) {
        throw new Error("error" in payload && payload.error ? payload.error : "Refresh failed");
      }

      const successful = payload.results.filter((result) => result.status === "success").length;
      const failed = payload.results.filter((result) => result.status === "failed").length;

      setSyncState({
        status: payload.ok ? "success" : "failed",
        message: failed ? `${successful} refreshed, ${failed} need attention` : `${successful} sources refreshed`
      });

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setSyncState({
        status: "failed",
        message: error instanceof Error ? error.message : "Refresh failed"
      });
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <button
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-accent/60 bg-accent px-3 text-sm font-semibold text-background transition hover:bg-accent/90 disabled:cursor-wait disabled:opacity-70"
        disabled={busy}
        onClick={handleRefresh}
        type="button"
      >
        {statusIcon}
        {busy ? "Refreshing..." : "Refresh all data"}
      </button>
      {syncState.message ? <p className={`text-xs ${syncState.status === "failed" ? "text-[#ff8a64]" : "text-muted"}`}>{syncState.message}</p> : null}
    </div>
  );
}
