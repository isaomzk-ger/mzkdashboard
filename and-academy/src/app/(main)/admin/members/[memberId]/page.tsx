import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canManageOrganization, getProfile } from "@/lib/auth";
import { formatDate, formatDateTime, todayInTokyo } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";
import type {
  Course,
  CourseDeadline,
  Lesson,
  LessonProgress,
  Organization,
  OrganizationCourse,
  Profile,
} from "@/lib/types";

function roleLabel(role: Profile["role"]): string {
  if (role === "admin") return "運営管理者";
  if (role === "manager") return "企業管理者";
  return "メンバー";
}

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!canManageOrganization(profile) || !profile.org_id) redirect("/courses");
  const isAdmin = profile.role === "admin";

  const supabase = await createClient();
  const memberQuery = isAdmin
    ? supabase
        .from("profiles")
        .select("id, email, full_name, role, org_id")
        .eq("id", memberId)
        .single()
    : supabase
        .from("profiles")
        .select("id, email, full_name, role, org_id")
        .eq("id", memberId)
        .eq("org_id", profile.org_id)
        .single();
  const { data: member } = await memberQuery;

  if (!member) notFound();

  const typedMember = member as Pick<
    Profile,
    "id" | "email" | "full_name" | "role" | "org_id"
  >;
  const targetOrgId = typedMember.org_id;
  const [
    { data: organization },
    { data: assignments },
    { data: progress },
    { data: deadlines },
  ] = await Promise.all([
    targetOrgId
      ? supabase
          .from("organizations")
          .select("id, name")
          .eq("id", targetOrgId)
          .single()
      : Promise.resolve({ data: null }),
    targetOrgId
      ? supabase
          .from("organization_courses")
          .select("org_id, course_id")
          .eq("org_id", targetOrgId)
      : Promise.resolve({ data: [] }),
    supabase.from("lesson_progress").select("*").eq("user_id", memberId),
    targetOrgId
      ? supabase
          .from("course_deadlines")
          .select("*")
          .eq("org_id", targetOrgId)
      : Promise.resolve({ data: [] }),
  ]);

  const assignedCourseIds = [
    ...new Set(
      (
        (assignments as Pick<
          OrganizationCourse,
          "org_id" | "course_id"
        >[] | null) ?? []
      ).map((assignment) => assignment.course_id),
    ),
  ];
  const [{ data: courses }, { data: lessons }] =
    assignedCourseIds.length > 0
      ? await Promise.all([
          supabase
            .from("courses")
            .select("*")
            .in("id", assignedCourseIds)
            .eq("published", true)
            .order("sort_order"),
          supabase
            .from("lessons")
            .select("*")
            .in("course_id", assignedCourseIds)
            .order("sort_order"),
        ])
      : [{ data: [] }, { data: [] }];

  const typedCourses = (courses as Course[] | null) ?? [];
  const publishedCourseIds = new Set(typedCourses.map((course) => course.id));
  const typedLessons = ((lessons as Lesson[] | null) ?? []).filter((lesson) =>
    publishedCourseIds.has(lesson.course_id),
  );
  const assignedLessonIds = new Set(typedLessons.map((lesson) => lesson.id));
  const typedProgress = ((progress as LessonProgress[] | null) ?? []).filter(
    (item) => assignedLessonIds.has(item.lesson_id),
  );
  const deadlineByCourse = new Map(
    ((deadlines as CourseDeadline[] | null) ?? []).map((deadline) => [
      deadline.course_id,
      deadline.due_date,
    ]),
  );
  const progressByLesson = new Map(
    typedProgress.map((item) => [item.lesson_id, item]),
  );
  const lessonsByCourse = new Map<string, Lesson[]>();
  typedLessons.forEach((lesson) => {
    const list = lessonsByCourse.get(lesson.course_id) ?? [];
    list.push(lesson);
    lessonsByCourse.set(lesson.course_id, list);
  });

  const totalLessons = typedLessons.length;
  const totalCompleted = typedProgress.filter((item) => item.completed).length;
  const overallPercentage =
    totalLessons === 0
      ? 0
      : Math.round((totalCompleted / totalLessons) * 100);
  const lastActivity =
    typedProgress
      .map((item) => item.updated_at)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
  const today = todayInTokyo();
  const organizationName =
    (organization as Pick<Organization, "id" | "name"> | null)?.name ??
    "組織未設定";

  return (
    <div>
      <Link href="/admin" className="text-sm text-brand hover:underline">
        ← 管理ダッシュボード
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {typedMember.full_name ?? "（名前未設定）"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{typedMember.email}</p>
          <p className="mt-0.5 text-sm text-slate-500">
            所属組織: {organizationName}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {roleLabel(typedMember.role)}
        </span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="全体進捗" value={`${overallPercentage}%`} />
        <Stat
          label="完了レッスン"
          value={`${totalCompleted} / ${totalLessons}`}
        />
        <Stat label="最終受講" value={formatDateTime(lastActivity)} />
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold">講座別の進捗</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-[760px] w-full text-sm">
            <thead className="bg-brand-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">講座</th>
                <th className="px-5 py-3 font-medium">状態</th>
                <th className="px-5 py-3 font-medium">締切</th>
                <th className="px-5 py-3 font-medium">最終受講</th>
                <th className="px-5 py-3 font-medium">進捗</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {typedCourses.map((course) => {
                const courseLessons = lessonsByCourse.get(course.id) ?? [];
                const completed = courseLessons.filter(
                  (lesson) => progressByLesson.get(lesson.id)?.completed,
                ).length;
                const percentage =
                  courseLessons.length === 0
                    ? 0
                    : Math.round((completed / courseLessons.length) * 100);
                const dueDate = deadlineByCourse.get(course.id) ?? null;
                const overdue =
                  Boolean(dueDate) && dueDate! < today && percentage < 100;
                const courseLastActivity =
                  courseLessons
                    .map(
                      (lesson) =>
                        progressByLesson.get(lesson.id)?.updated_at ?? null,
                    )
                    .filter((value): value is string => Boolean(value))
                    .sort(
                      (a, b) =>
                        new Date(b).getTime() - new Date(a).getTime(),
                    )[0] ?? null;
                const status =
                  percentage === 100
                    ? "完了"
                    : overdue
                      ? "期限超過"
                      : completed > 0
                        ? "進行中"
                        : "未着手";

                return (
                  <tr key={course.id}>
                    <td className="px-5 py-4 font-medium">{course.title}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          status === "完了"
                            ? "bg-emerald-50 text-emerald-700"
                            : status === "期限超過"
                              ? "bg-red-50 text-red-700"
                              : status === "進行中"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {status}
                      </span>
                    </td>
                    <td
                      className={`px-5 py-4 ${
                        overdue ? "font-medium text-red-600" : "text-slate-500"
                      }`}
                    >
                      {formatDate(dueDate)}
                    </td>
                    <td className="px-5 py-4 text-slate-500">
                      {formatDateTime(courseLastActivity)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex w-44 items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-brand"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="w-16 text-right text-xs text-slate-500">
                          {completed}/{courseLessons.length} ({percentage}%)
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}
