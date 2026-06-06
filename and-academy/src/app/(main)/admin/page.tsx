import Link from "next/link";
import { redirect } from "next/navigation";
import { canManageOrganization, getProfile } from "@/lib/auth";
import { formatDateTime } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";
import type { Course, Lesson, LessonProgress, Profile } from "@/lib/types";

const PAGE_SIZE = 25;

type MemberStatus = "all" | "not_started" | "in_progress" | "completed";
type MemberSort = "progress_asc" | "progress_desc" | "name" | "recent";

type MemberSummary = Pick<Profile, "id" | "email" | "full_name" | "role"> & {
  completed: number;
  percentage: number;
  lastActivity: string | null;
  status: Exclude<MemberStatus, "all">;
};

function param(
  value: string | string[] | undefined,
  fallback = "",
): string {
  return typeof value === "string" ? value : fallback;
}

function statusLabel(status: Exclude<MemberStatus, "all">): string {
  if (status === "completed") return "完了";
  if (status === "in_progress") return "進行中";
  return "未着手";
}

function roleLabel(role: Profile["role"]): string {
  if (role === "admin") return "運営管理者";
  if (role === "manager") return "企業管理者";
  return "メンバー";
}

function pageHref(
  query: string,
  status: MemberStatus,
  sort: MemberSort,
  page: number,
): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (status !== "all") params.set("status", status);
  if (sort !== "progress_asc") params.set("sort", sort);
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return suffix ? `/admin?${suffix}` : "/admin";
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!canManageOrganization(profile) || !profile.org_id) redirect("/courses");

  const params = await searchParams;
  const query = param(params.q).trim().toLocaleLowerCase("ja");
  const requestedStatus = param(params.status, "all");
  const status: MemberStatus = [
    "not_started",
    "in_progress",
    "completed",
  ].includes(requestedStatus)
    ? (requestedStatus as MemberStatus)
    : "all";
  const requestedSort = param(params.sort, "progress_asc");
  const sort: MemberSort = [
    "progress_desc",
    "name",
    "recent",
  ].includes(requestedSort)
    ? (requestedSort as MemberSort)
    : "progress_asc";
  const requestedPage = Number.parseInt(param(params.page, "1"), 10);

  const supabase = await createClient();
  const [
    { data: members },
    { data: publishedCourses },
    { data: lessons },
    { data: progress },
  ] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, full_name, role")
        .eq("org_id", profile.org_id),
      supabase.from("courses").select("id").eq("published", true),
      supabase.from("lessons").select("id, course_id"),
      supabase
        .from("lesson_progress")
        .select("user_id, lesson_id, completed, updated_at"),
    ]);

  const publishedCourseIds = new Set(
    ((publishedCourses as Pick<Course, "id">[] | null) ?? []).map(
      (course) => course.id,
    ),
  );
  const publishedLessonIds = new Set(
    (
      (lessons as Pick<Lesson, "id" | "course_id">[] | null) ?? []
    )
      .filter((lesson) => publishedCourseIds.has(lesson.course_id))
      .map((lesson) => lesson.id),
  );
  const total = publishedLessonIds.size;
  const progressByUser = new Map<
    string,
    { completed: number; lastActivity: string | null }
  >();
  (
    progress as Pick<
      LessonProgress,
      "user_id" | "lesson_id" | "completed" | "updated_at"
    >[] | null
  )?.forEach((item) => {
    if (!publishedLessonIds.has(item.lesson_id)) return;
    const current = progressByUser.get(item.user_id) ?? {
      completed: 0,
      lastActivity: null,
    };
    if (item.completed) current.completed += 1;
    if (
      !current.lastActivity ||
      new Date(item.updated_at) > new Date(current.lastActivity)
    ) {
      current.lastActivity = item.updated_at;
    }
    progressByUser.set(item.user_id, current);
  });

  const allMembers: MemberSummary[] = (
    (members as Pick<
      Profile,
      "id" | "email" | "full_name" | "role"
    >[] | null) ?? []
  ).map((member) => {
    const memberProgress = progressByUser.get(member.id);
    const completed = memberProgress?.completed ?? 0;
    const percentage =
      total === 0 ? 0 : Math.round((completed / total) * 100);
    const memberStatus =
      completed === 0
        ? "not_started"
        : total > 0 && completed >= total
          ? "completed"
          : "in_progress";
    return {
      ...member,
      completed,
      percentage,
      lastActivity: memberProgress?.lastActivity ?? null,
      status: memberStatus,
    };
  });

  const filtered = allMembers.filter((member) => {
    const matchesQuery =
      !query ||
      member.full_name?.toLocaleLowerCase("ja").includes(query) ||
      member.email?.toLocaleLowerCase("ja").includes(query);
    const matchesStatus = status === "all" || member.status === status;
    return matchesQuery && matchesStatus;
  });

  filtered.sort((a, b) => {
    if (sort === "progress_desc") return b.percentage - a.percentage;
    if (sort === "name") {
      return (a.full_name ?? a.email ?? "").localeCompare(
        b.full_name ?? b.email ?? "",
        "ja",
      );
    }
    if (sort === "recent") {
      return (
        (b.lastActivity ? new Date(b.lastActivity).getTime() : 0) -
        (a.lastActivity ? new Date(a.lastActivity).getTime() : 0)
      );
    }
    return a.percentage - b.percentage;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(
    Math.max(Number.isFinite(requestedPage) ? requestedPage : 1, 1),
    totalPages,
  );
  const visibleMembers = filtered.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );
  const average =
    allMembers.length === 0
      ? 0
      : Math.round(
          allMembers.reduce((sum, member) => sum + member.percentage, 0) /
            allMembers.length,
        );

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">管理ダッシュボード</h1>
          <p className="mt-1 text-sm text-slate-500">
            所属メンバーの受講状況を確認できます。
          </p>
        </div>
        <div className="flex gap-2">
          {profile.role === "admin" && (
            <Link
              href="/admin/organizations"
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-brand-50"
            >
              講座を割り当て
            </Link>
          )}
          <Link
            href="/admin/deadlines"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-brand-50"
          >
            締切を設定
          </Link>
          {profile.role === "admin" && (
            <Link
              href="/admin/courses"
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
            >
              講座を管理
            </Link>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="メンバー数" value={allMembers.length} />
        <Stat label="講座レッスン総数" value={total} />
        <Stat label="平均完了率" value={`${average}%`} />
      </div>

      <form
        method="get"
        className="mt-6 grid gap-3 border-y border-slate-200 bg-white px-4 py-4 sm:grid-cols-[minmax(220px,1fr)_180px_180px_auto]"
      >
        <input
          type="search"
          name="q"
          defaultValue={param(params.q)}
          placeholder="氏名・メールで検索"
          className="input"
        />
        <select name="status" defaultValue={status} className="input">
          <option value="all">すべての進捗</option>
          <option value="not_started">未着手</option>
          <option value="in_progress">進行中</option>
          <option value="completed">完了</option>
        </select>
        <select name="sort" defaultValue={sort} className="input">
          <option value="progress_asc">進捗が低い順</option>
          <option value="progress_desc">進捗が高い順</option>
          <option value="recent">最近受講した順</option>
          <option value="name">氏名順</option>
        </select>
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            適用
          </button>
          <Link
            href="/admin"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            解除
          </Link>
        </div>
      </form>

      <div className="overflow-x-auto border-b border-slate-200 bg-white">
        <table className="min-w-[860px] w-full text-sm">
          <thead className="bg-brand-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">メンバー</th>
              <th className="px-5 py-3 font-medium">ロール</th>
              <th className="px-5 py-3 font-medium">状態</th>
              <th className="px-5 py-3 font-medium">完了レッスン</th>
              <th className="px-5 py-3 font-medium">最終受講</th>
              <th className="px-5 py-3 font-medium">進捗</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleMembers.map((member) => (
              <tr key={member.id} className="hover:bg-slate-50">
                <td className="px-5 py-3">
                  <Link
                    href={`/admin/members/${member.id}`}
                    className="font-medium text-slate-900 hover:text-brand"
                  >
                    {member.full_name ?? "（名前未設定）"}
                  </Link>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {member.email}
                  </p>
                </td>
                <td className="px-5 py-3 text-slate-500">
                  {roleLabel(member.role)}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                      member.status === "completed"
                        ? "bg-emerald-50 text-emerald-700"
                        : member.status === "in_progress"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {statusLabel(member.status)}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-500">
                  {member.completed} / {total}
                </td>
                <td className="px-5 py-3 text-slate-500">
                  {formatDateTime(member.lastActivity)}
                </td>
                <td className="px-5 py-3">
                  <div className="flex w-40 items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${member.percentage}%` }}
                      />
                    </div>
                    <span className="w-9 text-right text-xs text-slate-500">
                      {member.percentage}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
            {visibleMembers.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-8 text-center text-slate-500"
                >
                  条件に一致するメンバーがいません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between bg-white px-5 py-4 text-sm">
        <span className="text-slate-500">
          {filtered.length}人中{" "}
          {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}〜
          {Math.min(page * PAGE_SIZE, filtered.length)}人
        </span>
        <div className="flex items-center gap-3">
          {page > 1 ? (
            <Link
              href={pageHref(query, status, sort, page - 1)}
              className="text-brand hover:underline"
            >
              前へ
            </Link>
          ) : (
            <span className="text-slate-300">前へ</span>
          )}
          <span className="text-slate-500">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={pageHref(query, status, sort, page + 1)}
              className="text-brand hover:underline"
            >
              次へ
            </Link>
          ) : (
            <span className="text-slate-300">次へ</span>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
