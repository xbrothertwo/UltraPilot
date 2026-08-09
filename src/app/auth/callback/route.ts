import { NextResponse, type NextRequest } from "next/server";
import { safeInternalRedirect } from "@/lib/auth/recovery";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const requestedNext = request.nextUrl.searchParams.get("next");
  const next = safeInternalRedirect(requestedNext);
  const isRecovery = next === "/auth/reset-password" && requestedNext === next;
  if (code) {
    const supabase = await createClient();
    const { error } = supabase ? await supabase.auth.exchangeCodeForSession(code) : { error: new Error("Supabase ist nicht konfiguriert.") };
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  if (isRecovery) {
    return NextResponse.redirect(new URL("/auth/forgot-password?error=Der Recovery-Link ist ungültig oder abgelaufen. Bitte fordere eine neue Reset-Mail an.", request.url));
  }
  return NextResponse.redirect(new URL("/login?error=confirmation-link-invalid", request.url));
}
