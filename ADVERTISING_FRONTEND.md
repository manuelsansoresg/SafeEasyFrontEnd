# Publicidad de Drooopy — frontend

Implementación del 22 de octubre de 2026. Contrato consultado: `ADVERTISING_BACKEND.md` de `manuelsansoresg/safeEasyBackEnd`, blob `8f55f156011b22c381714ab7611c4e54a27c9b93`, y las dependencias/rutas del backend local. No se modificó el backend ni se aplicaron migraciones.

## Uso y permisos

- **Contenido → Anuncios** (`/admin/ads`): exclusivo de `admin`, según `get_current_admin_user` de FastAPI. El rol `superuser` no satisface esa dependencia; se retiró únicamente su acceso a esta opción del menú.
- **Mis anuncios** (`/admin/my-ads`): exclusivo de `supplier`, independiente de Agenda, Menú o módulos de pago.
- Se conserva `fetchWithAuth` y el control de sesión del panel. Los permisos y la propiedad se validan de nuevo en FastAPI.

Administración puede crear anuncios aprobados directamente, asociar un proveedor opcional, editar metadatos e imágenes compatibles, filtrar por aprobación/activación/origen, paginar, activar, desactivar, eliminar y revisar solicitudes. La tabla anterior se organiza en tarjetas adaptables con imágenes de escritorio/móvil, origen, ID de proveedor, aprobación, activación, visibilidad efectiva, orden, destino, fechas y acciones.

El selector de proveedores conserva búsqueda con debounce y paginación. La identidad completa se consulta únicamente al abrir un editor/rechazo, con caché compartida; no se hace una solicitud por tarjeta del listado. Si no se puede resolver el nombre, se conserva el ID real.

Aprobar pide confirmación. Rechazar abre un diálogo con imágenes, proveedor y motivo obligatorio de hasta 4000 caracteres. Se envía la versión recibida, nunca un valor fijo. Un 409 descarta la revisión abierta y refresca los listados y el anuncio enfocado; hay que revisar la versión actual antes de decidir nuevamente.

El proveedor solo puede enviar/reemplazar imágenes. Puede editar únicamente móvil. Las imágenes se mantienen seleccionadas si falla la solicitud. Un cambio en imágenes aprobadas pide confirmación porque exige nueva revisión. La visibilidad se permite para anuncios aprobados y habilitados administrativamente. La respuesta del backend determina el estado final; no se calcula `is_published` localmente.

## Enlaces y anuncios legados

El modo automático envía `is_manual_url=false` y no sobrescribe la URL manual almacenada. Muestra el portal del proveedor como vista previa cuando se conoce su slug; sin proveedor, permite un anuncio administrativo sin enlace. El modo manual valida y envía `is_manual_url=true` junto con `manual_url`.

Se aceptan HTTP/HTTPS y rutas internas seguras. Se rechazan protocolos peligrosos, URLs relativas al protocolo, credenciales, controles, barras invertidas y segmentos de navegación, también codificados.

Los anuncios `supplier_carousel` siguen visibles y administrables con imágenes de solo lectura. Se retiró la creación desde ese origen y todas las llamadas a sus endpoints antiguos. No se modifica SupplierCarousel ni se eliminan sus archivos.

`AdsCarousel.tsx` conserva todas sus clases, estructura de elementos, imágenes, dimensiones, intervalos, flechas e indicadores. Solo se activó la navegación a `link_url` y el acceso por teclado sobre la imagen con enlace. Las flechas conservan `stopPropagation`; `enableNavigation=false` impide navegar.

## Servicios integrados

