export type TrainingRecommendationInput = {
  readinessScore: number | null;
  workoutsCompletedThisWeek: number;
  weeklyWorkoutTarget: number;
  nextRoutineTitle?: string | null;
  sleptUnderSixHours?: boolean;
  acuteInjuryFlag?: boolean;
};

export function recommendTraining(input: TrainingRecommendationInput): string {
  if (input.acuteInjuryFlag) {
    return "Check pain and injury status first. Keep today conservative and follow clinician or physio guidance.";
  }

  if (input.readinessScore == null) {
    return "Readiness data is incomplete. Use an easy session or mobility work unless you feel clearly recovered.";
  }

  const routine = input.nextRoutineTitle ?? "the next planned routine";
  const needsWorkout = input.workoutsCompletedThisWeek < input.weeklyWorkoutTarget;

  if (input.readinessScore >= 70 && needsWorkout && !input.sleptUnderSixHours) {
    return `Recovery looks good. Complete ${routine} today and keep the session around RPE 7, with clean reps and no forced progression.`;
  }

  if (input.readinessScore >= 50) {
    return `Train controlled and trim optional volume by about 10-20%. ${needsWorkout ? `Use ${routine} as the base.` : "You are on track for the week."}`;
  }

  return "Prioritize recovery, walking or mobility today. Resume heavier training when readiness improves.";
}
