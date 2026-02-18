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

  const required = ["nombre_gallo", "galpon", "propietario", "color_gallo", "color_pata", "peso_libras"];
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
        nombre_gallo: String(body.nombre_gallo).trim(),
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

export async function DELETE(request: Request) {
  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));

  if (Number.isNaN(id) || id <= 0) {
    return NextResponse.json({ error: "Debe enviar un id válido en querystring (?id=)" }, { status: 400 });
  }

  const { error: deleteMatchesError } = await supabase
    .from("emparejamientos")
    .delete()
    .or(`gallo_a_id.eq.${id},gallo_b_id.eq.${id}`);

  if (deleteMatchesError) {
    return NextResponse.json({ error: deleteMatchesError.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("gallos")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Gallo no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ deletedId: id });
}

export async function PATCH(request: Request) {
  const supabase = getSupabase();
  const body = await request.json();

  const id = Number(body.id);
  const galpon = String(body.galpon ?? "").trim();

  if (Number.isNaN(id) || id <= 0) {
    return NextResponse.json({ error: "Debe enviar un id válido" }, { status: 400 });
  }

  if (!galpon) {
    return NextResponse.json({ error: "Debe enviar un galpón válido" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("gallos")
    .update({ galpon })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
