-- Per-member deadlines and same-organization progress visibility.

alter table public.course_deadlines
  add column if not exists user_id uuid;

alter table public.course_deadlines
  drop constraint if exists course_deadlines_org_id_course_id_key;

create temporary table legacy_course_deadlines
on commit drop
as
select *
from public.course_deadlines
where user_id is null;

delete from public.course_deadlines
where user_id is null;

insert into public.course_deadlines (
  org_id,
  user_id,
  course_id,
  due_date,
  created_by,
  created_at,
  updated_at
)
select
  legacy.org_id,
  profiles.id,
  legacy.course_id,
  legacy.due_date,
  legacy.created_by,
  legacy.created_at,
  legacy.updated_at
from legacy_course_deadlines legacy
join public.profiles profiles on profiles.org_id = legacy.org_id
on conflict do nothing;

alter table public.course_deadlines
  alter column user_id set not null;

alter table public.course_deadlines
  drop constraint if exists course_deadlines_user_id_fkey;
alter table public.course_deadlines
  add constraint course_deadlines_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.course_deadlines
  drop constraint if exists course_deadlines_user_id_course_id_key;
alter table public.course_deadlines
  add constraint course_deadlines_user_id_course_id_key
  unique (user_id, course_id);

create index if not exists idx_course_deadlines_user
  on public.course_deadlines (user_id);

create or replace function public.user_belongs_to_org(
  target_user_id uuid,
  target_org_id uuid
)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = target_user_id
      and p.org_id = target_org_id
  );
$$;

drop policy if exists "profiles_select_org_manager" on public.profiles;
drop policy if exists "profiles_select_same_org" on public.profiles;
create policy "profiles_select_same_org" on public.profiles
  for select using (
    public.is_admin()
    or id in (select public.same_org_user_ids())
  );

drop policy if exists "progress_select_org_manager" on public.lesson_progress;
drop policy if exists "progress_select_same_org" on public.lesson_progress;
create policy "progress_select_same_org" on public.lesson_progress
  for select using (
    public.is_admin()
    or user_id in (select public.same_org_user_ids())
  );

drop policy if exists "deadlines_select_own_org" on public.course_deadlines;
create policy "deadlines_select_own_org" on public.course_deadlines
  for select using (
    public.is_admin()
    or org_id = public.current_org_id()
  );

drop policy if exists "deadlines_manage_own_org" on public.course_deadlines;
create policy "deadlines_manage_own_org" on public.course_deadlines
  for all using (
    public.is_admin()
    or (
      public.can_manage_org()
      and org_id = public.current_org_id()
      and public.user_belongs_to_org(user_id, org_id)
    )
  ) with check (
    public.is_admin()
    or (
      public.can_manage_org()
      and org_id = public.current_org_id()
      and public.user_belongs_to_org(user_id, org_id)
    )
  );
