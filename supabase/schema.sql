-- =========================================
-- RESET TOTAL + NUEVA ESTRUCTURA
-- =========================================

drop table if exists public.emparejamientos;
drop table if exists public.gallos;
drop table if exists public.galpones;
drop table if exists public.usuarios;

create table public.usuarios (
  id bigint generated always as identity primary key,
  email text not null unique,
  password text not null,
  created_at timestamptz not null default now()
);

create table public.galpones (
  id bigint generated always as identity primary key,
  nombre text not null unique,
  propietario text not null,
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
  ganador_id bigint null references public.gallos(id),
  duracion_segundos integer null check (duracion_segundos >= 0),
  diferencia_gramos integer not null,
  created_at timestamptz not null default now(),
  constraint gallos_distintos check (gallo_a_id <> gallo_b_id)
);

alter table public.gallos enable row level security;
alter table public.galpones enable row level security;
alter table public.emparejamientos enable row level security;
alter table public.usuarios enable row level security;

create policy usuarios_select_anon
on public.usuarios
for select
to anon
using (true);

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

create policy galpones_delete_anon
on public.galpones
for delete
to anon
using (true);

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

create policy emparejamientos_update_anon
on public.emparejamientos
for update
to anon
using (true)
with check (true);
