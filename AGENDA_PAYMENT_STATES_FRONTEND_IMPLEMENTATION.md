# Agenda: estados de Mercado Pago, actualización y recuperación del pago

## Alcance y contrato utilizado

Cambios exclusivos de SafeEasyFrontEnd. Fuente de verdad: documento del backend
`safeEasyBackEnd/AGENDA_PAYMENT_STATES_IMPLEMENTATION.md`, consultado en modo lectura.
No se modificó FastAPI, PostgreSQL, Flutter, Menú, Productos, Suscripciones, comisiones,
retenciones ni políticas. No se hicieron pagos reales, despliegues, commit ni push.

`FinancialSummary` conserva todos los importes y agrega campos opcionales para convivir con v1:
`payment_state`, `last_payment_attempt_state`, `payment_intent_status`, `payment_status_detail`,
`payment_updated_at`, `has_active_review`, `has_pending_payment`, `has_confirmed_payment`,
`payment_message`, `can_retry_payment`, `retry_block_reason` y `retry_strategy`.
Los valores nulos permitidos por FastAPI se conservan. No se calcula un saldo desde un estado.
`settlement_status` sigue representando la liquidación global. El estado principal mostrado
es payment_state; nunca se reemplaza por last_payment_attempt_state. Los motivos técnicos
no se imprimen: se usan textos seguros predefinidos sin atribuir una causa bancaria.

## Servicios y endpoints

Se conserva el proxy existente, sin crear rutas Next.js bajo /api:

| Método nuevo del servicio | Ruta frontend | Operación |
|---|---|---|
| refreshFinancialSummary(id, false, token?, signal?) | POST /proxy/public/agenda/bookings/{id}/financial-summary/refresh | Cliente propietario o invitado autorizado; sin body |
| refreshFinancialSummary(id, true, null, signal?) | POST /proxy/agenda/appointments/{id}/financial-summary/refresh | Proveedor autenticado; sin body |
| retryFinancialPayment(id, key, token?, signal?) | POST /proxy/public/agenda/bookings/{id}/payments/retry | Recuperación autorizada; body solo idempotency_key |

Para invitados se transmite management_token por query usando el mecanismo existente. Se usa
fetchWithAuth para la autenticación disponible; la operación de recuperación no se repite
automáticamente tras un error de autenticación. Los GET financialSummary existentes se conservan
como lecturas sin efectos remotos para polling, notificaciones y actualizaciones de la vista.

Petición de recuperación:

```json
{"idempotency_key":"UUID-generado-por-el-cliente"}
```

Respuesta tipada AgendaPaymentRetryResponse:

```typescript
interface AgendaPaymentRetryResponse {
  booking_id: number;
  payment_intent_id: number;
  preference_id: string;
  checkout_url: string;
  amount: string | number;
  currency: string;
  expires_at: string;
  strategy: "reuse_existing_checkout";
}
```

No se envía cantidad, moneda, cuenta receptora, datos de tarjeta ni un estado paid.

## Interfaz y actualización manual

El resumen separa “Estado del pago en Mercado Pago” del resumen financiero, con texto,
símbolo accesible complementario y región aria-live. Se reconocen approved, rejected, pending,
in_process, authorized, cancelled, refunded, in_mediation, charged_back, not_started e invalid.
Estados desconocidos muestran que requieren verificación. No se depende exclusivamente del color.
Las cifras del ejemplo total 200 / anticipo 10 / saldo 190 proceden directamente del servidor.

El botón Actualizar estado ahora ejecuta POST y muestra “Consultando Mercado Pago…”.
Una referencia síncrona bloquea dobles clics y solicitudes simultáneas; también se coordina
con la recuperación y las lecturas periódicas. Al terminar se aplica el resumen devuelto y,
para el proveedor, se vuelve a consultar su historial. Un fallo conserva las cifras anteriores
y muestra un mensaje seguro; los GET posteriores no borran el aviso del fallo remoto.

