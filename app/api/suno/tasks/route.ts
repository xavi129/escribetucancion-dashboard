import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { id, ids, action = "retrieve" } = body

    // Validar campos requeridos
    if (action === "retrieve" && !id) {
      return NextResponse.json({ message: "Task ID is required for retrieve action" }, { status: 400 })
    }

    if (action === "retrieve_batch" && (!ids || !Array.isArray(ids) || ids.length === 0)) {
      return NextResponse.json({ message: "Array of task IDs is required for retrieve_batch action" }, { status: 400 })
    }

    // Verificar si la API key está disponible
    const apiKey = process.env.SUNO_API_KEY
    if (!apiKey) {
      console.error("SUNO_API_KEY environment variable is not set")
      return NextResponse.json({ message: "API configuration error" }, { status: 500 })
    }

    // Preparar los datos para la API de Suno Tasks
    const requestData = {
      action,
      ...(action === "retrieve" && { id }),
      ...(action === "retrieve_batch" && { ids }),
    }

    console.log("Sending request to Suno Tasks API:", JSON.stringify(requestData, null, 2))

    // Realizar la llamada a la API de Suno Tasks
    const response = await fetch("https://api.acedata.cloud/suno/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestData),
    })

    // Verificar si la respuesta es exitosa
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Error from Suno Tasks API (${response.status}):`, errorText)
      return NextResponse.json(
        {
          success: false,
          message: `Error from Suno Tasks API: ${response.status} ${response.statusText}`,
          details: errorText.substring(0, 200),
        },
        { status: response.status || 500 },
      )
    }

    // Intentar analizar la respuesta como JSON
    let data
    try {
      data = await response.json()
    } catch (error) {
      console.error("Error parsing Suno Tasks API response:", error)
      const responseText = await response.text()
      return NextResponse.json(
        {
          success: false,
          message: "Invalid JSON response from Suno Tasks API",
          details: responseText.substring(0, 200),
        },
        { status: 500 },
      )
    }

    // Devolver los datos de la tarea
    return NextResponse.json({
      success: true,
      data: data,
    })
  } catch (error) {
    console.error("Error processing Suno Tasks API request:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
