"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || `Error: ${res.status}`);
        setLoading(false);
        return;
      }

      const data = await res.json();
      console.log("Login exitoso:", data);

      // Guardar en sessionStorage para evitar problemas con cookies
      sessionStorage.setItem("auth_token", data.token);
      
      // Redirigir a la página principal
      setTimeout(() => {
        window.location.href = "/";
      }, 300);
    } catch (err) {
      setError("Error al conectar con el servidor: " + String(err));
      console.error("Login error:", err);
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-8">
        <h1 className="mb-8 text-center text-2xl font-bold text-white">
          Torneos de Gallos
        </h1>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-300">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
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
            {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-400">
          Sistema seguro de gestión de torneos
        </p>

        <p className="mt-6 text-center text-sm text-slate-400">
          ¿Primera vez?{" "}
          <Link href="/register-admin" className="text-cyan-400 hover:text-cyan-300">
            Crear administrador
          </Link>
        </p>
      </div>
    </main>
  );
}
