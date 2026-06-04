"use client";

import { useState, useTransition } from "react";
import { toggleLessonComplete } from "@/app/actions";

export default function CompleteButton({
  lessonId,
  initialCompleted,
}: {
  lessonId: string;
  initialCompleted: boolean;
}) {
  const [completed, setCompleted] = useState(initialCompleted);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const next = !completed;
    setCompleted(next);
    startTransition(() => toggleLessonComplete(lessonId, next));
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`rounded-lg px-5 py-2.5 text-sm font-medium transition disabled:opacity-50 ${
        completed
          ? "bg-green-600 text-white hover:bg-green-700"
          : "bg-brand text-white hover:bg-brand-dark"
      }`}
    >
      {completed ? "✓ 完了済み（取り消す）" : "このレッスンを完了にする"}
    </button>
  );
}
