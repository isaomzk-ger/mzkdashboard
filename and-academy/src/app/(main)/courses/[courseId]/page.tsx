import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeUnlocked } from "@/lib/progress";
import type { Course, Lesson, LessonProgress } from "@/lib/types";

function formatDuration(sec: number | null): string {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single();

  if (!course) notFound();

  const { data: lessons } = await supabase
    .from("lessons")
    .select("*")
    .eq("course_id", courseId)
    .order("sort_order");

  const { data: progress } = await supabase
    .from("lesson_progress")
    .select("lesson_id, completed")
    .eq("user_id", user?.id ?? "")
    .eq("completed", true);

  const completedIds = new Set(
    (progress as Pick<LessonProgress, "lesson_id">[] | null)?.map(
      (p) => p.lesson_id,
    ),
  );

  const typedCourse = course as Course;
  const typedLessons = (lessons as Lesson[] | null) ?? [];
  const unlockedIds = computeUnlocked(
    typedLessons.map((l) => l.id),
    completedIds,
  );

  return (
    <div>
      <Link
        href="/courses"
        className="text-sm text-brand hover:underline"
      >
        ← 講座一覧
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{typedCourse.title}</h1>
      <p className="mt-1 text-sm text-slate-500">{typedCourse.description}</p>

      <ol className="mt-6 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {typedLessons.map((lesson, i) => {
          const done = completedIds.has(lesson.id);
          const locked = !unlockedIds.has(lesson.id);

          const inner = (
            <>
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                  done
                    ? "bg-green-100 text-green-700"
                    : locked
                      ? "bg-slate-100 text-slate-300"
                      : "bg-slate-100 text-slate-500"
                }`}
              >
                {done ? "✓" : locked ? "🔒" : i + 1}
              </span>
              <span
                className={`flex-1 text-sm font-medium ${
                  locked ? "text-slate-400" : ""
                }`}
              >
                {lesson.title}
              </span>
              <span className="text-xs text-slate-400">
                {locked ? "前のレッスンを完了" : formatDuration(lesson.duration_seconds)}
              </span>
            </>
          );

          return (
            <li key={lesson.id}>
              {locked ? (
                <div className="flex cursor-not-allowed items-center gap-4 px-5 py-4">
                  {inner}
                </div>
              ) : (
                <Link
                  href={`/learn/${lesson.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-brand-50"
                >
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
        {typedLessons.length === 0 && (
          <li className="px-5 py-4 text-sm text-slate-500">
            レッスンがまだありません。
          </li>
        )}
      </ol>
    </div>
  );
}
