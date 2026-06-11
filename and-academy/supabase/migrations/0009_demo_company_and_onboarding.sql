-- Demo customer tenant and the and° director onboarding course shell.

insert into public.courses (
  id,
  title,
  description,
  audience,
  sort_order,
  published
)
values (
  '40000000-0000-0000-0000-000000000002',
  'and°ディレクターオンボーディング',
  'and°のディレクター業務を始めるためのオンボーディング講座です。レッスン内容は準備中です。',
  'employee',
  2,
  true
)
on conflict (id) do update
set title = excluded.title,
    description = excluded.description,
    audience = excluded.audience,
    sort_order = excluded.sort_order,
    published = excluded.published;

insert into public.organization_courses (org_id, course_id, assigned_by)
values (
  '00000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000002',
  (
    select id
    from public.profiles
    where lower(email) = 'isao.mzk@gmail.com'
    limit 1
  )
)
on conflict (org_id, course_id) do nothing;

insert into public.organizations (id, name, access_enabled)
values (
  '50000000-0000-0000-0000-000000000001',
  '株式会社ネクストウェーブ（デモ）',
  true
)
on conflict (id) do update
set name = excluded.name,
    access_enabled = excluded.access_enabled;

insert into public.allowed_emails (email, role, org_id)
values
  (
    'manager.demo@nextwave.example',
    'manager',
    '50000000-0000-0000-0000-000000000001'
  ),
  (
    'aoki.demo@nextwave.example',
    'member',
    '50000000-0000-0000-0000-000000000001'
  ),
  (
    'mori.demo@nextwave.example',
    'member',
    '50000000-0000-0000-0000-000000000001'
  ),
  (
    'ishii.demo@nextwave.example',
    'member',
    '50000000-0000-0000-0000-000000000001'
  )
on conflict (email) do update
set role = excluded.role,
    org_id = excluded.org_id;

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
      '51000000-0000-0000-0000-000000000001'::uuid,
      'manager.demo@nextwave.example',
      '佐藤 健一（デモ）'
    ),
    (
      '51000000-0000-0000-0000-000000000002'::uuid,
      'aoki.demo@nextwave.example',
      '青木 美咲（デモ）'
    ),
    (
      '51000000-0000-0000-0000-000000000003'::uuid,
      'mori.demo@nextwave.example',
      '森 悠斗（デモ）'
    ),
    (
      '51000000-0000-0000-0000-000000000004'::uuid,
      'ishii.demo@nextwave.example',
      '石井 彩（デモ）'
    )
) as demo(id, email, full_name)
where not exists (
  select 1
  from auth.users existing
  where existing.id = demo.id
     or lower(existing.email) = lower(demo.email)
);

insert into public.profiles (id, email, full_name, role, org_id)
select
  users.id,
  users.email,
  demo.full_name,
  demo.role,
  '50000000-0000-0000-0000-000000000001'
from auth.users users
join (
  values
    ('manager.demo@nextwave.example', '佐藤 健一（デモ）', 'manager'),
    ('aoki.demo@nextwave.example', '青木 美咲（デモ）', 'member'),
    ('mori.demo@nextwave.example', '森 悠斗（デモ）', 'member'),
    ('ishii.demo@nextwave.example', '石井 彩（デモ）', 'member')
) as demo(email, full_name, role)
  on lower(users.email) = lower(demo.email)
on conflict (id) do update
set email = excluded.email,
    full_name = excluded.full_name,
    role = excluded.role,
    org_id = excluded.org_id;

insert into public.organization_courses (org_id, course_id, assigned_by)
values (
  '50000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  (
    select id
    from public.profiles
    where lower(email) = 'isao.mzk@gmail.com'
    limit 1
  )
)
on conflict (org_id, course_id) do nothing;

delete from public.lesson_progress
where user_id in (
  '51000000-0000-0000-0000-000000000001',
  '51000000-0000-0000-0000-000000000002',
  '51000000-0000-0000-0000-000000000003',
  '51000000-0000-0000-0000-000000000004'
);

with demo_progress as (
  select *
  from (
    values
      ('51000000-0000-0000-0000-000000000001'::uuid, 14, 15, 240),
      ('51000000-0000-0000-0000-000000000002'::uuid, 9, 10, 180),
      ('51000000-0000-0000-0000-000000000003'::uuid, 5, 6, 120),
      ('51000000-0000-0000-0000-000000000004'::uuid, 2, 3, 60)
  ) as progress(user_id, completed_count, started_lesson, position_seconds)
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
  demo.user_id,
  lessons.id,
  lessons.sort_order <= demo.completed_count,
  case
    when lessons.sort_order <= demo.completed_count then now() - interval '1 day'
    else null
  end,
  case
    when lessons.sort_order = demo.started_lesson then demo.position_seconds
    else 0
  end,
  now() - (lessons.sort_order || ' hours')::interval
from demo_progress demo
join public.lessons lessons
  on lessons.course_id = '40000000-0000-0000-0000-000000000001'
 and (
   lessons.sort_order <= demo.completed_count
   or lessons.sort_order = demo.started_lesson
 );

insert into public.course_deadlines (
  org_id,
  user_id,
  course_id,
  due_date,
  created_by,
  updated_at
)
select
  '50000000-0000-0000-0000-000000000001',
  demo.user_id,
  '40000000-0000-0000-0000-000000000001',
  current_date + demo.days_until_due,
  (
    select id
    from public.profiles
    where lower(email) = 'isao.mzk@gmail.com'
    limit 1
  ),
  now()
from (
  values
    ('51000000-0000-0000-0000-000000000001'::uuid, 21),
    ('51000000-0000-0000-0000-000000000002'::uuid, 28),
    ('51000000-0000-0000-0000-000000000003'::uuid, 35),
    ('51000000-0000-0000-0000-000000000004'::uuid, 42)
) as demo(user_id, days_until_due)
on conflict (user_id, course_id) do update
set due_date = excluded.due_date,
    created_by = excluded.created_by,
    updated_at = excluded.updated_at;
