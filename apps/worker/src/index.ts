import { envSchema } from "@fitness/shared";
import { createProviders } from "./providers";

const env = envSchema.safeParse(process.env);

if (!env.success) {
  console.error(JSON.stringify({ level: "error", event: "invalid_environment", issues: env.error.flatten().fieldErrors }));
  process.exit(1);
}

const providers = createProviders(env.data);

async function main() {
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
