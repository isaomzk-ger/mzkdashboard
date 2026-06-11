-- Run after migrations. All fixtures are rolled back.

begin;

insert into public.organizations (id, name, access_enabled) values
  ('a0000000-0000-0000-0000-000000000001', 'RLS Test Company A', true),
  ('b0000000-0000-0000-0000-000000000001', 'RLS Test Company B', true),
  ('c0000000-0000-0000-0000-000000000001', 'RLS Test Company C', false);

insert into public.allowed_emails (email, role, org_id) values
  (
    'rls-admin-a@example.test',
    'admin',
    'a0000000-0000-0000-0000-000000000001'
  ),
  (
    'rls-manager-a@example.test',
    'manager',
    'a0000000-0000-0000-0000-000000000001'
  ),
  (
    'rls-member-a@example.test',
    'member',
    'a0000000-0000-0000-0000-000000000001'
  ),
  (
    'rls-member-b@example.test',
    'member',
    'b0000000-0000-0000-0000-000000000001'
  ),
  (
    'rls-member-c@example.test',
    'member',
    'c0000000-0000-0000-0000-000000000001'
  );

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) values
  (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-0000-0000-000000000010',
    'authenticated',
    'authenticated',
    'rls-admin-a@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Admin A"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-0000-0000-000000000020',
    'authenticated',
    'authenticated',
    'rls-manager-a@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Manager A"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-0000-0000-000000000030',
    'authenticated',
    'authenticated',
    'rls-member-a@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Member A"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'b0000000-0000-0000-0000-000000000030',
    'authenticated',
    'authenticated',
    'rls-member-b@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Member B"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'c0000000-0000-0000-0000-000000000030',
    'authenticated',
    'authenticated',
    'rls-member-c@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Member C"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

insert into public.courses (
  id,
  title,
  audience,
  published,
  sort_order
) values
  (
    'a0000000-0000-0000-0000-000000000100',
    'RLS Course A',
    'employee',
    true,
    9001
  ),
  (
    'b0000000-0000-0000-0000-000000000100',
    'RLS Course B',
    'employee',
    true,
    9002
  );

insert into public.lessons (id, course_id, title, sort_order) values
  (
    'a0000000-0000-0000-0000-000000000200',
    'a0000000-0000-0000-0000-000000000100',
    'RLS Lesson A',
    1
  ),
  (
    'b0000000-0000-0000-0000-000000000200',
    'b0000000-0000-0000-0000-000000000100',
    'RLS Lesson B',
    1
  );

insert into public.organization_courses (org_id, course_id) values
  (
    'a0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000100'
  ),
  (
    'b0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000100'
  ),
  (
    'c0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000100'
  );

insert into public.lesson_progress (
  user_id,
  lesson_id,
  completed,
  completed_at
) values
  (
    'a0000000-0000-0000-0000-000000000030',
    'a0000000-0000-0000-0000-000000000200',
    true,
    now()
  ),
  (
    'b0000000-0000-0000-0000-000000000030',
    'b0000000-0000-0000-0000-000000000200',
    true,
    now()
  );

insert into public.course_deadlines (org_id, course_id, due_date) values
  (
    'a0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000100',
    '2030-01-01'
  ),
  (
    'b0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000100',
    '2030-01-02'
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'a0000000-0000-0000-0000-000000000030',
  true
);

do $$
begin
  if (select count(*) from public.courses where title like 'RLS Course%') <> 1
     or not exists (
       select 1 from public.courses
       where id = 'a0000000-0000-0000-0000-000000000100'
     )
     or exists (
       select 1 from public.courses
       where id = 'b0000000-0000-0000-0000-000000000100'
     ) then
    raise exception 'Member A course isolation failed';
  end if;

  if (select count(*) from public.lessons where title like 'RLS Lesson%') <> 1
     or exists (
       select 1 from public.lessons
       where id = 'b0000000-0000-0000-0000-000000000200'
     ) then
    raise exception 'Member A lesson isolation failed';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'c0000000-0000-0000-0000-000000000030',
  true
);

do $$
begin
  if exists (
    select 1 from public.courses where title like 'RLS Course%'
  ) or exists (
    select 1 from public.lessons where title like 'RLS Lesson%'
  ) then
    raise exception 'Inactive organization course access was not blocked';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'b0000000-0000-0000-0000-000000000030',
  true
);

do $$
begin
  if (select count(*) from public.courses where title like 'RLS Course%') <> 1
     or not exists (
       select 1 from public.courses
       where id = 'b0000000-0000-0000-0000-000000000100'
     )
     or exists (
       select 1 from public.courses
       where id = 'a0000000-0000-0000-0000-000000000100'
     ) then
    raise exception 'Member B course isolation failed';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'a0000000-0000-0000-0000-000000000020',
  true
);

do $$
declare
  assignment_was_blocked boolean := false;
begin
  if exists (
    select 1 from public.profiles
    where id = 'b0000000-0000-0000-0000-000000000030'
  ) then
    raise exception 'Manager A profile isolation failed';
  end if;

  if exists (
    select 1 from public.lesson_progress
    where user_id = 'b0000000-0000-0000-0000-000000000030'
  ) then
    raise exception 'Manager A progress isolation failed';
  end if;

  if exists (
    select 1 from public.course_deadlines
    where org_id = 'b0000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'Manager A deadline isolation failed';
  end if;

  begin
    perform public.set_organization_courses(
      'a0000000-0000-0000-0000-000000000001',
      array['b0000000-0000-0000-0000-000000000100'::uuid]
    );
  exception
    when others then
      assignment_was_blocked := sqlerrm = 'forbidden';
  end;

  if not assignment_was_blocked then
    raise exception 'Manager A assignment mutation was not blocked';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'a0000000-0000-0000-0000-000000000010',
  true
);

do $$
begin
  if (select count(*) from public.courses where title like 'RLS Course%') <> 2
     or (select count(*) from public.organizations where name like 'RLS Test%') <> 3
     or (select count(*) from public.profiles where email like 'rls-%') <> 5
     or (select count(*) from public.lesson_progress) <> 2
     or (select count(*) from public.course_deadlines) <> 2
     then
    raise exception 'Admin cross-organization access failed';
  end if;
end;
$$;

reset role;
rollback;
