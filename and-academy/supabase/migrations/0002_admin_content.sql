-- ============================================================
-- 0002: 管理者による講座・レッスンの編集権限を追加
-- 既に schema.sql を実行済みのプロジェクトに、この差分だけ適用する
-- ============================================================

drop policy if exists "courses_admin_all" on courses;
drop policy if exists "lessons_admin_all" on lessons;

create policy "courses_admin_all" on courses
  for all using (public.is_admin()) with check (public.is_admin());

create policy "lessons_admin_all" on lessons
  for all using (public.is_admin()) with check (public.is_admin());
