import { getAuthUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const user = getAuthUser(request);

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({ ok: true, user });
}
