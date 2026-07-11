import { runDailySync } from "@/lib/daily-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const originResult = authorizeSameOrigin(request);
  if (!originResult.ok) {
    return Response.json({ ok: false, error: originResult.error }, { status: originResult.status });
  }

  return Response.json(await runDailySync("manual_dashboard"));
}

function authorizeSameOrigin(request: Request): { ok: true } | { ok: false; status: number; error: string } {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin || !host) {
    return { ok: false, status: 403, error: "Manual sync must be started from the dashboard" };
  }

  try {
    if (new URL(origin).host !== host) {
      return { ok: false, status: 403, error: "Manual sync origin mismatch" };
    }
  } catch {
    return { ok: false, status: 403, error: "Invalid manual sync origin" };
  }

  return { ok: true };
}
