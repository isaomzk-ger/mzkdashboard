-- ============================================================
-- and° Academy - サンプルデータ（動作確認用）
-- schema.sql 実行後に貼り付けて実行する
-- ============================================================

-- 講座
insert into courses (id, title, description, audience, sort_order, published) values
  ('11111111-1111-1111-1111-111111111111',
   '経営者のためのClaude入門',
   'なぜ今Claudeなのか。導入で会社の何が変わるかを15分で掴む。',
   'executive', 1, true),
  ('22222222-2222-2222-2222-222222222222',
   '従業員向け Claude 基本操作',
   'アカウント作成から日常業務での使い方まで。まずはここから。',
   'employee', 2, true)
on conflict (id) do nothing;

-- レッスン
insert into lessons (course_id, title, description, video_url, duration_seconds, sort_order) values
  ('11111111-1111-1111-1111-111111111111', 'Claudeとは何か', 'AIアシスタントの全体像', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 360, 1),
  ('11111111-1111-1111-1111-111111111111', '導入の投資対効果', 'コストと効果の考え方', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 480, 2),
  ('22222222-2222-2222-2222-222222222222', 'アカウントを作る', '初期セットアップ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 300, 1),
  ('22222222-2222-2222-2222-222222222222', '最初のプロンプト', '基本的な質問の仕方', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 420, 2),
  ('22222222-2222-2222-2222-222222222222', '業務での活用例', 'メール・要約・調査', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 540, 3)
on conflict do nothing;

-- 既存組織へサンプル講座を割り当て
insert into organization_courses (org_id, course_id)
select o.id, c.id
from organizations o
cross join courses c
where c.id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222'
)
on conflict (org_id, course_id) do nothing;
