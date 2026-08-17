import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GymProgramBuilder } from "@/components/gym/program-builder";
import type { GymExercise } from "@/lib/gym/types";

vi.mock("@/app/gym/actions", () => ({ saveGymProgram: vi.fn() }));

const exercise: GymExercise = {
  id: "bench-press",
  externalId: "EX-0001",
  ownerId: null,
  name: "Bankdrücken",
  primaryMuscle: "Brust",
  secondaryMuscles: [],
  muscleGroup: "Brust",
  secondaryMuscleGroups: [],
  equipment: ["Langhantel"],
  aliases: [],
  variations: [],
  trackingType: "weight_reps",
  exerciseType: "compound",
  movementPattern: "horizontal_push",
  laterality: "bilateral",
  notes: null,
  active: true,
  favorite: false,
  lastUsedAt: null,
};

describe("gym program builder form", () => {
  let renderer: ReactTestRenderer;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    if (renderer) act(() => renderer.unmount());
  });

  it("allows the default 2.5 kg load increment in native form validation", () => {
    act(() => {
      renderer = create(<GymProgramBuilder exercises={[exercise]} demoMode={false} />);
    });

    const search = renderer.root.findByProps({ placeholder: "Name, Alias oder Variation" });
    act(() => search.props.onChange({ target: { value: "Bankdrücken" } }));
    const result = renderer.root.findAllByType("button").find((button) =>
      button.findAllByType("span").some((span) => span.children.includes("Bankdrücken")),
    );
    expect(result).toBeDefined();
    act(() => result?.props.onClick());

    const increment = renderer.root.findAllByType("input").find((input) => input.props.value === 2.5);
    expect(increment?.props.step).toBe(0.25);
  });
});
