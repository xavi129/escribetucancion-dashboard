"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Music, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"

type SunoTrack = {
  id: string
  title: string
  image_url: string
  audio_url: string
  video_url?: string
  lyric: string
  duration?: number
  state: string
}

export default function SunoGenerator() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customMode, setCustomMode] = useState(false)
  const [instrumental, setInstrumental] = useState(false)
  const [prompt, setPrompt] = useState("")
  const [lyrics, setLyrics] = useState("")
  const [style, setStyle] = useState("")
  const [title, setTitle] = useState("")
  const [model, setModel] = useState("chirp-v4")
  const [negativeTags, setNegativeTags] = useState("")
  const [taskId, setTaskId] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [tracks, setTracks] = useState<SunoTrack[]>([])

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    // Start polling if we have a task ID
    if (taskId && isPolling) {
      interval = setInterval(async () => {
        await checkTaskStatus()
      }, 5000) // Check every 5 seconds
    }

    // Cleanup interval on unmount
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [taskId, isPolling])

  const validateForm = () => {
    setError(null)

    if (customMode) {
      if (!instrumental && !lyrics) {
        setError("Lyrics are required in custom mode")
        return false
      }
    } else {
      if (!prompt) {
        setError("Prompt is required")
        return false
      }
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsLoading(true)
    setError(null)
    setTracks([])

    try {
      const response = await fetch("/api/suno/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customMode,
          instrumental,
          prompt: customMode ? null : prompt,
          lyric: customMode ? lyrics : null,
          style,
          title,
          model,
          negativeTags,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        setError(data.message || "Failed to generate music")
        return
      }

      if (data.task_id) {
        setTaskId(data.task_id)
        setIsPolling(true)

        // Initial check
        await checkTaskStatus()
      }

      if (data.data && data.data.length > 0) {
        setTracks(data.data)
      }
    } catch (err) {
      setError("Error submitting request")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const checkTaskStatus = async () => {
    if (!taskId) return

    try {
      const response = await fetch("/api/suno/task-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        console.error("Error checking task status:", data.message)
        return
      }

      // If we have task data and response data
      if (data.data?.response?.data?.length > 0) {
        setTracks(data.data.response.data)
        setIsPolling(false)
      }
    } catch (err) {
      console.error("Error checking task status:", err)
    }
  }

  const handleManualCheck = async () => {
    setIsPolling(true)
    await checkTaskStatus()
    setIsPolling(false)
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit}>
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="basic">Basic Settings</TabsTrigger>
            <TabsTrigger value="advanced">Advanced Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="grid gap-4">
              <div className="flex items-center justify-between space-x-2">
                <div>
                  <Label htmlFor="custom-mode">Custom Mode</Label>
                  <p className="text-sm text-muted-foreground">Enable for more control over the generated music</p>
                </div>
                <Switch id="custom-mode" checked={customMode} onCheckedChange={setCustomMode} />
              </div>

              <div className="flex items-center justify-between space-x-2">
                <div>
                  <Label htmlFor="instrumental">Instrumental Only</Label>
                  <p className="text-sm text-muted-foreground">Generate music without vocals</p>
                </div>
                <Switch id="instrumental" checked={instrumental} onCheckedChange={setInstrumental} />
              </div>

              {!customMode ? (
                <div className="space-y-2">
                  <Label htmlFor="prompt">Prompt</Label>
                  <Textarea
                    id="prompt"
                    placeholder="Describe the music you want to generate..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={5}
                  />
                  <p className="text-xs text-muted-foreground">Maximum 400 characters in standard mode</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="lyrics">Lyrics</Label>
                  <Textarea
                    id="lyrics"
                    placeholder="Enter the song lyrics with format [Verse], [Chorus], etc."
                    value={lyrics}
                    onChange={(e) => setLyrics(e.target.value)}
                    rows={10}
                    disabled={instrumental}
                  />
                  <p className="text-xs text-muted-foreground">Maximum 3000 characters in custom mode</p>
                </div>
              )}

              {customMode && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="title">Song Title</Label>
                    <Input
                      id="title"
                      placeholder="Enter a title for the song"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Maximum 80 characters</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="style">Style</Label>
                    <Input
                      id="style"
                      placeholder="e.g., pop, rock, jazz"
                      value={style}
                      onChange={(e) => setStyle(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Musical style or genre</p>
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger id="model">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chirp-v3">Chirp v3</SelectItem>
                    <SelectItem value="chirp-v3.5">Chirp v3.5</SelectItem>
                    <SelectItem value="chirp-v4">Chirp v4</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Select the AI model version</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="negative-tags">Negative Tags</Label>
                <Input
                  id="negative-tags"
                  placeholder="Styles to exclude, e.g., heavy metal"
                  value={negativeTags}
                  onChange={(e) => setNegativeTags(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Musical styles to exclude from generation</p>
              </div>

              {!customMode && (
                <div className="space-y-2">
                  <Label htmlFor="title">Song Title (Optional)</Label>
                  <Input
                    id="title"
                    placeholder="Enter a title for the song"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
              )}

              {!customMode && (
                <div className="space-y-2">
                  <Label htmlFor="style">Style (Optional)</Label>
                  <Input
                    id="style"
                    placeholder="e.g., pop, rock, jazz"
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                  />
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {taskId && (
          <Alert className="mt-4">
            <AlertTitle>Task ID: {taskId}</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <p>Music generation is in progress. This typically takes 1-2 minutes.</p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleManualCheck} disabled={isPolling}>
                  {isPolling ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Check Status
                    </>
                  )}
                </Button>
                <Badge variant={isPolling ? "secondary" : "outline"}>
                  {isPolling ? "Checking status..." : "Waiting for results"}
                </Badge>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end mt-6">
          <Button type="submit" disabled={isLoading} className="flex items-center">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Music className="mr-2 h-4 w-4" />
                Generate Music
              </>
            )}
          </Button>
        </div>
      </form>

      {tracks.length > 0 && (
        <div className="space-y-4 mt-8">
          <h2 className="text-2xl font-bold">Generated Tracks</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {tracks.map((track) => (
              <Card key={track.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle>{track.title || "Generated Track"}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge>{track.id}</Badge>
                    {track.duration && (
                      <Badge variant="outline">
                        {Math.floor(track.duration / 60)}:{String(Math.floor(track.duration % 60)).padStart(2, "0")}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="aspect-video bg-muted relative mb-3 rounded overflow-hidden">
                    {track.image_url ? (
                      <img
                        src={track.image_url || "/placeholder.svg"}
                        alt={track.title || "Track artwork"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Music className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  <audio src={track.audio_url} controls className="w-full" />

                  {track.lyric && (
                    <div className="mt-4">
                      <h3 className="text-sm font-medium mb-1">Lyrics:</h3>
                      <div className="max-h-32 overflow-y-auto bg-muted p-3 rounded text-sm whitespace-pre-wrap">
                        {track.lyric}
                      </div>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" size="sm" onClick={() => window.open(track.audio_url, "_blank")}>
                    Download Audio
                  </Button>
                  {track.video_url && (
                    <Button variant="outline" size="sm" onClick={() => window.open(track.video_url, "_blank")}>
                      Download Video
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
