import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("emparejamientos")
    .select(
      "id, duracion_segundos, created_at, ganador_id, gallo_a:gallo_a_id(id, nombre_gallo, galpon, propietario), gallo_b:gallo_b_id(id, nombre_gallo, galpon, propietario)",
    )
    .not("duracion_segundos", "is", null)
    .order("id", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Agrupar por galpón
  const galponStats: Record<
    string,
    {
      puntos: number;
      tiempo_total: number;
      peleas: number;
      propietario: string;
      frentes: Record<string, { victorias: number; puntos: number }>;
    }
  > = {};

  (data ?? []).forEach((row) => {
    const galloA = Array.isArray(row.gallo_a) ? row.gallo_a[0] : row.gallo_a;
    const galloB = Array.isArray(row.gallo_b) ? row.gallo_b[0] : row.gallo_b;
    const duracionSegundos = Number(row.duracion_segundos);

    // Procesar gallo A (galpón A)
    const galponA = galloA?.galpon ?? "";
    const frenteA = galloA?.nombre_gallo ?? "";
    if (galponA) {
      if (!galponStats[galponA]) {
        galponStats[galponA] = {
          puntos: 0,
          tiempo_total: 0,
          peleas: 0,
          propietario: galloA?.propietario ?? "",
          frentes: {},
        };
      }

      if (!galponStats[galponA].frentes[frenteA]) {
        galponStats[galponA].frentes[frenteA] = { victorias: 0, puntos: 0 };
      }

      let puntosA = 0;
      // Calcular puntos para gallo A
      if (!row.ganador_id) {
        // Empate
        puntosA = 1;
        galponStats[galponA].frentes[frenteA].puntos += 1;
      } else if (row.ganador_id === galloA?.id) {
        // Victoria
        puntosA = 3;
        galponStats[galponA].frentes[frenteA].victorias += 1;
        galponStats[galponA].frentes[frenteA].puntos += 3;
      }

      galponStats[galponA].puntos += puntosA;
      galponStats[galponA].tiempo_total += duracionSegundos;
      galponStats[galponA].peleas += 1;
    }

    // Procesar gallo B (galpón B)
    const galponB = galloB?.galpon ?? "";
    const frenteB = galloB?.nombre_gallo ?? "";
    if (galponB) {
      if (!galponStats[galponB]) {
        galponStats[galponB] = {
          puntos: 0,
          tiempo_total: 0,
          peleas: 0,
          propietario: galloB?.propietario ?? "",
          frentes: {},
        };
      }

      if (!galponStats[galponB].frentes[frenteB]) {
        galponStats[galponB].frentes[frenteB] = { victorias: 0, puntos: 0 };
      }

      let puntosB = 0;
      // Calcular puntos para gallo B
      if (!row.ganador_id) {
        // Empate
        puntosB = 1;
        galponStats[galponB].frentes[frenteB].puntos += 1;
      } else if (row.ganador_id === galloB?.id) {
        // Victoria
        puntosB = 3;
        galponStats[galponB].frentes[frenteB].victorias += 1;
        galponStats[galponB].frentes[frenteB].puntos += 3;
      }

      galponStats[galponB].puntos += puntosB;
      galponStats[galponB].tiempo_total += duracionSegundos;
      galponStats[galponB].peleas += 1;
    }
  });

  // Convertir a array y ordenar: primero por puntos (DESC), luego por tiempo (ASC)
  const ranking = Object.entries(galponStats)
    .map(([galpon, stats]) => {
      // Determinar el frente ganador (el que más victorias tiene)
      const frenteGanador = Object.entries(stats.frentes).reduce(
        (best, [frente, frenteStat]) =>
          frenteStat.victorias > best.victorias ? { frente, victorias: frenteStat.victorias } : best,
        { frente: "", victorias: 0 }
      );

      return {
        posicion: 0, // Se asignará después del ordenamiento
        galpon,
        propietario: stats.propietario,
        frente: frenteGanador.frente || Object.keys(stats.frentes)[0] || "",
        puntos: stats.puntos,
        peleas: stats.peleas,
        tiempo_total_segundos: stats.tiempo_total,
        tiempo_total_minutos: Number((stats.tiempo_total / 60).toFixed(2)),
      };
    })
    .sort((a, b) => {
      // Ordenar por puntos (descendente)
      if (b.puntos !== a.puntos) {
        return b.puntos - a.puntos;
      }
      // En caso de empate de puntos, por tiempo (ascendente)
      return a.tiempo_total_segundos - b.tiempo_total_segundos;
    })
    .map((row, index) => ({
      ...row,
      posicion: index + 1,
    }));

  return NextResponse.json({ data: ranking });
}
