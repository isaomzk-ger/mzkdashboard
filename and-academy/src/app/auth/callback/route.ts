import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Google OAuth のコールバック。認可コードをセッションに交換する。
// 許可リスト外のメールはトリガーで登録が拒否されるため、ここで失敗 → /login?error=denied
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect") || "/courses";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: profile } = user
        ? await supabase
            .from("profiles")
            .select("active")
            .eq("id", user.id)
            .maybeSingle()
        : { data: null };

      if (profile?.active !== false) {
        return NextResponse.redirect(`${origin}${redirect}`);
      }

      await supabase.auth.signOut();
    }
  }

  return NextResponse.redirect(`${origin}/login?error=denied`);
}
