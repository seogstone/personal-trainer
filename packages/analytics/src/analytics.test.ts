import { describe, expect, it } from "vitest";
import { calculateNutritionAdherence } from "./nutrition";
import { calculateReadiness } from "./readiness";
import { estimateOneRepMaxEpley } from "./strength";
import { recommendTraining } from "./training";

describe("calculateReadiness", () => {
  it("weights available inputs proportionally", () => {
    const result = calculateReadiness({
      whoopRecoveryScore: 80,
      sleepMinutes: 420,
      sleepNeedMinutes: 480,
      hrvRmssdMs: 70,
      hrvBaselineRmssdMs: 65
    });

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.score).toBeGreaterThan(80);
    }
  });

  it("reports insufficient data instead of inventing a score", () => {
    const result = calculateReadiness({ whoopRecoveryScore: 80 });
    expect(result.status).toBe("insufficient_data");
  });
});

describe("recommendTraining", () => {
  it("keeps injury guidance conservative", () => {
    expect(recommendTraining({ readinessScore: 90, workoutsCompletedThisWeek: 0, weeklyWorkoutTarget: 3, acuteInjuryFlag: true })).toContain("Check pain");
  });
});

describe("calculateNutritionAdherence", () => {
  it("does not treat incomplete diaries as fully reliable", () => {
    const result = calculateNutritionAdherence([
      {
        userId: "u",
        source: "myfitnesspal",
        calendarDate: "2026-07-10",
        caloriesConsumed: 1000,
        proteinG: 50,
        carbohydrateG: 100,
        fatG: 30,
        goalCalories: 2400,
        goalProteinG: 180,
        complete: false
      }
    ]);
    expect(result.incompleteDiaryWarning).toBe(true);
    expect(result.loggedDayCompleteness).toBe(0);
  });

  it("does not count an in-progress current day as a failed completed log", () => {
    const result = calculateNutritionAdherence(
      [
        {
          userId: "u",
          source: "myfitnesspal",
          calendarDate: "2026-07-22",
          caloriesConsumed: 2300,
          proteinG: 180,
          carbohydrateG: 220,
          fatG: 80,
          goalCalories: 2400,
          goalProteinG: 180,
          complete: true
        },
        {
          userId: "u",
          source: "myfitnesspal",
          calendarDate: "2026-07-23",
          caloriesConsumed: 450,
          proteinG: 30,
          carbohydrateG: 50,
          fatG: 12,
          goalCalories: 2400,
          goalProteinG: 180,
          complete: false
        }
      ],
      { currentDate: "2026-07-23" }
    );

    expect(result.incompleteDiaryWarning).toBe(false);
    expect(result.loggedDayCompleteness).toBe(1);
  });
});

describe("estimateOneRepMaxEpley", () => {
  it("calculates one rep max", () => {
    expect(estimateOneRepMaxEpley(100, 5)).toBe(116.7);
  });
});
