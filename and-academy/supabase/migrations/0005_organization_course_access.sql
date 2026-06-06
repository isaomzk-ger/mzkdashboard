-- Organization course assignments and tenant-isolated course access.

create table if not exists public.organization_courses (
  org_id uuid not null references public.organizations on delete cascade,
  course_id uuid not null references public.courses on delete cascade,
  assigned_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  primary key (org_id, course_id)
);

create index if not exists idx_organization_courses_course
  on public.organization_courses (course_id);

-- Preserve current behavior during migration. Admins can remove assignments later.
insert into public.organization_courses (org_id, course_id)
select o.id, c.id
from public.organizations o
cross join public.courses c
where c.published = true
on conflict (org_id, course_id) do nothing;

insert into public.organization_courses (org_id, course_id)
select d.org_id, d.course_id
from public.course_deadlines d
on conflict (org_id, course_id) do nothing;

alter table public.organization_courses enable row level security;

create or replace function public.current_org_id()
returns uuid
language sql
security definer set search_path = public
stable
as $$
  select p.org_id
  from public.profiles p
  where p.id = auth.uid();
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

create policy "organization_courses_select_own" on public.organization_courses
  for select using (
    public.is_admin() or org_id = public.current_org_id()
  );

create policy "organization_courses_admin_all" on public.organization_courses
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "orgs_admin_all" on public.organizations;
create policy "orgs_admin_all" on public.organizations
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "courses_select_published" on public.courses;
create policy "courses_select_assigned" on public.courses
  for select using (
    published = true and public.can_access_course(id)
  );

drop policy if exists "lessons_select_published" on public.lessons;
create policy "lessons_select_assigned" on public.lessons
  for select using (public.can_access_course(course_id));

alter table public.course_deadlines
  drop constraint if exists course_deadlines_assignment_fkey;
alter table public.course_deadlines
  add constraint course_deadlines_assignment_fkey
  foreign key (org_id, course_id)
  references public.organization_courses (org_id, course_id)
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

  if not exists (
    select 1 from public.organizations where id = target_org_id
  ) then
    raise exception 'organization_not_found';
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

revoke all on function public.set_organization_courses(uuid, uuid[]) from public;
grant execute on function public.set_organization_courses(uuid, uuid[])
  to authenticated;
