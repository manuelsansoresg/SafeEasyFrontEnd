# Importación y personalización del negocio

El wizard usa `/api/integrations/facebook/drafts` y el contrato `FACEBOOK_IMPORT_WIZARD_API.md` del backend. Las conexiones OAuth existentes mantienen `/api/integrations/facebook/connections`. No usar el alias `/api/backend` en producción.

## Flujo

- Cuatro pasos accesibles mediante botones: página, información, imágenes y revisión.
- Borradores propios o creados desde una página autorizada. Se listan borradores recuperables de la empresa, con vencimiento y opción explícita de descarte.
- La URL conserva el ID del borrador y de la empresa. SessionStorage contiene solo IDs para volver desde OAuth; los datos, imágenes y propuestas permanecen en el servidor.
- Guardado automático con debounce, una cola de escritura y versión del servidor. Navegar entre pasos no consulta Facebook. Ante conflicto se detiene el guardado y se ofrece recuperar explícitamente la versión guardada.
- Los campos con datos se incluyen automáticamente, sin casillas individuales. El formulario muestra los datos importados o los valores actuales cuando no hay importación. Editar es directo; los vacíos conservan lo publicado. «Continuar» espera el guardado del borrador antes de avanzar. Las coordenadas se conservan internamente sin exponerlas como campos técnicos.
- La IA propone los cinco campos narrativos. «Aplicar propuesta» refleja sus valores en los editores y registra la operación de origen. Modificar un texto lo convierte en revisión propia. Preguntas pendientes se muestran sin inventar información.
- Logo y banner: conservar actual, elegir Facebook, subir PNG/JPEG/WebP, o generar una alternativa nueva/mejorada/rediseñada con IA. Mejorar exige referencia. Se muestran color, instrucciones y transparencia opcional para logo.
- Las propuestas de imagen requieren selección explícita. Vista de banner en computadora y aproximación del recorte central en celular. Se conserva el banner completo; el backend normaliza a 1890×666. No se añade un banner móvil independiente.
- Operaciones en curso se recuperan del borrador y se consultan sin repetir generación. Solicitudes con resultado incierto conservan la clave de idempotencia mientras permanece abierta la página y ofrecen comprobar esa misma solicitud.
- Antes de confirmar se recupera la revisión actual del negocio. Cambios concurrentes requieren revisar los valores actuales y aceptarlos. La reconexión necesaria para guardar datos derivados de Meta conserva el borrador.
- Las imágenes privadas se consultan con Bearer y Blob; no se envían credenciales a URLs externas.

## Requisitos de despliegue

Backend con rutas de borradores, migración correspondiente y configuración de modelo/proveedor de imágenes. La falta de configuración se muestra en español y permite continuar sin IA. No se han realizado generaciones reales de pago como parte de la verificación frontend.

## Verificación

TypeScript, ESLint de archivos cambiados y build de producción. No se ejecutan pruebas según AGENTS.md. La prueba real de OAuth y generación requiere backend desplegado, sesión autorizada y cuota de IA.
