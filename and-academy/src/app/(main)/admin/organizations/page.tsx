import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  Course,
  Organization,
  OrganizationCourse,
} from "@/lib/types";
import { updateOrganizationCourses } from "../actions";

export default async function OrganizationCoursesPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/admin");

  const supabase = await createClient();
  const [{ data: organizations }, { data: courses }, { data: assignments }] =
    await Promise.all([
      supabase.from("organizations").select("*").order("name"),
      supabase
        .from("courses")
        .select("*")
        .eq("published", true)
        .order("sort_order"),
      supabase.from("organization_courses").select("*"),
    ]);

  const typedOrganizations =
    (organizations as Organization[] | null) ?? [];
  const typedCourses = (courses as Course[] | null) ?? [];
  const assignedByOrganization = new Map<string, Set<string>>();
  ((assignments as OrganizationCourse[] | null) ?? []).forEach(
    (assignment) => {
      const courseIds =
        assignedByOrganization.get(assignment.org_id) ?? new Set<string>();
      courseIds.add(assignment.course_id);
      assignedByOrganization.set(assignment.org_id, courseIds);
    },
  );

  return (
    <div>
      <Link href="/admin" className="text-sm text-brand hover:underline">
        ← 管理ダッシュボード
      </Link>
      <div className="mt-2">
        <h1 className="text-2xl font-bold">組織の利用・講座設定</h1>
        <p className="mt-1 text-sm text-slate-500">
          契約中の顧客企業だけ利用を有効にし、受講できる講座を設定します。
        </p>
      </div>

      <div className="mt-6 space-y-5">
        {typedOrganizations.map((organization) => {
          const assigned =
            assignedByOrganization.get(organization.id) ?? new Set<string>();
          return (
            <form
              key={organization.id}
              action={updateOrganizationCourses.bind(null, organization.id)}
              className="rounded-lg border border-slate-200 bg-white"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{organization.name}</h2>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        organization.access_enabled
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {organization.access_enabled ? "利用中" : "停止中"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {assigned.size}講座を割り当て中
                  </p>
                </div>
                <button
                  type="submit"
                  className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
                >
                  設定を保存
                </button>
              </div>

              <div className="border-b border-slate-100 px-5 py-4">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    name="access_enabled"
                    defaultChecked={organization.access_enabled}
                    className="h-4 w-4 accent-brand"
                  />
                  <span>
                    <span className="block text-sm font-medium">
                      この組織の利用を有効にする
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      オフの場合、所属ユーザーがGoogleログインしても講座は表示されません。
                    </span>
                  </span>
                </label>
              </div>

              <fieldset
                className={`grid gap-1 p-4 sm:grid-cols-2 ${
                  organization.access_enabled ? "" : "opacity-60"
                }`}
              >
                <legend className="sr-only">受講可能な講座</legend>
                {typedCourses.map((course) => (
                  <label
                    key={course.id}
                    className="flex cursor-pointer items-start gap-3 rounded-md px-3 py-3 hover:bg-brand-50"
                  >
                    <input
                      type="checkbox"
                      name="course_ids"
                      value={course.id}
                      defaultChecked={assigned.has(course.id)}
                      className="mt-0.5 h-4 w-4 accent-brand"
                    />
                    <span>
                      <span className="block text-sm font-medium">
                        {course.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {course.audience === "executive"
                          ? "経営者向け"
                          : "従業員向け"}
                      </span>
                    </span>
                  </label>
                ))}
                {typedCourses.length === 0 && (
                  <p className="px-3 py-4 text-sm text-slate-500">
                    公開中の講座がありません。
                  </p>
                )}
              </fieldset>
            </form>
          );
        })}

        {typedOrganizations.length === 0 && (
          <p className="text-sm text-slate-500">組織がありません。</p>
        )}
      </div>
    </div>
  );
}
