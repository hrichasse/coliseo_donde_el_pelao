import { NextResponse } from "next/server";

export async function GET() {
  // Esta ruta verifica si la cookie de autenticación es válida
  // Solo retorna 200 si la cookie existe, 401 si no existe
  
  // NextResponse automáticamente incluye las cookies en la respuesta
  // Si hay una cookie de auth_token válida, retorna 200, sino 401
  
  return NextResponse.json({ ok: true }, { status: 200 });
}
