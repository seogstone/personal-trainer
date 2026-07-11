import { runDailySync } from "@/lib/daily-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const authResult = authorizeCron(request);
  if (!authResult.ok) {
    return Response.json({ ok: false, error: authResult.error }, { status: authResult.status });
  }

  return Response.json(await runDailySync("daily_cron"));
}

function authorizeCron(request: Request): { ok: true } | { ok: false; status: number; error: string } {
  const allowedSecrets = [process.env.CRON_SECRET, process.env.INTERNAL_WORKER_SECRET].filter(Boolean);
  if (!allowedSecrets.length) {
    return { ok: false, status: 500, error: "No cron authorization secret is configured" };
  }

  const authorization = request.headers.get("authorization");
  if (!allowedSecrets.some((secret) => authorization === `Bearer ${secret}`)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  return { ok: true };
}
