import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Course, Lesson, LessonProgress } from "@/lib/types";

const audienceLabel: Record<string, string> = {
  executive: "経営者向け",
  employee: "従業員向け",
};

export default async function CoursesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: courses } = await supabase
    .from("courses")
    .select("*")
    .eq("published", true)
    .order("sort_order");

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, course_id");

  const { data: progress } = await supabase
    .from("lesson_progress")
    .select("lesson_id, completed")
    .eq("user_id", user?.id ?? "")
    .eq("completed", true);

  const lessonsByCourse = new Map<string, string[]>();
  (lessons as Pick<Lesson, "id" | "course_id">[] | null)?.forEach((l) => {
    const arr = lessonsByCourse.get(l.course_id) ?? [];
    arr.push(l.id);
    lessonsByCourse.set(l.course_id, arr);
  });

  const completedIds = new Set(
    (progress as Pick<LessonProgress, "lesson_id">[] | null)?.map(
      (p) => p.lesson_id,
    ),
  );

  return (
    <div>
      <h1 className="text-2xl font-bold">講座一覧</h1>
      <p className="mt-1 text-sm text-slate-500">
        受講したい講座を選んで学習を始めましょう。
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {(courses as Course[] | null)?.map((course) => {
          const lessonIds = lessonsByCourse.get(course.id) ?? [];
          const total = lessonIds.length;
          const done = lessonIds.filter((id) => completedIds.has(id)).length;
          const pct = total === 0 ? 0 : Math.round((done / total) * 100);

          return (
            <Link
              key={course.id}
              href={`/courses/${course.id}`}
              className="rounded-xl border border-slate-200 bg-white p-5 transition hover:shadow-md"
            >
              <span className="inline-block rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-dark">
                {audienceLabel[course.audience] ?? course.audience}
              </span>
              <h2 className="mt-3 text-lg font-semibold">{course.title}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                {course.description}
              </p>

              <div className="mt-4">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>
                    {done} / {total} レッスン完了
                  </span>
                  <span>{pct}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </Link>
          );
        })}

        {(!courses || courses.length === 0) && (
          <p className="text-sm text-slate-500">
            公開中の講座がありません。Supabase に講座データを登録してください。
          </p>
        )}
      </div>
    </div>
  );
}
