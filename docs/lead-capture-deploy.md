# Captación de prospectos: ruta en producción

En producción el formulario envía `POST /api/public/leads` directamente a la
ruta pública de FastAPI. Este recorrido ya funciona en el servidor actual y no
requiere modificar Nginx ni FastAPI. FastAPI devuelve `201` tanto para un alta
nueva (`created: true`) como para un duplicado reciente (`created: false`).

En desarrollo local el formulario usa `POST /api/backend/public/leads/`.
La ruta específica de Next.js pasa la solicitud al proxy, que retira
`/api/backend` y envía `POST /public/leads` a FastAPI, sin diagonal final.

En el servidor actual, `/api/backend/...` llega a FastAPI sin pasar por el
proxy de Next.js: la respuesta `404` carece de `x-next-proxy-version` y usa las
cabeceras de FastAPI. La configuración de Nginx no está en este repositorio.
El formulario deja de depender de esa ruta en producción. Si se quisiera usar
el proxy de Next.js también allí, añadir dos coincidencias exactas en Nginx,
usando el mismo destino de Next.js que ya sirve las páginas:

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

Esa configuración de Nginx es opcional para el formulario corregido. Tras
desplegar el frontend, una petición del formulario a `/api/public/leads` debe
devolver `201`, `success: true` y `created: true` para un alta nueva. Repetir
el mismo cuerpo en menos de cinco minutos debe devolver `created: false` y no
generar otro evento Meta Pixel `Lead`.

## Panel de administración

El listado, el detalle y la edición de prospectos usan directamente
`/api/admin/leads` y `/api/admin/leads/{id}` en producción. FastAPI exige el
token de administrador; una consulta sin token debe responder `401`, mientras
que una sesión de administrador válida debe poder cargar la lista y guardar
cambios. En desarrollo, Next.js añade la diagonal final externa y su proxy la
retira antes de enviar la solicitud a FastAPI.
