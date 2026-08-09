import { NextResponse, type NextRequest } from "next/server";
import { createAccountExportResponse, createSupabaseExportSource } from "@/lib/account-export/export";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Datenexport ist derzeit nicht verfügbar." }, { status: 503 });
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const userId = claims?.sub;
  if (error || typeof userId !== "string") {
    return NextResponse.json({ error: "Bitte melde dich an, um deine Daten zu exportieren." }, { status: 401 });
  }
  const email = claims && typeof claims.email === "string" ? claims.email : null;
  return createAccountExportResponse(createSupabaseExportSource(supabase), { id: userId, email }, {
    signal: request.signal,
  });
}
