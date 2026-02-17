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

export async function PATCH(request: Request) {
  const supabase = getSupabase();
  const body = await request.json();

  const id = Number(body.id);
  const ganadorId = Number(body.ganador_id);
  const duracionSegundos = Number(body.duracion_segundos);

  if (Number.isNaN(id) || id <= 0) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  if (Number.isNaN(ganadorId) || ganadorId <= 0) {
    return NextResponse.json({ error: "ganador_id inválido" }, { status: 400 });
  }

  if (Number.isNaN(duracionSegundos) || duracionSegundos < 0) {
    return NextResponse.json({ error: "duracion_segundos inválido" }, { status: 400 });
  }

  const { data: matchData, error: matchError } = await supabase
    .from("emparejamientos")
    .select("id, gallo_a_id, gallo_b_id")
    .eq("id", id)
    .single();

  if (matchError) {
    return NextResponse.json({ error: matchError.message }, { status: 500 });
  }

  if (ganadorId !== matchData.gallo_a_id && ganadorId !== matchData.gallo_b_id) {
    return NextResponse.json({ error: "El ganador debe ser uno de los dos gallos de la disputa" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("emparejamientos")
    .update({ ganador_id: ganadorId, duracion_segundos: duracionSegundos })
    .eq("id", id)
    .select("id, ganador_id, duracion_segundos")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
