export type DayPhase = "early" | "midday" | "afternoon" | "evening" | "late";

export type DayContext = {
  date: string;
  hour: number;
  phase: DayPhase;
  timezone: string;
  nutritionLogExpectation: "too_early" | "in_progress" | "should_be_nearly_complete";
};

const APP_TIMEZONE = "Europe/London";

export function getDayContext(date = new Date()): DayContext {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") {
        acc[part.type] = part.value;
      }
      return acc;
    }, {});

  const hour = Number(parts.hour ?? 0);
  const phase: DayPhase = hour < 10 ? "early" : hour < 13 ? "midday" : hour < 18 ? "afternoon" : hour < 22 ? "evening" : "late";

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour,
    phase,
    timezone: APP_TIMEZONE,
    nutritionLogExpectation: hour < 11 ? "too_early" : hour < 20 ? "in_progress" : "should_be_nearly_complete"
  };
}
