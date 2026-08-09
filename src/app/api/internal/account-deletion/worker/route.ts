import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processAccountDeletionJob } from "@/lib/account-deletion";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_JOBS_PER_INVOCATION = 3;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(authorization.slice(7), "utf8");
  const expected = Buffer.from(secret, "utf8");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== "production") return response({ ok: false }, 404);
  if (!authorized(request)) return response({ ok: false }, 401);
  const admin = createAdminClient();
  if (!admin) return response({ ok: false }, 503);

  let completed = 0;
  let failed = 0;
  for (let index = 0; index < MAX_JOBS_PER_INVOCATION; index += 1) {
    const result = await processAccountDeletionJob(admin);
    if (result.outcome === "not_found") break;
    if (result.outcome === "completed") completed += 1;
    else failed += 1;
  }
  return response({ ok: failed === 0, processed: completed + failed, completed, failed });
}
