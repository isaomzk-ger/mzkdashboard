"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// サインアウト
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// レッスンの完了状態をトグルして進捗を保存
export async function toggleLessonComplete(
  lessonId: string,
  completed: boolean,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("lesson_progress")
    .select("id")
    .eq("user_id", user.id)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("lesson_progress")
      .update({
        completed,
        completed_at: completed ? now : null,
        updated_at: now,
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("lesson_progress").insert({
      user_id: user.id,
      lesson_id: lessonId,
      completed,
      completed_at: completed ? now : null,
      updated_at: now,
    });
  }

  revalidatePath("/courses");
  revalidatePath(`/learn/${lessonId}`);
}
