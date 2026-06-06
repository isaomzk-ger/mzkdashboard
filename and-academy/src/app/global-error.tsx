"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
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
    <html lang="ja">
      <body>
        <main
          style={{
            margin: "80px auto",
            maxWidth: 480,
            padding: 24,
            textAlign: "center",
            fontFamily: "sans-serif",
          }}
        >
          <h1>問題が発生しました</h1>
          <p>エラーは運営へ自動通知されました。</p>
          <button type="button" onClick={() => unstable_retry()}>
            再試行
          </button>
        </main>
      </body>
    </html>
  );
}
