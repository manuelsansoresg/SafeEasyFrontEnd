# Agenda visual y solicitudes de reprogramación

Implementación exclusiva de SafeEasyFrontEnd. No se editaron backend ni Flutter, no se desplegó y no se realizaron operaciones financieras reales.

## Archivos y responsabilidades

Modificados:

- `src/app/admin/agenda/appointments/page.tsx`: integración de vistas, detalle, navegación directa, eventos y acciones existentes; carga financiera bajo demanda.
- `src/components/agenda/AgendaModalShell.tsx`: soporte de contenido sin formulario y aislamiento del teclado entre diálogos anidados.
- `src/services/agendaBookingService.ts`: consultas compatibles de citas, rangos, ordenamiento y solicitudes globales.
- `src/types/agendaBooking.ts`: parámetros, órdenes y respuesta paginada de solicitudes con proyección de la cita.
- `src/lib/notificationDestination.ts`: enlaces específicos de reprogramación.
- `src/services/notificationService.ts` y `src/types/chat.ts`: identificador opcional de solicitud en notificaciones y eventos.

Nuevos:

- `src/components/agenda/AgendaCalendarToolbar.tsx`: selección de vista y navegación temporal.
- `src/components/agenda/AgendaProviderCalendar.tsx`: día, semana y mes.
- `src/components/agenda/AgendaPendingRequests.tsx`: contador y bandeja.
- `src/components/agenda/AgendaRescheduleRequestsModal.tsx`: comparación, historial y decisiones.
- `src/hooks/useProviderAgenda.ts`: consultas, permisos, sesión, paginación y cancelación de respuestas obsoletas.
- `src/lib/agendaCalendar.ts`: fechas civiles, zona horaria, períodos y distribución de citas superpuestas.
- `test/agenda-calendar.test.mjs` y `test/agenda-calendar-interactions.test.mjs`: 44 pruebas nuevas.

## Cuatro vistas

Día representa inicio y duración, estados textuales, jornada configurada y citas simultáneas en columnas. Las citas que cruzan medianoche aparecen recortadas en ambos días. Los huecos no prometen disponibilidad.

Semana comienza en lunes, con siete columnas en escritorio. En móvil se elige un día mediante una franja horizontal y se muestra su horario legible. Mes muestra 42 celdas, cantidades e indicadores sin nombres de clientes; seleccionar una fecha abre Día. Se conserva el calendario público existente.

Reservaciones conserva las tarjetas y acciones anteriores. Solicita al servidor `created_desc` por defecto, `start_asc` para próximas citas o `start_desc`. Próximas usa un límite inferior correspondiente al instante actual. Se conservan los filtros de estado. La paginación muestra 50 registros y consulta uno adicional para detectar la siguiente página; no descarga todo el historial.

La sesión conserva vista y fecha por usuario. Sin selección previa se abre Semana en escritorio y Día en móvil.

## Contratos y paginación

`providerAppointments()` se extiende de forma compatible. La respuesta de citas sigue siendo un arreglo. El calendario consulta exclusivamente su período con `sort=start_asc`, `overlap=true`, límites UTC explícitos y páginas de hasta 200; continúa hasta una página incompleta y deduplica por ID. No depende de que el proxy exponga `X-Total-Count`.

Las consultas anteriores se cancelan al navegar. Una secuencia de peticiones impide que respuestas tardías reemplacen datos nuevos.

La consulta global usa `/agenda/reschedule-requests?status=pending`, con `skip` y `limit`, y el total proporcionado por el servidor. Se recupera el índice completo de solicitudes pendientes en páginas de 200 para identificar cambios pendientes en cualquier cita del calendario. La bandeja presenta ese índice en páginas locales de 50, respetando el orden recibido. No se descarga el historial de reservaciones. Si el total cambia entre páginas o no coincide con los IDs recuperados, se muestra un error recuperable; no se inventa un cero. Esta estrategia requiere más consultas cuando hay muchas solicitudes pendientes.

## Zona horaria

Se usa exclusivamente `agendaService.getSettings().timezone` para hoy, fechas, horas, navegación, consultas y solicitudes. Las fechas civiles se convierten a límites UTC de inicio inclusivo y fin exclusivo. Los límites se calculan por fecha civil, sin sumar 24 horas al instante anterior; hay pruebas de días de 23 y 25 horas.

Una zona inválida o no resoluble produce un error recuperable. No se sustituye silenciosamente por la zona del equipo. Las franjas del calendario muestran horas civiles; no constituyen un motor de disponibilidad.

