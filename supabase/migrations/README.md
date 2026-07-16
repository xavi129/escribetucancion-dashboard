# Migraciones de Supabase

Este directorio contiene las migraciones SQL para la base de datos de Supabase.

## Aplicar Migraciones

### Opción 1: Desde el Dashboard de Supabase

1. Ve al Dashboard de Supabase: https://app.supabase.com
2. Selecciona tu proyecto
3. Ve a **SQL Editor**
4. Copia y pega el contenido del archivo de migración
5. Ejecuta la migración

### Opción 2: Usando Supabase CLI

```bash
# Instalar Supabase CLI (si no lo tienes)
npm install -g supabase

# Iniciar sesión
supabase login

# Vincular tu proyecto
supabase link --project-ref tu-project-ref

# Aplicar migración
supabase db push
```

### Opción 3: Ejecutar SQL directamente

Puedes ejecutar el SQL directamente en el SQL Editor de Supabase:

```sql
-- Copiar y pegar el contenido de add_video_url_to_orders.sql
```

## Cron: generación automática de canciones

Ver **[CRON_GENERATE_SONGS.md](../CRON_GENERATE_SONGS.md)** para programar en Supabase (`pg_cron` + `net.http_post`) la llamada a `/api/cron/generate-songs` cada 5 horas.

## Migraciones Disponibles

### `add_video_url_to_orders.sql`

Agrega los siguientes campos a la tabla `orders`:

- `video_url` (TEXT): URL del video musical generado
- `suno_task_id` (TEXT): Task ID de la generación de audio (opcional, para mejora futura)
- `suno_audio_id` (TEXT): Audio ID del track (opcional, para mejora futura)

## Notas

- Los campos `suno_task_id` y `suno_audio_id` son opcionales pero recomendados
- Estos campos permitirán generar videos automáticamente sin solicitar valores manualmente
- Ver `SUNO_VIDEO_INTEGRATION.md` para más detalles sobre cómo usar estos campos


