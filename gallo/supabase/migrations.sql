-- Migration: Restricción de diferencia de peso máximo en emparejamientos
-- Diferencia máxima: 0.02 libras (9 gramos aproximadamente)

ALTER TABLE public.emparejamientos
ADD CONSTRAINT max_weight_diff_check 
CHECK (diferencia_gramos <= 9);

-- Migration: Limitar a 2 gallos por frente
create or replace function public.enforce_frente_max_dos()
returns trigger as $$
declare
	frente_count integer;
begin
	select count(*) into frente_count
	from public.gallos
	where nombre_gallo = new.nombre_gallo
		and (tg_op = 'INSERT' or id <> new.id);

	if frente_count >= 2 then
		raise exception 'El frente ya tiene 2 gallos registrados.';
	end if;

	return new;
end;
$$ language plpgsql;

drop trigger if exists gallos_frente_max_dos on public.gallos;
create trigger gallos_frente_max_dos
before insert or update of nombre_gallo on public.gallos
for each row execute function public.enforce_frente_max_dos();
