import { signAuthToken } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    // Validar que tenga email y contraseña
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email y contraseña son requeridos" },
        { status: 400 }
      );
    }

    // Conectar a Supabase con service role para poder leer usuarios
    const supabase = createServiceRoleClient();

    // Buscar usuario
    const { data: usuario, error: userError } = await supabase
      .from("usuarios")
      .select("*")
      .eq("email", email)
      .single();

    if (userError || !usuario) {
      return NextResponse.json(
        { error: "Email o contraseña incorrectos" },
        { status: 401 }
      );
    }

    // Validar contraseña
    const isValidPassword = await bcrypt.compare(password, usuario.password);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Email o contraseña incorrectos" },
        { status: 401 }
      );
    }

    // Crear JWT token
    const token = signAuthToken({ id: usuario.id, email: usuario.email });

    // Crear respuesta y agregar cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: usuario.id,
        email: usuario.email,
      },
    });

    // Agregar cookie httpOnly (segura)
    response.cookies.set({
      name: "auth_token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 horas
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Error en login:", error);
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}
