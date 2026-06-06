import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeUnlocked } from "@/lib/progress";
import CompleteButton from "@/components/CompleteButton";
import VideoPlayer from "@/components/VideoPlayer";
import type { Lesson, LessonProgress } from "@/lib/types";

export default async function LearnPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("*")
    .eq("id", lessonId)
    .single();

  if (!lesson) notFound();
  const typedLesson = lesson as Lesson;

  // 同じ講座のレッスンと進捗を取得し、視聴順序の解放状態を判定する
  const { data: courseLessons } = await supabase
    .from("lessons")
    .select("id, title")
    .eq("course_id", typedLesson.course_id)
    .order("sort_order");

  const { data: allProgress } = await supabase
    .from("lesson_progress")
    .select("lesson_id, completed, last_position_seconds")
    .eq("user_id", user?.id ?? "");

  const orderedIds =
    (courseLessons as Pick<Lesson, "id">[] | null)?.map((l) => l.id) ?? [];
  const completedIds = new Set(
    (
      allProgress as Pick<LessonProgress, "lesson_id" | "completed">[] | null
    )
      ?.filter((p) => p.completed)
      .map((p) => p.lesson_id),
  );
  const unlockedIds = computeUnlocked(orderedIds, completedIds);

  // ロック中のレッスンに直接アクセスした場合は視聴させない
  if (!unlockedIds.has(lessonId)) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center">
        <div className="text-3xl">🔒</div>
        <h1 className="mt-3 text-lg font-bold">まだ受講できません</h1>
        <p className="mt-2 text-sm text-slate-500">
          このレッスンは、前のレッスンを完了すると解放されます。
        </p>
        <Link
          href={`/courses/${typedLesson.course_id}`}
          className="mt-5 inline-block rounded-md bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          講座に戻る
        </Link>
      </div>
    );
  }

  const isCompleted = completedIds.has(lessonId);
  // 次のレッスン（完了後の導線用）
  const currentIndex = orderedIds.indexOf(lessonId);
  const nextLessonId =
    currentIndex >= 0 && currentIndex < orderedIds.length - 1
      ? orderedIds[currentIndex + 1]
      : null;
  const nextLesson = (
    courseLessons as Pick<Lesson, "id" | "title">[] | null
  )?.find((lesson) => lesson.id === nextLessonId);
  const currentProgress = (
    allProgress as Pick<
      LessonProgress,
      "lesson_id" | "completed" | "last_position_seconds"
    >[] | null
  )?.find((item) => item.lesson_id === lessonId);
  const initialPosition = isCompleted
    ? 0
    : (currentProgress?.last_position_seconds ?? 0);

  return (
    <div>
      <Link
        href={`/courses/${typedLesson.course_id}`}
        className="text-sm text-brand hover:underline"
      >
        ← 講座に戻る
      </Link>

      <h1 className="mt-2 text-2xl font-bold">{typedLesson.title}</h1>
      {nextLesson && (
        <p className="mt-1 text-sm text-slate-500">
          次: {nextLesson.title}
        </p>
      )}

      <div className="mt-4 aspect-video w-full overflow-hidden rounded-xl bg-black">
        {typedLesson.video_url ? (
          <VideoPlayer
            lessonId={typedLesson.id}
            videoUrl={typedLesson.video_url}
            initialPosition={initialPosition}
            watermarkText={user?.email ?? "受講者"}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            動画が設定されていません
          </div>
        )}
      </div>

      {typedLesson.description && (
        <p className="mt-4 text-sm text-slate-600">{typedLesson.description}</p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <CompleteButton
          lessonId={typedLesson.id}
          initialCompleted={isCompleted}
        />
        {isCompleted && nextLessonId && (
          <Link
            href={`/learn/${nextLessonId}`}
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-brand-50"
          >
            次のレッスンへ
          </Link>
        )}
      </div>
    </div>
  );
}
