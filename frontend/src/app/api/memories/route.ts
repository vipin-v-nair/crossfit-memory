import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("user_id");

  try {
    const targetUrl = userId 
      ? `${BACKEND_URL}/memories?user_id=${userId}`
      : `${BACKEND_URL}/memories`;

    const r = await fetch(targetUrl);
    const data = await r.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Proxy GET /memories failed:", err);
    return NextResponse.json({ error: "Failed to fetch memories" }, { status: 500 });
  }
}

