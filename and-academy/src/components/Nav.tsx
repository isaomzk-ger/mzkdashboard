import Link from "next/link";
import {
  canManageOrganization,
  canViewOrganizationProgress,
  getProfile,
} from "@/lib/auth";
import { signOut } from "@/app/actions";

export default async function Nav() {
  const profile = await getProfile();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/courses" className="text-lg font-bold tracking-tight">
          and<span className="text-brand">°</span> Academy
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          <Link href="/courses" className="text-slate-600 hover:text-slate-900">
            講座
          </Link>
          {canViewOrganizationProgress(profile) && (
            <Link href="/admin" className="text-slate-600 hover:text-slate-900">
              {canManageOrganization(profile) ? "管理" : "チーム進捗"}
            </Link>
          )}
          {profile ? (
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md border border-slate-300 px-3 py-1 text-slate-700 hover:bg-brand-50"
              >
                ログアウト
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-brand px-3 py-1 text-white hover:bg-brand-dark"
            >
              ログイン
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
