# Agenda: políticas estándar y configuración simple del frontend

Fecha: 18 de octubre de 2026.

## Implementación

Se contrastaron `../safeEasyBackEnd/AGENDA_STANDARD_POLICIES_IMPLEMENTATION.md`, `app/api/agenda_policies.py`, `app/services/agenda_policies.py`, `app/schemas/agenda_finance.py`, la cotización/creación de `app/api/agenda_finance.py` y la resolución/snapshot de `app/services/agenda_finance.py`.

Las páginas existentes ahora permiten elegir solo modalidad y porcentaje/importe. Se retiraron del editor las casillas de retención/autorización y los campos editables de texto y versión. Se conserva el estilo de controles de 48 px, las fuentes y colores actuales y las distribuciones responsive.

No se modificaron backend, Flutter, Menú, Productos, otros pagos, OAuth, Checkout Pro, webhooks, archivos de producción ni banderas. No hubo despliegue, pagos reales, commits ni push.

## Configuración general e individual

El servicio administrativo serializa una política estándar exclusivamente como:

- `{ "mode": "offline" }`
- `{ "mode": "full" }`
- `{ "mode": "percentage", "percentage": "30" }`
- `{ "mode": "fixed", "fixed_amount": "200.00" }`

Las respuestas estándar pueden contener campos legales de compatibilidad y evidencia de lectura. El serializador los elimina de los nuevos guardados estándar, incluyendo `policy_source` y `standard_evidence`. El cliente no envía aprobaciones ni autorizaciones ficticias.

Las configuraciones heredadas se reconocen por `policy_source: legacy` o por la presencia de los campos legales en respuestas antiguas sin marcador. Abrirlas o guardar otros ajustes conserva sus valores y su clasificación heredada. Se muestran de solo lectura, con consulta del texto existente y un botón explícito **Usar condiciones de Drooopy**. Solo esta acción convierte el borrador del formulario a una política estándar; todavía requiere guardar. No cambia las condiciones de reservaciones anteriores.

El servicio con política null sigue heredando; no se copia la política global. Se conservan las banderas de aceptación de pagos, métodos y permisos online. La validación monetaria existente se adapta a campos opcionales, sin alterar cálculos financieros.

El plazo sigue siendo exclusivamente `AgendaSettings.cancellation_notice_hours`. La sección Pagos muestra el resumen dinámico y un botón **Modificar plazo** que lleva a la configuración general; no existe otro control o variable de plazo.

## Aceptación única del proveedor

La página administrativa consulta la política central por usuario propietario y al regresar a la pestaña. Los resultados se aíslan por usuario; una respuesta anterior no debe sustituir una consulta más reciente.

Se presenta una sola sección de aceptación en Pagos cuando hay anticipos estándar generales o por servicio:

- Aprobada y sin autorización: texto introductorio, consulta del texto completo en modal, una casilla inicialmente desmarcada y **Aceptar y continuar** deshabilitado hasta marcarla.
- Autorizada: únicamente el indicador **Condiciones de cancelación aceptadas**.
- Sin aprobación o política disponible: el editor explica que la protección está pendiente de habilitación. No se ofrece el botón de aceptación ni se promete retención.
- Fallo de consulta: se informa y se permite consultar nuevamente; no se presume autorización.

El POST contiene exclusivamente la versión y hash exactos del GET, más `accepted: true`. Después se vuelve a consultar el servidor; no se asigna `provider_authorized: true` localmente. Un cambio de usuario, versión, hash o aprobación reinicia la casilla. Los rechazos y respuestas inciertas vuelven a consultar, sin repetir el POST automáticamente.

La plantilla del modal utiliza el plazo actual para presentar el parámetro `{cancellation_notice_hours}`; el hash enviado sigue siendo el hash original de la plantilla del servidor. Se explica que la aceptación cubre las condiciones y las horas que configure el proveedor. No existe una aceptación por servicio ni una pantalla para simular aprobaciones jurídicas.

