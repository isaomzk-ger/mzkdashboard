import Link from "next/link";
import { redirect } from "next/navigation";
import { canManageOrganization, getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Course, CourseDeadline } from "@/lib/types";
import { removeCourseDeadline, setCourseDeadline } from "../actions";

export default async function DeadlinesPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!canManageOrganization(profile) || !profile.org_id) redirect("/courses");

  const supabase = await createClient();
  const [{ data: courses }, { data: deadlines }] = await Promise.all([
    supabase
      .from("courses")
      .select("*")
      .eq("published", true)
      .order("sort_order"),
    supabase
      .from("course_deadlines")
      .select("*")
      .eq("org_id", profile.org_id),
  ]);

  const deadlineByCourse = new Map(
    ((deadlines as CourseDeadline[] | null) ?? []).map((deadline) => [
      deadline.course_id,
      deadline,
    ]),
  );

  return (
    <div>
      <Link href="/admin" className="text-sm text-brand hover:underline">
        ← 管理ダッシュボード
      </Link>
      <div className="mt-2">
        <h1 className="text-2xl font-bold">講座の締切設定</h1>
        <p className="mt-1 text-sm text-slate-500">
          自社メンバー全員に適用する受講期限を設定します。
        </p>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-brand-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">講座</th>
              <th className="px-5 py-3 font-medium">対象</th>
              <th className="px-5 py-3 font-medium">締切日</th>
              <th className="px-5 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {((courses as Course[] | null) ?? []).map((course) => {
              const deadline = deadlineByCourse.get(course.id);
              return (
                <tr key={course.id}>
                  <td className="px-5 py-4 font-medium">{course.title}</td>
                  <td className="px-5 py-4 text-slate-500">
                    {course.audience === "executive" ? "経営者" : "従業員"}
                  </td>
                  <td className="px-5 py-4">
                    <form
                      action={setCourseDeadline.bind(null, course.id)}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="date"
                        name="due_date"
                        defaultValue={deadline?.due_date ?? ""}
                        required
                        className="input max-w-44"
                      />
                      <button
                        type="submit"
                        className="rounded-md bg-brand px-3 py-2 text-xs font-medium text-white hover:bg-brand-dark"
                      >
                        保存
                      </button>
                    </form>
                  </td>
                  <td className="px-5 py-4">
                    {deadline ? (
                      <form action={removeCourseDeadline.bind(null, course.id)}>
                        <button
                          type="submit"
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          締切を解除
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs text-slate-400">未設定</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
