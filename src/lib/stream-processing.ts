import type { SensorSample } from "@/lib/activity-files/types";

export function downsampleMinMax(samples: SensorSample[], maxPoints = 800): SensorSample[] {
  if (maxPoints < 4) throw new Error("maxPoints muss mindestens 4 sein.");
  if (samples.length <= maxPoints) return [...samples];
  const first = samples[0];
  const last = samples.at(-1)!;
  const interior = samples.slice(1, -1);
  const bucketCount = Math.floor((maxPoints - 2) / 2);
  const result: SensorSample[] = [first];
  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    const start = Math.floor(bucket * interior.length / bucketCount);
    const end = Math.floor((bucket + 1) * interior.length / bucketCount);
    const values = interior.slice(start, end);
    if (!values.length) continue;
    let minimumIndex = 0;
    let maximumIndex = 0;
    for (let index = 1; index < values.length; index += 1) {
      if (values[index].value < values[minimumIndex].value) minimumIndex = index;
      if (values[index].value > values[maximumIndex].value) maximumIndex = index;
    }
    const selected = minimumIndex === maximumIndex ? [values[minimumIndex]] : [values[minimumIndex], values[maximumIndex]].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    result.push(...selected);
  }
  result.push(last);
  return result;
}
