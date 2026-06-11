-- 株式会社and°向けデモ講座
-- CSVの外側の項目（フェーズ・タイトル・対象・想定時間）のみ反映する。

begin;

update public.courses
set published = false
where id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222'
);

insert into public.courses (
  id,
  title,
  description,
  audience,
  sort_order,
  published
)
values (
  '40000000-0000-0000-0000-000000000001',
  '30日で会社にAIを定着させる実践講座',
  '非エンジニアでも取り組める、法人向けAI業務活用プログラム。全20レッスン・約5時間。',
  'employee',
  1,
  true
)
on conflict (id) do update
set title = excluded.title,
    description = excluded.description,
    audience = excluded.audience,
    sort_order = excluded.sort_order,
    published = excluded.published;

delete from public.lessons
where course_id = '40000000-0000-0000-0000-000000000001';

insert into public.lessons (
  id,
  course_id,
  title,
  description,
  duration_seconds,
  sort_order
)
values
  (
    '41000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    'AIで会社の仕事はどこまで楽になるのか',
    'フェーズ: 導入 / 対象: 経営者・管理職',
    720,
    1
  ),
  (
    '41000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000001',
    'Claude Codeとは何か：非エンジニア向け超入門',
    'フェーズ: 導入 / 対象: 全員',
    600,
    2
  ),
  (
    '41000000-0000-0000-0000-000000000003',
    '40000000-0000-0000-0000-000000000001',
    'AIに仕事を頼む前の業務棚卸し',
    'フェーズ: 導入 / 対象: 経営者・リーダー',
    840,
    3
  ),
  (
    '41000000-0000-0000-0000-000000000004',
    '40000000-0000-0000-0000-000000000001',
    'AIへの指示文の作り方：社内スタッフに頼むように頼む',
    'フェーズ: 基礎操作 / 対象: 全員',
    780,
    4
  ),
  (
    '41000000-0000-0000-0000-000000000005',
    '40000000-0000-0000-0000-000000000001',
    '社内ルールをAIに覚えさせる：CLAUDE.mdの考え方',
    'フェーズ: 基礎操作 / 対象: 経営者・管理職・担当者',
    900,
    5
  ),
  (
    '41000000-0000-0000-0000-000000000006',
    '40000000-0000-0000-0000-000000000001',
    'AIに計画させてから実行させる：失敗を減らすPlanの使い方',
    'フェーズ: 基礎操作 / 対象: 全員',
    720,
    6
  ),
  (
    '41000000-0000-0000-0000-000000000007',
    '40000000-0000-0000-0000-000000000001',
    '会議メモから議事録・タスク表を自動で作る',
    'フェーズ: 資料作成 / 対象: 従業員・管理職',
    840,
    7
  ),
  (
    '41000000-0000-0000-0000-000000000008',
    '40000000-0000-0000-0000-000000000001',
    '提案書・見積書・営業資料のたたき台を作る',
    'フェーズ: 資料作成 / 対象: 営業・経営者',
    960,
    8
  ),
  (
    '41000000-0000-0000-0000-000000000009',
    '40000000-0000-0000-0000-000000000001',
    '社内マニュアルをAIで作る：新人教育を楽にする',
    'フェーズ: 資料作成 / 対象: 管理職・教育担当',
    900,
    9
  ),
  (
    '41000000-0000-0000-0000-000000000010',
    '40000000-0000-0000-0000-000000000001',
    'Excel・Numbersの売上データから改善点を見つける',
    'フェーズ: 分析 / 対象: 経営者・経理・管理職',
    1020,
    10
  ),
  (
    '41000000-0000-0000-0000-000000000011',
    '40000000-0000-0000-0000-000000000001',
    '経営ダッシュボードの考え方：毎朝見る数字を決める',
    'フェーズ: 分析 / 対象: 経営者',
    960,
    11
  ),
  (
    '41000000-0000-0000-0000-000000000012',
    '40000000-0000-0000-0000-000000000001',
    '問い合わせ・商談メモからCRMを更新する',
    'フェーズ: 営業効率化 / 対象: 営業・管理職',
    960,
    12
  ),
  (
    '41000000-0000-0000-0000-000000000013',
    '40000000-0000-0000-0000-000000000001',
    'メール・LINE返信文をAIで下書きする',
    'フェーズ: 営業効率化 / 対象: 全員',
    780,
    13
  ),
  (
    '41000000-0000-0000-0000-000000000014',
    '40000000-0000-0000-0000-000000000001',
    'ホームページ・SNS・YouTubeの改善案をAIに出させる',
    'フェーズ: マーケ / 対象: 経営者・広報・営業',
    1020,
    14
  ),
  (
    '41000000-0000-0000-0000-000000000015',
    '40000000-0000-0000-0000-000000000001',
    '求人票・スカウト文・面接質問をAIで作る',
    'フェーズ: 採用・人事 / 対象: 経営者・採用担当',
    960,
    15
  ),
  (
    '41000000-0000-0000-0000-000000000016',
    '40000000-0000-0000-0000-000000000001',
    '在庫・予約・シフトなど現場の表を整える',
    'フェーズ: 現場改善 / 対象: 店舗・現場管理者',
    900,
    16
  ),
  (
    '41000000-0000-0000-0000-000000000017',
    '40000000-0000-0000-0000-000000000001',
    'Notion・Google Drive・フォルダ整理をAIで自動化する',
    'フェーズ: 自動化 / 対象: 管理職・事務',
    1080,
    17
  ),
  (
    '41000000-0000-0000-0000-000000000018',
    '40000000-0000-0000-0000-000000000001',
    'AI秘書を作る：朝の確認・日次報告・リマインド',
    'フェーズ: 自動化 / 対象: 経営者・管理職',
    960,
    18
  ),
  (
    '41000000-0000-0000-0000-000000000019',
    '40000000-0000-0000-0000-000000000001',
    'AI活用の社内ルール：情報漏洩・品質・責任分界点',
    'フェーズ: 運用・安全 / 対象: 経営者・管理職',
    900,
    19
  ),
  (
    '41000000-0000-0000-0000-000000000020',
    '40000000-0000-0000-0000-000000000001',
    '30日で自社にAIを定着させる実行計画',
    'フェーズ: 実装まとめ / 対象: 経営者・管理職',
    1080,
    20
  );

delete from public.organization_courses
where org_id = '00000000-0000-0000-0000-000000000001'
  and course_id <> '40000000-0000-0000-0000-000000000001';

insert into public.organization_courses (org_id, course_id, assigned_by)
values (
  '00000000-0000-0000-0000-000000000001',
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
  '30000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000003'
);

with demo_progress as (
  select *
  from (
    values
      ('30000000-0000-0000-0000-000000000001'::uuid, 16, 17, 300),
      ('30000000-0000-0000-0000-000000000002'::uuid, 8, 9, 180),
      ('30000000-0000-0000-0000-000000000003'::uuid, 4, 5, 90)
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

delete from public.course_deadlines
where org_id = '00000000-0000-0000-0000-000000000001'
  and course_id <> '40000000-0000-0000-0000-000000000001';

insert into public.course_deadlines (
  org_id,
  course_id,
  due_date,
  created_by,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  current_date + 30,
  (
    select id
    from public.profiles
    where lower(email) = 'isao.mzk@gmail.com'
    limit 1
  ),
  now()
)
on conflict (org_id, course_id) do update
set due_date = excluded.due_date,
    created_by = excluded.created_by,
    updated_at = excluded.updated_at;

commit;
