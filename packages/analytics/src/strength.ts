export function estimateOneRepMaxEpley(weightKg: number | null, reps: number | null): number | null {
  if (!weightKg || !reps || reps <= 0) {
    return null;
  }

  return Number((weightKg * (1 + reps / 30)).toFixed(1));
}

export function calculateExternalLoadVolumeKg(sets: Array<{ weightKg: number | null; reps: number | null }>): number {
  return sets.reduce((sum, set) => {
    if (!set.weightKg || !set.reps) {
      return sum;
    }
    return sum + set.weightKg * set.reps;
  }, 0);
}
