### 1. Nuevo Endpoint Implementado
Ruta: GET /api/v1/suppliers/{supplier_id}/stats

Parámetros (Query Params):

- start_date : (Opcional) Fecha de inicio para filtrar.
- end_date : (Opcional) Fecha fin.
- interval : (Opcional) Granularidad de la gráfica de tiempo. Valores: "day" , "week" , "month" , "year" . Por defecto es "day" .
### 2. Estructura de la Respuesta (JSON)
La respuesta tiene dos secciones principales para facilitar la visualización:

```
{
  "summary": {
    "total_revenue": 15000.50,      // Ventas 
    totales (Solo estatus COMPLETED)
    "total_orders": 150,            // Total de 
    pedidos recibidos
    "completed_count": 120,
    "pending_count": 20,
    "cancelled_count": 10,
    "revenue_by_status": {          // Dinero 
    potencial por estatus
      "completed": 15000.50,
      "pending": 2500.00,
      "cancelled": 1000.00
    }
  },
  "timeline": [                     // Array para 
  gráficas de línea/barra
    {
      "date": "2023-10-01T00:00:00",
      "amount": 500.00,             // Ventas 
      (COMPLETED) en este periodo
      "count": 5                    // Total de 
      pedidos en este periodo
    },
    ...
  ]
}
```
### 3. Sugerencias para el Frontend
Con estos datos puedes construir un panel de control muy completo:

- Tarjetas de Resumen (KPIs):
  
  - Usa summary.total_revenue para mostrar "Ventas Totales" .
  - Usa summary.total_orders para mostrar "Pedidos Totales" .
  - Usa summary.pending_count para una alerta de "Pedidos Pendientes" que requieren atención.
- Gráfica de Pastel (Pie Chart):
  
  - Título: "Estado de los Pedidos"
  - Datos: Usa completed_count , pending_count y cancelled_count para mostrar qué porcentaje de ventas se concretan vs. cancelan.
- Gráfica de Líneas o Barras (Time Series):
  
  - Título: "Ventas por Día" (o Semana/Mes)
  - Eje X (Horizontal): Usa timeline[].date .
  - Eje Y (Vertical): Tienes dos opciones:
    1. timeline[].amount : Para ver la tendencia de ingresos ($).
    2. timeline[].count : Para ver la tendencia de volumen de pedidos (cantidad).