create table if not exists gallos (
  id bigint generated always as identity primary key,
  galpon text not null,
  propietario text not null,
  color_gallo text not null,
  color_pata text not null,
  peso_libras numeric(8,2) not null check (peso_libras > 0),
  created_at timestamptz not null default now()
);

create table if not exists emparejamientos (
  id bigint generated always as identity primary key,
  gallo_a_id bigint not null references gallos(id),
  gallo_b_id bigint not null references gallos(id),
  diferencia_gramos integer not null,
  created_at timestamptz not null default now(),
  constraint gallos_distintos check (gallo_a_id <> gallo_b_id)
);

alter table gallos enable row level security;
alter table emparejamientos enable row level security;

drop policy if exists gallos_select_anon on gallos;
drop policy if exists gallos_insert_anon on gallos;
drop policy if exists emparejamientos_select_anon on emparejamientos;
drop policy if exists emparejamientos_insert_anon on emparejamientos;

create policy gallos_select_anon
on gallos
for select
to anon
using (true);

create policy gallos_insert_anon
on gallos
for insert
to anon
with check (true);

create policy emparejamientos_select_anon
on emparejamientos
for select
to anon
using (true);

create policy emparejamientos_insert_anon
on emparejamientos
for insert
to anon
with check (true);
