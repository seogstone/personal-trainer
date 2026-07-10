export const readinessAlgorithmVersion = "readiness-v1";

export type ReadinessInput = {
  whoopRecoveryScore?: number | null;
  sleepMinutes?: number | null;
  sleepNeedMinutes?: number | null;
  hrvRmssdMs?: number | null;
  hrvBaselineRmssdMs?: number | null;
  restingHeartRate?: number | null;
  restingHeartRateBaseline?: number | null;
  recentTrainingLoadScore?: number | null;
};

export type ReadinessResult =
  | {
      status: "ready";
      score: number;
      algorithmVersion: typeof readinessAlgorithmVersion;
      contributors: Record<string, number>;
    }
  | {
      status: "insufficient_data";
      algorithmVersion: typeof readinessAlgorithmVersion;
      missing: string[];
    };

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export function calculateReadiness(input: ReadinessInput): ReadinessResult {
  const contributors: Array<[string, number, number | null | undefined]> = [
    ["whoopRecovery", 0.45, input.whoopRecoveryScore],
    [
      "sleep",
      0.2,
      input.sleepMinutes && input.sleepNeedMinutes ? clamp((input.sleepMinutes / input.sleepNeedMinutes) * 100) : null
    ],
    [
      "hrv",
      0.15,
      input.hrvRmssdMs && input.hrvBaselineRmssdMs ? clamp((input.hrvRmssdMs / input.hrvBaselineRmssdMs) * 100) : null
    ],
    [
      "restingHeartRate",
      0.1,
      input.restingHeartRate && input.restingHeartRateBaseline
        ? clamp((input.restingHeartRateBaseline / input.restingHeartRate) * 100)
        : null
    ],
    ["trainingLoad", 0.1, input.recentTrainingLoadScore == null ? null : clamp(100 - input.recentTrainingLoadScore)]
  ];

  const available = contributors.filter(([, , value]) => value != null);
  if (available.length < 2) {
    return {
      status: "insufficient_data",
      algorithmVersion: readinessAlgorithmVersion,
      missing: contributors.filter(([, , value]) => value == null).map(([name]) => name)
    };
  }

  const weightTotal = available.reduce((sum, [, weight]) => sum + weight, 0);
  const weighted = available.reduce<Record<string, number>>((acc, [name, weight, value]) => {
    acc[name] = Math.round(((value ?? 0) * weight) / weightTotal);
    return acc;
  }, {});

  return {
    status: "ready",
    score: clamp(Object.values(weighted).reduce((sum, value) => sum + value, 0)),
    algorithmVersion: readinessAlgorithmVersion,
    contributors: weighted
  };
}
