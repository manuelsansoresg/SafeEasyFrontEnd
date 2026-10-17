# Agenda financiera v2 — implementación frontend

Fecha: 17 de octubre de 2026.

## Alcance y estado

Integración sobre las páginas existentes de SafeEasyFrontEnd, sin cambios en backend, Flutter, marketplace, OAuth, planes, secretos ni despliegues. No se activó `AGENDA_FINANCE_ENABLED`, ni se hicieron commits o push.

Los componentes están conectados a configuración, reserva pública, detalle del cliente y citas del proveedor. La validación local cubre contratos y presentación; **no equivale a una certificación E2E con Mercado Pago ni autoriza activación pública**. Las limitaciones del contrato público descritas abajo impiden presentar algunos detalles que el backend no devuelve.

## Fuentes contrastadas

Se revisaron en el backend hermano `../safeEasyBackEnd`:

- `AGENDA_FINANCE_IMPLEMENTATION.md` y `AGENDA_CANCELLATIONS_IMPLEMENTATION.md`.
- `app/api/agenda_finance.py`, `app/api/agenda_bookings.py`, `app/api/agenda_settings.py`.
- `app/schemas/agenda_finance.py`, `app/schemas/agenda_payment.py`, `app/schemas/agenda.py`.
- Motor `app/services/agenda_finance.py`, cancelaciones y notificaciones.

