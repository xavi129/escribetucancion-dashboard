import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

/** Máximo de órdenes por ejecución (evita timeouts del cron). */
const DEFAULT_BATCH_LIMIT = 50
const MAX_BATCH_LIMIT = 100

type CronResultItem = {
  orderId: string
  ok: boolean
  skipped?: string
  error?: string
  detail?: string
}

function resolveInternalBaseUrl(request: NextRequest): string {
  if (process.env.NEXT_PUBLIC_BASE_URL?.trim()) {
    return process.env.NEXT_PUBLIC_BASE_URL.trim().replace(/\/$/, "")
  }
  const host = request.headers.get("host")
  const protocol = request.headers.get("x-forwarded-proto") || "https"
  const allowedHosts = [
    "dash.escribetucancion.com",
    "localhost:3000",
    "localhost",
  ]
  if (host && allowedHosts.some((a) => host === a || host.startsWith(`${a}:`))) {
    return `${protocol}://${host}`
  }
  return "https://dash.escribetucancion.com"
}

function isCronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const bearer = request.headers.get("authorization")
  if (bearer === `Bearer ${secret}`) return true
  if (request.headers.get("x-cron-secret") === secret) return true
  return false
}

function hasNoAudioUrl(audioUrl: string | null | undefined): boolean {
  return audioUrl == null || String(audioUrl).trim() === ""
}

/**
 * Cron: cada ejecución busca órdenes `confirmed` sin `audio_url` y llama a
 * POST /api/orders/generate-song (misma lógica que el botón manual).
 */
export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 401 }
    )
  }

  if (!supabaseAdmin) {
    console.error("[cron/generate-songs] supabaseAdmin no configurado")
    return NextResponse.json(
      { success: false, error: "Error de configuración del servidor" },
      { status: 500 }
    )
  }

  let limit = DEFAULT_BATCH_LIMIT
  try {
    const body = await request.json().catch(() => ({}))
    if (
      typeof body?.limit === "number" &&
      Number.isFinite(body.limit) &&
      body.limit > 0
    ) {
      limit = Math.min(Math.floor(body.limit), MAX_BATCH_LIMIT)
    }
  } catch {
    /* cuerpo vacío o no JSON */
  }

  // confirmed + sin audio; status "generating" queda excluido por .eq("status", "confirmed")
  const { data: orders, error } = await supabaseAdmin
    .from("orders")
    .select("id, status, audio_url, generated_lyric")
    .eq("status", "confirmed")
    .is("audio_url", null)
    .order("created_at", { ascending: true })
    .limit(limit)

  if (error) {
    console.error("[cron/generate-songs] Error Supabase:", error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }

  const baseUrl = resolveInternalBaseUrl(request)
  const results: CronResultItem[] = []

  for (const row of orders ?? []) {
    if (!hasNoAudioUrl(row.audio_url)) {
      results.push({
        orderId: row.id,
        ok: true,
        skipped: "already_has_audio",
      })
      continue
    }

    if (!row.generated_lyric || row.generated_lyric.trim() === "") {
      console.warn(
        `[cron/generate-songs] Omitiendo orden ${row.id}: sin generated_lyric`
      )
      results.push({
        orderId: row.id,
        ok: false,
        skipped: "no_lyric",
      })
      continue
    }

    try {
      const res = await fetch(`${baseUrl}/api/orders/generate-song`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: row.id }),
      })

      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean
        error?: string
        message?: string
        data?: { existing?: boolean }
      }

      const alreadyGenerated =
        res.ok &&
        json.success === true &&
        json.data?.existing === true

      if (res.ok && json.success === true) {
        results.push({
          orderId: row.id,
          ok: true,
          detail: alreadyGenerated ? "already_generated" : "generation_started",
        })
      } else {
        const msg =
          json.error ||
          json.message ||
          (typeof json === "object" && JSON.stringify(json)) ||
          `HTTP ${res.status}`
        console.error(`[cron/generate-songs] Fallo orden ${row.id}:`, msg)
        results.push({
          orderId: row.id,
          ok: false,
          error: String(msg),
        })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`[cron/generate-songs] Excepción orden ${row.id}:`, e)
      results.push({
        orderId: row.id,
        ok: false,
        error: msg,
      })
    }
  }

  const okCount = results.filter((r) => r.ok).length
  const failCount = results.length - okCount

  return NextResponse.json({
    success: true,
    batchLimit: limit,
    candidates: orders?.length ?? 0,
    ok: okCount,
    failedOrSkipped: failCount,
    results,
  })
}

/** Comprobación manual / health (requiere el mismo secreto). */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 })
  }

  const hasSecret = Boolean(process.env.CRON_SECRET)
  const hasAdmin = Boolean(supabaseAdmin)

  return NextResponse.json({
    success: true,
    message: "Endpoint cron generate-songs activo",
    configured: { CRON_SECRET: hasSecret, supabaseAdmin: hasAdmin },
    timestamp: new Date().toISOString(),
  })
}
