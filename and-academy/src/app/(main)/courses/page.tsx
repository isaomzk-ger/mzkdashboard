import Link from "next/link";
import ProgressRing from "@/components/ProgressRing";
import { formatDate, todayInTokyo } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";
import type {
  Course,
  CourseDeadline,
  Lesson,
  LessonProgress,
} from "@/lib/types";

const audienceLabel: Record<string, string> = {
  executive: "経営者向け",
  employee: "従業員向け",
};

function formatPosition(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

export default async function CoursesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: courses }, { data: lessons }, { data: progress }] =
    await Promise.all([
      supabase
        .from("courses")
        .select("*")
        .eq("published", true)
        .order("sort_order"),
      supabase.from("lessons").select("*").order("sort_order"),
      supabase
        .from("lesson_progress")
        .select("*")
        .eq("user_id", user?.id ?? ""),
    ]);

  const { data: deadlines } = await supabase
    .from("course_deadlines")
    .select("*");

  const typedCourses = (courses as Course[] | null) ?? [];
  const publishedCourseIds = new Set(typedCourses.map((course) => course.id));
  const typedLessons = ((lessons as Lesson[] | null) ?? []).filter((lesson) =>
    publishedCourseIds.has(lesson.course_id),
  );
  const typedProgress = (progress as LessonProgress[] | null) ?? [];
  const completedIds = new Set(
    typedProgress.filter((item) => item.completed).map((item) => item.lesson_id),
  );
  const lessonsByCourse = new Map<string, Lesson[]>();
  typedLessons.forEach((lesson) => {
    const list = lessonsByCourse.get(lesson.course_id) ?? [];
    list.push(lesson);
    lessonsByCourse.set(lesson.course_id, list);
  });
  const courseById = new Map(typedCourses.map((course) => [course.id, course]));
  const deadlineByCourse = new Map(
    ((deadlines as CourseDeadline[] | null) ?? []).map((deadline) => [
      deadline.course_id,
      deadline.due_date,
    ]),
  );

  const nextLessons = typedCourses
    .map((course) => {
      const lesson = (lessonsByCourse.get(course.id) ?? []).find(
        (item) => !completedIds.has(item.id),
      );
      return lesson ? { course, lesson } : null;
    })
    .filter(
      (
        item,
      ): item is {
        course: Course;
        lesson: Lesson;
      } => Boolean(item),
    );

  const resumedLesson = typedProgress
    .filter(
      (item) =>
        !item.completed &&
        item.last_position_seconds > 0 &&
        typedLessons.some((lesson) => lesson.id === item.lesson_id),
    )
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )[0];
  const resumedLessonData = resumedLesson
    ? typedLessons.find((lesson) => lesson.id === resumedLesson.lesson_id)
    : null;
  const continueLesson = resumedLessonData ?? nextLessons[0]?.lesson ?? null;
  const continueCourse = continueLesson
    ? courseById.get(continueLesson.course_id)
    : null;
  const continuePosition =
    continueLesson && resumedLessonData?.id === continueLesson.id
      ? (resumedLesson?.last_position_seconds ?? 0)
      : 0;
  const today = todayInTokyo();

  return (
    <div>
      <h1 className="text-2xl font-bold">講座一覧</h1>
      <p className="mt-1 text-sm text-slate-500">
        次に取り組むレッスンから学習を進めましょう。
      </p>

      {continueLesson && continueCourse && (
        <section className="mt-6 border-y border-blue-200 bg-blue-50 px-5 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-brand">
                {continuePosition > 0 ? "続きから再開" : "次にやるレッスン"}
              </p>
              <h2 className="mt-1 font-semibold">{continueLesson.title}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {continueCourse.title}
                {continuePosition > 0 &&
                  ` ・ ${formatPosition(continuePosition)}から`}
              </p>
            </div>
            <Link
              href={`/learn/${continueLesson.id}`}
              className="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
            >
              学習を再開
            </Link>
          </div>
        </section>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {typedCourses.map((course) => {
          const courseLessons = lessonsByCourse.get(course.id) ?? [];
          const done = courseLessons.filter((lesson) =>
            completedIds.has(lesson.id),
          ).length;
          const total = courseLessons.length;
          const pct = total === 0 ? 0 : Math.round((done / total) * 100);
          const nextLesson = courseLessons.find(
            (lesson) => !completedIds.has(lesson.id),
          );
          const dueDate = deadlineByCourse.get(course.id) ?? null;
          const overdue = Boolean(dueDate) && dueDate! < today && pct < 100;

          return (
            <Link
              key={course.id}
              href={`/courses/${course.id}`}
              className="rounded-lg border border-slate-200 bg-white p-5 transition hover:border-brand hover:shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="inline-block rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-dark">
                  {audienceLabel[course.audience] ?? course.audience}
                </span>
                {dueDate && (
                  <span
                    className={`text-xs font-medium ${
                      overdue ? "text-red-600" : "text-slate-500"
                    }`}
                  >
                    締切 {formatDate(dueDate)}
                  </span>
                )}
              </div>
              <h2 className="mt-3 text-lg font-semibold">{course.title}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                {course.description}
              </p>

              <div className="mt-4 flex items-center gap-4 border-t border-slate-100 pt-4">
                <ProgressRing percentage={pct} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-700">
                    {done} / {total} レッスン完了
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                    {nextLesson
                      ? `次: ${nextLesson.title}`
                      : total > 0
                        ? "すべて完了しました"
                        : "レッスン準備中"}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}

        {typedCourses.length === 0 && (
          <p className="text-sm text-slate-500">
            公開中の講座がありません。
          </p>
        )}
      </div>
    </div>
  );
}
