import { NextRequest, NextResponse } from "next/server";

import { SOFASCORE_HEADERS } from "@/lib/sofascore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing q query param" }, { status: 400 });
  }

  const url = `https://api.sofascore.com/api/v1/search/all?q=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url, {
      headers: SOFASCORE_HEADERS,
      cache: "no-store",
    });

    const bodyText = await response.text();
    let rawBody: unknown = bodyText;

    try {
      rawBody = JSON.parse(bodyText);
    } catch {
      rawBody = bodyText;
    }

    return NextResponse.json({
      query,
      upstreamUrl: url,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      raw: rawBody,
    });
  } catch (error) {
    return NextResponse.json(
      {
        query,
        upstreamUrl: url,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
