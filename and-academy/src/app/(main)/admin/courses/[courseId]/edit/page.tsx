import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import CourseForm from "@/components/CourseForm";
import type { Course, Lesson } from "@/lib/types";
import {
  updateCourse,
  deleteCourse,
  createLesson,
  updateLesson,
  deleteLesson,
} from "../../../actions";

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/courses");

  const supabase = await createClient();
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

  const typedCourse = course as Course;
  const typedLessons = (lessons as Lesson[] | null) ?? [];

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/courses"
        className="text-sm text-brand hover:underline"
      >
        ← 講座の管理
      </Link>
      <h1 className="mt-2 text-2xl font-bold">講座を編集</h1>

      {/* 講座情報 */}
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">講座情報</h2>
        <CourseForm
          action={updateCourse.bind(null, courseId)}
          course={typedCourse}
          submitLabel="講座を保存"
        />
      </section>

      {/* レッスン一覧 */}
      <section className="mt-8">
        <h2 className="text-lg font-bold">レッスン（{typedLessons.length}）</h2>
        <div className="mt-3 space-y-3">
          {typedLessons.map((lesson) => (
            <details
              key={lesson.id}
              className="rounded-xl border border-slate-200 bg-white"
            >
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-3 text-sm">
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                  {lesson.sort_order}
                </span>
                <span className="flex-1 font-medium">{lesson.title}</span>
                <span className="text-xs text-slate-400">編集 ▾</span>
              </summary>
              <div className="border-t border-slate-100 px-5 py-4">
                <LessonFields
                  action={updateLesson.bind(null, lesson.id, courseId)}
                  lesson={lesson}
                  submitLabel="保存"
                />
                <form
                  action={deleteLesson.bind(null, lesson.id, courseId)}
                  className="mt-3"
                >
                  <button
                    type="submit"
                    className="text-xs text-red-600 hover:underline"
                  >
                    このレッスンを削除
                  </button>
                </form>
              </div>
            </details>
          ))}
          {typedLessons.length === 0 && (
            <p className="text-sm text-slate-500">
              レッスンがまだありません。下から追加してください。
            </p>
          )}
        </div>

        {/* レッスン追加 */}
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-6">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">
            レッスンを追加
          </h3>
          <LessonFields
            action={createLesson.bind(null, courseId)}
            submitLabel="追加する"
          />
        </div>
      </section>

      {/* 削除 */}
      <section className="mt-10 rounded-xl border border-red-200 bg-red-50 p-6">
        <h2 className="text-sm font-semibold text-red-800">講座を削除</h2>
        <p className="mt-1 text-xs text-red-700">
          講座とすべてのレッスン・進捗が削除されます。元に戻せません。
        </p>
        <form action={deleteCourse.bind(null, courseId)} className="mt-3">
          <button
            type="submit"
            className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            この講座を削除する
          </button>
        </form>
      </section>
    </div>
  );
}

// レッスンの入力欄（追加・編集で共用）
function LessonFields({
  action,
  lesson,
  submitLabel,
}: {
  action: (formData: FormData) => void;
  lesson?: Lesson;
  submitLabel: string;
}) {
  return (
    <form action={action} className="space-y-3">
      <input
        name="title"
        required
        placeholder="レッスンタイトル"
        defaultValue={lesson?.title ?? ""}
        className="input"
      />
      <input
        name="video_url"
        type="url"
        placeholder="動画URL（YouTube / Vimeo）"
        defaultValue={lesson?.video_url ?? ""}
        className="input"
      />
      <p className="text-xs text-slate-500">
        Vimeoは埋め込み可能ドメインを and-academy-jp.vercel.app
        に制限してください。
      </p>
      <textarea
        name="description"
        rows={2}
        placeholder="説明（任意）"
        defaultValue={lesson?.description ?? ""}
        className="input"
      />
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">
            再生時間（秒）
          </span>
          <input
            name="duration_seconds"
            type="number"
            defaultValue={lesson?.duration_seconds ?? ""}
            className="input"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">表示順</span>
          <input
            name="sort_order"
            type="number"
            defaultValue={lesson?.sort_order ?? 0}
            className="input"
          />
        </label>
      </div>
      <button
        type="submit"
        className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
      >
        {submitLabel}
      </button>
    </form>
  );
}
