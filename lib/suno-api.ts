/**
 * Suno API Integration (kie.ai)
 * This file provides functions for interacting with the Suno AI music generation API
 * Documentation: https://docs.kie.ai/suno-api/quickstart
 * API Key: Get yours at https://kie.ai/api-key
 */

const API_BASE_URL = "https://api.kie.ai/api/v1"
const SUNO_API_KEY = process.env.SUNO_API_KEY

export type SunoModel = "V3_5" | "V4" | "V4_5" | "V4_5PLUS" | "V5"

export type SunoGenerateOptions = {
  prompt: string
  style?: string
  model?: SunoModel
  customMode?: boolean
  instrumental?: boolean
  negativeTags?: string
  title?: string
  callBackUrl?: string
}

export type SunoCustomGenerateOptions = {
  lyric: string
  style?: string
  title?: string
  model?: SunoModel
  vocalGender?: string
  callBackUrl?: string
}

export type SunoTrack = {
  id: string
  audioUrl: string
  streamAudioUrl?: string
  imageUrl: string
  lyric: string
  videoUrl?: string
  title: string
  tags: string
  prompt?: string
  duration?: number
  createTime: string
  model?: string
}

export type TaskStatus =
  | "PENDING"
  | "TEXT_SUCCESS"
  | "FIRST_SUCCESS"
  | "SUCCESS"
  | "CREATE_TASK_FAILED"
  | "GENERATE_AUDIO_FAILED"
  | "CALLBACK_EXCEPTION"
  | "SENSITIVE_WORD_ERROR"

export type SunoTaskResponse = {
  taskId: string
  task_id?: string
  status: TaskStatus
  errorMessage?: string
  response?: {
    sunoData: SunoTrack[]
  }
}

export type SunoResponse = {
  code: number
  msg: string
  data?: {
    taskId?: string
    task_id?: string
    result?: string
    status?: TaskStatus
    errorMessage?: string
    response?: {
      sunoData: SunoTrack[]
    }
  } | SunoTaskResponse
}

export type SunoVideoResponse = {
  code: number
  msg: string
  data?: {
    taskId?: string
    task_id?: string
    video_url?: string
    videoUrl?: string
    status?: TaskStatus
    errorMessage?: string
  }
}

export type SunoVideoDetails = {
  taskId: string
  videoUrl: string
  status: TaskStatus
  errorMessage?: string
}

/**
 * Generate music using a text prompt
 */
