# retro

直近のセッションを振り返り、コンテキスト（メモリ）を最新化し、スキル化候補を提案するスキル。
「直近◯週間振り返って」「コンテキスト更新して」「スキル化できるものある？」で発動する。

## 引数
- 振り返り期間（例: 「2週間」）。未指定なら直近2週間。

## 手順

### 1. 対象セッションを抽出する
過去セッションのトランスクリプトから、対象期間のユーザー発言（指示）だけを抽出する。
全文は読まず、ユーザーの指示行だけを拾って全体像を掴む（トークン節約）。

```bash
cd /Users/furusawasuisei/.claude/projects/-Users-furusawasuisei-Documents-Claude-Code/
python3 - <<'EOF'
import json, glob, os, datetime
cut = (datetime.datetime.now() - datetime.timedelta(days=14)).timestamp()  # 期間に応じて変更
for f in sorted(glob.glob("*.jsonl"), key=os.path.getmtime):
    if os.path.getmtime(f) < cut: continue
    msgs=[]
    for line in open(f):
        try: o=json.loads(line)
        except: continue
        if o.get("type")!="user": continue
        c=o.get("message",{}).get("content")
        t=c if isinstance(c,str) else " ".join(x.get("text","") for x in c if isinstance(x,dict) and x.get("type")=="text") if isinstance(c,list) else ""
        t=t.strip().replace("\n"," ")
        if t and not t.startswith("<") and "tool_result" not in t: msgs.append(t[:140])
    if msgs:
        print("="*60); print(datetime.datetime.fromtimestamp(os.path.getmtime(f)).strftime("%m/%d"), f[:8])
        for m in msgs[:8]: print("  -",m)
EOF
```
（補助的に `mcp__ccd_session_mgmt__list_sessions` でタイトル一覧も確認できる）

### 2. 変化点を洗い出す
抽出した指示から、メモリに反映すべき変化を分類する：
- **新しい人物**（取引先・関係者） → `people.md`
- **新しいプロジェクト/アプリ** → 新規 `project_*.md` を作成
- **方針・運用の変更** → 該当メモリ＋必要なら `CLAUDE.md`
- **古くなった/矛盾する記述** → 訂正（特に `MEMORY.md` 索引と `00_master_memory.md` の整合）

### 3. メモリを更新する
- `~/.claude/projects/.../memory/` 配下を更新
- 既存ファイルに該当があれば**新規作成せず追記/修正**（重複を作らない）
- 新規作成したら `MEMORY.md` に1行の索引を追加
- `00_master_memory.md` の「進行中プロジェクト」を最新化、`lastUpdated` を更新

### 4. スキル化候補を提案する
同じ種類の作業を**3回以上**繰り返していたものをスキル候補として挙げる。
- `.claude/commands/` の既存スキルと重複しないか確認する
- **作成前に必ずユーザーに確認を取る**（どれを作るか選んでもらう）

### 5. 報告する
更新したメモリ・訂正した矛盾点・スキル候補を表で報告し、次のアクションを明確にして終わる。

## 注意事項
- メモリは「書いた時点の観測」。ファイル名・URL・数値を断定する前に現物を確認する
- 確証のない情報で穴を埋めない。不明点は推測せず確認する