Se revisaron las cuatro páginas de Agenda, configuración, selector y estados de pago/reembolso, modal compartido, servicios, tipos, autenticación, seguridad, proxy y WebSocket del frontend.

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/app/admin/agenda/page.tsx` | Guarda la política general y conecta plazo, ejemplo de precio y permisos a los editores |
| `src/app/admin/agenda/appointments/page.tsx` | Abre gestión financiera dentro de cada cita v2; evita consultas v1 y preserva el resultado al cancelar |
| `src/app/agenda/[supplierId]/page.tsx` | Cotización, términos, creación financiera, Checkout seguro y recuperación de intentos |
| `src/app/agenda/bookings/[bookingId]/page.tsx` | Resumen v2 y cancelación con vista previa; conserva presentación v1 |
| `src/components/agenda/AgendaPaymentSettings.tsx` | Editor general de anticipos y retención |
| `src/components/agenda/AgendaServiceConfigModal.tsx` | Herencia nullable y personalización por servicio |
| `src/components/agenda/AgendaModalShell.tsx` | Permite ocultar confirmación cuando el servidor prohíbe cancelar |
| `src/services/agendaBookingService.ts` | Operaciones v2 y preservación de `detail.code` para conflictos |
| `src/types/agenda.ts` | Políticas nullable en configuración y servicios |
| `src/types/agendaBooking.ts` | Versión financiera, vista previa aceptada y resultado de cancelación |
| `src/types/chat.ts` | Reconoce `agenda.financial_activity` |

## Archivos creados

| Archivo | Responsabilidad |
|---|---|
| `src/types/agendaFinance.ts` | Contratos financieros reales |
| `src/lib/agendaFinance.ts` | Presentación, validación de políticas, límites decimales y ejemplos ilustrativos |
| `src/lib/agendaFinancialAttempt.ts` | Persistencia de intentos pendientes en sessionStorage |
| `src/components/agenda/AgendaChargePolicyEditor.tsx` | Editor compartido de modalidades y retención |
| `src/components/agenda/AgendaFinancialSummary.tsx` | Resumen monetario y resultado recibido al cancelar |
| `src/components/agenda/AgendaFinancialPanel.tsx` | Lectura autorizada, cobros, ajustes, devoluciones e historial |
| `src/components/agenda/AgendaFinancialCancellation.tsx` | Vista previa, confirmación de pérdida y recuperación de conflictos |
| `test/agenda-finance.test.mjs` | Pruebas adicionales con fetch simulado, almacenamiento simulado y renderizado React |
| `AGENDA_FINANCE_FRONTEND_IMPLEMENTATION.md` | Este informe |

## Configuración del proveedor

En `/admin/agenda`, sección Pagos:

1. Conservar/configurar los controles existentes de aceptación de pagos y métodos.
2. Elegir sin anticipo, pago completo, porcentaje o importe fijo.
3. Capturar porcentaje con hasta cuatro decimales o importe con dos decimales.
4. Para porcentaje/fijo, opcionalmente habilitar retención, redactar condiciones, indicar versión y marcar la declaración expresa.
5. Guardar con el flujo existente.

El editor muestra el plazo de cancelación configurado. Si existe precio representativo, presenta un ejemplo claramente ilustrativo. No reemplaza la cotización contractual. La retención no se ofrece para pago completo/offline. No se redactan cláusulas legales automáticas.

Los cobros iniciales en línea requieren permiso del módulo, Mercado Pago vinculado y ajustes de pagos compatibles. Se reutiliza el OAuth existente. Si una política global todavía es null, la presentación refleja la modalidad efectiva heredada: full cuando los ajustes tradicionales habilitan cobro online; offline en otro caso. Guardar sin tocar esa política conserva null.

En Configurar cita de cada servicio, seleccionar configuración general envía `charge_policy: null`; personalizar envía la política explícita. No se copia la política global. El backend conserva los snapshots de citas anteriores.

## Reserva y pago inicial del cliente

Al seleccionar servicio, se consulta la cotización autorizada por el backend. Se muestran total, pago inicial y saldo previsto. Los términos completos se muestran únicamente cuando se exige aceptación; la casilla inicia desmarcada.

La creación v2 envía datos de `AgendaBookingCreate`, UUID y versión aceptada; nunca método de pago, cantidades calculadas o estado pagado. Verifica disponibilidad antes del primer envío. Si hay respuesta incierta, la repetición utiliza exactamente los datos y UUID originales y no vuelve a bloquearse por la disponibilidad consumida por esa misma reserva.

El intento se guarda antes del POST en sessionStorage, separado por proveedor y usuario/invitado. Tras una respuesta conocida se conserva el acceso a la cita y se limpia el intento antes de navegar. Una recarga con intento pendiente permite recuperar el mismo comando. No se escriben tokens ni claves en logs. El almacenamiento de sesión es necesario para esta recuperación.

Un Checkout listo solo se abre usando la URL retornada y validada por `getSafeMercadoPagoUrl`. Si no existe enlace listo, se abre el detalle y se consulta el resumen; no se crea otra intención. Offline completa la reserva sin salir a Mercado Pago.

## Regreso y resumen

`payment=success`, `failure` o `pending` nunca modifica dinero ni confirma aprobación. El detalle consulta el servidor y conserva por separado estado de cita y liquidación.

El resumen muestra total contractual, inicial requerido, anticipo confirmado, total cobrado, saldo real, devoluciones y revisión cuando están disponibles. `remaining_after_initial` solo se utiliza como previsión al reservar; los cobros usan `balance_due`. Un valor null se presenta como desconocido.

Las actualizaciones manuales, notificaciones existentes, regreso de visibilidad y consultas periódicas de solo lectura recuperan cambios. Ningún efecto crea cobros. Los mensajes WebSocket no se utilizan para reconstruir importes.

## Cobrar saldo e historial

En `/admin/agenda/appointments`, abrir “Pagos de la reservación” dentro de la cita v2. La consulta financiera se carga al abrir; las tarjetas v1 conservan su interfaz.

- **Efectivo / terminal / transferencia:** “Cobrar saldo”, elegir un método retornado en `allowed_manual_methods`, introducir el dinero efectivamente recibido, referencia y confirmar recepción. Admite abonos parciales. La terminal se opera físicamente antes de registrar; no hay vinculación de dispositivos.
- **Mercado Pago:** con permiso y configuración online disponible, crear enlace para el saldo que determina el servidor. El historial permite abrir o copiar el enlace seguro. No se envía un importe desde React.
- **Intención abierta o incierta:** bloquea cobros incompatibles; muestra estado y solicita conciliación. Un 409 se presenta sin cambiar automáticamente de clave.
- **Corrección:** solo cobros manuales, con importe disponible, motivo y confirmación. Agrega un movimiento; no borra el original.
- **Devolución extraordinaria:** por cobro confirmado, con importe, motivo, UUID y confirmación. El límite considera devoluciones reservadas/confirmadas y correcciones anteriores con centavos enteros. El servidor decide la autorización definitiva.

El historial separa operaciones, intenciones, devoluciones y eventos. Muestra importes, fechas disponibles, métodos, estados y referencias sin usar identificadores técnicos como contenido principal.

Los comandos pendientes del proveedor conservan UUID y datos en la sesión, aislados por usuario y cita. Tras un error pueden recuperarse sin editar los datos del comando original; la aceptación expresa se vuelve a solicitar al recuperar desde almacenamiento. Tras éxito conocido se permite un nuevo abono con una clave nueva.

## Cancelaciones y devoluciones

El cliente v2 abre “Consultar cancelación”. Se obtiene una vista previa vigente que muestra plazo, anticipo pagado, retención, devolución online/manual y saldo liberado. No se decide la retención con el reloj local.

Si no se permite cancelar, el modal muestra el aviso y oculta el botón de confirmación. Si existe pérdida, exige una casilla desmarcada con el importe exacto. La confirmación envía token real, motivo y aceptación, nunca cantidades.

Los códigos `cancellation_preview_changed` y `cancellation_loss_confirmation_required` invalidan la aceptación y obligan a consultar y confirmar otra vista previa. Tras error incierto se consulta primero la cita; no se repite automáticamente la cancelación.

El proveedor conserva su PATCH de estado con motivo obligatorio. Se presenta el `cancellation_result` retornado. El frontend no aplica retención propia ni llama a Mercado Pago directamente.

El resultado recibido al cancelar se presenta como resultado de ese momento. El estado actual se actualiza desde resumen e historial; para el cliente cancelado también se consulta la vista previa de solo lectura, que devuelve retención y obligaciones online/manuales pendientes actuales.

Se distinguen pending_request, request_in_progress, request_sent, confirmed, recoverable_error, review_required, manual_pending y cancelled. En historial del proveedor se presentan a partir de status, external_id y last_error conforme a la misma clasificación del backend. “Confirmado” no promete acreditación bancaria inmediata.

Una devolución manual pendiente permite confirmar devolución realizada con referencia, después de realizarla físicamente. El método se obtiene de la operación original y se excluye Mercado Pago. Se usa la ruta v2, nunca la antigua de reembolso v1.

## Endpoints reales

Los siguientes son los paths de FastAPI bajo `/api`. En el navegador los nuevos métodos usan `/proxy/agenda` y `/proxy/public/agenda`; configuración administrativa mantiene `/api/agenda` con `agendaService`.

| Método | Ruta backend |
|---|---|
| PUT | `/api/agenda/payment-settings` |
| POST / PATCH | `/api/agenda/services` / `/api/agenda/services/{service_id}` |
| GET | `/api/public/agenda/{supplier_id}/services/{service_id}/financial-quote` |
| POST | `/api/public/agenda/{supplier_id}/bookings/financial` |
| GET | `/api/public/agenda/bookings/{booking_id}/financial-summary` |
| GET | `/api/agenda/appointments/{booking_id}/financial-summary` |
| GET | `/api/agenda/appointments/{booking_id}/payments` |
| POST | `/api/agenda/appointments/{booking_id}/payments/manual` |
| POST | `/api/agenda/appointments/{booking_id}/payment-intents` |
| POST | `/api/agenda/appointments/{booking_id}/payments/{operation_id}/reversals` |
| POST | `/api/agenda/appointments/{booking_id}/payments/{operation_id}/refunds` |
| POST | `/api/agenda/appointments/{booking_id}/financial-refunds/{refund_id}/confirm-manual` |
| GET | `/api/public/agenda/bookings/{booking_id}/cancellation-preview` |
| POST | `/api/agenda/bookings/{booking_id}/cancel` |
| PATCH | `/api/agenda/appointments/{booking_id}/status` |

Se conservan disponibilidad, listado/detalle de citas, reprogramación y contratos v1 existentes. Las consultas públicas usan propietario autenticado o management_token conforme al contrato; los comandos utilizan `fetchWithAuth`, sin otro cliente de autenticación.

## Compatibilidad v1/v2 y función desactivada

`finance_version === 2` o `ledger_version === 2` selecciona el flujo v2. Las páginas evitan payment/refunds v1 para esas citas. Los históricos conservan sus rutas y presentación, sin recalcular precios desde el catálogo actual.

Solo el 409 explícito de **consulta de cotización** que indica “Los pagos ampliados de Agenda aún no están habilitados.” habilita la presentación tradicional. Otros conflictos, 404, fallos de red o errores de creación financiera no producen una reserva v1 alternativa.

El backend v1 no ofrece idempotencia de creación. Para evitar duplicados, un envío tradicional con resultado incierto queda bloqueado en la sesión y se pide verificar citas/correo con el establecimiento. Los rechazos HTTP definitivos permiten corregir y volver a solicitar. No se simula una garantía de idempotencia v1 que el servidor no tiene.

## Limitaciones reales de contrato y pendientes

1. **El resumen público v2 no expone intenciones, enlace vigente ni estado de rechazo individual.** El único enlace inicial se recibe en la creación financiera. Si la intención continúa creating/uncertain y se materializa después, no existe una consulta pública dedicada para recuperar su URL. El cliente ve el estado financiero real; el proveedor puede consultar el historial autorizado y compartir un enlace cuando esté listo. No se inventó una ruta ni se reutilizó payment v1. Tampoco se inventa “pago rechazado” cuando el resumen solo dice pending.
2. **El resumen público no devuelve el detalle individual de devoluciones v2.** Los GET ordinarios de cita no rellenan `cancellation_result` y el endpoint público refunds existente consulta tablas v1. Se muestra el detalle recibido al cancelar y se actualizan agregados mediante resumen/vista previa; después de recargar no se puede presentar cada request_state individual al cliente. El proveedor sí tiene historial completo. Se necesita una decisión de contrato backend para cubrir ese detalle público, fuera de este alcance autorizado.
3. No se ejecutó E2E real de OAuth, Checkout Pro, webhooks, pagos o devoluciones. No se hicieron pagos reales, ni pruebas contra recursos de producción. La matriz completa requiere staging y cuentas de prueba.
4. Accesibilidad verificada por estructura de controles etiquetados, casillas explícitas y reutilización del modal con foco atrapado/restaurado. Clases adaptables a móvil; falta recorrido visual e interactivo en dispositivos/navegadores de staging. No se declara una auditoría WCAG completa.
5. Los intentos inciertos se mantienen bloqueados conservadoramente; no hay una acción para “forzar” otro UUID. Una pestaña cerrada elimina sessionStorage; la recuperación posterior debe realizarse consultando la cita/establecimiento. No puede prometerse recuperación de credenciales de invitado que el navegador haya eliminado.

## Verificación local

El repositorio **sí contiene** `npm test` y pruebas nativas con `node --test`; se reutilizaron sin agregar framework o dependencias.

- `npm test`: **62 aprobadas, 0 fallidas** (36 existentes y 26 añadidas).
- `npm run lint`: **0 errores; 315 advertencias en archivos ajenos a los cambios**. Los archivos implementados no añaden advertencias. No se desactivaron reglas.
- `npx tsc --noEmit`: sin errores.
- `npm run build`: compilación de producción verificada; descarga las fuentes Google existentes. El primer intento dentro del sandbox quedó detenido durante compilación; se interrumpió y una ejecución con acceso requerido completó correctamente.
- `git diff --check`: sin errores.

Las pruebas nuevas utilizan respuestas y almacenamiento simulados y renderizado React. Cubren rutas/métodos/payloads, políticas y herencia, límites decimales, resumen parcial/desconocido, permisos, conflictos 409, función desactivada sin fallback, timeout con UUID estable, almacenamiento separado por usuario, URLs seguras y estados de devolución. No son pruebas E2E de clicks simultáneos, navegación completa o Mercado Pago.

## Antes de habilitar al público en staging

1. Verificar migración backend, snapshot de precios, bandera desactivada inicialmente y worker financiero programado.
2. Confirmar enrutamiento desplegado de `/proxy/*` y `/api/agenda/*`, permisos y OAuth existente.
3. Probar con cuentas oficiales de prueba las cuatro modalidades, herencia, aceptación/versionado, invitado y usuario.
4. Probar anticipo 240/total 800 y saldo 560 con efectivo, terminal, transferencia y segundo Checkout; abonos y rechazo de excesos.
5. Simular doble clic, desconexión/timeout después del commit, recarga, intención incierta y conflictos sin cambiar UUID.
6. Probar regreso success/failure/pending antes/después del webhook, dos cobros online, disputa y conciliación.
7. Probar cancelación dentro/fuera de plazo, sin términos válidos, token vencido por cambios, proveedor, reembolso parcial/múltiple y devolución manual.
8. Resolver las decisiones de contrato público señaladas arriba si se exige recuperar enlaces tardíos y consultar todos los request_state individuales desde el cliente.
9. Recorrer móvil, teclado, foco, lectores de pantalla y permisos con dos usuarios distintos; comprobar que ninguna consulta expone otra cita.
10. Autorizar la activación gradual únicamente tras estas verificaciones; mantener worker y webhooks si se desactiva la creación de operaciones.
