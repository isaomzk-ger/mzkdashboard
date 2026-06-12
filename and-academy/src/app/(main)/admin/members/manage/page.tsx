import Link from "next/link";
import { redirect } from "next/navigation";
import DeleteMemberButton from "@/components/DeleteMemberButton";
import { canManageOrganization, getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AllowedEmail, Organization, Profile } from "@/lib/types";
import {
  createOrganizationInvite,
  deleteOrganizationInvite,
  updateOrganizationInvite,
} from "../../actions";

function param(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export default async function MemberManagementPage({
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

  const [{ data: invites }, { data: members }] = await Promise.all([
    supabase
      .from("allowed_emails")
      .select("*")
      .eq("org_id", organizationId)
      .order("created_at"),
    supabase
      .from("profiles")
      .select("id, email, full_name, role, org_id, active, created_at")
      .eq("org_id", organizationId),
  ]);
  const typedInvites = (invites as AllowedEmail[] | null) ?? [];
  const profileByEmail = new Map(
    (
      (members as Pick<
        Profile,
        | "id"
        | "email"
        | "full_name"
        | "role"
        | "org_id"
        | "active"
        | "created_at"
      >[] | null) ?? []
    ).map((member) => [member.email?.toLowerCase(), member]),
  );

  return (
    <div>
      <Link href="/admin" className="text-sm text-brand hover:underline">
        ← 管理ダッシュボード
      </Link>
      <div className="mt-2">
        <h1 className="text-2xl font-bold">メンバー管理</h1>
        <p className="mt-1 text-sm text-slate-500">
          Googleアカウントを招待登録し、権限・利用状態を管理します。
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

      <form
        action={createOrganizationInvite.bind(null, organizationId)}
        className="mt-6 grid gap-3 border-y border-slate-200 bg-white px-5 py-5 sm:grid-cols-[minmax(240px,1fr)_180px_auto]"
      >
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-500">
            Googleアカウント
          </span>
          <input
            type="email"
            name="email"
            required
            placeholder="member@example.com"
            className="input"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-500">権限</span>
          <select name="role" defaultValue="member" className="input">
            <option value="member">メンバー</option>
            <option value="manager">企業管理者</option>
          </select>
        </label>
        <button
          type="submit"
          className="self-end rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          招待登録
        </button>
      </form>
      <p className="mt-2 text-xs text-slate-500">
        登録後、対象者はそのGoogleアカウントでログインできます。
      </p>

      <div className="mt-6 overflow-x-auto border-y border-slate-200 bg-white">
        <table className="min-w-[920px] w-full text-sm">
          <thead className="bg-brand-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">メンバー</th>
              <th className="px-5 py-3 font-medium">状態</th>
              <th className="px-5 py-3 font-medium">権限・利用</th>
              <th className="px-5 py-3 font-medium">削除</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {typedInvites.map((invite) => {
              const member = profileByEmail.get(invite.email.toLowerCase());
              const isPlatformAdmin = invite.role === "admin";
              const isSelf =
                invite.email.toLowerCase() === profile.email?.toLowerCase();
              return (
                <tr key={invite.email}>
                  <td className="px-5 py-4">
                    <p className="font-medium">
                      {member?.full_name ?? "未ログイン"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {invite.email}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        !invite.active
                          ? "bg-red-50 text-red-700"
                          : member
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {!invite.active
                        ? "利用停止"
                        : member
                          ? "利用中"
                          : "招待中"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {isPlatformAdmin || isSelf ? (
                      <span className="text-sm text-slate-500">
                        {isPlatformAdmin ? "運営管理者" : "自分のアカウント"}
                      </span>
                    ) : (
                      <form
                        action={updateOrganizationInvite.bind(
                          null,
                          organizationId,
                          invite.email,
                        )}
                        className="flex items-center gap-3"
                      >
                        <select
                          name="role"
                          defaultValue={invite.role}
                          className="input max-w-40"
                        >
                          <option value="member">メンバー</option>
                          <option value="manager">企業管理者</option>
                        </select>
                        <label className="flex items-center gap-2 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            name="active"
                            defaultChecked={invite.active}
                            className="h-4 w-4 accent-brand"
                          />
                          利用を許可
                        </label>
                        <button
                          type="submit"
                          className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium hover:bg-slate-50"
                        >
                          保存
                        </button>
                      </form>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {!isPlatformAdmin && !isSelf && (
                      <DeleteMemberButton
                        action={deleteOrganizationInvite.bind(
                          null,
                          organizationId,
                          invite.email,
                        )}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
            {typedInvites.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-8 text-center text-slate-500"
                >
                  招待済みのメンバーはいません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
