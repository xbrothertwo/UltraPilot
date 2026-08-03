import { Unzip, UnzipInflate } from "fflate";
import { AppleHealthHeartRateMultiRangeParser, AppleHealthHeartRateParser } from "./xml-parser";
import { AppleHealthRecoveryParser, type AppleHealthDailyRecovery } from "./recovery-parser";
import type { SensorSample } from "@/lib/activity-files/types";

type StreamingParser = { push(chunk: Uint8Array, final?: boolean): void };

async function readXmlStream(stream: ReadableStream<Uint8Array>, parser: StreamingParser, onProgress?: (bytes: number) => void): Promise<void> {
  const reader = stream.getReader();
  let processed = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    processed += value.byteLength;
    parser.push(value);
    onProgress?.(processed);
  }
  parser.push(new Uint8Array(), true);
}

async function readExportXmlFromZip(file: File, parser: StreamingParser, onProgress?: (bytes: number) => void): Promise<void> {
  let targetFound = false;
  let resolveTarget!: () => void;
  let rejectTarget!: (error: Error) => void;
  const targetFinished = new Promise<void>((resolve, reject) => { resolveTarget = resolve; rejectTarget = reject; });
  const unzip = new Unzip((entry) => {
    if (!/(?:^|\/)export\.xml$/i.test(entry.name)) return;
    targetFound = true;
    entry.ondata = (error, chunk, final) => {
      if (error) { rejectTarget(error); return; }
      parser.push(chunk, final);
      if (final) resolveTarget();
    };
    entry.start();
  });
  unzip.register(UnzipInflate);
  const reader = file.stream().getReader();
  let processed = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) { unzip.push(new Uint8Array(), true); break; }
    processed += value.byteLength;
    unzip.push(value);
    onProgress?.(processed);
  }
  if (!targetFound) throw new Error("Die ZIP-Datei enthält keine Apple-Health-Datei export.xml.");
  await targetFinished;
}

export async function extractAppleHealthHeartRate(file: File, startTime: string, elapsedTimeSeconds: number, onProgress?: (fraction: number) => void): Promise<SensorSample[]> {
  const start = new Date(startTime).getTime();
  const end = start + elapsedTimeSeconds * 1000;
  if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error("Der Garmin-Zeitraum ist ungültig.");
  const parser = new AppleHealthHeartRateParser(start, end);
  const progress = (bytes: number) => onProgress?.(file.size ? Math.min(1, bytes / file.size) : 0);
  if (file.name.toLowerCase().endsWith(".zip")) await readExportXmlFromZip(file, parser, progress);
  else if (file.name.toLowerCase().endsWith(".xml")) await readXmlStream(file.stream(), parser, progress);
  else throw new Error("Der Apple-Health-Export muss eine ZIP- oder export.xml-Datei sein.");
  const samples = parser.result();
  if (!samples.length) throw new Error("Im Zeitraum der Garmin-Tour wurden im Apple-Export keine Herzfrequenzwerte gefunden.");
  return samples;
}

export async function extractAppleHealthHeartRateForRanges(file: File, ranges: { startTime: string; elapsedTimeSeconds: number }[], onProgress?: (fraction: number) => void): Promise<SensorSample[][]> {
  if (!ranges.length) return [];
  const milliseconds = ranges.map((range) => {
    const startMilliseconds = new Date(range.startTime).getTime();
    const endMilliseconds = startMilliseconds + range.elapsedTimeSeconds * 1000;
    if (!Number.isFinite(startMilliseconds) || !Number.isFinite(endMilliseconds)) throw new Error("Ein Garmin-Zeitraum ist ungültig.");
    return { startMilliseconds, endMilliseconds };
  });
  const parser = new AppleHealthHeartRateMultiRangeParser(milliseconds);
  const progress = (bytes: number) => onProgress?.(file.size ? Math.min(1, bytes / file.size) : 0);
  if (file.name.toLowerCase().endsWith(".zip")) await readExportXmlFromZip(file, parser, progress);
  else if (file.name.toLowerCase().endsWith(".xml")) await readXmlStream(file.stream(), parser, progress);
  else throw new Error("Der Apple-Health-Export muss eine ZIP- oder export.xml-Datei sein.");
  return parser.results();
}

export async function extractAppleHealthRecovery(file: File, onProgress?: (fraction: number) => void): Promise<AppleHealthDailyRecovery[]> {
  const parser = new AppleHealthRecoveryParser();
  const progress = (bytes: number) => onProgress?.(file.size ? Math.min(1, bytes / file.size) : 0);
  if (file.name.toLowerCase().endsWith(".zip")) await readExportXmlFromZip(file, parser, progress);
  else if (file.name.toLowerCase().endsWith(".xml")) await readXmlStream(file.stream(), parser, progress);
  else throw new Error("Der Apple-Health-Export muss eine ZIP- oder export.xml-Datei sein.");
  const metrics = parser.result();
  if (!metrics.length) throw new Error("Im Apple-Health-Export wurden für die letzten 120 Tage keine Schlafdaten gefunden.");
  return metrics;
}
