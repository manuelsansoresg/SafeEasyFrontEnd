# Drooopy - Frontend pagos del módulo Menú

Implementa:
- efectivo;
- pago en línea;
- ambos métodos;
- vinculación de Mercado Pago desde la configuración del menú;
- selector de forma de pago en el checkout público;
- redirección a Mercado Pago cuando se elige pago en línea;
- visualización del estado del pago para proveedor y cliente.

Archivos:
- src/types/menuOrder.ts
- src/services/menuOrderService.ts
- src/app/admin/menu/[menuId]/pedidos/page.tsx
- src/components/supplier/menu/PublicSupplierMenu.tsx
- src/app/admin/menu/pedidos/[orderId]/page.tsx
- src/app/pedidos/menu/[orderNumber]/page.tsx

Requiere primero el backend de pagos de menú.
