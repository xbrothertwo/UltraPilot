import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "./config";
import { createClient } from "./server";

export type AuthenticatedUser = {
  id: string;
  email: string | null;
};

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return {
    id: data.claims.sub,
    email: typeof data.claims.email === "string" ? data.claims.email : null,
  };
}

export async function requireUser(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
