import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Course } from "@/lib/types";

const audienceLabel: Record<string, string> = {
  executive: "経営者向け",
  employee: "従業員向け",
};

export default async function AdminCoursesPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        この画面は管理者のみ閲覧できます。
      </div>
    );
  }

  const supabase = await createClient();
  // admin は RLS により未公開も含めて取得できる
  const { data: courses } = await supabase
    .from("courses")
    .select("*")
    .order("sort_order");

  const typed = (courses as Course[] | null) ?? [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">講座の管理</h1>
          <p className="mt-1 text-sm text-slate-500">
            講座とレッスンを登録・編集します。
          </p>
        </div>
        <Link
          href="/admin/courses/new"
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          ＋ 新規講座
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-brand-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">タイトル</th>
              <th className="px-5 py-3 font-medium">対象</th>
              <th className="px-5 py-3 font-medium">状態</th>
              <th className="px-5 py-3 font-medium">順</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {typed.map((c) => (
              <tr key={c.id}>
                <td className="px-5 py-3 font-medium">{c.title}</td>
                <td className="px-5 py-3 text-slate-500">
                  {audienceLabel[c.audience] ?? c.audience}
                </td>
                <td className="px-5 py-3">
                  {c.published ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                      公開中
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      下書き
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-slate-500">{c.sort_order}</td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href={`/admin/courses/${c.id}/edit`}
                    className="text-sm font-medium text-brand hover:underline"
                  >
                    編集
                  </Link>
                </td>
              </tr>
            ))}
            {typed.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-4 text-center text-slate-500">
                  講座がありません。「新規講座」から作成してください。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
