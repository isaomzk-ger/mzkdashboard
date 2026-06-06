import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

// ログイン中ユーザーの profile を返す（未ログインなら null）
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (data as Profile) ?? null;
}

export function canManageOrganization(profile: Profile | null): boolean {
  return profile?.role === "admin" || profile?.role === "manager";
}
