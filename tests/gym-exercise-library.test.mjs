import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseExerciseCsv, planLibraryImport, summarizeLibrary } from "../scripts/gym-exercise-library.mjs";

const path = new URL("../data/gym/Uebungsdatenbank_UltraPilot_Gym_v1.csv", import.meta.url);

describe("gym exercise CSV", () => {
  it("parses the complete UTF-8 semicolon library and pipe lists", async () => {
    const records = parseExerciseCsv(await readFile(path, "utf8"));
    const summary = summarizeLibrary(records);
    expect(summary).toMatchObject({ records: 245, active: 245, reviewRequired: 78, duplicateIds: 0, equipment: 28 });
    expect(records[0]).toMatchObject({ externalId: "EX-0001", name: "Bankdrücken", trackingType: "weight_reps" });
    expect(records[0].equipment).toEqual(["Kurzhantel", "Langhantel", "Multipresse"]);
  });

  it("rejects duplicate and invalid stable IDs", async () => {
    const source = await readFile(path, "utf8");
    const firstDataLine = source.split(/\r?\n/)[1];
    expect(() => parseExerciseCsv(`${source.trim()}\n${firstDataLine}`)).toThrow("doppelte External ID");
    expect(() => parseExerciseCsv(source.replace("EX-0001", "BAD-1"))).toThrow("EX-0001");
  });

  it("plans idempotent updates and archives missing external rows", async () => {
    const incoming = parseExerciseCsv(await readFile(path, "utf8")).slice(0, 2);
    const existing = [{ external_id: "EX-0001", active: true }, { external_id: "EX-9999", active: true }];
    expect(planLibraryImport(existing, incoming)).toEqual({ inserts: ["EX-0002"], updates: ["EX-0001"], archives: ["EX-9999"] });
    expect(planLibraryImport(incoming.map((record) => ({ external_id: record.externalId, active: record.active })), incoming)).toEqual({ inserts: [], updates: ["EX-0001", "EX-0002"], archives: [] });
  });
});
