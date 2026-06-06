"use client";

import { useCallback, useEffect, useRef } from "react";
import { getVideoSource } from "@/lib/video";

interface YouTubePlayer {
  getCurrentTime(): number;
  destroy(): void;
}

interface VimeoPlayer {
  on(event: string, callback: (data: { seconds: number }) => void): void;
  off(event: string): void;
  getCurrentTime(): Promise<number>;
  setCurrentTime(seconds: number): Promise<number>;
  destroy(): Promise<void>;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement,
        options: {
          videoId: string;
          host: string;
          playerVars: Record<string, number>;
          events: {
            onStateChange: (event: { data: number }) => void;
          };
        },
      ) => YouTubePlayer;
      PlayerState: {
        PLAYING: number;
        PAUSED: number;
        ENDED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
    Vimeo?: {
      Player: new (element: HTMLIFrameElement) => VimeoPlayer;
    };
  }
}

let youtubeApiPromise: Promise<void> | null = null;
let vimeoApiPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    if (!document.getElementById("youtube-iframe-api")) {
      const script = document.createElement("script");
      script.id = "youtube-iframe-api";
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }
  });
  return youtubeApiPromise;
}

function loadVimeoApi(): Promise<void> {
  if (window.Vimeo?.Player) return Promise.resolve();
  if (vimeoApiPromise) return vimeoApiPromise;

  vimeoApiPromise = new Promise((resolve) => {
    const existing = document.getElementById(
      "vimeo-player-api",
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = "vimeo-player-api";
    script.src = "https://player.vimeo.com/api/player.js";
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
  return vimeoApiPromise;
}

export default function VideoPlayer({
  lessonId,
  videoUrl,
  initialPosition,
  watermarkText,
}: {
  lessonId: string;
  videoUrl: string;
  initialPosition: number;
  watermarkText: string;
}) {
  const youtubeContainerRef = useRef<HTMLDivElement>(null);
  const vimeoFrameRef = useRef<HTMLIFrameElement>(null);
  const directVideoRef = useRef<HTMLVideoElement>(null);
  const lastSentRef = useRef(initialPosition);
  const lastSentAtRef = useRef(0);
  const source = getVideoSource(videoUrl);

  const savePosition = useCallback(
    (seconds: number, force = false) => {
      const position = Math.max(0, Math.round(seconds));
      const now = Date.now();
      if (
        !force &&
        (now - lastSentAtRef.current < 15_000 ||
          Math.abs(position - lastSentRef.current) < 5)
      ) {
        return;
      }
      lastSentAtRef.current = now;
      lastSentRef.current = position;
      void fetch("/api/progress/position", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, positionSeconds: position }),
        keepalive: true,
      });
    },
    [lessonId],
  );

  useEffect(() => {
    if (source?.provider !== "youtube" || !youtubeContainerRef.current) return;
    let player: YouTubePlayer | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;
    let disposed = false;

    void loadYouTubeApi().then(() => {
      if (disposed || !window.YT || !youtubeContainerRef.current) return;
      player = new window.YT.Player(youtubeContainerRef.current, {
        videoId: source.id,
        host: "https://www.youtube-nocookie.com",
        playerVars: {
          start: Math.max(0, Math.floor(initialPosition)),
          playsinline: 1,
          rel: 0,
        },
        events: {
          onStateChange: (event) => {
            if (!window.YT || !player) return;
            if (event.data === window.YT.PlayerState.PLAYING) {
              if (interval) clearInterval(interval);
              interval = setInterval(() => {
                if (player) savePosition(player.getCurrentTime());
              }, 5_000);
            } else if (
              event.data === window.YT.PlayerState.PAUSED ||
              event.data === window.YT.PlayerState.ENDED
            ) {
              if (interval) clearInterval(interval);
              interval = null;
              savePosition(player.getCurrentTime(), true);
            }
          },
        },
      });
    });

    return () => {
      disposed = true;
      if (interval) clearInterval(interval);
      if (player) {
        savePosition(player.getCurrentTime(), true);
        player.destroy();
      }
    };
  }, [initialPosition, savePosition, source]);

  useEffect(() => {
    if (source?.provider !== "vimeo" || !vimeoFrameRef.current) return;
    let player: VimeoPlayer | null = null;
    let disposed = false;

    void loadVimeoApi().then(() => {
      if (disposed || !window.Vimeo || !vimeoFrameRef.current) return;
      player = new window.Vimeo.Player(vimeoFrameRef.current);
      if (initialPosition > 0) {
        void player.setCurrentTime(initialPosition);
      }
      player.on("timeupdate", (data) => savePosition(data.seconds));
      player.on("pause", (data) => savePosition(data.seconds, true));
      player.on("ended", (data) => savePosition(data.seconds, true));
    });

    return () => {
      disposed = true;
      if (player) {
        void player
          .getCurrentTime()
          .then((seconds) => savePosition(seconds, true));
        player.off("timeupdate");
        player.off("pause");
        player.off("ended");
        void player.destroy();
      }
    };
  }, [initialPosition, savePosition, source]);

  if (!source) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        動画が設定されていません
      </div>
    );
  }

  let player: React.ReactNode;
  if (source.provider === "youtube") {
    player = <div ref={youtubeContainerRef} className="h-full w-full" />;
  } else if (source.provider === "vimeo") {
    const query = new URLSearchParams({
      dnt: "1",
      title: "0",
      byline: "0",
      portrait: "0",
    });
    if (source.hash) query.set("h", source.hash);
    player = (
      <iframe
        ref={vimeoFrameRef}
        src={`https://player.vimeo.com/video/${source.id}?${query.toString()}`}
        title="レッスン動画"
        className="h-full w-full"
        allow="autoplay; fullscreen; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    );
  } else if (source.provider === "direct") {
    player = (
      <video
        ref={directVideoRef}
        src={source.url}
        controls
        controlsList="nodownload noplaybackrate"
        disablePictureInPicture
        preload="metadata"
        className="h-full w-full"
        onLoadedMetadata={(event) => {
          if (initialPosition > 0) event.currentTarget.currentTime = initialPosition;
        }}
        onTimeUpdate={(event) => savePosition(event.currentTarget.currentTime)}
        onPause={(event) =>
          savePosition(event.currentTarget.currentTime, true)
        }
        onEnded={(event) =>
          savePosition(event.currentTarget.currentTime, true)
        }
      />
    );
  } else {
    player = (
      <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-400">
        この動画形式は再生できません
      </div>
    );
  }

  return (
    <div
      className="relative h-full w-full"
      onContextMenu={(event) => event.preventDefault()}
    >
      {player}
      <div
        aria-hidden="true"
        className="video-watermark pointer-events-none absolute z-10 rounded bg-black/35 px-2 py-1 text-[10px] font-medium text-white/70"
      >
        {watermarkText} ・ and° Academy
      </div>
    </div>
  );
}
