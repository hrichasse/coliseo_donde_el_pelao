import { requireAuth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const auth = requireAuth(request);
  if (auth.response) return auth.response;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("emparejamientos")
    .select(
      "id, gallo_a_id, gallo_b_id, ganador_id, duracion_segundos, diferencia_gramos, created_at, gallo_a:gallo_a_id(id, nombre_gallo, galpon, propietario, color_gallo, peso_libras), gallo_b:gallo_b_id(id, nombre_gallo, galpon, propietario, color_gallo, peso_libras)",
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
      color_a: galloA?.color_gallo ?? "",
      color_b: galloB?.color_gallo ?? "",
      peso_a_libras: galloA?.peso_libras ?? 0,
      peso_b_libras: galloB?.peso_libras ?? 0,
      diferencia_gramos: row.diferencia_gramos,
      created_at: row.created_at,
    };
  });

  return NextResponse.json({ count: normalized.length, data: normalized });
}

export async function POST(request: Request) {
  const auth = requireAuth(request);
  if (auth.response) return auth.response;

  const supabase = getSupabase();
  const body = await request.json();

  const galloAId = Number(body.gallo_a_id);
  const galloBId = Number(body.gallo_b_id);

  if (Number.isNaN(galloAId) || galloAId <= 0) {
    return NextResponse.json({ error: "gallo_a_id inválido" }, { status: 400 });
  }

  if (Number.isNaN(galloBId) || galloBId <= 0) {
    return NextResponse.json({ error: "gallo_b_id inválido" }, { status: 400 });
  }

  if (galloAId === galloBId) {
    return NextResponse.json({ error: "Debes seleccionar dos gallos distintos" }, { status: 400 });
  }

  const { data: roostersData, error: roostersError } = await supabase
    .from("gallos")
    .select("id, nombre_gallo, galpon, propietario, color_gallo, peso_libras")
    .in("id", [galloAId, galloBId]);

  if (roostersError) {
    return NextResponse.json({ error: roostersError.message }, { status: 500 });
  }

  if (!roostersData || roostersData.length !== 2) {
    return NextResponse.json({ error: "No se encontraron ambos gallos seleccionados" }, { status: 400 });
  }

  const galloA = roostersData.find((rooster) => rooster.id === galloAId);
  const galloB = roostersData.find((rooster) => rooster.id === galloBId);

  if (!galloA || !galloB) {
    return NextResponse.json({ error: "No se encontraron ambos gallos seleccionados" }, { status: 400 });
  }

  const normalizeFrente = (value: string) => value.trim().replace(/\s+/g, " ").toUpperCase();

  if (galloA.galpon === galloB.galpon) {
    return NextResponse.json({ error: "No se permite emparejar gallos del mismo galpón" }, { status: 400 });
  }

  if (normalizeFrente(galloA.nombre_gallo) === normalizeFrente(galloB.nombre_gallo)) {
    return NextResponse.json({ error: "No se permite emparejar gallos del mismo frente" }, { status: 400 });
  }

  const { data: existingMatches, error: existingMatchesError } = await supabase
    .from("emparejamientos")
    .select("id, gallo_a_id, gallo_b_id")
    .or(`gallo_a_id.eq.${galloAId},gallo_b_id.eq.${galloAId},gallo_a_id.eq.${galloBId},gallo_b_id.eq.${galloBId}`);

  if (existingMatchesError) {
    return NextResponse.json({ error: existingMatchesError.message }, { status: 500 });
  }

  if ((existingMatches ?? []).length > 0) {
    return NextResponse.json({ error: "Uno o ambos gallos ya tienen una pelea asignada" }, { status: 400 });
  }

  const diferenciaGramos = Math.round(Math.abs(galloA.peso_libras - galloB.peso_libras) * 453.592);

  const { data: inserted, error: insertError } = await supabase
    .from("emparejamientos")
    .insert({ gallo_a_id: galloAId, gallo_b_id: galloBId, diferencia_gramos: diferenciaGramos, es_manual: true })
    .select(
      "id, gallo_a_id, gallo_b_id, ganador_id, duracion_segundos, diferencia_gramos, created_at, gallo_a:gallo_a_id(id, nombre_gallo, galpon, propietario, color_gallo, peso_libras), gallo_b:gallo_b_id(id, nombre_gallo, galpon, propietario, color_gallo, peso_libras)",
    )
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const insertedA = Array.isArray(inserted.gallo_a) ? inserted.gallo_a[0] : inserted.gallo_a;
  const insertedB = Array.isArray(inserted.gallo_b) ? inserted.gallo_b[0] : inserted.gallo_b;

  return NextResponse.json({
    data: {
      id: inserted.id,
      gallo_a_id: inserted.gallo_a_id,
      gallo_b_id: inserted.gallo_b_id,
      ganador_id: inserted.ganador_id,
      duracion_segundos: inserted.duracion_segundos,
      gallo_a_nombre: insertedA?.nombre_gallo ?? "",
      gallo_b_nombre: insertedB?.nombre_gallo ?? "",
      galpon_a: insertedA?.galpon ?? "",
      galpon_b: insertedB?.galpon ?? "",
      propietario_a: insertedA?.propietario ?? "",
      propietario_b: insertedB?.propietario ?? "",
      color_a: insertedA?.color_gallo ?? "",
      color_b: insertedB?.color_gallo ?? "",
      peso_a_libras: insertedA?.peso_libras ?? 0,
      peso_b_libras: insertedB?.peso_libras ?? 0,
      diferencia_gramos: inserted.diferencia_gramos,
      created_at: inserted.created_at,
    },
  });
}

export async function DELETE(request: Request) {
  const auth = requireAuth(request);
  if (auth.response) return auth.response;

  const supabase = getSupabase();
  const { error } = await supabase.from("emparejamientos").delete().neq("id", 0);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const auth = requireAuth(request);
  if (auth.response) return auth.response;

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
