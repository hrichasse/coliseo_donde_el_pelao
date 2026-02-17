import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from("emparejamientos")
    .select("id", { count: "exact", head: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ count: count ?? 0 });
}

export async function DELETE() {
  const supabase = getSupabase();
  const { error } = await supabase.from("emparejamientos").delete().neq("id", 0);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
