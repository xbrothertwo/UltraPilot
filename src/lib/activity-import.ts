import type { OnboardingSport } from "@/lib/onboarding-planning";

export type ImportSportType = "cycling" | "running";

export function preferredImportSport(
  selectedSports: readonly OnboardingSport[],
): ImportSportType | null {
  const enduranceSports = selectedSports.filter(
    (sport): sport is ImportSportType => sport === "cycling" || sport === "running",
  );
  return enduranceSports.length === 1 ? enduranceSports[0] : null;
}

export function commonDetectedSport(
  sports: ReadonlyArray<ImportSportType | null | undefined>,
): ImportSportType | null {
  const detected = sports.filter(
    (sport): sport is ImportSportType => sport === "cycling" || sport === "running",
  );
  if (detected.length !== sports.length || detected.length === 0) return null;
  return detected.every((sport) => sport === detected[0]) ? detected[0] : null;
}

export function activityFileType(fileName: string): string {
  const extension = fileName.split(".").at(-1)?.toUpperCase();
  return extension && /^[A-Z0-9]{1,5}$/.test(extension) ? extension : "Datei";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("de-DE")} KB`;
  }
  return `${(bytes / (1024 * 1024)).toLocaleString("de-DE", {
    maximumFractionDigits: 1,
  })} MB`;
}
