import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const r = await fetch(`${BACKEND_URL}/memories/${id}/revisions`);
    const data = await r.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error(`Proxy GET /memories/${id}/revisions failed:`, err);
    return NextResponse.json({ error: "Failed to fetch revisions" }, { status: 500 });
  }
}
