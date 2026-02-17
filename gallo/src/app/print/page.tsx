type PrintablePair = {
  index: number;
  galponA: string;
  propietarioA: string;
  pesoA: string;
  galponB: string;
  propietarioB: string;
  pesoB: string;
  diferencia: string;
};

export default async function PrintPage({
  searchParams,
}: {
  searchParams: Promise<{ pairs?: string }>;
}) {
  const params = await searchParams;

  let pairs: PrintablePair[] = [];
  const raw = params.pairs;
  if (raw) {
    try {
      const parsed = JSON.parse(decodeURIComponent(raw));
      pairs = Array.isArray(parsed) ? (parsed as PrintablePair[]) : [];
    } catch {
      pairs = [];
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-6 print:p-0">
      <h1 className="mb-4 text-2xl font-bold">Acta de Emparejamientos 1v1</h1>

      <p className="mb-6 text-sm">Dejar el espacio final para anotar a mano el tiempo del 1v1. Usa Ctrl+P para imprimir.</p>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border p-2">#</th>
            <th className="border p-2">Galpón A</th>
            <th className="border p-2">Propietario A</th>
            <th className="border p-2">Peso A (lb)</th>
            <th className="border p-2">Galpón B</th>
            <th className="border p-2">Propietario B</th>
            <th className="border p-2">Peso B (lb)</th>
            <th className="border p-2">Dif (g)</th>
            <th className="border p-2">Tiempo (manual)</th>
          </tr>
        </thead>
        <tbody>
          {pairs.map((pair) => (
            <tr key={`${pair.index}-${pair.galponA}-${pair.galponB}`}>
              <td className="border p-2 text-center">{pair.index}</td>
              <td className="border p-2">{pair.galponA}</td>
              <td className="border p-2">{pair.propietarioA}</td>
              <td className="border p-2 text-right">{pair.pesoA}</td>
              <td className="border p-2">{pair.galponB}</td>
              <td className="border p-2">{pair.propietarioB}</td>
              <td className="border p-2 text-right">{pair.pesoB}</td>
              <td className="border p-2 text-right">{pair.diferencia}</td>
              <td className="border p-2" style={{ minWidth: 140 }}>
                
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
