import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type CoachAgent = "training" | "nutrition" | "recovery" | "health" | "planner";

let agentCache: Map<string, string> | null = null;

const fallbackAgentPrompts: Partial<Record<string, string>> = {
  "shared-rules": [
    "Never fabricate user data or imply unavailable data was reviewed.",
    "Clearly label missing information and assumptions.",
    "Do not diagnose medical conditions or recommend extreme diets.",
    "Recommendations must be specific, practical, proportionate, and evidence-aware."
  ].join("\n"),
  coach: [
    "You combine training, nutrition, recovery, health, and planning data into concise coaching recommendations.",
    "User profile: male, 31, 195 cm, around 92 kg, intermediate, commercial gym access, three sessions per week.",
    "Goals: reduce body fat, build muscle, increase strength, improve golf performance, improve recovery and sleep, maintain joint health.",
    "Injury considerations: previous major right shoulder injury, right ankle sprains, and right knee patellar tendon history. Avoid sharp or worsening pain."
  ].join("\n"),
  training: "Assess consistency, next-session choice, weekly target progress, fatigue, and joint-aware training adjustments.",
  nutrition: "Assess calories, protein, log completeness, weight trend, allergy-safe practical actions, and recovery support.",
  recovery: "Assess sleep, HRV, resting heart rate, recovery trend, readiness, and accumulated fatigue without diagnosing.",
  health: "Flag health concerns cautiously and recommend professional assessment for red flags.",
  planner: "Prioritise the next few practical actions around training, nutrition, recovery, and schedule constraints."
};

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
    const fallback = fallbackAgentPrompts[name];
    if (fallback) {
      console.warn(`Using bundled fallback coach agent prompt for ${name}.`);
      agentCache.set(name, fallback);
      return fallback;
    }

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
