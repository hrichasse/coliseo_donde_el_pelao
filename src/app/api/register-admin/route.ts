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

    // Validar que la contraseña tenga mínimo 6 caracteres
    if (password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Verificar que no exista otro usuario
    const { data: existingUsers, error: checkError } = await supabase
      .from("usuarios")
      .select("id")
      .limit(1);

    if (checkError) {
      return NextResponse.json(
        { error: "Error al verificar usuarios" },
        { status: 500 }
      );
    }

    // Si ya hay usuarios, no permitir registro
    if (existingUsers && existingUsers.length > 0) {
      return NextResponse.json(
        { error: "Ya existe un administrador registrado. Contacta al administrador." },
        { status: 403 }
      );
    }

    // Hash de la contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Crear usuario
    const { data: newUser, error: createError } = await supabase
      .from("usuarios")
      .insert({
        email,
        password: hashedPassword,
      })
      .select()
      .single();

    if (createError) {
      if (createError.code === "23505") {
        // Duplicate key error
        return NextResponse.json(
          { error: "Este email ya está registrado" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Error al crear usuario" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Usuario administrador creado exitosamente",
      user: {
        id: newUser.id,
        email: newUser.email,
      },
    });
  } catch (error) {
    console.error("Error en registro:", error);
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}
