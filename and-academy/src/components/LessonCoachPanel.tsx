"use client";

import { useRef, useState } from "react";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "この言葉の意味が分からない",
  "もっとやさしく説明して",
  "なぜこれをやるの？",
  "自社の例で一緒にやりたい",
];

export default function LessonCoachPanel({
  lessonId,
  lessonTitle,
}: {
  lessonId: string;
  lessonTitle: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    setError(null);

    const history: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];
    // ユーザー発言 + 空のアシスタント枠（ストリームで埋めていく）
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setIsStreaming(true);

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, messages: history }),
      });
      if (!res.ok || !res.body) {
        throw new Error(
          res.status === 503
            ? "AIコーチは現在準備中です（APIキー未設定）"
            : "通信に失敗しました。時間をおいて再度お試しください。",
        );
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      }

      if (!acc) {
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            role: "assistant",
            content: "うまく応答できませんでした。もう一度お試しください。",
          };
          return copy;
        });
      }
    } catch (e) {
      // 失敗時は空のアシスタント枠を取り除き、ユーザー発言は残す
      setMessages((prev) => prev.slice(0, -1));
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <section className="mt-10 rounded-2xl border border-slate-200 bg-white">
      <header className="border-b border-slate-100 px-5 py-4">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
          <span aria-hidden>🎓</span> AI定着コーチ
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          「{lessonTitle}」について、分からないことは何でも質問・相談OK。自社の状況もそのまま話してください。
        </p>
      </header>

      <div
        ref={scrollRef}
        className="max-h-96 space-y-4 overflow-y-auto px-5 py-4"
      >
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              分からない言葉や「なぜこれをやるの？」でもOK。下のボタンか自由入力でどうぞ。
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={
                  m.role === "user"
                    ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-brand px-4 py-2.5 text-sm text-white"
                    : "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-2.5 text-sm text-slate-800"
                }
              >
                {m.content || (isStreaming ? "…" : "")}
              </div>
            </div>
          ))
        )}
      </div>

      {error && <p className="px-5 pb-2 text-xs text-red-600">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2 border-t border-slate-100 px-4 py-3"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder="質問や自社の状況・データを入力（Enterで送信 / Shift+Enterで改行）"
          className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-brand focus:outline-none"
          disabled={isStreaming}
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="shrink-0 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isStreaming ? "…" : "送信"}
        </button>
      </form>
    </section>
  );
}
