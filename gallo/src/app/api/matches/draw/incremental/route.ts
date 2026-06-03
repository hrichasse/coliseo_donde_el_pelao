import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { buildPairsByWeight } from "@/lib/pairing";
import type { Rooster } from "@/lib/types";

export async function POST() {
  const supabase = getSupabase();

  // Obtener IDs de gallos que ya están en algún emparejamiento
  const { data: existingMatches, error: matchesError } = await supabase
    .from("emparejamientos")
    .select("gallo_a_id, gallo_b_id");

  if (matchesError) {
    return NextResponse.json({ error: matchesError.message }, { status: 500 });
  }

  const pairedIds = new Set<number>();
  for (const match of existingMatches ?? []) {
    if (match.gallo_a_id) pairedIds.add(match.gallo_a_id);
    if (match.gallo_b_id) pairedIds.add(match.gallo_b_id);
  }

  // Traer todos los gallos
  const { data: allRoosters, error: roostersError } = await supabase
    .from("gallos")
    .select("*")
    .order("id", { ascending: true });

  if (roostersError) {
    return NextResponse.json({ error: roostersError.message }, { status: 500 });
  }

  // Solo los que NO tienen pelea asignada
  const unpairedRoosters = ((allRoosters ?? []) as Rooster[]).filter(
    (r) => !pairedIds.has(r.id),
  );

  if (unpairedRoosters.length < 2) {
    return NextResponse.json(
      { error: "No hay gallos nuevos suficientes para generar peleas (mínimo 2 sin pelea asignada)" },
      { status: 400 },
    );
  }

  const { pairs, sobrantes, incompleteFrentes } = buildPairsByWeight(unpairedRoosters);

  if (pairs.length === 0) {
    return NextResponse.json(
      { error: "No se pudieron generar parejas con los gallos nuevos. Verifica pesos y galpones." },
      { status: 400 },
    );
  }

  const insertPayload = pairs.map((pair) => ({
    gallo_a_id: pair.galloA.id,
    gallo_b_id: pair.galloB.id,
    diferencia_gramos: pair.diferenciaGramos,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("emparejamientos")
    .insert(insertPayload)
    .select(
      "id, gallo_a_id, gallo_b_id, ganador_id, duracion_segundos, diferencia_gramos, created_at, gallo_a:gallo_a_id(id, nombre_gallo, galpon, propietario, color_gallo, peso_libras), gallo_b:gallo_b_id(id, nombre_gallo, galpon, propietario, color_gallo, peso_libras)",
    )
    .order("id", { ascending: true });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const normalized = (inserted ?? []).map((row) => {
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

  return NextResponse.json({
    data: normalized,
    sobrantes,
    incompleteFrentes,
    resumen: {
      total_nuevos: unpairedRoosters.length,
      total_nuevas_peleas: normalized.length,
      total_sobrantes_nuevos: sobrantes.length,
    },
  });
}
