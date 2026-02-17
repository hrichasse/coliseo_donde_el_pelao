import type { Rooster } from "@/lib/types";

const LIBRA_A_GRAMOS = 453.59237;

function librasAGramos(libras: number): number {
  return libras * LIBRA_A_GRAMOS;
}

export function buildPairsByWeight(roosters: Rooster[]) {
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

        const diff = Math.abs(librasAGramos(available[i].peso_libras) - librasAGramos(available[j].peso_libras));
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

  return {
    pairs,
    sobrantes: available,
  };
}
