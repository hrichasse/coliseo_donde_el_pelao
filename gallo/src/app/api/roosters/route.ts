import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("gallos")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const supabase = getSupabase();
  const body = await request.json();

  const required = ["galpon", "propietario", "color_gallo", "color_pata", "peso_libras"];
  for (const field of required) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      return NextResponse.json({ error: `El campo ${field} es requerido` }, { status: 400 });
    }
  }

  const peso = Number(body.peso_libras);
  if (Number.isNaN(peso) || peso <= 0) {
    return NextResponse.json({ error: "peso_libras debe ser un número mayor a 0" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("gallos")
    .insert([
      {
        galpon: String(body.galpon).trim(),
        propietario: String(body.propietario).trim(),
        color_gallo: String(body.color_gallo).trim(),
        color_pata: String(body.color_pata).trim(),
        peso_libras: peso,
      },
    ])
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
