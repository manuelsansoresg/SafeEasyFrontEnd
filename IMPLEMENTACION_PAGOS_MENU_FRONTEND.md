# Drooopy - Frontend pagos de pedidos de menú

Este paquete implementa en frontend:

- Configuración del proveedor por menú:
  - efectivo,
  - pago en línea,
  - ambos.
- Estado de cuenta Mercado Pago vinculada.
- Botón para vincular Mercado Pago cuando todavía no está conectado.
- Selección del método de pago por el cliente.
- Redirección a Mercado Pago cuando elige pago en línea.
- Seguimiento del estado del pago.
- Botón para continuar un pago pendiente.
- Visualización del método/estado de pago en el detalle del proveedor.

Archivos:
- src/types/menuOrder.ts
- src/services/menuOrderService.ts
- src/lib/menuOrders.ts
- src/app/admin/menu/[menuId]/pedidos/page.tsx
- src/components/supplier/menu/PublicSupplierMenu.tsx
- src/app/pedidos/menu/[orderNumber]/page.tsx
- src/app/admin/menu/pedidos/[orderId]/page.tsx

Este frontend requiere el backend con la migración e7b2c5d8a1f4.
