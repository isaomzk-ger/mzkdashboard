#!/usr/bin/env python3
"""
Daily dashboard updater
Notion + Google Calendar → dashboard.html の DAILY_DATA を自動更新する。
"""

import json
import os
import re
import sys
from datetime import datetime, timezone, timedelta

try:
    import requests
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests", "-q"])
    import requests

JST = timezone(timedelta(hours=9))

# ── Notion ─────────────────────────────────────────────────────────────────

NOTION_VERSION = "2022-06-28"
DB_ALL_TASKS   = "e9f02576532f4e40a018b39dbe70cf2b"  # 📋 全案件タスク管理
DB_AND         = "33c4b5f36fc680d497d7d4486fab4d20"  # and°タスク管理

PROJECT_MAP = {
    "ミステリーナイト": "mystery",
    "ライズファン":     "risefan",
    "その他":           "other",
}


def notion_query(db_id: str, token: str) -> list:
    resp = requests.post(
        f"https://api.notion.com/v1/databases/{db_id}/query",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Notion-Version": NOTION_VERSION,
        },
        json={
            "filter": {
                "or": [
                    {"property": "ステータス", "status": {"equals": "未着手"}},
                    {"property": "ステータス", "status": {"equals": "進行中"}},
                ]
            },
            "page_size": 100,
        },
        timeout=20,
    )
    resp.raise_for_status()
    return resp.json().get("results", [])


def extract_priority(props: dict, is_and_db: bool) -> str:
    sel = (props.get("優先度") or {}).get("select") or {}
    name = sel.get("name", "")
    # and°DB: "高"/"中"/"低"  |  全案件DB: "🔴 高"/"🟡 中"/"🟢 低"
    if "高" in name:
        return "high"
    if "中" in name:
        return "mid"
    return "low"


def page_to_task(page: dict, is_and_db: bool) -> dict | None:
    props = page["properties"]

    # タスク名
    title_runs = (props.get("タスク名") or {}).get("title") or []
    name = "".join(t.get("plain_text", "") for t in title_runs).strip()
    if not name:
        return None

    # ステータス再確認（念のため）
    status_name = ((props.get("ステータス") or {}).get("status") or {}).get("name", "")
    if status_name == "完了":
        return None

    priority = extract_priority(props, is_and_db)

    project = "and" if is_and_db else PROJECT_MAP.get(
        ((props.get("案件名") or {}).get("select") or {}).get("name", ""), "other"
    )

    due = ""
    date_prop = (props.get("期日") or {}).get("date") or {}
    if date_prop.get("start"):
        due = date_prop["start"][:10]

    page_id = page["id"].replace("-", "")
    return {
        "id":       page_id[:16],
        "name":     name,
        "priority": priority,
        "project":  project,
        "due":      due,
        "url":      f"https://www.notion.so/{page_id}",
    }


def get_tasks(token: str) -> list:
    tasks, seen = [], set()
    for db_id, is_and in [(DB_ALL_TASKS, False), (DB_AND, True)]:
        try:
            pages = notion_query(db_id, token)
        except Exception as e:
            print(f"[WARN] Notion {db_id}: {e}", file=sys.stderr)
            continue
        for page in pages:
            task = page_to_task(page, is_and)
            if task and task["id"] not in seen:
                seen.add(task["id"])
                tasks.append(task)

    order = {"high": 0, "mid": 1, "low": 2}
    tasks.sort(key=lambda t: (order.get(t["priority"], 9), t["due"] or "9999"))
    return tasks


# ── Google Calendar ─────────────────────────────────────────────────────────

WORK_KW   = ["MTG","面談","相談","打合","ミーティング","会議","KNCT","キーサイト","アールイズ","オンライン","ミーティング"]
HEALTH_KW = ["ジム","ランニング","HYROX","運動","walk","Walk","ウォーク"]
FOOD_KW   = ["食事","飲み","ランチ","ディナー","パーティ","ごはん","宴会"]


def categorize(title: str) -> str:
    if any(k in title for k in HEALTH_KW): return "health"
    if any(k in title for k in FOOD_KW):   return "food"
    if any(k in title for k in WORK_KW):   return "work"
    return "other"


