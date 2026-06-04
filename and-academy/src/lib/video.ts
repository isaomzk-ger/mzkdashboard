// 動画URLを埋め込み用URLに変換する（プロバイダ非依存）
// 将来 Vimeo / 自社配信に差し替えてもここだけ直せば済むようにする

export function toEmbedUrl(url: string | null): string | null {
  if (!url) return null;

  try {
    const u = new URL(url);

    // YouTube
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1);
      if (id) return `https://www.youtube.com/embed/${id}`;
    }

    // Vimeo
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id) return `https://player.vimeo.com/video/${id}`;
    }

    // それ以外（mp4 直リンクや自社配信）はそのまま返す
    return url;
  } catch {
    return null;
  }
}
