# Importación de Facebook: frontend

Implementación basada en `safeEasyBackEnd/FACEBOOK_IMPORT_API.md` y su OpenAPI, rama main (30 de octubre de 2026).

## Rutas y configuración

- Entrada: `/admin/my-company/import-facebook?supplier_id=ID`, desde el encabezado de Mi negocio y gestión de proveedor.
- Retorno público de OAuth: `/mi-negocio/facebook`. Lee y retira el fragmento; conserva solo el ID opaco en sessionStorage y navega a la ruta autenticada. La autorización se verifica con Bearer en el servidor.
- El backend debe mantener `FACEBOOK_IMPORT_RETURN_URL=https://drooopy.com/mi-negocio/facebook` y el callback de Meta ya registrado: `https://drooopy.com/api/integrations/facebook/callback`.
- No se agregan claves ni variables de IA al frontend. La conexión requiere el mismo sitio HTTPS que el callback por la cookie privada del backend.
- Los requests usan `/api/integrations/facebook/connections`, mediante fetchWithAuth y credentials include. En producción `/api` llega directamente a FastAPI; no usar el alias `/api/backend`, exclusivo del intermediario de Next. Las imágenes usan también el path público del contrato. No se transmiten tokens de Meta al cliente.

## Comportamiento

- Selección explícita de página, revisión editable y guardado selectivo. Los valores actuales se muestran y se conservan inicialmente si ya existen.
- La dirección llega sin desglosar. País/estado/ciudad se pueden corregir antes de confirmar; el catálogo se valida en backend.
- Campos ausentes o vacíos no borran datos. No hay controles de borrado en el importador; la edición normal sigue disponible.
- Las coordenadas se seleccionan juntas. Los horarios se confirman por día, conservando los demás días.
- Sin email, RFC, bancos, pagos, envío ni generación de imágenes.
- Propuesta de IA separada de original y revisión. Se elige por campo. Un UUID identifica cada acción y se conserva en consultas/reintentos tras una respuesta incierta. Se consultan respuestas processing con espera; nunca se genera un UUID nuevo automáticamente por un timeout.
- Continuar sin IA cancela la espera del cliente; no promete cancelar la generación ni el consumo del servidor.
- Imágenes privadas descargadas como blobs autenticados, con liberación de URLs al desmontar. Logo completo, sin recorte. Banner completo o recorte en píxeles originales con posición/zoom.
- Escritorio usa proporción 2100:740 existente en el portal. Celular muestra una simulación central 9:16 aproximada, porque la altura real depende del dispositivo y el contenido.
- La portada se guarda en header_image, independiente del carrusel. El portal público ahora la muestra cuando header_media_type es image; el video mantiene precedencia cuando ese es el tipo elegido.
- Cancelar descarta la conexión local en backend. No revoca la integración completa en Meta.
- Tras guardar se vuelve a Mi negocio, que consulta la empresa nuevamente.

## Aceptación real pendiente

Con backend y frontend desplegados bajo HTTPS: autorizar una página, comprobar listado/diagnóstico, revisar originales y propuesta con la clave configurada, confirmar una vez y comprobar textos, horarios y archivos de imágenes en el portal. Repetir con rechazo de permisos, cancelación, conexión vencida y fallo de IA.

La lectura previa directa de Drooopymx fue exitosa. La recuperación del listado vacío y las llamadas reales a OpenRouter/S3 siguen necesitando aceptación contra el backend desplegado; las comprobaciones locales del frontend no sustituyen esa validación.
