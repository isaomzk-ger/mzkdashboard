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
  email text,
  full_name text,
  role text not null default 'member' check (role in ('admin', 'manager', 'member')),
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
  role text not null default 'member' check (role in ('admin', 'manager', 'member')),
  org_id uuid references organizations on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_lessons_course on lessons (course_id);
create index if not exists idx_progress_user on lesson_progress (user_id);
create index if not exists idx_profiles_org on profiles (org_id);

-- 組織ごとの講座締切
create table if not exists course_deadlines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  course_id uuid not null references courses on delete cascade,
  due_date date not null,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, course_id)
);

create index if not exists idx_course_deadlines_org on course_deadlines (org_id);

-- 組織ごとの受講可能講座
create table if not exists organization_courses (
  org_id uuid not null references organizations on delete cascade,
  course_id uuid not null references courses on delete cascade,
  assigned_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  primary key (org_id, course_id)
);

create index if not exists idx_organization_courses_course
  on organization_courses (course_id);

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
  insert into public.profiles (id, email, full_name, role, org_id)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    a.role,
    a.org_id
  );

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
alter table course_deadlines enable row level security;
alter table organization_courses enable row level security;

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

create or replace function public.current_org_id()
returns uuid
language sql
security definer set search_path = public
stable
as $$
  select p.org_id from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.can_access_course(target_course_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.organization_courses oc
      join public.courses c on c.id = oc.course_id
      where oc.org_id = public.current_org_id()
        and oc.course_id = target_course_id
        and c.published = true
    );
$$;

-- 自社メンバーの受講状況を管理できるか
create or replace function public.can_manage_org()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'manager')
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
create policy "profiles_select_org_manager" on profiles
  for select using (public.can_manage_org() and id in (select public.same_org_user_ids()));
-- allowed_emails: 管理者のみ閲覧・管理可
create policy "allowed_admin_all" on allowed_emails
  for all using (public.is_admin()) with check (public.is_admin());

-- organizations: 自分の所属組織を読める
create policy "orgs_select_own" on organizations
  for select using (
    id = (select org_id from public.profiles where id = auth.uid())
  );
create policy "orgs_admin_all" on organizations
  for all using (public.is_admin()) with check (public.is_admin());

-- organization_courses: 自組織分は閲覧可。運営 admin は割り当てを管理可
create policy "organization_courses_select_own" on organization_courses
  for select using (
    public.is_admin() or org_id = public.current_org_id()
  );
create policy "organization_courses_admin_all" on organization_courses
  for all using (public.is_admin()) with check (public.is_admin());

-- courses / lessons: 自組織に割り当てられた公開講座のみ閲覧可
create policy "courses_select_assigned" on courses
  for select using (published = true and public.can_access_course(id));
create policy "lessons_select_assigned" on lessons
  for select using (public.can_access_course(course_id));

-- courses / lessons: admin は全件の作成・編集・削除・閲覧（未公開含む）が可能
create policy "courses_admin_all" on courses
  for all using (public.is_admin()) with check (public.is_admin());
create policy "lessons_admin_all" on lessons
  for all using (public.is_admin()) with check (public.is_admin());

-- lesson_progress: 自分の進捗は読み書き可。admin は同組織の進捗を閲覧可
create policy "progress_rw_own" on lesson_progress
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "progress_select_org_manager" on lesson_progress
  for select using (
    public.can_manage_org() and user_id in (select public.same_org_user_ids())
  );

-- course_deadlines: 自組織は閲覧可。admin / manager は自組織分を管理可
create policy "deadlines_select_own_org" on course_deadlines
  for select using (
    org_id = (select org_id from public.profiles where id = auth.uid())
  );
create policy "deadlines_manage_own_org" on course_deadlines
  for all using (
    public.can_manage_org()
    and org_id = (select org_id from public.profiles where id = auth.uid())
  ) with check (
    public.can_manage_org()
    and org_id = (select org_id from public.profiles where id = auth.uid())
  );

alter table course_deadlines
  add constraint course_deadlines_assignment_fkey
  foreign key (org_id, course_id)
  references organization_courses (org_id, course_id)
  on delete cascade;

create or replace function public.set_organization_courses(
  target_org_id uuid,
  target_course_ids uuid[]
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  delete from public.organization_courses
  where org_id = target_org_id
    and not (course_id = any(coalesce(target_course_ids, array[]::uuid[])));

  insert into public.organization_courses (org_id, course_id, assigned_by)
  select target_org_id, c.id, auth.uid()
  from public.courses c
  where c.id = any(coalesce(target_course_ids, array[]::uuid[]))
    and c.published = true
  on conflict (org_id, course_id) do nothing;
end;
$$;
