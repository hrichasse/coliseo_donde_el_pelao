"use client";

export const dynamic = "force-dynamic";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Rooster, Galpon } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";

// Verificar autenticación en el cliente
function useProtected() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hasToken = Boolean(sessionStorage.getItem("auth_token"));
    if (!hasToken) {
      window.location.replace("/login");
    } else {
      setAuthorized(true);
      setLoading(false);
    }
  }, []);

  return { authorized, loading };
}

type DrawPair = {
  id: number;
  gallo_a_id: number;
  gallo_b_id: number;
  gallo_a_nombre: string;
  gallo_b_nombre: string;
  galpon_a: string;
  galpon_b: string;
  propietario_a: string;
  propietario_b: string;
  color_a: string;
  color_b: string;
  peso_a_libras: number;
  peso_b_libras: number;
  diferencia_gramos: number;
  ganador_id?: number | null;
  duracion_segundos?: number | null;
};

type FormState = {
  nombre_gallo: string;
  galpon: string;
  propietario: string;
  color_gallo: string;
  color_pata: string;
  peso_libras: string;
  plaqueo: string;
};

const INITIAL_FORM: FormState = {
  nombre_gallo: "",
  galpon: "",
  propietario: "",
  color_gallo: "",
  color_pata: "",
  peso_libras: "",
  plaqueo: "",
};

type SectionKey = "gallos" | "galpones" | "sorteo" | "reporte";

type ReportRow = {
  posicion: number;
  galpon: string;
  propietario: string;
  frente: string;
  plaqueo: string | null;
  puntos: number;
  peleas: number;
  tiempo_total_segundos: number;
  tiempo_total_minutos: number;
  mejor_tiempo_victoria_segundos: number | null;
};

