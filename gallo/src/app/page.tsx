"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Rooster } from "@/lib/types";

type DrawPair = {
  id: number;
  galpon_a: string;
  galpon_b: string;
  propietario_a: string;
  propietario_b: string;
  peso_a_libras: number;
  peso_b_libras: number;
  diferencia_gramos: number;
};

type FormState = {
  galpon: string;
  propietario: string;
  color_gallo: string;
  color_pata: string;
  peso_libras: string;
};

const INITIAL_FORM: FormState = {
  galpon: "",
  propietario: "",
  color_gallo: "",
  color_pata: "",
  peso_libras: "",
};

export default function Home() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [roosters, setRoosters] = useState<Rooster[]>([]);
  const [pairs, setPairs] = useState<DrawPair[]>([]);
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
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function onDrawPairs() {
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function onDeleteRooster(id: number) {
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  const printLink = useMemo(() => {
    const printable = pairs.map((pair, index) => ({
      index: index + 1,
      galponA: pair.galpon_a,
      propietarioA: pair.propietario_a,
      pesoA: pair.peso_a_libras.toFixed(2),
      galponB: pair.galpon_b,
      propietarioB: pair.propietario_b,
      pesoB: pair.peso_b_libras.toFixed(2),
      diferencia: String(pair.diferencia_gramos),
    }));
    return `/print?pairs=${encodeURIComponent(JSON.stringify(printable))}`;
  }, [pairs]);

  return (
    <main className="mx-auto min-h-screen max-w-6xl p-6">
      <h1 className="mb-2 text-3xl font-bold">Sistema de Sorteo 1v1</h1>
      <p className="mb-6 text-sm opacity-80">
        Empareja por peso (preferencia menor diferencia en gramos) y nunca cruza gallos del mismo galpón.
      </p>

      <section className="mb-8 rounded-lg border p-4">
        <h2 className="mb-4 text-xl font-semibold">Registro de gallos</h2>
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <input
            value={form.galpon}
            onChange={(e) => setForm((prev) => ({ ...prev, galpon: e.target.value }))}
            placeholder="Galpón (organización)"
            className="rounded border px-3 py-2"
            required
          />
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
            className="rounded bg-foreground px-4 py-2 font-medium text-background disabled:opacity-60"
          >
            Guardar gallo
          </button>
        </form>
      </section>

      <section className="mb-8 rounded-lg border p-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold">Listado de gallos inscritos</h2>
          <button
            type="button"
            onClick={loadRoosters}
            className="rounded border px-3 py-1 text-sm"
            disabled={loading}
          >
            Refrescar
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border p-2">ID</th>
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
                  <td colSpan={7} className="border p-3 text-center opacity-70">
                    No hay gallos registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border p-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold">Sorteo de emparejamientos</h2>
          <button
            type="button"
            onClick={onDrawPairs}
            disabled={loading || roosters.length < 2}
            className="rounded bg-foreground px-4 py-2 font-medium text-background disabled:opacity-60"
          >
            Generar 1v1
          </button>
          <a
            href={printLink}
            target="_blank"
            rel="noopener noreferrer"
            className={`rounded border px-4 py-2 text-sm ${pairs.length === 0 ? "pointer-events-none opacity-50" : ""}`}
          >
            Abrir hoja imprimible
          </a>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border p-2">#</th>
                <th className="border p-2">Galpón A</th>
                <th className="border p-2">Propietario A</th>
                <th className="border p-2">Peso A</th>
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
                  <td className="border p-2">{pair.galpon_a}</td>
                  <td className="border p-2">{pair.propietario_a}</td>
                  <td className="border p-2 text-right">{pair.peso_a_libras.toFixed(2)}</td>
                  <td className="border p-2">{pair.galpon_b}</td>
                  <td className="border p-2">{pair.propietario_b}</td>
                  <td className="border p-2 text-right">{pair.peso_b_libras.toFixed(2)}</td>
                  <td className="border p-2 text-right">{pair.diferencia_gramos}</td>
                </tr>
              ))}
              {pairs.length === 0 && (
                <tr>
                  <td colSpan={8} className="border p-3 text-center opacity-70">
                    Aún no se ha generado el sorteo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {(message || error) && (
        <div className="mt-4">
          {message && <p className="text-green-600">{message}</p>}
          {error && <p className="text-red-600">{error}</p>}
        </div>
      )}
    </main>
  );
}
