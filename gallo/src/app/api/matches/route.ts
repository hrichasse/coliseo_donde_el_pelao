import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("emparejamientos")
    .select(
      "id, gallo_a_id, gallo_b_id, ganador_id, duracion_segundos, diferencia_gramos, created_at, gallo_a:gallo_a_id(id, nombre_gallo, galpon, propietario, peso_libras), gallo_b:gallo_b_id(id, nombre_gallo, galpon, propietario, peso_libras)",
    )
    .order("id", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const normalized = (data ?? []).map((row) => {
    const galloA = Array.isArray(row.gallo_a) ? row.gallo_a[0] : row.gallo_a;
    const galloB = Array.isArray(row.gallo_b) ? row.gallo_b[0] : row.gallo_b;

    return {
      id: row.id,
      gallo_a_id: row.gallo_a_id,
      gallo_b_id: row.gallo_b_id,
      ganador_id: row.ganador_id,
      duracion_segundos: row.duracion_segundos,
      gallo_a_nombre: galloA?.nombre_gallo ?? "",
      gallo_b_nombre: galloB?.nombre_gallo ?? "",
      galpon_a: galloA?.galpon ?? "",
      galpon_b: galloB?.galpon ?? "",
      propietario_a: galloA?.propietario ?? "",
      propietario_b: galloB?.propietario ?? "",
      peso_a_libras: galloA?.peso_libras ?? 0,
      peso_b_libras: galloB?.peso_libras ?? 0,
      diferencia_gramos: row.diferencia_gramos,
      created_at: row.created_at,
    };
  });

  return NextResponse.json({ count: normalized.length, data: normalized });
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
  const ganadorIdRaw = body.ganador_id;
  const ganadorId = ganadorIdRaw === null || ganadorIdRaw === undefined ? null : Number(ganadorIdRaw);
  const duracionSegundos = Number(body.duracion_segundos);

  if (Number.isNaN(id) || id <= 0) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  if (ganadorId !== null && (Number.isNaN(ganadorId) || ganadorId <= 0)) {
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

  if (ganadorId !== null && ganadorId !== matchData.gallo_a_id && ganadorId !== matchData.gallo_b_id) {
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