Hay una pausa local de 12 segundos entre consultas interactivas y 60 segundos tras 429.
Es una ayuda de interfaz, no reemplaza los límites compartidos del backend. El polling de
15 segundos, el retorno de visibilidad y las notificaciones siguen ejecutando únicamente GET.
No hay POST periódico ni reintentos automáticos ilimitados.

## Recuperación del pago del cliente

AgendaPaymentRetry se integra dentro de AgendaFinancialPanel exclusivamente para el cliente.
La página de gestión solo monta ese panel para reservas v2. Además de can_retry_payment=true y
retry_strategy=reuse_existing_checkout, se comprueba que el estado representativo sea rejected,
sin pago confirmado, pendiente, revisión activa ni revisión financiera, y con acceso de gestión.
Los estados locales cerrados no ofrecen la acción. La petición siempre queda sujeta al backend.

Al pulsar se muestra “Verificando pago…”. Se genera o recupera un UUID estable mediante la
infraestructura de sessionStorage existente. El scope incluye reserva y una huella SHA-256 de
la identidad/autorización; nunca contiene el token de gestión en claro. El contenido nuevo
almacenado es únicamente la clave de idempotencia, sin URL ni datos bancarios.

Un timeout, fallo de red o respuesta incierta conserva la clave; recargar la página en la misma
pestaña conserva ese intento. Otra reserva o usuario tiene otro scope. Tras iniciar la redirección
válida se elimina la clave; un estado confirmado o reserva cerrada también limpia el intento.
La consulta se aborta localmente a los 60 segundos sin inferir autorización del servidor.

Solo se redirige después de recibir 200 y verificar:

- booking_id corresponde a la reserva actual;
- strategy es reuse_existing_checkout;
- checkout_url pasa getSafeMercadoPagoUrl();
- identificadores presentes, importe positivo y moneda MXN;
- expires_at válido y futuro;
- el componente sigue vigente y su estado no pasó a aprobado, pendiente o cerrado durante la consulta.

Se usa exclusivamente la URL devuelta por esta petición. Al cambiar de reserva o usuario se
reinicia el componente; al desmontarlo se invalida la operación asíncrona anterior. No se abre
un modal de pago, no se crea una preferencia y no se vuelve a crear la reserva.

Un 409 nunca redirige. Se conserva el intento estable y se pide actualizar el estado antes de
habilitar otra recuperación en esa vista. El proveedor no ve el botón del cliente. Los controles
para abrir/copiar enlaces de Checkout del historial del proveedor fueron retirados: ready no
constituye autorización de cobro. El historial conserva importes, estados y vencimientos.

## Creaciones con resultado incierto

Si el intento guardado ya tiene bookingId, la pantalla pública navega a la gestión de esa reserva,
con el acceso de invitado correspondiente. No abre previous.checkout ni llama otra vez al creador.
Si aún no conoce bookingId, conserva la idempotencia de creación existente; después de recuperar
el resultado lleva a gestión. Solo una creación nueva con payment_state=not_started y una intención
ready puede iniciar el Checkout inicial devuelto en esa respuesta. La recuperación de un rechazo
siempre pasa por el endpoint específico de la reserva existente.

## Errores y bloqueos

Se conservan los códigos de AgendaBookingRequestError. Para estas acciones la interfaz usa textos
seguros predefinidos; no imprime errores privados, status_detail, tokens ni respuestas arbitrarias.

- 401: sesión vencida; 403: acceso no autorizado; 404: reserva no encontrada.
- 409: mensaje según el código del backend, sin redirección ni creación alternativa.
- 422: solicitud inválida; 429: esperar antes de volver a consultar.
- 500/502/503, aborto o fallo de red: no se pudo confirmar la actualización; conservar datos anteriores.

