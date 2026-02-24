import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let ids: number[] = [];

  try {
    const body = await req.json();
    ids = Array.isArray(body.ids) ? body.ids : [];
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!ids.length) {
    return NextResponse.json({ error: "No ids provided" }, { status: 400 });
  }

  const { error } = await supabase
    .from("articles")
    .update({ is_read: 1 })
    .in("id", ids);

  if (error) {
    console.error("Error marking articles as read (bulk):", error);
    return NextResponse.json(
      { error: "Failed to mark articles as read" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

