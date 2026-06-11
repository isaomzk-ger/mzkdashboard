import Link from "next/link";
import { notFound } from "next/navigation";
import ProgressRing from "@/components/ProgressRing";
import { createClient } from "@/lib/supabase/server";
import { computeUnlocked } from "@/lib/progress";
import { formatDate, todayInTokyo } from "@/lib/date";
import type {
  Course,
  CourseDeadline,
  Lesson,
  LessonProgress,
} from "@/lib/types";

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
    .select("lesson_id, completed, last_position_seconds")
    .eq("user_id", user?.id ?? "");

  const { data: deadline } = await supabase
    .from("course_deadlines")
    .select("*")
    .eq("user_id", user?.id ?? "")
    .eq("course_id", courseId)
    .maybeSingle();

  const completedIds = new Set(
    (
      progress as Pick<LessonProgress, "lesson_id" | "completed">[] | null
    )
      ?.filter((p) => p.completed)
      .map((p) => p.lesson_id),
  );
  const progressByLesson = new Map(
    (
      progress as Pick<
        LessonProgress,
        "lesson_id" | "completed" | "last_position_seconds"
      >[] | null
    )?.map((item) => [item.lesson_id, item]) ?? [],
  );

  const typedCourse = course as Course;
  const typedLessons = (lessons as Lesson[] | null) ?? [];
  const unlockedIds = computeUnlocked(
    typedLessons.map((l) => l.id),
    completedIds,
  );
  const nextLesson = typedLessons.find((lesson) => !completedIds.has(lesson.id));
  const completedCount = typedLessons.filter((lesson) =>
    completedIds.has(lesson.id),
  ).length;
  const percentage =
    typedLessons.length === 0
      ? 0
      : Math.round((completedCount / typedLessons.length) * 100);
  const dueDate = (deadline as CourseDeadline | null)?.due_date ?? null;
  const overdue =
    Boolean(dueDate) &&
    dueDate! < todayInTokyo() &&
    completedIds.size < typedLessons.length;

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

      <section className="mt-5 border-y border-slate-200 bg-white px-5 py-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full items-center gap-5 sm:gap-8">
            <ProgressRing percentage={percentage} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-500">講座の進捗</p>
              <p className="mt-1 text-xl font-bold">
                {completedCount} / {typedLessons.length}
                <span className="ml-2 text-sm font-normal text-slate-500">
                  レッスン完了
                </span>
              </p>
              <div className="mt-4">
                <p className="text-xs text-slate-500">次にやるレッスン</p>
                <p className="mt-1 text-sm font-medium">
                  {nextLesson?.title ?? "すべて完了しました"}
                </p>
              </div>
            </div>
          </div>
          {dueDate && (
            <p
              className={`shrink-0 text-sm font-medium ${
                overdue ? "text-red-600" : "text-slate-600"
              }`}
            >
              {overdue ? "期限超過" : "締切"} {formatDate(dueDate)}
            </p>
          )}
        </div>
      </section>

      <ol className="mt-6 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {typedLessons.map((lesson, i) => {
          const done = completedIds.has(lesson.id);
          const locked = !unlockedIds.has(lesson.id);
          const lessonProgress = progressByLesson.get(lesson.id);
          const isNext = nextLesson?.id === lesson.id;

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
                {isNext && (
                  <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                    次に受講
                  </span>
                )}
              </span>
              <span className="text-xs text-slate-400">
                {locked
                  ? "前のレッスンを完了"
                  : lessonProgress &&
                      !lessonProgress.completed &&
                      lessonProgress.last_position_seconds > 0
                    ? `${formatDuration(lessonProgress.last_position_seconds)}から再開`
                    : formatDuration(lesson.duration_seconds)}
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
