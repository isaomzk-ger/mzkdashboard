"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canManageOrganization, getProfile } from "@/lib/auth";
import { validateVideoUrl } from "@/lib/video";

// 管理者以外は弾く
async function requireAdmin() {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") redirect("/courses");
}

async function requireOrganizationManager() {
  const profile = await getProfile();
  if (!canManageOrganization(profile) || !profile?.org_id) redirect("/courses");
  return profile;
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
  const videoUrl = strOrNull(formData.get("video_url"));
  const videoError = validateVideoUrl(videoUrl);
  if (videoError) throw new Error(videoError);
  const supabase = await createClient();
  const { error } = await supabase.from("lessons").insert({
    course_id: courseId,
    title: str(formData.get("title")),
    description: strOrNull(formData.get("description")),
    video_url: videoUrl,
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
  const videoUrl = strOrNull(formData.get("video_url"));
  const videoError = validateVideoUrl(videoUrl);
  if (videoError) throw new Error(videoError);
  const supabase = await createClient();
  const { error } = await supabase
    .from("lessons")
    .update({
      title: str(formData.get("title")),
      description: strOrNull(formData.get("description")),
      video_url: videoUrl,
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

// ---- 組織ごとの講座締切 ----
export async function setCourseDeadline(courseId: string, formData: FormData) {
  const profile = await requireOrganizationManager();
  const dueDate = str(formData.get("due_date"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    throw new Error("締切日を入力してください。");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("course_deadlines").upsert(
    {
      org_id: profile.org_id,
      course_id: courseId,
      due_date: dueDate,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id,course_id" },
  );
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
  revalidatePath("/admin/deadlines");
  revalidatePath("/courses");
  revalidatePath(`/courses/${courseId}`);
}

export async function removeCourseDeadline(courseId: string) {
  const profile = await requireOrganizationManager();
  const supabase = await createClient();
  const { error } = await supabase
    .from("course_deadlines")
    .delete()
    .eq("org_id", profile.org_id)
    .eq("course_id", courseId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
  revalidatePath("/admin/deadlines");
  revalidatePath("/courses");
  revalidatePath(`/courses/${courseId}`);
}

// ---- 組織ごとの講座割り当て ----
export async function updateOrganizationCourses(
  organizationId: string,
  formData: FormData,
) {
  await requireAdmin();
  const accessEnabled = formData.get("access_enabled") === "on";
  const courseIds = formData
    .getAll("course_ids")
    .filter((value): value is string => typeof value === "string");

  const supabase = await createClient();
  const { error: organizationError } = await supabase
    .from("organizations")
    .update({ access_enabled: accessEnabled })
    .eq("id", organizationId);
  if (organizationError) throw new Error(organizationError.message);

  const { error } = await supabase.rpc("set_organization_courses", {
    target_org_id: organizationId,
    target_course_ids: courseIds,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/organizations");
  revalidatePath("/admin");
  revalidatePath("/courses");
}
