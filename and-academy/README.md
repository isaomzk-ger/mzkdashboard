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
| 管理画面 | 氏名・メール検索、進捗絞り込み、並び替え、25人単位のページ分割 |
| メンバー詳細 | 同組織メンバーの講座別進捗、締切、最終受講日時を確認 |
| 学習再開 | 視聴位置を自動保存し、講座一覧から続きの動画を再開 |
| 学習導線 | 次に受講するレッスンと組織ごとの講座締切を表示 |
| 講座割り当て | 運営管理者が顧客企業ごとに受講可能な講座を設定 |
| エラー監視 | Sentryでブラウザ・サーバー双方の例外を収集 |
| 動画保護 | 組織アクセス制御、利用者ウォーターマーク、直接URLの初期無効化 |

ロールは `admin` / `manager` / `member` の3種。`admin` は運営側として
講座コンテンツを管理し、`manager` は顧客企業側として自社メンバーの進捗と締切だけを
管理する。動画は `video_url` をプロバイダ非依存で保持し、YouTube / Vimeo /
直リンクを `src/lib/video.ts` で処理する。

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

### 本番環境変数

| 変数 | 用途 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentryの公開DSN |
| `SENTRY_DSN` | サーバー側Sentry DSN（公開DSNと同値可） |
| `SENTRY_ORG` | Sentry organization slug |
| `SENTRY_PROJECT` | Sentry project slug |
| `SENTRY_AUTH_TOKEN` | source mapアップロード用 |

稼働確認URLは `/api/health`。正常時はHTTP 200、DB接続異常時は503を返す。

## 管理者にする方法

招待時に `allowed_emails.role` を設定する。運営担当者は `admin`、顧客企業の
管理者は `manager`、受講者は `member` にする。同じ `org_id` のメンバーだけが
顧客企業の管理画面に表示される。

運営 `admin` は「管理 → 講座を割り当て」から、各組織が受講できる講座を設定する。
割り当てを解除すると、その組織の講座締切も削除される。

## 動画の保護設定

- YouTubeの限定公開はURLを知る人が共有できるため、強い転載対策には向かない
- Vimeoは埋め込み先を `mzkdashboard.vercel.app` のみに設定する
- Vimeo側のダウンロード許可をオフにする
- アプリ上では受講者メール入りの移動ウォーターマークを動画へ重ねる
- 直接MP4 URLは既定で拒否する。例外時のみ
  `ALLOW_DIRECT_VIDEO_URLS=true` を設定する

画面録画を完全に防ぐことはできない。機密性が高い教材ではVimeoのドメイン制限、
ダウンロード無効化、ウォーターマークを併用する。

## 権限テスト

`supabase/tests/organization_isolation.sql` はA社・B社の仮データを使い、
講座・レッスン・プロフィール・進捗の組織分離と、企業管理者による割り当て変更の
拒否を検証する。テストデータは最後にロールバックされる。

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

## 未実装（次の候補）

- Stripe 等による席課金
- 動画配信の本番選定（Vimeo / DRM 等）
- 課題提出と AI 一次フィードバック
- メール・Slack 等への停滞通知
