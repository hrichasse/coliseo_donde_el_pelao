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
  const [drawSummary, setDrawSummary] = useState<{
    total_inscritos: number;
    total_1v1: number;
    total_sobrantes: number;
    total_1v1_posibles: number;
  } | null>(null);
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
      setDrawSummary(payload.resumen ?? null);
      if ((payload.sobrantes ?? []).length > 0) {
        setMessage(
          `Sorteo completo: ${payload.resumen?.total_1v1 ?? 0} de ${payload.resumen?.total_1v1_posibles ?? 0} peleas posibles. Sobrantes: ${payload.sobrantes.length}`,
        );
      } else {
        setMessage(
          `Sorteo completo: ${payload.resumen?.total_1v1 ?? 0} peleas generadas para ${payload.resumen?.total_inscritos ?? 0} gallos inscritos.`,
        );
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
      setDrawSummary(null);
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
      setDrawSummary(null);
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
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute right-10 top-24 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute bottom-10 left-1/3 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
      </div>

      <aside className="fixed left-0 top-0 z-10 h-screen w-72 border-r border-slate-800 bg-slate-950/80 p-5 backdrop-blur">
        <h2 className="mb-1 text-xl font-semibold tracking-wide">Coliseo donde el Pelao</h2>
        <p className="mb-6 text-xs text-slate-400">Panel de operación</p>

        <nav className="space-y-2">
          <button
            type="button"
            onClick={() => setActiveSection("gallos")}
            className={`w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
              activeSection === "gallos"
                ? "bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-400/40"
                : "border border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-900"
            }`}
          >
            Gallos
          </button>
          <button
            type="button"
            onClick={() => setActiveSection("galpones")}
            className={`w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
              activeSection === "galpones"
                ? "bg-fuchsia-500/20 text-fuchsia-200 ring-1 ring-fuchsia-400/40"
                : "border border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-900"
            }`}
          >
            Galpón
          </button>
          <button
            type="button"
            onClick={() => setActiveSection("sorteo")}
            className={`w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
              activeSection === "sorteo"
                ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/40"
                : "border border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-900"
            }`}
          >
            Sorteo
          </button>
        </nav>

        <div className="mt-8 space-y-3 text-sm">
          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
            <p className="text-slate-400">Gallos</p>
            <p className="text-2xl font-bold text-cyan-300">{roosters.length}</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
            <p className="text-slate-400">Galpones</p>
            <p className="text-2xl font-bold text-fuchsia-300">{galpones.length}</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
            <p className="text-slate-400">1v1</p>
            <p className="text-2xl font-bold text-emerald-300">{pairs.length > 0 ? pairs.length : dbMatchesCount}</p>
          </div>
        </div>
      </aside>

      <main className="relative z-10 ml-72 min-h-screen p-6 md:p-8">
        <h1 className="mb-2 text-3xl font-bold tracking-tight md:text-4xl">Cotejas Coliseo donde el Pelao</h1>
        <p className="mb-6 text-sm text-slate-300 md:text-base">
          Empareja por peso y no permite cruces entre gallos del mismo galpón.
        </p>

        {activeSection === "gallos" && (
          <section className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-black/20">
              <h2 className="mb-4 text-xl font-semibold text-cyan-200">Registro de gallos</h2>
              <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                <input
                  value={form.nombre_gallo}
                  onChange={(e) => setForm((prev) => ({ ...prev, nombre_gallo: e.target.value }))}
                  placeholder="Nombre del gallo"
                  className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-slate-100 outline-none ring-cyan-400/50 placeholder:text-slate-500 focus:ring"
                  required
                />
                <select
                  value={form.galpon}
                  onChange={(e) => setForm((prev) => ({ ...prev, galpon: e.target.value }))}
                  className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-slate-100 outline-none ring-cyan-400/50 focus:ring"
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
                  className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-slate-100 outline-none ring-cyan-400/50 placeholder:text-slate-500 focus:ring"
                  required
                />
                <input
                  value={form.color_gallo}
                  onChange={(e) => setForm((prev) => ({ ...prev, color_gallo: e.target.value }))}
                  placeholder="Color de gallo"
                  className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-slate-100 outline-none ring-cyan-400/50 placeholder:text-slate-500 focus:ring"
                  required
                />
                <input
                  value={form.color_pata}
                  onChange={(e) => setForm((prev) => ({ ...prev, color_pata: e.target.value }))}
                  placeholder="Color de pata"
                  className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-slate-100 outline-none ring-cyan-400/50 placeholder:text-slate-500 focus:ring"
                  required
                />
                <input
                  value={form.peso_libras}
                  onChange={(e) => setForm((prev) => ({ ...prev, peso_libras: e.target.value }))}
                  placeholder="Peso (libras)"
                  type="number"
                  step="0.01"
                  min="0"
                  className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-slate-100 outline-none ring-cyan-400/50 placeholder:text-slate-500 focus:ring"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-cyan-500 px-5 py-3 text-base font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60"
                >
                  Guardar gallo
                </button>
              </form>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-black/20">
              <h2 className="mb-4 text-xl font-semibold text-cyan-200">Listado de gallos inscritos</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm text-slate-100">
                  <thead>
                    <tr>
                      <th className="border border-slate-700 bg-slate-800 p-2">ID</th>
                      <th className="border border-slate-700 bg-slate-800 p-2">Gallo</th>
                      <th className="border border-slate-700 bg-slate-800 p-2">Galpón</th>
                      <th className="border border-slate-700 bg-slate-800 p-2">Propietario</th>
                      <th className="border border-slate-700 bg-slate-800 p-2">Color gallo</th>
                      <th className="border border-slate-700 bg-slate-800 p-2">Color pata</th>
                      <th className="border border-slate-700 bg-slate-800 p-2">Peso (lb)</th>
                      <th className="border border-slate-700 bg-slate-800 p-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roosters.map((rooster) => (
                      <tr key={rooster.id} className="hover:bg-slate-800/70">
                        <td className="border border-slate-700 p-2 text-center">{rooster.id}</td>
                        <td className="border border-slate-700 p-2">{rooster.nombre_gallo}</td>
                        <td className="border border-slate-700 p-2">{rooster.galpon}</td>
                        <td className="border border-slate-700 p-2">{rooster.propietario}</td>
                        <td className="border border-slate-700 p-2">{rooster.color_gallo}</td>
                        <td className="border border-slate-700 p-2">{rooster.color_pata}</td>
                        <td className="border border-slate-700 p-2 text-right">{rooster.peso_libras.toFixed(2)}</td>
                        <td className="border border-slate-700 p-2 text-center">
                          <button
                            type="button"
                            onClick={() => onDeleteRooster(rooster.id)}
                            className="rounded-md border border-rose-400/40 px-2.5 py-1 text-xs text-rose-200 transition hover:bg-rose-500/20"
                            disabled={loading}
                          >
                            Borrar
                          </button>
                        </td>
                      </tr>
                    ))}
                    {roosters.length === 0 && (
                      <tr>
                        <td colSpan={8} className="border border-slate-700 p-3 text-center text-slate-400">
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
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-black/20">
              <h2 className="mb-4 text-xl font-semibold text-fuchsia-200">Registrar galpón</h2>
              <form onSubmit={onCreateGalpon} className="flex flex-col gap-3 md:flex-row">
                <input
                  value={galponNuevo}
                  onChange={(e) => setGalponNuevo(e.target.value)}
                  placeholder="Nombre del galpón"
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-slate-100 outline-none ring-fuchsia-400/50 placeholder:text-slate-500 focus:ring"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-fuchsia-500 px-5 py-3 text-base font-semibold text-slate-950 transition hover:bg-fuchsia-400 disabled:opacity-60"
                >
                  Guardar galpón
                </button>
              </form>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-black/20">
              <h2 className="mb-4 text-xl font-semibold text-fuchsia-200">Asignar gallo a galpón</h2>
              <form onSubmit={onAssignGalloGalpon} className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <select
                  value={assignGalloId}
                  onChange={(e) => setAssignGalloId(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-slate-100 outline-none ring-fuchsia-400/50 focus:ring"
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
                  className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-slate-100 outline-none ring-fuchsia-400/50 focus:ring"
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
                  className="rounded-lg bg-fuchsia-500 px-5 py-3 text-base font-semibold text-slate-950 transition hover:bg-fuchsia-400 disabled:opacity-60"
                >
                  Asignar
                </button>
              </form>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-black/20">
              <h2 className="mb-4 text-xl font-semibold text-fuchsia-200">Galpones y gallos pertenecientes</h2>
              {galponesConGallos.length === 0 ? (
                <p className="text-sm text-slate-400">Aún no hay galpones con gallos.</p>
              ) : (
                <div className="space-y-3">
                  {galponesConGallos.map((item) => (
                    <div key={item.galpon} className="rounded-xl border border-slate-700 bg-slate-800/50 p-3">
                      <p className="font-medium text-fuchsia-100">
                        {item.galpon} ({item.cantidad} gallos)
                      </p>
                      <p className="text-sm text-slate-300">{item.nombres.join(", ")}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {activeSection === "sorteo" && (
          <section className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-black/20">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-emerald-200">Sorteo de Cotejas</h2>
                <button
                  type="button"
                  onClick={onDrawPairs}
                  disabled={loading || roosters.length < 2}
                  className="rounded-lg bg-emerald-500 px-5 py-3 text-base font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
                >
                  Generar enfretamientos
                </button>
                <button
                  type="button"
                  onClick={onClearMatches}
                  disabled={loading || (pairs.length === 0 && dbMatchesCount === 0)}
                  className="rounded-lg border border-slate-600 px-5 py-3 text-base font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
                >
                  Limpiar sorteo
                </button>
                <button
                  type="button"
                  onClick={onDownloadPdf}
                  className={`rounded-lg border border-slate-600 px-5 py-3 text-base font-semibold text-slate-200 transition hover:bg-slate-800 ${pairs.length === 0 ? "pointer-events-none opacity-50" : ""}`}
                >
                  Descargar PDF
                </button>
                <a
                  href={printLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`rounded-lg border border-slate-600 px-5 py-3 text-base font-semibold text-slate-200 transition hover:bg-slate-800 ${pairs.length === 0 ? "pointer-events-none opacity-50" : ""}`}
                >
                  Imprimir acta
                </a>
              </div>

              <p className="mb-4 text-sm text-slate-300">
                Este botón genera en una sola vez todos los enfretamientos disponibles
              </p>

              {drawSummary && (
                <div className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                  Inscritos: {drawSummary.total_inscritos} | 1v1 posibles: {drawSummary.total_1v1_posibles} | 1v1 generados: {drawSummary.total_1v1} | Sobrantes: {drawSummary.total_sobrantes}
                </div>
              )}

              {pairs.length === 0 ? (
                <div className="rounded-xl border border-slate-700 p-4 text-center text-slate-400">Aún no se ha generado el sorteo.</div>
              ) : (
                <div className="space-y-3">
                  {pairs.map((pair, index) => (
                    <div key={pair.id} className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-semibold text-emerald-300">Pelea #{index + 1}</p>
                        <p className="text-xs text-slate-300">Diferencia: {pair.diferencia_gramos} g</p>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 p-3">
                          <p className="mb-1 text-xs font-semibold text-cyan-300">GALLO A</p>
                          <p className="text-base font-semibold">{pair.gallo_a_nombre}</p>
                          <p className="text-sm text-slate-300">Galpón: {pair.galpon_a}</p>
                          <p className="text-sm text-slate-300">Propietario: {pair.propietario_a}</p>
                          <p className="text-sm text-slate-300">Peso: {pair.peso_a_libras.toFixed(2)} lb</p>
                        </div>

                        <div className="rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/10 p-3">
                          <p className="mb-1 text-xs font-semibold text-fuchsia-300">GALLO B</p>
                          <p className="text-base font-semibold">{pair.gallo_b_nombre}</p>
                          <p className="text-sm text-slate-300">Galpón: {pair.galpon_b}</p>
                          <p className="text-sm text-slate-300">Propietario: {pair.propietario_b}</p>
                          <p className="text-sm text-slate-300">Peso: {pair.peso_b_libras.toFixed(2)} lb</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {(message || error) && (
          <div className="mt-4 space-y-2">
            {message && <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-emerald-300">{message}</p>}
            {error && <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-rose-300">{error}</p>}
          </div>
        )}
      </main>
    </div>
  );
}
