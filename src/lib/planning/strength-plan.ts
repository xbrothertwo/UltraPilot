export type StrengthVariant = "A" | "B";

export type StrengthExercise = { name: string; prescription: string };
export type StrengthWorkout = { variant: StrengthVariant; focus: string; exercises: StrengthExercise[]; core: StrengthExercise[] };

export const STRENGTH_WORKOUTS: Record<StrengthVariant, StrengthWorkout> = {
  A: {
    variant: "A",
    focus: "Knie dominant + Core",
    exercises: [
      { name: "Back Squat", prescription: "4 × 4–6" },
      { name: "Bulgarian Split Squat", prescription: "3 × 6–8 je Bein" },
      { name: "Sitzendes Wadenheben", prescription: "3 × 10–12" },
    ],
    core: [
      { name: "Pallof Press", prescription: "3 × 10–12 je Seite" },
      { name: "Dead Bug", prescription: "3 × 8–10 je Seite" },
      { name: "Side Plank", prescription: "2 × 30–45 s je Seite" },
    ],
  },
  B: {
    variant: "B",
    focus: "Hintere Kette + Core",
    exercises: [
      { name: "Romanian Deadlift", prescription: "4 × 5–7" },
      { name: "Step-up mit Knee Raise", prescription: "3 × 8 je Bein" },
      { name: "Hip Thrust", prescription: "3 × 6–10" },
      { name: "Beinbeuger", prescription: "2 × 10–12" },
      { name: "Stehendes Wadenheben", prescription: "3 × 12–15" },
    ],
    core: [
      { name: "Forearm Plank", prescription: "3 × 30–60 s" },
      { name: "Bird Dog", prescription: "3 × 8 je Seite" },
      { name: "Pallof Hold", prescription: "2 × 20–30 s je Seite" },
    ],
  },
};

export function strengthVariantFromTitle(title: string): StrengthVariant | null {
  const match = /(?:^|\s)(A|B)$/i.exec(title.trim());
  return match ? match[1].toUpperCase() as StrengthVariant : null;
}

export function strengthSequence(sessions: number, summer: boolean, lastVariant: StrengthVariant | null): StrengthVariant[] {
  if (sessions <= 0) return [];
  const first: StrengthVariant = summer && lastVariant === "A" ? "B" : "A";
  return Array.from({ length: sessions }, (_, index) => index % 2 === 0 ? first : first === "A" ? "B" : "A");
}

export function strengthDescription(variant: StrengthVariant): string {
  const workout = STRENGTH_WORKOUTS[variant];
  const lines = [...workout.exercises, ...workout.core].map((exercise) => `${exercise.name}: ${exercise.prescription}`);
  return `${workout.focus}\n${lines.join("\n")}\nRIR 1–2 · Grundübungen 2–3 min Pause · Zubehör/Core 60–90 s.`;
}
