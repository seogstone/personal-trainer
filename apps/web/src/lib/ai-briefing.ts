import type { NutritionOverview } from "./nutrition-data";
import type { RecoveryOverview } from "./recovery-data";
import type { TrainingOverview } from "./training-data";
import { loadCoachAgentPrompt } from "./coach-agent-loader";

export type AiBriefing = {
  status: "ready" | "not_configured" | "unavailable";
  headline: string;
  summary: string;
  attentionItems: Array<{
    label: string;
    detail: string;
    severity: "low" | "medium" | "high";
  }>;
};

type BriefingInput = {
  training: TrainingOverview;
  nutrition: NutritionOverview;
  recovery: RecoveryOverview;
};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MODEL = "gpt-5.6-luna";

export async function getAiBriefing(input: BriefingInput): Promise<AiBriefing> {
  if (!process.env.OPENAI_API_KEY) {
    return fallbackBriefing("not_configured", "Add OPENAI_API_KEY to enable AI briefing.");
  }

  try {
    const agentPrompt = loadCoachAgentPrompt(["training", "nutrition", "recovery"]);
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        input: [
          {
            role: "system",
            content: `${agentPrompt}\n\nTask: Create a concise daily dashboard briefing. Be cautious and evidence-based. Use ASCII plain English only. Do not diagnose, do not claim causation, and do not invent data. Flag only practical items that deserve attention today.`
          },
          {
            role: "user",
            content: JSON.stringify(buildBriefingFacts(input))
          }
        ],
        max_output_tokens: 900,
        store: false,
        text: {
          format: {
            type: "json_schema",
            name: "fitness_briefing",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["headline", "summary", "attentionItems"],
              properties: {
                headline: { type: "string", maxLength: 90 },
                summary: { type: "string", maxLength: 520 },
                attentionItems: {
                  type: "array",
                  maxItems: 4,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["label", "detail", "severity"],
                    properties: {
                      label: { type: "string", maxLength: 48 },
                      detail: { type: "string", maxLength: 240 },
                      severity: { type: "string", enum: ["low", "medium", "high"] }
                    }
                  }
                }
              }
            }
          }
        }
      }),
      next: { revalidate: 900 }
    });

    if (!response.ok) {
      return fallbackBriefing("unavailable", "AI briefing is temporarily unavailable.");
    }

    const payload = (await response.json()) as OpenAiResponsePayload;
    const outputText = extractOutputText(payload);
    if (!outputText) {
      return fallbackBriefing("unavailable", "AI briefing returned no readable summary.");
    }

    const parsed = JSON.parse(outputText);
    return {
      status: "ready",
      headline: typeof parsed?.headline === "string" ? cleanText(parsed.headline) : "Daily briefing ready",
      summary: typeof parsed?.summary === "string" ? cleanText(parsed.summary) : "Review the metrics below before training decisions.",
      attentionItems: Array.isArray(parsed?.attentionItems)
        ? parsed.attentionItems.slice(0, 4).map((item: { label?: unknown; detail?: unknown; severity?: unknown }) => ({
            label: cleanText(typeof item.label === "string" ? item.label : "Attention"),
            detail: cleanText(typeof item.detail === "string" ? item.detail : "Review this metric before making changes."),
            severity: item.severity === "high" || item.severity === "medium" || item.severity === "low" ? item.severity : "low"
          }))
        : []
    };
  } catch {
    return fallbackBriefing("unavailable", "AI briefing is temporarily unavailable.");
  }
}

function cleanText(value: string) {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || /[.!?]$/.test(cleaned)) {
    return cleaned;
  }

  const lastSentenceEnd = Math.max(cleaned.lastIndexOf("."), cleaned.lastIndexOf("!"), cleaned.lastIndexOf("?"));
  return lastSentenceEnd > 40 ? cleaned.slice(0, lastSentenceEnd + 1) : cleaned;
}

type OpenAiResponsePayload = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

function extractOutputText(payload: OpenAiResponsePayload) {
  if (payload.output_text) {
    return payload.output_text;
  }

  return payload.output
    ?.flatMap((item) => item.content ?? [])
    .find((part) => part.type === "output_text" && typeof part.text === "string")
    ?.text;
}

function buildBriefingFacts({ training, nutrition, recovery }: BriefingInput) {
  const latestRecovery = recovery.recoveries.at(-1);
  const latestSleep = recovery.sleeps.at(-1);
  const latestNutrition = nutrition.days.at(-1);

  return {
    date: new Date().toISOString().slice(0, 10),
    dataAvailability: {
      recoveryDays: recovery.recoveries.length,
      sleepSessions: recovery.sleeps.length,
      nutritionDays: nutrition.days.length,
      nutritionMeals: nutrition.mealCount,
      hevyRoutines: training.routines.length,
      workoutsThisWeek: training.workoutsThisWeek
    },
    recovery: latestRecovery
      ? {
          date: latestRecovery.calendarDate,
          recoveryScore: latestRecovery.recoveryScore,
          hrvRmssdMs: latestRecovery.hrvRmssdMs,
          restingHeartRate: latestRecovery.restingHeartRate
        }
      : null,
    sleep: latestSleep
      ? {
          startAt: latestSleep.startAt,
          endAt: latestSleep.endAt,
          totalSleepMinutes: latestSleep.totalSleepMinutes,
          sleepNeedMinutes: latestSleep.sleepNeedMinutes,
          sleepPerformancePercent: latestSleep.sleepPerformancePercent
        }
      : null,
    nutrition: latestNutrition
      ? {
          date: latestNutrition.calendarDate,
          caloriesConsumed: latestNutrition.caloriesConsumed,
          proteinG: latestNutrition.proteinG,
          goalCalories: latestNutrition.goalCalories,
          goalProteinG: latestNutrition.goalProteinG,
          complete: latestNutrition.complete,
          latestWeightKg: nutrition.latestWeightKg
        }
      : {
          latestWeightKg: nutrition.latestWeightKg
        },
    training: {
      workoutsThisWeek: training.workoutsThisWeek,
      routineCount: training.routines.length,
      nextRoutineTitle: training.routines[0]?.title ?? null
    }
  };
}

function fallbackBriefing(status: AiBriefing["status"], summary: string): AiBriefing {
  return {
    status,
    headline: status === "not_configured" ? "AI briefing not configured" : "AI briefing unavailable",
    summary,
    attentionItems: []
  };
}
