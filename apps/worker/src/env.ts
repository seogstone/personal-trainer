import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

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

function loadEnvFile(path: string) {
  if (!existsSync(path)) {
    return;
  }

  const lines = readFileSync(path, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator);
    const value = trimmed.slice(separator + 1);
    process.env[key] = value;
  }
}

export function loadLocalEnv() {
  const root = findWorkspaceRoot(process.cwd());
  loadEnvFile(join(root, ".env"));
  loadEnvFile(join(root, ".env.local"));
}
