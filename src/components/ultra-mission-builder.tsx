"use client";
import {
  saveMission,
} from "@/app/mission/actions";
import { useMemo, useState } from "react";
import {
  buildUltraMissionPlan,
  formatMissionDuration,
  formatPace,
  paceMinutesPerKmToSpeed,
  type MissionSportType,
} from "@/lib/ultra-mission-builder";
import type {
  SavedMission,
} from "@/lib/missions";

type BuilderValues = {
  distanceKm: string;
  elevationMeters: string;
  averageSpeedKmh: string;
  pace: string;
  startAt: string;
  stopIntervalKm: string;
  stopDurationMinutes: string;
  carbohydratesPerHour: string;
  fluidMillilitersPerHour: string;
  sodiumMilligramsPerHour: string;
};

type UltraMissionBuilderProps = {
  defaultStartAt: string;
  initialSportType: MissionSportType;
  initialMission: SavedMission | null;
  serverError: string | null;
};

const numberFormatter = new Intl.NumberFormat(
  "de-DE",
  {
    maximumFractionDigits: 1,
  },
);

function parseNumber(value: string): number {
  return Number(value.replace(",", "."));
}

function parsePace(
  value: string,
): number {
  const normalized = value
    .trim()
    .replace(",", ".");

  if (normalized.includes(":")) {
    const [minutesText, secondsText] =
      normalized.split(":");

    const minutes = Number(minutesText);
    const seconds = Number(secondsText);

    if (
      !Number.isInteger(minutes) ||
      !Number.isInteger(seconds) ||
      seconds < 0 ||
      seconds > 59
    ) {
      return Number.NaN;
    }

    return minutes + seconds / 60;
  }

  return Number(normalized);
}

function valuesForSport(
  sportType: MissionSportType,
  defaultStartAt: string,
): BuilderValues {
  if (sportType === "running") {
    return {
      distanceKm: "50",
      elevationMeters: "500",
      averageSpeedKmh: "10",
      pace: "6:00",
      startAt: defaultStartAt,
      stopIntervalKm: "10",
      stopDurationMinutes: "5",
      carbohydratesPerHour: "60",
      fluidMillilitersPerHour: "500",
      sodiumMilligramsPerHour: "400",
    };
  }

  return {
    distanceKm: "300",
    elevationMeters: "3000",
    averageSpeedKmh: "25",
    pace: "6:00",
    startAt: defaultStartAt,
    stopIntervalKm: "100",
    stopDurationMinutes: "10",
    carbohydratesPerHour: "80",
    fluidMillilitersPerHour: "600",
    sodiumMilligramsPerHour: "500",
  };
}
function paceInputFromSeconds(
  totalSeconds: number,
): string {
  const minutes = Math.floor(
    totalSeconds / 60,
  );

  const seconds =
    totalSeconds % 60;

  return `${minutes}:${String(
    seconds,
  ).padStart(2, "0")}`;
}

function dateTimeLocalInBerlin(
  value: string,
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts =
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Berlin",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);

  const part = (type: string) =>
    parts.find(
      (item) => item.type === type,
    )?.value ?? "";

  return [
    `${part("year")}-${part("month")}-${part("day")}`,
    `${part("hour")}:${part("minute")}`,
  ].join("T");
}

