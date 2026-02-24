import { NextResponse } from "next/server";
import { markAsRead } from "@/lib/db";

export const runtime = "nodejs";

type RouteParams = {
  params: {
    id: string;
  };
};

export async function POST(_req: Request, { params }: RouteParams) {
  const idNum = Number(params.id);
  if (!Number.isInteger(idNum)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const data = await markAsRead(idNum);

    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to mark as read" },
      { status: 500 }
    );
  }
}

