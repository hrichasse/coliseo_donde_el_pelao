import type { Rooster } from "@/lib/types";

const LIBRA_A_GRAMOS = 453.59237;
const MAX_WEIGHT_DIFF_LIBRAS = 0.02;
const WEIGHT_EPSILON = 1e-9;

export const PESO_OPCIONES = [
  3.0, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.1, 3.11, 3.12, 3.13, 3.14, 3.15,
  4.0, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.1, 4.11, 4.12, 4.13, 4.14, 4.15,
  5.0, 5.1, 5.2, 5.3, 5.4, 5.5,
];

function librasAGramos(libras: number): number {
  return libras * LIBRA_A_GRAMOS;
}

export function buildPairsByWeight(roosters: Rooster[]) {
  // Paso 1: Emparejar TODOS los gallos sin filtros previos
  const available = [...roosters].sort((a, b) => a.peso_libras - b.peso_libras);
  const pairs: Array<{
    galloA: Rooster;
    galloB: Rooster;
    diferenciaGramos: number;
  }> = [];

  while (available.length > 1) {
    let bestI = -1;
    let bestJ = -1;
    let bestDiff = Number.POSITIVE_INFINITY;

    for (let i = 0; i < available.length; i += 1) {
      for (let j = i + 1; j < available.length; j += 1) {
        if (available[i].galpon.trim().toLowerCase() === available[j].galpon.trim().toLowerCase()) {
          continue;
        }

        const diffLibras = Math.abs(available[i].peso_libras - available[j].peso_libras);

        // Permitir emparejamiento si la diferencia es <= 0.02 libras
        // (con tolerancia para evitar errores de punto flotante).
        if (diffLibras - MAX_WEIGHT_DIFF_LIBRAS > WEIGHT_EPSILON) {
          continue;
        }

        const diff = librasAGramos(diffLibras);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestI = i;
          bestJ = j;
        }
      }
    }

    if (bestI === -1 || bestJ === -1) {
      break;
    }

    const galloA = available[bestI];
    const galloB = available[bestJ];
    pairs.push({
      galloA,
      galloB,
      diferenciaGramos: Math.round(bestDiff),
    });

    const removeIndexes = [bestI, bestJ].sort((a, b) => b - a);
    removeIndexes.forEach((index) => {
      available.splice(index, 1);
    });
  }

  // Paso 2: Agrupar por frente (galpon + nombre_gallo)
  const frenteGroups = new Map<string, Rooster[]>();
  for (const rooster of roosters) {
    const frenteKey = `${rooster.galpon}|||${rooster.nombre_gallo}`;
    if (!frenteGroups.has(frenteKey)) {
      frenteGroups.set(frenteKey, []);
    }
    frenteGroups.get(frenteKey)!.push(rooster);
  }

  // Paso 3: Identificar gallos emparejados en las parejas actuales
  const pairedRoosters = new Set<number>();
  for (const pair of pairs) {
    pairedRoosters.add(pair.galloA.id);
    pairedRoosters.add(pair.galloB.id);
  }

  // Paso 4: Encontrar frentes incompletos: aquellos donde NO ambos gallos están emparejados
  const incompleteFrenteIds = new Set<number>();
  for (const [, frenteRoosters] of frenteGroups) {
    if (frenteRoosters.length === 2) {
      const bothPaired = frenteRoosters.every((g) => pairedRoosters.has(g.id));
      if (!bothPaired) {
        // Frente incompleto: excluir AMBOS gallos
        frenteRoosters.forEach((g) => {
          incompleteFrenteIds.add(g.id);
        });
      }
    } else if (frenteRoosters.length === 1) {
      // Frentes con solo 1 gallo (siempre incompletos)
      frenteRoosters.forEach((g) => {
        incompleteFrenteIds.add(g.id);
      });
    }
  }

  // Paso 5: Filtrar las parejas: excluir aquellas donde alguno está en frente incompleto
  const validPairs = pairs.filter(
    (pair) => !incompleteFrenteIds.has(pair.galloA.id) && !incompleteFrenteIds.has(pair.galloB.id),
  );

  // Paso 6: Calcular sobrantes = gallos no emparejados en validPairs + gallos de frentes incompletos
  const validPairedIds = new Set<number>();
  validPairs.forEach((pair) => {
    validPairedIds.add(pair.galloA.id);
    validPairedIds.add(pair.galloB.id);
  });

  const sobrantes = roosters.filter((r) => !validPairedIds.has(r.id));
  const incompleteFrentes = Array.from(incompleteFrenteIds)
    .map((id) => roosters.find((r) => r.id === id)!)
    .filter(Boolean);

  return {
    pairs: validPairs,
    sobrantes,
    incompleteFrentes,
  };
}
