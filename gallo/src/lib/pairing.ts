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

type Frente = {
  key: string;
  galpon: string;
  nombre: string;
  roosters: [Rooster, Rooster];
};

type PairCandidate = {
  galloA: Rooster;
  galloB: Rooster;
  diferenciaGramos: number;
};

type FrenteDuel = {
  frenteAKey: string;
  frenteBKey: string;
  fights: [PairCandidate, PairCandidate];
  totalDiff: number;
};

function canFight(a: Rooster, b: Rooster): boolean {
  if (a.galpon.trim().toLowerCase() === b.galpon.trim().toLowerCase()) {
    return false;
  }
  const diffLibras = Math.abs(a.peso_libras - b.peso_libras);
  return diffLibras - MAX_WEIGHT_DIFF_LIBRAS <= WEIGHT_EPSILON;
}

function buildFrentes(roosters: Rooster[]) {
  const groups = new Map<string, Rooster[]>();

  for (const rooster of roosters) {
    const key = `${rooster.galpon}|||${rooster.nombre_gallo}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(rooster);
  }

  const validFrentes: Frente[] = [];
  const incompleteFrentes: Rooster[] = [];

  for (const [key, items] of groups) {
    if (items.length !== 2) {
      incompleteFrentes.push(...items);
      continue;
    }

    const [galpon, nombre] = key.split("|||");
    validFrentes.push({
      key,
      galpon,
      nombre,
      roosters: [items[0], items[1]],
    });
  }

  return { validFrentes, incompleteFrentes };
}

function createFight(a: Rooster, b: Rooster): PairCandidate {
  const diffLibras = Math.abs(a.peso_libras - b.peso_libras);
  return {
    galloA: a,
    galloB: b,
    diferenciaGramos: Math.round(librasAGramos(diffLibras)),
  };
}

function buildDuel(frenteA: Frente, frenteB: Frente): FrenteDuel | null {
  if (frenteA.galpon.trim().toLowerCase() === frenteB.galpon.trim().toLowerCase()) {
    return null;
  }

  const [a1, a2] = frenteA.roosters;
  const [b1, b2] = frenteB.roosters;

  const opt1Valid = canFight(a1, b1) && canFight(a2, b2);
  const opt2Valid = canFight(a1, b2) && canFight(a2, b1);

  if (!opt1Valid && !opt2Valid) {
    return null;
  }

  const opt1Fights: [PairCandidate, PairCandidate] = [createFight(a1, b1), createFight(a2, b2)];
  const opt2Fights: [PairCandidate, PairCandidate] = [createFight(a1, b2), createFight(a2, b1)];

  const opt1Total = opt1Fights[0].diferenciaGramos + opt1Fights[1].diferenciaGramos;
  const opt2Total = opt2Fights[0].diferenciaGramos + opt2Fights[1].diferenciaGramos;

  const fights = !opt2Valid || (opt1Valid && opt1Total <= opt2Total) ? opt1Fights : opt2Fights;
  const totalDiff = fights[0].diferenciaGramos + fights[1].diferenciaGramos;

  return {
    frenteAKey: frenteA.key,
    frenteBKey: frenteB.key,
    fights,
    totalDiff,
  };
}

function pickBestDuels(duels: FrenteDuel[], frenteKeys: string[]): FrenteDuel[] {
  const duelMap = new Map<string, FrenteDuel[]>();

  for (const key of frenteKeys) {
    duelMap.set(key, []);
  }

  for (const duel of duels) {
    duelMap.get(duel.frenteAKey)?.push(duel);
    duelMap.get(duel.frenteBKey)?.push(duel);
  }

  const used = new Set<string>();
  const selected: FrenteDuel[] = [];

  while (true) {
    const availableFrentes = frenteKeys.filter((key) => !used.has(key));
    if (availableFrentes.length < 2) {
      break;
    }

    let targetFrente: string | null = null;
    let targetOptions: FrenteDuel[] = [];

    for (const key of availableFrentes) {
      const options = (duelMap.get(key) ?? [])
        .filter((duel) => !used.has(duel.frenteAKey) && !used.has(duel.frenteBKey))
        .sort((a, b) => a.totalDiff - b.totalDiff);

      if (options.length === 0) {
        continue;
      }

      if (!targetFrente || options.length < targetOptions.length) {
        targetFrente = key;
        targetOptions = options;
      }
    }

    if (!targetFrente || targetOptions.length === 0) {
      break;
    }

    const chosen = targetOptions[0];
    selected.push(chosen);
    used.add(chosen.frenteAKey);
    used.add(chosen.frenteBKey);
  }

  return selected;
}

export function buildPairsByWeight(roosters: Rooster[]) {
  const { validFrentes, incompleteFrentes: registrationIncomplete } = buildFrentes(roosters);

  const duels: FrenteDuel[] = [];
  for (let i = 0; i < validFrentes.length; i += 1) {
    for (let j = i + 1; j < validFrentes.length; j += 1) {
      const duel = buildDuel(validFrentes[i], validFrentes[j]);
      if (duel) {
        duels.push(duel);
      }
    }
  }

  const selectedDuels = pickBestDuels(
    duels,
    validFrentes.map((f) => f.key),
  );

  const pairs = selectedDuels.flatMap((duel) => duel.fights);

  const usedFrentes = new Set<string>();
  for (const duel of selectedDuels) {
    usedFrentes.add(duel.frenteAKey);
    usedFrentes.add(duel.frenteBKey);
  }

  const unmatchedCompleteFrentes = validFrentes
    .filter((frente) => !usedFrentes.has(frente.key))
    .flatMap((frente) => frente.roosters);

  const incompleteFrentes = [...registrationIncomplete, ...unmatchedCompleteFrentes];

  const pairedIds = new Set<number>();
  for (const pair of pairs) {
    pairedIds.add(pair.galloA.id);
    pairedIds.add(pair.galloB.id);
  }

  const sobrantes = roosters.filter((rooster) => !pairedIds.has(rooster.id));

  return {
    pairs,
    sobrantes,
    incompleteFrentes,
  };
}
