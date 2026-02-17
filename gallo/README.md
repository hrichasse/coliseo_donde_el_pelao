# Sistema de Sorteo 1v1 de Gallos

Aplicación en Next.js + Supabase para:
- Registrar gallos con: nombre del gallo, galpón (organización), propietario, color de gallo, color de pata y peso en libras.
- Registrar galpones y asignar gallos al galpón.
- Generar emparejamientos 1v1 por preferencia de peso (diferencia mínima en gramos).
- Evitar emparejar gallos del mismo galpón.
- Generar hoja imprimible con todos los 1v1 y espacio para anotar el tiempo manualmente.

## 1) Variables de entorno

Copia `.env.local.example` a `.env.local` y reemplaza los valores:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Notas:
- `NEXT_PUBLIC_SUPABASE_URL`: URL del proyecto en Supabase (`https://xxxx.supabase.co`).
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: usa la clave pública `anon` (esta sí puede usarse en frontend).
- No uses la `service_role` en frontend.

## 2) SQL en Supabase

Ejecuta este script en el SQL Editor:

```sql
-- =========================================
-- RESET TOTAL + NUEVA ESTRUCTURA
-- =========================================

drop table if exists public.emparejamientos;
drop table if exists public.gallos;
drop table if exists public.galpones;

create table public.galpones (
	id bigint generated always as identity primary key,
	nombre text not null unique,
	created_at timestamptz not null default now()
);

create table public.gallos (
	id bigint generated always as identity primary key,
	nombre_gallo text not null,
	galpon text not null,
	propietario text not null,
	color_gallo text not null,
	color_pata text not null,
	peso_libras numeric(8,2) not null check (peso_libras > 0),
	created_at timestamptz not null default now()
);

create table public.emparejamientos (
	id bigint generated always as identity primary key,
	gallo_a_id bigint not null references public.gallos(id) on delete cascade,
	gallo_b_id bigint not null references public.gallos(id) on delete cascade,
	diferencia_gramos integer not null,
	created_at timestamptz not null default now(),
	constraint gallos_distintos check (gallo_a_id <> gallo_b_id)
);

alter table public.gallos enable row level security;
alter table public.galpones enable row level security;
alter table public.emparejamientos enable row level security;

create policy galpones_select_anon
on public.galpones
for select
to anon
using (true);

create policy galpones_insert_anon
on public.galpones
for insert
to anon
with check (true);

create policy gallos_select_anon
on public.gallos
for select
to anon
using (true);

create policy gallos_insert_anon
on public.gallos
for insert
to anon
with check (true);

create policy gallos_delete_anon
on public.gallos
for delete
to anon
using (true);

create policy gallos_update_anon
on public.gallos
for update
to anon
using (true)
with check (true);

create policy emparejamientos_select_anon
on public.emparejamientos
for select
to anon
using (true);

create policy emparejamientos_insert_anon
on public.emparejamientos
for insert
to anon
with check (true);

create policy emparejamientos_delete_anon
on public.emparejamientos
for delete
to anon
using (true);
```

## 3) Ejecutar local

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`.

## 4) Deploy gratis recomendado

- Frontend/API: Vercel (plan gratuito)
- Base de datos: Supabase (plan gratuito)
