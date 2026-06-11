-- Demo tenant: 株式会社and°
-- Furusawa remains the platform admin. Hara and Matsumoto manage this tenant.
-- Demo learners are internal records and cannot sign in.

begin;

insert into public.organizations (id, name, access_enabled)
values ('00000000-0000-0000-0000-000000000001', '株式会社and°', true)
on conflict (id) do update
set name = excluded.name,
    access_enabled = excluded.access_enabled;

insert into public.allowed_emails (email, role, org_id)
values
  ('isao.mzk@gmail.com', 'admin', '00000000-0000-0000-0000-000000000001'),
  ('07.shoma.19@gmail.com', 'manager', '00000000-0000-0000-0000-000000000001'),
  ('ma2moto2tom@gmail.com', 'manager', '00000000-0000-0000-0000-000000000001'),
  ('shearergoleiro1989@gmail.com', 'manager', '00000000-0000-0000-0000-000000000001'),
  ('honda.demo@and-academy.invalid', 'member', '00000000-0000-0000-0000-000000000001'),
  ('kanomata.demo@and-academy.invalid', 'member', '00000000-0000-0000-0000-000000000001'),
  ('shintani.demo@and-academy.invalid', 'member', '00000000-0000-0000-0000-000000000001')
on conflict (email) do update
set role = excluded.role,
    org_id = excluded.org_id;

update public.profiles
set full_name = case lower(email)
      when 'isao.mzk@gmail.com' then '古澤'
      when '07.shoma.19@gmail.com' then '原'
      when 'ma2moto2tom@gmail.com' then '松本'
      else full_name
    end,
    role = case lower(email)
      when 'isao.mzk@gmail.com' then 'admin'
      else 'manager'
    end,
    org_id = '00000000-0000-0000-0000-000000000001'
where lower(email) in (
  'isao.mzk@gmail.com',
  '07.shoma.19@gmail.com',
  'ma2moto2tom@gmail.com',
  'shearergoleiro1989@gmail.com'
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
  updated_at
)
select
  '00000000-0000-0000-0000-000000000000',
  demo.id,
  'authenticated',
  'authenticated',
  demo.email,
  '',
  now(),
  '{"provider":"email","providers":["email"],"demo":true}'::jsonb,
  jsonb_build_object('full_name', demo.full_name, 'demo', true),
  now(),
  now()
from (
  values
    (
      '30000000-0000-0000-0000-000000000001'::uuid,
      'honda.demo@and-academy.invalid',
      '本田'
    ),
    (
      '30000000-0000-0000-0000-000000000002'::uuid,
      'kanomata.demo@and-academy.invalid',
      '鹿又'
    ),
    (
      '30000000-0000-0000-0000-000000000003'::uuid,
      'shintani.demo@and-academy.invalid',
      '新谷'
    )
) as demo(id, email, full_name)
where not exists (
  select 1
  from auth.users existing
  where lower(existing.email) = lower(demo.email)
);

insert into public.profiles (id, email, full_name, role, org_id)
select
  users.id,
  users.email,
  demo.full_name,
  'member',
  '00000000-0000-0000-0000-000000000001'
from auth.users users
join (
  values
    ('honda.demo@and-academy.invalid', '本田'),
    ('kanomata.demo@and-academy.invalid', '鹿又'),
    ('shintani.demo@and-academy.invalid', '新谷')
) as demo(email, full_name)
  on lower(users.email) = lower(demo.email)
on conflict (id) do update
set email = excluded.email,
    full_name = excluded.full_name,
    role = excluded.role,
    org_id = excluded.org_id;

insert into public.organization_courses (org_id, course_id, assigned_by)
select
  '00000000-0000-0000-0000-000000000001',
  courses.id,
  (
    select id
    from public.profiles
    where lower(email) = 'isao.mzk@gmail.com'
    limit 1
  )
from public.courses courses
where courses.published = true
on conflict (org_id, course_id) do nothing;

delete from public.lesson_progress
where user_id in (
  select id
  from auth.users
  where lower(email) in (
    'honda.demo@and-academy.invalid',
    'kanomata.demo@and-academy.invalid',
    'shintani.demo@and-academy.invalid'
  )
);

with ordered_lessons as (
  select
    lessons.id,
    row_number() over (
      order by courses.sort_order, courses.created_at, lessons.sort_order, lessons.created_at
    ) as lesson_number
  from public.lessons lessons
  join public.courses courses on courses.id = lessons.course_id
  join public.organization_courses assignments
    on assignments.course_id = courses.id
   and assignments.org_id = '00000000-0000-0000-0000-000000000001'
  where courses.published = true
),
demo_progress as (
  select *
  from (
    values
      ('honda.demo@and-academy.invalid', 4, 5, 300),
      ('kanomata.demo@and-academy.invalid', 2, 3, 180),
      ('shintani.demo@and-academy.invalid', 1, 2, 90)
  ) as progress(email, completed_count, started_lesson, position_seconds)
)
insert into public.lesson_progress (
  user_id,
  lesson_id,
  completed,
  completed_at,
  last_position_seconds,
  updated_at
)
select
  users.id,
  lessons.id,
  lessons.lesson_number <= demo.completed_count,
  case
    when lessons.lesson_number <= demo.completed_count then now() - interval '1 day'
    else null
  end,
  case
    when lessons.lesson_number = demo.started_lesson then demo.position_seconds
    else 0
  end,
  now() - (lessons.lesson_number || ' hours')::interval
from demo_progress demo
join auth.users users on lower(users.email) = lower(demo.email)
join ordered_lessons lessons
  on lessons.lesson_number <= demo.completed_count
  or lessons.lesson_number = demo.started_lesson;

insert into public.course_deadlines (
  org_id,
  course_id,
  due_date,
  created_by,
  updated_at
)
select
  '00000000-0000-0000-0000-000000000001',
  courses.id,
  current_date + case when courses.audience = 'executive' then 30 else 45 end,
  (
    select id
    from public.profiles
    where lower(email) = 'isao.mzk@gmail.com'
    limit 1
  ),
  now()
from public.courses courses
join public.organization_courses assignments
  on assignments.course_id = courses.id
 and assignments.org_id = '00000000-0000-0000-0000-000000000001'
where courses.published = true
on conflict (org_id, course_id) do update
set due_date = excluded.due_date,
    created_by = excluded.created_by,
    updated_at = excluded.updated_at;

commit;
