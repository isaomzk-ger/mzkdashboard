import Anthropic from "@anthropic-ai/sdk";

// AI定着コーチで使うモデル。軽量な対話なので低コスト・高速な Haiku 4.5 を既定にする。
// 応答品質を上げたくなったら "claude-sonnet-4-6" に切り替える。
export const COACH_MODEL = "claude-haiku-4-5";

let cached: Anthropic | null = null;

// 遅延初期化。ANTHROPIC_API_KEY が未設定でもビルドは通し、リクエスト時にのみ失敗させる。
export function getAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  if (!cached) {
    cached = new Anthropic({ apiKey });
  }
  return cached;
}