Se contemplan todos los códigos documentados: payment_pending, payment_already_confirmed,
reconciliation_required, reconciliation_in_progress, reconciliation_unavailable,
reconciliation_incomplete, checkout_expired, booking_closed, booking_expired, financial_review,
checkout_uncertain, payment_uncertain, finance_disabled, legacy_booking, multiple_or_missing_intents,
contract_mismatch, payment_identity_mismatch, checkout_identity_mismatch, checkout_contract_mismatch,
checkout_expiration_unverified, checkout_url_unverified, checkout_url_mismatch, checkout_not_active,
online_payments_disabled y payment_refresh_rate_limit. Un código desconocido usa un texto seguro.

## Archivos creados o modificados

- src/types/agendaFinance.ts
- src/services/agendaBookingService.ts
- src/lib/agendaFinance.ts
- src/lib/agendaPaymentRecovery.ts (nuevo)
- src/components/agenda/AgendaFinancialSummary.tsx
- src/components/agenda/AgendaFinancialPanel.tsx
- src/components/agenda/AgendaPaymentRetry.tsx (nuevo)
- src/app/agenda/bookings/[bookingId]/page.tsx
- src/app/agenda/[supplierId]/page.tsx
- test/agenda-payment-recovery.test.mjs (nuevo)
- test/agenda-payment-panel-interactions.test.mjs (nuevo)
- AGENDA_PAYMENT_STATES_FRONTEND_IMPLEMENTATION.md (nuevo)

## Pruebas ejecutadas

El AGENTS.md dice que no existen pruebas, pero el package.json y test/ actuales sí tienen
node:test. Se siguió el requerimiento explícito del usuario de probar el cambio, reutilizando
esa infraestructura sin añadir dependencias.

- node --test test/agenda*.test.mjs: **167 aprobadas, 0 fallidas** (99 casos nuevos y 68 existentes).
- TypeScript: node_modules/.bin/tsc --noEmit, correcto.
- ESLint en todos los archivos de código y pruebas afectados: correcto, sin advertencias.
- npm run build: Next.js 16.1.1 completó compilación, TypeScript y generación de las 97 páginas.
  El build emite advertencias de Node sobre --localstorage-file; no impiden su finalización.
- git diff --check: correcto.

Los casos nuevos cubren los estados y cifras del servidor; v1 sin nuevos campos; rutas y payloads;
propietario/invitado; 401/403/404/409/422/429/500/502/503; doble clic; timeout real con aborto por timer;
clave estable tras recarga; aislamiento de usuario/reserva; cambio de pantalla; aprobación durante
una consulta; URL no permitida; identidad y vencimiento inválidos; conservación de devoluciones.

Las pruebas del panel ejecutan sus manejadores reales con un host controlado de hooks y HTTP
simulado: botón cliente/proveedor, doble clic, carga, resumen actualizado, historial del proveedor,
error que conserva cifras y timer de polling que nunca usa POST. También ejecutan el botón real
de recuperación con un 200 autorizado, 409 y estado en revisión. No son solo comprobaciones de texto.

La presentación se verifica con render de React, regiones accesibles, mensajes, botón de al menos
48 px y clases responsive. No se hizo una inspección visual en navegador móvil ni una auditoría
con lector de pantalla; esa revisión práctica sigue pendiente. No se probaron tarjetas reales.

## Límites y verificaciones pendientes

El frontend refleja la autorización del backend y no puede garantizar exclusión atómica de pagos
dentro de Mercado Pago. Conserva las limitaciones y compensaciones del contrato backend: dos
pagos externos concurrentes requieren la conciliación existente. No se ofrece generar otro Checkout.
La evidencia de can_retry_payment es breve; si caduca entre lectura y clic, se respeta el 409.

En staging/AWS comprobar los proxies POST desplegados, autenticación y tokens de gestión, contratos
v2, límites compartidos, worker y webhooks. Verificar en sandbox rechazo → actualización → recuperación
del mismo Checkout → aprobación, tanto como invitado como registrado; cotejar importes y saldo.
Revisar también el retorno desde MP, errores 409/429, accesibilidad y presentación en dispositivos
móviles reales. No se activó automáticamente ninguna configuración del backend ni se desplegó.
