# Cambios Realizados en Dash (Repo Actual)

## Base de Datos
- Se creó una migración SQL `supabase/migrations/add_video_boolean_to_orders.sql` para añadir la columna `video` (boolean) a la tabla `orders`.
  - Propósito: Identificar pedidos que incluyen el servicio de generación de video (e.g., Paquete Deluxe).

## Tipos (Backend/Frontend)
- Se actualizó el tipo `Order` en `lib/supabase.ts` para incluir el campo `video: boolean | null`.

## Frontend (Dashboard)
- **Tabla de Transacciones (`components/transactions-table.tsx`):**
  - Se agregó una lógica visual para mostrar un badge "🎥 Video" (color rosa) junto al estado del paquete cuando `video` es true.
  - Esto permite a los operadores identificar rápidamente qué pedidos requieren generación de video.

- **Formulario de Transacción (`components/transaction-form.tsx`):**
  - Se actualizó el esquema de validación (`zod`) para incluir `video`.
  - Se añadió un checkbox "Video Generation" en la pestaña "Status" para permitir a los administradores activar/desactivar manualmente esta opción si es necesario.
