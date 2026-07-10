import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import type { AppEnv } from "@fitness/shared";
import { createSupabaseAdmin, resolveUserId, type SupabaseAdmin } from "./supabase";

const execFileAsync = promisify(execFile);

const renphoMetricSchema = z.object({
  source: z.literal("renpho"),
  external_id: z.string(),
  measured_at: z.string(),
  weight_kg: z.number().nullable(),
  body_fat_percent: z.number().nullable(),
  lean_mass_kg: z.number().nullable(),
  metadata: z.record(z.unknown())
});

const renphoSyncSchema = z.object({
  status: z.literal("ok"),
  body_metrics: z.array(renphoMetricSchema)
});

type RenphoMetric = z.infer<typeof renphoMetricSchema>;

export async function syncRenpho(env: AppEnv, input?: { startDate?: string; endDate?: string }) {
  if (!env.RENPHO_EMAIL || !env.RENPHO_PASSWORD) {
    throw new Error("RENPHO_EMAIL and RENPHO_PASSWORD are required");
  }

  const supabase = createSupabaseAdmin(env);
  const userId = await resolveUserId(env, supabase);
  const root = findWorkspaceRoot(process.cwd());
  const executable = join(root, "services/mfp/.venv/bin/fitness-renpho");

  if (!existsSync(executable)) {
    throw new Error("RENPHO collector is not installed. Run services/mfp/.venv/bin/python -m pip install -e services/mfp");
  }

  const args = ["--email", env.RENPHO_EMAIL, "--password", env.RENPHO_PASSWORD];
  if (env.RENPHO_AREA_CODE) {
    args.push("--area-code", env.RENPHO_AREA_CODE);
  }
  if (input?.startDate) {
    args.push("--start-date", input.startDate);
  }
  if (input?.endDate) {
    args.push("--end-date", input.endDate);
  }

  const stdout = await runRenphoCollector(executable, args, root);
  const payload = renphoSyncSchema.parse(JSON.parse(stdout));

  await upsertRenphoBodyMetrics(supabase, userId, payload.body_metrics);
  await upsertRenphoConnection(supabase, userId, "connected");

  return {
    userId,
    bodyMetrics: payload.body_metrics.length,
    rangeStart: input?.startDate ?? null,
    rangeEnd: input?.endDate ?? null
  };
}

async function runRenphoCollector(executable: string, args: string[], cwd: string) {
  try {
    const { stdout } = await execFileAsync(executable, args, {
      cwd,
      maxBuffer: 1024 * 1024 * 10,
      timeout: 1000 * 60 * 5
    });
    return stdout;
  } catch (error) {
    const stdout = typeof (error as { stdout?: unknown }).stdout === "string" ? (error as { stdout: string }).stdout : "";
    const stderr = typeof (error as { stderr?: unknown }).stderr === "string" ? (error as { stderr: string }).stderr : "";

    if (stdout) {
      const payload = JSON.parse(stdout) as { status?: string; message?: string };
      if (payload.status === "authentication_failed") {
        throw new Error(`RENPHO authentication failed: ${payload.message ?? "check RENPHO_EMAIL and RENPHO_PASSWORD"}`);
      }
    }

    throw new Error(`RENPHO collector failed${stderr ? `: ${stderr}` : ""}`);
  }
}

async function upsertRenphoBodyMetrics(supabase: SupabaseAdmin, userId: string, metrics: RenphoMetric[]) {
  if (!metrics.length) {
    return;
  }

  await checked(
    supabase.from("body_metrics").upsert(
      metrics.map((metric) => ({
        user_id: userId,
        source: "renpho",
        external_id_optional: metric.external_id,
        measured_at: normalizeMeasuredAt(metric.measured_at),
        weight_kg: metric.weight_kg,
        body_fat_percent: metric.body_fat_percent,
        lean_mass_kg: metric.lean_mass_kg,
        notes: JSON.stringify(metric.metadata),
        updated_at: new Date().toISOString()
      })),
      { onConflict: "user_id,source,measured_at" }
    ),
    "upsert RENPHO body metrics"
  );
}

async function upsertRenphoConnection(supabase: SupabaseAdmin, userId: string, status: "connected" | "degraded") {
  await checked(
    supabase.from("integration_connections").upsert(
      {
        user_id: userId,
        provider: "renpho",
        status,
        last_attempted_sync_at: new Date().toISOString(),
        last_successful_sync_at: status === "connected" ? new Date().toISOString() : null,
        reauthentication_required: status !== "connected"
      },
      { onConflict: "user_id,provider" }
    ),
    "upsert RENPHO connection"
  );
}

function normalizeMeasuredAt(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
}

async function checked<T extends { error: null | { message: string } }>(result: PromiseLike<T>, action: string) {
  const { error } = await result;
  if (error) {
    throw new Error(`Failed to ${action}: ${error.message}`);
  }
}

function findWorkspaceRoot(start: string) {
  let current = start;

  while (current !== dirname(current)) {
    if (existsSync(join(current, "pnpm-workspace.yaml"))) {
      return current;
    }

    current = dirname(current);
  }

  return start;
}
