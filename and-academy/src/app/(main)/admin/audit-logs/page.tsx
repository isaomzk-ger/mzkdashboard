import Link from "next/link";
import { redirect } from "next/navigation";
import { canManageOrganization, getProfile } from "@/lib/auth";
import { formatDateTime } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";
import type { AuditLog, Organization, Profile } from "@/lib/types";

function param(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    "invite.created": "招待登録",
    "invite.updated": "招待・権限更新",
    "invite.deleted": "メンバー削除",
    "deadline.created": "締切設定",
    "deadline.updated": "締切変更",
    "deadline.deleted": "締切解除",
    "course.assigned": "講座割り当て",
    "course.unassigned": "講座割り当て解除",
    "organization.access_updated": "組織利用状態変更",
  };
  return labels[action] ?? action;
}

function detail(log: AuditLog): string {
  const metadata = log.metadata;
  if (typeof metadata.email === "string") return metadata.email;
  if (typeof metadata.due_date_after === "string") {
    return `締切: ${metadata.due_date_after}`;
  }
  if (typeof metadata.due_date_before === "string") {
    return `締切: ${metadata.due_date_before}`;
  }
  return log.target_id ?? "-";
}

export default async function AuditLogsPage({
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
  const organizationId =
    isAdmin &&
    typedOrganizations.some(
      (organization) => organization.id === requestedOrganizationId,
    )
      ? requestedOrganizationId
      : profile.org_id;

  let logsQuery = supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (organizationId) logsQuery = logsQuery.eq("org_id", organizationId);

  const [{ data: logs }, { data: actors }] = await Promise.all([
    logsQuery,
    supabase.from("profiles").select("id, full_name, email"),
  ]);
  const typedLogs = (logs as AuditLog[] | null) ?? [];
  const actorById = new Map(
    (
      (actors as Pick<Profile, "id" | "full_name" | "email">[] | null) ?? []
    ).map((actor) => [
      actor.id,
      actor.full_name ?? actor.email ?? "削除済みユーザー",
    ]),
  );

  return (
    <div>
      <Link href="/admin" className="text-sm text-brand hover:underline">
        ← 管理ダッシュボード
      </Link>
      <div className="mt-2">
        <h1 className="text-2xl font-bold">操作履歴</h1>
        <p className="mt-1 text-sm text-slate-500">
          招待・権限・締切・講座割り当ての直近100件を確認できます。
        </p>
      </div>

      {isAdmin && (
        <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
          <label className="min-w-64 text-sm">
            <span className="mb-1 block text-xs text-slate-500">組織</span>
            <select
              name="org"
              defaultValue={organizationId ?? ""}
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
        <table className="min-w-[760px] w-full text-sm">
          <thead className="bg-brand-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">日時</th>
              <th className="px-5 py-3 font-medium">操作者</th>
              <th className="px-5 py-3 font-medium">操作</th>
              <th className="px-5 py-3 font-medium">対象</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {typedLogs.map((log) => (
              <tr key={log.id}>
                <td className="px-5 py-4 text-slate-500">
                  {formatDateTime(log.created_at)}
                </td>
                <td className="px-5 py-4">
                  {log.actor_id
                    ? (actorById.get(log.actor_id) ?? "削除済みユーザー")
                    : "システム"}
                </td>
                <td className="px-5 py-4 font-medium">
                  {actionLabel(log.action)}
                </td>
                <td className="px-5 py-4 text-slate-500">{detail(log)}</td>
              </tr>
            ))}
            {typedLogs.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-8 text-center text-slate-500"
                >
                  操作履歴はまだありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
