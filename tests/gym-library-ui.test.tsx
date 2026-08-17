import { act, create, type ReactTestRenderer } from "react-test-renderer";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { filterExercises } from "@/components/gym/exercise-library";
import { GymProgramBuilder } from "@/components/gym/program-builder";
import type { GymExercise } from "@/lib/gym/types";

vi.mock("next/link", () => ({ default: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode }) => <a {...props}>{children}</a> }));
vi.mock("@/app/gym/actions", () => ({ toggleGymFavorite: vi.fn(), saveGymProgram: vi.fn() }));

const exercises: GymExercise[] = [
  { id: "bench", externalId: "EX-0001", ownerId: null, name: "Bankdrücken", primaryMuscle: "M. pectoralis major", secondaryMuscles: ["M. triceps brachii"], muscleGroup: "Brust", secondaryMuscleGroups: ["Arme"], equipment: ["Langhantel"], aliases: ["Bench Press"], variations: ["Schrägbankdrücken"], trackingType: "weight_reps", exerciseType: "compound", movementPattern: "horizontal_push", laterality: "bilateral", notes: null, active: true, favorite: true, lastUsedAt: "2026-08-16T10:00:00Z" },
  { id: "row", externalId: "EX-0020", ownerId: null, name: "Rudern", primaryMuscle: "M. latissimus dorsi", secondaryMuscles: [], muscleGroup: "Rücken", secondaryMuscleGroups: [], equipment: ["Kabelzug"], aliases: [], variations: ["einarmig"], trackingType: "weight_reps", exerciseType: "compound", movementPattern: "horizontal_pull", laterality: "bilateral", notes: null, active: true, favorite: false, lastUsedAt: null },
];

describe("gym library and builder UI", () => {
  let renderer: ReactTestRenderer;
  beforeEach(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
  afterEach(() => { if (renderer) act(() => renderer.unmount()); });

  it("searches aliases and variations and combines muscle/equipment/favorite filters", () => {
    const blank = { query: "", muscleGroup: "", muscle: "", equipment: "", movement: "", type: "", favoritesOnly: false, recentOnly: false };
    expect(filterExercises(exercises, { ...blank, query: "bench" }).map((item) => item.id)).toEqual(["bench"]);
    expect(filterExercises(exercises, { ...blank, query: "einarmig" }).map((item) => item.id)).toEqual(["row"]);
    expect(filterExercises(exercises, { ...blank, muscleGroup: "Brust", equipment: "Langhantel", favoritesOnly: true }).map((item) => item.id)).toEqual(["bench"]);
  });

  it("renders the manual and guided builder with accessible controls", () => {
    act(() => { renderer = create(<GymProgramBuilder exercises={exercises} demoMode/>); });
    expect(renderer.root.findAllByProps({ role: "tablist" })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ type: "search" })).toHaveLength(1);
    const guided = renderer.root.findAllByType("button").find((button) => button.children.includes("Geführt erstellen"));
    expect(guided).toBeTruthy();
    act(() => guided?.props.onClick());
    expect(renderer.root.findAllByType("fieldset")).toHaveLength(1);
    expect(renderer.root.findAllByProps({ disabled: true }).some((node) => node.children.includes("Nach Migration verfügbar"))).toBe(true);
  });
});
