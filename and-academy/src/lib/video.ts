// 動画URLを埋め込み用URLに変換する（プロバイダ非依存）
// 将来 Vimeo / 自社配信に差し替えてもここだけ直せば済むようにする

export type VideoSource =
  | { provider: "youtube"; id: string }
  | { provider: "vimeo"; id: string; hash: string | null }
  | { provider: "direct"; url: string }
  | { provider: "unknown"; url: string };

function isHost(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function getVideoSource(url: string | null): VideoSource | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);

    if (
      isHost(parsed.hostname, "youtube.com") ||
      isHost(parsed.hostname, "youtube-nocookie.com")
    ) {
      const pathParts = parsed.pathname.split("/").filter(Boolean);
      const id =
        parsed.searchParams.get("v") ??
        (["embed", "shorts", "live"].includes(pathParts[0])
          ? pathParts[1]
          : null);
      if (id) return { provider: "youtube", id };
    }
    if (parsed.hostname === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      if (id) return { provider: "youtube", id };
    }
    if (isHost(parsed.hostname, "vimeo.com")) {
      const parts = parsed.pathname.split("/").filter(Boolean);
      const id =
        parts[0] === "video" ? parts[1] : parts[0];
      const pathHash =
        parts[0] === "video" ? parts[2] : parts[1];
      const hash = parsed.searchParams.get("h") ?? pathHash ?? null;
      if (id) return { provider: "vimeo", id, hash };
    }
    if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) {
      return { provider: "direct", url };
    }
    return { provider: "unknown", url };
  } catch {
    return null;
  }
}

export function validateVideoUrl(url: string | null): string | null {
  if (!url) return null;
  const source = getVideoSource(url);
  if (!source || source.provider === "unknown") {
    return "YouTube または Vimeo の動画URLを指定してください。";
  }
  if (
    source.provider === "direct" &&
    process.env.ALLOW_DIRECT_VIDEO_URLS !== "true"
  ) {
    return "直接動画URLは転載対策が弱いため無効です。YouTube または Vimeo を利用してください。";
  }
  return null;
}
