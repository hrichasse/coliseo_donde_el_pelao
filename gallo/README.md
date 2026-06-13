# Sistema de Sorteo 1v1 de Gallos

Aplicacion Next.js + Supabase para:
- registrar galpones;
- registrar frentes/gallos;
- generar cotejas 1v1;
- evitar cruces entre gallos del mismo galpon;
- guardar resultados;
- generar ranking y reportes imprimibles.

## Variables de entorno

Crea `gallo/.env.local` con:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
JWT_SECRET=...
```

Notas:
- `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` se usan para consultas con cliente anon.
- `SUPABASE_SERVICE_ROLE_KEY` solo debe usarse en rutas del servidor.
- `JWT_SECRET` debe ser obligatorio en produccion.
- No subas archivos `.env*` al repositorio.

## Ejecutar local

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`.

## Verificacion

```bash
npm exec tsc -- --noEmit --incremental false
npm run lint
npm run build
```

## Base de datos

El schema SQL de referencia esta en:

```text
supabase/schema.sql
```

No ejecutes cambios contra la base de datos de produccion sin revisar primero el SQL.
