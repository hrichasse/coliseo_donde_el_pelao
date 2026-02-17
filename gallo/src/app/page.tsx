"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Rooster } from "@/lib/types";

type DrawPair = {
  id: number;
  gallo_a_nombre: string;
  gallo_b_nombre: string;
  galpon_a: string;
  galpon_b: string;
  propietario_a: string;
  propietario_b: string;
  peso_a_libras: number;
  peso_b_libras: number;
  diferencia_gramos: number;
};

type FormState = {
  nombre_gallo: string;
  galpon: string;
  propietario: string;
  color_gallo: string;
  color_pata: string;
  peso_libras: string;
};

const INITIAL_FORM: FormState = {
  nombre_gallo: "",
  galpon: "",
  propietario: "",
  color_gallo: "",
  color_pata: "",
  peso_libras: "",
};

type Galpon = {
  id: number;
  nombre: string;
};

type SectionKey = "gallos" | "galpones" | "sorteo";

export default function Home() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [roosters, setRoosters] = useState<Rooster[]>([]);
  const [galpones, setGalpones] = useState<Galpon[]>([]);
  const [pairs, setPairs] = useState<DrawPair[]>([]);
  const [dbMatchesCount, setDbMatchesCount] = useState(0);
  const [activeSection, setActiveSection] = useState<SectionKey>("gallos");
  const [galponNuevo, setGalponNuevo] = useState("");
  const [assignGalloId, setAssignGalloId] = useState<string>("");
  const [assignGalpon, setAssignGalpon] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  async function loadRoosters() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/roosters");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Error cargando gallos");
      }
      setRoosters(payload.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRoosters();
    loadGalpones();
    loadMatchesCount();
  }, []);

  async function loadGalpones() {
    try {
      const response = await fetch("/api/galpones");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Error cargando galpones");
      }
      setGalpones(payload.data ?? []);

      const firstGalpon = payload.data?.[0]?.nombre;
      if (firstGalpon) {
        setForm((prev) => ({ ...prev, galpon: prev.galpon || firstGalpon }));
        setAssignGalpon((prev) => prev || firstGalpon);
      }
    } catch {
      setGalpones([]);
    }
  }

  async function loadMatchesCount() {
    try {
      const response = await fetch("/api/matches");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Error cargando conteo de sorteos");
      }
      setDbMatchesCount(payload.count ?? 0);
    } catch {
      setDbMatchesCount(0);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.galpon) {
      setError("Primero debes registrar al menos un galpón en el apartado Galpón");
      return;
    }

    setError("");
    setMessage("");
    setLoading(true);
    try {
      const response = await fetch("/api/roosters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          peso_libras: Number(form.peso_libras),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo registrar el gallo");
      }

      setForm(INITIAL_FORM);
      setMessage("Gallo registrado correctamente");
      await loadRoosters();
      setForm((prev) => ({ ...prev, galpon: prev.galpon || assignGalpon || galpones[0]?.nombre || "" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function onDrawPairs() {
    const existingMatches = dbMatchesCount > 0 || pairs.length > 0;
    const accepted = !existingMatches || window.confirm("Ya existe un sorteo previo. ¿Deseas generar uno nuevo?");
    if (!accepted) {
      return;
    }

    setError("");
    setMessage("");
    setLoading(true);
    try {
      const response = await fetch("/api/matches/draw", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo hacer el sorteo");
      }

      setPairs(payload.data ?? []);
      if ((payload.sobrantes ?? []).length > 0) {
        setMessage(`Sorteo generado. Gallos sin pareja: ${payload.sobrantes.length}`);
      } else {
        setMessage("Sorteo generado correctamente");
      }
      setDbMatchesCount((payload.data ?? []).length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function onDeleteRooster(id: number) {
    const accepted = window.confirm(`¿Seguro que deseas borrar el gallo ${id}?`);
    if (!accepted) {
      return;
    }

    setError("");
    setMessage("");
    setLoading(true);
    try {
      const response = await fetch(`/api/roosters?id=${id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo borrar el gallo");
      }

      setPairs([]);
      setMessage(`Gallo ${id} eliminado correctamente`);
      await loadRoosters();
      await loadMatchesCount();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function onClearMatches() {
    const accepted = window.confirm("¿Deseas limpiar los emparejamientos del torneo actual?");
    if (!accepted) {
      return;
    }

    setError("");
    setMessage("");
    setLoading(true);
    try {
      const response = await fetch("/api/matches", { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudieron limpiar los emparejamientos");
      }

      setPairs([]);
      setDbMatchesCount(0);
      setMessage("Emparejamientos limpiados correctamente");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function onCreateGalpon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!galponNuevo.trim()) {
      setError("El nombre del galpón es requerido");
      return;
    }

    setError("");
    setMessage("");
    setLoading(true);
    try {
      const response = await fetch("/api/galpones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: galponNuevo.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo crear el galpón");
      }

      setGalponNuevo("");
      setMessage("Galpón creado correctamente");
      await loadGalpones();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function onAssignGalloGalpon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const galloId = Number(assignGalloId);

    if (!galloId || !assignGalpon) {
      setError("Selecciona un gallo y un galpón");
      return;
    }

    setError("");
    setMessage("");
    setLoading(true);
    try {
      const response = await fetch("/api/roosters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: galloId, galpon: assignGalpon }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo asignar el gallo");
      }

      setMessage("Gallo asignado al galpón correctamente");
      await loadRoosters();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  function onDownloadPdf() {
    if (pairs.length === 0) {
      setError("Primero debes generar un sorteo");
      return;
    }

    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text("Acta de Emparejamientos 1v1", 14, 14);

    autoTable(doc, {
      startY: 20,
      head: [["#", "Gallo A", "Galpón A", "Propietario A", "Peso A", "Gallo B", "Galpón B", "Propietario B", "Peso B", "Dif (g)", "Tiempo"]],
      body: pairs.map((pair, index) => [
        String(index + 1),
        pair.gallo_a_nombre,
        pair.galpon_a,
        pair.propietario_a,
        pair.peso_a_libras.toFixed(2),
        pair.gallo_b_nombre,
        pair.galpon_b,
        pair.propietario_b,
        pair.peso_b_libras.toFixed(2),
        String(pair.diferencia_gramos),
        "",
      ]),
      styles: { fontSize: 8 },
    });

    doc.save("emparejamientos-1v1.pdf");
  }

  const printLink = useMemo(() => {
    const printable = pairs.map((pair, index) => ({
      index: index + 1,
      galloA: pair.gallo_a_nombre,
      galponA: pair.galpon_a,
      propietarioA: pair.propietario_a,
      pesoA: pair.peso_a_libras.toFixed(2),
      galloB: pair.gallo_b_nombre,
      galponB: pair.galpon_b,
      propietarioB: pair.propietario_b,
      pesoB: pair.peso_b_libras.toFixed(2),
      diferencia: String(pair.diferencia_gramos),
    }));
    return `/print?pairs=${encodeURIComponent(JSON.stringify(printable))}`;
  }, [pairs]);

  const galponesConGallos = useMemo(() => {
    const grouped = new Map<string, string[]>();
    for (const rooster of roosters) {
      const galponKey = rooster.galpon.trim();
      if (!grouped.has(galponKey)) {
        grouped.set(galponKey, []);
      }
      grouped.get(galponKey)?.push(rooster.nombre_gallo);
    }

    return Array.from(grouped.entries())
      .map(([galpon, nombres]) => ({
        galpon,
        cantidad: nombres.length,
        nombres,
      }))
      .sort((a, b) => a.galpon.localeCompare(b.galpon));
  }, [roosters]);

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed left-0 top-0 h-screen w-64 border-r p-4">
        <h2 className="mb-6 text-xl font-bold">Menú</h2>
        <nav className="space-y-2">
          <button
            type="button"
            onClick={() => setActiveSection("gallos")}
            className={`w-full rounded px-3 py-2 text-left ${activeSection === "gallos" ? "bg-foreground text-background" : "border"}`}
          >
            Gallos
          </button>
          <button
            type="button"
            onClick={() => setActiveSection("galpones")}
            className={`w-full rounded px-3 py-2 text-left ${activeSection === "galpones" ? "bg-foreground text-background" : "border"}`}
          >
            Galpón
          </button>
          <button
            type="button"
            onClick={() => setActiveSection("sorteo")}
            className={`w-full rounded px-3 py-2 text-left ${activeSection === "sorteo" ? "bg-foreground text-background" : "border"}`}
          >
            Sorteo
          </button>
        </nav>

        <div className="mt-8 space-y-3 text-sm">
          <div className="rounded border p-3">
            <p className="opacity-70">Gallos</p>
            <p className="text-xl font-bold">{roosters.length}</p>
          </div>
          <div className="rounded border p-3">
            <p className="opacity-70">Galpones</p>
            <p className="text-xl font-bold">{galpones.length}</p>
          </div>
          <div className="rounded border p-3">
            <p className="opacity-70">1v1</p>
            <p className="text-xl font-bold">{pairs.length > 0 ? pairs.length : dbMatchesCount}</p>
          </div>
        </div>
      </aside>

      <main className="ml-64 min-h-screen p-6">
        <h1 className="mb-2 text-3xl font-bold">Sistema de Sorteo 1v1</h1>
        <p className="mb-6 text-sm opacity-80">
          Empareja por peso y no permite cruces entre gallos del mismo galpón.
        </p>

        {activeSection === "gallos" && (
          <section className="space-y-6">
            <div className="rounded-lg border p-4">
              <h2 className="mb-4 text-xl font-semibold">Registro de gallos</h2>
              <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                <input
                  value={form.nombre_gallo}
                  onChange={(e) => setForm((prev) => ({ ...prev, nombre_gallo: e.target.value }))}
                  placeholder="Nombre del gallo"
                  className="rounded border px-3 py-2"
                  required
                />
                <select
                  value={form.galpon}
                  onChange={(e) => setForm((prev) => ({ ...prev, galpon: e.target.value }))}
                  className="rounded border px-3 py-2"
                  required
                >
                  <option value="">Seleccione galpón</option>
                  {galpones.map((galpon) => (
                    <option key={galpon.id} value={galpon.nombre}>
                      {galpon.nombre}
                    </option>
                  ))}
                </select>
                <input
                  value={form.propietario}
                  onChange={(e) => setForm((prev) => ({ ...prev, propietario: e.target.value }))}
                  placeholder="Propietario"
                  className="rounded border px-3 py-2"
                  required
                />
                <input
                  value={form.color_gallo}
                  onChange={(e) => setForm((prev) => ({ ...prev, color_gallo: e.target.value }))}
                  placeholder="Color de gallo"
                  className="rounded border px-3 py-2"
                  required
                />
                <input
                  value={form.color_pata}
                  onChange={(e) => setForm((prev) => ({ ...prev, color_pata: e.target.value }))}
                  placeholder="Color de pata"
                  className="rounded border px-3 py-2"
                  required
                />
                <input
                  value={form.peso_libras}
                  onChange={(e) => setForm((prev) => ({ ...prev, peso_libras: e.target.value }))}
                  placeholder="Peso (libras)"
                  type="number"
                  step="0.01"
                  min="0"
                  className="rounded border px-3 py-2"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded bg-foreground px-5 py-3 text-base font-semibold text-background disabled:opacity-60"
                >
                  Guardar gallo
                </button>
              </form>
            </div>

            <div className="rounded-lg border p-4">
              <h2 className="mb-4 text-xl font-semibold">Listado de gallos inscritos</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="border p-2">ID</th>
                      <th className="border p-2">Gallo</th>
                      <th className="border p-2">Galpón</th>
                      <th className="border p-2">Propietario</th>
                      <th className="border p-2">Color gallo</th>
                      <th className="border p-2">Color pata</th>
                      <th className="border p-2">Peso (lb)</th>
                      <th className="border p-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roosters.map((rooster) => (
                      <tr key={rooster.id}>
                        <td className="border p-2 text-center">{rooster.id}</td>
                        <td className="border p-2">{rooster.nombre_gallo}</td>
                        <td className="border p-2">{rooster.galpon}</td>
                        <td className="border p-2">{rooster.propietario}</td>
                        <td className="border p-2">{rooster.color_gallo}</td>
                        <td className="border p-2">{rooster.color_pata}</td>
                        <td className="border p-2 text-right">{rooster.peso_libras.toFixed(2)}</td>
                        <td className="border p-2 text-center">
                          <button
                            type="button"
                            onClick={() => onDeleteRooster(rooster.id)}
                            className="rounded border px-2 py-1 text-xs"
                            disabled={loading}
                          >
                            Borrar
                          </button>
                        </td>
                      </tr>
                    ))}
                    {roosters.length === 0 && (
                      <tr>
                        <td colSpan={8} className="border p-3 text-center opacity-70">
                          No hay gallos registrados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeSection === "galpones" && (
          <section className="space-y-6">
            <div className="rounded-lg border p-4">
              <h2 className="mb-4 text-xl font-semibold">Registrar galpón</h2>
              <form onSubmit={onCreateGalpon} className="flex flex-col gap-3 md:flex-row">
                <input
                  value={galponNuevo}
                  onChange={(e) => setGalponNuevo(e.target.value)}
                  placeholder="Nombre del galpón"
                  className="flex-1 rounded border px-3 py-2"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded bg-foreground px-5 py-3 text-base font-semibold text-background disabled:opacity-60"
                >
                  Guardar galpón
                </button>
              </form>
            </div>

            <div className="rounded-lg border p-4">
              <h2 className="mb-4 text-xl font-semibold">Asignar gallo a galpón</h2>
              <form onSubmit={onAssignGalloGalpon} className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <select
                  value={assignGalloId}
                  onChange={(e) => setAssignGalloId(e.target.value)}
                  className="rounded border px-3 py-2"
                  required
                >
                  <option value="">Seleccione gallo</option>
                  {roosters.map((rooster) => (
                    <option key={rooster.id} value={rooster.id}>
                      {rooster.nombre_gallo}
                    </option>
                  ))}
                </select>
                <select
                  value={assignGalpon}
                  onChange={(e) => setAssignGalpon(e.target.value)}
                  className="rounded border px-3 py-2"
                  required
                >
                  <option value="">Seleccione galpón</option>
                  {galpones.map((galpon) => (
                    <option key={galpon.id} value={galpon.nombre}>
                      {galpon.nombre}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded bg-foreground px-5 py-3 text-base font-semibold text-background disabled:opacity-60"
                >
                  Asignar
                </button>
              </form>
            </div>

            <div className="rounded-lg border p-4">
              <h2 className="mb-4 text-xl font-semibold">Galpones y gallos pertenecientes</h2>
              {galponesConGallos.length === 0 ? (
                <p className="text-sm opacity-70">Aún no hay galpones con gallos.</p>
              ) : (
                <div className="space-y-3">
                  {galponesConGallos.map((item) => (
                    <div key={item.galpon} className="rounded border p-3">
                      <p className="font-medium">
                        {item.galpon} ({item.cantidad} gallos)
                      </p>
                      <p className="text-sm opacity-80">{item.nombres.join(", ")}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {activeSection === "sorteo" && (
          <section className="space-y-6">
            <div className="rounded-lg border p-4">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold">Sorteo de emparejamientos 1v1</h2>
                <button
                  type="button"
                  onClick={onDrawPairs}
                  disabled={loading || roosters.length < 2}
                  className="rounded bg-foreground px-5 py-3 text-base font-semibold text-background disabled:opacity-60"
                >
                  Nuevo sorteo 1v1
                </button>
                <button
                  type="button"
                  onClick={onClearMatches}
                  disabled={loading || (pairs.length === 0 && dbMatchesCount === 0)}
                  className="rounded border px-5 py-3 text-base font-semibold disabled:opacity-50"
                >
                  Limpiar sorteo
                </button>
                <button
                  type="button"
                  onClick={onDownloadPdf}
                  className={`rounded border px-5 py-3 text-base font-semibold ${pairs.length === 0 ? "pointer-events-none opacity-50" : ""}`}
                >
                  Descargar PDF
                </button>
                <a
                  href={printLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`rounded border px-5 py-3 text-base font-semibold ${pairs.length === 0 ? "pointer-events-none opacity-50" : ""}`}
                >
                  Imprimir acta
                </a>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="border p-2">#</th>
                      <th className="border p-2">Gallo A</th>
                      <th className="border p-2">Galpón A</th>
                      <th className="border p-2">Propietario A</th>
                      <th className="border p-2">Peso A</th>
                      <th className="border p-2">Gallo B</th>
                      <th className="border p-2">Galpón B</th>
                      <th className="border p-2">Propietario B</th>
                      <th className="border p-2">Peso B</th>
                      <th className="border p-2">Dif (g)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pairs.map((pair, index) => (
                      <tr key={pair.id}>
                        <td className="border p-2 text-center">{index + 1}</td>
                        <td className="border p-2">{pair.gallo_a_nombre}</td>
                        <td className="border p-2">{pair.galpon_a}</td>
                        <td className="border p-2">{pair.propietario_a}</td>
                        <td className="border p-2 text-right">{pair.peso_a_libras.toFixed(2)}</td>
                        <td className="border p-2">{pair.gallo_b_nombre}</td>
                        <td className="border p-2">{pair.galpon_b}</td>
                        <td className="border p-2">{pair.propietario_b}</td>
                        <td className="border p-2 text-right">{pair.peso_b_libras.toFixed(2)}</td>
                        <td className="border p-2 text-right">{pair.diferencia_gramos}</td>
                      </tr>
                    ))}
                    {pairs.length === 0 && (
                      <tr>
                        <td colSpan={10} className="border p-3 text-center opacity-70">
                          Aún no se ha generado el sorteo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {(message || error) && (
          <div className="mt-4">
            {message && <p className="text-green-600">{message}</p>}
            {error && <p className="text-red-600">{error}</p>}
          </div>
        )}
      </main>
    </div>
  );
}
