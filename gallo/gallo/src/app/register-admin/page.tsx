"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterAdminPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    // Validar contraseñas
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/register-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al registrar usuario");
        return;
      }

      setSuccess(true);
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      
      // Redirigir al login después de 2 segundos
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err) {
      setError("Error al conectar con el servidor");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-8">
        <h1 className="mb-2 text-center text-2xl font-bold text-white">
          Crear Administrador
        </h1>
        <p className="mb-8 text-center text-sm text-slate-400">
          Registra el primer usuario administrador
        </p>

        {success ? (
          <div className="rounded-md border border-emerald-500 bg-emerald-500/10 p-4 text-center">
            <p className="text-emerald-400 font-semibold">
              ✓ Usuario creado exitosamente
            </p>
            <p className="text-sm text-emerald-300 mt-2">
              Redirigiendo al login...
            </p>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-6">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@ejemplo.com"
                required
                className="w-full rounded-md border border-slate-600 bg-slate-800 px-4 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-300">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-md border border-slate-600 bg-slate-800 px-4 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="mb-2 block text-sm font-semibold text-slate-300">
                Confirmar Contraseña
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-md border border-slate-600 bg-slate-800 px-4 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            {error && (
              <div className="rounded-md border border-red-500 bg-red-500/10 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-cyan-600 px-4 py-2 font-semibold text-white hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? "Registrando..." : "Crear Administrador"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-400">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-cyan-400 hover:text-cyan-300">
            Inicia sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
