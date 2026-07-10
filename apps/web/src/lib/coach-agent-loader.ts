import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type CoachAgent = "training" | "nutrition" | "recovery" | "health" | "planner";

let agentCache: Map<string, string> | null = null;

export function loadCoachAgentPrompt(agents: CoachAgent[]) {
  const files = ["shared-rules", "coach", ...agents];
  const uniqueFiles = [...new Set(files)];

  return uniqueFiles
    .map((name) => {
      const content = loadAgentFile(name);
      return `--- ${name}.md ---\n${content}`;
    })
    .join("\n\n");
}

function loadAgentFile(name: string) {
  if (!agentCache) {
    agentCache = new Map();
  }

  const cached = agentCache.get(name);
  if (cached) {
    return cached;
  }

  const path = join(findWorkspaceRoot(process.cwd()), "agents", `${name}.md`);
  if (!existsSync(path)) {
    throw new Error(`Missing coach agent prompt: ${path}`);
  }

  const content = readFileSync(path, "utf8");
  agentCache.set(name, content);
  return content;
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