function valuesFromMission(
  mission: SavedMission,
  defaultStartAt: string,
): BuilderValues {
  const defaults = valuesForSport(
    mission.sportType,
    defaultStartAt,
  );

  return {
    ...defaults,
    distanceKm: String(
      mission.distanceKm,
    ),
    elevationMeters: String(
      mission.elevationMeters,
    ),
    averageSpeedKmh:
      mission.averageSpeedKmh === null
        ? defaults.averageSpeedKmh
        : String(
            mission.averageSpeedKmh,
          ),
    pace:
      mission.paceSecondsPerKm === null
        ? defaults.pace
        : paceInputFromSeconds(
            mission.paceSecondsPerKm,
          ),
    startAt: mission.startAt
      ? dateTimeLocalInBerlin(
          mission.startAt,
        )
      : defaultStartAt,
    stopIntervalKm: String(
      mission.stopIntervalKm,
    ),
    stopDurationMinutes: String(
      mission.stopDurationMinutes,
    ),
    carbohydratesPerHour: String(
      mission.carbohydratesPerHour,
    ),
    fluidMillilitersPerHour: String(
      mission.fluidMillilitersPerHour,
    ),
    sodiumMilligramsPerHour: String(
      mission.sodiumMilligramsPerHour,
    ),
  };
}

