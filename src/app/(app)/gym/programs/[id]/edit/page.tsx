import { notFound } from "next/navigation";
import { GymProgramBuilder } from "@/components/gym/program-builder";
import { PageHeading } from "@/components/page-heading";
import { isDemoMode } from "@/lib/demo-data";
import { getExerciseLibrary, getGymProgram } from "@/lib/gym/data";
import type { GymProgramGoal } from "@/lib/gym/types";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

export default async function EditGymProgramPage({ params }: Props) {
  const { id } = await params;
  const [program, exercises] = await Promise.all([getGymProgram(id), getExerciseLibrary({ includeArchived: true })]);
  if (!program) notFound();
  const initial = { id: program.id, name: program.name, description: program.description, goal: program.goal as GymProgramGoal, startDate: program.startDate, endDate: program.endDate, active: program.active, days: program.days.map((day) => ({ id: day.id, name: day.name, estimatedDurationMinutes: day.estimatedDurationMinutes ?? 60, notes: day.notes ?? "", exercises: day.exercises.map((exercise) => ({ exerciseId: exercise.exerciseId, workingSets: exercise.workingSets, repMin: exercise.repMin, repMax: exercise.repMax, targetSeconds: exercise.targetSeconds, targetDistanceMeters: exercise.targetDistanceMeters, targetRir: exercise.targetRir, targetRpe: exercise.targetRpe, restSeconds: exercise.restSeconds, startWeightKg: exercise.startWeightKg, loadIncrementKg: exercise.loadIncrementKg, notes: exercise.notes, warmupNote: exercise.warmupNote })) })) };
  return <><PageHeading eyebrow="Gym · Program Builder" title={`${program.name} bearbeiten`} description="Abgeschlossene Sessions behalten ihre Exercise- und Tracking-Snapshots; Änderungen wirken nur auf zukünftige Workouts."/><GymProgramBuilder exercises={exercises} initial={initial} demoMode={isDemoMode}/></>;
}