export default function Home() {
  const { logout } = useAuth();
  const { authorized, loading: authLoading } = useProtected();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [roosters, setRoosters] = useState<Rooster[]>([]);
  const [galpones, setGalpones] = useState<Galpon[]>([]);
  const [pairs, setPairs] = useState<DrawPair[]>([]);
  const [sobrantes, setSobrantes] = useState<Rooster[]>([]);
  const [incompleteFrentes, setIncompleteFrentes] = useState<Rooster[]>([]);
  const [dbMatchesCount, setDbMatchesCount] = useState(0);
  const [activeSection, setActiveSection] = useState<SectionKey>("gallos");
  const [galponNuevo, setGalponNuevo] = useState("");
  const [assignGalloId, setAssignGalloId] = useState<string>("");
  const [assignGalpon, setAssignGalpon] = useState<string>("");
  const [showCreateGalpon, setShowCreateGalpon] = useState(false);
  const [nuevoGalponNombre, setNuevoGalponNombre] = useState("");
  const [nuevoGalponPropietario, setNuevoGalponPropietario] = useState("");
  const [drawSummary, setDrawSummary] = useState<{
    total_inscritos: number;
    total_1v1: number;
    total_sobrantes: number;
    total_1v1_posibles: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [reportRows, setReportRows] = useState<ReportRow[]>([]);
  const [resultByMatch, setResultByMatch] = useState<Record<number, { ganadorId: string; segundos: string }>>({});
  const [nextPlaqueo, setNextPlaqueo] = useState<number>(1000);
  const [manualGalloAId, setManualGalloAId] = useState<string>("");
  const [manualGalloBId, setManualGalloBId] = useState<string>("");
  const [colorGalloCustom, setColorGalloCustom] = useState(false);
  const [colorPataCustom, setColorPataCustom] = useState(false);

  const COLORES_GALLO = ["MORO", "AJISECO", "AJI CACHUFO", "AJI SECO CRESTON", "AJI PLUMON", "PINTO", "CENIZO", "CARMELO", "AMARILLO", "GALLINO TABACO", "GALLINO NEGRO", "JIRO", "BARROSO"];
  const COLORES_PATA = ["AMARILLO", "BLANCA", "NEGRA", "VERDE", "JASPEADO"];

  const normalizeFrente = (value: string) => value.trim().replace(/\s+/g, " ").toUpperCase();

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
    loadReport();
  }, []);

  useEffect(() => {
    if (pairs.length === 0) {
      setSobrantes([]);
      setIncompleteFrentes([]);
      setDrawSummary(null);
      return;
    }

    if (roosters.length === 0) {
      return;
    }

    const matchedIds = new Set(pairs.flatMap((pair) => [pair.gallo_a_id, pair.gallo_b_id]));
    const sobrantesActual = roosters.filter((rooster) => !matchedIds.has(rooster.id));

    setSobrantes(sobrantesActual);
    setDrawSummary({
      total_inscritos: roosters.length,
      total_1v1: pairs.length,
      total_sobrantes: sobrantesActual.length,
      total_1v1_posibles: Math.floor(roosters.length / 2),
    });
  }, [pairs, roosters]);

  // Calcular el siguiente plaqueo disponible cuando cambien los roosters
  useEffect(() => {
    if (roosters.length === 0) {
      setNextPlaqueo(1000);
      setForm((prev) => ({ ...prev, plaqueo: "1000" }));
    } else {
      const maxPlaqueo = Math.max(...roosters.map((r) => (r.plaqueo ?? 999)));
      const nextNum = Math.max(maxPlaqueo + 1, 1000);
      setNextPlaqueo(nextNum);
      setForm((prev) => ({ ...prev, plaqueo: String(nextNum) }));
    }
  }, [roosters]);

  useEffect(() => {
    if (!message) return;

    const timer = window.setTimeout(() => {
      setMessage("");
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!error) return;

    const timer = window.setTimeout(() => {
      setError("");
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [error]);

  // Rellenar propietario automáticamente cuando cambia el galpón seleccionado
  useEffect(() => {
    if (form.galpon && galpones.length > 0) {
      const galponSeleccionado = galpones.find((g) => g.nombre === form.galpon);
      if (galponSeleccionado) {
        setForm((prev) => ({ ...prev, propietario: galponSeleccionado.propietario }));
      }
    }
  }, [form.galpon, galpones]);

  async function loadReport() {
    try {
      const response = await fetch("/api/reporte");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Error cargando reporte");
      }
      setReportRows(payload.data ?? []);
    } catch {
      setReportRows([]);
    }
  }

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

      if (Array.isArray(payload.data) && payload.data.length > 0) {
        setPairs(payload.data);
        setResultByMatch(
          Object.fromEntries(
            payload.data.map((pair: DrawPair) => [
              pair.id,
              {
                ganadorId: pair.ganador_id ? String(pair.ganador_id) : "",
                segundos:
                  pair.duracion_segundos != null ? convertirSegundosAMMSS(pair.duracion_segundos) : "",
              },
            ]),
          ),
        );
      }
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

    const normalizeFrente = (value: string) => value.trim().replace(/\s+/g, " ").toUpperCase();
    const frenteIngresado = normalizeFrente(form.nombre_gallo);
    if (frenteIngresado) {
      const frenteCount = roosters.filter(
        (rooster) =>
          normalizeFrente(rooster.nombre_gallo) === frenteIngresado &&
          rooster.galpon === form.galpon,
      ).length;
      if (frenteCount >= 2) {
        setError("El frente ya tiene 2 gallos registrados en este galpón. Usa otro frente.");
        return;
      }
    }

    setError("");
    setMessage("");
    setLoading(true);
    try {
      const response = await fetch("/api/roosters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre_gallo: frenteIngresado,
          galpon: form.galpon,
          propietario: form.propietario,
          color_gallo: form.color_gallo,
          color_pata: form.color_pata,
          peso_libras: Number(form.peso_libras),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo registrar el gallo");
      }

      setForm(INITIAL_FORM);
      setColorGalloCustom(false);
      setColorPataCustom(false);
      setMessage("Frente registrado correctamente");
      setShowCreateGalpon(false);
      setNuevoGalponNombre("");
      setNuevoGalponPropietario("");
      await loadRoosters();
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
      setSobrantes(payload.sobrantes ?? []);
      setIncompleteFrentes(payload.incompleteFrentes ?? []);
      setManualGalloAId("");
      setManualGalloBId("");
      setResultByMatch(
        Object.fromEntries(
          (payload.data ?? []).map((pair: DrawPair) => [
            pair.id,
            {
              ganadorId: pair.ganador_id ? String(pair.ganador_id) : "",
              segundos: pair.duracion_segundos != null ? String(pair.duracion_segundos) : "",
            },
          ]),
        ),
      );
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
      await loadReport();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function onDrawIncremental() {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const response = await fetch("/api/matches/draw/incremental", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudieron agregar los nuevos enfrentamientos");
      }

      // Agregar las nuevas peleas a las existentes (sin borrar)
      setPairs((prev) => [...prev, ...(payload.data ?? [])]);
      setSobrantes(payload.sobrantes ?? []);
      setResultByMatch((prev) => ({
        ...prev,
        ...Object.fromEntries(
          (payload.data ?? []).map((pair: DrawPair) => [
            pair.id,
            {
              ganadorId: pair.ganador_id ? String(pair.ganador_id) : "",
              segundos: pair.duracion_segundos != null ? String(pair.duracion_segundos) : "",
            },
          ]),
        ),
      }));
      setDbMatchesCount((prev) => prev + (payload.data ?? []).length);
      const r = payload.resumen;
      setMessage(
        `Se agregaron ${r?.total_nuevas_peleas ?? 0} peleas nuevas de ${r?.total_nuevos ?? 0} gallos. Sobrantes nuevos: ${r?.total_sobrantes_nuevos ?? 0}`,
      );
      await loadReport();
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
      setResultByMatch({});
      setDrawSummary(null);
      setMessage(`Gallo ${id} eliminado correctamente`);
      await loadRoosters();
      await loadMatchesCount();
      await loadReport();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function onDeleteGalpon(nombre: string) {
    const accepted = window.confirm(`¿Seguro que deseas borrar el galpón "${nombre}"? Esto no eliminará los gallos asociados.`);
    if (!accepted) {
      return;
    }

    setError("");
    setMessage("");
    setLoading(true);
    try {
      const response = await fetch(`/api/galpones?nombre=${encodeURIComponent(nombre)}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo borrar el galpón");
      }

      setMessage(`Galpón "${nombre}" eliminado correctamente`);
      await loadGalpones();
      await loadRoosters();
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
      setSobrantes([]);
      setResultByMatch({});
      setDrawSummary(null);
      setDbMatchesCount(0);
      setManualGalloAId("");
      setManualGalloBId("");
      setMessage("Emparejamientos limpiados correctamente");
      await loadReport();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function onCreateManualPair() {
    const galloAId = Number(manualGalloAId);
    const galloBId = Number(manualGalloBId);

    if (!galloAId || !galloBId) {
      setError("Debes seleccionar dos gallos para emparejar manualmente");
      return;
    }

    if (galloAId === galloBId) {
      setError("Debes seleccionar dos gallos distintos");
      return;
    }

    const galloA = roosters.find((rooster) => rooster.id === galloAId);
    const galloB = roosters.find((rooster) => rooster.id === galloBId);

    if (!galloA || !galloB) {
      setError("No se pudieron encontrar los gallos seleccionados");
      return;
    }

    if (galloA.galpon === galloB.galpon) {
      setError("No se permite emparejar gallos del mismo galpón");
      return;
    }

    if (normalizeFrente(galloA.nombre_gallo) === normalizeFrente(galloB.nombre_gallo)) {
      setError("No se permite emparejar gallos del mismo frente");
      return;
    }

    setError("");
    setMessage("");
    setLoading(true);
    try {
      const response = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gallo_a_id: galloAId, gallo_b_id: galloBId }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo crear el emparejamiento manual");
      }

      setPairs((prev) => [...prev, payload.data]);
      setDbMatchesCount((prev) => prev + 1);
      setResultByMatch((prev) => ({
        ...prev,
        [payload.data.id]: {
          ganadorId: payload.data.ganador_id ? String(payload.data.ganador_id) : "",
          segundos:
            payload.data.duracion_segundos != null ? convertirSegundosAMMSS(payload.data.duracion_segundos) : "",
        },
      }));
      setManualGalloAId("");
      setManualGalloBId("");
      setIncompleteFrentes((prev) => prev.filter((rooster) => rooster.id !== galloAId && rooster.id !== galloBId));
      setMessage("Emparejamiento manual agregado correctamente");
      await loadReport();
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
        body: JSON.stringify({ nombre: galponNuevo.trim(), propietario: galponNuevo.trim() }),
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

  async function onCreateGalponFromRooster() {
    if (!nuevoGalponNombre.trim()) {
      setError("El nombre del galpón es requerido");
      return;
    }

    if (!nuevoGalponPropietario.trim()) {
      setError("El propietario del galpón es requerido");
      return;
    }

    setError("");
    setMessage("");
    setLoading(true);
    try {
      const response = await fetch("/api/galpones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nuevoGalponNombre.trim(), propietario: nuevoGalponPropietario.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo crear el galpón");
      }

      // Auto-seleccionar el nuevo galpón en el formulario
      setForm((prev) => ({ ...prev, galpon: nuevoGalponNombre.trim(), propietario: nuevoGalponPropietario.trim() }));
      
      // Limpiar y cerrar
      setNuevoGalponNombre("");
      setNuevoGalponPropietario("");
      setShowCreateGalpon(false);
      setMessage("Galpón creado y seleccionado correctamente");
      
      // Recargar galpones
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
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.text("Acta de Emparejamientos 1v1", 14, 14);

    autoTable(doc, {
      startY: 20,
      rowPageBreak: "avoid",
      head: [["#", "Frente A", "Galpón A", "Propietario A", "Color A", "Peso A", "Frente B", "Galpón B", "Propietario B", "Color B", "Peso B", "Dif (g)", "Tiempo (manual)", "Puntaje"]],
      body: pairs.map((pair, index) => [
        String(index + 1),
        pair.gallo_a_nombre,
        pair.galpon_a,
        pair.propietario_a,
        pair.color_a,
        pair.peso_a_libras.toFixed(2),
        pair.gallo_b_nombre,
        pair.galpon_b,
        pair.propietario_b,
        pair.color_b,
        pair.peso_b_libras.toFixed(2),
        String(pair.diferencia_gramos),
        "",
        "",
      ]),
      theme: "grid",
      styles: {
        fontSize: 10,
        cellPadding: 2.3,
        lineColor: [70, 70, 70],
        lineWidth: 0.2,
        textColor: [0, 0, 0],
        fillColor: [255, 255, 255],
      },
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: [255, 255, 255],
        lineColor: [0, 0, 0],
        lineWidth: 0.25,
        fontStyle: "bold",
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
      },
    });

    doc.save("emparejamientos-1v1.pdf");
  }

  const printLink = useMemo(() => {
    const printable = pairs.map((pair, index) => ({
      index: index + 1,
      galloA: pair.gallo_a_nombre,
      galponA: pair.galpon_a,
      propietarioA: pair.propietario_a,
      colorA: pair.color_a,
      pesoA: pair.peso_a_libras.toFixed(2),
      galloB: pair.gallo_b_nombre,
      galponB: pair.galpon_b,
      propietarioB: pair.propietario_b,
      colorB: pair.color_b,
      pesoB: pair.peso_b_libras.toFixed(2),
      diferencia: String(pair.diferencia_gramos),
    }));
    return `/print?pairs=${encodeURIComponent(JSON.stringify(printable))}`;
  }, [pairs]);

  const manualCandidates = useMemo(() => {
    return sobrantes.slice().sort((a, b) => a.id - b.id);
  }, [sobrantes]);

  // Set de IDs de gallos sin pareja (sobrantes), para badge en tarjetas de pelea
  const sobrantesIds = useMemo(() => new Set(sobrantes.map((g) => g.id)), [sobrantes]);

  // Para cada gallo en un par, si su compañero de frente está en sobrantes → badge
  function frenteCompanionSinPareja(galloId: number, nombreGallo: string, galpon: string): boolean {
    const companion = roosters.find(
      (r) => r.id !== galloId && r.nombre_gallo === nombreGallo && r.galpon === galpon,
    );
    return companion != null && sobrantesIds.has(companion.id);
  }

  const manualSelectedA = useMemo(() => {
    const selectedId = Number(manualGalloAId);
    if (!selectedId) return null;
    return manualCandidates.find((rooster) => rooster.id === selectedId) ?? null;
  }, [manualCandidates, manualGalloAId]);

  const manualCandidatesA = useMemo(() => {
    const selectedBId = Number(manualGalloBId);
    return manualCandidates.filter((rooster) => rooster.id !== selectedBId);
  }, [manualCandidates, manualGalloBId]);

  const manualCandidatesB = useMemo(() => {
    const selectedAId = Number(manualGalloAId);
    if (!selectedAId) {
      return manualCandidates;
    }

    return manualCandidates.filter((rooster) => {
      if (rooster.id === selectedAId) return false;
      if (!manualSelectedA) return true;
      if (rooster.galpon === manualSelectedA.galpon) return false;
      if (normalizeFrente(rooster.nombre_gallo) === normalizeFrente(manualSelectedA.nombre_gallo)) return false;
      return true;
    });
  }, [manualCandidates, manualGalloAId, manualSelectedA]);

  useEffect(() => {
    if (!manualGalloBId) return;

    const selectedBId = Number(manualGalloBId);
    const stillValid = manualCandidatesB.some((rooster) => rooster.id === selectedBId);
    if (!stillValid) {
      setManualGalloBId("");
    }
  }, [manualCandidatesB, manualGalloBId]);

  async function onSaveResult(pair: DrawPair) {
    const current = resultByMatch[pair.id];
    const isEmpate = current?.ganadorId === "empate";
    const ganadorId = isEmpate ? null : Number(current?.ganadorId ?? "");
    const tiempoMMSS = isEmpate ? "6:00" : current?.segundos ?? "";

    if (!isEmpate && !ganadorId) {
      setError("Debes seleccionar un ganador");
      return;
    }

    if (!tiempoMMSS || !tiempoMMSS.includes(":")) {
      setError("Debes ingresar el tiempo en formato MM:SS (ej: 2:20)");
      return;
    }

    const totalSegundos = convertirMMSSASegundos(tiempoMMSS);
    if (totalSegundos <= 0) {
      setError("El tiempo debe ser mayor a 0 segundos");
      return;
    }

    setError("");
    setMessage("");
    setLoading(true);
    try {
      const response = await fetch("/api/matches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: pair.id,
          ganador_id: ganadorId,
          duracion_segundos: totalSegundos,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo guardar el resultado");
      }

      const ganadorNombre = isEmpate
        ? "Empate"
        : ganadorId === pair.gallo_a_id
          ? pair.gallo_a_nombre
          : pair.gallo_b_nombre;

      setPairs((prev) =>
        prev.map((item) =>
          item.id === pair.id
            ? {
                ...item,
                ganador_id: ganadorId,
                duracion_segundos: totalSegundos,
              }
            : item,
        ),
      );

      const resultadoLabel = isEmpate ? "empate" : "ganó";
      setMessage(`✓ Pelea guardada: ${ganadorNombre} ${resultadoLabel} en ${tiempoMMSS} (${totalSegundos}s)`);
      await loadReport();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  function formatTiempoAutomatico(soloNumeros: string): string {
    if (!soloNumeros) return "";
    
    // Remover caracteres no numéricos
    const numeros = soloNumeros.replace(/\D/g, "");
    
    if (numeros.length === 0) return "";
    
    // Convertir a número para eliminar ceros al inicio
    const totalSegundos = Number(numeros);
    const minutos = Math.floor(totalSegundos / 60);
    const segundos = totalSegundos % 60;
    
    return `${minutos}:${segundos.toString().padStart(2, "0")}`;
  }

  function convertirMMSSASegundos(mmss: string): number {
    if (!mmss || !mmss.includes(":")) return 0;
    const [minStr, secStr] = mmss.split(":");
    const minutos = Number(minStr) || 0;
    const segundos = Number(secStr) || 0;
    return minutos * 60 + segundos;
  }

  function convertirSegundosAMMSS(totalSegundos: number): string {
    if (!totalSegundos || totalSegundos < 0) return "";
    const minutos = Math.floor(totalSegundos / 60);
    const segundos = totalSegundos % 60;
    return `${minutos}:${segundos.toString().padStart(2, "0")}`;
  }

  function onFrenteKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (event.key.length !== 1) {
      return;
    }

    if (/[a-záéíóúñ]/.test(event.key)) {
      event.preventDefault();
    }
  }

  function onDownloadReportPdf() {
    if (reportRows.length === 0) {
      setError("No hay datos en el reporte para exportar");
      return;
    }

    const doc = new jsPDF({ orientation: "landscape" });
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.text("Ranking del Torneo - Por Puntos", 14, 14);

    autoTable(doc, {
      startY: 20,
      rowPageBreak: "avoid",
      head: [["Pos.", "Galpón", "Plaqueo", "Frente", "Propietario", "Puntos", "Peleas", "Tiempo Total (MM:SS)"]],
      body: reportRows.map((row) => [
        String(row.posicion),
        row.galpon,
        row.plaqueo || "-",
        row.frente,
        row.propietario,
        String(row.puntos),
        String(row.peleas),
        convertirSegundosAMMSS(row.tiempo_total_segundos),
      ]),
      theme: "grid",
      styles: {
        fontSize: 10,
        cellPadding: 2.4,
        lineColor: [70, 70, 70],
        lineWidth: 0.2,
        textColor: [0, 0, 0],
        fillColor: [255, 255, 255],
      },
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: [255, 255, 255],
        lineColor: [0, 0, 0],
        lineWidth: 0.25,
        fontStyle: "bold",
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
      },
    });

    doc.save("ranking-torneo-puntos.pdf");
  }

  function onDownloadPollon() {
    const pollones = reportRows
      .filter(
        (row) => row.mejor_tiempo_victoria_segundos != null && row.mejor_tiempo_victoria_segundos < 60,
      )
      .sort((a, b) => (a.mejor_tiempo_victoria_segundos ?? 0) - (b.mejor_tiempo_victoria_segundos ?? 0));
    
    if (pollones.length === 0) {
      setError("No hay ningún Pollón (menos de 1 minuto)");
      return;
    }

    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text("Ranking Pollón - Gallos Ganadores en Menos de 1 Minuto", 14, 14);

    autoTable(doc, {
      startY: 20,
      rowPageBreak: "avoid",
      head: [["Pos.", "Galpón", "Plaqueo", "Frente", "Propietario", "Puntos", "Peleas", "Mejor Tiempo Pollón (MM:SS)"]],
      body: pollones.map((row, index) => [
        String(index + 1),
        row.galpon,
        row.plaqueo || "-",
        row.frente,
        row.propietario,
        String(row.puntos),
        String(row.peleas),
        convertirSegundosAMMSS(row.mejor_tiempo_victoria_segundos ?? 0),
      ]),
      styles: { fontSize: 9 },
    });

    doc.save("ranking-pollon.pdf");
  }

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

  // Mostrar pantalla de carga mientras se verifica autenticación
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-white text-lg">Verificando acceso...</div>
      </div>
    );
  }

  // Si no está autorizado, no renderizar nada (el hook redirige)
  if (!authorized) {
    return null;
  }

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
          <button
            type="button"
            onClick={() => setActiveSection("reporte")}
            className={`w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
              activeSection === "reporte"
                ? "bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/40"
                : "border border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-900"
            }`}
          >
            Reporte
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

        {/* Logo Section */}
        <div className="mt-12 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src="/images/logo.jpeg" 
            alt="Coliseo donde el Pelao" 
            style={{width: '280px', height: '280px', borderRadius: '0.5rem'}}
            className="shadow-2xl shadow-black/40 object-contain"
          />
        </div>
      </aside>

      <main className="relative z-10 ml-72 min-h-screen p-6 md:p-8">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex-1">
            <h1 className="mb-2 text-3xl font-bold tracking-tight md:text-4xl">Cotejas Coliseo donde el Pelao</h1>
            <p className="text-sm text-slate-300 md:text-base">
              Empareja por peso y no permite cruces entre gallos del mismo galpón.
            </p>
          </div>
          <div className="flex flex-col gap-4 items-end">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src="/images/logopng.png" 
              alt="Coliseo donde el Pelao" 
              style={{width: '700px', height: '170px', borderRadius: '0.5rem'}}
              className="shadow-2xl shadow-black/40 object-contain shrink-0"
            />
            <button
              onClick={logout}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 transition"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>

        {activeSection === "gallos" && (
          <section className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-black/20">
              <h2 className="mb-4 text-xl font-semibold text-cyan-200">Registro de frentes</h2>
              <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                <input
                  value={form.nombre_gallo}
                  onKeyDown={onFrenteKeyDown}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      nombre_gallo: e.target.value.toUpperCase().replace(/\s+/g, " "),
                    }))
                  }
                  placeholder="Frente (max 2)"
                  title="Solo se permite escribir en MAYÚSCULAS"
                  className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-slate-100 outline-none ring-cyan-400/50 placeholder:text-slate-500 focus:ring"
                  required
                />
                <p className="text-xs text-amber-300 md:col-span-2 lg:col-span-1">Solo MAYÚSCULAS (bloquea minúsculas)</p>
                <div className="col-span-full">
                  <div className="flex gap-2 mb-3">
                    <select
                      value={form.galpon}
                      onChange={(e) => setForm((prev) => ({ ...prev, galpon: e.target.value }))}
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-slate-100 outline-none ring-cyan-400/50 focus:ring"
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
                      type="button"
                      onClick={() => setShowCreateGalpon(!showCreateGalpon)}
                      className="rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-700 border border-slate-700"
                    >
                      {showCreateGalpon ? "Cancelar" : "Crear nuevo"}
                    </button>
                  </div>
                  
                  {showCreateGalpon && (
                    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                      <div className="flex gap-2 mb-2">
                        <input
                          value={nuevoGalponNombre}
                          onChange={(e) => setNuevoGalponNombre(e.target.value)}
                          placeholder="Nombre del nuevo galpón"
                          className="flex-1 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-slate-100 outline-none ring-cyan-400/50 placeholder:text-slate-500 focus:ring text-sm"
                        />
                        <input
                          value={nuevoGalponPropietario}
                          onChange={(e) => setNuevoGalponPropietario(e.target.value)}
                          placeholder="Propietario"
                          className="flex-1 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-slate-100 outline-none ring-cyan-400/50 placeholder:text-slate-500 focus:ring text-sm"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={onCreateGalponFromRooster}
                        disabled={loading || !nuevoGalponNombre.trim() || !nuevoGalponPropietario.trim()}
                        className="w-full rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60"
                      >
                        Guardar
                      </button>
                    </div>
                  )}
                </div>
                <input
                  value={form.propietario}
                  onChange={(e) => setForm((prev) => ({ ...prev, propietario: e.target.value }))}
                  placeholder="Propietario"
                  className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-slate-100 outline-none ring-cyan-400/50 placeholder:text-slate-500 focus:ring"
                  required
                />
                {colorGalloCustom ? (
                  <div className="flex gap-2">
                    <input
                      value={form.color_gallo}
                      onChange={(e) => setForm((prev) => ({ ...prev, color_gallo: e.target.value }))}
                      placeholder="Escribe el color del gallo"
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-slate-100 outline-none ring-cyan-400/50 placeholder:text-slate-500 focus:ring"
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => { setColorGalloCustom(false); setForm((prev) => ({ ...prev, color_gallo: "" })); }}
                      className="px-3 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-colors"
                    >✕</button>
                  </div>
                ) : (
                  <select
                    value={form.color_gallo}
                    onChange={(e) => {
                      if (e.target.value === "__custom__") {
                        setColorGalloCustom(true);
                        setForm((prev) => ({ ...prev, color_gallo: "" }));
                      } else {
                        setForm((prev) => ({ ...prev, color_gallo: e.target.value }));
                      }
                    }}
                    className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-slate-100 outline-none ring-cyan-400/50 focus:ring"
                    required
                  >
                    <option value="" disabled>Color de gallo</option>
                    {COLORES_GALLO.map((c) => <option key={c} value={c}>{c}</option>)}
                    <option value="__custom__">✏️ Agregar color...</option>
                  </select>
                )}
                {colorPataCustom ? (
                  <div className="flex gap-2">
                    <input
                      value={form.color_pata}
                      onChange={(e) => setForm((prev) => ({ ...prev, color_pata: e.target.value }))}
                      placeholder="Escribe el color de pata"
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-slate-100 outline-none ring-cyan-400/50 placeholder:text-slate-500 focus:ring"
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => { setColorPataCustom(false); setForm((prev) => ({ ...prev, color_pata: "" })); }}
                      className="px-3 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-colors"
                    >✕</button>
                  </div>
                ) : (
                  <select
                    value={form.color_pata}
                    onChange={(e) => {
                      if (e.target.value === "__custom__") {
                        setColorPataCustom(true);
                        setForm((prev) => ({ ...prev, color_pata: "" }));
                      } else {
                        setForm((prev) => ({ ...prev, color_pata: e.target.value }));
                      }
                    }}
                    className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-slate-100 outline-none ring-cyan-400/50 focus:ring"
                    required
                  >
                    <option value="" disabled>Color de pata</option>
                    {COLORES_PATA.map((c) => <option key={c} value={c}>{c}</option>)}
                    <option value="__custom__">✏️ Agregar color...</option>
                  </select>
                )}
                <input
                  value={form.plaqueo}
                  readOnly
                  placeholder="Plaqueo (automático)"
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-slate-300 outline-none cursor-not-allowed"
                />
                
                <div className="col-span-full">
                  <label className="block mb-2 text-sm font-medium text-slate-300">Peso (libras)</label>
                  <div className="grid grid-cols-12 gap-1.5 p-3 rounded-lg border border-slate-700 bg-slate-950/70">
                    {/* Columna 3.x */}
                    <div className="col-span-4">
                      <div className="text-xs font-semibold text-fuchsia-400 mb-2 text-center">3.x</div>
                      <div className="space-y-1">
                        {Array.from({ length: 16 }, (_, i) => (3.0 + i * 0.01).toFixed(2)).map((peso, idx) => (
                          <button
                            key={`3x-${idx}`}
                            type="button"
                            onClick={() => setForm((prev) => ({ ...prev, peso_libras: peso }))}
                            className={`w-full text-xs py-1 px-2 rounded transition ${
                              form.peso_libras === peso
                                ? "bg-fuchsia-500 text-white font-semibold"
                                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                            }`}
                          >
                            {peso}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Columna 4.x */}
                    <div className="col-span-4">
                      <div className="text-xs font-semibold text-cyan-400 mb-2 text-center">4.x</div>
                      <div className="space-y-1">
                        {Array.from({ length: 16 }, (_, i) => (4.0 + i * 0.01).toFixed(2)).map((peso, idx) => (
                          <button
                            key={`4x-${idx}`}
                            type="button"
                            onClick={() => setForm((prev) => ({ ...prev, peso_libras: peso }))}
                            className={`w-full text-xs py-1 px-2 rounded transition ${
                              form.peso_libras === peso
                                ? "bg-cyan-500 text-white font-semibold"
                                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                            }`}
                          >
                            {peso}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Columna 5.x */}
                    <div className="col-span-4">
                      <div className="text-xs font-semibold text-emerald-400 mb-2 text-center">5.x</div>
                      <div className="space-y-1">
                        {Array.from({ length: 16 }, (_, i) => (5.0 + i * 0.01).toFixed(2)).map((peso, idx) => (
                          <button
                            key={`5x-${idx}`}
                            type="button"
                            onClick={() => setForm((prev) => ({ ...prev, peso_libras: peso }))}
                            className={`w-full text-xs py-1 px-2 rounded transition ${
                              form.peso_libras === peso
                                ? "bg-emerald-500 text-white font-semibold"
                                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                            }`}
                          >
                            {peso}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

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
              <h2 className="mb-4 text-xl font-semibold text-cyan-200">Listado de frentes inscritos</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm text-slate-100">
                  <thead>
                    <tr>
                      <th className="border border-slate-700 bg-slate-800 p-2">ID</th>
                      <th className="border border-slate-700 bg-slate-800 p-2">Frente</th>
                      <th className="border border-slate-700 bg-slate-800 p-2">Galpón</th>
                      <th className="border border-slate-700 bg-slate-800 p-2">Propietario</th>
                      <th className="border border-slate-700 bg-slate-800 p-2">Color gallo</th>
                      <th className="border border-slate-700 bg-slate-800 p-2">Color pata</th>
                      <th className="border border-slate-700 bg-slate-800 p-2">Plaqueo</th>
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
                        <td className="border border-slate-700 p-2 text-center">{rooster.plaqueo}</td>
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
                        <td colSpan={9} className="border border-slate-700 p-3 text-center text-slate-400">
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
              <form onSubmit={onCreateGalpon} className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input
                  value={galponNuevo}
                  onChange={(e) => setGalponNuevo(e.target.value)}
                  placeholder="Nombre del galpón"
                  className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-slate-100 outline-none ring-fuchsia-400/50 placeholder:text-slate-500 focus:ring"
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
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-fuchsia-200">Galpones registrados</h2>
                <span className="rounded-full bg-fuchsia-500/15 px-3 py-1 text-sm font-medium text-fuchsia-300">
                  {galponesConGallos.length} galpones · {roosters.length} gallos
                </span>
              </div>
              {galponesConGallos.length === 0 ? (
                <p className="text-sm text-slate-400">Aún no hay galpones con gallos.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {galponesConGallos.map((item) => (
                    <div
                      key={item.galpon}
                      className="group relative flex flex-col rounded-2xl border border-fuchsia-900/40 bg-gradient-to-b from-slate-800/80 to-slate-900/80 p-4 shadow-lg transition hover:border-fuchsia-500/50 hover:shadow-fuchsia-900/20"
                    >
                      {/* Header */}
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-base font-bold text-fuchsia-100 leading-tight" title={item.galpon}>
                            {item.galpon}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onDeleteGalpon(item.galpon)}
                          disabled={loading}
                          className="shrink-0 rounded-lg p-1.5 text-slate-500 opacity-0 transition group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 disabled:opacity-30"
                          title="Eliminar galpón"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                      {/* Contador */}
                      <div className="mb-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-fuchsia-500/15 px-2.5 py-1 text-xs font-semibold text-fuchsia-300">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                          </svg>
                          {item.cantidad} {item.cantidad === 1 ? "gallo" : "gallos"}
                        </span>
                      </div>
                      {/* Lista de frentes */}
                      <div className="flex flex-wrap gap-1.5 mt-auto">
                        {Array.from(new Set(item.nombres)).sort().map((nombre) => (
                          <span
                            key={nombre}
                            className="rounded-md bg-slate-700/70 px-2 py-0.5 text-xs text-slate-300"
                          >
                            {nombre}
                          </span>
                        ))}
                      </div>
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
                {(pairs.length > 0 || dbMatchesCount > 0) && (
                  <button
                    type="button"
                    onClick={onDrawIncremental}
                    disabled={loading}
                    className="rounded-lg bg-amber-500 px-5 py-3 text-base font-semibold text-slate-950 transition hover:bg-amber-400 disabled:opacity-60"
                    title="Agrega peleas para los gallos que llegaron después del sorteo inicial, sin borrar las existentes"
                  >
                    + Agregar nuevos al sorteo
                  </button>
                )}
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
                          <div className="mb-1 flex items-center gap-2">
                            <p className="text-xs font-semibold text-cyan-300">FRENTE A</p>
                            {frenteCompanionSinPareja(pair.gallo_a_id, pair.gallo_a_nombre, pair.galpon_a) && (
                              <span className="rounded-full bg-orange-500/20 border border-orange-400/50 px-2 py-0.5 text-xs font-semibold text-orange-300">SIN PAREJA</span>
                            )}
                          </div>
                          <p className="text-base font-semibold">{pair.gallo_a_nombre}</p>
                          <p className="text-sm text-slate-300">Galpón: {pair.galpon_a}</p>
                          <p className="text-sm text-slate-300">Propietario: {pair.propietario_a}</p>
                          <p className="text-sm text-slate-300">Color: {pair.color_a}</p>
                          <p className="text-sm text-slate-300">Peso: {pair.peso_a_libras.toFixed(2)} lb</p>
                        </div>

                        <div className="rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/10 p-3">
                          <div className="mb-1 flex items-center gap-2">
                            <p className="text-xs font-semibold text-fuchsia-300">FRENTE B</p>
                            {frenteCompanionSinPareja(pair.gallo_b_id, pair.gallo_b_nombre, pair.galpon_b) && (
                              <span className="rounded-full bg-orange-500/20 border border-orange-400/50 px-2 py-0.5 text-xs font-semibold text-orange-300">SIN PAREJA</span>
                            )}
                          </div>
                          <p className="text-base font-semibold">{pair.gallo_b_nombre}</p>
                          <p className="text-sm text-slate-300">Galpón: {pair.galpon_b}</p>
                          <p className="text-sm text-slate-300">Propietario: {pair.propietario_b}</p>
                          <p className="text-sm text-slate-300">Color: {pair.color_b}</p>
                          <p className="text-sm text-slate-300">Peso: {pair.peso_b_libras.toFixed(2)} lb</p>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3 rounded-lg border border-slate-700 p-3 md:grid-cols-4">
                        <div className="md:col-span-2">
                          <label className="mb-1 block text-xs font-semibold text-slate-300">Ganador</label>
                          <select
                            value={resultByMatch[pair.id]?.ganadorId ?? ""}
                            onChange={(e) => {
                              const nextGanador = e.target.value;
                              setResultByMatch((prev) => ({
                                ...prev,
                                [pair.id]: {
                                  ganadorId: nextGanador,
                                  segundos: nextGanador === "empate" ? "6:00" : prev[pair.id]?.segundos ?? "",
                                },
                              }));
                            }}
                            className="w-full rounded-md border border-slate-600 bg-slate-950/70 px-3 py-2 text-sm"
                          >
                            <option value="">Seleccione ganador</option>
                            <option value="empate">Empate</option>
                            <option value={pair.gallo_a_id}>{pair.galpon_a}</option>
                            <option value={pair.gallo_b_id}>{pair.galpon_b}</option>
                          </select>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-300">Tiempo (MM:SS)</label>
                          <input
                            type="text"
                            placeholder="1:20"
                            maxLength={5}
                            value={resultByMatch[pair.id]?.segundos ?? ""}
                            onChange={(e) => {
                              const rawValue = e.target.value;
                              // Permitir números y dos puntos
                              if (rawValue === "" || /^[\d:]*$/.test(rawValue)) {
                                setResultByMatch((prev) => ({
                                  ...prev,
                                  [pair.id]: {
                                    ganadorId: prev[pair.id]?.ganadorId ?? "",
                                    segundos: rawValue,
                                  },
                                }));
                              }
                            }}
                            disabled={resultByMatch[pair.id]?.ganadorId === "empate"}
                            className="w-full rounded-md border border-slate-600 bg-slate-950/70 px-3 py-2 text-sm text-center text-lg font-mono"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-300">Total (segundos)</label>
                          <input
                            type="text"
                            value={
                              resultByMatch[pair.id]?.segundos
                                ? `${convertirMMSSASegundos(resultByMatch[pair.id].segundos)} seg`
                                : ""
                            }
                            readOnly
                            className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-300 text-center"
                          />
                        </div>

                        <div className="md:col-span-4">
                          <button
                            type="button"
                            onClick={() => onSaveResult(pair)}
                            disabled={
                              loading ||
                              !resultByMatch[pair.id]?.ganadorId ||
                              (resultByMatch[pair.id]?.ganadorId !== "empate" &&
                                (!resultByMatch[pair.id]?.segundos ||
                                  !resultByMatch[pair.id].segundos.includes(":") ||
                                  convertirMMSSASegundos(resultByMatch[pair.id]?.segundos ?? "") <= 0))
                            }
                            className="w-full rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
                          >
                            {loading ? "Guardando..." : "Guardar resultado de la disputa"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {incompleteFrentes.length > 0 && (
                <div className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 p-4">
                  <h3 className="mb-3 font-semibold text-red-200">Frentes incompletos - Excluidos del sorteo ({incompleteFrentes.length})</h3>
                  <p className="mb-3 text-xs text-red-300">Estos gallos fueron excluidos porque su frente no tiene ambos gallos emparejados</p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {incompleteFrentes.map((gallo) => (
                      <div key={gallo.id} className="rounded-lg border border-red-400/30 bg-slate-800/40 p-3 opacity-75">
                        <p className="mb-1 text-sm font-semibold text-red-300">❌ {gallo.nombre_gallo}</p>
                        <p className="text-xs text-slate-400">Galpón: {gallo.galpon}</p>
                        <p className="text-xs text-slate-400">Propietario: {gallo.propietario}</p>
                        <p className="text-xs text-slate-400">Peso: {gallo.peso_libras.toFixed(2)} lb</p>
                        <p className="text-xs text-slate-400">Color: {gallo.color_gallo} / Pata: {gallo.color_pata}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sobrantes.length > 0 && pairs.length > 0 && (
                <div className="mt-4">
                  <h3 className="mb-3 font-semibold text-orange-300">Sin pareja ({sobrantes.length})</h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {sobrantes.map((gallo) => (
                      <div key={gallo.id} className="rounded-lg border border-orange-400/40 bg-orange-500/10 p-3">
                        <p className="mb-1 text-xs font-semibold text-orange-300">SIN PAREJA</p>
                        <p className="text-sm font-semibold text-slate-100">{gallo.nombre_gallo}</p>
                        <p className="text-xs text-slate-300">Galpón: {gallo.galpon}</p>
                        <p className="text-xs text-slate-300">Propietario: {gallo.propietario || "-"}</p>
                        <p className="text-xs text-slate-300">Peso: {Number(gallo.peso_libras).toFixed(2)} lb</p>
                        <p className="text-xs text-slate-300">Color: {gallo.color_gallo} / Pata: {gallo.color_pata || "-"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 rounded-xl border border-sky-400/30 bg-sky-500/10 p-4">
                <h3 className="mb-2 font-semibold text-sky-200">Emparejamiento manual post-sorteo</h3>
                <p className="mb-4 text-xs text-sky-100/90">
                  Usa esta sección para crear peleas adicionales con criterio del juez, respetando reglas: distinto galpón y distinto frente.
                </p>

                {manualCandidates.length < 2 ? (
                  <p className="text-sm text-slate-300">No hay suficientes gallos sobrantes para crear una pelea manual.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-300">Gallo A (sobrante)</label>
                      <select
                        value={manualGalloAId}
                        onChange={(e) => setManualGalloAId(e.target.value)}
                        className="w-full rounded-md border border-slate-600 bg-slate-950/70 px-3 py-2 text-sm"
                      >
                        <option value="">Seleccione gallo A</option>
                        {manualCandidatesA.map((rooster) => (
                          <option key={`manual-a-${rooster.id}`} value={rooster.id}>
                            #{rooster.id} | {rooster.nombre_gallo} | {rooster.galpon} | {rooster.color_gallo} | {rooster.peso_libras.toFixed(2)} lb
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-300">Gallo B (sobrante)</label>
                      <select
                        value={manualGalloBId}
                        onChange={(e) => setManualGalloBId(e.target.value)}
                        disabled={!manualGalloAId}
                        className="w-full rounded-md border border-slate-600 bg-slate-950/70 px-3 py-2 text-sm"
                      >
                        <option value="">{manualGalloAId ? "Seleccione gallo B" : "Primero seleccione gallo A"}</option>
                        {manualCandidatesB.map((rooster) => (
                          <option key={`manual-b-${rooster.id}`} value={rooster.id}>
                            #{rooster.id} | {rooster.nombre_gallo} | {rooster.galpon} | {rooster.color_gallo} | {rooster.peso_libras.toFixed(2)} lb
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <button
                        type="button"
                        onClick={onCreateManualPair}
                        disabled={loading || !manualGalloAId || !manualGalloBId}
                        className="w-full rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {loading ? "Agregando pelea..." : "Agregar pelea manual"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {activeSection === "reporte" && (
          <section className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-black/20">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-amber-200">Reporte - Ranking del Torneo (Por Puntos)</h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onDownloadReportPdf}
                    className={`rounded-lg border border-slate-600 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 ${reportRows.length === 0 ? "pointer-events-none opacity-50" : ""}`}
                  >
                    Exportar ranking PDF
                  </button>
                  <button
                    type="button"
                    onClick={onDownloadPollon}
                    className={`rounded-lg border border-yellow-600 px-5 py-3 text-sm font-semibold text-yellow-300 transition hover:bg-yellow-500/20 ${reportRows.filter((r) => r.mejor_tiempo_victoria_segundos != null && r.mejor_tiempo_victoria_segundos < 60).length === 0 ? "pointer-events-none opacity-50" : ""}`}
                  >
                    Exportar ranking Pollón
                  </button>
                </div>
              </div>

              {reportRows.length === 0 ? (
                <div className="rounded-xl border border-slate-700 p-4 text-center text-slate-400">Aún no hay disputas con resultado y tiempo guardado.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm text-slate-100">
                    <thead>
                      <tr>
                        <th className="border border-slate-700 bg-slate-800 p-2">Posición</th>
                        <th className="border border-slate-700 bg-slate-800 p-2">Galpón</th>
                        <th className="border border-slate-700 bg-slate-800 p-2">Plaqueo</th>
                        <th className="border border-slate-700 bg-slate-800 p-2">Propietario</th>
                        <th className="border border-slate-700 bg-slate-800 p-2">Frente</th>
                        <th className="border border-slate-700 bg-slate-800 p-2">Puntos</th>
                        <th className="border border-slate-700 bg-slate-800 p-2">Peleas</th>
                        <th className="border border-slate-700 bg-slate-800 p-2 text-xs">Tiempo Total (MM:SS)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportRows.map((row) => (
                        <tr key={`${row.galpon}-${row.frente}`} className="hover:bg-slate-800/70">
                          <td className="border border-slate-700 p-2 text-center font-semibold text-amber-200">{row.posicion}</td>
                          <td className="border border-slate-700 p-2">{row.galpon}</td>
                          <td className="border border-slate-700 p-2 text-center text-sm font-mono">{row.plaqueo || "-"}</td>
                          <td className="border border-slate-700 p-2">{row.propietario}</td>
                          <td className="border border-slate-700 p-2 font-semibold text-cyan-300">{row.frente}</td>
                          <td className="border border-slate-700 p-2 text-center font-bold text-emerald-300">{row.puntos}</td>
                          <td className="border border-slate-700 p-2 text-center">{row.peleas}</td>
                          <td className="border border-slate-700 p-2 text-center text-xs font-mono">{convertirSegundosAMMSS(row.tiempo_total_segundos)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {reportRows.length > 0 && (
                    <div className="mt-6 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-5">
                      <h3 className="mb-4 text-lg font-semibold text-emerald-200">🏆 Ganador del Torneo</h3>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="rounded-lg border border-emerald-400/50 bg-slate-900/50 p-4">
                          <p className="mb-1 text-xs font-semibold text-emerald-300">GALPÓN GANADOR</p>
                          <p className="mb-3 text-lg font-bold text-emerald-100">{reportRows[0].galpon}</p>
                          <p className="text-sm text-slate-400">{reportRows[0].propietario}</p>
                        </div>
                        <div className="rounded-lg border border-emerald-400/50 bg-slate-900/50 p-4">
                          <p className="mb-1 text-xs font-semibold text-emerald-300">FRENTE GANADOR</p>
                          <p className="mb-3 text-lg font-bold text-cyan-300">{reportRows[0].frente}</p>
                          <p className="text-sm text-slate-300">Tiempo: {convertirSegundosAMMSS(reportRows[0].tiempo_total_segundos)}</p>
                        </div>
                        <div className="rounded-lg border border-emerald-400/50 bg-slate-900/50 p-4">
                          <p className="mb-1 text-xs font-semibold text-emerald-300">PUNTOS TOTALES</p>
                          <p className="mb-3 text-2xl font-bold text-emerald-100">{reportRows[0].puntos} pts</p>
                          <p className="text-sm text-slate-400">({reportRows[0].peleas} peleas)</p>
                        </div>
                      </div>
                    </div>
                  )}
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
