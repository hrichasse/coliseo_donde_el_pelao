import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("emparejamientos")
    .select(
      "id, duracion_segundos, created_at, ganador_id, gallo_a:gallo_a_id(id, nombre_gallo, galpon, propietario, plaqueo), gallo_b:gallo_b_id(id, nombre_gallo, galpon, propietario, plaqueo)",
    )
    .not("duracion_segundos", "is", null)
    .order("id", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Agrupar por (galpón, nombre_gallo/frente)
  const frenteStats: Record<
    string,
    {
      galpon: string;
      frente: string;
      plaqueos: Set<number>;
      propietario: string;
      puntos: number;
      tiempo_total: number;
      peleas: number;
    }
  > = {};

  (data ?? []).forEach((row) => {
    const galloA = Array.isArray(row.gallo_a) ? row.gallo_a[0] : row.gallo_a;
    const galloB = Array.isArray(row.gallo_b) ? row.gallo_b[0] : row.gallo_b;
    const duracionSegundos = Number(row.duracion_segundos);

    // Procesar gallo A
    const galponA = galloA?.galpon ?? "";
    const frenteA = galloA?.nombre_gallo ?? "";
    const keyA = `${galponA}|${frenteA}`;

    if (galponA && frenteA) {
      if (!frenteStats[keyA]) {
        frenteStats[keyA] = {
          galpon: galponA,
          frente: frenteA,
          plaqueos: new Set(),
          propietario: galloA?.propietario ?? "",
          puntos: 0,
          tiempo_total: 0,
          peleas: 0,
        };
      }

      // Agregar plaqueo a la colección
      if (galloA?.plaqueo) {
        frenteStats[keyA].plaqueos.add(galloA.plaqueo);
      }

      let puntosA = 0;
      if (!row.ganador_id) {
        // Empate
        puntosA = 1;
      } else if (row.ganador_id === galloA?.id) {
        // Victoria
        puntosA = 3;
      }

      frenteStats[keyA].puntos += puntosA;
      frenteStats[keyA].tiempo_total += duracionSegundos;
      frenteStats[keyA].peleas += 1;
    }

    // Procesar gallo B
    const galponB = galloB?.galpon ?? "";
    const frenteB = galloB?.nombre_gallo ?? "";
    const keyB = `${galponB}|${frenteB}`;

    if (galponB && frenteB) {
      if (!frenteStats[keyB]) {
        frenteStats[keyB] = {
          galpon: galponB,
          frente: frenteB,
          plaqueos: new Set(),
          propietario: galloB?.propietario ?? "",
          puntos: 0,
          tiempo_total: 0,
          peleas: 0,
        };
      }

      // Agregar plaqueo a la colección
      if (galloB?.plaqueo) {
        frenteStats[keyB].plaqueos.add(galloB.plaqueo);
      }

      let puntosB = 0;
      if (!row.ganador_id) {
        // Empate
        puntosB = 1;
      } else if (row.ganador_id === galloB?.id) {
        // Victoria
        puntosB = 3;
      }

      frenteStats[keyB].puntos += puntosB;
      frenteStats[keyB].tiempo_total += duracionSegundos;
      frenteStats[keyB].peleas += 1;
    }
  });

  // Convertir a array y ordenar
  const ranking = Object.values(frenteStats)
    .sort((a, b) => {
      // Ordenar por puntos (descendente)
      if (b.puntos !== a.puntos) {
        return b.puntos - a.puntos;
      }
      // En caso de empate de puntos, por tiempo (ascendente)
      return a.tiempo_total - b.tiempo_total;
    })
    .map((row, index) => {
      // Convertir Set a array ordenado
      const plaqueosArray = Array.from(row.plaqueos).sort((a, b) => a - b);
      const plaqueosString = plaqueosArray.length > 0 ? plaqueosArray.join(", ") : null;

      return {
        posicion: index + 1,
        galpon: row.galpon,
        frente: row.frente,
        plaqueo: plaqueosString,
        propietario: row.propietario,
        puntos: row.puntos,
        peleas: row.peleas,
        tiempo_total_segundos: row.tiempo_total,
        tiempo_total_minutos: Number((row.tiempo_total / 60).toFixed(2)),
      };
    });

  return NextResponse.json({ data: ranking });
}
