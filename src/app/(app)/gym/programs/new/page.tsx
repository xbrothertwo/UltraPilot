import { GymProgramBuilder } from "@/components/gym/program-builder";
import { PageHeading } from "@/components/page-heading";
import { isDemoMode } from "@/lib/demo-data";
import { getExerciseLibrary } from "@/lib/gym/data";

export const metadata = { title: "Gym-Programm bauen" };
export const dynamic = "force-dynamic";

export default async function NewGymProgramPage() {
  const exercises = await getExerciseLibrary();
  return <><PageHeading eyebrow="Gym · Program Builder" title="Baue einen Plan, den du wirklich ausführst." description="Manuell bis ins Detail oder deterministisch als editierbarer Ausgangsplan aus Zeit, Ziel und Equipment."/><GymProgramBuilder exercises={exercises} demoMode={isDemoMode}/></>;
}
