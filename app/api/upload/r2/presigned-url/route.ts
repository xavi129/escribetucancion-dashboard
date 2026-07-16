import { NextResponse } from "next/server"
import { AwsClient } from "aws4fetch"

export async function POST(request: Request) {
  try {
    // Verificar que las variables de entorno estén configuradas
    if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET_NAME) {
      return NextResponse.json(
        { success: false, message: "Configuración de R2 no encontrada. Por favor, configura las variables de entorno." },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { fileName, orderId } = body

    if (!fileName) {
      return NextResponse.json(
        { success: false, message: "Nombre de archivo es requerido" },
        { status: 400 }
      )
    }

    // Generar un nombre único para el archivo (solo letras y números, sin guiones)
    // Formato similar a: OTZiODc5YzItMzc3Yi00ZmVlLWI2ZmItYjFlYWVkZGJlZGMw.mp3
    const randomId = crypto.randomUUID().replace(/-/g, "")
    const fileExtension = fileName.split(".").pop() || "mp3"
    const uniqueFileName = `${randomId}.${fileExtension}`
    // No incluir orderId en la ruta para evitar guiones - el nombre del archivo ya es único
    const objectKey = `songs/${uniqueFileName}`

    // Crear cliente AWS para firmar
    const client = new AwsClient({
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    })

    // Construir la URL del objeto en R2
    // Formato correcto: https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${objectKey}
    // El objectKey se codifica automáticamente por el constructor URL
    const url = new URL(
      `https://${process.env.R2_BUCKET_NAME}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${objectKey}`
    )

    // Establecer el tiempo de expiración (1 hora = 3600 segundos)
    // Puedes ajustar esto según tus necesidades (máximo 7 días = 604800 segundos)
    url.searchParams.set("X-Amz-Expires", "3600")

    console.log("Generando presigned URL para:", {
      bucket: process.env.R2_BUCKET_NAME,
      accountId: process.env.R2_ACCOUNT_ID,
      objectKey: objectKey,
      url: url.toString(),
    })

    // Firmar la URL para PUT (subida)
    // No incluir headers en la firma - el Content-Type se puede enviar opcionalmente
    const signedRequest = await client.sign(
      new Request(url.toString(), {
        method: "PUT",
      }),
      {
        aws: { signQuery: true },
      }
    )

    console.log("Presigned URL generada exitosamente")

    // Construir la URL pública del archivo después de la subida
    const publicUrl = process.env.R2_PUBLIC_URL 
      ? `${process.env.R2_PUBLIC_URL}/${objectKey}`
      : `https://${process.env.R2_BUCKET_NAME}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${objectKey}`

    return NextResponse.json({
      success: true,
      presignedUrl: signedRequest.url,
      publicUrl: publicUrl,
      objectKey: objectKey,
      message: "Presigned URL generada exitosamente",
      // Información adicional para debugging
      debug: {
        bucket: process.env.R2_BUCKET_NAME,
        accountId: process.env.R2_ACCOUNT_ID,
        objectKey: objectKey,
      },
    })
  } catch (error) {
    console.error("Error al generar presigned URL:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Error al generar presigned URL",
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    )
  }
}

