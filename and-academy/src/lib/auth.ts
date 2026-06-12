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

  const profile = (data as Profile) ?? null;
  return profile?.active === false ? null : profile;
}

export function canManageOrganization(profile: Profile | null): boolean {
  return profile?.role === "admin" || profile?.role === "manager";
}

export function canViewOrganizationProgress(profile: Profile | null): boolean {
  return Boolean(profile?.org_id);
}