## Solicitudes y contador

El contador global procede del campo `total`, independientemente de período y citas visibles. Los errores mantienen el total como desconocido. La bandeja compara fecha vigente y propuesta, muestra cliente, servicio del catálogo, motivo, fecha de solicitud e ID. Servicios ausentes del catálogo conservan una referencia por ID.

El modal distingue cita actual y cambio solicitado. Aprobar y rechazar abren una confirmación integrada con nota opcional. No se usa `window.prompt` para decidir solicitudes. Un bloqueo síncrono evita envíos duplicados; se espera la respuesta antes de anunciar éxito. Después se consulta la cita y se actualizan calendario, bandeja y contador, conservando el historial.

Un conflicto 409 muestra que el horario ya no está disponible y vuelve a consultar los datos. Las solicitudes resueltas no ofrecen acciones. Las citas canceladas conservan información e historial con advertencia explícita; tampoco se ofrecen decisiones inválidas en citas completadas o de inasistencia.

## Notificaciones y WebSocket

Los enlaces usan `booking_id`, `action=reschedule` y opcionalmente `request_id`. Se consulta la cita directamente por ID aunque no pertenezca al período visible. La solicitud debe pertenecer a esa cita; no se decide una solicitud histórica o ajena por coincidencia de texto.

Las notificaciones antiguas de reprogramación sin identificador siguen abriendo el historial y la solicitud pendiente correspondiente. Los enlaces antiguos con solo `booking_id` mantienen acceso al detalle; cuando existe exactamente una solicitud pendiente se abre directamente. Los errores de inexistencia o permisos se muestran al usuario.

Los eventos aceptan `reschedule_request_id` opcional y siguen aceptando payloads antiguos. La deduplicación contempla el identificador de solicitud; se agrupan refrescos cercanos y se recargan datos tras reconectar. Los eventos actualizan datos sin abrir modales inesperados ni mover citas basándose únicamente en el payload.

## Funciones y finanzas conservadas

Crear, confirmar, completar, marcar inasistencia, cancelar, reprogramar manualmente, pagos manuales, devoluciones y paneles financieros mantienen sus servicios y contratos. Los detalles financieros v1/v2 se cargan al abrir el panel correspondiente, evitando peticiones por cada cita mensual. No se modificaron cálculos, endpoints financieros, Mercado Pago ni reglas de anticipos/reembolsos.

Se mantienen verificaciones de acceso, cargas, vacíos y errores recuperables. Los diálogos conservan foco, navegación por teclado y cierre; el Escape de un diálogo hijo no cierra simultáneamente el padre. Los formularios financieros no quedan anidados dentro de otro formulario.

## Verificaciones realizadas

- `npx tsc --noEmit`: correcto.
- `npm test`: 227 pruebas aprobadas, cero fallos; 183 existentes y 44 nuevas.
- `npm run lint`: cero errores; 315 advertencias existentes en el repositorio.
- Las pruebas nuevas cubren períodos, DST, zonas distintas, solapamientos, medianoche, estados, renderizado de vistas, órdenes, filtros, paginación de más de 200, contador, errores, navegación estructurada, decisiones, doble envío, conflictos, historial, permisos, sesión, carreras entre consultas, reconexión y accesibilidad de modales.
- Las pruebas de interacción usan React y DOM simulado con respuestas controladas. Incluyen aprobación que mueve la cita después de la respuesta y rechazo que conserva la fecha. No representan operaciones reales contra producción.
- `npm run build` se intentó y se interrumpió tras quedarse en compilación. El intento adicional `npm run build -- --webpack` terminó con `ENOTFOUND fonts.googleapis.com`: Next no pudo descargar Poppins y Varela Round desde `src/app/layout.tsx`. No se alteraron fuentes ni configuración para ocultar ese fallo.

## Limitaciones pendientes

La compilación de producción necesita repetirse con acceso a Google Fonts. El intento de ejecución con permisos ampliados fue rechazado por la revisión automática debido a capacidad temporal del modelo revisor, antes de ejecutar la acción; no indicó que el comando fuera inseguro.

No se realizó una revisión visual manual en navegador real ni una prueba integral contra cuentas y datos reales del backend. La cobertura responsive y de teclado es automatizada, con renderizado y DOM simulado; requiere validación visual final en móvil y escritorio. No se afirma haber verificado operaciones financieras reales ni el despliegue. No se detectó un bloqueo del contrato API que requiera cambios de backend.
