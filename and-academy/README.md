# and° Academy

経営者・従業員向け Claude 導入 動画講座の e ラーニング基盤（土台）。
コンテンツ（講座・動画）は別担当が登録する前提で、プラットフォーム側を構築している。

本番URL: https://mzkdashboard.vercel.app （Next.js / Vercel）

## 技術スタック

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4
- Supabase（認証 / Postgres / RLS）

## できること（実装済みの土台）

| 機能 | 内容 |
|---|---|
| 認証 | メール＋パスワードでログイン / 新規登録（Supabase Auth） |
| 講座視聴 | 講座一覧 → 講座詳細（レッスン一覧）→ レッスン視聴（動画埋め込み） |
| 進捗保存 | レッスンごとの完了状態を保存。一覧に進捗バー表示 |
| 管理画面 | 管理者が同組織メンバーの受講状況（完了率）を一覧 |

ロールは `admin` / `member` の2種。動画は `video_url` をプロバイダ非依存で保持し、
YouTube / Vimeo / 直リンクを `src/lib/video.ts` で埋め込みURLに変換する（差し替え容易）。

## セットアップ

1. Supabase プロジェクトを作成
2. SQL Editor で `supabase/schema.sql` を実行（テーブル・RLS・トリガー）
3. 動作確認用に `supabase/seed.sql` を実行（サンプル講座）
4. `.env.local.example` を `.env.local` にコピーし、URL と anon key を設定
5. 開発サーバー起動

```bash
npm install
npm run dev
```

## 管理者にする方法

新規登録すると `member` で作成される。管理者にするには Supabase の
`profiles` テーブルで対象ユーザーの `role` を `admin` に、`org_id` を
所属組織の ID に設定する（同 `org_id` のメンバーが管理画面に表示される）。

## ディレクトリ

```
src/
  app/
    page.tsx              ランディング
    login/                ログイン / 新規登録
    actions.ts            サーバーアクション（サインアウト・進捗保存）
    (main)/               ナビ付きの認証後エリア
      courses/            講座一覧・詳細
      learn/[lessonId]/   レッスン視聴
      admin/              管理ダッシュボード
  components/             Nav / CompleteButton
  lib/
    supabase/             client / server / middleware
    auth.ts video.ts types.ts
  middleware.ts           セッション更新＋保護ルートのガード
supabase/
  schema.sql seed.sql
```

## 未実装（次担当への引き継ぎ候補）

- 講座・レッスンの管理用 CRUD 画面（現状は Supabase 直接登録）
- Stripe 等による席課金
- 動画配信の本番選定（Vimeo / DRM 等）
- 視聴位置の自動保存（`last_position_seconds` の列は用意済み）
