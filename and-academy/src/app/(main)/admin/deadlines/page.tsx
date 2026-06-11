import Link from "next/link";
import { redirect } from "next/navigation";
import { canManageOrganization, getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  Course,
  CourseDeadline,
  Organization,
  OrganizationCourse,
  Profile,
} from "@/lib/types";
import { removeCourseDeadline, setCourseDeadline } from "../actions";

function param(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export default async function DeadlinesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!canManageOrganization(profile) || !profile.org_id) redirect("/courses");

  const isAdmin = profile.role === "admin";
  const params = await searchParams;
  const supabase = await createClient();
  const { data: organizations } = isAdmin
    ? await supabase.from("organizations").select("*").order("name")
    : await supabase
        .from("organizations")
        .select("*")
        .eq("id", profile.org_id);
  const typedOrganizations =
    (organizations as Organization[] | null) ?? [];
  const requestedOrganizationId = param(params.org);
  const selectedOrganization =
    typedOrganizations.find(
      (organization) => organization.id === requestedOrganizationId,
    ) ??
    typedOrganizations.find(
      (organization) => organization.id === profile.org_id,
    ) ??
    typedOrganizations[0];

  if (!selectedOrganization) redirect("/admin");

  const organizationId = selectedOrganization.id;
  const [
    { data: members },
    { data: assignments },
    { data: deadlines },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, role, org_id")
      .eq("org_id", organizationId)
      .order("full_name"),
    supabase
      .from("organization_courses")
      .select("org_id, course_id")
      .eq("org_id", organizationId),
    supabase
      .from("course_deadlines")
      .select("*")
      .eq("org_id", organizationId),
  ]);

  const courseIds = (
    (assignments as Pick<
      OrganizationCourse,
      "org_id" | "course_id"
    >[] | null) ?? []
  ).map((assignment) => assignment.course_id);
  const { data: courses } =
    courseIds.length > 0
      ? await supabase
          .from("courses")
          .select("*")
          .in("id", courseIds)
          .eq("published", true)
          .order("sort_order")
      : { data: [] };
  const typedMembers =
    (members as Pick<
      Profile,
      "id" | "full_name" | "email" | "role" | "org_id"
    >[] | null) ?? [];
  const typedCourses = (courses as Course[] | null) ?? [];
  const deadlineByMemberCourse = new Map(
    ((deadlines as CourseDeadline[] | null) ?? []).map((deadline) => [
      `${deadline.user_id}:${deadline.course_id}`,
      deadline,
    ]),
  );

  return (
    <div>
      <Link href="/admin" className="text-sm text-brand hover:underline">
        ← 管理ダッシュボード
      </Link>
      <div className="mt-2">
        <h1 className="text-2xl font-bold">メンバー別の締切設定</h1>
        <p className="mt-1 text-sm text-slate-500">
          講座の受講期限をメンバーごとに設定します。
        </p>
      </div>

      {isAdmin && (
        <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
          <label className="min-w-64 text-sm">
            <span className="mb-1 block text-xs text-slate-500">組織</span>
            <select
              name="org"
              defaultValue={organizationId}
              className="input"
            >
              {typedOrganizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            表示
          </button>
        </form>
      )}

      <div className="mt-6 overflow-x-auto border-y border-slate-200 bg-white">
        <table className="min-w-[860px] w-full text-sm">
          <thead className="bg-brand-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">メンバー</th>
              <th className="px-5 py-3 font-medium">講座</th>
              <th className="px-5 py-3 font-medium">締切日</th>
              <th className="px-5 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {typedMembers.flatMap((member) =>
              typedCourses.map((course) => {
                const deadline = deadlineByMemberCourse.get(
                  `${member.id}:${course.id}`,
                );
                return (
                  <tr key={`${member.id}:${course.id}`}>
                    <td className="px-5 py-4">
                      <p className="font-medium">
                        {member.full_name ?? "（名前未設定）"}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {member.email}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-slate-700">
                      {course.title}
                    </td>
                    <td className="px-5 py-4">
                      <form
                        action={setCourseDeadline.bind(
                          null,
                          organizationId,
                          member.id,
                          course.id,
                        )}
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
                        <form
                          action={removeCourseDeadline.bind(
                            null,
                            organizationId,
                            member.id,
                            course.id,
                          )}
                        >
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
              }),
            )}
            {(typedMembers.length === 0 || typedCourses.length === 0) && (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-8 text-center text-slate-500"
                >
                  対象のメンバーまたは講座がありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
