import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function GET(req: NextRequest) {
  try {
    const r = await fetch(`${BACKEND_URL}/users`);
    const data = await r.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Proxy GET /users failed:", err);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
