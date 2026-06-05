-- ============================================================
-- and° Academy - データベーススキーマ
-- Supabase の SQL Editor に貼り付けて実行する
-- ============================================================

-- 組織（法人アカウント）
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- プロフィール（auth.users を拡張。ロールと所属組織を持つ）
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  org_id uuid references organizations on delete set null,
  full_name text,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now()
);

-- 講座
create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  thumbnail_url text,
  audience text not null default 'employee' check (audience in ('executive', 'employee')),
  sort_order int not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

-- レッスン（講座内の動画。video_url はプロバイダ非依存）
create table if not exists lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses on delete cascade,
  title text not null,
  description text,
  video_url text,
  duration_seconds int,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 視聴進捗（ユーザー × レッスン）
create table if not exists lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  lesson_id uuid not null references lessons on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  last_position_seconds int not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

-- 許可リスト（招待制。ここに登録されたメールだけがログイン/登録できる）
create table if not exists allowed_emails (
  email text primary key,
  role text not null default 'member' check (role in ('admin', 'member')),
  org_id uuid references organizations on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_lessons_course on lessons (course_id);
create index if not exists idx_progress_user on lesson_progress (user_id);
create index if not exists idx_profiles_org on profiles (org_id);

-- ============================================================
-- 新規ユーザー登録時に profiles を自動作成
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  a public.allowed_emails%rowtype;
begin
  -- 許可リストにないメールは登録を拒否（auth.users への挿入ごとロールバック）
  select * into a from public.allowed_emails
  where lower(email) = lower(new.email);

  if not found then
    raise exception 'not_allowed: % は招待されていません', new.email;
  end if;

  -- role / org は許可リストから付与（本人は変更できない）
  insert into public.profiles (id, full_name, role, org_id)
  values (new.id, new.raw_user_meta_data ->> 'full_name', a.role, a.org_id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table courses enable row level security;
alter table lessons enable row level security;
alter table lesson_progress enable row level security;
alter table allowed_emails enable row level security;

-- 自分が admin かどうかを返すヘルパー（RLS の再帰を避けるため security definer）
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- 同じ組織の user_id 一覧（admin ダッシュボード用）
create or replace function public.same_org_user_ids()
returns setof uuid
language sql
security definer set search_path = public
stable
as $$
  select p.id from public.profiles p
  where p.org_id = (select org_id from public.profiles where id = auth.uid());
$$;

-- profiles: 自分は読める。admin は同組織を読める
create policy "profiles_select_own" on profiles
  for select using (id = auth.uid());
create policy "profiles_select_org_admin" on profiles
  for select using (public.is_admin() and id in (select public.same_org_user_ids()));
-- allowed_emails: 管理者のみ閲覧・管理可
create policy "allowed_admin_all" on allowed_emails
  for all using (public.is_admin()) with check (public.is_admin());

-- organizations: 自分の所属組織を読める
create policy "orgs_select_own" on organizations
  for select using (
    id = (select org_id from public.profiles where id = auth.uid())
  );

-- courses / lessons: ログインユーザーは公開講座を閲覧可
create policy "courses_select_published" on courses
  for select using (published = true);
create policy "lessons_select_published" on lessons
  for select using (
    exists (select 1 from courses c where c.id = course_id and c.published = true)
  );

-- courses / lessons: admin は全件の作成・編集・削除・閲覧（未公開含む）が可能
create policy "courses_admin_all" on courses
  for all using (public.is_admin()) with check (public.is_admin());
create policy "lessons_admin_all" on lessons
  for all using (public.is_admin()) with check (public.is_admin());

-- lesson_progress: 自分の進捗は読み書き可。admin は同組織の進捗を閲覧可
create policy "progress_rw_own" on lesson_progress
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "progress_select_org_admin" on lesson_progress
  for select using (
    public.is_admin() and user_id in (select public.same_org_user_ids())
  );
