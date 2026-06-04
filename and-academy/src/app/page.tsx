import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="max-w-2xl">
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-brand">
          for Executives &amp; Teams
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          and<span className="text-brand">°</span> Academy
        </h1>
        <p className="mt-6 text-lg text-slate-600">
          経営者と従業員のための、Claude
          導入動画講座。組織で学び、定着を可視化する e ラーニング基盤。
        </p>
        <div className="mt-10 flex justify-center gap-4">
          <Link
            href="/courses"
            className="rounded-lg bg-brand px-6 py-3 font-medium text-white hover:bg-brand-dark"
          >
            講座を見る
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-slate-300 px-6 py-3 font-medium text-slate-700 hover:bg-brand-50"
          >
            ログイン
          </Link>
        </div>
      </div>
    </main>
  );
}
