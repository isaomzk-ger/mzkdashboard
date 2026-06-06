import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { error } = await supabase
    .from("courses")
    .select("id", { count: "exact", head: true });

  if (error) {
    Sentry.captureException(error, {
      tags: { check: "database-health" },
    });
    return NextResponse.json(
      { status: "degraded", database: "unavailable" },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return NextResponse.json(
    {
      status: "ok",
      database: "available",
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