def get_access_token() -> str:
    resp = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id":     os.environ["GOOGLE_CLIENT_ID"],
            "client_secret": os.environ["GOOGLE_CLIENT_SECRET"],
            "refresh_token": os.environ["GOOGLE_REFRESH_TOKEN"],
            "grant_type":    "refresh_token",
        },
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def fetch_calendar_events(token: str, time_min: datetime, time_max: datetime) -> list:
    try:
        resp = requests.get(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events",
            headers={"Authorization": f"Bearer {token}"},
            params={
                "timeMin":      time_min.isoformat(),
                "timeMax":      time_max.isoformat(),
                "orderBy":      "startTime",
                "singleEvents": "true",
                "timeZone":     "Asia/Tokyo",
            },
            timeout=15,
        )
        resp.raise_for_status()
    except Exception as e:
        print(f"[WARN] Calendar fetch failed: {e}", file=sys.stderr)
        return []

    events = []
    for item in resp.json().get("items", []):
        start = item.get("start", {})
        title = (item.get("summary") or "").strip()
        if not title:
            continue
        # 終日イベント
        if "date" in start and "dateTime" not in start:
            events.append({
                "date":     start["date"],
                "start":    "",
                "end":      "",
                "title":    title,
                "category": categorize(title),
                "allday":   True,
            })
            continue
        if "dateTime" not in start:
            continue
        start_dt = datetime.fromisoformat(start["dateTime"]).astimezone(JST)
        end_dt   = datetime.fromisoformat(item["end"]["dateTime"]).astimezone(JST)
        events.append({
            "date":     start_dt.strftime("%Y-%m-%d"),
            "start":    start_dt.strftime("%H:%M"),
            "end":      end_dt.strftime("%H:%M"),
            "title":    title,
            "category": categorize(title),
            "allday":   False,
        })
    return events


def get_events(token: str, now: datetime) -> tuple[list, dict]:
    today_events, week_events = [], {}

    # 今週月曜〜日曜を計算
    monday = now - timedelta(days=now.weekday())
    sunday = monday + timedelta(days=6)
    week_start = monday.replace(hour=0, minute=0, second=0, microsecond=0)
    week_end   = sunday.replace(hour=23, minute=59, second=59, microsecond=0)

    all_events = fetch_calendar_events(token, week_start, week_end)

    today_str = now.strftime("%Y-%m-%d")
    for e in all_events:
        date = e["date"]
        if date not in week_events:
            week_events[date] = []
        week_events[date].append(e)
        if date == today_str:
            today_events.append({k: v for k, v in e.items() if k != "date"})

    return today_events, week_events


# ── HTML 更新 ───────────────────────────────────────────────────────────────

MARKER_RE = re.compile(r"// BEGIN_DAILY_DATA.*?// END_DAILY_DATA", re.DOTALL)
DASHBOARD = os.path.join(os.path.dirname(__file__), "..", "dashboard.html")


def update_html(data: dict) -> None:
    with open(DASHBOARD, encoding="utf-8") as f:
        html = f.read()

    if not MARKER_RE.search(html):
        print("[ERROR] BEGIN_DAILY_DATA marker not found in dashboard.html", file=sys.stderr)
        sys.exit(1)

    block = (
        "// BEGIN_DAILY_DATA\n"
        f"const DAILY_DATA = {json.dumps(data, ensure_ascii=False, indent=2)};\n"
        "// END_DAILY_DATA"
    )
    with open(DASHBOARD, "w", encoding="utf-8") as f:
        f.write(MARKER_RE.sub(block, html))


# ── エントリポイント ────────────────────────────────────────────────────────

def main() -> None:
    token = os.environ.get("NOTION_TOKEN", "")
    if not token:
        print("[ERROR] NOTION_TOKEN is not set", file=sys.stderr)
        sys.exit(1)

    now    = datetime.now(JST)
    tasks  = get_tasks(token)

    try:
        gcal_token = get_access_token()
        today_events, week_events = get_events(gcal_token, now)
    except Exception as e:
        print(f"[WARN] Google auth failed: {e}", file=sys.stderr)
        today_events, week_events = [], {}

    data = {
        "updated":      now.strftime("%Y-%m-%dT%H:%M:%S+09:00"),
        "today":        now.strftime("%Y-%m-%d"),
        "tasks":        tasks,
        "events":       today_events,
        "week_events":  week_events,
    }

    update_html(data)

    high = sum(1 for t in tasks if t["priority"] == "high")
    mid  = sum(1 for t in tasks if t["priority"] == "mid")
    low  = sum(1 for t in tasks if t["priority"] == "low")
    total_ev = sum(len(v) for v in week_events.values())
    print(
        f"✅ {now.strftime('%Y-%m-%d %H:%M JST')} "
        f"tasks={len(tasks)} (🔴{high} 🟡{mid} 🟢{low})  events_today={len(today_events)} events_week={total_ev}"
    )


if __name__ == "__main__":
    main()
