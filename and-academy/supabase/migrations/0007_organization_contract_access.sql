-- Contract-level organization access.
-- A course assignment alone is not enough: the organization must also be active.

alter table public.organizations
  add column if not exists access_enabled boolean not null default false;

update public.organizations
set access_enabled = true
where id = '00000000-0000-0000-0000-000000000001';

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
      join public.organizations o on o.id = oc.org_id
      join public.courses c on c.id = oc.course_id
      where oc.org_id = public.current_org_id()
        and oc.course_id = target_course_id
        and o.access_enabled = true
        and c.published = true
    );
$$;
