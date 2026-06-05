import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { LessonProgress, Profile } from "@/lib/types";

export default async function AdminPage() {
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

  // 同組織のメンバー（RLS により admin は同組織 profiles を閲覧可）
  const { data: members } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("org_id", profile.org_id ?? "");

  // レッスン総数
  const { count: totalLessons } = await supabase
    .from("lessons")
    .select("id", { count: "exact", head: true });

  // 同組織メンバーの完了進捗
  const { data: progress } = await supabase
    .from("lesson_progress")
    .select("user_id, completed")
    .eq("completed", true);

  const completedByUser = new Map<string, number>();
  (progress as Pick<LessonProgress, "user_id">[] | null)?.forEach((p) => {
    completedByUser.set(p.user_id, (completedByUser.get(p.user_id) ?? 0) + 1);
  });

  const typedMembers =
    (members as Pick<Profile, "id" | "full_name" | "role">[] | null) ?? [];
  const total = totalLessons ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">管理ダッシュボード</h1>
          <p className="mt-1 text-sm text-slate-500">
            所属メンバーの受講状況を確認できます。
          </p>
        </div>
        <Link
          href="/admin/courses"
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          講座を管理
        </Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="メンバー数" value={typedMembers.length} />
        <Stat label="講座レッスン総数" value={total} />
        <Stat
          label="平均完了率"
          value={`${
            typedMembers.length === 0 || total === 0
              ? 0
              : Math.round(
                  (typedMembers.reduce(
                    (sum, m) => sum + (completedByUser.get(m.id) ?? 0),
                    0,
                  ) /
                    (typedMembers.length * total)) *
                    100,
                )
          }%`}
        />
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-brand-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">メンバー</th>
              <th className="px-5 py-3 font-medium">ロール</th>
              <th className="px-5 py-3 font-medium">完了レッスン</th>
              <th className="px-5 py-3 font-medium">進捗</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {typedMembers.map((m) => {
              const done = completedByUser.get(m.id) ?? 0;
              const pct = total === 0 ? 0 : Math.round((done / total) * 100);
              return (
                <tr key={m.id}>
                  <td className="px-5 py-3 font-medium">
                    {m.full_name ?? "（名前未設定）"}
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    {m.role === "admin" ? "管理者" : "メンバー"}
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    {done} / {total}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-brand"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500">{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {typedMembers.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-4 text-center text-slate-500"
                >
                  メンバーがいません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
