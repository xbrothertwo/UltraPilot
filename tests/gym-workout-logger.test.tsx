import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stableSetClientKey, WorkoutLogger } from "@/components/gym/workout-logger";
import type { GymSession } from "@/lib/gym/types";

vi.mock("@/app/gym/actions", () => ({ addGymSessionExercise: vi.fn(), deleteGymSet: vi.fn(), finishGymWorkout: vi.fn(), saveGymSet: vi.fn(), skipGymExercise: vi.fn(), updateGymSessionExerciseNote: vi.fn() }));

const session: GymSession = { id: "session", name: "Lower A mit einem bewusst sehr langen Workouttitel", status: "active", programId: "program", programDayId: "day", plannedWorkoutId: "planned", startedAt: "2026-08-17T18:00:00Z", endedAt: null, durationSeconds: null, exercises: [{ id: "session-exercise", exerciseId: "exercise", name: "Bulgarian Split Squat mit kontrollierter Exzentrik", trackingType: "weight_reps", position: 0, targetSets: 3, targetRepMin: 6, targetRepMax: 8, targetRir: 2, targetRpe: null, restSeconds: 120, notes: "Je Bein, sauber und ohne Hast.", skipped: false, sets: [{ id: "set", clientKey: "00000000-0000-4000-8000-000000000001", setNumber: 1, setType: "working", weightKg: 24, repetitions: 8, durationSeconds: null, distanceMeters: null, loadMode: "external", rir: 2, rpe: 8, completed: true, completedAt: "2026-08-17T18:10:00Z" }], previousSets: [{ id: "previous", clientKey: "00000000-0000-4000-8000-000000000002", setNumber: 1, setType: "working", weightKg: 22, repetitions: 8, durationSeconds: null, distanceMeters: null, loadMode: "external", rir: 2, rpe: 8, completed: true, completedAt: "2026-08-10T18:10:00Z" }] }] };

function text(renderer: ReactTestRenderer) { return renderer.root.findAll((node) => node.children.some((child) => typeof child === "string")).flatMap((node) => node.children).filter((child): child is string => typeof child === "string").join(" "); }

describe("mobile gym workout logger", () => {
  let renderer: ReactTestRenderer;
  beforeEach(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; vi.stubGlobal("window", { setInterval, clearInterval }); });
  afterEach(() => { if (renderer) act(() => renderer.unmount()); vi.unstubAllGlobals(); });

  it("uses a stable UUID idempotency key for an unsaved set", () => {
    const first = stableSetClientKey("session:exercise:1");
    expect(first).toBe(stableSetClientKey("session:exercise:1"));
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(first).not.toBe(stableSetClientKey("session:exercise:2"));
  });

  it("shows previous performance, quick numeric inputs, rest timer and finish action", () => {
    act(() => { renderer = create(<WorkoutLogger session={session}/>); });
    const content = text(renderer);
    expect(content).toContain("Letztes Mal");
    expect(content).toContain("22 kg");
    expect(content).toContain("Workout abschließen");
    expect(renderer.root.findAllByProps({ inputMode: "decimal" }).length).toBeGreaterThan(0);
    expect(renderer.root.findAllByProps({ inputMode: "numeric" }).length).toBeGreaterThan(0);
    expect(renderer.root.findAllByProps({ "aria-live": "polite" })).toHaveLength(1);
    expect(renderer.root.findAllByType("summary").some((node) => node.children.includes("Notiz bearbeiten"))).toBe(true);
  });

  it("adds a set locally without horizontal table structures", () => {
    act(() => { renderer = create(<WorkoutLogger session={session}/>); });
    const before = renderer.root.findAllByProps({ name: "setNumber" }).length;
    const add = renderer.root.findAllByType("button").find((button) => button.children.includes("Satz hinzufügen"));
    act(() => add?.props.onClick());
    expect(renderer.root.findAllByProps({ name: "setNumber" })).toHaveLength(before + 1);
  });

  it("searches the library and offers adding a missing exercise", () => {
    const library = [{ id: "row", externalId: "EX-0020", ownerId: null, name: "Rudern", primaryMuscle: null, secondaryMuscles: [], muscleGroup: "Rücken", secondaryMuscleGroups: [], equipment: ["Kabelzug"], aliases: ["Cable Row"], variations: [], trackingType: "weight_reps" as const, exerciseType: "compound", movementPattern: "horizontal_pull", laterality: "bilateral", notes: null, active: true, favorite: false, lastUsedAt: null }];
    act(() => { renderer = create(<WorkoutLogger session={session} exercises={library}/>); });
    const search = renderer.root.findByProps({ placeholder: "Name, Alias oder Variation" });
    act(() => search.props.onChange({ target: { value: "Cable" } }));
    expect(text(renderer)).toContain("Rudern");
    expect(renderer.root.findAllByProps({ name: "exerciseId" }).some((node) => node.props.value === "row")).toBe(true);
  });
});
