"use client";

import { useState } from "react";

export interface AuthUser {
  id: number;
  email: string;
}

export function useAuth() {
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/logout", { 
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Error en logout:", error);
    }
    // Redirigir al login
    window.location.href = "/login";
  }

  return { loading, logout, isAuthenticated: true };
}
