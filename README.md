# Coliseo donde el Pelao

Aplicacion Next.js + Supabase para administrar torneos de gallos:
- registro de galpones y frentes/gallos;
- generacion de cotejas 1v1;
- registro de resultados;
- ranking y reportes imprimibles.

## Estructura

La aplicacion activa vive en `gallo/`.

La raiz del repositorio conserva scripts delegados para comodidad:

```bash
npm run dev
npm run build
npm run lint
```

Todos ejecutan el paquete ubicado en `gallo/`.

## Variables de entorno

Configura las variables en `gallo/.env.local` para desarrollo local:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
JWT_SECRET=...
```

No subas archivos `.env*` al repositorio.

## Desarrollo

Desde la raiz:

```bash
npm install
npm run dev
```

O directamente desde la app:

```bash
cd gallo
npm install
npm run dev
```

Abre `http://localhost:3000`.

## Base de datos

El schema SQL de referencia esta en:

```text
gallo/supabase/schema.sql
```

No ejecutes cambios contra la base de datos de produccion sin revisar primero el SQL.
