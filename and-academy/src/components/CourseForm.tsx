import type { Course } from "@/lib/types";

// 講座の新規作成・編集フォーム（Server Action を action に渡して使う）
export default function CourseForm({
  action,
  course,
  submitLabel,
}: {
  action: (formData: FormData) => void;
  course?: Course;
  submitLabel: string;
}) {
  return (
    <form action={action} className="space-y-4">
      <Field label="タイトル">
        <input
          name="title"
          required
          defaultValue={course?.title ?? ""}
          className="input"
        />
      </Field>

      <Field label="説明">
        <textarea
          name="description"
          rows={3}
          defaultValue={course?.description ?? ""}
          className="input"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="対象">
          <select
            name="audience"
            defaultValue={course?.audience ?? "employee"}
            className="input"
          >
            <option value="executive">経営者向け</option>
            <option value="employee">従業員向け</option>
          </select>
        </Field>
        <Field label="表示順">
          <input
            name="sort_order"
            type="number"
            defaultValue={course?.sort_order ?? 0}
            className="input"
          />
        </Field>
      </div>

      <Field label="サムネイルURL（任意）">
        <input
          name="thumbnail_url"
          defaultValue={course?.thumbnail_url ?? ""}
          placeholder="https://..."
          className="input"
        />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input
          name="published"
          type="checkbox"
          defaultChecked={course?.published ?? false}
          className="h-4 w-4"
        />
        公開する（受講者に表示）
      </label>

      <button
        type="submit"
        className="rounded-md bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-dark"
      >
        {submitLabel}
      </button>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}
