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
  const fieldLabels: Record<string, string> = {
    nombre_gallo: "frente",
    galpon: "galpón",
    propietario: "propietario",
    color_gallo: "color de gallo",
    color_pata: "color de pata",
    peso_libras: "peso (libras)",
  };
  for (const field of required) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      const label = fieldLabels[field] ?? field;
      return NextResponse.json({ error: `El campo ${label} es requerido` }, { status: 400 });
    }
  }

  const peso = Number(body.peso_libras);
  if (Number.isNaN(peso) || peso <= 0) {
    return NextResponse.json({ error: "peso_libras debe ser un número mayor a 0" }, { status: 400 });
  }

  const frente = String(body.nombre_gallo).trim();
  const { count: frenteCount, error: frenteError } = await supabase
    .from("gallos")
    .select("id", { count: "exact", head: true })
    .eq("nombre_gallo", frente);

  if (frenteError) {
    return NextResponse.json({ error: frenteError.message }, { status: 500 });
  }

  if ((frenteCount ?? 0) >= 2) {
    return NextResponse.json(
      { error: "El frente ya tiene 2 gallos registrados. Usa otro frente." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("gallos")
    .insert([
      {
        nombre_gallo: frente,
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
