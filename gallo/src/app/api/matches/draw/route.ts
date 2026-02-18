import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { buildPairsByWeight } from "@/lib/pairing";
import type { Rooster } from "@/lib/types";

export async function POST() {
  const supabase = getSupabase();
  const { error: clearError } = await supabase.from("emparejamientos").delete().neq("id", 0);
  if (clearError) {
    return NextResponse.json({ error: clearError.message }, { status: 500 });
  }

  const { data: roosters, error: roostersError } = await supabase
    .from("gallos")
    .select("*")
    .order("id", { ascending: true });

  if (roostersError) {
    return NextResponse.json({ error: roostersError.message }, { status: 500 });
  }

  const typedRoosters = (roosters ?? []) as Rooster[];
  if (typedRoosters.length < 2) {
    return NextResponse.json({ error: "Debe haber al menos 2 gallos para sortear" }, { status: 400 });
  }

  const { pairs, sobrantes } = buildPairsByWeight(typedRoosters);

  if (pairs.length === 0) {
    return NextResponse.json(
      { error: "No se pudieron generar parejas válidas. Verifica que existan gallos de distintos galpones." },
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
      "id, gallo_a_id, gallo_b_id, ganador_id, duracion_segundos, diferencia_gramos, created_at, gallo_a:gallo_a_id(id, nombre_gallo, galpon, propietario, peso_libras), gallo_b:gallo_b_id(id, nombre_gallo, galpon, propietario, peso_libras)",
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
      peso_a_libras: galloA?.peso_libras ?? 0,
      peso_b_libras: galloB?.peso_libras ?? 0,
      diferencia_gramos: row.diferencia_gramos,
      created_at: row.created_at,
    };
  });

  return NextResponse.json({
    data: normalized,
    sobrantes,
    resumen: {
      total_inscritos: typedRoosters.length,
      total_1v1: normalized.length,
      total_sobrantes: sobrantes.length,
      total_1v1_posibles: Math.floor(typedRoosters.length / 2),
    },
  });
}
