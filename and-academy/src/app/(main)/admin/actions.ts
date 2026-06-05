"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

// 管理者以外は弾く
async function requireAdmin() {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") redirect("/courses");
}

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}
function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = str(v);
  return s === "" ? null : s;
}
function num(v: FormDataEntryValue | null): number {
  const n = Number(str(v));
  return Number.isFinite(n) ? n : 0;
}

// ---- 講座 ----
export async function createCourse(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .insert({
      title: str(formData.get("title")),
      description: strOrNull(formData.get("description")),
      audience: str(formData.get("audience")) || "employee",
      sort_order: num(formData.get("sort_order")),
      thumbnail_url: strOrNull(formData.get("thumbnail_url")),
      published: formData.get("published") === "on",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/admin/courses");
  redirect(`/admin/courses/${data.id}/edit`);
}

export async function updateCourse(courseId: string, formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("courses")
    .update({
      title: str(formData.get("title")),
      description: strOrNull(formData.get("description")),
      audience: str(formData.get("audience")) || "employee",
      sort_order: num(formData.get("sort_order")),
      thumbnail_url: strOrNull(formData.get("thumbnail_url")),
      published: formData.get("published") === "on",
    })
    .eq("id", courseId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${courseId}/edit`);
}

export async function deleteCourse(courseId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("courses").delete().eq("id", courseId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/courses");
  redirect("/admin/courses");
}

// ---- レッスン ----
export async function createLesson(courseId: string, formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("lessons").insert({
    course_id: courseId,
    title: str(formData.get("title")),
    description: strOrNull(formData.get("description")),
    video_url: strOrNull(formData.get("video_url")),
    duration_seconds: num(formData.get("duration_seconds")) || null,
    sort_order: num(formData.get("sort_order")),
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/courses/${courseId}/edit`);
}

export async function updateLesson(
  lessonId: string,
  courseId: string,
  formData: FormData,
) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("lessons")
    .update({
      title: str(formData.get("title")),
      description: strOrNull(formData.get("description")),
      video_url: strOrNull(formData.get("video_url")),
      duration_seconds: num(formData.get("duration_seconds")) || null,
      sort_order: num(formData.get("sort_order")),
    })
    .eq("id", lessonId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/courses/${courseId}/edit`);
}

export async function deleteLesson(lessonId: string, courseId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("lessons").delete().eq("id", lessonId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/courses/${courseId}/edit`);
}
