import type { NutritionOverview } from "./nutrition-data";
import type { RecoveryOverview } from "./recovery-data";
import type { TrainingOverview } from "./training-data";
import { loadCoachAgentPrompt } from "./coach-agent-loader";
import { getDayContext } from "./day-context";

export type AiBriefing = {
  status: "ready" | "fallback" | "not_configured" | "unavailable";
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
const DEFAULT_MODEL = "gpt-5.6-luna";
const REQUEST_TIMEOUT_MS = 12_000;

export async function getAiBriefing(input: BriefingInput): Promise<AiBriefing> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      ...buildRuleBasedBriefing(input, "OpenAI is not configured yet."),
      status: "not_configured"
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const agentPrompt = loadCoachAgentPrompt(["training", "nutrition", "recovery"]);
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        input: [
          {
            role: "system",
            content: `${agentPrompt}\n\nTask: Create a concise daily dashboard briefing. Be cautious and evidence-based. Use ASCII plain English only. Do not diagnose, do not claim causation, and do not invent data. Flag only practical items that deserve attention today.\n\nTiming rules: today is an in-progress day until evening. Do not criticise an incomplete current-day food log in the morning or afternoon; frame it as \"so far\" or \"still building\" and use completed previous days or seven-day trends for adherence. Only flag current-day calories or protein as high severity when the local day is nearly over or the data clearly indicates an unusual completed entry.\n\nInjury context rules: the shoulder, knee, and ankle history is background for exercise selection and load management. Do not make it a headline or attention item unless an acute pain, swelling, instability, sudden performance loss, or relevant exercise-risk signal is supplied.`
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
      next: { revalidate: 900 },
      signal: controller.signal
    });

    if (!response.ok) {
      await logOpenAiError(response);
      return buildRuleBasedBriefing(input, "OpenAI briefing failed, so this is a local summary.");
    }

    const payload = (await response.json()) as OpenAiResponsePayload;
    const outputText = extractOutputText(payload);
    if (!outputText) {
      console.warn("OpenAI briefing returned no output text.");
      return buildRuleBasedBriefing(input, "OpenAI returned no readable summary, so this is a local summary.");
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
  } catch (error) {
    console.warn("AI briefing fallback used.", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: safeLogMessage(error instanceof Error ? error.message : "Unknown AI briefing error")
    });
    return buildRuleBasedBriefing(input, "OpenAI briefing is temporarily unavailable, so this is a local summary.");
  } finally {
    clearTimeout(timeout);
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

async function logOpenAiError(response: Response) {
  let body = "";
  try {
    body = await response.text();
  } catch {
    body = "Unable to read OpenAI error body";
  }

  console.warn("OpenAI briefing request failed.", {
    status: response.status,
    statusText: response.statusText,
    body: safeLogMessage(body)
  });
}

function buildBriefingFacts({ training, nutrition, recovery }: BriefingInput) {
  const latestRecovery = recovery.recoveries.at(-1);
  const latestSleep = recovery.sleeps.at(-1);
  const latestNutrition = nutrition.days.at(-1);
  const dayContext = getDayContext();
  const completedNutritionDays = nutrition.days.filter((day) => day.complete && day.calendarDate !== dayContext.date);
  const trackedNutritionDays = nutrition.days.filter((day) => day.calendarDate !== dayContext.date && hasLoggedNutrition(day));
  const nutritionTrendDays = completedNutritionDays.length ? completedNutritionDays : trackedNutritionDays;
  const recentNutritionTrendDays = nutritionTrendDays.slice(-7);

  return {
    date: dayContext.date,
    dayContext,
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
          isCurrentDay: latestNutrition.calendarDate === dayContext.date,
          currentDayLogExpectation: latestNutrition.calendarDate === dayContext.date ? dayContext.nutritionLogExpectation : "completed_historical_day",
          caloriesConsumed: latestNutrition.caloriesConsumed,
          proteinG: latestNutrition.proteinG,
          goalCalories: latestNutrition.goalCalories,
          goalProteinG: latestNutrition.goalProteinG,
          complete: latestNutrition.complete,
          sevenDayTrackedAverageCalories: average(recentNutritionTrendDays.map((day) => day.caloriesConsumed).filter(isNumber)),
          sevenDayTrackedAverageProteinG: average(recentNutritionTrendDays.map((day) => day.proteinG).filter(isNumber)),
          completedDaysInLookback: completedNutritionDays.length,
          trackedDaysInLookback: trackedNutritionDays.length,
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

function buildRuleBasedBriefing(input: BriefingInput, reason: string): AiBriefing {
  const facts = buildBriefingFacts(input);
  const items: AiBriefing["attentionItems"] = [];
  const currentNutritionDay =
    facts.nutrition && "isCurrentDay" in facts.nutrition && facts.nutrition.isCurrentDay ? facts.nutrition : null;
  const currentDayStillOpen =
    currentNutritionDay?.currentDayLogExpectation === "too_early" || currentNutritionDay?.currentDayLogExpectation === "in_progress";

  if (!facts.recovery || !facts.sleep) {
    items.push({
      label: "Recovery context",
      detail: "Recovery or sleep data is missing for today. Use energy, symptoms, and warm-up quality before deciding how hard to train.",
      severity: "medium"
    });
  } else if (typeof facts.recovery.recoveryScore === "number" && facts.recovery.recoveryScore < 45) {
    items.push({
      label: "Low recovery",
      detail: "Recovery is low today. Keep the planned session controlled, reduce optional volume, and avoid chasing failure sets.",
      severity: "high"
    });
  }

  const sleepDebtMinutes =
    facts.sleep?.totalSleepMinutes != null && facts.sleep.sleepNeedMinutes != null ? facts.sleep.sleepNeedMinutes - facts.sleep.totalSleepMinutes : null;
  if (sleepDebtMinutes != null && sleepDebtMinutes > 60) {
    items.push({
      label: "Sleep gap",
      detail: `Sleep is short by about ${formatHours(sleepDebtMinutes)}. Prioritise an earlier night and keep hard training decisions conservative.`,
      severity: "medium"
    });
  }

  if (facts.nutrition && "proteinG" in facts.nutrition && facts.nutrition.goalProteinG && facts.nutrition.proteinG != null && !currentDayStillOpen) {
    const proteinPercent = facts.nutrition.goalProteinG ? facts.nutrition.proteinG / facts.nutrition.goalProteinG : null;
    if (proteinPercent != null && proteinPercent < 0.75) {
      items.push({
        label: "Protein target",
        detail: `Logged protein is ${Math.round(facts.nutrition.proteinG)}g against a ${Math.round(facts.nutrition.goalProteinG)}g target. Add a high-protein meal if the log is complete.`,
        severity: "medium"
      });
    }
  }

  if (facts.training.workoutsThisWeek === 0 && facts.training.routineCount > 0) {
    items.push({
      label: "Training habit",
      detail: `${facts.training.nextRoutineTitle ?? "Your next routine"} is ready. Aim to get the first weekly session done before adding extras.`,
      severity: "low"
    });
  }

  return {
    status: "fallback",
    headline: "Local coaching summary ready",
    summary: `${reason} Data loaded: ${facts.dataAvailability.recoveryDays} recovery days, ${facts.dataAvailability.sleepSessions} sleep sessions, ${facts.dataAvailability.nutritionDays} nutrition days, and ${facts.dataAvailability.hevyRoutines} routines. Today's food log is treated as ${facts.dayContext.nutritionLogExpectation.replaceAll("_", " ")}, so nutrition judgement should lean on completed days and trends.`,
    attentionItems: items.slice(0, 4)
  };
}

function safeLogMessage(value: string) {
  return value.replace(/[^\x20-\x7E]/g, "").slice(0, 500);
}

function formatHours(minutes: number) {
  const hours = Math.floor(Math.abs(minutes) / 60);
  const mins = Math.abs(minutes) % 60;
  return hours ? `${hours}h ${mins}m` : `${mins}m`;
}

const average = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);

function isNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasLoggedNutrition(day: { caloriesConsumed?: number | null; proteinG?: number | null }) {
  return Boolean((day.caloriesConsumed != null && day.caloriesConsumed > 0) || (day.proteinG != null && day.proteinG > 0));
}
