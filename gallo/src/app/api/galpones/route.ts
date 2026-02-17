import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("galpones")
    .select("*")
    .order("nombre", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const supabase = getSupabase();
  const body = await request.json();

  const nombre = String(body.nombre ?? "").trim();
  if (!nombre) {
    return NextResponse.json({ error: "El nombre del galpón es requerido" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("galpones")
    .insert([{ nombre }])
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
