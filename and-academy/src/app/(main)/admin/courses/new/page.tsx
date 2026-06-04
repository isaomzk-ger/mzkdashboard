import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import CourseForm from "@/components/CourseForm";
import { createCourse } from "../../actions";

export default async function NewCoursePage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/courses");

  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/courses"
        className="text-sm text-brand hover:underline"
      >
        ← 講座の管理
      </Link>
      <h1 className="mt-2 text-2xl font-bold">新規講座</h1>
      <p className="mt-1 text-sm text-slate-500">
        作成後、続けてレッスンを追加できます。
      </p>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <CourseForm action={createCourse} submitLabel="作成してレッスン追加へ" />
      </div>
    </div>
  );
}
