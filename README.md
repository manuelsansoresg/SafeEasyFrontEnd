# Drooopy Frontend

Frontend de Drooopy construido con Next.js App Router, React, TypeScript y Tailwind CSS.

## Requisitos

- Node.js compatible con Next.js 16
- npm
- Acceso al backend en `https://drooopy.com/api` o a una URL compatible

## Comandos

```bash
npm run dev
npm run lint
npm run build
npm run start
```

Notas:

- `npm run build` elimina `.next/cache` antes de compilar. Esto es intencional.
- No hay framework de pruebas configurado en este repositorio.
- `.npmrc` usa `legacy-peer-deps=true`; los avisos de peer dependencies son esperados.

## Variables de entorno

Crear `.env.local` con las variables necesarias:

```bash
NEXT_PUBLIC_API_BASE_URL=https://drooopy.com/api
NEXT_PUBLIC_API_URL=https://drooopy.com/api
NEXT_PUBLIC_WS_URL=wss://drooopy.com/api
API_INTERNAL_URL=https://drooopy.com/api
NEXT_PUBLIC_SITE_URL=https://drooopy.com
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_MIDDLEWARE_DEBUG=false
```

También se usan credenciales OAuth de Google/Facebook cuando los flujos sociales están activos.

## Estructura

```text
src/app          Rutas de Next.js App Router
src/components   Componentes de UI y flujos principales
src/context      Contextos de React
src/hooks        Hooks personalizados
src/lib          Clientes HTTP, SEO y utilidades
src/services     Servicios de dominio
src/store        Stores de Zustand
src/types        Tipos compartidos
```

El alias `@/*` apunta a `src/*`.

## Backend

El backend principal es FastAPI en `https://drooopy.com/api`.

La ruta interna `/api/backend/:path*` se reescribe hacia el backend configurado en `NEXT_PUBLIC_API_BASE_URL`.

Para llamadas autenticadas, usar `fetchWithAuth` desde `src/lib/api.ts`; maneja tokens Bearer, refresh y logout en 401.

## Producción

Antes de publicar:

- Ejecutar `npm run lint`.
- Ejecutar `npm run build`.
- Confirmar que `NEXT_PUBLIC_SITE_URL` apunta a `https://drooopy.com`.
- Mantener `NEXT_PUBLIC_MIDDLEWARE_DEBUG=false` salvo que se investigue un problema de geolocalización.
- Probar manualmente login, registro, carrito, checkout, pedidos, chat, panel proveedor, panel admin y soporte.
