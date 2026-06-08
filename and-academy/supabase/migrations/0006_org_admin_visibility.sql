-- Organization manager visibility rules.
-- - and° admins can see all organizations.
-- - Customer managers can see only members/progress/deadlines in their organization.

insert into public.organizations (id, name)
values ('00000000-0000-0000-0000-000000000001', 'and°')
on conflict (id) do update
set name = excluded.name;

insert into public.allowed_emails (email, role, org_id)
values
  ('isao.mzk@gmail.com', 'admin', '00000000-0000-0000-0000-000000000001'),
  ('07.shoma.19@gmail.com', 'admin', '00000000-0000-0000-0000-000000000001'),
  ('shearergoleiro1989@gmail.com', 'admin', '00000000-0000-0000-0000-000000000001'),
  ('ma2moto2tom@gmail.com', 'admin', '00000000-0000-0000-0000-000000000001')
on conflict (email) do update
set role = excluded.role,
    org_id = excluded.org_id;

update public.profiles
set role = 'admin',
    org_id = '00000000-0000-0000-0000-000000000001'
where lower(email) in (
  'isao.mzk@gmail.com',
  '07.shoma.19@gmail.com',
  'shearergoleiro1989@gmail.com',
  'ma2moto2tom@gmail.com'
);

drop policy if exists "profiles_select_org_manager" on public.profiles;
create policy "profiles_select_org_manager" on public.profiles
  for select using (
    public.is_admin()
    or (
      public.can_manage_org()
      and id in (select public.same_org_user_ids())
    )
  );

drop policy if exists "progress_select_org_manager" on public.lesson_progress;
create policy "progress_select_org_manager" on public.lesson_progress
  for select using (
    public.is_admin()
    or (
      public.can_manage_org()
      and user_id in (select public.same_org_user_ids())
    )
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
    )
  ) with check (
    public.is_admin()
    or (
      public.can_manage_org()
      and org_id = public.current_org_id()
    )
  );
