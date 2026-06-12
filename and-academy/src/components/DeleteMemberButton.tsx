"use client";

export default function DeleteMemberButton({
  action,
}: {
  action: () => Promise<void>;
}) {
  return (
    <form action={action}>
      <button
        type="submit"
        onClick={(event) => {
          if (
            !window.confirm(
              "このメンバーの招待・アカウント・進捗を削除します。元に戻せません。",
            )
          ) {
            event.preventDefault();
          }
        }}
        className="text-xs font-medium text-red-600 hover:underline"
      >
        削除
      </button>
    </form>
  );
}
