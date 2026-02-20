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

type PairCandidate = {
  galloA: Rooster;
  galloB: Rooster;
  diferenciaGramos: number;
};

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getFrenteKey(rooster: Rooster): string {
  return `${normalizeText(rooster.galpon)}|||${normalizeText(rooster.nombre_gallo)}`;
}

function buildFrenteGroups(roosters: Rooster[]) {
  const groups = new Map<string, Rooster[]>();

  for (const rooster of roosters) {
    const key = getFrenteKey(rooster);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(rooster);
  }

  return groups;
}

function splitFrentes(roosters: Rooster[]) {
  const groups = buildFrenteGroups(roosters);

  const completeFrentes = new Map<string, [Rooster, Rooster]>();
  const registrationIncomplete: Rooster[] = [];

  for (const [key, items] of groups) {
    if (items.length === 2) {
      completeFrentes.set(key, [items[0], items[1]]);
    } else {
      registrationIncomplete.push(...items);
    }
  }

  return { completeFrentes, registrationIncomplete };
}

function canFight(a: Rooster, b: Rooster): boolean {
  if (a.galpon.trim().toLowerCase() === b.galpon.trim().toLowerCase()) {
    return false;
  }
  const diffLibras = Math.abs(a.peso_libras - b.peso_libras);
  return diffLibras - MAX_WEIGHT_DIFF_LIBRAS <= WEIGHT_EPSILON;
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

        const diffLibras = Math.abs(available[i].peso_libras - available[j].peso_libras);
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
  const { completeFrentes, registrationIncomplete } = splitFrentes(roosters);

  const roosterToFrenteKey = new Map<number, string>();
  for (const [key, members] of completeFrentes) {
    roosterToFrenteKey.set(members[0].id, key);
    roosterToFrenteKey.set(members[1].id, key);
  }

  const excludedFrentes = new Set<string>();
  let finalPairs: PairCandidate[] = [];

  while (true) {
    const activeRoosters = Array.from(completeFrentes.entries())
      .filter(([key]) => !excludedFrentes.has(key))
      .flatMap(([, members]) => members);

    const { pairs } = greedyPair(activeRoosters);

    const matchedByFrente = new Map<string, number>();
    for (const key of completeFrentes.keys()) {
      if (!excludedFrentes.has(key)) {
        matchedByFrente.set(key, 0);
      }
    }

    for (const pair of pairs) {
      const frenteA = roosterToFrenteKey.get(pair.galloA.id);
      const frenteB = roosterToFrenteKey.get(pair.galloB.id);

      if (frenteA && matchedByFrente.has(frenteA)) {
        matchedByFrente.set(frenteA, (matchedByFrente.get(frenteA) ?? 0) + 1);
      }
      if (frenteB && matchedByFrente.has(frenteB)) {
        matchedByFrente.set(frenteB, (matchedByFrente.get(frenteB) ?? 0) + 1);
      }
    }

    const newlyIncomplete: string[] = [];
    for (const [frenteKey, matchedCount] of matchedByFrente) {
      if (matchedCount === 1) {
        newlyIncomplete.push(frenteKey);
      }
    }

    if (newlyIncomplete.length === 0) {
      finalPairs = pairs;
      break;
    }

    for (const key of newlyIncomplete) {
      excludedFrentes.add(key);
    }

    if (excludedFrentes.size === completeFrentes.size) {
      finalPairs = [];
      break;
    }
  }

  const incompleteFromMatching = Array.from(excludedFrentes)
    .flatMap((key) => completeFrentes.get(key) ?? []);

  const incompleteFrentes = uniqueRoostersById([
    ...registrationIncomplete,
    ...incompleteFromMatching,
  ]);

  const pairedIds = new Set<number>();
  for (const pair of finalPairs) {
    pairedIds.add(pair.galloA.id);
    pairedIds.add(pair.galloB.id);
  }

  const sobrantes = roosters.filter((rooster) => !pairedIds.has(rooster.id));

  return {
    pairs: finalPairs,
    sobrantes,
    incompleteFrentes,
  };
}
