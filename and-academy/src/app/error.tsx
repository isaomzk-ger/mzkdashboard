"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-xl font-bold">画面を読み込めませんでした</h1>
      <p className="mt-2 text-sm text-slate-500">
        エラーは運営へ自動通知されました。時間を置いて再度お試しください。
      </p>
      <button
        type="button"
        onClick={() => unstable_retry()}
        className="mt-6 rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
      >
        再試行
      </button>
    </div>
  );
}