## Reserva del cliente

El resumen utiliza total, pago inicial y saldo restante de la cotización, sin recalcular dinero. Las condiciones se muestran en un desplegable y conservan su versión real. La casilla del cliente aparece solo cuando `acceptance_required=true`, inicia desmarcada y bloquea la creación si no se acepta o si faltan texto/versión.

`accepted_terms_version` solo se envía tras la aceptación explícita cuando se requiere. Las condiciones suministradas por el backend también se pueden consultar si no requieren aceptación, sin agregar una casilla innecesaria.

El backend actual rechaza las condiciones desactualizadas con HTTP 422 y el mensaje exacto **Debes aceptar la versión vigente de las condiciones de cancelación.** Ese rechazo ocurre antes del commit. El frontend:

1. Conserva el UUID y los datos originales del intento.
2. Guarda que se necesita revisar las condiciones, también para recuperar tras recargar.
3. Desmarca la aceptación y vuelve a consultar la cotización del mismo servicio.
4. Muestra el nuevo texto y exige otra acción explícita.
5. Solo después de esa acción actualiza la versión aceptada sobre el mismo UUID y repite el comando.

No se modifica el comando tras un timeout, 409 ni un 422 ajeno a condiciones. No hay creación alternativa v1, nueva clave automática ni reserva automática al cambiar la cotización. Los reintentos inciertos conservan los datos congelados existentes. La presentación de pagos sigue dependiendo de las respuestas del servidor.

## Cancelaciones, excepciones y devoluciones

`AgendaFinancialCancellation.tsx` permanece sin cambios: se conservan la vista previa, importes del servidor, fecha límite, `preview_token`, `accept_deposit_loss`, confirmación expresa de pérdida y recuperación de conflictos.

El proveedor encuentra **Más opciones → Registrar excepción de cancelación** dentro del detalle financiero existente. Se ofrece para citas v2 pendientes/confirmadas sin una excepción registrada. Solicita motivo de 3–1000 caracteres y referencia opcional de hasta 255. El botón constituye la confirmación expresa del registro inmutable.

Una vez enviado, los datos del formulario quedan congelados para repetir exactamente el mismo motivo/referencia ante respuesta incierta. El endpoint reutiliza el evento para datos iguales. Se consulta nuevamente el resumen/historial al terminar. No se cancela ni se devuelve dinero desde esta acción.

Para citas canceladas o no_show se muestra la orientación al flujo auditado **Solicitar devolución** ya existente. No se introducen rutas ni cálculos alternativos. Por prudencia, la UI tampoco ofrece nuevas excepciones en citas completed; el backend mantiene la comprobación definitiva del cierre financiero.

La información de protección se presenta como condicional: aprobación y autorización confirmadas, aceptación del cliente, fondos confirmados/disponibles y aplicación válida. No promete retener pagos completos, dinero no confirmado ni importes afectados por una excepción. Si cancela el negocio, se tramita la devolución correspondiente.

## Archivos modificados

- `src/app/admin/agenda/page.tsx`: consulta central y sección única de aceptación; conexión del plazo y estado a los editores.
- `src/app/agenda/[supplierId]/page.tsx`: resumen, aceptación exacta y recuperación de condiciones rechazadas con el mismo UUID.
- `src/components/agenda/AgendaChargePolicyEditor.tsx`: editor simplificado, lectura heredada y conversión explícita.
- `src/components/agenda/AgendaPaymentSettings.tsx`: estado central y acceso al plazo general.
- `src/components/agenda/AgendaServiceConfigModal.tsx`: mismo editor y estado del proveedor, sin aceptación por servicio.
- `src/components/agenda/AgendaFinancialPanel.tsx`: opción secundaria de excepción, historial y orientación a devolución tras cierre.
- `src/lib/agendaFinance.ts`: serialización, identificación heredada, comprobación de aceptación y renovación segura de términos.
- `src/services/agendaService.ts`: consulta/aceptación central y payloads simples en guardados existentes.
- `src/services/agendaBookingService.ts`: endpoint real de excepción.
- `src/types/agendaFinance.ts`: lectura compatible de campos antiguos y contratos centrales.
- `test/agenda-finance.test.mjs`: actualización de expectativas del editor anterior, conservando regresiones financieras.
- `AGENDA_FINANCE_FRONTEND_IMPLEMENTATION.md`: enlace a esta actualización, que sustituye su configuración legal editable anterior.

