import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("emparejamientos")
    .select(
      "id, duracion_segundos, created_at, ganador_id, gallo_a:gallo_a_id(id, nombre_gallo, galpon), gallo_b:gallo_b_id(id, nombre_gallo, galpon), ganador:ganador_id(id, nombre_gallo, galpon)",
    )
    .not("duracion_segundos", "is", null)
    .not("ganador_id", "is", null)
    .order("duracion_segundos", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ranking = (data ?? []).map((row, index: number) => {
    const galloA = Array.isArray(row.gallo_a) ? row.gallo_a[0] : row.gallo_a;
    const galloB = Array.isArray(row.gallo_b) ? row.gallo_b[0] : row.gallo_b;
    const ganador = Array.isArray(row.ganador) ? row.ganador[0] : row.ganador;

    return {
      posicion: index + 1,
      disputa_id: row.id,
      ganador: ganador?.nombre_gallo ?? "",
      galpon_ganador: ganador?.galpon ?? "",
      gallo_a: galloA?.nombre_gallo ?? "",
      gallo_b: galloB?.nombre_gallo ?? "",
      duracion_segundos: row.duracion_segundos,
      duracion_minutos: Number((Number(row.duracion_segundos) / 60).toFixed(2)),
      created_at: row.created_at,
    };
  });

  return NextResponse.json({ data: ranking });
}
