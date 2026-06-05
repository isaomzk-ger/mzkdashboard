-- ============================================================
-- 0003: 招待制（許可リスト）＋ 権限の安全化
-- - allowed_emails に登録されたメールだけがログイン/登録できる
-- - profile の role/org は許可リストから自動付与（本人は変更不可）
-- - 自分で role を変更できる穴（profiles_update_own）を塞ぐ
-- - テストで作ったユーザーを削除
-- - 初代管理者を許可リストに登録
-- ============================================================

-- 1) 許可リスト（管理者が招待先メールを登録する）
create table if not exists allowed_emails (
  email text primary key,
  role text not null default 'member' check (role in ('admin', 'member')),
  org_id uuid references organizations on delete set null,
  created_at timestamptz not null default now()
);

alter table allowed_emails enable row level security;

drop policy if exists "allowed_admin_all" on allowed_emails;
create policy "allowed_admin_all" on allowed_emails
  for all using (public.is_admin()) with check (public.is_admin());

-- 2) 新規ユーザー作成トリガーを差し替え
--    許可リストにないメールは登録を拒否（auth.users への挿入ごとロールバック）。
--    許可リストにあれば role / org_id をコピーして profile を作成。
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  a public.allowed_emails%rowtype;
begin
  select * into a from public.allowed_emails
  where lower(email) = lower(new.email);

  if not found then
    raise exception 'not_allowed: % は招待されていません', new.email;
  end if;

  insert into public.profiles (id, full_name, role, org_id)
  values (new.id, new.raw_user_meta_data ->> 'full_name', a.role, a.org_id);

  return new;
end;
$$;

-- 3) 自分で role を書き換えられる穴を塞ぐ
--    （role/org は許可リスト由来。本人によるプロフィール編集は MVP では不可にする）
drop policy if exists "profiles_update_own" on profiles;

-- 4) テストで作成したユーザーを削除（profiles は cascade で消える）
delete from auth.users
where email in ('admin@and-academy.test', 'furusawa.admin@gmail.com');

-- 5) 組織と初代管理者を登録
--    ★ ログインに使う Google アカウントのメールに必ず書き換えてください
insert into organizations (id, name)
values ('00000000-0000-0000-0000-000000000001', 'and°')
on conflict (id) do nothing;

insert into allowed_emails (email, role, org_id)
values ('isao.mzk@gmail.com', 'admin', '00000000-0000-0000-0000-000000000001')
on conflict (email) do update
  set role = excluded.role, org_id = excluded.org_id;
