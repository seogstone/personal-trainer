import { envSchema } from "@fitness/shared";
import { loadLocalEnv } from "./env";
import { createProviders } from "./providers";
import { syncHevy } from "./sync/hevy";
import { syncMyFitnessPal } from "./sync/mfp";
import { syncRenpho } from "./sync/renpho";
import { syncWhoop } from "./sync/whoop";

loadLocalEnv();

const env = envSchema.safeParse(process.env);

if (!env.success) {
  console.error(JSON.stringify({ level: "error", event: "invalid_environment", issues: env.error.flatten().fieldErrors }));
  process.exit(1);
}

const appEnv = env.data;
const providers = createProviders(appEnv);

async function main() {
  const command = process.argv.slice(2).find((arg) => arg !== "--");

  if (command === "hevy:sync") {
    const summary = await syncHevy(appEnv);
    console.log(JSON.stringify({ level: "info", event: "hevy_sync_complete", summary }));
    return;
  }

  if (command === "mfp:sync") {
    const args = process.argv.slice(2).filter((arg) => arg !== "--" && arg !== command);
    const syncInput = {
      ...(args[0] ? { startDate: args[0] } : {}),
      ...(args[1] ? { endDate: args[1] } : {})
    };
    const summary = await syncMyFitnessPal(appEnv, syncInput);
    console.log(JSON.stringify({ level: "info", event: "mfp_sync_complete", summary }));
    return;
  }

  if (command === "renpho:sync") {
    const args = process.argv.slice(2).filter((arg) => arg !== "--" && arg !== command);
    const syncInput = {
      ...(args[0] ? { startDate: args[0] } : {}),
      ...(args[1] ? { endDate: args[1] } : {})
    };
    const summary = await syncRenpho(appEnv, syncInput);
    console.log(JSON.stringify({ level: "info", event: "renpho_sync_complete", summary }));
    return;
  }

  if (command === "whoop:sync") {
    const args = process.argv.slice(2).filter((arg) => arg !== "--" && arg !== command);
    const syncInput = {
      ...(args[0] ? { startDate: args[0] } : {}),
      ...(args[1] ? { endDate: args[1] } : {})
    };
    const summary = await syncWhoop(appEnv, syncInput);
    console.log(JSON.stringify({ level: "info", event: "whoop_sync_complete", summary }));
    return;
  }

  const statuses = await Promise.all([
    providers.recovery.getConnectionStatus(),
    providers.training.getConnectionStatus(),
    providers.nutrition.getConnectionStatus()
  ]);

  console.log(JSON.stringify({ level: "info", event: "worker_ready", providers: statuses.map(({ provider, status }) => ({ provider, status })) }));
}

void main().catch((error: unknown) => {
  console.error(JSON.stringify({ level: "error", event: "worker_failed", message: error instanceof Error ? error.message : "unknown" }));
  process.exit(1);
});