| Área | Método / ruta | Formato |
| --- | --- | --- |
| Administración | GET `/api/admin/ads` | Arreglo paginado; filtros `approval_status`, `is_active`, `source`, `supplier_id` en el servicio |
| Administración | POST `/api/admin/ads` | Multipart con imágenes y metadatos permitidos |
| Administración | PUT `/api/admin/ads/{id}` | Multipart; restricciones según origen |
| Administración | DELETE `/api/admin/ads/{id}` | Confirmación y recarga |
| Administración | POST `/api/admin/ads/{id}/approve` | JSON con `content_version` |
| Administración | POST `/api/admin/ads/{id}/reject` | JSON con `content_version` y `reason` |
| Proveedores | GET `/api/admin/ads/suppliers` | Búsqueda y paginación del selector |
| Identidad existente | GET `/api/suppliers/{id}` | Lectura con caché al abrir edición/rechazo |
| Proveedor | GET `/api/suppliers/me/ads` | Arreglo propio paginado |
| Proveedor | POST `/api/suppliers/me/ads` | Exclusivamente `image` e `image_mobile` en multipart |
| Proveedor | PUT `/api/suppliers/me/ads/{id}` | Exclusivamente las imágenes reemplazadas en multipart |
| Proveedor | PATCH `/api/suppliers/me/ads/{id}/visibility` | JSON con `supplier_visible` |
| Proveedor | DELETE `/api/suppliers/me/ads/{id}` | Confirmación y recarga |
| Público | GET `/api/ads/public` | Consumo existente conservado |

Las notificaciones incorporan `ad_banner_id`. `ad_pending_approval` abre administración con `approval_status=PENDING` y `ad_id`; `ad_approved`/`ad_rejected` abren Mis anuncios con `ad_id`. El destino se localiza recorriendo páginas de hasta 200 registros del listado real, con cancelación y errores visibles; no se presupone la primera página ni se inventa un endpoint de detalle. La solicitud enfocada se consulta sin filtro de aprobación porque su estado pudo cambiar desde la notificación. No se modifica el marcado como leído, el WebSocket ni los destinos de otros módulos. No se generan notificaciones desde el cliente.

## Archivos

Modificados:

- `src/app/admin/ads/page.tsx`
- `src/services/adsService.ts`
- `src/services/notificationService.ts`
- `src/lib/notificationDestination.ts`
- `src/components/admin/AdminSidebar.tsx`
- `src/components/AdsCarousel.tsx`

Creados:

- `src/app/admin/my-ads/page.tsx`
- `src/components/admin/ads/AdminAdsPanel.tsx`
- `src/components/admin/ads/AdAdminForm.tsx`
- `src/components/admin/ads/AdAdminCard.tsx`
- `src/components/admin/ads/AdSupplierPicker.tsx`
- `src/components/admin/ads/AdRejectModal.tsx`
- `src/components/admin/ads/MyAdsPanel.tsx`
- `src/components/admin/ads/SupplierAdUpload.tsx`
- `src/components/admin/ads/SupplierAdCard.tsx`
- `src/components/admin/ads/AdNotificationTarget.tsx`
- `src/components/admin/ads/AdControls.tsx`
- `src/lib/adDestination.ts`
- `src/lib/adValidation.ts`
- `ADVERTISING_FRONTEND.md`

Retirado: `src/components/admin/ads/SupplierAdForm.tsx`. Se reutilizan `AdImage`, `FileUpload`, `PageHero` y `Toast` sin modificar sus implementaciones.

## Verificación y límites

- `npx tsc --noEmit`: correcto, sin errores.
- ESLint de todos los archivos TypeScript/TSX modificados y creados: 0 errores y 9 advertencias preexistentes en `AdsCarousel.tsx` (8 usos de `any` y la imagen nativa preservada por la restricción visual).
- `npm run build`: correcto, incluye las dos rutas. Conserva advertencias del entorno Node sobre `--localstorage-file`.
- `git diff --check`: correcto.
- Navegador local: ambas rutas redirigen a login conservando el destino cuando no hay sesión.
- No se ejecutaron pruebas automatizadas: `AGENTS.md` indica expresamente no ejecutarlas.

No había una sesión autenticada disponible en el navegador utilizado. No se ejecutaron cargas, modificaciones, revisiones, eliminaciones ni cambios de visibilidad contra datos reales. Tampoco se verificó visualmente el contenido autenticado en escritorio/móvil, la entrega de notificaciones ni los clics con anuncios reales del backend desplegado. Los controles de rol distintos de la sesión anónima se revisaron en código, no con cuentas reales.

Antes de considerar validado el despliegue, comprobar que backend y migración publicitaria estén instalados y recorrer el ciclo completo con cuentas de administrador/proveedor, incluidos conflicto 409, revisión de cambios de imagen, paginación de notificaciones, URLs automáticas/manuales, visibilidad y regresión del carrusel. No se afirma funcionamiento en producción.
