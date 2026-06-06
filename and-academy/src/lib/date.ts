const TOKYO_TIME_ZONE = "Asia/Tokyo";

export function todayInTokyo(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: TOKYO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function formatDate(date: string | null): string {
  if (!date) return "未設定";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: TOKYO_TIME_ZONE,
  }).format(new Date(`${date}T00:00:00+09:00`));
}

export function formatDateTime(date: string | null): string {
  if (!date) return "未受講";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TOKYO_TIME_ZONE,
  }).format(new Date(date));
}