function isoOrEmpty(
  value: string,
): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? ""
    : date.toISOString();
}
function formatDateTime(
  value: Date,
): string {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatLiters(
  milliliters: number,
): string {
  return `${(
    milliliters / 1_000
  ).toLocaleString("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} l`;
}

export function UltraMissionBuilder({
  defaultStartAt,
  initialSportType,
  initialMission,
  serverError,
}: UltraMissionBuilderProps) {
  const startingSportType =
    initialMission?.sportType ??
    initialSportType;

  const [sportType, setSportType] =
    useState<MissionSportType>(
      startingSportType,
    );

  const [title, setTitle] = useState(
    initialMission?.title ??
      (startingSportType === "running"
        ? "Meine Laufmission"
        : "Meine Radmission"),
  );

  const [
    description,
    setDescription,
  ] = useState(
    initialMission?.description ?? "",
  );

  const [valuesBySport, setValuesBySport] =
    useState<
      Record<
        MissionSportType,
        BuilderValues
      >
    >(() => {
      const defaults = {
        cycling: valuesForSport(
          "cycling",
          defaultStartAt,
        ),
        running: valuesForSport(
          "running",
          defaultStartAt,
        ),
      };

      if (initialMission) {
        defaults[
          initialMission.sportType
        ] = valuesFromMission(
          initialMission,
          defaultStartAt,
        );
      }

      return defaults;
    });

  const values =
    valuesBySport[sportType];

  const result = useMemo(() => {
    try {
      const paceMinutesPerKm =
        sportType === "running"
          ? parsePace(values.pace)
          : null;

      const averageSpeedKmh =
        sportType === "running"
          ? paceMinutesPerKmToSpeed(
              paceMinutesPerKm ??
                Number.NaN,
            )
          : parseNumber(
              values.averageSpeedKmh,
            );

      const plan = buildUltraMissionPlan({
        sportType,
        distanceKm: parseNumber(
          values.distanceKm,
        ),
        elevationMeters: parseNumber(
          values.elevationMeters,
        ),
        averageSpeedKmh,
        startAt: new Date(values.startAt),
        stopIntervalKm: parseNumber(
          values.stopIntervalKm,
        ),
        stopDurationMinutes: parseNumber(
          values.stopDurationMinutes,
        ),
        carbohydratesPerHour: parseNumber(
          values.carbohydratesPerHour,
        ),
        fluidMillilitersPerHour:
          parseNumber(
            values.fluidMillilitersPerHour,
          ),
        sodiumMilligramsPerHour:
          parseNumber(
            values.sodiumMilligramsPerHour,
          ),
      });

      return {
        plan,
        error: null,
        paceMinutesPerKm,
      };
    } catch (error) {
      return {
        plan: null,
        error:
          error instanceof Error
            ? error.message
            : "Die Mission konnte nicht berechnet werden.",
        paceMinutesPerKm: null,
      };
    }
  }, [sportType, values]);

  function updateValue(
    key: keyof BuilderValues,
    value: string,
  ) {
    setValuesBySport((current) => ({
      ...current,
      [sportType]: {
        ...current[sportType],
        [key]: value,
      },
    }));
  }

  const isRunning =
    sportType === "running";

  const stopLabel = isRunning
    ? "Aid Station alle"
    : "Stopp alle";

  const breakLabel = isRunning
    ? "Aufenthalt"
    : "Stoppdauer";

  const timelineLabel = isRunning
    ? "Aid-Station-Timeline"
    : "Mission Timeline";

  return (
    <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)] xl:items-start">
      <aside className="card p-5 xl:sticky xl:top-6">
        <p className="eyebrow">
          Mission konfigurieren
        </p>
        {serverError && (
  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-950">
    {serverError}
  </div>
)}

<div className="mt-5 space-y-4">
  <label className="block">
    <span className="text-sm font-bold">
      Missionsname
    </span>

    <input
      type="text"
      value={title}
      maxLength={200}
      onChange={(event) =>
        setTitle(event.target.value)
      }
      className="mt-2 w-full rounded-xl border border-[var(--line)] bg-transparent px-3 py-2.5"
    />
  </label>

  <label className="block">
    <span className="text-sm font-bold">
      Beschreibung
    </span>

    <textarea
      value={description}
      maxLength={2000}
      rows={3}
      onChange={(event) =>
        setDescription(
          event.target.value,
        )
      }
      className="mt-2 w-full resize-y rounded-xl border border-[var(--line)] bg-transparent px-3 py-2.5"
    />
  </label>
</div>
        <div className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-[#edf3fb] p-1">
          <button
            type="button"
            aria-pressed={
              sportType === "cycling"
            }
            onClick={() =>
              setSportType("cycling")
            }
            className={`rounded-xl px-3 py-2.5 text-sm font-black transition ${
              sportType === "cycling"
                ? "bg-white text-[var(--ink)] shadow-sm"
                : "text-[var(--muted)]"
            }`}
          >
            Radfahren
          </button>

          <button
            type="button"
            aria-pressed={
              sportType === "running"
            }
            onClick={() =>
              setSportType("running")
            }
            className={`rounded-xl px-3 py-2.5 text-sm font-black transition ${
              sportType === "running"
                ? "bg-white text-[var(--ink)] shadow-sm"
                : "text-[var(--muted)]"
            }`}
          >
            Laufen
          </button>
        </div>

        <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
          Der Startmodus folgt deiner
          Hauptsportart. Das Umschalten
          verändert dein Profil nicht.
        </p>

        <div className="mt-5 space-y-4">
          <Field
            label="Distanz"
            suffix="km"
            value={values.distanceKm}
            min="1"
            max="10000"
            step="0.1"
            onChange={(value) =>
              updateValue(
                "distanceKm",
                value,
              )
            }
          />

          <Field
            label="Höhenmeter"
            suffix="hm"
            value={
              values.elevationMeters
            }
            min="0"
            max="100000"
            onChange={(value) =>
              updateValue(
                "elevationMeters",
                value,
              )
            }
          />

          {isRunning ? (
            <PaceField
              value={values.pace}
              onChange={(value) =>
                updateValue("pace", value)
              }
            />
          ) : (
            <Field
              label="Bewegungsschnitt"
              suffix="km/h"
              value={
                values.averageSpeedKmh
              }
              min="5"
              max="60"
              step="0.1"
              onChange={(value) =>
                updateValue(
                  "averageSpeedKmh",
                  value,
                )
              }
            />
          )}

          <label className="block">
            <span className="text-sm font-bold">
              Startzeit
            </span>

            <input
              type="datetime-local"
              value={values.startAt}
              onChange={(event) =>
                updateValue(
                  "startAt",
                  event.target.value,
                )
              }
              className="mt-2 w-full rounded-xl border border-[var(--line)] bg-transparent px-3 py-2.5"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label={stopLabel}
              suffix="km"
              value={
                values.stopIntervalKm
              }
              min={isRunning ? "1" : "20"}
              max="500"
              step="0.1"
              onChange={(value) =>
                updateValue(
                  "stopIntervalKm",
                  value,
                )
              }
            />

            <Field
              label={breakLabel}
              suffix="min"
              value={
                values.stopDurationMinutes
              }
              min="0"
              max="240"
              onChange={(value) =>
                updateValue(
                  "stopDurationMinutes",
                  value,
                )
              }
            />
          </div>

          <div className="border-t border-[var(--line)] pt-4">
            <p className="text-xs font-black uppercase tracking-wider text-[var(--muted)]">
              Versorgung pro Stunde
            </p>

            <div className="mt-3 space-y-3">
              <Field
                label="Kohlenhydrate"
                suffix="g"
                value={
                  values.carbohydratesPerHour
                }
                min="0"
                max="150"
                onChange={(value) =>
                  updateValue(
                    "carbohydratesPerHour",
                    value,
                  )
                }
              />

              <Field
                label="Flüssigkeit"
                suffix="ml"
                value={
                  values.fluidMillilitersPerHour
                }
                min="0"
                max="2000"
                onChange={(value) =>
                  updateValue(
                    "fluidMillilitersPerHour",
                    value,
                  )
                }
              />

              <Field
                label="Natrium"
                suffix="mg"
                value={
                  values.sodiumMilligramsPerHour
                }
                min="0"
                max="3000"
                onChange={(value) =>
                  updateValue(
                    "sodiumMilligramsPerHour",
                    value,
                  )
                }
              />
            </div>
          </div>
        </div>
        <form
  action={saveMission}
  className="mt-5 border-t border-[var(--line)] pt-5"
>
  <input
    type="hidden"
    name="missionId"
    value={initialMission?.id ?? ""}
  />

  <input
    type="hidden"
    name="title"
    value={title}
  />

  <input
    type="hidden"
    name="description"
    value={description}
  />

  <input
    type="hidden"
    name="sportType"
    value={sportType}
  />

  <input
    type="hidden"
    name="targetDate"
    value={values.startAt.slice(0, 10)}
  />

  <input
    type="hidden"
    name="startAtIso"
    value={isoOrEmpty(
      values.startAt,
    )}
  />

  <input
    type="hidden"
    name="distanceKm"
    value={values.distanceKm}
  />

  <input
    type="hidden"
    name="elevationMeters"
    value={values.elevationMeters}
  />

  <input
    type="hidden"
    name="averageSpeedKmh"
    value={
      sportType === "cycling"
        ? values.averageSpeedKmh
        : ""
    }
  />

  <input
    type="hidden"
    name="pace"
    value={
      sportType === "running"
        ? values.pace
        : ""
    }
  />

  <input
    type="hidden"
    name="stopIntervalKm"
    value={values.stopIntervalKm}
  />

  <input
    type="hidden"
    name="stopDurationMinutes"
    value={
      values.stopDurationMinutes
    }
  />

  <input
    type="hidden"
    name="carbohydratesPerHour"
    value={
      values.carbohydratesPerHour
    }
  />

  <input
    type="hidden"
    name="fluidMillilitersPerHour"
    value={
      values.fluidMillilitersPerHour
    }
  />

  <input
    type="hidden"
    name="sodiumMilligramsPerHour"
    value={
      values.sodiumMilligramsPerHour
    }
  />

  <button
    type="submit"
    disabled={
      result.plan === null ||
      title.trim() === ""
    }
    className="primary-button w-full disabled:cursor-not-allowed disabled:opacity-50"
  >
    {initialMission
      ? "Änderungen speichern"
      : "Mission speichern"}
  </button>

  <p className="mt-2 text-center text-xs text-[var(--muted)]">
    {initialMission
      ? "Die bestehende Mission wird aktualisiert."
      : "Die Mission erscheint anschließend im Mission HQ."}
  </p>
</form>
      </aside>

      <main className="min-w-0">
        {result.error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-950">
            <p className="font-black">
              Mission noch nicht
              berechenbar
            </p>

            <p className="mt-1 text-sm">
              {result.error}
            </p>
          </div>
        )}

        {result.plan && (
          <>
            <section className="relative overflow-hidden rounded-[1.8rem] bg-gradient-to-br from-[#07162d] via-[#123a72] to-[#155e9a] p-6 text-white shadow-[0_24px_60px_rgba(9,26,51,.2)] sm:p-8">
              <div className="absolute -right-24 -top-28 size-80 rounded-full border-[50px] border-cyan-300/10" />

              <div className="relative">
                <p className="text-xs font-black uppercase tracking-[.2em] text-cyan-200">
                  Voraussichtliche
                  Zielankunft
                </p>

                <h2 className="mt-3 text-4xl font-black tracking-[-.04em] sm:text-6xl">
                  {formatDateTime(
                    result.plan.finishAt,
                  )}
                </h2>

                <p className="mt-4 text-blue-50/70">
                  {formatMissionDuration(
                    result.plan.totalMinutes,
                  )}{" "}
                  Gesamtzeit ·{" "}
                  {formatMissionDuration(
                    result.plan.ridingMinutes,
                  )}{" "}
                  {isRunning
                    ? "in Bewegung"
                    : "auf dem Rad"}
                </p>

                {isRunning &&
                  result.paceMinutesPerKm !==
                    null && (
                    <p className="mt-2 text-sm font-bold text-cyan-200">
                      {formatPace(
                        result.paceMinutesPerKm,
                      )}{" "}
                      Bewegungs-Pace ·{" "}
                      {formatPace(
                        result.plan
                          .totalMinutes /
                          parseNumber(
                            values.distanceKm,
                          ),
                      )}{" "}
                      inklusive Aufenthalten
                    </p>
                  )}
              </div>
            </section>

            <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label={
                  isRunning
                    ? "Aid Stations"
                    : "Pausen"
                }
                value={formatMissionDuration(
                  result.plan.breakMinutes,
                )}
                detail={`${result.plan.stopCount} geplante ${
                  isRunning
                    ? "Aufenthalte"
                    : "Stopps"
                }`}
              />

              <Metric
                label="Kohlenhydrate"
                value={`${numberFormatter.format(
                  result.plan
                    .totalCarbohydratesGrams,
                )} g`}
                detail={`${values.carbohydratesPerHour} g pro Stunde`}
              />

              <Metric
                label="Flüssigkeit"
                value={formatLiters(
                  result.plan
                    .totalFluidMilliliters,
                )}
                detail={`${values.fluidMillilitersPerHour} ml pro Stunde`}
              />

              <Metric
                label="Streckenprofil"
                value={`${numberFormatter.format(
                  isRunning
                    ? result.plan
                        .elevationPer10Km
                    : result.plan
                        .elevationPer100Km,
                )} hm`}
                detail={
                  isRunning
                    ? "pro 10 Kilometer"
                    : "pro 100 Kilometer"
                }
              />
            </section>

            <section className="card mt-6 p-5 sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="eyebrow">
                    Plausibilitätsprüfung
                  </p>

                  <h2 className="mt-2 text-2xl font-black">
                    Hinweise zur Mission
                  </h2>
                </div>

                <span className="rounded-full bg-[#edf3fb] px-3 py-1.5 text-xs font-black text-[var(--muted)]">
                  {
                    result.plan.warnings
                      .length
                  }{" "}
                  Hinweise
                </span>
              </div>

              {result.plan.warnings
                .length === 0 ? (
                <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-950">
                  Keine offensichtlichen
                  Warnsignale in den
                  eingegebenen Annahmen.
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {result.plan.warnings.map(
                    (warning) => (
                      <div
                        key={warning}
                        className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"
                      >
                        {warning}
                      </div>
                    ),
                  )}
                </div>
              )}
            </section>

            <section className="mt-8">
              <p className="eyebrow">
                {isRunning
                  ? "Verpflegungspunkte"
                  : "Kontrollpunkte"}
              </p>

              <h2 className="mt-2 text-3xl font-black tracking-tight">
                {timelineLabel}
              </h2>

              <div className="card mt-5 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] text-left text-sm">
                    <thead className="border-b border-[var(--line)] bg-[#edf3fb] text-xs uppercase tracking-wider text-[var(--muted)]">
                      <tr>
                        <th className="px-5 py-4">
                          Abschnitt
                        </th>

                        <th className="px-5 py-4">
                          Distanz
                        </th>

                        <th className="px-5 py-4">
                          Ankunft
                        </th>

                        <th className="px-5 py-4">
                          {isRunning
                            ? "Aufenthalt"
                            : "Pause"}
                        </th>

                        <th className="px-5 py-4">
                          Weiter
                        </th>

                        <th className="px-5 py-4">
                          KH gesamt
                        </th>

                        <th className="px-5 py-4">
                          Flüssigkeit
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-[var(--line)]">
                      {result.plan.segments.map(
                        (segment) => (
                          <tr
                            key={
                              segment.index
                            }
                          >
                            <td className="px-5 py-4 font-black">
                              {segment.index}
                            </td>

                            <td className="px-5 py-4">
                              {numberFormatter.format(
                                segment.fromKm,
                              )}{" "}
                              –{" "}
                              {numberFormatter.format(
                                segment.toKm,
                              )}{" "}
                              km
                            </td>

                            <td className="px-5 py-4 font-bold">
                              {formatDateTime(
                                segment.arrivalAt,
                              )}
                            </td>

                            <td className="px-5 py-4">
                              {segment.breakMinutes >
                              0
                                ? `${segment.breakMinutes} min`
                                : "Ziel"}
                            </td>

                            <td className="px-5 py-4">
                              {segment.breakMinutes >
                              0
                                ? formatDateTime(
                                    segment.departureAt,
                                  )
                                : "–"}
                            </td>

                            <td className="px-5 py-4">
                              {numberFormatter.format(
                                segment.cumulativeCarbohydratesGrams,
                              )}{" "}
                              g
                            </td>

                            <td className="px-5 py-4">
                              {formatLiters(
                                segment.cumulativeFluidMilliliters,
                              )}
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function PaceField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold">
        Zielpace
      </span>

      <div className="mt-2 flex overflow-hidden rounded-xl border border-[var(--line)]">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          placeholder="6:00"
          onChange={(event) =>
            onChange(event.target.value)
          }
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 outline-none"
        />

        <span className="grid min-w-20 place-items-center border-l border-[var(--line)] bg-[#edf3fb] px-3 text-xs font-black text-[var(--muted)]">
          min/km
        </span>
      </div>

      <span className="mt-1 block text-xs text-[var(--muted)]">
        Eingabe zum Beispiel 6:00 oder
        5:30
      </span>
    </label>
  );
}

function Field({
  label,
  suffix,
  value,
  min,
  max,
  step = "1",
  onChange,
}: {
  label: string;
  suffix: string;
  value: string;
  min: string;
  max: string;
  step?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold">
        {label}
      </span>

      <div className="mt-2 flex overflow-hidden rounded-xl border border-[var(--line)]">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) =>
            onChange(event.target.value)
          }
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 outline-none"
        />

        <span className="grid min-w-14 place-items-center border-l border-[var(--line)] bg-[#edf3fb] px-3 text-xs font-black text-[var(--muted)]">
          {suffix}
        </span>
      </div>
    </label>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="card p-5">
      <p className="text-xs font-black uppercase tracking-wider text-[var(--muted)]">
        {label}
      </p>

      <p className="mt-2 text-2xl font-black">
        {value}
      </p>

      <p className="mt-1 text-xs text-[var(--muted)]">
        {detail}
      </p>
    </article>
  );
}