# Captación de prospectos: ruta en producción

El formulario envía `POST /api/backend/public/leads/` a Next.js. La ruta
específica de Next.js pasa la solicitud al proxy, que retira `/api/backend` y
envía `POST /public/leads` a FastAPI, sin diagonal final. FastAPI publica esa
ruta externamente como `/api/public/leads` y devuelve `201` tanto para un alta
nueva (`created: true`) como para un duplicado reciente (`created: false`).

En el servidor actual, `/api/backend/...` llega a FastAPI sin pasar por el
proxy de Next.js: la respuesta `404` carece de `x-next-proxy-version` y usa las
cabeceras de FastAPI. La configuración de Nginx no está en este repositorio;
si su bloque general `/api/` produce ese desvío, añadir dos coincidencias
exactas en el bloque de servidor, usando el mismo destino de Next.js que ya
sirve las páginas:

```nginx
location = /api/backend/public/leads {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location = /api/backend/public/leads/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Conservar el bloque general `/api/` tal como está. Verificar con `nginx -t`
y recargar Nginx. Desplegar después el frontend para que la ruta específica y
el formulario actualizado estén activos. Una petición `POST` con cuerpo válido
a `/api/backend/public/leads/` debe devolver `201`, `success: true`,
`created: true` y la cabecera
`x-next-proxy-version: 2026-10-08-public-leads-path-1`. Repetir el mismo cuerpo
en menos de cinco minutos debe devolver `created: false` y no generar otro
evento Meta Pixel `Lead`.
