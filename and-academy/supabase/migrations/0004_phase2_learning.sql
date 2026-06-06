-- Phase 2: customer managers, organization course deadlines, and management RLS.

alter table public.profiles
  add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and p.email is null;

alter table public.profiles
  drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'manager', 'member'));

alter table public.allowed_emails
  drop constraint if exists allowed_emails_role_check;
alter table public.allowed_emails
  add constraint allowed_emails_role_check
  check (role in ('admin', 'manager', 'member'));

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

create or replace function public.can_manage_org()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin', 'manager')
  );
$$;

drop policy if exists "profiles_select_org_admin" on public.profiles;
create policy "profiles_select_org_manager" on public.profiles
  for select using (
    public.can_manage_org()
    and id in (select public.same_org_user_ids())
  );

drop policy if exists "progress_select_org_admin" on public.lesson_progress;
create policy "progress_select_org_manager" on public.lesson_progress
  for select using (
    public.can_manage_org()
    and user_id in (select public.same_org_user_ids())
  );

create table if not exists public.course_deadlines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  course_id uuid not null references public.courses on delete cascade,
  due_date date not null,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, course_id)
);

create index if not exists idx_course_deadlines_org
  on public.course_deadlines (org_id);

alter table public.course_deadlines enable row level security;

create policy "deadlines_select_own_org" on public.course_deadlines
  for select using (
    org_id = (
      select p.org_id
      from public.profiles p
      where p.id = auth.uid()
    )
  );

create policy "deadlines_manage_own_org" on public.course_deadlines
  for all
  using (
    public.can_manage_org()
    and org_id = (
      select p.org_id
      from public.profiles p
      where p.id = auth.uid()
    )
  )
  with check (
    public.can_manage_org()
    and org_id = (
      select p.org_id
      from public.profiles p
      where p.id = auth.uid()
    )
  );
