-- Migración: Agregar campo addons_total_price a la tabla orders
-- Fecha: 2025-01-27
-- Descripción: Agrega el campo addons_total_price para rastrear el total de precios de todos los addons

-- Agregar campo addons_total_price para almacenar el total de precios de addons
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS addons_total_price NUMERIC DEFAULT 0;

-- Agregar comentario para documentar el campo
COMMENT ON COLUMN orders.addons_total_price IS 'Total de precios de todos los addons agregados a la orden (ej: video karaoke)';

-- Actualizar órdenes existentes para que tengan 0 en lugar de NULL
UPDATE orders 
SET addons_total_price = 0 
WHERE addons_total_price IS NULL;









