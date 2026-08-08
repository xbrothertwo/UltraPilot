export type DuplicateCandidate = {
  id: string;
  activityDate: string;
  movingTimeSeconds: number;
  distanceMeters: number;
};

export type IncomingActivity = {
  startTime: string;
  movingTimeSeconds: number;
  distanceMeters: number;
};

const START_TIME_TOLERANCE_MS = 3 * 60 * 1000;

function withinTolerance(actual: number, incoming: number, relativeTolerance: number, absoluteTolerance: number): boolean {
  return Math.abs(actual - incoming) <= Math.max(absoluteTolerance, incoming * relativeTolerance);
}

export function findDuplicateActivity(candidates: DuplicateCandidate[], incoming: IncomingActivity): DuplicateCandidate | null {
  const incomingStart = new Date(incoming.startTime).getTime();
  return candidates.find((candidate) => {
    const candidateStart = new Date(candidate.activityDate).getTime();
    if (Math.abs(candidateStart - incomingStart) > START_TIME_TOLERANCE_MS) return false;
    if (!withinTolerance(candidate.movingTimeSeconds, incoming.movingTimeSeconds, 0.05, 30)) return false;
    if (!withinTolerance(candidate.distanceMeters, incoming.distanceMeters, 0.03, 150)) return false;
    return true;
  }) ?? null;
}