## Archivos creados

- `src/components/agenda/AgendaStandardPolicyConsent.tsx`: aceptación única del proveedor y consulta del texto.
- `src/components/agenda/AgendaBookingQuoteSummary.tsx`: resumen y condiciones del cliente.
- `src/components/agenda/AgendaPolicyException.tsx`: registro auditado de excepción.
- `test/agenda-standard-policies.test.mjs`: pruebas del nuevo contrato y presentación.
- `AGENDA_STANDARD_POLICIES_FRONTEND_IMPLEMENTATION.md`: este informe.

## Endpoints utilizados

- GET `/api/agenda/standard-cancellation-policy`.
- POST `/api/agenda/standard-cancellation-policy/accept`.
- PUT `/api/agenda/payment-settings`.
- POST `/api/agenda/services` y PATCH `/api/agenda/services/{service_id}`.
- PUT `/api/agenda/settings`, conservado para `cancellation_notice_hours`.
- GET `/api/public/agenda/{supplier_id}/services/{service_id}/financial-quote`.
- POST `/api/public/agenda/{supplier_id}/bookings/financial`.
- POST `/api/agenda/appointments/{booking_id}/cancellation-policy-exception`.

Continúan las rutas existentes de resumen, historial, vista previa, cancelación y devolución. La nueva excepción usa `/proxy/agenda` como las demás operaciones de citas. La consulta/aceptación central usa `/api/agenda` mediante el servicio de configuración existente. Toda comunicación reutiliza `fetchWithAuth`.

## Verificación

- `npm test`: 84 pruebas aprobadas, 0 fallidas.
- `npx tsc --noEmit`: aprobado.
- `npm run lint`: 0 errores y 315 advertencias existentes fuera de los archivos modificados.
- `npm run build`: aprobado, con los avisos existentes de Node sobre `--localstorage-file` durante prerenderizado.
- `git diff --check`: aprobado.

Las pruebas usan fetch simulado, renderizado React y almacenamiento simulado. Cubren las cuatro modalidades, ausencia de campos legales/evidencia en guardados estándar, conservación heredada y conversión explícita, herencia null, horas dinámicas, autorización aprobada/pendiente/previa/nueva versión, aceptación del cliente opcional/obligatoria, rechazo de términos y UUID estable, excepción y errores 403/409/422. Las regresiones existentes mantienen cancelaciones y reembolsos.

Se comprueban clases y estructura responsive en renderizado, no navegación visual en dispositivos reales. No se hicieron pagos, devoluciones, aceptaciones reales ni solicitudes de prueba a producción.

## Incompatibilidades y pendientes reales

No se detectaron diferencias bloqueantes entre documentación y código real. Dos detalles del contrato se respetan expresamente:

- El POST de aceptación devuelve un recibo (`version`, hash, `accepted_at`), no la vista completa con `provider_authorized`; por ello se repite el GET.
- El rechazo de condiciones del cliente es actualmente un 422 con mensaje de texto, no un código estructurado. Se reconoce solo el mensaje real; no se tratan todos los 422 como cambios de condiciones.

Antes de habilitar: aplicar/verificar la migración backend en staging, realizar revisión jurídica y aprobación central real, obtener aceptación expresa de proveedores y recorrer los flujos con cuentas oficiales de prueba, webhooks y escenarios de desconexión. La falta de aprobación es un estado previsto; el frontend no la elude ni activa banderas. Falta QA interactiva de móvil, teclado/modal y navegación completa en staging.
