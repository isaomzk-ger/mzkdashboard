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
      return NextResponse.redirect(`${origin}${redirect}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=denied`);
}
