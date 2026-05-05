import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const r = await fetch(`${BACKEND_URL}/memories/${id}`, {
      method: "DELETE",
    });
    const data = await r.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error(`Proxy DELETE /memories/${id} failed:`, err);
    return NextResponse.json({ error: "Failed to delete memory" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await req.json();
    const r = await fetch(`${BACKEND_URL}/memories/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error(`Proxy PUT /memories/${id} failed:`, err);
    return NextResponse.json({ error: "Failed to update memory" }, { status: 500 });
  }
}
