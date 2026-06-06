import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    lessonId?: unknown;
    positionSeconds?: unknown;
  } | null;
  const lessonId =
    typeof body?.lessonId === "string" ? body.lessonId : "";
  const rawPosition =
    typeof body?.positionSeconds === "number"
      ? body.positionSeconds
      : Number.NaN;
  if (!lessonId || !Number.isFinite(rawPosition)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const positionSeconds = Math.max(
    0,
    Math.min(Math.round(rawPosition), 24 * 60 * 60),
  );
  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("lesson_progress")
    .select("id")
    .eq("user_id", user.id)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  const result = existing
    ? await supabase
        .from("lesson_progress")
        .update({
          last_position_seconds: positionSeconds,
          updated_at: now,
        })
        .eq("id", existing.id)
    : await supabase.from("lesson_progress").insert({
        user_id: user.id,
        lesson_id: lessonId,
        last_position_seconds: positionSeconds,
        updated_at: now,
      });

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
