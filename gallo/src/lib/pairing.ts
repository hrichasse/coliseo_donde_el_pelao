import type { Rooster } from "@/lib/types";

const MAX_WEIGHT_STEPS = 2;

export const PESO_OPCIONES = [
  3.0, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.1, 3.11, 3.12, 3.13, 3.14, 3.15,
  4.0, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.1, 4.11, 4.12, 4.13, 4.14, 4.15,
  5.0, 5.1, 5.2, 5.3, 5.4, 5.5,
];

type PairCandidate = {
  galloA: Rooster;
  galloB: Rooster;
  diferenciaGramos: number;
};

// Convierte un peso en notación libras.onzas (ej: 3.15 = 3 lbs 15/16) a pasos lineales.
// Cada libra tiene 16 pasos (.00 a .15), por lo que 3.15 → 4.00 es solo 1 paso.
function weightToSteps(peso: number): number {
  const lbs = Math.floor(peso);
  const oz = Math.round((peso - lbs) * 100);
  return lbs * 16 + oz;
}

function canFight(a: Rooster, b: Rooster): boolean {
  if (a.galpon.trim().toLowerCase() === b.galpon.trim().toLowerCase()) {
    return false;
  }
  return Math.abs(weightToSteps(a.peso_libras) - weightToSteps(b.peso_libras)) <= MAX_WEIGHT_STEPS;
}

function greedyPair(roosters: Rooster[]) {
  const available = [...roosters].sort((a, b) => a.peso_libras - b.peso_libras);
  const pairs: PairCandidate[] = [];

  while (available.length > 1) {
    let bestI = -1;
    let bestJ = -1;
    let bestDiff = Number.POSITIVE_INFINITY;

    for (let i = 0; i < available.length; i += 1) {
      for (let j = i + 1; j < available.length; j += 1) {
        if (!canFight(available[i], available[j])) {
          continue;
        }

        const stepDiff = Math.abs(weightToSteps(available[i].peso_libras) - weightToSteps(available[j].peso_libras));
        const diff = stepDiff;
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

function uniqueRoostersById(roosters: Rooster[]): Rooster[] {
  const seen = new Set<number>();
  const unique: Rooster[] = [];
  for (const rooster of roosters) {
    if (seen.has(rooster.id)) {
      continue;
    }
    seen.add(rooster.id);
    unique.push(rooster);
  }
  return unique;
}

export function buildPairsByWeight(roosters: Rooster[]) {
  const unique = uniqueRoostersById(roosters);
  const { pairs, sobrantes } = greedyPair(unique);

  return {
    pairs,
    sobrantes,
    incompleteFrentes: [] as Rooster[],
  };
}
