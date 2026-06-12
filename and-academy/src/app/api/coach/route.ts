import type Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, COACH_MODEL } from "@/lib/ai/client";
import { LESSON_META } from "@/lib/ai/lessonMeta";
import { buildCoachSystemPrompt, type CoachProgress } from "@/lib/ai/coachPrompt";

export const runtime = "nodejs";
export const maxDuration = 30;

type IncomingMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("unauthorized", { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    lessonId?: unknown;
    messages?: unknown;
  } | null;

  const lessonId = typeof body?.lessonId === "string" ? body.lessonId : "";
  if (!lessonId) {
    return new Response("invalid_request", { status: 400 });
  }

  // 受信した会話履歴を検証・整形（直近24件、各8000文字まで）
  const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
  const messages: Anthropic.MessageParam[] = [];
  for (const item of rawMessages.slice(-24)) {
    if (!item || typeof item !== "object") continue;
    const { role, content } = item as IncomingMessage;
    if ((role === "user" || role === "assistant") && typeof content === "string") {
      const text = content.trim().slice(0, 8000);
      if (text) messages.push({ role, content: text });
    }
  }
  // 先頭は必ず user から始める
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length) {
    return new Response("invalid_request", { status: 400 });
  }

  // レッスン取得（RLS が効くため、契約外の組織ユーザーには null が返る → 404）
  const { data: lesson } = await supabase
    .from("lessons")
    .select("title, sort_order, course_id")
    .eq("id", lessonId)
    .single();
  if (!lesson) {
    return new Response("not_found", { status: 404 });
  }
  const lessonRow = lesson as {
    title: string;
    sort_order: number;
    course_id: string;
  };

  // 講座全体の進捗（完走の伴走に使う文脈）
  const { data: courseLessons } = await supabase
    .from("lessons")
    .select("id, title, sort_order")
    .eq("course_id", lessonRow.course_id)
    .order("sort_order");
  const { data: progressRows } = await supabase
    .from("lesson_progress")
    .select("lesson_id, completed")
    .eq("user_id", user.id);

  const lessonsList =
    (courseLessons as { id: string; title: string; sort_order: number }[] | null) ??
    [];
  const completedSet = new Set(
    ((progressRows as { lesson_id: string; completed: boolean }[] | null) ?? [])
      .filter((p) => p.completed)
      .map((p) => p.lesson_id),
  );
  const completedCount = lessonsList.filter((l) => completedSet.has(l.id)).length;
  const currentIndex = lessonsList.findIndex(
    (l) => l.sort_order === lessonRow.sort_order,
  );
  const nextLessonTitle =
    currentIndex >= 0 && currentIndex < lessonsList.length - 1
      ? lessonsList[currentIndex + 1].title
      : null;

  const progress: CoachProgress = {
    lessonNumber: lessonRow.sort_order,
    totalLessons: lessonsList.length || 20,
    completedCount,
    isCurrentCompleted: completedSet.has(lessonId),
    nextLessonTitle,
  };

  const system = buildCoachSystemPrompt(
    lessonRow.title,
    LESSON_META[lessonRow.sort_order],
    progress,
  );

  let anthropic: Anthropic;
  try {
    anthropic = getAnthropic();
  } catch {
    return new Response("ai_unavailable", { status: 503 });
  }

  const messageStream = anthropic.messages.stream({
    model: COACH_MODEL,
    max_tokens: 1024,
    system,
    messages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of messageStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch {
        controller.enqueue(
          encoder.encode("\n\n（通信エラーが発生しました。もう一度お試しください）"),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
