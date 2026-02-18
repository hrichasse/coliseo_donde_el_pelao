"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setIsClient(true);
    
    // Verificar si hay token en cookies
    // Las cookies son accesibles desde el cliente después de login
    const checkAuth = async () => {
      try {
        // Hacer una petición para verificar si la cookie existe
        const response = await fetch("/api/verify", {
          credentials: "include", // Incluir cookies
        });
        
        if (response.ok) {
          setIsAuthorized(true);
          setLoading(false);
        } else {
          // No authorized, redirigir al login
          router.push("/login");
          setLoading(false);
        }
      } catch (error) {
        console.error("Error verificando autenticación:", error);
        router.push("/login");
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (!isClient || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-white">Verificando acceso...</div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null; // El useEffect redirigirá al login
  }

  return <>{children}</>;
}
