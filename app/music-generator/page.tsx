import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import SunoGenerator from "@/components/suno-generator"

export const metadata = {
  title: "AI Music Generator",
  description: "Generate custom AI music using Suno",
}

export default function MusicGeneratorPage() {
  return (
    <div className="container mx-auto py-10">
      <Card className="max-w-5xl mx-auto">
        <CardHeader>
          <CardTitle>AI Music Generator</CardTitle>
          <CardDescription>
            Create custom music tracks using Suno AI. Generate songs with vocals based on prompts, lyrics, and style
            preferences.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SunoGenerator />
        </CardContent>
      </Card>
    </div>
  )
}
