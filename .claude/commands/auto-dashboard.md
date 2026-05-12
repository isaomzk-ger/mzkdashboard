# auto-dashboard

毎朝8時に自動実行される非対話型のダッシュボード更新スキル。
ユーザーへの確認・ヒアリングは一切行わず、データソースから自動で取得して完結させる。

## ダッシュボードファイルのパス

`/Users/furusawasuisei/Documents/Claude Code/dashboard.html`

## 実行手順

### 1. 今日の日付を確認（JST）

```bash
TZ=Asia/Tokyo date '+%Y-%m-%d'
```

曜日も取得してJST表記にする（例: `5月12日（火）`）。
今週の月曜〜日曜の日付も算出しておく（panel-week更新に使う）。

### 2. Notionからタスクを取得

`notion-fetch` で **2つのDB** からタスクを取得する：

**① 全案件タスク管理DB（共有）**
- URL: https://www.notion.so/e9f02576532f4e40a018b39dbe70cf2b
- 取得対象: 未完了タスク（ステータスが完了以外）

**② and°タスク管理DB**
- URL: https://www.notion.so/33c4b5f36fc680d497d7d4486fab4d20
- 取得対象: 未完了タスク（ステータスが完了以外）

取得したタスクを統合し、重複を除去する。
プライベートタスク（個人的な買い物・旅行等）は除外する。

### 3. Googleカレンダーから予定を取得

`list_events` で今週分（今日〜7日後）の予定を取得する（JST）。

- 今日の予定 → panel-today の「今日の予定」セクション用
- 今週の予定 → panel-week のウィークグリッド用

### 4. 優先度スコアリング（自動判定）

**緊急度**（期限ベース）
- 🔴 高：今日期限・期限超過・明日以内
- 🟡 中：今週中（2〜7日後）
- 🟢 低：期限なし・来週以降

**最終的な優先グループ**（3段階）
- 🔴 高優先：今日・明日期限 / クライアント直結の急ぎ
- 🟡 中優先：今週期限 / 業務改善・マニュアル・自動化
- 🟢 低優先：それ以外

### 5. dashboard.html を更新

ファイルをReadしてから以下のセクションを書き換える。

#### ① ヘッダーの日付ピル（id="today-pill"）

```html
<div class="date-pill" id="today-pill">5月12日（火）</div>
```
→ 今日の日付に更新

#### ② ヘッダーの優先度カウント（id="hstat-high" / id="hstat-mid"）

```html
<div class="hstat hstat-red" id="hstat-high">🔴 N 高</div>
<div class="hstat hstat-yellow" id="hstat-mid">🟡 N 中</div>
```
→ N を各グループのタスク数に更新

#### ③ タスクグループ（panel-today内）

3つのタスクグループ（高・中・低）の `<a class="task-row" ...>` 要素をNotionから取得したタスクで差し替える。

タスク1件のHTMLフォーマット：
```html
<a class="task-row" href="https://www.notion.so/[page-id]" target="_blank" data-p="high">
  <div class="p-dot p-high"></div>
  <div class="task-check"></div>
  <div class="task-name">[タスク名]</div>
  <span class="task-tag tag-[案件タグ]">[案件名]</span>
</a>
```

優先度のマッピング（data-p と p-dot クラス）：
- 高優先: `data-p="high"`, `p-high`
- 中優先: `data-p="mid"`, `p-mid`
- 低優先: `data-p="low"`, `p-low`

案件タグのマッピング：
- and° → `tag-and`（表示: `and°`）
- ミステリーナイト → `tag-mystery`（表示: `ミステリーナイト`）
- ダイロクチャンネル → `tag-dairoku`（表示: `ダイロクチャンネル`）
- ライズファン → `tag-risefan`（表示: `ライズファン`）
- その他 → `tag-other`（表示: `その他`）

task-progressバッジも更新：
```html
<div class="card-badge" id="task-progress">0 / N 完了</div>
```

#### ④ 今日のカレンダー（panel-today内 「今日の予定」セクション）

`<!-- Today's Schedule -->` の `.cal-event` 要素をGoogleカレンダーの今日の予定で差し替える。

カレンダーイベント1件のHTMLフォーマット：
```html
<div class="cal-event">
  <div class="cal-time">HH:MM</div>
  <div class="cal-bar" style="background:[色]"></div>
  <div class="cal-body">
    <div class="cal-title">[イベント名]</div>
    <div class="cal-meta">〜HH:MM</div>
  </div>
</div>
```

色のルール：
- 仕事系MTG: `#4f6ef7`
- 運動・健康: `#10b981`
- 飲み会・食事: `#f97316`
- その他: `#8b5cf6`

予定がない場合：
```html
<div style="padding:16px;text-align:center;color:var(--muted);font-size:12px;">予定なし</div>
```

#### ⑤ 今週のカレンダー（panel-week内）

ヘッダーバッジを更新：
```html
<div class="card-badge">5月12日〜18日</div>
```

`.week-grid` 内の7つの `.week-day` を今週の予定で差し替える。
今日の日付のカラムには `class="week-day today"` を付ける。

曜日カラム1件のHTMLフォーマット：
```html
<div class="week-day">
  <div class="week-day-header">
    <div class="week-day-name">[曜]</div>
    <div class="week-day-num">[日]</div>
  </div>
  <div class="week-event" style="background:[色-light];color:[色-dark];">
    <div class="we-dot" style="background:[色]"></div>HH:MM [イベント名]
  </div>
</div>
```

予定がない曜日は week-event なしで空のカラムにする。

### 6. git commit & push

```bash
cd "/Users/furusawasuisei/Documents/Claude Code"
git add dashboard.html
git commit -m "Dashboard update $(TZ=Asia/Tokyo date '+%Y-%m-%d')"
git push
```

### 7. 実行ログに記録

```bash
echo "[$(TZ=Asia/Tokyo date '+%Y-%m-%d %H:%M JST')] 更新完了 - 高:N件 中:M件 低:L件 / カレンダー:K件" >> "/Users/furusawasuisei/Documents/Claude Code/output/auto_update.log"
```

## 注意事項

- ユーザーへの確認・質問は一切しない
- Notion取得に失敗した場合は前日のタスクリストをそのまま保持し、日付・カレンダーのみ更新する
- カレンダー取得に失敗した場合は「予定なし」を表示
- エラーがあれば `output/auto_update.log` に記録して処理を続行する
- タスクの完了状態はリセットしない（前日Notionで完了済みなら翌日は取得されない仕組み）
- 対象ファイルは `dashboard.html`（ルート直下）のみ。`output/dashboard.html` は使わない
