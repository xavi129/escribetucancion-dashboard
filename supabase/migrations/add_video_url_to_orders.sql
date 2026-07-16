-- Migración: Agregar campos para generación de videos musicales
-- Fecha: 2024
-- Descripción: Agrega el campo video_url y campos opcionales para mejorar la integración con Suno API

-- Agregar campo video_url para almacenar la URL del video generado
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Agregar campos opcionales para guardar taskId y audioId de Suno
-- Estos campos permitirán generar videos automáticamente sin solicitar estos valores al usuario
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS suno_task_id TEXT;

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS suno_audio_id TEXT;

-- Agregar comentarios para documentar los campos
COMMENT ON COLUMN orders.video_url IS 'URL del video musical generado por Suno API';
COMMENT ON COLUMN orders.suno_task_id IS 'Task ID de la generación de audio original de Suno (para generar video)';
COMMENT ON COLUMN orders.suno_audio_id IS 'Audio ID del track generado por Suno (para generar video)';

-- Crear índices opcionales para mejorar las consultas (si es necesario)
-- CREATE INDEX IF NOT EXISTS idx_orders_video_url ON orders(video_url) WHERE video_url IS NOT NULL;
-- CREATE INDEX IF NOT EXISTS idx_orders_suno_task_id ON orders(suno_task_id) WHERE suno_task_id IS NOT NULL;


