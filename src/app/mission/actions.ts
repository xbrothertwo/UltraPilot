"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  buildMissionDerivedKey,
  deriveMissionTemplates,
  type MissionTemplateInput,
} from "@/lib/mission-templates";
import { getPlanningData } from "@/lib/planning/data";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  MissionStatus,
} from "@/lib/missions";
import {
  buildMissionWriteInput,
} from "@/lib/mission-input";

function errorRedirect(
  error: unknown,
): never {
  const message =
    error instanceof Error
      ? error.message
      : "Die Mission konnte nicht gespeichert werden.";

  redirect(
    `/mission?error=${encodeURIComponent(
      message,
    )}`,
  );
}

export async function createDerivedMission(
  formData: FormData,
) {
  try {
    const templateKey =
      formData.get("templateKey");

    if (
      typeof templateKey !== "string" ||
      templateKey.trim() === ""
    ) {
      throw new Error(
        "Die ausgewählte Untermission ist ungültig.",
      );
    }

    const planning =
      await getPlanningData();

    const targetDistanceKm =
      planning.profile.eventDistanceKm;

    if (
      targetDistanceKm === null ||
      targetDistanceKm <= 0
    ) {
      throw new Error(
        "Für Untermissionen muss zuerst eine gültige Zieldistanz festgelegt werden.",
      );
    }

    const templateInput: MissionTemplateInput =
      {
        sportType:
          planning.profile.primarySport ===
          "running"
            ? "running"
            : "cycling",
        targetDistanceKm,
        targetElevationMeters:
          planning.profile
            .eventElevationMeters,
      };

    const template =
      deriveMissionTemplates(
        templateInput,
      ).find(
        (item) =>
          item.key === templateKey,
      );

    if (!template) {
      throw new Error(
        "Diese Untermission ist für das aktuelle Hauptziel nicht verfügbar.",
      );
    }

    const derivedKey =
      buildMissionDerivedKey(
        templateInput,
        template.key,
      );

    const user = await requireUser();
    const supabase =
      await createClient();

    if (!supabase) {
      throw new Error(
        "Supabase ist nicht verfügbar.",
      );
    }

    const { error } = await supabase
      .from("missions")
      .insert({
        user_id: user.id,
        source: "derived",
        derived_key: derivedKey,
        title: template.title,
        description:
          template.description,
        sport_type:
          template.sportType,
        status: "draft",
        target_date: null,
        start_at: null,
        distance_km:
          template.distanceKm,
        elevation_meters:
          template.elevationMeters,
        average_speed_kmh:
          template.averageSpeedKmh,
        pace_seconds_per_km:
          template.paceSecondsPerKm,
        stop_interval_km:
          template.stopIntervalKm,
        stop_duration_minutes:
          template.stopDurationMinutes,
        carbohydrates_per_hour:
          template.carbohydratesPerHour,
        fluid_milliliters_per_hour:
          template.fluidMillilitersPerHour,
        sodium_milligrams_per_hour:
          template.sodiumMilligramsPerHour,
        updated_at:
          new Date().toISOString(),
      });

    if (
      error &&
      error.code !== "23505"
    ) {
      throw new Error(error.message);
    }
  } catch (error) {
    errorRedirect(error);
  }

  revalidatePath("/mission");

  redirect(
    "/mission?saved=derived",
  );
}

export async function setMissionStatus(
  formData: FormData,
) {
  try {
    const missionId =
      formData.get("missionId");

    const requestedStatus =
      formData.get("status");

    const allowedStatuses: MissionStatus[] =
      [
        "draft",
        "planned",
        "completed",
        "archived",
      ];

    if (
      typeof missionId !== "string" ||
      missionId.trim() === ""
    ) {
      throw new Error(
        "Die Mission ist ungültig.",
      );
    }

    if (
      typeof requestedStatus !==
        "string" ||
      !allowedStatuses.includes(
        requestedStatus as MissionStatus,
      )
    ) {
      throw new Error(
        "Der Missionsstatus ist ungültig.",
      );
    }

    const user = await requireUser();
    const supabase =
      await createClient();

    if (!supabase) {
      throw new Error(
        "Supabase ist nicht verfügbar.",
      );
    }

    const { data, error } =
      await supabase
        .from("missions")
        .update({
          status: requestedStatus,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", missionId)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error(
        "Die Mission wurde nicht gefunden.",
      );
    }
  } catch (error) {
    errorRedirect(error);
  }

  revalidatePath("/mission");

  redirect(
    "/mission?updated=status",
  );
}
function builderErrorRedirect(
  formData: FormData,
  error: unknown,
): never {
  const message =
    error instanceof Error
      ? error.message
      : "Die Mission konnte nicht gespeichert werden.";

  const parameters =
    new URLSearchParams();

  const missionId =
    formData.get("missionId");

  if (
    typeof missionId === "string" &&
    missionId.trim() !== ""
  ) {
    parameters.set(
      "id",
      missionId,
    );
  }

  parameters.set("error", message);

  redirect(
    `/mission/builder?${parameters.toString()}`,
  );
}

export async function saveMission(
  formData: FormData,
) {
  let savedMode:
    | "custom"
    | "updated" = "custom";

  try {
    const parsed =
      buildMissionWriteInput(formData);

    savedMode = parsed.missionId
      ? "updated"
      : "custom";

    const user = await requireUser();

    const supabase =
      await createClient();

    if (!supabase) {
      throw new Error(
        "Supabase ist nicht verfügbar.",
      );
    }

    const now =
      new Date().toISOString();

    if (parsed.missionId) {
      const { data, error } =
        await supabase
          .from("missions")
          .update({
            ...parsed.values,
            updated_at: now,
          })
          .eq(
            "id",
            parsed.missionId,
          )
          .eq("user_id", user.id)
          .select("id")
          .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (!data) {
        throw new Error(
          "Die Mission wurde nicht gefunden.",
        );
      }
    } else {
      const { error } =
        await supabase
          .from("missions")
          .insert({
            ...parsed.values,
            user_id: user.id,
            source: "custom",
            derived_key: null,
            status: "planned",
            updated_at: now,
          });

      if (error) {
        throw new Error(error.message);
      }
    }
  } catch (error) {
    builderErrorRedirect(
      formData,
      error,
    );
  }

  revalidatePath("/mission");

  redirect(
    `/mission?saved=${savedMode}`,
  );
}