export async function generateMusic(options: SunoGenerateOptions): Promise<SunoResponse> {
  if (!SUNO_API_KEY) {
    throw new Error("SUNO_API_KEY environment variable is not set")
  }

  const payload = {
    prompt: options.prompt,
    style: options.style,
    model: options.model || "V4_5",
    customMode: options.customMode || false,
    instrumental: options.instrumental || false,
    negativeTags: options.negativeTags,
    title: options.title,
    callBackUrl: options.callBackUrl,
  }

  try {
    const response = await fetch(`${API_BASE_URL}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUNO_API_KEY}`,
      },
      body: JSON.stringify(payload),
    })

    const result = await response.json()
    return result
  } catch (error) {
    console.error("Error generating music:", error)
    return {
      code: 500,
      msg: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Generate music with custom lyrics
 */
export async function generateCustomMusic(options: SunoCustomGenerateOptions): Promise<SunoResponse> {
  if (!SUNO_API_KEY) {
    throw new Error("SUNO_API_KEY environment variable is not set")
  }

  const payload = {
    customMode: true,
    prompt: options.lyric,
    style: options.style,
    title: options.title,
    model: options.model || "V4_5",
    vocalGender: options.vocalGender,
    instrumental: false,
    callBackUrl: options.callBackUrl,
  }

  try {
    const response = await fetch(`${API_BASE_URL}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUNO_API_KEY}`,
      },
      body: JSON.stringify(payload),
    })

    const result = await response.json()
    return result
  } catch (error) {
    console.error("Error generating custom music:", error)
    return {
      code: 500,
      msg: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Check the status of a music generation task
 */
export async function checkTaskStatus(taskId: string): Promise<SunoResponse> {
  if (!SUNO_API_KEY) {
    throw new Error("SUNO_API_KEY environment variable is not set")
  }

  try {
    const response = await fetch(`${API_BASE_URL}/generate/record-info?taskId=${taskId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${SUNO_API_KEY}`,
      },
    })

    const result = await response.json()
    return result
  } catch (error) {
    console.error("Error checking task status:", error)
    return {
      code: 500,
      msg: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Get timestamped lyrics (aligned words + waveform) for a generated track
 * POST /api/v1/generate/get-timestamped-lyrics
 * Respuesta Kie: { code, msg, data: { alignedWords, waveformData, ... } }
 */
export async function getTimestampedLyrics(
  taskId: string,
  audioId: string,
): Promise<{ code: number; msg?: string; data?: Record<string, unknown> }> {
  if (!SUNO_API_KEY) {
    throw new Error("SUNO_API_KEY environment variable is not set")
  }

  try {
    const response = await fetch(`${API_BASE_URL}/generate/get-timestamped-lyrics`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUNO_API_KEY}`,
      },
      body: JSON.stringify({ taskId, audioId }),
    })

    const result = await response.json()
    return result
  } catch (error) {
    console.error("Error getting timestamped lyrics:", error)
    return {
      code: 500,
      msg: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Extend an existing song
 */
export async function extendSong(
  audioId: string,
  continueAt: number,
  prompt?: string,
  style?: string,
  title?: string,
  model: SunoModel = "V4_5",
  callBackUrl?: string,
): Promise<SunoResponse> {
  if (!SUNO_API_KEY) {
    throw new Error("SUNO_API_KEY environment variable is not set")
  }

  const payload = {
    audioId,
    continueAt,
    prompt,
    style,
    title,
    model,
    defaultParamFlag: false,
    callBackUrl,
  }

  try {
    const response = await fetch(`${API_BASE_URL}/generate/extend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUNO_API_KEY}`,
      },
      body: JSON.stringify(payload),
    })

    const result = await response.json()
    return result
  } catch (error) {
    console.error("Error extending song:", error)
    return {
      code: 500,
      msg: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Generate lyrics from a text prompt
 */
export async function generateLyrics(prompt: string, callBackUrl?: string): Promise<SunoResponse> {
  if (!SUNO_API_KEY) {
    throw new Error("SUNO_API_KEY environment variable is not set")
  }

  const payload = {
    prompt,
    callBackUrl,
  }

  try {
    const response = await fetch(`${API_BASE_URL}/lyrics`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUNO_API_KEY}`,
      },
      body: JSON.stringify(payload),
    })

    const result = await response.json()
    return result
  } catch (error) {
    console.error("Error generating lyrics:", error)
    return {
      code: 500,
      msg: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Enhance music style description for better results (V4_5 models)
 */
export async function boostMusicStyle(content: string): Promise<SunoResponse> {
  if (!SUNO_API_KEY) {
    throw new Error("SUNO_API_KEY environment variable is not set")
  }

  const payload = {
    content,
  }

  try {
    const response = await fetch(`${API_BASE_URL}/style/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUNO_API_KEY}`,
      },
      body: JSON.stringify(payload),
    })

    const result = await response.json()
    return result
  } catch (error) {
    console.error("Error boosting music style:", error)
    return {
      code: 500,
      msg: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Convert audio to WAV format
 */
export async function convertToWav(
  taskId: string,
  audioId: string,
  callBackUrl?: string,
): Promise<SunoResponse> {
  if (!SUNO_API_KEY) {
    throw new Error("SUNO_API_KEY environment variable is not set")
  }

  const payload = {
    taskId,
    audioId,
    callBackUrl,
  }

  try {
    const response = await fetch(`${API_BASE_URL}/wav/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUNO_API_KEY}`,
      },
      body: JSON.stringify(payload),
    })

    const result = await response.json()
    return result
  } catch (error) {
    console.error("Error converting to WAV:", error)
    return {
      code: 500,
      msg: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Separate vocals and instrumental from a song
 */
export async function separateVocalsAndInstrumental(
  audioId: string,
  taskId?: string,
  callBackUrl?: string,
): Promise<SunoResponse> {
  if (!SUNO_API_KEY) {
    throw new Error("SUNO_API_KEY environment variable is not set")
  }

  const payload: any = {
    audioId,
  }

  if (taskId) {
    payload.taskId = taskId
  }

  if (callBackUrl) {
    payload.callBackUrl = callBackUrl
  }

  try {
    const response = await fetch(`${API_BASE_URL}/vocal-separation/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUNO_API_KEY}`,
      },
      body: JSON.stringify(payload),
    })

    const result = await response.json()
    return result
  } catch (error) {
    console.error("Error separating vocals and instrumental:", error)
    return {
      code: 500,
      msg: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Get concatenated song (combine multiple audio segments)
 */
export async function getConcatenatedSong(
  audioId: string,
  callBackUrl?: string,
): Promise<SunoResponse> {
  if (!SUNO_API_KEY) {
    throw new Error("SUNO_API_KEY environment variable is not set")
  }

  const payload: any = {
    audioId,
  }

  if (callBackUrl) {
    payload.callBackUrl = callBackUrl
  }

  try {
    const response = await fetch(`${API_BASE_URL}/generate/concatenate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUNO_API_KEY}`,
      },
      body: JSON.stringify(payload),
    })

    const result = await response.json()
    return result
  } catch (error) {
    console.error("Error getting concatenated song:", error)
    return {
      code: 500,
      msg: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Create a cover of a song with new lyrics and style
 */
export async function coverSong(
  audioId: string,
  coverLyric: string,
  coverStyle: string,
  model: SunoModel = "V4_5",
  callBackUrl?: string,
): Promise<SunoResponse> {
  if (!SUNO_API_KEY) {
    throw new Error("SUNO_API_KEY environment variable is not set")
  }

  const payload: any = {
    audioId,
    lyric: coverLyric,
    style: coverStyle,
    model,
  }

  if (callBackUrl) {
    payload.callBackUrl = callBackUrl
  }

  try {
    const response = await fetch(`${API_BASE_URL}/generate/cover`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUNO_API_KEY}`,
      },
      body: JSON.stringify(payload),
    })

    const result = await response.json()
    return result
  } catch (error) {
    console.error("Error creating cover song:", error)
    return {
      code: 500,
      msg: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Replace a section of a song with new content
 * Documentation: https://docs.kie.ai/suno-api/replace-section
 *
 * @param taskId - Original task ID (parent task)
 * @param audioId - Audio ID to replace
 * @param prompt - Prompt describing the replacement segment content
 * @param tags - Music style tags (required)
 * @param title - Music title (required)
 * @param infillStartS - Start time for replacement (seconds, 2 decimal places)
 * @param infillEndS - End time for replacement (seconds, 2 decimal places)
 * @param negativeTags - Optional music styles to exclude
 * @param fullLyrics - Optional complete lyrics after modification
 * @param callBackUrl - Optional callback URL
 */
export async function replaceSongSection(
  taskId: string,
  audioId: string,
  prompt: string,
  tags: string,
  title: string,
  infillStartS: number,
  infillEndS: number,
  negativeTags?: string,
  fullLyrics?: string,
  callBackUrl?: string,
): Promise<SunoResponse> {
  if (!SUNO_API_KEY) {
    throw new Error("SUNO_API_KEY environment variable is not set")
  }

  const payload: any = {
    taskId,
    audioId,
    prompt,
    tags,
    title,
    infillStartS,
    infillEndS,
  }

  if (negativeTags) {
    payload.negativeTags = negativeTags
  }

  if (fullLyrics) {
    payload.fullLyrics = fullLyrics
  }

  if (callBackUrl) {
    payload.callBackUrl = callBackUrl
  }

  try {
    const response = await fetch(`${API_BASE_URL}/generate/replace-section`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUNO_API_KEY}`,
      },
      body: JSON.stringify(payload),
    })

    const result = await response.json()
    // Log respuesta de Kie para verificar formato (code, msg, data.taskId / data.task_id)
    console.log("[Suno replace-section] Kie API response:", {
      code: result.code,
      msg: result.msg,
      dataKeys: result.data ? Object.keys(result.data) : [],
      taskId: result.data?.taskId ?? result.data?.task_id,
    })
    return result
  } catch (error) {
    console.error("Error replacing song section:", error)
    return {
      code: 500,
      msg: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Create a music video from an audio track
 * Documentation: https://docs.kie.ai/suno-api/create-music-video
 */
export async function createMusicVideo(
  taskId: string,
  audioId: string,
  callBackUrl?: string,
  author?: string,
  domainName?: string,
): Promise<SunoVideoResponse> {
  if (!SUNO_API_KEY) {
    throw new Error("SUNO_API_KEY environment variable is not set")
  }

  const payload: any = {
    taskId,
    audioId,
  }

  if (callBackUrl) {
    payload.callBackUrl = callBackUrl
  }

  if (author) {
    payload.author = author
  }

  if (domainName) {
    payload.domainName = domainName
  }

  try {
    const response = await fetch(`${API_BASE_URL}/video/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUNO_API_KEY}`,
      },
      body: JSON.stringify(payload),
    })

    const result = await response.json()
    return result
  } catch (error) {
    console.error("Error creating music video:", error)
    return {
      code: 500,
      msg: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Get music video details by task ID
 * Documentation: https://docs.kie.ai/suno-api/get-music-video-details
 */
export async function getMusicVideoDetails(taskId: string): Promise<SunoVideoResponse> {
  if (!SUNO_API_KEY) {
    throw new Error("SUNO_API_KEY environment variable is not set")
  }

  try {
    const response = await fetch(`${API_BASE_URL}/video/details?taskId=${taskId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${SUNO_API_KEY}`,
      },
    })

    const result = await response.json()
    return result
  } catch (error) {
    console.error("Error getting music video details:", error)
    return {
      code: 500,
      msg: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Wait for task completion with polling
 * @param taskId The task ID to monitor
 * @param maxWaitTime Maximum time to wait in milliseconds (default: 10 minutes)
 * @param pollInterval Time between status checks in milliseconds (default: 10 seconds)
 */
export async function waitForCompletion(
  taskId: string,
  maxWaitTime: number = 600000,
  pollInterval: number = 10000,
): Promise<SunoTaskResponse> {
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitTime) {
    const response = await checkTaskStatus(taskId)

    if (response.code !== 200) {
      throw new Error(response.msg || "Failed to check task status")
    }

    const taskData = response.data as SunoTaskResponse

    switch (taskData.status) {
      case "SUCCESS":
      case "FIRST_SUCCESS":
      case "TEXT_SUCCESS":
        return taskData

      case "CREATE_TASK_FAILED":
      case "GENERATE_AUDIO_FAILED":
      case "CALLBACK_EXCEPTION":
      case "SENSITIVE_WORD_ERROR":
        throw new Error(taskData.errorMessage || `Task failed with status: ${taskData.status}`)

      case "PENDING":
        // Continue waiting
        break

      default:
        console.log(`Unknown status: ${taskData.status}`)
    }

    // Wait before next check
    await new Promise((resolve) => setTimeout(resolve, pollInterval))
  }

  throw new Error("Task timeout: Generation took too long")
}
