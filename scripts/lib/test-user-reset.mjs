export const ACTIVITY_STORAGE_BUCKET = "activity-files";

// Child-first order. The explicit list makes schema drift visible in tests and
// avoids relying on auth.users cascades, because the auth identity is retained.
export const TEST_USER_RESET_TABLES = Object.freeze([
  { table: "gym_sets", ownerField: "user_id" },
  { table: "gym_session_exercises", ownerField: "user_id" },
  { table: "gym_sessions", ownerField: "user_id" },
  { table: "gym_program_exercises", ownerField: "user_id" },
  { table: "planned_workouts", ownerField: "user_id" },
  { table: "gym_program_days", ownerField: "user_id" },
  { table: "gym_programs", ownerField: "user_id" },
  { table: "gym_exercise_favorites", ownerField: "user_id" },
  { table: "gym_exercises", ownerField: "owner_id" },
  { table: "training_plan_generations", ownerField: "user_id" },
  { table: "training_block_weeks", ownerField: "user_id" },
  { table: "training_blocks", ownerField: "user_id" },
  { table: "nutrition_entries", ownerField: "user_id" },
  { table: "nutrition_bottle_plans", ownerField: "user_id" },
  { table: "activity_streams", ownerField: "user_id" },
  { table: "activity_metrics", ownerField: "user_id" },
  { table: "subjective_feedback", ownerField: "user_id" },
  { table: "ai_analyses", ownerField: "user_id" },
  { table: "activity_files", ownerField: "user_id" },
  { table: "activities", ownerField: "user_id" },
  { table: "nutrition_products", ownerField: "user_id" },
  { table: "nutrition_bottle_presets", ownerField: "user_id" },
  { table: "calendar_events", ownerField: "user_id" },
  { table: "missions", ownerField: "user_id" },
  { table: "apple_health_daily_metrics", ownerField: "user_id" },
  { table: "daily_readiness_checkins", ownerField: "user_id" },
  { table: "health_shortcut_tokens", ownerField: "user_id" },
  { table: "schedule_code_mappings", ownerField: "user_id" },
  { table: "training_goals", ownerField: "user_id" },
  { table: "training_preferences", ownerField: "user_id" },
]);

export function normalizeResetEmail(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("Eine explizite E-Mail ist erforderlich (--email).");
  }
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Die angegebene E-Mail ist ungültig.");
  }
  return email;
}

export function isRecognizedTestEmail(email) {
  const [localPart, domain] = email.toLowerCase().split("@");
  return (
    domain === "example.com" ||
    domain === "example.test" ||
    domain.endsWith(".test") ||
    localPart.includes("+test") ||
    /^(test|qa|e2e|customer-journey)[+._-]/.test(localPart)
  );
}

export function parseResetArguments(argv) {
  let email = null;
  let apply = false;
  let confirmTestAccount = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--email") {
      email = argv[index + 1] ?? null;
      index += 1;
    } else if (argument === "--apply") {
      apply = true;
    } else if (argument === "--confirm-test-account") {
      confirmTestAccount = true;
    } else {
      throw new Error(`Unbekanntes Argument: ${argument}`);
    }
  }

  return {
    email: normalizeResetEmail(email),
    apply,
    confirmTestAccount,
  };
}

function authSnapshot(user) {
  return {
    id: user.id,
    email: user.email?.toLowerCase() ?? null,
    emailConfirmedAt: user.email_confirmed_at ?? null,
  };
}

function assertAuthUnchanged(before, after) {
  const next = authSnapshot(after);
  if (
    next.id !== before.id ||
    next.email !== before.email ||
    next.emailConfirmedAt !== before.emailConfirmedAt
  ) {
    throw new Error("Auth-Identität oder E-Mail-Bestätigung wurde unerwartet verändert.");
  }
}

export async function resetTestUser({
  backend,
  email: rawEmail,
  apply = false,
  confirmTestAccount = false,
  log = () => {},
}) {
  const email = normalizeResetEmail(rawEmail);
  const matches = await backend.findAuthUsersByEmail(email);
  if (matches.length === 0) throw new Error(`Kein Auth-User für ${email} gefunden.`);
  if (matches.length !== 1) throw new Error(`Unerwartet ${matches.length} Auth-User für ${email} gefunden.`);

  const user = matches[0];
  const beforeAuth = authSnapshot(user);
  if (!beforeAuth.emailConfirmedAt) {
    throw new Error("Der Testaccount ist noch nicht per E-Mail bestätigt.");
  }
  if (apply && !isRecognizedTestEmail(email) && !confirmTestAccount) {
    throw new Error("Apply ist nur für klar erkennbare Testaccounts oder mit --confirm-test-account erlaubt.");
  }

  const deletionJobs = await backend.findAccountDeletionJobs(user.id);
  if (deletionJobs.length > 0) {
    throw new Error("Für diesen User existiert ein Account-Deletion-Job. Reset wurde zum Schutz des Auth-Accounts abgebrochen.");
  }

  const globalExerciseSummaryBefore = await backend.getGlobalExerciseSummary();
  const storagePaths = await backend.listOwnedStoragePaths(user.id);
  const rows = [];
  for (const target of TEST_USER_RESET_TABLES) {
    rows.push({ ...target, count: await backend.countOwnedRows(target, user.id) });
  }

  log(`Testaccount: ${email}`);
  log(`User ID: ${user.id}`);
  log(`Modus: ${apply ? "APPLY" : "DRY RUN"}`);
  log(`Storage-Dateien: ${storagePaths.length}`);
  for (const row of rows.filter((item) => item.count > 0)) {
    log(`${row.table}: ${row.count}`);
  }

  if (!apply) {
    log("Dry Run abgeschlossen. Es wurden keine Daten verändert.");
    return { applied: false, userId: user.id, email, rows, storagePathCount: storagePaths.length };
  }

  if (storagePaths.length > 0) await backend.removeOwnedStoragePaths(storagePaths);
  for (const target of TEST_USER_RESET_TABLES) {
    await backend.deleteOwnedRows(target, user.id);
  }
  await backend.resetProfile(user);

  for (const target of TEST_USER_RESET_TABLES) {
    const remaining = await backend.countOwnedRows(target, user.id);
    if (remaining !== 0) throw new Error(`Verifikation fehlgeschlagen: ${target.table} enthält noch ${remaining} Zeilen.`);
  }
  if ((await backend.listOwnedStoragePaths(user.id)).length !== 0) {
    throw new Error("Verifikation fehlgeschlagen: Activity-Storage ist nicht leer.");
  }

  const profile = await backend.getProfile(user.id);
  if (!profile || profile.onboarding_completed_at !== null) {
    throw new Error("Verifikation fehlgeschlagen: Onboarding ist nicht wieder geöffnet.");
  }
  const afterAuth = await backend.getAuthUserById(user.id);
  if (!afterAuth) throw new Error("Verifikation fehlgeschlagen: Auth-User existiert nicht mehr.");
  assertAuthUnchanged(beforeAuth, afterAuth);

  const globalExerciseSummaryAfter = await backend.getGlobalExerciseSummary();
  if (
    globalExerciseSummaryAfter.total !== globalExerciseSummaryBefore.total ||
    globalExerciseSummaryAfter.active !== globalExerciseSummaryBefore.active
  ) {
    throw new Error("Verifikation fehlgeschlagen: Die globale Exercise Library wurde verändert.");
  }

  log("Reset und Verifikation erfolgreich. Derselbe Login kann erneut für /onboarding verwendet werden.");
  return { applied: true, userId: user.id, email, rows, storagePathCount: storagePaths.length };
}
